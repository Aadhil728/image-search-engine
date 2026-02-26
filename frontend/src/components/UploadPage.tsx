"use client";

import { useState, useRef } from "react";
import { uploadProduct, UploadResponse } from "@/lib/api";
import styles from "@/styles/Upload.module.css";

export default function UploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const [success, setSuccess] = useState<UploadResponse | null>(null);

  // Form fields
  const [sku, setSku] = useState("");
  const [brand, setBrand] = useState("");
  const [productName, setProductName] = useState("");
  const [productDate, setProductDate] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState<number | "">();

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handle file change
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) {
      if (!f.type.startsWith("image/")) {
        setError("Please select an image file");
        return;
      }

      if (f.size > 10 * 1024 * 1024) {
        setError("File size must be less than 10MB");
        return;
      }

      setFile(f);
      setError("");

      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result as string);
      };
      reader.readAsDataURL(f);
    }
  };

  // Handle upload
  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!file) {
      setError("Please select an image");
      return;
    }

    setLoading(true);
    setError("");
    setSuccess(null);

    try {
      const response = await uploadProduct(file, {
        sku: sku || undefined,
        brand: brand || undefined,
        product_name: productName || undefined,
        product_date: productDate || undefined,
        description: description || undefined,
        price: price ? Number(price) : undefined,
      });

      setSuccess(response);

      // Reset form
      setFile(null);
      setPreview("");
      setSku("");
      setBrand("");
      setProductName("");
      setProductDate("");
      setDescription("");
      setPrice("");
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Upload failed";
      console.error("Upload error:", err);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setFile(null);
    setPreview("");
    setSku("");
    setBrand("");
    setProductName("");
    setProductDate("");
    setDescription("");
    setPrice("");
    setSuccess(null);
    setError("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <h1 className={styles.title}>📤 Upload Product</h1>
        <p className={styles.subtitle}>
          Add new product images to the search index
        </p>
      </div>

      <div className={styles.content}>
        {/* Upload Form */}
        <form onSubmit={handleUpload} className={styles.form}>
          {/* Image Upload */}
          <div className={styles.formGroup}>
            <label className={styles.label}>Product Image *</label>
            <div
              className={styles.dropZone}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                e.currentTarget.classList.add(styles.dragActive);
              }}
              onDragLeave={(e) => {
                e.currentTarget.classList.remove(styles.dragActive);
              }}
              onDrop={(e) => {
                e.preventDefault();
                e.currentTarget.classList.remove(styles.dragActive);
                const files = e.dataTransfer.files;
                if (files.length > 0) {
                  const event = {
                    target: { files },
                  } as unknown as React.ChangeEvent<HTMLInputElement>;
                  handleFileChange(event);
                }
              }}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                style={{ display: "none" }}
              />

              {preview ? (
                <div className={styles.previewContainer}>
                  <img src={preview} alt="Preview" className={styles.preview} />
                  <p className={styles.uploadedFile}>{file?.name}</p>
                </div>
              ) : (
                <div className={styles.uploadPrompt}>
                  <div style={{ fontSize: "2.5rem" }}>🖼️</div>
                  <p>Drag image here or click to browse</p>
                </div>
              )}
            </div>
          </div>

          {/* Product Details */}
          <div className={styles.detailsGrid}>
            <div className={styles.formGroup}>
              <label className={styles.label}>Product Name</label>
              <input
                type="text"
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                placeholder="e.g., Summer Dress"
                className={styles.input}
              />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>Brand</label>
              <input
                type="text"
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                placeholder="e.g., ACME"
                className={styles.input}
              />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>SKU</label>
              <input
                type="text"
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                placeholder="e.g., SKU-12345"
                className={styles.input}
              />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>Price ($)</label>
              <input
                type="number"
                value={price}
                onChange={(e) =>
                  setPrice(e.target.value ? parseFloat(e.target.value) : "")
                }
                placeholder="99.99"
                step="0.01"
                min="0"
                className={styles.input}
              />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>Product Date</label>
              <input
                type="date"
                value={productDate}
                onChange={(e) => setProductDate(e.target.value)}
                className={styles.input}
              />
            </div>
          </div>

          {/* Description */}
          <div className={styles.formGroup}>
            <label className={styles.label}>Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Product description..."
              rows={4}
              className={styles.textarea}
            />
          </div>

          {/* Error */}
          {error && <div className={styles.error}>⚠️ {error}</div>}

          {/* Success */}
          {success && (
            <div className={styles.success}>
              ✅ Product uploaded successfully!
              <p className={styles.successDetails}>
                Embedding computed:{" "}
                {success.product.embedding_computed ? "Yes" : "No"} | Dimension:{" "}
                {success.product.embedding_dimension}D
              </p>
            </div>
          )}

          {/* Buttons */}
          <div className={styles.buttonGroup}>
            <button
              type="submit"
              className={`${styles.button} ${styles.uploadBtn}`}
              disabled={!file || loading}
            >
              {loading ? <><span className="material-symbols-outlined">hourglass_empty</span> Uploading...</> : <><span className="material-symbols-outlined">upload</span> Upload Product</>}
            </button>
            {file && (
              <button
                type="button"
                className={`${styles.button} ${styles.clearBtn}`}
                onClick={handleClear}
              >
                <span className="material-symbols-outlined">close</span> Clear
              </button>
            )}
          </div>
        </form>

        {/* Info Panel */}
        <div className={styles.infoPanel}>
          <h3 className={styles.infoPanelTitle}><span className="material-symbols-outlined">info</span> Upload Information</h3>

          <div className={styles.infoSection}>
            <h4>Supported Formats</h4>
            <p>JPEG, PNG, WebP, GIF</p>
          </div>

          <div className={styles.infoSection}>
            <h4>File Size</h4>
            <p>Maximum 10MB</p>
          </div>

          <div className={styles.infoSection}>
            <h4>What Happens</h4>
            <ul>
              <li>Image uploaded to MinIO S3 storage</li>
              <li>CLIP model computes 512-dim embedding</li>
              <li>Embedding stored in pgvector database</li>
              <li>Product indexed for similarity search</li>
            </ul>
          </div>

          <div className={styles.infoSection}>
            <h4>Features</h4>
            <ul>
              <li>Automatic embedding generation</li>
              <li>Semantic similarity search</li>
              <li>Metadata indexing</li>
              <li>Full-text search support</li>
            </ul>
          </div>

          <div className={styles.infoSection}>
            <h4>Performance</h4>
            <ul>
              <li>Upload: ~1-2 seconds</li>
              <li>Embedding: ~1-2 seconds</li>
              <li>Search: ~100-500ms</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
