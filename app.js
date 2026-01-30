const intakeText = document.getElementById("intakeText");
const preview = document.getElementById("preview");
const previewBtn = document.getElementById("previewBtn");
const acceptBtn = document.getElementById("acceptBtn");
const listEl = document.getElementById("artifactList");
const detailEl = document.getElementById("artifactDetail");
const freezeBtn = document.getElementById("freezeBtn");
const abandonBtn = document.getElementById("abandonBtn");

let selectedId = null;

const IS_TOUCH =
  ("ontouchstart" in window) ||
  (navigator.maxTouchPoints && navigator.maxTouchPoints > 0);

let lastTapId = null;
let lastTapAt = 0;

let lastOpenedArtifact = null;

// Container navigation state
let viewMode = "ALL";
let currentContainerId = null;

function setRenameEnabled(enabled) {
  const btn = document.getElementById("renameSpineBtn");
  if (!btn) return;
  btn.disabled = !enabled;
  btn.style.opacity = enabled ? "1" : "0.5";
}

function setAddToFolderEnabled(enabled) {
  const btn = document.getElementById("addToFolderBtn");
  if (!btn) return;
  btn.disabled = !enabled;
  btn.style.opacity = enabled ? "1" : "0.5";
}

function spineLabelOf(a) {
  const v = String(a?.spineLabel || "").trim();
  return v || "UNKNOWN";
}

function isContainer(a) {
  return a && a.type === "CONTAINER";
}

function snippetOf(raw, n = 240) {
  const s = String(raw || "");
  return s.length <= n ? s : s.slice(0, n) + "…";
}

function showPreview(a) {
  selectedId = null;
  lastOpenedArtifact = null;
  setRenameEnabled(false);
  setAddToFolderEnabled(false);

  const hint = IS_TOUCH ? "\n\n(tap again to open)" : "";

  if (isContainer(a)) {
    detailEl.textContent =
      `Folder: ${spineLabelOf(a)}\n` +
      `CreatedAt: ${a.createdAt}\n` +
      `State: ${a.state}\n` +
      `Contains: ${(a.contains || []).length} item(s)` +
      hint;
    return;
  }

  detailEl.textContent =
    `SpineLabel: ${spineLabelOf(a)}\n` +
    `CreatedAt: ${a.createdAt}\n` +
    `State: ${a.state}\n` +
    `ID: ${a.id}\n\n` +
    `Snippet:\n${snippetOf(a.raw)}` +
    hint;
}

function openFull(a) {
  selectedId = a.id;
  lastOpenedArtifact = a;
  setRenameEnabled(true);
  setAddToFolderEnabled(!isContainer(a));

  if (isContainer(a)) {
    viewMode = "CONTAINER";
    currentContainerId = a.id;
    detailEl.textContent =
      `Folder Opened: ${spineLabelOf(a)}\n` +
      `Contains: ${(a.contains || []).length} item(s)\n\n` +
      `Select an item from the list.\n(Use Back to return.)`;
    renderList();
    return;
  }

  detailEl.textContent = a.raw;
}

function renderList() {
  listEl.innerHTML = "";
  const all = VAULT.list();
  const containers = all.filter(isContainer);

  // Build set of all contained artifact IDs
  const containedIds = new Set();
  containers.forEach(c => {
    (c.contains || []).forEach(id => containedIds.add(id));
  });

  if (viewMode === "CONTAINER" && currentContainerId) {
    const container = all.find(x => x.id === currentContainerId);
    const ids = (container && container.contains) || [];

    const back = document.createElement("li");
    back.textContent = "← Back to All";
    back.onclick = () => {
      viewMode = "ALL";
      currentContainerId = null;
      selectedId = null;
      renderList();
      detailEl.textContent = "";
    };
    listEl.appendChild(back);

    ids
      .map(id => all.find(x => x.id === id))
      .filter(Boolean)
      .forEach(a => renderRow(a));

    return;
  }

  // ALL view: show folders + loose artifacts only
  all.forEach(a => {
    if (!isContainer(a) && containedIds.has(a.id)) return;
    renderRow(a);
  });
}

function renderRow(a) {
  const li = document.createElement("li");
  const primary = document.createElement("div");
  primary.textContent = isContainer(a) ? `📁 ${spineLabelOf(a)}` : spineLabelOf(a);

  const secondary = document.createElement("div");
  secondary.textContent = `${a.createdAt} · ${a.state}`;
  secondary.style.opacity = "0.75";
  secondary.style.fontSize = "0.9em";

  li.appendChild(primary);
  li.appendChild(secondary);

  li.onmouseenter = () => {
    if (!IS_TOUCH) showPreview(a);
  };

  li.onclick = () => {
    if (!IS_TOUCH) {
      openFull(a);
      return;
    }

    const now = Date.now();
    if (lastTapId === a.id && now - lastTapAt <= 900) {
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
}

previewBtn.onclick = () => {
  preview.textContent = intakeText.value;
  acceptBtn.disabled = !intakeText.value.trim();
};

acceptBtn.onclick = () => {
  VAULT.add(intakeText.value);
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
ensureFolderButtons();
renderList();
