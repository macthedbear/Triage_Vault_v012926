const intakeText = document.getElementById("intakeText");
const preview = document.getElementById("preview");
const previewBtn = document.getElementById("previewBtn");
const acceptBtn = document.getElementById("acceptBtn");
const listEl = document.getElementById("artifactList");
const detailEl = document.getElementById("artifactDetail");
const freezeBtn = document.getElementById("freezeBtn");
const abandonBtn = document.getElementById("abandonBtn");

let selectedId = null;

// Patch 1B: preview-first interaction (desktop hover, mobile tap)
const IS_TOUCH =
  ("ontouchstart" in window) ||
  (navigator.maxTouchPoints && navigator.maxTouchPoints > 0);

let lastTapId = null;
let lastTapAt = 0;

// Patch 1C-A: remember last opened artifact object for rename defaults
let lastOpenedArtifact = null;

// Patch 1E: rename button is only enabled when an artifact is opened
function setRenameEnabled(enabled) {
  const btn = document.getElementById("renameSpineBtn");
  if (!btn) return;
  btn.disabled = !enabled;
  btn.style.opacity = enabled ? "1" : "0.5";
  btn.style.cursor = enabled ? "pointer" : "not-allowed";
}

function spineLabelOf(a) {
  const v = String(a?.spineLabel || "").trim();
  return v ? v : "UNKNOWN";
}

function snippetOf(raw, n = 240) {
  const s = String(raw || "");
  if (s.length <= n) return s;
  return s.slice(0, n) + "…";
}

function showPreview(a) {
  // Preview is between index and full open, so do not arm Freeze/Abandon.
  selectedId = null;
  lastOpenedArtifact = null;
  setRenameEnabled(false);

  const label = spineLabelOf(a);
  const createdAt = String(a?.createdAt || "UNKNOWN");
  const state = String(a?.state || "UNKNOWN");
  const id = String(a?.id || "UNKNOWN");
  const hash = String(a?.hash || "UNKNOWN");
  const snip = snippetOf(a?.raw);

  const hint = IS_TOUCH ? "\n\n(tap again to open)" : "";

  detailEl.textContent =
    `SpineLabel: ${label}\n` +
    `CreatedAt: ${createdAt}\n` +
    `State: ${state}\n` +
    `ID: ${id}\n` +
    `Hash: ${hash}\n\n` +
    `Snippet:\n${snip}` +
    hint;
}

function openFull(a) {
  selectedId = a.id;
  lastOpenedArtifact = a;
  detailEl.textContent = a.raw;
  setRenameEnabled(true);
}

function renderList() {
  listEl.innerHTML = "";
  VAULT.list().forEach(a => {
    const li = document.createElement("li");

    // SpineLabel-first index row (recognition, not inspection)
    const primary = document.createElement("div");
    primary.textContent = spineLabelOf(a);

    const secondary = document.createElement("div");
    secondary.textContent = `${a.createdAt} · ${a.state}`;
    secondary.style.opacity = "0.75";
    secondary.style.fontSize = "0.9em";

    li.appendChild(primary);
    li.appendChild(secondary);

    // Desktop: hover previews, click opens full
    li.onmouseenter = () => {
      if (!IS_TOUCH) showPreview(a);
    };

    li.onclick = () => {
      if (!IS_TOUCH) {
        openFull(a);
        return;
      }

      // Mobile/touch: first tap previews, second tap opens
      const now = Date.now();
      const isSecondTapSame =
        lastTapId === a.id && (now - lastTapAt) <= 900;

      if (isSecondTapSame) {
        openFull(a);
        lastTapId = null;
        lastTapAt = 0;
      } else {
        showPreview(a);
        lastTapId = a.id;
        lastTapAt = now;
      }
    };

    listEl.appendChild(li);
  });
}

function ensureRenameButton() {
  // Insert a Rename button into the existing detail actions area without editing HTML.
  const detailSection = document.getElementById("detail");
  if (!detailSection) return;

  const actions = detailSection.querySelector(".actions");
  if (!actions) return;

  if (document.getElementById("renameSpineBtn")) return;

  const btn = document.createElement("button");
  btn.id = "renameSpineBtn";
  btn.textContent = "Rename SpineLabel";

  // Patch 1E: default to disabled until an artifact is opened
  btn.disabled = true;
  btn.style.opacity = "0.5";
  btn.style.cursor = "not-allowed";

  btn.onclick = () => {
    // Patch 1E: button should be disabled in preview, but keep guardrail anyway.
    if (!selectedId) {
      alert("Open an artifact first, then rename its SpineLabel.");
      return;
    }

    const artifacts = VAULT.list();
    const current = artifacts.find(x => x.id === selectedId) || lastOpenedArtifact;

    const currentLabel = spineLabelOf(current);
    const next = prompt("New SpineLabel (one line):", currentLabel);
    if (next === null) return; // cancelled

    const cleaned = String(next).trim();
    if (!cleaned) {
      alert("SpineLabel cannot be empty.");
      return;
    }

    // Patch 1C-A: metadata-only rename, allowed even when Frozen.
    VAULT.updateSpineLabel(selectedId, cleaned);

    // Refresh list and keep the artifact open
    renderList();
    const updated = VAULT.list().find(x => x.id === selectedId);
    if (updated) {
      lastOpenedArtifact = updated;
      detailEl.textContent = updated.raw;
      setRenameEnabled(true);
    }
  };

  // Put rename button before Freeze/Abandon for flow
  actions.insertBefore(btn, actions.firstChild);
}

previewBtn.onclick = () => {
  preview.textContent = intakeText.value;
  acceptBtn.disabled = !intakeText.value.trim();
};

acceptBtn.onclick = () => {
  const { record, duplicate } = VAULT.add(intakeText.value);
  if (duplicate) {
    alert("Duplicate detected. Stored anyway. Review and choose action if needed.");
  }
  intakeText.value = "";
  preview.textContent = "";
  acceptBtn.disabled = true;
  renderList();
};

freezeBtn.onclick = () => {
  if (selectedId) {
    VAULT.updateState(selectedId, "FROZEN");
    renderList();
  }
};

abandonBtn.onclick = () => {
  if (selectedId) {
    VAULT.updateState(selectedId, "ABANDONED");
    renderList();
  }
};

ensureRenameButton();

// Patch 1E: reflect initial state (no artifact opened yet)
setRenameEnabled(!!selectedId);

renderList();
