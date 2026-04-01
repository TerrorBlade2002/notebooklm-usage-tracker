# notebooklm-usage-tracker

Chrome Extension + Server for tracking NotebookLM usage, capturing system usernames, notebook identity, and conversation turns.

## After Railway Is Live: Required Setup

### 1) Confirm server endpoint

Open this URL and verify it returns healthy JSON:

- `https://<your-railway-domain>/health`

Expected: `{ "status": "ok" ... }`

### 2) Load the Chrome extension

1. Open Chrome: `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select folder: `extension`
5. Open extension options page and set:
	- `Server URL` = your Railway URL (without trailing slash)

### 3) Enable system username capture (Windows native messaging)

1. Copy the extension id from `chrome://extensions` (value under this extension).
2. Run PowerShell:

	`powershell -ExecutionPolicy Bypass -File .\native-host\install-native-host.ps1 -ExtensionId <YOUR_EXTENSION_ID>`

This registers native host `com.astraglobal.nlm_tracker` in:

- `HKCU\Software\Google\Chrome\NativeMessagingHosts\com.astraglobal.nlm_tracker`

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
