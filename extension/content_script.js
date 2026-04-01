(function () {
  "use strict";

  // ---- DUPLICATE INSTANCE GUARD ----
  if (window.__nlmTrackerLoaded) {
    try {
      chrome.runtime.getURL("");
      console.log("[NLM-Tracker] Already loaded with live context, skipping.");
      return;
    } catch (e) {
      console.log("[NLM-Tracker] Previous instance dead, reinitializing...");
    }
  }
  window.__nlmTrackerLoaded = true;

  // ---- TRACKING SCOPE ----
  // Set to null to track all notebooks.
  // If you want to restrict tracking later, replace with a Set of exact notebook names.
  const ALLOWED_NOTEBOOKS = null;

  // ---- STATE ----
  let currentNotebookName = null;
  let currentNotebookId = null;
  let lastLoggedExchangeCount = 0;
  let firstUserQuestion = null;
  let bgReady = false;
  let pendingQueue = [];
  let loggedIdempotencyKeys = new Set();

  function log(...a) { console.log("[NLM-Tracker]", ...a); }

  let pollingIntervalId = null;
  let keepaliveIntervalId = null;
  let mutationObserver = null;

  function isContextAlive() {
    try { chrome.runtime.getURL(""); return true; } catch (e) { return false; }
  }

  function selfTerminate() {
    log("Context invalidated - self-terminating all loops.");
    if (pollingIntervalId) clearInterval(pollingIntervalId);
    if (keepaliveIntervalId) clearInterval(keepaliveIntervalId);
    if (mutationObserver) mutationObserver.disconnect();
    window.__nlmTrackerLoaded = false;
  }

  function isNotebookPage() {
    return /\/notebook\/[a-f0-9-]+/.test(window.location.pathname);
  }

  function getNotebookId() {
    const m = window.location.pathname.match(/\/notebook\/([a-f0-9-]+)/);
    return m ? m[1] : null;
  }

  function extractNotebookName() {
    const titleMatch = document.title.match(/^(.+?)\s*-\s*NotebookLM$/);
    if (titleMatch) return titleMatch[1].trim();
    const headerSpan = document.querySelector(".title.mat-title-large span");
    if (headerSpan) return headerSpan.textContent.trim();
    const notebookTitle = document.querySelector(".notebook-title");
    if (notebookTitle) return notebookTitle.textContent.trim();
    return null;
  }

  function countExchanges() {
    return document.querySelectorAll(".chat-message-pair").length;
  }

  function getFirstUserQuestion() {
    const card = document.querySelector("mat-card.from-user-message-card-content");
    if (!card) return null;
    const heading = card.querySelector('div[role="heading"]');
    const txt = (heading || card).textContent.trim();
    const words = txt.split(/\s+/);
    return words.length <= 20 ? words.join(" ") : words.slice(0, 20).join(" ") + "...";
  }

  function getCurrentQuestion() {
    const cards = document.querySelectorAll("mat-card.from-user-message-card-content");
    if (cards.length === 0) return null;
    const last = cards[cards.length - 1];
    const heading = last.querySelector('div[role="heading"]');
    const txt = (heading || last).textContent.trim();
    const words = txt.split(/\s+/);
    return words.length <= 20 ? words.join(" ") : words.slice(0, 20).join(" ") + "...";
  }

  function isResponseStreaming() {
    const pairs = document.querySelectorAll(".chat-message-pair");
    if (pairs.length === 0) return false;
    const lastPair = pairs[pairs.length - 1];
    const modelCard = lastPair.querySelector("mat-card.to-user-message-card-content");
    if (!modelCard) return true;
    const copyBtn = lastPair.querySelector('button[aria-label*="Copy model response"]');
    if (!copyBtn) return true;
    return false;
  }

  async function generateIdempotencyKey(notebookId, turnNumber, questionSnippet) {
    const raw = notebookId + "|" + turnNumber + "|" + (questionSnippet || "").substring(0, 50);
    const data = new TextEncoder().encode(raw);
    const buf = await crypto.subtle.digest("SHA-256", data);
    return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  function sendToBg(type, data, retries) {
    retries = retries || 0;
    return new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage({ type, ...data }, (response) => {
          if (chrome.runtime.lastError) {
            const err = chrome.runtime.lastError.message;
            log("BG send error:", err);
            if (retries < 3 && (err.includes("invalidated") || err.includes("disconnected") || err.includes("Receiving end does not exist"))) {
              setTimeout(() => { sendToBg(type, data, retries + 1).then(resolve); }, 1000);
            } else { resolve(null); }
          } else { resolve(response); }
        });
      } catch (e) {
        log("BG send exception:", e.message);
        if (retries < 3) { setTimeout(() => { sendToBg(type, data, retries + 1).then(resolve); }, 1500); }
        else { pendingQueue.push({ type, data }); resolve(null); }
      }
    });
  }

  keepaliveIntervalId = setInterval(() => {
    if (!isContextAlive()) { selfTerminate(); return; }
    try {
      chrome.runtime.sendMessage({ type: "PING" }, (response) => {
        if (chrome.runtime.lastError) return;
        if (pendingQueue.length > 0) {
          const queue = pendingQueue.splice(0);
          queue.forEach((item) => sendToBg(item.type, item.data));
        }
      });
    } catch (e) {}
  }, 20000);

  async function checkForNewExchanges() {
    if (!isNotebookPage()) return;
    const name = extractNotebookName();
    if (!name) return;
    if (ALLOWED_NOTEBOOKS && !ALLOWED_NOTEBOOKS.has(name)) return;
    const nbId = getNotebookId();
    if (!nbId) return;

    if (currentNotebookId && currentNotebookId !== nbId) {
      log("Notebook changed:", currentNotebookId, "->", nbId);
      lastLoggedExchangeCount = 0; firstUserQuestion = null; loggedIdempotencyKeys.clear();
    }
    currentNotebookName = name;
    currentNotebookId = nbId;

    const exchangeCount = countExchanges();
    if (exchangeCount === 0 || exchangeCount <= lastLoggedExchangeCount) return;
    if (isResponseStreaming()) { log("Response still streaming..."); return; }

    if (!firstUserQuestion) { firstUserQuestion = getFirstUserQuestion(); }
    const currentQuestion = getCurrentQuestion();
    const idempotencyKey = await generateIdempotencyKey(nbId, exchangeCount, currentQuestion);
    if (loggedIdempotencyKeys.has(idempotencyKey)) { lastLoggedExchangeCount = exchangeCount; return; }

    const payload = {
      notebook_name: name, notebook_id: nbId, turn_number: exchangeCount,
      first_question_summary: firstUserQuestion || "",
      current_question_summary: currentQuestion || "",
      idempotency_key: idempotencyKey, timestamp: new Date().toISOString(),
    };

    log("Logging exchange #" + exchangeCount + ":", JSON.stringify(payload));
    sendToBg("LOG_EXCHANGE", payload).then((resp) => {
      if (resp && resp.success) {
        log("BG acknowledged turn #" + exchangeCount);
        lastLoggedExchangeCount = exchangeCount;
        loggedIdempotencyKeys.add(idempotencyKey);
      } else { log("BG did not confirm - will retry next cycle"); }
    });
  }

  function setupMutationObserver() {
    const chatPanel = document.querySelector(".chat-panel-content");
    if (!chatPanel) { setTimeout(setupMutationObserver, 2000); return; }
    if (mutationObserver) mutationObserver.disconnect();
    mutationObserver = new MutationObserver((mutations) => {
      for (const mut of mutations) {
        if (mut.type === "childList" && mut.addedNodes.length > 0) {
          for (const node of mut.addedNodes) {
            if (node.nodeType === 1 && (node.classList?.contains("chat-message-pair") || node.querySelector?.(".chat-message-pair"))) {
              log("New chat-message-pair detected via MutationObserver");
              setTimeout(checkForNewExchanges, 2000);
              setTimeout(checkForNewExchanges, 5000);
              return;
            }
          }
        }
      }
    });
    mutationObserver.observe(chatPanel, { childList: true, subtree: true });
    log("MutationObserver attached to chat-panel-content");
  }

  async function initBackground() {
    const resp = await sendToBg("INIT", { url: window.location.href });
    if (resp) { bgReady = true; log("Background ready:", JSON.stringify(resp)); }
  }

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === "BG_READY") { bgReady = true; checkForNewExchanges(); }
  });

  function startPolling() {
    let lastUrl = window.location.href;
    pollingIntervalId = setInterval(() => {
      if (!isContextAlive()) { selfTerminate(); return; }
      const curUrl = window.location.href;
      if (curUrl !== lastUrl) {
        lastUrl = curUrl;
        if (!isNotebookPage()) {
          currentNotebookName = null; currentNotebookId = null;
          lastLoggedExchangeCount = 0; firstUserQuestion = null;
          loggedIdempotencyKeys.clear(); return;
        }
        if (mutationObserver) mutationObserver.disconnect();
        setTimeout(setupMutationObserver, 1000);
      }
      checkForNewExchanges();
    }, 3000);
  }

  log("Content script loaded:", window.location.href);
  initBackground();
  let retryCount = 0;
  const retryInterval = setInterval(() => {
    if (bgReady || retryCount >= 5) { clearInterval(retryInterval); return; }
    retryCount++; initBackground();
  }, 2000);

  startPolling();
  setTimeout(setupMutationObserver, 1000);
  setTimeout(checkForNewExchanges, 2000);
  setTimeout(checkForNewExchanges, 5000);
  setTimeout(checkForNewExchanges, 10000);

  const titleEl = document.querySelector("title");
  if (titleEl) {
    new MutationObserver(() => {
      setTimeout(checkForNewExchanges, 1000);
      if (mutationObserver) mutationObserver.disconnect();
      setTimeout(setupMutationObserver, 1500);
    }).observe(titleEl, { childList: true });
  }
})();
