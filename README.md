# notebooklm-usage-tracker

Chrome Extension + Server for tracking NotebookLM usage, capturing system usernames, notebook identity, and conversation turns.

## IT deployment guide

For domain-wide rollout instructions for Chrome extension deployment and the native host BAT logon script, see [docs/IT-GPO-Deployment-Guide.md](docs/IT-GPO-Deployment-Guide.md).

## After Railway Is Live: Required Setup

### 1) Confirm server endpoint

Open this URL and verify it returns healthy JSON:

- `https://<your-railway-domain>/health`

Expected: `{ "status": "ok" ... }`

### 2) Install the Chrome extension

Install from Chrome Web Store:

- https://chromewebstore.google.com/detail/notebooklm-usage-tracker/iooadpogbmnffkpejjnadggakjakapfh

Extension ID: `iooadpogbmnffkpejjnadggakjakapfh`

For enterprise GPO deployment, see [docs/IT-GPO-Deployment-Guide.md](docs/IT-GPO-Deployment-Guide.md).

### 3) Enable system username capture (Windows native messaging)

Run `native-host\install-native-host.bat` as the logged-in user (no admin required).

This registers native host `com.astraglobal.nlm_tracker` in:

- `HKCU\Software\Google\Chrome\NativeMessagingHosts\com.astraglobal.nlm_tracker`

For enterprise GPO deployment, deploy this BAT as a **User Logon Script**.

If native host is unavailable, extension uses `Manual Username` from options as fallback.

### 4) Verify extension is ready

In extension options page, verify these fields populate:

- `System Username`
- `Session ID`
- `Retry Queue`

### 5) Verify NotebookLM logs are being received

Use dashboard and APIs:

- Dashboard: `https://<your-railway-domain>/dashboard`
- Reports JSON: `https://<your-railway-domain>/api/reports`
- Stats: `https://<your-railway-domain>/api/stats`

You should see for each turn:

- `system_username`
- `notebook_name`
- `notebook_id`
- `turn_number`
- `first_question_summary`
- `current_question_summary`

## Notes

- Extension now tracks **all** NotebookLM notebooks (not only a fixed allowlist).
- Port can be set through environment variable `PORT` (for example `3001`).
