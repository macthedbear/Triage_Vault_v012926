// app.js (Patch 3.3 full-file replacement)

const intakeText = document.getElementById("intakeText");
const preview = document.getElementById("preview");
const previewBtn = document.getElementById("previewBtn");
const acceptBtn = document.getElementById("acceptBtn");
const listEl = document.getElementById("artifactList");
const detailEl = document.getElementById("artifactDetail");
const freezeBtn = document.getElementById("freezeBtn");
const abandonBtn = document.getElementById("abandonBtn");

// State
let selectedId = null;
let viewMode = "ALL"; // "ALL" | "CONTAINER"
let currentContainerId = null;

// Touch interaction (tap twice to open)
const IS_TOUCH =
  ("ontouchstart" in window) ||
  (navigator.maxTouchPoints && navigator.maxTouchPoints > 0);

let lastTapId = null;
let lastTapAt = 0;

// ---------- helpers ----------

function spineLabelOf(a) {
  const v = String(a?.spineLabel || "").trim();
  return v ? v : "UNKNOWN";
}

function isContainer(a) {
  return a && a.type === "CONTAINER";
}

function snippetOf(raw, n = 240) {
  const s = String(raw || "");
  return s.length <= n ? s : s.slice(0, n) + "…";
}

function setBtnEnabled(id, enabled) {
  const btn = document.getElementById(id);
  if (!btn) return;
  btn.disabled = !enabled;
  btn.style.opacity = enabled ? "1" : "0.5";
  btn.style.cursor = enabled ? "pointer" : "not-allowed";
}

// ---------- preview/open ----------

function showPreview(a) {
  // Preview does not arm actions that require a selection.
  selectedId = null;
  setBtnEnabled("renameSpineBtn", false);
  setBtnEnabled("addToFolderBtn", false);

  if (isContainer(a)) {
    detailEl.textContent =
      `Folder: ${spineLabelOf(a)}\n` +
      `Created: ${a.createdAt}\n` +
      `State: ${a.state}\n` +
      `ID: ${a.id}\n` +
      `Contains: ${(Array.isArray(a.contains) ? a.contains.length : 0)}` +
      (IS_TOUCH ? `\n\n(tap again to open)` : ``);
    return;
  }

  detailEl.textContent =
    `SpineLabel: ${spineLabelOf(a)}\n` +
    `Created: ${a.createdAt}\n` +
    `State: ${a.state}\n` +
    `ID: ${a.id}\n\n` +
    `Snippet:\n${snippetOf(a.raw)}` +
    (IS_TOUCH ? `\n\n(tap again to open)` : ``);
}

function openFull(a) {
  selectedId = a.id;

  // Arm controls for opened selection
  setBtnEnabled("renameSpineBtn", true);
  setBtnEnabled("addToFolderBtn", !isContainer(a));

  if (isContainer(a)) {
    viewMode = "CONTAINER";
    currentContainerId = a.id;

    detailEl.textContent =
      `Folder Opened: ${spineLabelOf(a)}\n` +
      `Contains: ${(Array.isArray(a.contains) ? a.contains.length : 0)}\n\n` +
      `Use the index to select an artifact inside.\n` +
      `Back returns to All.\n`;

    renderList();
    return;
  }

  detailEl.textContent = String(a.raw || "");
}

function handleItemInteraction(a, openOnThisEvent) {
  if (!IS_TOUCH) {
    if (openOnThisEvent) openFull(a);
    else showPreview(a);
    return;
  }

  // Touch: first tap previews, second tap opens (within 900ms on same item)
  const now = Date.now();
  const isSecondTapSame = lastTapId === a.id && (now - lastTapAt) <= 900;

  if (isSecondTapSame) {
    openFull(a);
    lastTapId = null;
    lastTapAt = 0;
  } else {
    showPreview(a);
    lastTapId = a.id;
    lastTapAt = now;
  }
}

// ---------- UI: injected controls (Patch 3.3) ----------

function getActionsEl() {
  // Be explicit so we never inject into the wrong place.
  return document.querySelector("#detail .actions") || document.querySelector(".actions");
}

function ensureControlsOnce() {
  const actions = getActionsEl();
  if (!actions) return false;

  // New Folder
  if (!document.getElementById("newFolderBtn")) {
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

    // Insert at the front of actions row
    actions.insertBefore(newBtn, actions.firstChild);
  }

  // Add to Folder (Move semantics: single-folder, auto-move)
  if (!document.getElementById("addToFolderBtn")) {
    const addBtn = document.createElement("button");
    addBtn.id = "addToFolderBtn";
    addBtn.textContent = "Add to Folder";
    addBtn.disabled = true;
    addBtn.style.opacity = "0.5";
    addBtn.style.cursor = "not-allowed";

    addBtn.onclick = () => {
      if (!selectedId) return;

      const all = VAULT.list();
      const current = all.find(x => x.id === selectedId);
      if (!current || isContainer(current)) return;

      const folders = all.filter(isContainer);
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

      // index.js provides moveToContainer (Patch 3.1)
      const res = VAULT.moveToContainer(target.id, current.id);

      if (!res || !res.ok) {
        const reason = res && res.reason ? res.reason : "UNKNOWN";
        if (reason === "ALREADY_PRESENT") alert("Already in that folder.");
        else if (reason === "NO_NESTED_CONTAINERS") alert("Folders cannot contain other folders (v1).");
        else alert("Could not add to folder.");
        return;
      }

      // After move, All view projection will hide the artifact.
      // If we were viewing a folder already, keep view stable.
      renderList();

      // Show folder opened (so you can see the moved artifact immediately)
      const refreshedTarget = VAULT.list().find(x => x.id === target.id);
      if (refreshedTarget) openFull(refreshedTarget);
    };

    // Insert after New Folder if present, else at front.
    const newFolderBtn = document.getElementById("newFolderBtn");
    if (newFolderBtn && newFolderBtn.nextSibling) actions.insertBefore(addBtn, newFolderBtn.nextSibling);
    else actions.insertBefore(addBtn, actions.firstChild);
  }

  // Rename SpineLabel
  if (!document.getElementById("renameSpineBtn")) {
    const btn = document.createElement("button");
    btn.id = "renameSpineBtn";
    btn.textContent = "Rename SpineLabel";
    btn.disabled = true;
    btn.style.opacity = "0.5";
    btn.style.cursor = "not-allowed";

    btn.onclick = () => {
      if (!selectedId) return;

      const all = VAULT.list();
      const current = all.find(x => x.id === selectedId);
      if (!current) return;

      const proposed = prompt("New SpineLabel (one line):", spineLabelOf(current));
      if (proposed === null) return;

      const cleaned = String(proposed).trim();
      if (!cleaned) {
        alert("SpineLabel cannot be empty.");
        return;
      }

      const ok = VAULT.updateSpineLabel(selectedId, cleaned);
      if (!ok) {
        alert("Rename failed.");
        return;
      }

      renderList();

      // Refresh detail view for continuity
      const refreshed = VAULT.list().find(x => x.id === selectedId);
      if (refreshed) {
        if (isContainer(refreshed)) {
          detailEl.textContent =
            `Folder Opened: ${spineLabelOf(refreshed)}\n` +
            `Contains: ${(Array.isArray(refreshed.contains) ? refreshed.contains.length : 0)}\n\n` +
            `Use the index to select an artifact inside.\n` +
            `Back returns to All.\n`;
        } else {
          detailEl.textContent = String(refreshed.raw || "");
        }

        // Re-arm based on type
        setBtnEnabled("renameSpineBtn", true);
        setBtnEnabled("addToFolderBtn", !isContainer(refreshed));
      }
    };

    // Place rename just before Freeze for the desired order
    actions.insertBefore(btn, freezeBtn);
  }

  // Ensure correct default arming state when nothing is opened
  if (!selectedId) {
    setBtnEnabled("renameSpineBtn", false);
    setBtnEnabled("addToFolderBtn", false);
  }

  return true;
}

// Retry injection a few times in case of lifecycle timing on mobile
function mountControlsWithRetry(attempts = 8) {
  const ok = ensureControlsOnce();
  if (ok) return;

  if (attempts <= 0) return;
  setTimeout(() => mountControlsWithRetry(attempts - 1), 50);
}

// ---------- rendering ----------

function appendListItem(a) {
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
    if (!IS_TOUCH) handleItemInteraction(a, false);
  };

  li.onclick = () => handleItemInteraction(a, true);

  listEl.appendChild(li);
}

function renderList() {
  mountControlsWithRetry(2);
  listEl.innerHTML = "";

  const all = VAULT.list();
  const containers = all.filter(isContainer);

  // Container view
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
      detailEl.textContent = "";
      setBtnEnabled("renameSpineBtn", false);
      setBtnEnabled("addToFolderBtn", false);
      renderList();
    };
    listEl.appendChild(backLi);

    // Header row
    const headerLi = document.createElement("li");
    headerLi.textContent = `📁 ${spineLabelOf(container)} (${containsIds.length})`;
    headerLi.style.opacity = "0.85";
    headerLi.style.pointerEvents = "none";
    listEl.appendChild(headerLi);

    // Only contained artifacts
    const contained = containsIds
      .map(id => all.find(x => x.id === id))
      .filter(x => x && !isContainer(x));

    contained.forEach(a => appendListItem(a));

    // Guard: even in container view, avoid a blank panel with no explanation
    if (contained.length === 0 && all.length > 0) {
      const li = document.createElement("li");
      li.textContent = "This folder is empty.";
      li.style.opacity = "0.75";
      li.style.fontStyle = "italic";
      listEl.appendChild(li);
    }

    return;
  }

  // Projected All view (Patch 3.1)
  const filedIds = new Set();
  containers.forEach(c => {
    if (!Array.isArray(c.contains)) return;
    c.contains.forEach(id => filedIds.add(id));
  });

  let rendered = 0;

  // Folders first
  containers.forEach(c => {
    appendListItem(c);
    rendered++;
  });

  // Only unfiled artifacts
  all
    .filter(a => !isContainer(a))
    .filter(a => !filedIds.has(a.id))
    .forEach(a => {
      appendListItem(a);
      rendered++;
    });

  // Patch 3.2 guard: never leave index blank while data exists
  if (rendered === 0 && all.length > 0) {
    const li = document.createElement("li");
    li.textContent =
      "Index empty, but data exists. This usually means all artifacts are filed into folders.";
    li.style.opacity = "0.75";
    li.style.fontStyle = "italic";
    listEl.appendChild(li);
  }
}

// ---------- intake ----------

previewBtn.onclick = () => {
  preview.textContent = intakeText.value;
  const hasText = String(intakeText.value || "").trim().length > 0;
  acceptBtn.disabled = !hasText;
};

acceptBtn.onclick = () => {
  const raw = intakeText.value;
  if (!String(raw || "").trim()) return;

  const res = VAULT.add(raw);
  if (res && res.duplicate) {
    alert("Duplicate detected. Stored anyway. Review and choose action if needed.");
  }

  intakeText.value = "";
  preview.textContent = "";
  acceptBtn.disabled = true;

  renderList();
};

// ---------- state buttons ----------

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

// ---------- lifecycle ----------

document.addEventListener("DOMContentLoaded", () => {
  mountControlsWithRetry(8);
  renderList();
});
