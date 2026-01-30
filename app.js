const intakeText = document.getElementById("intakeText");
const preview = document.getElementById("preview");
const previewBtn = document.getElementById("previewBtn");
const acceptBtn = document.getElementById("acceptBtn");
const listEl = document.getElementById("artifactList");
const detailEl = document.getElementById("artifactDetail");
const freezeBtn = document.getElementById("freezeBtn");
const abandonBtn = document.getElementById("abandonBtn");

let selectedId = null;

function renderList() {
  listEl.innerHTML = "";
  VAULT.list().forEach(a => {
    const li = document.createElement("li");
    li.textContent = `${a.createdAt} — ${a.state}`;
    li.onclick = () => {
      selectedId = a.id;
      detailEl.textContent = a.raw;
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
