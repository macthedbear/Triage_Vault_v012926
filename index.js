// index.js
const STORAGE_KEY = "artifactVault.v1";

function loadArtifacts() {
  return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
}

function saveArtifacts(list) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

function hash(text) {
  let h = 0;
  for (let i = 0; i < text.length; i++) {
    h = (h << 5) - h + text.charCodeAt(i);
    h |= 0;
  }
  return String(h);
}

function isContainer(a) {
  return a && a.type === "CONTAINER";
}

window.VAULT = {
  list() {
    return loadArtifacts();
  },

  add(raw) {
    const artifacts = loadArtifacts();
    const payloadHash = hash(raw);
    const duplicate = artifacts.find(a => a.hash === payloadHash);

    const record = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      state: "ACCEPTED",
      type: "ARTIFACT",
      hash: payloadHash,
      raw: raw,
      spineLabel: "UNKNOWN"
    };

    artifacts.push(record);
    saveArtifacts(artifacts);

    return { record, duplicate };
  },

  createContainer(spineLabel) {
    const cleaned = String(spineLabel || "").trim();
    if (!cleaned) return null;

    const artifacts = loadArtifacts();

    const record = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      state: "ACCEPTED",
      type: "CONTAINER",
      // Containers are not payload-hash artifacts; give them a stable unique hash string.
      hash: "container:" + crypto.randomUUID(),
      raw: "",
      spineLabel: cleaned,
      contains: []
    };

    artifacts.push(record);
    saveArtifacts(artifacts);

    return record;
  },

  addToContainer(containerId, artifactId) {
    const artifacts = loadArtifacts();

    const container = artifacts.find(x => x.id === containerId);
    const item = artifacts.find(x => x.id === artifactId);

    if (!container || !isContainer(container)) return { ok: false, reason: "NOT_A_CONTAINER" };
    if (!item) return { ok: false, reason: "MISSING_ITEM" };

    // v1: no nested containers
    if (isContainer(item)) return { ok: false, reason: "NO_NESTED_CONTAINERS" };

    // no self reference
    if (container.id === item.id) return { ok: false, reason: "SELF_REFERENCE" };

    if (!Array.isArray(container.contains)) container.contains = [];

    // no duplicates
    if (container.contains.includes(item.id)) return { ok: false, reason: "ALREADY_PRESENT" };

    container.contains.push(item.id);
    saveArtifacts(artifacts);

    return { ok: true };
  },

  moveToContainer(containerId, artifactId) {
    const artifacts = loadArtifacts();

    const target = artifacts.find(x => x.id === containerId);
    const item = artifacts.find(x => x.id === artifactId);

    if (!target || !isContainer(target)) return { ok: false, reason: "NOT_A_CONTAINER" };
    if (!item) return { ok: false, reason: "MISSING_ITEM" };

    // v1: no nested containers
    if (isContainer(item)) return { ok: false, reason: "NO_NESTED_CONTAINERS" };

    // no self reference
    if (target.id === item.id) return { ok: false, reason: "SELF_REFERENCE" };

    // Ensure contains arrays exist and enforce single-home:
    // remove the artifact from every other container before adding to target
    for (const c of artifacts) {
      if (!isContainer(c)) continue;
      if (!Array.isArray(c.contains)) c.contains = [];
      const idx = c.contains.indexOf(item.id);
      if (idx !== -1 && c.id !== target.id) {
        c.contains.splice(idx, 1);
      }
    }

    if (!Array.isArray(target.contains)) target.contains = [];

    const alreadyPresent = target.contains.includes(item.id);
    if (!alreadyPresent) {
      target.contains.push(item.id);
    }

    saveArtifacts(artifacts);
    return { ok: true, alreadyPresent };
  },

  updateState(id, state) {
    const artifacts = loadArtifacts();
    const a = artifacts.find(x => x.id === id);
    if (a) {
      a.state = state;
      saveArtifacts(artifacts);
    }
  },

  updateSpineLabel(id, spineLabel) {
    const cleaned = String(spineLabel || "").trim();
    if (!cleaned) return false;

    const artifacts = loadArtifacts();
    const a = artifacts.find(x => x.id === id);
    if (!a) return false;

    a.spineLabel = cleaned;
    saveArtifacts(artifacts);
    return true;
  }
};
