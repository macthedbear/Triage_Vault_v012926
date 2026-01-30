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
      hash: payloadHash,
      raw
    };

    artifacts.push(record);
    saveArtifacts(artifacts);

    return { record, duplicate };
  },
  updateState(id, state) {
    const artifacts = loadArtifacts();
    const a = artifacts.find(x => x.id === id);
    if (a) {
      a.state = state;
      saveArtifacts(artifacts);
    }
  }
};
