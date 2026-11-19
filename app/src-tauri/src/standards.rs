//! Runs the just-standards CLI (`bun <checkout>/cli/standards.ts`): once to completion for its JSON, or as a
//! keyed run whose NDJSON lines stream to the webview as `standards://line` and end with `standards://exit`.
//! A keyed run keeps its stdin open, so a fix run's permission answers can be written to it.

use claude_code::profiles::expand;
use claude_code::shell_path;
use serde::Serialize;
use std::collections::{HashMap, VecDeque};
use std::io::{BufRead, BufReader, Read, Write};
use std::os::unix::process::CommandExt;
use std::path::PathBuf;
use std::process::{ChildStdin, Command, Stdio};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use std::{env, fs, thread};
use tauri::{AppHandle, Emitter, Manager, State};

const LINE: &str = "standards://line";
const EXIT: &str = "standards://exit";
const STDERR_LINES: usize = 20;
/// How long a stopped run gets before SIGKILL: longer than `standards fix` gives Claude Code (5s), so it can record `stopped`.
const KILL_GRACE: Duration = Duration::from_secs(7);

struct Live {
    pid: u32,
    stdin: ChildStdin,
}

/// The running CLI processes by key, so one can be written to, stopped, and all of them killed on quit.
#[derive(Default)]
pub struct Runs(Arc<Mutex<HashMap<String, Live>>>);

impl Runs {
    fn signal(&self, key: &str, signal: i32) -> Option<u32> {
        let pid = self.0.lock().unwrap().get(key)?.pid;
        // Each run leads its own process group, so whatever the CLI spawned (a check's script, `gh`) goes too.
        unsafe { libc::kill(-(pid as i32), signal) };
        Some(pid)
    }

    fn alive(&self, key: &str, pid: u32) -> bool {
        self.0.lock().unwrap().get(key).is_some_and(|live| live.pid == pid)
    }

    fn write(&self, key: &str, line: &str) -> Result<(), String> {
        let mut live = self.0.lock().unwrap();
        let run = live.get_mut(key).ok_or_else(|| format!("run {key} is not going"))?;
        writeln!(run.stdin, "{line}").and_then(|_| run.stdin.flush()).map_err(|e| e.to_string())
    }

    pub fn kill_all(&self) {
        let keys: Vec<String> = self.0.lock().unwrap().keys().cloned().collect();
        for key in &keys {
            self.signal(key, libc::SIGTERM);
        }
        let deadline = Instant::now() + Duration::from_secs(1);
        while !self.0.lock().unwrap().is_empty() && Instant::now() < deadline {
            thread::sleep(Duration::from_millis(50));
        }
        for key in &keys {
            self.signal(key, libc::SIGKILL);
        }
    }
}

#[derive(Serialize, Clone)]
struct LinePayload<'a> {
    key: &'a str,
    line: String,
}

#[derive(Serialize, Clone)]
struct ExitPayload {
    key: String,
    code: Option<i32>,
    stderr: String,
}

fn home() -> PathBuf {
    env::var_os("HOME").map(PathBuf::from).unwrap_or_default()
}

fn find_bun(path: &str) -> Option<PathBuf> {
    env::split_paths(path)
        .map(|dir| dir.join("bun"))
        .chain([home().join(".bun/bin/bun"), "/opt/homebrew/bin/bun".into(), "/usr/local/bin/bun".into()])
        .find(|bin| fs::metadata(bin).is_ok_and(|m| m.is_file()))
}

/// `bun <checkout>/cli/standards.ts <args> --json --workspace <workspace>`, once both folders are there.
fn command(checkout: &str, workspace: &str, args: &[String]) -> Result<Command, String> {
    let home = home();
    let checkout = expand(&home, checkout.trim_end_matches('/'));
    let workspace = expand(&home, workspace.trim_end_matches('/'));
    let cli = checkout.join("cli/standards.ts");
    if !cli.is_file() {
        return Err(format!("No just-standards checkout at {}: cli/standards.ts is missing.", checkout.display()));
    }
    if !workspace.is_dir() {
        return Err(format!("No workspace folder at {}.", workspace.display()));
    }
    let bun = find_bun(shell_path()).ok_or("bun is not on the login shell's PATH.")?;
    let mut cmd = Command::new(bun);
    cmd.arg(cli)
        .args(args)
        .arg("--json")
        .arg("--workspace")
        .arg(workspace)
        .current_dir(checkout)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .process_group(0)
        .env("PATH", shell_path());
    Ok(cmd)
}

fn tail(reader: impl Read) -> String {
    let mut lines = VecDeque::with_capacity(STDERR_LINES);
    for line in BufReader::new(reader).lines().map_while(Result::ok) {
        if lines.len() == STDERR_LINES {
            lines.pop_front();
        }
        lines.push_back(line);
    }
    Vec::from(lines).join("\n").trim().to_owned()
}

/// Runs the CLI to completion: its stdout, or the tail of its stderr when it fails.
pub fn run_json(checkout: &str, workspace: &str, args: &[String]) -> Result<String, String> {
    let out = command(checkout, workspace, args)?.output().map_err(|e| format!("failed to start bun: {e}"))?;
    if out.status.success() {
        return String::from_utf8(out.stdout).map_err(|e| e.to_string());
    }
    let stderr = tail(out.stderr.as_slice());
    Err(if stderr.is_empty() { format!("standards {} exited with {}", args.join(" "), out.status) } else { stderr })
}

/// The home folder, for showing paths with `~`.
#[tauri::command]
pub fn home_dir() -> String {
    home().to_string_lossy().into_owned()
}

#[tauri::command]
pub async fn standards_json(checkout: String, workspace: String, args: Vec<String>) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || run_json(&checkout, &workspace, &args)).await.map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn standards_start(
    app: AppHandle,
    runs: State<'_, Runs>,
    key: String,
    checkout: String,
    workspace: String,
    args: Vec<String>,
) -> Result<(), String> {
    let mut cmd = command(&checkout, &workspace, &args)?;
    cmd.stdin(Stdio::piped());
    let mut live = runs.0.lock().unwrap();
    if live.contains_key(&key) {
        return Err(format!("run {key} is already going"));
    }
    let mut child = cmd.spawn().map_err(|e| format!("failed to start bun: {e}"))?;
    let stdin = child.stdin.take().unwrap();
    let stdout = child.stdout.take().unwrap();
    let stderr = child.stderr.take().unwrap();
    let pid = child.id();
    live.insert(key.clone(), Live { pid, stdin });
    drop(live);

    let stderr = thread::spawn(move || tail(stderr));
    let map = runs.0.clone();
    thread::spawn(move || {
        for line in BufReader::new(stdout).lines().map_while(Result::ok) {
            let _ = app.emit(LINE, LinePayload { key: &key, line });
        }
        let stderr = stderr.join().unwrap_or_default();
        let code = child.wait().ok().and_then(|status| status.code());
        let mut live = map.lock().unwrap();
        if live.get(&key).is_some_and(|l| l.pid == pid) {
            live.remove(&key);
        }
        drop(live);
        let _ = app.emit(EXIT, ExitPayload { key, code, stderr });
    });
    Ok(())
}

/// Writes one line to run `key`'s stdin: a fix run's answer to a permission question, or an interrupt.
#[tauri::command]
pub fn standards_write(runs: State<'_, Runs>, key: String, line: String) -> Result<(), String> {
    runs.write(&key, &line)
}

#[tauri::command]
pub fn standards_kill(app: AppHandle, key: String) -> Result<(), String> {
    let runs = app.state::<Runs>();
    let pid = runs.signal(&key, libc::SIGTERM).ok_or_else(|| format!("run {key} is not going"))?;
    thread::spawn(move || {
        thread::sleep(KILL_GRACE);
        let runs = app.state::<Runs>();
        if runs.alive(&key, pid) {
            runs.signal(&key, libc::SIGKILL);
        }
    });
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn names_the_missing_folder() {
        let dir = env::temp_dir().join(format!("standards-app-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        let checkout = dir.to_str().unwrap();
        let args = ["workspace".to_owned()];
        assert!(run_json(checkout, "/nowhere", &args).unwrap_err().starts_with("No just-standards checkout at"));

        fs::create_dir_all(dir.join("cli")).unwrap();
        fs::write(dir.join("cli/standards.ts"), "").unwrap();
        assert_eq!(run_json(checkout, "/nowhere", &args).unwrap_err(), "No workspace folder at /nowhere.");
        fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn writes_lines_to_a_runs_stdin() {
        let mut child = Command::new("cat").stdin(Stdio::piped()).stdout(Stdio::piped()).spawn().unwrap();
        let runs = Runs::default();
        runs.0.lock().unwrap().insert("k".into(), Live { pid: child.id(), stdin: child.stdin.take().unwrap() });
        runs.write("k", r#"{"type":"control_response"}"#).unwrap();
        assert_eq!(runs.write("other", "x").unwrap_err(), "run other is not going");
        runs.0.lock().unwrap().clear();
        let out = child.wait_with_output().unwrap();
        assert_eq!(String::from_utf8(out.stdout).unwrap(), "{\"type\":\"control_response\"}\n");
    }

    #[test]
    fn keeps_the_stderr_tail() {
        let text: String = (1..=30).map(|n| format!("line {n}\n")).collect();
        let kept = tail(text.as_bytes());
        assert!(kept.starts_with("line 11\n") && kept.ends_with("line 30"));
    }

    #[test]
    #[ignore = "runs the real standards CLI against ~/Projects/justanarthur/standards-workspace"]
    fn reads_the_real_workspace() {
        let out = run_json("~/Projects/justanarthur/just-standards", "~/Projects/justanarthur/standards-workspace", &["workspace".to_owned()])
            .unwrap();
        let model: serde_json::Value = serde_json::from_str(&out).unwrap();
        let businesses = model["businesses"].as_array().unwrap();
        let packs = model["packs"].as_array().unwrap();
        assert!(!businesses.is_empty() && !packs.is_empty());
        assert!(packs.iter().all(|pack| pack["items"].as_array().is_some_and(|items| !items.is_empty())));
        println!("{} businesses, {} packs, {} workers", businesses.len(), packs.len(), model["workers"].as_array().unwrap().len());
    }
}
