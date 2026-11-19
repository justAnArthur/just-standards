#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod standards;

use tauri::{Manager, RunEvent};

fn main() {
    app_core::builder()
        .manage(standards::Runs::default())
        .invoke_handler(tauri::generate_handler![
            standards::standards_json,
            standards::standards_start,
            standards::standards_write,
            standards::standards_kill,
            standards::home_dir,
        ])
        .build(tauri::generate_context!())
        .expect("error while building Standards")
        .run(|app, event| {
            if let RunEvent::Exit = event {
                app.state::<standards::Runs>().kill_all();
            }
        });
}
