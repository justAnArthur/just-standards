## Done when
The check passes on the PR's branch: gitleaks finds nothing in the history, because every finding was either a real secret that has been rotated (and is listed in `.gitleaksignore` with why) or a false positive marked as one.

## Make what is missing
The evidence names each finding as `rule in file:line (commit abc1234)`, never the value. For each:
1. **Look at it locally, without printing it anywhere else:** `git show <commit>:<file> | sed -n '<line>p'`. Don't paste the value into the PR, a commit message, an issue or the run's summary.
2. **A false positive** (a placeholder, a test fixture key, a public key, an example value from docs): add its fingerprint to `.gitleaksignore` at the repo root, one per line with a comment above it saying why. The fingerprint is `<commit>:<file>:<rule>:<line>`; `gitleaks git --redact --report-format json --report-path /tmp/gl.json` writes it as `Fingerprint`. Prefer `gitleaks:allow` on the line itself when the file is still in the tree.
3. **A real secret:** it must be rotated at its provider first; that is the hand-off. Once the person confirms it is rotated (it no longer works), list the fingerprint in `.gitleaksignore` with "rotated on <date>".
4. **Still in the tree:** move it out of the code now: read it from an environment variable, add the name to `.env.example` without a value, and make sure the file holding values (`.env`, `.env.local`) is in `.gitignore`.

## Hand off only when
A finding is a real credential: rotating it needs the provider's account (the key's dashboard, the database, the cloud console). Name the rule, the file and the commit, never the value, and say whether it is still in the current tree.

## Don't
- Don't print, log or commit a secret value, not even redacted by hand or in a test.
- Don't rewrite history (`git filter-repo`, BFG, force-pushes) in this change: it breaks every clone and open PR, and the leaked value is already out; rotation is the fix. A person decides whether a purge is also worth it.
- Don't add a `.gitleaks.toml` allowlist that hides whole rules or paths to get a pass: list each finding's fingerprint.
