# NotebookLM Usage Tracker - IT Deployment Guide

This guide explains how to deploy the NotebookLM Usage Tracker across all agent machines.

It covers:

1. **Recommended deployment with GPO**
2. **What to do if GPO cannot be used**
3. **How to validate the deployment**
4. **Common issues and fixes**

---

**Please report to Arnab should you face any issues during deployment (ChatGPT+NotebookLM)
## 1. What is being deployed

There are **two separate items** to deploy:

### A. Chrome extension
- Purpose: captures NotebookLM usage and sends logs to the server
- Chrome Web Store: https://chromewebstore.google.com/detail/notebooklm-usage-tracker/iooadpogbmnffkpejjnadggakjakapfh
- Extension ID: `iooadpogbmnffkpejjnadggakjakapfh`
- Source folder in this repo: [extension](../extension)

### B. Native host installer BAT file
- Purpose: registers a Windows native messaging host so the extension can read the logged-in Windows username
- File to deploy/run: [native-host/install-native-host.bat](../native-host/install-native-host.bat)
- Native host name: `com.astraglobal.nlm_tracker`

### Important
The BAT file installs **per user**, not per machine.
It writes to:

- `%LOCALAPPDATA%\NLMTracker`
- `HKCU\SOFTWARE\Google\Chrome\NativeMessagingHosts\com.astraglobal.nlm_tracker`

Because it writes to `HKCU` and `%LOCALAPPDATA%`, it must run in the **user context**.

---

## 2. Before starting

IT should confirm the following first:

### Required prerequisites
1. Google Chrome is installed on all agent machines.
2. Agents can access NotebookLM:
   - `https://notebooklm.google.com`
3. Agents can reach the tracker server URL:
   - default currently baked into the extension: `https://notebooklm-usage-tracker-production.up.railway.app`
4. Windows Script Host / `cscript.exe` is not blocked, because the BAT file uses a temporary VBS file.
5. Users have permission to run standard logon scripts.

### Important limitation for GPO extension install
A Chrome extension **cannot be force-installed by GPO from an unpacked folder**.

That means the current [extension](../extension) folder is fine for manual testing, but for true domain-wide Chrome deployment, IT must use one of these:

1. **Publish the extension in the Chrome Web Store** and force-install it by ID, or
2. **Package it as a CRX and host it internally** with an update URL / update manifest

If IT does not do one of those, the BAT file can still be deployed by GPO, but the extension itself will need a manual install.

---

## 3. Recommended deployment model

Best practice is:

### Use GPO for the BAT file
- This is fully supported with the current repo state.
- Run [native-host/install-native-host.bat](../native-host/install-native-host.bat) as a **User Logon Script**.

### Use Chrome enterprise policy for the extension
- This requires the extension to be distributed as either:
  - Chrome Web Store extension, or
  - internally hosted CRX package

This gives the cleanest rollout.

---

## 4. GPO deployment - step by step

# 4.1 Prepare deployment files

## Step 1 - Put the BAT file on a shared path
Copy [native-host/install-native-host.bat](../native-host/install-native-host.bat) to a domain-accessible path.

Recommended location:
- `\\<domain>\SYSVOL\<domain>\scripts\NotebookLMTracker\install-native-host.bat`

Do **not** rename the file unless IT also updates internal documentation.

## Step 2 - Decide how the extension will be distributed
IT must choose **one** of the following:

### Option A - Chrome Web Store distribution
Recommended if the organization is comfortable publishing the extension.

Use the extension ID:
- `iooadpogbmnffkpejjnadggakjakapfh`

Chrome Web Store URL:
- `https://chromewebstore.google.com/detail/notebooklm-usage-tracker/iooadpogbmnffkpejjnadggakjakapfh`

Chrome Web Store update URL (for GPO policy):
- `https://clients2.google.com/service/update2/crx`

### Option B - Internal CRX hosting
Recommended if the extension must remain private.

IT will need to:
1. Package the extension as a `.crx`
2. Host the `.crx` and update manifest on an internal web server
3. Use that internal update URL in Chrome enterprise policy

### Option C - Manual extension install
Use this only if GPO cannot manage the extension.
Details are in section 7 below.

---

# 4.2 Create the BAT deployment GPO

## Step 3 - Create a new GPO
In Group Policy Management:

1. Open **Group Policy Management**
2. Create a new GPO
3. Suggested name:
   - `NotebookLM Tracker - Native Host Install`
4. Link it to the OU containing the agent user accounts

## Step 4 - Add the BAT as a User Logon Script
Edit the GPO and go to:

- `User Configuration`
- `Policies`
- `Windows Settings`
- `Scripts (Logon/Logoff)`
- `Logon`

Add the script:
- Script Name: path to `install-native-host.bat`

Recommended script source:
- `\\<domain>\SYSVOL\<domain>\scripts\NotebookLMTracker\install-native-host.bat`

### Why user logon script is required
This BAT writes to:
- `HKCU`
- `%LOCALAPPDATA%`

So it must run once for **each user profile**.

## Step 5 - Security filter or pilot first
Before deploying to all agents:
1. Apply the GPO to a test OU or pilot security group
2. Validate on 2-5 machines
3. Expand rollout after validation

---

# 4.3 Create the Chrome extension deployment GPO

## Step 6 - Import Chrome administrative templates if not already present
If Chrome policies are not visible in Group Policy Editor, IT must install/import Google Chrome ADMX/ADML templates first.

After that, Chrome policies will appear under Administrative Templates.

## Step 7 - Create a Chrome extension GPO
Suggested name:
- `NotebookLM Tracker - Chrome Extension`

This can be applied at either:
- `Computer Configuration`, or
- `User Configuration`

If all agents on a machine should get the extension, machine-level policy is usually easier.

## Step 8 - Configure forced extension install
In the Chrome policy area, configure the forced-install list.

Typical policy area:
- `Administrative Templates`
- `Google`
- `Google Chrome`
- `Extensions`

Use the extension ID:
- `iooadpogbmnffkpejjnadggakjakapfh`

### If using Chrome Web Store (recommended)
Use:
- `iooadpogbmnffkpejjnadggakjakapfh;https://clients2.google.com/service/update2/crx`

### If using internal CRX hosting
Use:
- `iooadpogbmnffkpejjnadggakjakapfh;<your-internal-update-url>`

Example:
- `iooadpogbmnffkpejjnadggakjakapfh;https://intranet.company.local/notebooklm/update.xml`

### Important
Do **not** try to point Chrome GPO to the unpacked [extension](../extension) folder.
That does not work for enterprise force-install.

---

## 5. Rollout sequence IT should follow

Recommended sequence:

### Phase 1 - Pilot
1. Deploy the BAT GPO to a small test group
2. Deploy the Chrome extension policy to the same group
3. Have users sign out and sign back in
4. Open Chrome and verify policy refresh
5. Confirm NotebookLM usage logs appear on the server/dashboard

### Phase 2 - Production rollout
1. Expand both GPOs to the full agent OU
2. Ask users to sign out/sign in or reboot if required
3. Verify on a random sample of machines
4. Monitor the dashboard and server logs for activity

---

## 6. How to verify deployment on a client machine

IT can validate with the following checklist.

### A. Verify BAT deployment
Check that these exist for the logged-in user:

#### File 1
- `%LOCALAPPDATA%\NLMTracker\get_username.bat`

#### File 2
- `%LOCALAPPDATA%\NLMTracker\com.astraglobal.nlm_tracker.json`

#### Registry key
- `HKCU\SOFTWARE\Google\Chrome\NativeMessagingHosts\com.astraglobal.nlm_tracker`

The registry default value should point to:
- `%LOCALAPPDATA%\NLMTracker\com.astraglobal.nlm_tracker.json`

### B. Verify Chrome policy applied
Open Chrome and check:
- `chrome://policy`

Then click **Reload policies**.

IT should see the extension install policy present.

### C. Verify extension installed
Open:
- `chrome://extensions`

Confirm the NotebookLM Usage Tracker extension is installed.

Expected extension ID:
- `iooadpogbmnffkpejjnadggakjakapfh`

### D. Verify extension can talk to native host
Open the extension details or options page and confirm the extension is active.

The extension should resolve the current Windows username through the native host.

### E. Verify data is reaching the server
Open:
- `/health` on the server
- `/dashboard` on the server

If the environment uses the default hosted server, current endpoints are:
- `https://notebooklm-usage-tracker-production.up.railway.app/health`
- `https://notebooklm-usage-tracker-production.up.railway.app/dashboard`

---

## 7. Manual deployment if GPO cannot be used

If GPO is not available, IT can still install this on every system manually.

There are two parts to the manual process.

# 7.1 Manual install of the BAT file

Do this on each machine while logged in as the target user.

## Steps
1. Copy [native-host/install-native-host.bat](../native-host/install-native-host.bat) to the local machine
2. Right-click it and run normally as the user
3. Wait for the success message
4. Verify:
   - `%LOCALAPPDATA%\NLMTracker\get_username.bat`
   - `%LOCALAPPDATA%\NLMTracker\com.astraglobal.nlm_tracker.json`
   - `HKCU\SOFTWARE\Google\Chrome\NativeMessagingHosts\com.astraglobal.nlm_tracker`

### Important
If multiple users share the same PC, the BAT must be run once under **each Windows user account**.

---

# 7.2 Manual install of the Chrome extension

## Manual Option A - Load unpacked extension
Use this if IT is okay with developer mode on each machine.

### Steps
1. Copy the [extension](../extension) folder to the local machine
2. Open Chrome
3. Go to `chrome://extensions`
4. Turn on **Developer mode**
5. Click **Load unpacked**
6. Select the copied [extension](../extension) folder
7. Confirm the installed extension ID is:
   - `iooadpogbmnffkpejjnadggakjakapfh`

### Notes
- This is simple for testing
- It is usually **not** ideal for large enterprise deployment
- Chrome may restrict this in tightly managed environments

## Manual Option B - Package and install CRX
If IT has packaging processes already, this is better than unpacked installs.

The key point is that the extension must keep the same ID:
- `iooadpogbmnffkpejjnadggakjakapfh`

That stable ID is assigned by Chrome Web Store and will remain fixed for all updates.

---

## 8. Extension configuration after install

The extension currently has this default server URL baked into the code:
- `https://notebooklm-usage-tracker-production.up.railway.app`

If IT will use a different server URL, that must be updated per Chrome profile unless the extension is later enhanced for managed configuration.

Current options page allows setting:
- Server URL
- Manual Username fallback

If the default Railway URL remains in use, no extra config is required for most users.

---

## 9. Troubleshooting

### Problem: BAT runs but username still does not appear
Check:
1. The BAT ran under the actual user account
2. The registry key exists under `HKCU`, not `HKLM`
3. The JSON file exists in `%LOCALAPPDATA%\NLMTracker`
4. The extension ID in Chrome is exactly `iooadpogbmnffkpejjnadggakjakapfh`
5. Chrome was restarted after install

### Problem: Extension ID is different
Cause:
- The wrong build was loaded, or
- The extension was repacked without keeping the manifest key

Fix:
- Use the repo version with the current [extension/manifest.json](../extension/manifest.json)
- Install the extension from Chrome Web Store: https://chromewebstore.google.com/detail/notebooklm-usage-tracker/iooadpogbmnffkpejjnadggakjakapfh
- Confirm the installed extension ID is `iooadpogbmnffkpejjnadggakjakapfh`

### Problem: GPO installs BAT but not extension
Cause:
- Chrome cannot force-install from an unpacked folder

Fix:
- Use Chrome Web Store distribution, or
- Package and host a CRX internally

### Problem: Extension installs but no logs reach the server
Check:
1. The server is reachable
2. The correct server URL is configured
3. Agents can access NotebookLM normally
4. Browser or endpoint security tools are not blocking the extension

### Problem: Manual username is being used instead of Windows username
Cause:
- Native messaging host is unavailable

Fix:
1. Re-run [native-host/install-native-host.bat](../native-host/install-native-host.bat)
2. Restart Chrome
3. Recheck the registry and JSON file

---

## 10. Recommended IT handoff summary

For IT, the simplest deployment plan is:

1. **Package or publish the extension** so Chrome can force-install it
2. **Deploy [native-host/install-native-host.bat](../native-host/install-native-host.bat) as a User Logon Script via GPO**
3. **Pilot on a small group first**
4. **Validate on client machines using chrome://policy, chrome://extensions, local files, and HKCU registry**
5. **Roll out to all agent OUs**

---

## 11. Quick reference

### Extension ID
- `iooadpogbmnffkpejjnadggakjakapfh`

### Chrome Web Store
- https://chromewebstore.google.com/detail/notebooklm-usage-tracker/iooadpogbmnffkpejjnadggakjakapfh

### Native host name
- `com.astraglobal.nlm_tracker`

### User install folder
- `%LOCALAPPDATA%\NLMTracker`

### Registry path
- `HKCU\SOFTWARE\Google\Chrome\NativeMessagingHosts\com.astraglobal.nlm_tracker`

### Primary files
- [extension/manifest.json](../extension/manifest.json)
- [native-host/install-native-host.bat](../native-host/install-native-host.bat)
- [native-host/get_username.bat](../native-host/get_username.bat)

---

Please use this guide as the deployment runbook
