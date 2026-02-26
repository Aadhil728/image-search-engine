const fileInput = document.getElementById("fileInput");
const fileLabel = document.getElementById("fileLabel");

const btnSearch = document.getElementById("btnSearch");
const btnClear = document.getElementById("btnClear");

const topkInput = document.getElementById("topkInput");
const thresholdInput = document.getElementById("thresholdInput");

const statusDiv = document.getElementById("status");
const resultsDiv = document.getElementById("results");
const emptyState = document.getElementById("emptyState");

const queryPreview = document.getElementById("queryPreview");
const indexedVal = document.getElementById("indexedVal");

const DEFAULT_TOPK = 10000;
const DEFAULT_THRESHOLD = 0.8;

function setStatus(text) {
  statusDiv.textContent = text;
}

function showEmptyState(show) {
  emptyState.style.display = show ? "block" : "none";
}

function clearResults() {
  resultsDiv.innerHTML = "";
  showEmptyState(false);
}

function clearQueryPreview() {
  queryPreview.src = "";
  queryPreview.style.display = "none";
}

function setFileLabel(text) {
  fileLabel.textContent = text;
}

function renderResults(items) {
  clearResults();

  if (!items || items.length === 0) {
    showEmptyState(true);
    return;
  }

  showEmptyState(false);

  items.forEach((it) => {
    const card = document.createElement("div");
    card.className = "result-card";

    const img = document.createElement("img");
    img.className = "result-img";
    img.src = it.url; // must be a valid URL from backend
    img.alt = it.filename || "match";

    const meta = document.createElement("div");
    meta.className = "result-meta";

    const left = document.createElement("div");
    left.textContent = it.filename || "";

    const right = document.createElement("div");
    right.className = "score";
    const pct = Number(it.score) * 100;
    right.textContent = `Score ${isFinite(pct) ? pct.toFixed(1) : "0.0"}%`;

    meta.appendChild(left);
    meta.appendChild(right);

    card.appendChild(img);
    card.appendChild(meta);

    resultsDiv.appendChild(card);
  });
}

function clearUI({ resetInputs = true } = {}) {
  // Clear file input
  fileInput.value = "";
  setFileLabel("Choose an image...");

  // Reset inputs (optional)
  if (resetInputs) {
    topkInput.value = DEFAULT_TOPK;
    thresholdInput.value = DEFAULT_THRESHOLD.toFixed(2);
  }

  indexedVal.textContent = "-";
  setStatus("Choose an image to search.");

  clearQueryPreview();
  clearResults();
  showEmptyState(false);
}

fileInput.addEventListener("change", () => {
  const file = fileInput.files?.[0];
  if (!file) {
    setFileLabel("Choose an image...");
    clearQueryPreview();
    return;
  }

  // filename label
  setFileLabel(file.name);

  // show query preview immediately
  const url = URL.createObjectURL(file);
  queryPreview.src = url;
  queryPreview.style.display = "block";

  // clear old results when a new file is selected
  clearResults();
  showEmptyState(false);
  setStatus('Ready. Click "Find matches".');
});

btnClear.addEventListener("click", () => {
  clearUI({ resetInputs: false }); // keep Top-K & Threshold
});

btnSearch.addEventListener("click", async () => {
  const file = fileInput.files?.[0];
  if (!file) {
    setStatus("Please choose an image first.");
    return;
  }

  const topk = Number(topkInput.value || DEFAULT_TOPK);
  const threshold = Number(thresholdInput.value || DEFAULT_THRESHOLD);

  const form = new FormData();
  form.append("file", file); // MUST match FastAPI parameter name

  btnSearch.disabled = true;
  btnClear.disabled = true;
  setStatus("Searching...");
  clearResults();
  showEmptyState(false);

  try {
    const url = `/search?top_k=${encodeURIComponent(
      topk
    )}&threshold=${encodeURIComponent(threshold)}`;

    const res = await fetch(url, { method: "POST", body: form });

    if (!res.ok) {
      const txt = await res.text();
      throw new Error(txt);
    }

    const data = await res.json();

    indexedVal.textContent = data.indexed ?? "-";
    const count = data.results?.length ?? 0;

    setStatus(`Found ${count} matches`);
    renderResults(data.results || []);
  } catch (err) {
    setStatus("Error: " + (err?.message || err));
    showEmptyState(true);
  } finally {
    btnSearch.disabled = false;
    btnClear.disabled = false;
  }
});

// initial state
clearUI({ resetInputs: true });
