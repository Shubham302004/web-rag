const BASE_URL = "http://localhost:8000";
const STATUS_URL = `${BASE_URL}/status`;
const API_URL = `${BASE_URL}/chat`;
const INGEST_URL = `${BASE_URL}/ingest`;
const SOURCES_URL = `${BASE_URL}/sources`;

// DOM Elements
const chatDiv = document.getElementById("chat");
const input = document.getElementById("messageInput");
const sendBtn = document.getElementById("sendBtn");
const modelSelect = document.getElementById("modelSelect");

const modelDropdownWrapper = document.getElementById("modelDropdownWrapper");
const modelDropdownTrigger = document.getElementById("modelDropdownTrigger");
const modelDropdownMenu = document.getElementById("modelDropdownMenu");
const selectedModelLabel = document.getElementById("selectedModelLabel");

const sourceToggle = document.getElementById("sourceToggle");
const sourcePanel = document.getElementById("sourcePanel");
const sourceUrl = document.getElementById("sourceUrl");
const ingestBtn = document.getElementById("ingestBtn");
const ingestStatus = document.getElementById("ingestStatus");

const sidebar = document.getElementById("sidebar");
const collapseSidebarBtn = document.getElementById("collapseSidebarBtn");
const sidebarToggleBtn = document.getElementById("sidebarToggleBtn");
const quickIngestTrigger = document.getElementById("quickIngestTrigger");
const newChatBtn = document.getElementById("newChatBtn");
const clearChatBtn = document.getElementById("clearChatBtn");

const sourcesList = document.getElementById("sourcesList");
const sourceCountEl = document.getElementById("sourceCount");
const headerSourceCountEl = document.getElementById("headerSourceCount");
const groundingTextEl = document.getElementById("groundingText");

const connectionStatusEl = document.getElementById("connectionStatus");
const statusTextEl = document.getElementById("statusText");
const embeddingModelNameEl = document.getElementById("embeddingModelName");
const sessionsListEl = document.getElementById("sessionsList");

// Local Session & Source Management State
let activeSources = [];
let selectedSourceId = null;
let currentSessionId = null;
let chatSessions = {}; // { [sessionId]: { id, title, sourceId, collectionName, messages: [{text, sender, isError}] } }

function getDomainName(url) {
  if (!url) return "Source";
  try {
    const parsed = new URL(url);
    return parsed.hostname + (parsed.pathname !== "/" && parsed.pathname !== "" ? parsed.pathname : "");
  } catch (e) {
    return url;
  }
}

// Load Sessions from localStorage
function loadStoredSessions() {
  try {
    const data = localStorage.getItem("rag_chat_sessions");
    if (data) {
      chatSessions = JSON.parse(data);
    }
  } catch (e) {
    chatSessions = {};
  }
}

function saveStoredSessions() {
  try {
    localStorage.setItem("rag_chat_sessions", JSON.stringify(chatSessions));
  } catch (e) {}
}

// Render Sessions in Sidebar
function renderSessions() {
  if (!sessionsListEl) return;
  sessionsListEl.innerHTML = "";

  const sessionIds = Object.keys(chatSessions);
  if (sessionIds.length === 0) {
    const activeItem = document.createElement("div");
    activeItem.className = "session-item active";
    activeItem.innerHTML = `
      <div class="session-item-content">
        <svg class="session-icon" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
        </svg>
        <span>New Conversation</span>
      </div>
    `;
    sessionsListEl.appendChild(activeItem);
    return;
  }

  sessionIds.forEach((id) => {
    const s = chatSessions[id];
    const item = document.createElement("div");
    item.className = `session-item ${id === currentSessionId ? "active" : ""}`;
    item.innerHTML = `
      <div class="session-item-content">
        <svg class="session-icon" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
        </svg>
        <span>${escapeHtml(s.title || "Conversation")}</span>
      </div>
      <button class="session-delete-btn" title="Delete conversation">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="3 6 5 6 21 6"></polyline>
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
        </svg>
      </button>
    `;

    item.querySelector(".session-item-content").addEventListener("click", () => {
      switchSession(id);
    });

    item.querySelector(".session-delete-btn").addEventListener("click", (e) => {
      e.stopPropagation();
      deleteSession(id);
    });

    sessionsListEl.appendChild(item);
  });
}

function switchSession(id) {
  currentSessionId = id;
  const s = chatSessions[id];
  chatDiv.innerHTML = "";

  if (s && s.sourceId) {
    selectedSourceId = s.sourceId;
    renderSources(activeSources);
  }

  if (!s || !s.messages || s.messages.length === 0) {
    chatDiv.innerHTML = getEmptyStateTemplate();
    bindCardIngestForm();
  } else {
    s.messages.forEach((msg) => {
      renderMessageElement(msg.text, msg.sender, msg.isError);
    });
  }

  updateGroundingIndicator();
  renderSessions();
  input.focus();
}

function deleteSession(id) {
  delete chatSessions[id];
  saveStoredSessions();

  if (currentSessionId === id) {
    const remaining = Object.keys(chatSessions);
    if (remaining.length > 0) {
      switchSession(remaining[0]);
    } else {
      createNewChat();
    }
  } else {
    renderSessions();
  }
}

function createNewChat() {
  const currentSrc = activeSources.find(s => s.id === selectedSourceId);
  const displayName = currentSrc ? getDomainName(currentSrc.url) : "New Conversation";

  currentSessionId = "sess_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7);
  chatSessions[currentSessionId] = {
    id: currentSessionId,
    title: currentSrc ? `${displayName} Chat` : "New Conversation",
    sourceId: selectedSourceId,
    collectionName: currentSrc?.collection_name,
    messages: []
  };
  saveStoredSessions();

  chatDiv.innerHTML = getEmptyStateTemplate();
  bindCardIngestForm();
  renderSessions();
  updateGroundingIndicator();

  input.value = "";
  autoGrow();
  input.focus();
}



function clearCurrentChat() {
  if (currentSessionId && chatSessions[currentSessionId]) {
    chatSessions[currentSessionId].messages = [];
    saveStoredSessions();
  }

  chatDiv.innerHTML = getEmptyStateTemplate();
  bindCardIngestForm();
  renderSessions();
  input.value = "";
  autoGrow();
  input.focus();
}

if (clearChatBtn) {
  clearChatBtn.addEventListener("click", clearCurrentChat);
}

function selectSource(sourceId, forceNew = false) {
  selectedSourceId = sourceId;
  const src = activeSources.find(s => s.id === sourceId);
  const displayName = src ? getDomainName(src.url) : "Knowledge Base";

  updateGroundingIndicator();

  // Find if there is an existing session for this source
  const existingSessId = Object.keys(chatSessions).find(id => chatSessions[id].sourceId === sourceId);

  if (existingSessId && !forceNew) {
    switchSession(existingSessId);
  } else {
    const newId = "sess_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7);
    chatSessions[newId] = {
      id: newId,
      title: `${displayName} Chat`,
      sourceId: sourceId,
      collectionName: src?.collection_name,
      messages: []
    };
    saveStoredSessions();
    switchSession(newId);
  }

  renderSources(activeSources);
}

function updateGroundingIndicator() {
  if (!groundingTextEl) return;
  const count = activeSources.length;
  if (count === 0) {
    groundingTextEl.textContent = "No sources indexed yet";
    return;
  }
  const currentSrc = activeSources.find(s => s.id === selectedSourceId);
  if (currentSrc) {
    const name = getDomainName(currentSrc.url);
    groundingTextEl.textContent = `Grounded in: ${name}`;
  } else {
    groundingTextEl.textContent = `Grounded in ${count} active sources`;
  }
}

const geminiApiKeyInput = document.getElementById("geminiApiKeyInput");
const toggleApiKeyVisibility = document.getElementById("toggleApiKeyVisibility");
const apiKeyStatus = document.getElementById("apiKeyStatus");
const maxDepthSelect = document.getElementById("maxDepthSelect");

// Gemini API key validator (non-empty, min 10 chars)
function isValidGeminiKey(key) {
  return key && key.trim().length >= 10;
}

function updateApiKeyStatus(val) {
  if (!apiKeyStatus) return;
  if (!val || val.trim().length === 0) {
    apiKeyStatus.textContent = "\u26a0 Paste your Gemini API key to start";
    apiKeyStatus.className = "api-key-status warn";
  } else if (!isValidGeminiKey(val)) {
    apiKeyStatus.textContent = "\u26a0 Key too short";
    apiKeyStatus.className = "api-key-status warn";
  } else {
    apiKeyStatus.textContent = "\u2713 API key set";
    apiKeyStatus.className = "api-key-status custom";
  }
}

// Gemini API Key Management
function initApiKeyInput() {
  if (!geminiApiKeyInput) return;
  const stored = localStorage.getItem("rag_gemini_api_key");
  if (stored) {
    geminiApiKeyInput.value = stored;
  }
  updateApiKeyStatus(stored || "");

  geminiApiKeyInput.addEventListener("input", () => {
    const val = geminiApiKeyInput.value.trim();
    updateApiKeyStatus(val);
    if (isValidGeminiKey(val)) {
      localStorage.setItem("rag_gemini_api_key", val);
    } else {
      localStorage.removeItem("rag_gemini_api_key");
    }
  });

  if (toggleApiKeyVisibility) {
    toggleApiKeyVisibility.addEventListener("click", () => {
      const isPass = geminiApiKeyInput.type === "password";
      geminiApiKeyInput.type = isPass ? "text" : "password";
    });
  }
}

initApiKeyInput();

// Dynamic Active Sources Renderer (Matching Reference Image Layout)
function renderSources(sources) {
  activeSources = sources || [];
  const count = activeSources.length;

  if (sourceCountEl) sourceCountEl.textContent = count;
  if (headerSourceCountEl) headerSourceCountEl.textContent = count;

  if (!selectedSourceId && count > 0) {
    selectedSourceId = activeSources[0].id;
  }

  updateGroundingIndicator();

  if (!sourcesList) return;
  sourcesList.innerHTML = "";

  if (count === 0) {
    const emptyHint = document.createElement("div");
    emptyHint.className = "sources-empty-hint";
    emptyHint.textContent = "No active sources yet";
    sourcesList.appendChild(emptyHint);
    return;
  }

  activeSources.forEach((src) => {
    const url = src.url || src;
    const srcId = src.id || "";
    const displayName = getDomainName(url);
    const isSelected = srcId === selectedSourceId;

    const wrapper = document.createElement("div");
    wrapper.className = "source-card-wrapper";

    wrapper.innerHTML = `
      <div class="source-card-header">
        <div class="source-card-header-left" title="${escapeHtml(url)}">
          <svg fill="none" height="13" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" width="13">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="2" x2="22" y1="12" y2="12"></line>
            <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
          </svg>
          <span class="source-card-url">${escapeHtml(displayName)}</span>
        </div>
        <div class="source-actions">
          ${srcId ? `
            <button class="source-action-btn delete-source-btn" title="Remove source">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          ` : ''}
        </div>
      </div>
      <div class="source-sub-chat ${isSelected ? "active" : ""}">
        <div class="source-sub-chat-content">
          <svg fill="none" height="12" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" width="12">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
          </svg>
          <span>Chat with ${escapeHtml(displayName)}...</span>
        </div>
        <span class="source-badge-scope">${isSelected ? "Active" : "Scope"}</span>
      </div>
    `;

    // Click sub-chat or header to activate source
    wrapper.querySelector(".source-sub-chat").addEventListener("click", () => {
      selectSource(srcId);
    });

    wrapper.querySelector(".source-card-header-left").addEventListener("click", () => {
      selectSource(srcId);
    });

    if (srcId) {
      const delBtn = wrapper.querySelector(".delete-source-btn");
      if (delBtn) {
        delBtn.addEventListener("click", async (e) => {
          e.stopPropagation();
          await deleteSource(srcId);
        });
      }
    }

    sourcesList.appendChild(wrapper);
  });
}

async function deleteSource(sourceId) {
  try {
    const response = await fetch(`${SOURCES_URL}/${sourceId}`, { method: "DELETE" });
    if (response.ok) {
      const data = await response.json();
      if (selectedSourceId === sourceId) {
        selectedSourceId = data.sources.length > 0 ? data.sources[0].id : null;
      }
      renderSources(data.sources);
    }
  } catch (e) {}
}

// Backend Health & Vector Store Connection Check
let isBackendConnected = false;

async function checkBackendStatus() {
  try {
    const res = await fetch(STATUS_URL, { method: "GET" });
    if (!res.ok) throw new Error("HTTP error " + res.status);

    const data = await res.json();
    isBackendConnected = true;

    if (connectionStatusEl) {
      connectionStatusEl.className = "status connected";
    }
    if (statusTextEl) {
      statusTextEl.textContent = "Vector Store Connected";
    }

    if (embeddingModelNameEl && data.embedding_model) {
      embeddingModelNameEl.textContent = `Embeddings: ${data.embedding_model}`;
    }

    if (data.sources) {
      renderSources(data.sources);
    }
  } catch (e) {
    isBackendConnected = false;
    if (connectionStatusEl) {
      connectionStatusEl.className = "status disconnected";
    }
    if (statusTextEl) {
      statusTextEl.textContent = "Backend Offline";
    }
    if (embeddingModelNameEl) {
      embeddingModelNameEl.textContent = "Embeddings: Offline";
    }
  }
}

// Start checking backend health and poll every 6s
checkBackendStatus();
setInterval(checkBackendStatus, 6000);

// Initialize Custom Scrollable Model Dropdown
function initCustomModelDropdown() {
  if (!modelSelect || !modelDropdownMenu || !modelDropdownTrigger) return;

  modelDropdownMenu.innerHTML = "";
  const optgroups = modelSelect.querySelectorAll("optgroup");

  optgroups.forEach((group) => {
    const groupHeader = document.createElement("div");
    groupHeader.className = "model-group-title";
    groupHeader.innerHTML = `
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
      </svg>
      <span>${group.label}</span>
    `;
    modelDropdownMenu.appendChild(groupHeader);

    const options = group.querySelectorAll("option");
    options.forEach((opt) => {
      const isSelected = opt.value === modelSelect.value;
      const item = document.createElement("div");
      item.className = `model-option-item ${isSelected ? "selected" : ""}`;
      item.dataset.value = opt.value;
      item.innerHTML = `
        <span>${opt.textContent}</span>
        <svg class="check-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
      `;

      item.addEventListener("click", () => {
        modelSelect.value = opt.value;
        if (selectedModelLabel) {
          selectedModelLabel.textContent = opt.textContent;
        }

        modelDropdownMenu.querySelectorAll(".model-option-item").forEach((el) => {
          el.classList.remove("selected");
        });
        item.classList.add("selected");

        if (modelDropdownWrapper) {
          modelDropdownWrapper.classList.remove("open");
        }
      });

      modelDropdownMenu.appendChild(item);
    });
  });

  modelDropdownTrigger.addEventListener("click", (e) => {
    e.stopPropagation();
    if (modelDropdownWrapper) {
      const isOpen = modelDropdownWrapper.classList.toggle("open");
      modelDropdownTrigger.setAttribute("aria-expanded", isOpen);
    }
  });

  document.addEventListener("click", (e) => {
    if (modelDropdownWrapper && !modelDropdownWrapper.contains(e.target)) {
      modelDropdownWrapper.classList.remove("open");
      modelDropdownTrigger.setAttribute("aria-expanded", "false");
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && modelDropdownWrapper) {
      modelDropdownWrapper.classList.remove("open");
      modelDropdownTrigger.setAttribute("aria-expanded", "false");
    }
  });
}

initCustomModelDropdown();

// Sidebar controls
function toggleSidebar() {
  if (sidebar) {
    sidebar.classList.toggle("collapsed");
  }
}

if (collapseSidebarBtn) collapseSidebarBtn.addEventListener("click", toggleSidebar);
if (sidebarToggleBtn) sidebarToggleBtn.addEventListener("click", toggleSidebar);

if (quickIngestTrigger) {
  quickIngestTrigger.addEventListener("click", () => {
    sourcePanel.classList.remove("hidden");
    sourceUrl.focus();
  });
}

// Source toggle panel
if (sourceToggle) {
  sourceToggle.addEventListener("click", () => {
    sourcePanel.classList.toggle("hidden");
    if (!sourcePanel.classList.contains("hidden")) {
      sourceUrl.focus();
    }
  });
}

// Ingestion Handler
async function ingestSource(targetUrl) {
  const url = (targetUrl || sourceUrl.value).trim();
  if (!url) return;

  // Require valid API key
  const apiKeyCheck = geminiApiKeyInput ? geminiApiKeyInput.value.trim() : null;
  if (!isValidGeminiKey(apiKeyCheck)) {
    ingestStatus.textContent = "\u26a0 Please enter a valid Gemini API key (starts with AIza) first.";
    ingestStatus.className = "ingest-status error";
    sourcePanel.classList.remove("hidden");
    geminiApiKeyInput && geminiApiKeyInput.focus();
    return;
  }

  const depthSelect = document.getElementById("maxDepthSelect");
  const cardDepthSelect = document.getElementById("cardMaxDepthSelect");
  const maxDepthVal = parseInt((depthSelect && depthSelect.value) || (cardDepthSelect && cardDepthSelect.value) || "1", 10);

  ingestBtn.disabled = true;
  ingestStatus.textContent = "Ingesting...";
  ingestStatus.className = "ingest-status";
  sourcePanel.classList.remove("hidden");

  try {
    const response = await fetch(INGEST_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url, max_depth: maxDepthVal })
    });

    const data = await response.json();

    if (!response.ok) {
      ingestStatus.textContent = data.detail || "Ingestion failed.";
      ingestStatus.className = "ingest-status error";
      return;
    }

    ingestStatus.textContent = data.detail || "Ingested.";
    ingestStatus.className = "ingest-status success";
    sourceUrl.value = "";
    
    const cardInput = document.getElementById("cardUrlInput");
    if (cardInput) cardInput.value = "";

    if (data.active_source) {
      selectedSourceId = data.active_source.id;
      const domainName = getDomainName(data.active_source.url);
      const newSessId = "sess_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7);
      chatSessions[newSessId] = {
        id: newSessId,
        title: `${domainName} Chat`,
        sourceId: data.active_source.id,
        collectionName: data.active_source.collection_name,
        messages: [
          {
            sender: "agent",
            text: `Successfully ingested **${data.active_source.url}** into dedicated collection \`${data.active_source.collection_name}\`.\n\nYou are now querying this source exclusively!`,
            isError: false
          }
        ]
      };
      saveStoredSessions();
      if (data.sources) {
        renderSources(data.sources);
      }
      switchSession(newSessId);
    } else if (data.sources) {
      renderSources(data.sources);
    } else {
      checkBackendStatus();
    }
  } catch (e) {
    ingestStatus.textContent = `Error: ${e.message}`;
    ingestStatus.className = "ingest-status error";
  } finally {
    ingestBtn.disabled = false;
  }
}

if (ingestBtn) {
  ingestBtn.addEventListener("click", () => ingestSource());
}

if (sourceUrl) {
  sourceUrl.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      ingestSource();
    }
  });
}

function bindCardIngestForm() {
  const cardForm = document.getElementById("cardIngestForm");
  const cardInput = document.getElementById("cardUrlInput");
  const cardDepth = document.getElementById("cardMaxDepthSelect");
  if (cardForm && cardInput) {
    cardForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const val = cardInput.value.trim();
      if (val) {
        sourceUrl.value = val;
        // Sync card depth → main depth selector before ingest
        const depthSelect = document.getElementById("maxDepthSelect");
        if (cardDepth && depthSelect) {
          depthSelect.value = cardDepth.value;
        }
        ingestSource(val);
      }
    });
  }
}

// Textarea Auto-grow
function autoGrow() {
  input.style.height = "auto";
  input.style.height = Math.min(input.scrollHeight, 140) + "px";
}
if (input) input.addEventListener("input", autoGrow);

// Chat Messaging
function getEmptyStateTemplate() {
  return `
    <div class="empty-state" id="emptyState">
      <div class="empty-state-icon-wrapper">
        <div class="empty-state-glow"></div>
        <div class="brand-icon">
          <svg fill="none" height="28" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" viewBox="0 0 24 24" width="28">
            <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z" fill="rgba(16, 185, 129, 0.2)" stroke="#10b981"></path>
            <path d="M5 3v4" stroke="#10b981" stroke-width="1.5"></path>
            <path d="M19 17v4" stroke="#10b981" stroke-width="1.5"></path>
          </svg>
        </div>
      </div>
      <div class="empty-state-badge">
        <span class="badge-dot"></span>
        Ready to query
      </div>
      <h2>What would you like to explore?</h2>
      <p>Synthesizing answers across your ingested documents and connected LLM providers with semantic retrieval.</p>
      
      <div class="suggestions-grid">
        <div class="suggestion-card">
          <div class="suggestion-header">
            <div class="suggestion-title">
              <svg fill="none" height="15" stroke="#10b981" stroke-width="2" viewBox="0 0 24 24" width="15">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="17 8 12 3 7 8"></polyline>
                <line x1="12" x2="12" y1="3" y2="15"></line>
              </svg>
              Ingest live URL
            </div>
            <span class="suggestion-tag">Direct Index</span>
          </div>
          <div class="suggestion-desc">
            Crawl and index recursive web documentation directly into the vector store.
          </div>
          <form id="cardIngestForm" style="display: flex; align-items: center; gap: 8px; width: 100%;">
            <div style="position: relative; flex: 1;">
              <input class="card-input-glow" id="cardUrlInput" placeholder="https://example.com/docs..." required type="url">
            </div>
            <button class="interactive-ingest-btn" type="submit">
              <svg fill="none" height="12" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24" width="12">
                <line x1="12" x2="12" y1="5" y2="19"></line>
                <line x1="5" x2="19" y1="12" y2="12"></line>
              </svg>
              Ingest
            </button>
          </form>
        </div>
      </div>
    </div>
  `;
}

function getUserAvatarSvg() {
  return `
    <div class="avatar-inner user-avatar-inner">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
        <circle cx="12" cy="7" r="4"></circle>
      </svg>
    </div>
  `;
}

function getAgentAvatarSvg() {
  return `
    <div class="avatar-inner agent-avatar-inner">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z" fill="rgba(16, 185, 129, 0.25)" stroke="#10b981"></path>
        <circle cx="12" cy="12" r="1.5" fill="#10b981"></circle>
      </svg>
    </div>
  `;
}

// Markdown Formatter with marked.js + Robust Offline Fallback
function formatMarkdown(text) {
  if (!text) return "";
  if (typeof marked !== "undefined") {
    try {
      marked.setOptions({
        gfm: true,
        breaks: true,
        highlight: function (code, lang) {
          if (typeof hljs !== "undefined" && lang && hljs.getLanguage(lang)) {
            try {
              return hljs.highlight(code, { language: lang }).value;
            } catch (err) {}
          }
          if (typeof hljs !== "undefined") {
            try {
              return hljs.highlightAuto(code).value;
            } catch (err) {}
          }
          return escapeHtml(code);
        }
      });
      return marked.parse(text);
    } catch (e) {
      console.warn("Marked parse error, using fallback:", e);
    }
  }
  return fallbackMarkdownParse(text);
}

function fallbackMarkdownParse(md) {
  if (!md) return "";
  let html = escapeHtml(md);

  // Fenced Code Blocks ```lang ... ```
  html = html.replace(/```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g, (match, lang, code) => {
    return `<pre><code class="language-${lang || 'text'}">${code}</code></pre>`;
  });

  // Inline code: `code`
  html = html.replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>');

  // Headings
  html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
  html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
  html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');

  // Bold: **text** or __text__
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/__(.*?)__/g, '<strong>$1</strong>');

  // Italic: *text* or _text_
  html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  html = html.replace(/_([^_]+)_/g, '<em>$1</em>');

  // Blockquotes
  html = html.replace(/^>\s*(.*$)/gim, '<blockquote>$1</blockquote>');

  // Unordered lists
  html = html.replace(/^\s*[\-\*]\s+(.*)$/gim, '<li>$1</li>');
  html = html.replace(/(<li>.*<\/li>)/gims, '<ul>$1</ul>');

  // Paragraphs & Line breaks
  html = html.replace(/\n\n+/g, '</p><p>');
  html = html.replace(/\n/g, '<br>');
  html = '<p>' + html + '</p>';
  
  html = html.replace(/<p><\/p>/g, '');
  html = html.replace(/<p>(<pre[\s\S]*?<\/pre>)<\/p>/g, '$1');
  return html;
}

// Enhance code blocks with copy buttons & language badges
function enhanceCodeBlocks(container) {
  if (!container) return;
  const pres = container.querySelectorAll("pre");
  pres.forEach((pre) => {
    if (pre.querySelector(".code-header")) return;
    const codeEl = pre.querySelector("code");
    let lang = "code";
    if (codeEl) {
      const match = codeEl.className.match(/language-([a-zA-Z0-9_-]+)/);
      if (match && match[1]) {
        lang = match[1];
      }
    }
    const header = document.createElement("div");
    header.className = "code-header";
    header.innerHTML = `
      <span class="code-lang">${lang}</span>
      <button class="code-copy-btn" title="Copy code snippet">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
        </svg>
        <span>Copy</span>
      </button>
    `;
    const copyBtn = header.querySelector(".code-copy-btn");
    copyBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const textToCopy = codeEl ? codeEl.innerText : pre.innerText;
      navigator.clipboard.writeText(textToCopy).then(() => {
        copyBtn.classList.add("copied");
        copyBtn.querySelector("span").textContent = "Copied!";
        setTimeout(() => {
          copyBtn.classList.remove("copied");
          copyBtn.querySelector("span").textContent = "Copy";
        }, 2000);
      });
    });
    pre.insertBefore(header, pre.firstChild);
  });
}

function renderMessageElement(text, sender, isError = false) {
  const emptyState = document.getElementById("emptyState");
  if (emptyState) emptyState.remove();

  const row = document.createElement("div");
  row.className = `row ${sender}`;

  const wrap = document.createElement("div");
  wrap.className = "bubble-wrap";

  const avatar = document.createElement("div");
  avatar.className = `avatar ${sender}-avatar`;
  avatar.innerHTML = sender === "user" ? getUserAvatarSvg() : getAgentAvatarSvg();

  const bubble = document.createElement("div");
  bubble.className = "bubble" + (isError ? " error" : "");

  if (isError) {
    bubble.textContent = text;
  } else {
    const contentDiv = document.createElement("div");
    contentDiv.className = "bubble-content markdown-body";
    contentDiv.innerHTML = formatMarkdown(text);
    enhanceCodeBlocks(contentDiv);
    bubble.appendChild(contentDiv);

    if (sender === "agent") {
      const actionsDiv = document.createElement("div");
      actionsDiv.className = "message-actions";
      actionsDiv.innerHTML = `
        <button class="msg-action-btn copy-msg-btn" title="Copy response">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
          </svg>
          <span>Copy</span>
        </button>
      `;
      const copyBtn = actionsDiv.querySelector(".copy-msg-btn");
      copyBtn.addEventListener("click", () => {
        navigator.clipboard.writeText(text).then(() => {
          copyBtn.classList.add("copied");
          copyBtn.querySelector("span").textContent = "Copied!";
          setTimeout(() => {
            copyBtn.classList.remove("copied");
            copyBtn.querySelector("span").textContent = "Copy";
          }, 2000);
        });
      });
      bubble.appendChild(actionsDiv);
    }
  }

  wrap.appendChild(avatar);
  wrap.appendChild(bubble);
  row.appendChild(wrap);
  chatDiv.appendChild(row);
  chatDiv.scrollTop = chatDiv.scrollHeight;
  return row;
}

function addMessage(text, sender, isError = false) {
  if (!currentSessionId) {
    currentSessionId = "sess_" + Date.now();
    chatSessions[currentSessionId] = {
      id: currentSessionId,
      title: text.substring(0, 28) + (text.length > 28 ? "..." : ""),
      messages: []
    };
  }

  const s = chatSessions[currentSessionId];
  if (s) {
    if (s.messages.length === 0 && sender === "user") {
      s.title = text.substring(0, 28) + (text.length > 28 ? "..." : ""),
      renderSessions();
    }
    s.messages.push({ text, sender, isError });
    saveStoredSessions();
  }

  return renderMessageElement(text, sender, isError);
}

function addTypingIndicator() {
  const row = document.createElement("div");
  row.className = "row agent";
  row.id = "typingRow";
  row.innerHTML = `
    <div class="bubble-wrap">
      <div class="avatar agent-avatar">
        ${getAgentAvatarSvg()}
      </div>
      <div class="bubble">
        <div class="typing"><span></span><span></span><span></span></div>
      </div>
    </div>`;
  chatDiv.appendChild(row);
  chatDiv.scrollTop = chatDiv.scrollHeight;
}

function removeTypingIndicator() {
  const row = document.getElementById("typingRow");
  if (row) row.remove();
}

async function sendMessage() {
  const text = input.value.trim();
  if (!text) return;

  // Require valid API key before sending
  const apiKeyCheck = geminiApiKeyInput ? geminiApiKeyInput.value.trim() : null;
  if (!isValidGeminiKey(apiKeyCheck)) {
    addMessage("\u26a0 Please enter a valid Gemini API key (starts with AIza) in the sidebar before sending a message.", "agent", true);
    geminiApiKeyInput && geminiApiKeyInput.focus();
    return;
  }

  addMessage(text, "user");
  input.value = "";
  autoGrow();
  sendBtn.disabled = true;
  addTypingIndicator();

  try {
    const [modelProvider, modelName] = modelSelect.value.split("::");
    const currentSession = chatSessions[currentSessionId];
    const sourceId = currentSession?.sourceId || selectedSourceId;
    const currentSrc = activeSources.find(s => s.id === sourceId);
    const collectionName = currentSrc?.collection_name || currentSession?.collectionName;

    const apiKeyVal = geminiApiKeyInput ? geminiApiKeyInput.value.trim() : null;

    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: text,
        session_id: currentSessionId,
        model_provider: modelProvider,
        model_name: modelName,
        source_id: sourceId,
        collection_name: collectionName,
        gemini_api_key: apiKeyVal || null
      })
    });

    removeTypingIndicator();

    if (!response.ok) {
      const err = await response.json();
      addMessage(err.detail || "Something went wrong.", "agent", true);
      return;
    }

    const data = await response.json();
    addMessage(data.reply, "agent");
  } catch (e) {
    removeTypingIndicator();
    addMessage(`Network error: ${e.message}`, "agent", true);
  } finally {
    sendBtn.disabled = false;
    input.focus();
  }
}

if (sendBtn) sendBtn.addEventListener("click", sendMessage);

if (input) {
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });
}

// Global shortcut: ⌘K or Ctrl+K
window.addEventListener("keydown", (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
    e.preventDefault();
    if (input) input.focus();
  }
});

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Initialize on page load
loadStoredSessions();
const sessionKeys = Object.keys(chatSessions);
if (sessionKeys.length > 0) {
  switchSession(sessionKeys[0]);
} else {
  createNewChat();
}
bindCardIngestForm();