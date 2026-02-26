// Toast Notification System
function initToastContainer() {
  if (!document.querySelector(".toast-container")) {
    const container = document.createElement("div");
    container.className = "toast-container";
    document.body.appendChild(container);
  }
}

function showToast(message, type = "info", duration = 4000) {
  initToastContainer();
  const container = document.querySelector(".toast-container");
  const icons = { success: "✓", error: "✕", warning: "⚠", info: "ℹ" };

  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <span class="toast-icon">${icons[type]}</span>
    <span class="toast-message">${message}</span>
    <button class="toast-close">&times;</button>
  `;

  const closeBtn = toast.querySelector(".toast-close");
  closeBtn.onclick = () => removeToast(toast);

  container.appendChild(toast);

  if (duration > 0) {
    setTimeout(() => removeToast(toast), duration);
  }

  return toast;
}

function removeToast(toast) {
  toast.classList.add("closing");
  setTimeout(() => toast.remove(), 300);
}

function showConfirmToast(message, onConfirm, onCancel) {
  initToastContainer();
  const container = document.querySelector(".toast-container");

  const toast = document.createElement("div");
  toast.className = "toast warning";
  toast.innerHTML = `
    <span class="toast-icon">⚠</span>
    <div style="flex: 1;">
      <div class="toast-message">${message}</div>
      <div class="toast-confirm-btns">
        <button class="btn-yes">Delete</button>
        <button class="btn-no">Cancel</button>
      </div>
    </div>
  `;

  const btnYes = toast.querySelector(".btn-yes");
  const btnNo = toast.querySelector(".btn-no");

  btnYes.onclick = () => {
    removeToast(toast);
    onConfirm();
  };

  btnNo.onclick = () => {
    removeToast(toast);
    if (onCancel) onCancel();
  };

  container.appendChild(toast);
}

// Pagination state
let allFiles = [];
let currentPage = 1;
let totalItems = 0;
let itemsPerPage = 25;
let isLoading = false;
let selectedFiles = new Set(); // Track selected files

async function loadImages() {
  if (isLoading) return;
  isLoading = true;
  try {
    const q = document.getElementById("product-search").value || "";
    const brand = document.getElementById("filter-brand").value || "";
    const sku = document.getElementById("filter-sku").value || "";
    itemsPerPage = parseInt(
      document.getElementById("per-page").value || "25",
      10,
    );

    const url = new URL(window.location.origin + "/api/admin/products");
    url.searchParams.set("page", currentPage);
    url.searchParams.set("per_page", itemsPerPage);
    if (q) url.searchParams.set("q", q);
    if (brand) url.searchParams.set("brand", brand);
    if (sku) url.searchParams.set("sku", sku);

    const res = await fetch(url.href);
    const data = await res.json();
    allFiles = data.items || [];
    totalItems = data.total || 0;

    const info = document.getElementById("images-info");
    info.textContent = `Indexed: ${data.indexed ?? "-"} — ${totalItems} total files`;

    // Reset selection for current page
    selectedFiles.clear();
    document.getElementById("select-all-checkbox").checked = false;
    renderPage();
    updatePaginationControls();
    updateDeleteButton();
  } catch (err) {
    console.error("Error loading products:", err);
  } finally {
    isLoading = false;
  }
}

function updateDeleteButton() {
  const deleteBtn = document.getElementById("delete-selected-btn");
  if (selectedFiles.size > 0) {
    deleteBtn.style.display = "inline-block";
    deleteBtn.textContent = `Delete Selected (${selectedFiles.size})`;
  } else {
    deleteBtn.style.display = "none";
  }
}

function renderPage() {
  const start = (currentPage - 1) * itemsPerPage;
  const end = start + itemsPerPage;
  const pageFiles = allFiles.slice(start, end);

  const tbody = document.querySelector("#images-table tbody");
  tbody.innerHTML = "";

  if (pageFiles.length === 0) {
    tbody.innerHTML =
      '<tr><td colspan="4" style="text-align: center; padding: 2rem; color: #94a3b8;">No images to display</td></tr>';
    return;
  }

  const pageFiles = allFiles; // server already returned the current page
  pageFiles.forEach((f) => {
    // f may be a string (legacy) or object with metadata
    const filename = typeof f === "string" ? f : f.filename;
    const tr = document.createElement("tr");

    // Checkbox column
    const tdCheckbox = document.createElement("td");
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = selectedFiles.has(filename);
    checkbox.onchange = () => {
      if (checkbox.checked) {
        selectedFiles.add(filename);
      } else {
        selectedFiles.delete(filename);
      }
      updateDeleteButton();
    };
    tdCheckbox.appendChild(checkbox);

    const tdPreview = document.createElement("td");
    const img = document.createElement("img");
    img.src = `/image/${filename}`;
    img.style.height = "64px";
    tdPreview.appendChild(img);

    const tdSku = document.createElement("td");
    tdSku.textContent = (typeof f === "string" ? "" : f.sku) || "";

    const tdBrand = document.createElement("td");
    tdBrand.textContent = (typeof f === "string" ? "" : f.brand) || "";

    const tdProdName = document.createElement("td");
    tdProdName.textContent = (typeof f === "string" ? "" : f.name) || "";

    const tdDate = document.createElement("td");
    tdDate.textContent = (typeof f === "string" ? "" : f.date) || "";

    const tdName = document.createElement("td");
    tdName.textContent = filename;

    const tdActions = document.createElement("td");
    const editBtn = document.createElement("button");
    editBtn.textContent = "Edit";
    editBtn.onclick = async () => {
      // simple prompt-based editor
      const newSku = prompt("SKU", f.sku || "") || "";
      const newBrand = prompt("Brand", f.brand || "") || "";
      const newName = prompt("Product Name", f.name || "") || "";
      const newDate = prompt("Date (YYYY-MM-DD)", f.date || "") || "";
      const newPrice = prompt("Price", f.price || "") || "";
      const newDesc = prompt("Description", f.description || "") || "";
      const payload = {
        sku: newSku || null,
        brand: newBrand || null,
        name: newName || null,
        date: newDate || null,
        price: newPrice || null,
        description: newDesc || null,
      };
      try {
        const r = await fetch(
          `/api/admin/product/${encodeURIComponent(filename)}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          },
        );
        const j = await r.json();
        if (j.ok) {
          showToast("Saved", "success");
          await loadImages();
        } else {
          showToast("Save failed", "error");
        }
      } catch (e) {
        showToast("Save failed", "error");
      }
    };
    const delBtn = document.createElement("button");
    delBtn.textContent = "Delete";
    delBtn.onclick = () => deleteFiles([filename]);
    tdActions.appendChild(editBtn);
    tdActions.appendChild(delBtn);

    tr.appendChild(tdCheckbox);
    tr.appendChild(tdPreview);
    tr.appendChild(tdSku);
    tr.appendChild(tdBrand);
    tr.appendChild(tdProdName);
    tr.appendChild(tdDate);
    tr.appendChild(tdName);
    tr.appendChild(tdActions);
    tbody.appendChild(tr);
  });
}

function updatePaginationControls() {
  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
  const paginationDiv = document.getElementById("pagination-controls");

  if (totalPages <= 1) {
    paginationDiv.innerHTML = "";
    return;
  }

  let html = '<div class="pagination">';
  html += `<button class="pagination-btn" onclick="goToPage(1)" ${
    currentPage === 1 ? "disabled" : ""
  }>« First</button>`;
  html += `<button class="pagination-btn" onclick="goToPage(${
    currentPage - 1
  })" ${currentPage === 1 ? "disabled" : ""}>‹ Prev</button>`;

  // Page info
  html += `<span class="pagination-info">Page <strong>${currentPage}</strong> of <strong>${totalPages}</strong></span>`;

  html += `<button class="pagination-btn" onclick="goToPage(${
    currentPage + 1
  })" ${currentPage === totalPages ? "disabled" : ""}>Next ›</button>`;
  html += `<button class="pagination-btn" onclick="goToPage(${totalPages})" ${
    currentPage === totalPages ? "disabled" : ""
  }>Last »</button>`;
  html += "</div>";

  paginationDiv.innerHTML = html;
}

function goToPage(page) {
  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
  if (page >= 1 && page <= totalPages) {
    currentPage = page;
    loadImages();
    document
      .querySelector("#images-table")
      .scrollIntoView({ behavior: "smooth" });
  }
}

async function uploadFiles(files) {
  if (isLoading) return;

  const loadingToast = showToast(
    `⏳ Uploading ${files.length} file(s)...`,
    "info",
    0,
  );
  isLoading = true;

  try {
    const form = new FormData();
    for (const f of files) form.append("files", f);

    // include optional metadata fields (applies to all files)
    const sku = document.getElementById("meta-sku").value;
    const brand = document.getElementById("meta-brand").value;
    const name = document.getElementById("meta-name").value;
    const date = document.getElementById("meta-date").value;
    const price = document.getElementById("meta-price").value;
    const description = document.getElementById("meta-description").value;

    if (sku) form.append("sku", sku);
    if (brand) form.append("brand", brand);
    if (name) form.append("name", name);
    if (date) form.append("date", date);
    if (price) form.append("price", price);
    if (description) form.append("description", description);

    const res = await fetch("/admin/upload", { method: "POST", body: form });
    const data = await res.json();

    removeToast(loadingToast);
    showToast(`✓ Uploaded: ${data.saved.length} file(s)`, "success");

    await loadImages();
  } catch (err) {
    removeToast(loadingToast);
    showToast("Upload failed: " + err.message, "error");
  } finally {
    isLoading = false;
  }
}

async function deleteFiles(files) {
  showConfirmToast(`Delete ${files.length} file(s)?`, async () => {
    if (isLoading) return;

    const loadingToast = showToast(
      `⏳ Deleting ${files.length} file(s)...`,
      "info",
      0,
    );
    isLoading = true;

    try {
      const res = await fetch("/admin/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filenames: files }),
      });
      const data = await res.json();

      removeToast(loadingToast);

      if (data.removed && data.removed.length) {
        showToast(`✓ Deleted: ${data.removed.length} file(s)`, "success");
      }
      if (data.errors && Object.keys(data.errors).length) {
        showToast(`⚠ Some errors occurred`, "warning");
      }

      // Clear selections
      files.forEach((f) => selectedFiles.delete(f));

      await loadImages();
    } catch (err) {
      removeToast(loadingToast);
      showToast("Delete failed: " + err.message, "error");
    } finally {
      isLoading = false;
    }
  });
}

document.addEventListener("DOMContentLoaded", () => {
  loadImages();

  // Select All checkbox
  const selectAllCheckbox = document.getElementById("select-all-checkbox");
  selectAllCheckbox.addEventListener("change", () => {
    // server returns only current page in `allFiles`
    if (selectAllCheckbox.checked) {
      allFiles.forEach((f) => {
        const filename = typeof f === "string" ? f : f.filename;
        selectedFiles.add(filename);
      });
    } else {
      allFiles.forEach((f) => {
        const filename = typeof f === "string" ? f : f.filename;
        selectedFiles.delete(filename);
      });
    }
    renderPage();
    updateDeleteButton();
  });

  // Delete Selected button
  const deleteBtn = document.getElementById("delete-selected-btn");
  deleteBtn.addEventListener("click", () => {
    if (selectedFiles.size > 0) {
      deleteFiles(Array.from(selectedFiles));
    }
  });

  const form = document.getElementById("upload-form");
  if (form) {
    form.addEventListener("submit", (ev) => {
      ev.preventDefault();
    });
  }

  // Add Product button
  const addProductBtn = document.getElementById("add-product-btn");
  if (addProductBtn) {
    addProductBtn.addEventListener("click", () => {
      window.location.href = "/add-product";
    });
  }

  document.getElementById("reindex-btn").addEventListener("click", async () => {
    if (isLoading) return;
    const loadingToast = showToast("⏳ Rebuilding index...", "info", 0);
    isLoading = true;

    try {
      const r = await fetch("/reindex", { method: "POST" });
      const j = await r.json();
      removeToast(loadingToast);
      showToast(`✓ Reindexed: ${j.indexed} images`, "success");
      await loadImages();
    } catch (err) {
      removeToast(loadingToast);
      showToast("Reindex failed: " + err.message, "error");
    } finally {
      isLoading = false;
    }
  });
});
