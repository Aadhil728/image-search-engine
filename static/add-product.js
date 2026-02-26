// Add Product Page - File uploads and form handling

let selectedFiles = [];

document.addEventListener("DOMContentLoaded", () => {
  const dropZone = document.getElementById("drop-zone");
  const fileInput = document.getElementById("file-input");
  const filePreview = document.getElementById("file-preview");
  const addProductForm = document.getElementById("add-product-form");

  // Click to open file picker
  dropZone.addEventListener("click", () => {
    fileInput.click();
  });

  // Handle file selection from input
  fileInput.addEventListener("change", (e) => {
    handleFiles(e.target.files);
  });

  // Drag and drop
  dropZone.addEventListener("dragover", (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropZone.classList.add("drag-over");
  });

  dropZone.addEventListener("dragleave", (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropZone.classList.remove("drag-over");
  });

  dropZone.addEventListener("drop", (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropZone.classList.remove("drag-over");
    handleFiles(e.dataTransfer.files);
  });

  // Handle form submission
  addProductForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    if (selectedFiles.length === 0) {
      alert("Please select at least one image");
      return;
    }

    const submitBtn = addProductForm.querySelector("button[type='submit']");
    const originalText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.innerHTML =
      '<span class="loading"><span class="spinner"></span> Uploading...</span>';

    try {
      // Create FormData
      const formData = new FormData();

      // Add all selected files
      for (const file of selectedFiles) {
        formData.append("files", file);
      }

      // Add metadata
      formData.append("sku", document.getElementById("sku").value);
      formData.append("brand", document.getElementById("brand").value);
      formData.append("name", document.getElementById("product-name").value);
      formData.append("date", document.getElementById("product-date").value);
      formData.append("price", document.getElementById("price").value);
      formData.append(
        "description",
        document.getElementById("description").value,
      );

      // Send to backend
      const response = await fetch("/admin/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.statusText}`);
      }

      const result = await response.json();

      // Success - show message and redirect
      alert(
        `✅ Successfully uploaded ${result.saved.length} image(s)!\n\nTotal indexed: ${result.indexed}`,
      );

      // Redirect to admin page
      window.location.href = "/admin";
    } catch (error) {
      console.error("Upload error:", error);
      alert(`❌ Upload failed: ${error.message}`);
      submitBtn.disabled = false;
      submitBtn.textContent = originalText;
    }
  });

  function handleFiles(files) {
    selectedFiles = Array.from(files);
    updatePreview();
  }

  function updatePreview() {
    filePreview.innerHTML = "";

    selectedFiles.forEach((file, index) => {
      const reader = new FileReader();

      reader.onload = (e) => {
        const previewDiv = document.createElement("div");
        previewDiv.className = "preview-item";

        const img = document.createElement("img");
        img.src = e.target.result;

        const removeBtn = document.createElement("button");
        removeBtn.type = "button";
        removeBtn.className = "remove-btn";
        removeBtn.textContent = "✕";
        removeBtn.onclick = (evt) => {
          evt.preventDefault();
          selectedFiles.splice(index, 1);
          updatePreview();
        };

        previewDiv.appendChild(img);
        previewDiv.appendChild(removeBtn);
        filePreview.appendChild(previewDiv);
      };

      reader.readAsDataURL(file);
    });
  }
});
