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

// Patch 3: container navigation state
let viewMode = "ALL"; // "ALL" | "CONTAINER"
let currentContainerId = null;

// Patch 1E: rename button is only enabled when an artifact is opened
function setRenameEnabled(enabled) {
  const btn = document.getElementById("renameSpineBtn");
  if (!btn) return;
  btn.disabled = !enabled;
  btn.style.opacity = enabled ? "1" : "0.5";
  btn.style.cursor = enabled ? "pointer" : "not-allowed";
}

function setAddToFolderEnabled(enabled) {
  const btn = document.getElementById("addToFolderBtn");
  if (!btn) return;
  btn.disabled = !enabled;
  btn.style.opacity = enabled ? "1" : "0.5";
  btn.style.cursor = enabled ? "pointer" : "not-allowed";
}

function spineLabelOf(a) {
  const v = String(a?.spineLabel || "").trim();
  return v ? v : "UNKNOWN";
}

function isContainer(a) {
  return a && a.type === "CONTAINER";
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
  setAddToFolderEnabled(false);

  const label = spineLabelOf(a);
  const createdAt = String(a?.createdAt || "UNKNOWN");
  const state = String(a?.state || "UNKNOWN");
  const id = String(a?.id || "UNKNOWN");
  const hash = String(a?.hash || "UNKNOWN");
  const hint = IS_TOUCH ? "\n\n(tap again to open)" : "";

  if (isContainer(a)) {
    const count = Array.isArray(a.contains) ? a.contains.length : 0;
    detailEl.textContent =
      `Folder: ${label}\n` +
      `CreatedAt: ${createdAt}\n` +
      `State: ${state}\n` +
      `ID: ${id}\n` +
      `Hash: ${hash}\n` +
      `Contains: ${count} item(s)` +
      hint;
    return;
  }

  const snip = snippetOf(a?.raw);

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
  setRenameEnabled(true);

  // Add-to-folder only makes sense for real artifacts, not containers
  setAddToFolderEnabled(!isContainer(a));

  if (isContainer(a)) {
    // Opening a container navigates the index to its contents
    viewMode = "CONTAINER";
    currentContainerId = a.id;

    detailEl.textContent =
      `Folder Opened: ${spineLabelOf(a)}\n` +
      `Contains: ${(Array.isArray(a.contains) ? a.contains.length : 0)} item(s)\n\n` +
      `Select an item from the list to preview/open.\n` +
      `(Use “Back” at the top of the list to return.)`;

    renderList();
    return;
  }

  // Normal artifact open
  detailEl.textContent = a.raw;
}

function renderList() {
  listEl.innerHTML = "";

  const all = VAULT.list();
  const containers = all.filter(isContainer);

  // If we're inside a container view, render its contents list instead of the full index
  if (viewMode === "CONTAINER" && currentContainerId) {
    const container = all.find(x => x.id === currentContainerId);
    const containsIds = (container && Array.isArray(container.contains)) ? container.contains : [];

    // Back row
    const backLi = document.createElement("li");
    backLi.textContent = "← Back to All";
    backLi.style.fontWeight = "600";
    backLi.onclick = () => {
      viewMode = "ALL";
      currentContainerId = null;
      selectedId = null;
      lastOpenedArtifact = null;
      setRenameEnabled(false);
      setAddToFolderEnabled(false);
      detailEl.textContent = "";
      renderList();
    };
    listEl.appendChild(backLi);

    // Container header row (recognition)
    const headerLi = document.createElement("li");
    headerLi.textContent = `📁 ${spineLabelOf(container)} (${containsIds.length})`;
    headerLi.style.opacity = "0.85";
    headerLi.style.pointerEvents = "none";
    listEl.appendChild(headerLi);

    // Contained artifacts only (v1: no nested containers)
    const contained = containsIds
      .map(id => all.find(x => x.id === id))
      .filter(x => x && !isContainer(x));

    contained.forEach(a => {
      const li = document.createElement("li");

      const primary = document.createElement("div");
      primary.textContent = spineLabelOf(a);

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

    return;
  }

  // Default: render ALL artifacts and containers
  all.forEach(a => {
    const li = document.createElement("li");

    const primary = document.createElement("div");
    primary.textContent = isContainer(a) ? `📁 ${spineLabelOf(a)}` : spineLabelOf(a);

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
    if (!selectedId) return; // disabled anyway

    const artifacts = VAULT.list();
    const current = artifacts.find(x => x.id === selectedId) || lastOpenedArtifact;

    const currentLabel = spineLabelOf(current);
    const next = prompt("New SpineLabel (one line):", currentLabel);
    if (next === null) return;

    const cleaned = String(next).trim();
    if (!cleaned) {
      alert("SpineLabel cannot be empty.");
      return;
    }

    VAULT.updateSpineLabel(selectedId, cleaned);

    renderList();

    const updated = VAULT.list().find(x => x.id === selectedId);
    if (updated) {
      lastOpenedArtifact = updated;

      // If a container is opened, keep container view text; if artifact, show raw
      if (isContainer(updated)) {
        detailEl.textContent =
          `Folder Opened: ${spineLabelOf(updated)}\n` +
          `Contains: ${(Array.isArray(updated.contains) ? updated.contains.length : 0)} item(s)\n\n` +
          `Select an item from the list to preview/open.\n` +
          `(Use “Back” at the top of the list to return.)`;
      } else {
        detailEl.textContent = updated.raw;
      }

      setRenameEnabled(true);
      setAddToFolderEnabled(!isContainer(updated));
    }
  };

  actions.insertBefore(btn, actions.firstChild);
}

function ensureFolderButtons() {
  const detailSection = document.getElementById("detail");
  if (!detailSection) return;

  const actions = detailSection.querySelector(".actions");
  if (!actions) return;

  if (document.getElementById("newFolderBtn")) return;

  const newBtn = document.createElement("button");
  newBtn.id = "newFolderBtn";
  newBtn.textContent = "New Folder";
  newBtn.onclick = () => {
    const name = prompt("Folder SpineLabel (one line, required):", "");
    if (name === null) return;

    const cleaned = String(name).trim();
    if (!cleaned) {
      alert("Folder SpineLabel cannot be empty.");
      return;
    }

    const created = VAULT.createContainer(cleaned);
    if (!created) {
      alert("Folder creation failed.");
      return;
    }

    renderList();
  };

  const addBtn = document.createElement("button");
  addBtn.id = "addToFolderBtn";
  addBtn.textContent = "Add to Folder";

  // default disabled until a real artifact is opened
  addBtn.disabled = true;
  addBtn.style.opacity = "0.5";
  addBtn.style.cursor = "not-allowed";

  addBtn.onclick = () => {
    if (!selectedId) return;

    const artifacts = VAULT.list();
    const current = artifacts.find(x => x.id === selectedId);
    if (!current || isContainer(current)) return;

    const folders = artifacts.filter(isContainer);
    if (folders.length === 0) {
      alert("No folders yet. Create one first.");
      return;
    }

    const menu = folders
      .map((f, i) => `${i + 1}) ${spineLabelOf(f)} (${(Array.isArray(f.contains) ? f.contains.length : 0)})`)
      .join("\n");

    const choice = prompt(`Choose folder number:\n\n${menu}`, "1");
    if (choice === null) return;

    const idx = Number(String(choice).trim());
    if (!Number.isFinite(idx) || idx < 1 || idx > folders.length) {
      alert("Invalid selection.");
      return;
    }

    const target = folders[idx - 1];
    const res = VAULT.addToContainer(target.id, current.id);

    if (!res || !res.ok) {
      const reason = res && res.reason ? res.reason : "UNKNOWN";
      if (reason === "ALREADY_PRESENT") {
        alert("Already in that folder.");
      } else if (reason === "NO_NESTED_CONTAINERS") {
        alert("Folders cannot contain other folders (v1).");
      } else {
        alert("Could not add to folder.");
      }
      return;
    }

    // If we're currently viewing that folder, refresh the list
    if (viewMode === "CONTAINER" && currentContainerId === target.id) {
      renderList();
    } else {
      renderList();
    }
  };

  // Put folder buttons before rename for flow: New Folder, Add to Folder, Rename, Freeze, Abandon
  actions.insertBefore(addBtn, actions.firstChild);
  actions.insertBefore(newBtn, actions.firstChild);
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
ensureFolderButtons();

// Initial state: nothing opened yet
setRenameEnabled(!!selectedId);
setAddToFolderEnabled(false);

renderList();
