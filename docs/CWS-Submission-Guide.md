# Chrome Web Store Submission — Ready-to-Paste Listing Text

Use this document when filling out the Chrome Web Store Developer Dashboard.
Copy each section into the corresponding field.

---

## Store name

```
NotebookLM Usage Tracker
```

If the name is rejected due to trademark concerns, use:

```
Internal Notebook Usage Tracker
```

---

## Category

```
Productivity
```

If Productivity is not available, use **Developer Tools** or **Workflow & Planning**.

Do NOT use: Media, Education, Entertainment, or AI.

---

## Short description (132 characters max)

```
Internal enterprise extension for tracking NotebookLM usage activity for reporting, audit, and operational analytics.
```

---

## Detailed description

```
NotebookLM Usage Tracker is an internal enterprise Chrome extension used to record NotebookLM usage activity for reporting, analytics, and audit purposes.

The extension captures limited operational metadata related to NotebookLM usage, including:

• Notebook name
• Notebook ID
• Session activity
• Turn number
• Question summary metadata
• Timestamps
• Logged-in Windows username (via a native messaging host)

Collected data is transmitted over HTTPS to the organization's configured internal tracking server for dashboarding, reporting, operational review, and compliance use cases.

Key points:

• This extension is intended only for authorized internal users within the deploying organization.
• It is not a consumer productivity add-on.
• It does not modify, enhance, or alter NotebookLM functionality for end users.
• It does not provide media playback, content creation, summarization, or any consumer-facing features.
• It is not affiliated with or endorsed by Google.
• No unrelated media, entertainment, or content-playback functionality is provided.

The extension includes:

• A background service worker that manages sessions and transmits usage logs.
• A content script that monitors conversation activity on notebooklm.google.com.
• An options page for configuring the server URL and a manual username fallback.
• Native messaging support to read the Windows system username without user interaction.

All data is sent to the deploying organization's own server. No data is sent to any third party.
```

---

## Single purpose description

Use this if the Chrome Web Store form asks "Describe the single purpose of the extension":

```
This extension has a single purpose: capture NotebookLM usage metadata (notebook name, notebook ID, session info, turn count, question summaries, timestamps, and Windows username) and send it to an internal reporting server for audit and operational analytics. It does not modify or enhance NotebookLM for end users.
```

---

## Justification for permissions

Use these when the form asks to justify each permission.

### storage

```
Used to persist the configured server URL and manual username fallback across browser sessions. Also used to store session state (session ID, system username) in session storage so the extension can maintain context during a browsing session.
```

### nativeMessaging

```
Used to communicate with a Windows native messaging host (com.astraglobal.nlm_tracker) that reads the logged-in Windows username. This allows the extension to automatically identify the agent without requiring manual input.
```

### tabs

```
Used to detect when a NotebookLM tab is opened or navigated so the extension can activate tracking for that session. The extension only monitors tabs matching https://notebooklm.google.com/*.
```

### scripting

```
Used to inject the content script into NotebookLM pages to observe conversation activity (turns, notebook name, question summaries). The content script only runs on https://notebooklm.google.com/*.
```

### Host permission: https://notebooklm.google.com/*

```
The extension monitors NotebookLM pages to capture usage metadata. This host permission restricts the extension to only operate on notebooklm.google.com and no other websites.
```

---

## Privacy policy URL

```
https://notebooklm-usage-tracker-production.up.railway.app/privacy-policy
```

---

## Support URL (if required)

```
https://github.com/TerrorBlade2002/notebooklm-usage-tracker
```

---

## Promotional text (if required)

```
Internal reporting extension for monitoring NotebookLM usage across enterprise agents.
```

---

## Reviewer notes

Paste this in the "Notes for the reviewer" box during submission:

```
This is an internal enterprise reporting extension deployed within our organization. Its only purpose is to capture NotebookLM usage metadata and send it to our internal server for reporting, audit, and operational analytics.

It does not provide any consumer-facing features, media playback, content creation, or NotebookLM enhancements.

The extension was previously rejected (Red Potassium) due to the listing category being set to "media" which did not match the observed functionality. We have corrected the category to Productivity and updated all listing metadata, description, and screenshots to accurately describe the extension's actual internal tracking and reporting functionality.

Permissions summary:
• storage — persist server URL and session state
• nativeMessaging — read Windows username via native host
• tabs — detect NotebookLM tab navigation
• scripting — inject content script on notebooklm.google.com only
• Host permission limited to https://notebooklm.google.com/*

No data is sent to any third party. All data is transmitted to the organization's own server endpoint.
```

---

## Screenshot guidance

Upload 3–5 screenshots showing the actual extension UI:

1. **Extension options page** — shows Server URL field, Manual Username fallback field
2. **Dashboard overview** — shows usage stats cards (Total Interactions, Unique Notebooks, Unique Users, Total Sessions)
3. **Dashboard table** — shows the reporting table with columns: Timestamp, Username, Notebook, Turn, Questions, Session
4. **Dashboard filters** — shows date range, notebook filter, username filter, CSV export button
5. **Chrome extensions page** (optional) — shows the extension installed with its icon and name

Do NOT upload:
- NotebookLM product screenshots
- Generic AI or media imagery
- Marketing graphics
- Anything unrelated to tracking/reporting

---

## Extension ID

After Chrome Web Store assigns the final published extension ID, update:

- `native-host/install-native-host.bat` — replace the `allowed_origins` extension ID
- `docs/IT-GPO-Deployment-Guide.md` — replace all references to the old extension ID

---

## Checklist before submitting

- [ ] Category is Productivity (not Media)
- [ ] Short description matches actual functionality
- [ ] Detailed description matches actual functionality
- [ ] Single purpose statement is filled in
- [ ] All permission justifications are filled in
- [ ] Privacy policy URL is live and accessible
- [ ] Screenshots show actual extension/dashboard UI only
- [ ] Reviewer notes explain the previous rejection and corrections
- [ ] No claims of affiliation with Google
- [ ] No misleading media/AI/enhancement language
