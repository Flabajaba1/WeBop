const DEFAULT_SETTINGS = {
  theme: "xp",
  masterVolume: 50,
  username: "",
  followerEnabled: true,
  followerSize: 80,
  followerSpeed: 1,
  followerSitesMode: "all",
  followerSites: [],
  reducedMotion: false
};

function applyThemeClass(theme) {
  const body = document.body;
  if (!body) return;
  body.classList.remove("theme-xp", "theme-vista", "theme-frutiger-aero");
  if (theme === "vista") {
    body.classList.add("theme-vista");
  } else if (theme === "frutiger-aero") {
    body.classList.add("theme-frutiger-aero");
  } else {
    body.classList.add("theme-xp");
  }
}

function loadSettings() {
  if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
    chrome.storage.local.get(["webopSettings"], (result) => {
      const settings = { ...DEFAULT_SETTINGS, ...result.webopSettings };
      applySettings(settings);
      applyThemeClass(settings.theme || "xp");
    });
  } else {
    const saved = localStorage.getItem("webopSettings");
    const settings = { ...DEFAULT_SETTINGS, ...(saved ? JSON.parse(saved) : {}) };
    applySettings(settings);
    applyThemeClass(settings.theme || "xp");
  }
}

function applySettings(settings) {
  const themeSelect = document.getElementById("theme-select");
  const masterVolume = document.getElementById("master-volume");
  const masterVolumeValue = document.getElementById("master-volume-value");
  const username = document.getElementById("username");
  const followerEnabled = document.getElementById("follower-enabled");
  const followerSize = document.getElementById("follower-size");
  const followerSpeed = document.getElementById("follower-speed");
  const followerSitesMode = document.getElementById("follower-sites-mode");
  const followerSites = document.getElementById("follower-sites");
  const reducedMotion = document.getElementById("reduced-motion");

  if (themeSelect) {
    themeSelect.value = settings.theme || "xp";
  }

  if (masterVolume) {
    masterVolume.value = settings.masterVolume !== undefined ? settings.masterVolume : 50;
    if (masterVolumeValue) masterVolumeValue.textContent = masterVolume.value;
  }

  if (username) username.value = settings.username || "";
  if (followerEnabled) followerEnabled.checked = settings.followerEnabled !== false;
  if (followerSize) followerSize.value = settings.followerSize || 80;
  if (document.getElementById("follower-size-value")) document.getElementById("follower-size-value").textContent = followerSize?.value || "80";
  if (followerSpeed) followerSpeed.value = settings.followerSpeed || 1;
  if (document.getElementById("follower-speed-value")) document.getElementById("follower-speed-value").textContent = followerSpeed?.value || "1";
  if (followerSitesMode) followerSitesMode.value = settings.followerSitesMode || "all";
  if (followerSites) followerSites.value = Array.isArray(settings.followerSites) ? settings.followerSites.join("\n") : "";
  if (reducedMotion) reducedMotion.checked = settings.reducedMotion === true;
}

function parseSiteList(value) {
  const entries = value.split(/[\n,]+/).map(site => site.trim().toLowerCase()).filter(Boolean);
  const domains = entries.map(site => {
    const normalized = site.replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/:\d+$/, "");
    if (!/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)*[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(normalized)) {
      throw new Error(`Invalid domain: ${site}`);
    }
    return normalized;
  });
  return [...new Set(domains)];
}

function saveSettings() {
  const themeSelect = document.getElementById("theme-select");
  const masterVolume = document.getElementById("master-volume");
  const username = document.getElementById("username");
  const statusMessage = document.getElementById("status-message");
  let followerSites;
  try {
    followerSites = parseSiteList(document.getElementById("follower-sites").value);
  } catch (error) {
    showStatus(statusMessage, error.message);
    return;
  }

  const theme = themeSelect ? themeSelect.value : "xp";
  const settings = {
    theme: theme,
    masterVolume: masterVolume ? parseInt(masterVolume.value) : 50,
    username: username ? username.value : "",
    followerEnabled: document.getElementById("follower-enabled").checked,
    followerSize: Number(document.getElementById("follower-size").value),
    followerSpeed: Number(document.getElementById("follower-speed").value),
    followerSitesMode: document.getElementById("follower-sites-mode").value,
    followerSites,
    reducedMotion: document.getElementById("reduced-motion").checked
  };

  applyThemeClass(theme);
  document.body.classList.toggle("reduced-motion", settings.reducedMotion);

  if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
    chrome.storage.local.set({ webopSettings: settings }, () => {
      showStatus(statusMessage, "Settings applied!");
    });
  } else {
    localStorage.setItem("webopSettings", JSON.stringify(settings));
    showStatus(statusMessage, "Settings applied!");
  }
}

function resetSettings() {
  applySettings(DEFAULT_SETTINGS);
  applyThemeClass(DEFAULT_SETTINGS.theme);
  const themeSelect = document.getElementById("theme-select");
  if (themeSelect) themeSelect.value = DEFAULT_SETTINGS.theme;
  saveSettings();
}

function showStatus(element, message) {
  if (!element) return;
  element.textContent = message;
  setTimeout(() => {
    element.textContent = "";
  }, 2000);
}

document.addEventListener("DOMContentLoaded", () => {
  loadSettings();

  const btnSave = document.getElementById("btn-save");
  const btnReset = document.getElementById("btn-reset");
  const btnBack = document.getElementById("btn-back");
  const masterVolume = document.getElementById("master-volume");
  const masterVolumeValue = document.getElementById("master-volume-value");
  const themeSelect = document.getElementById("theme-select");
  const followerSize = document.getElementById("follower-size");
  const followerSpeed = document.getElementById("follower-speed");

  if (masterVolume && masterVolumeValue) {
    masterVolume.addEventListener("input", (e) => {
      masterVolumeValue.textContent = e.target.value;
    });
  }
  followerSize?.addEventListener("input", () => document.getElementById("follower-size-value").textContent = followerSize.value);
  followerSpeed?.addEventListener("input", () => document.getElementById("follower-speed-value").textContent = followerSpeed.value);

  if (themeSelect) {
    themeSelect.addEventListener("change", (e) => {
      applyThemeClass(e.target.value);
    });
  }

  if (btnSave) {
    btnSave.addEventListener("click", saveSettings);
  }

  if (btnReset) {
    btnReset.addEventListener("click", resetSettings);
  }

  if (btnBack) {
    btnBack.addEventListener("click", () => {
      window.location.href = "popup.html";
    });
  }
});
