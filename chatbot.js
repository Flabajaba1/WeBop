const MODEL_NAME = "gemini-3.1-flash-lite";

// 1. Formatted System Instruction Object
const SYSTEM_INSTRUCTION = {
  parts: [
    {
      text: `You are Kael, a sarcastic rogue space pilot from the 28th century.
- Tone: Cynical, witty, confident, and uses futuristic slang.
- Background: You fly an old, battered freighter ship named "The Rustbucket".
- Behavior Rules:
  * Never break character under any circumstances.
  * Never state or admit that you are an AI, language model, or software.
  * Keep your answers concise, engaging, and in-character.`
    }
  ]
};

let conversationHistory = [];
let requestActive = false;

async function readStoredData(keys) {
  if (globalThis.chrome?.storage?.local) return chrome.storage.local.get(keys);
  const result = {};
  for (const key of keys) {
    const value = localStorage.getItem(`webop:${key}`);
    if (value !== null) result[key] = key === "chatHistory" ? JSON.parse(value) : value;
  }
  return result;
}

async function saveStoredData(values) {
  if (globalThis.chrome?.storage?.local) return chrome.storage.local.set(values);
  for (const [key, value] of Object.entries(values)) {
    localStorage.setItem(`webop:${key}`, key === "chatHistory" ? JSON.stringify(value) : value);
  }
}

async function removeStoredData(keys) {
  if (globalThis.chrome?.storage?.local) return chrome.storage.local.remove(keys);
  keys.forEach(key => localStorage.removeItem(`webop:${key}`));
}

document.addEventListener("DOMContentLoaded", async () => {
  const backBtn = document.getElementById('btn-back');
  backBtn.addEventListener('click', () => { window.location.href = 'popup.html'; });
  try {
    const saved = await readStoredData(["apiKey", "chatHistory"]);
    if (saved.apiKey) {
      document.getElementById("apiKeyInput").value = saved.apiKey;
      setStatus("Your key is saved locally. Messages are sent to Google Gemini when you send them.");
    }
    if (Array.isArray(saved.chatHistory)) {
      conversationHistory = saved.chatHistory;
      renderChat();
    }
  } catch (error) {
    setStatus(`Could not load saved chat data: ${error.message}`, true);
  }
});

document.getElementById("apiKeyInput").addEventListener("change", async (event) => {
  const apiKey = event.target.value.trim();
  try {
    if (apiKey) await saveStoredData({ apiKey });
    else await removeStoredData(["apiKey"]);
    setStatus(apiKey ? "API key saved in this extension's local storage." : "API key removed. Add one to send messages.");
  } catch (error) {
    setStatus(`Could not save the API key: ${error.message}`, true);
  }
});

document.getElementById("sendBtn").addEventListener("click", handleSend);
document.getElementById("clearBtn").addEventListener("click", handleClear);
document.getElementById("clearKeyBtn").addEventListener("click", handleRemoveKey);
document.getElementById("userInput").addEventListener("keydown", (e) => {
  if (e.key === "Enter") handleSend();
});

async function handleSend() {
  if (requestActive) return;
  const apiKeyInput = document.getElementById("apiKeyInput");
  const apiKey = apiKeyInput.value.trim();
  
  if (!apiKey) {
    setStatus("Add your Gemini API key above before sending a message.", true);
    apiKeyInput.focus();
    return;
  }

  const inputEl = document.getElementById("userInput");
  const userText = inputEl.value.trim();
  if (!userText) return;

  // Append user message
  const userMessage = {
    role: "user",
    parts: [{ text: userText }]
  };
  const previousHistory = conversationHistory.slice();
  conversationHistory.push(userMessage);
  
  inputEl.value = "";
  const sendButton = document.getElementById("sendBtn");
  requestActive = true;
  sendButton.disabled = true;
  inputEl.disabled = true;
  document.getElementById("apiKeyInput").disabled = true;
  document.getElementById("clearBtn").disabled = true;
  document.getElementById("clearKeyBtn").disabled = true;
  setStatus("Kael is replying…");
  renderChat();

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${apiKey}`;

  try {
    await saveStoredData({ apiKey });
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: SYSTEM_INSTRUCTION,
        contents: conversationHistory
      })
    });

    let data;
    try {
      data = await response.json();
    } catch {
      throw new Error(`Gemini returned an unreadable response (HTTP ${response.status}).`);
    }

    // Check for HTTP or API response errors
    if (!response.ok) {
      throw new Error(data.error?.message || `API returned status ${response.status}`);
    }

    // Safely extract candidate text
    const candidate = data.candidates?.[0];
    if (!candidate || !candidate.content?.parts?.[0]?.text) {
      if (candidate?.finishReason) {
        throw new Error(`Response blocked or ended early. Reason: ${candidate.finishReason}`);
      }
      throw new Error("Invalid or empty response format received from API.");
    }

    const botReply = candidate.content.parts[0].text;

    // Append model response
    conversationHistory.push({
      role: "model",
      parts: [{ text: botReply }]
    });

    await saveStoredData({ chatHistory: conversationHistory });
    renderChat();
    setStatus("Reply received.");

  } catch (error) {
    console.error("Gemini Error:", error);
    conversationHistory = previousHistory;
    inputEl.value = userText;
    renderChat();
    setStatus(`Could not send message: ${error.message}`, true);
  } finally {
    requestActive = false;
    sendButton.disabled = false;
    inputEl.disabled = false;
    document.getElementById("apiKeyInput").disabled = false;
    document.getElementById("clearBtn").disabled = false;
    document.getElementById("clearKeyBtn").disabled = false;
    inputEl.focus();
  }
}

function renderChat() {
  const box = document.getElementById("chat-box");
  box.innerHTML = "";

  conversationHistory.forEach(msg => {
    const div = document.createElement("div");
    div.className = `msg ${msg.role === "user" ? "user" : "bot"}`;
    div.textContent = msg.parts?.[0]?.text || "";
    box.appendChild(div);
  });

  box.scrollTop = box.scrollHeight;
}

async function handleClear() {
  conversationHistory = [];
  try {
    await removeStoredData(["chatHistory"]);
    renderChat();
    setStatus("Conversation cleared.");
  } catch (error) {
    setStatus(`Could not clear the conversation: ${error.message}`, true);
  }
}

async function handleRemoveKey() {
  try {
    await removeStoredData(["apiKey"]);
    document.getElementById("apiKeyInput").value = "";
    setStatus("API key removed from this extension's local storage.");
  } catch (error) {
    setStatus(`Could not remove the API key: ${error.message}`, true);
  }
}

function setStatus(message, isError = false) {
  const status = document.getElementById("chat-status");
  status.textContent = message;
  status.classList.toggle("error", isError);
}
