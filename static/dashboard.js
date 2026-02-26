document.addEventListener("DOMContentLoaded", async () => {
  async function fetchKPIs() {
    try {
      const res = await fetch("/api/admin/kpis");
      return await res.json();
    } catch (e) {
      return null;
    }
  }

  async function fetchRecent() {
    try {
      const res = await fetch("/api/admin/recent-uploads?limit=10");
      const j = await res.json();
      return j.recent || [];
    } catch (e) {
      return [];
    }
  }

  const k = await fetchKPIs();
  if (k) {
    document.querySelector("#kpi-total .kpi-value").textContent =
      k.total_products ?? "—";
    document.querySelector("#kpi-indexed .kpi-value").textContent =
      k.indexed ?? "—";
    document.querySelector("#kpi-recent .kpi-value").textContent =
      k.recent_uploads_7d ?? "—";
    document.querySelector("#kpi-avg .kpi-value").textContent = k.avg_query_time
      ? `${k.avg_query_time} ms`
      : "—";
  }

  const recent = await fetchRecent();
  const tbody = document.getElementById("recent-body");
  tbody.innerHTML = "";
  for (const r of recent) {
    const tr = document.createElement("tr");
    const tdPreview = document.createElement("td");
    const img = document.createElement("img");
    img.src = `/image/${r.filename}`;
    img.onerror = () => {
      img.src = "/static/no-image.png";
    };
    tdPreview.appendChild(img);
    tr.appendChild(tdPreview);

    const tdSku = document.createElement("td");
    tdSku.textContent = r.sku || "";
    tr.appendChild(tdSku);
    const tdBrand = document.createElement("td");
    tdBrand.textContent = r.brand || "";
    tr.appendChild(tdBrand);
    const tdName = document.createElement("td");
    tdName.textContent = r.name || "";
    tr.appendChild(tdName);
    const tdDate = document.createElement("td");
    tdDate.textContent = r.created_at
      ? new Date(r.created_at).toLocaleString()
      : "";
    tr.appendChild(tdDate);

    tbody.appendChild(tr);
  }

  document
    .getElementById("rebuild-index-btn")
    .addEventListener("click", async () => {
      const btn = document.getElementById("rebuild-index-btn");
      btn.disabled = true;
      btn.textContent = "Rebuilding...";
      try {
        const r = await fetch("/reindex", { method: "POST" });
        const j = await r.json();
        alert(`Reindexed: ${j.indexed} images`);
        location.reload();
      } catch (e) {
        alert("Reindex failed");
      }
      btn.disabled = false;
      btn.textContent = "Rebuild Index";
    });
});
