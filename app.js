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
  detailEl.textContent = a.raw;
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

renderList();
