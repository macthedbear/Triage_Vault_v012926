const intakeText = document.getElementById("intakeText");
const preview = document.getElementById("preview");
const previewBtn = document.getElementById("previewBtn");
const acceptBtn = document.getElementById("acceptBtn");
const listEl = document.getElementById("artifactList");
const detailEl = document.getElementById("artifactDetail");
const freezeBtn = document.getElementById("freezeBtn");
const abandonBtn = document.getElementById("abandonBtn");

let selectedId = null;

// Touch detection
const IS_TOUCH =
  ("ontouchstart" in window) ||
  (navigator.maxTouchPoints && navigator.maxTouchPoints > 0);

let lastTapId = null;
let lastTapAt = 0;

let viewMode = "ALL";
let currentContainerId = null;

function spineLabelOf(a) {
  const v = String(a?.spineLabel || "").trim();
  return v ? v : "UNKNOWN";
}

function isContainer(a) {
  return a && a.type === "CONTAINER";
}

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

function showPreview(a) {
  selectedId = null;
  setRenameEnabled(false);
  setAddToFolderEnabled(false);

  if (isContainer(a)) {
    detailEl.textContent =
      `Folder: ${spineLabelOf(a)}\n` +
      `Created: ${a.createdAt}\n` +
      `State: ${a.state}\n` +
      `Contains: ${(a.contains || []).length}` +
      (IS_TOUCH ? `\n\n(tap again to open)` : ``);
    return;
  }

  detailEl.textContent =
    `SpineLabel: ${spineLabelOf(a)}\n` +
    `Created: ${a.createdAt}\n` +
    `State: ${a.state}\n\n` +
    `Snippet:\n${String(a.raw || "").slice(0, 240)}` +
    (IS_TOUCH ? `\n\n(tap again to open)` : ``);
}

function openFull(a) {
  selectedId = a.id;
  setRenameEnabled(true);
  setAddToFolderEnabled(!isContainer(a));

  if (isContainer(a)) {
    viewMode = "CONTAINER";
    currentContainerId = a.id;
    detailEl.textContent =
      `Folder Opened: ${spineLabelOf(a)}\n` +
      `Contains: ${(a.contains || []).length}\n\n` +
      `Use the index to select an artifact.\nBack returns to All.`;
    renderList();
    return;
  }

  detailEl.textContent = String(a.raw || "");
}

function mountInjectedControls() {
  try { ensureRenameButton(); } catch {}
  try { ensureFolderButtons(); } catch {}
}

function renderList() {
  listEl.innerHTML = "";
  mountInjectedControls();

  const all = VAULT.list();
  const containers = all.filter(isContainer);

  if (viewMode === "CONTAINER" && currentContainerId) {
    const c = all.find(x => x.id === currentContainerId);
    const ids = c?.contains || [];

    const back = document.createElement("li");
    back.textContent = "← Back to All";
    back.style.fontWeight = "600";
    back.onclick = () => {
      viewMode = "ALL";
      currentContainerId = null;
      selectedId = null;
      detailEl.textContent = "";
      setRenameEnabled(false);
      setAddToFolderEnabled(false);
      renderList();
    };
    listEl.appendChild(back);

    const header = document.createElement("li");
    header.textContent = `📁 ${spineLabelOf(c)} (${ids.length})`;
    header.style.opacity = "0.8";
    listEl.appendChild(header);

    ids
      .map(id => all.find(a => a.id === id))
      .filter(a => a && !isContainer(a))
      .forEach(a => appendListItem(a));

    return;
  }

  // Default All view (projected)
  const filedIds = new Set();
  containers.forEach(c => (c.contains || []).forEach(id => filedIds.add(id)));

  let rendered = 0;

  containers.forEach(c => {
    appendListItem(c);
    rendered++;
  });

  all
    .filter(a => !isContainer(a))
    .filter(a => !filedIds.has(a.id))
    .forEach(a => {
      appendListItem(a);
      rendered++;
    });

  // Patch 3.2 guard: never leave index blank when data exists
  if (rendered === 0 && all.length > 0) {
    const li = document.createElement("li");
    li.textContent =
      "Index empty, but data exists. This indicates all artifacts are filed or a filter hid them.";
    li.style.opacity = "0.75";
    li.style.fontStyle = "italic";
    listEl.appendChild(li);
  }
}

function appendListItem(a) {
  const li = document.createElement("li");

  const primary = document.createElement("div");
  primary.textContent = isContainer(a)
    ? `📁 ${spineLabelOf(a)}`
    : spineLabelOf(a);

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
    } else {
      showPreview(a);
      lastTapId = a.id;
      lastTapAt = now;
    }
  };

  listEl.appendChild(li);
}

function ensureRenameButton() {
  const actions = document.querySelector(".actions");
  if (!actions || document.getElementById("renameSpineBtn")) return;

  const btn = document.createElement("button");
  btn.id = "renameSpineBtn";
  btn.textContent = "Rename SpineLabel";
  btn.disabled = true;
  btn.onclick = () => {
    if (!selectedId) return;
    const a = VAULT.list().find(x => x.id === selectedId);
    if (!a) return;
    const val = prompt("New SpineLabel:", spineLabelOf(a));
    if (!val || !val.trim()) return alert("SpineLabel cannot be empty.");
    VAULT.updateSpineLabel(selectedId, val.trim());
    renderList();
    openFull(VAULT.list().find(x => x.id === selectedId));
  };

  actions.insertBefore(btn, freezeBtn);
}

function ensureFolderButtons() {
  const actions = document.querySelector(".actions");
  if (!actions) return;

  if (!document.getElementById("newFolderBtn")) {
    const newBtn = document.createElement("button");
    newBtn.id = "newFolderBtn";
    newBtn.textContent = "New Folder";
    newBtn.onclick = () => {
      const name = prompt("Folder SpineLabel:");
      if (!name || !name.trim()) return;
      VAULT.createContainer(name.trim());
      renderList();
    };
    actions.insertBefore(newBtn, actions.firstChild);
  }

  if (!document.getElementById("addToFolderBtn")) {
    const addBtn = document.createElement("button");
    addBtn.id = "addToFolderBtn";
    addBtn.textContent = "Add to Folder";
    addBtn.disabled = true;
    addBtn.onclick = () => {};
    actions.insertBefore(addBtn, actions.firstChild.nextSibling);
  }
}

previewBtn.onclick = () => {
  preview.textContent = intakeText.value;
  acceptBtn.disabled = !String(intakeText.value).trim();
};

acceptBtn.onclick = () => {
  if (!String(intakeText.value).trim()) return;
  VAULT.add(intakeText.value);
  intakeText.value = "";
  preview.textContent = "";
  acceptBtn.disabled = true;
  renderList();
};

freezeBtn.onclick = () => {
  if (!selectedId) return;
  VAULT.updateState(selectedId, "FROZEN");
  renderList();
};

abandonBtn.onclick = () => {
  if (!selectedId) return;
  VAULT.updateState(selectedId, "ABANDONED");
  renderList();
};

document.addEventListener("DOMContentLoaded", () => {
  mountInjectedControls();
  renderList();
});
