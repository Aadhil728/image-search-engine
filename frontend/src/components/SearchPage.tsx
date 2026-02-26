"use client";

import { useState, useRef } from "react";
import Image from "next/image";
import {
  searchSimilarImages,
  SearchResponse,
  SearchStatus,
  getSearchStatus,
} from "@/lib/api";
import styles from "@/styles/Search.module.css";

// Convert internal Docker URLs to localhost URLs for browser access
const fixImageUrl = (url: string | undefined): string => {
  if (!url) return "";
  // Replace internal minio hostname with localhost
  return url.replace("http://minio:9000", "http://localhost:9000");
};

export default function SearchPage() {
  const [queryImage, setQueryImage] = useState<File | null>(null);
  const [queryPreview, setQueryPreview] = useState<string>("");
  const [results, setResults] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const [topK, setTopK] = useState(5);
  const [threshold, setThreshold] = useState(0.5);
  const [status, setStatus] = useState<SearchStatus | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load search status on mount
  const loadStatus = async () => {
    try {
      const s = await getSearchStatus();
      setStatus(s);
    } catch (err) {
      console.error("Failed to load search status:", err);
    }
  };

  // Handle file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Check file type
      if (!file.type.startsWith("image/")) {
        setError("Please select an image file");
        return;
      }

      // Check file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        setError("File size must be less than 10MB");
        return;
      }

      setQueryImage(file);
      setError("");

      // Preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setQueryPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Perform search
  const handleSearch = async () => {
    if (!queryImage) {
      setError("Please select an image");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await searchSimilarImages(queryImage, topK, threshold);
      setResults(response);

      if (response.results_count === 0) {
        setError(
          "No similar products found. Try adjusting the threshold or uploading more products.",
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
    } finally {
      setLoading(false);
    }
  };

  // Clear search
  const handleClear = () => {
    setQueryImage(null);
    setQueryPreview("");
    setResults(null);
    setError("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.titleBlock}>
          <Image
            src="/nabco.png"
            alt="Nabco Furniture"
            width={200}
            height={65}
            className={styles.headerLogo}
            priority
          />
          <h1 className={styles.title}>
            Furniture Image Search for Nabco Furniture
          </h1>
          <p className={styles.subtitle}>
            Nabco Furniture Image Search uses visual recognition to instantly
            match similar furniture designs from our catalog — streamlining
            organization, style comparison, and product discovery.
          </p>
        </div>

        {/* Model Status */}
        {status && (
          <div className={styles.statusCard}>
            <div className={styles.statusItem}>
              <span className={styles.statusLabel}>Model:</span>
              <span className={styles.statusValue}>{status.model}</span>
            </div>
            <div className={styles.statusItem}>
              <span className={styles.statusLabel}>Dimension:</span>
              <span className={styles.statusValue}>
                {status.vector_dimension}D
              </span>
            </div>
            <div className={styles.statusItem}>
              <span className={styles.statusLabel}>Device:</span>
              <span className={styles.statusValue}>{status.device}</span>
            </div>
          </div>
        )}
      </div>

      <div className={styles.content}>
        {/* Upload Section */}
        <div className={styles.uploadSection}>
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

            {queryPreview ? (
              <div className={styles.previewContainer}>
                <img
                  src={queryPreview}
                  alt="Query"
                  className={styles.preview}
                />
                <p className={styles.fileName}>{queryImage?.name}</p>
              </div>
            ) : (
              <div className={styles.uploadPrompt}>
                <div className={styles.uploadIcon}>📤</div>
                <p className={styles.uploadText}>Drag and drop an image here</p>
                <p className={styles.uploadSubtext}>or click to browse</p>
              </div>
            )}
          </div>

          {/* Controls */}
          <div className={styles.controls}>
            <div className={styles.controlGroup}>
              <label className={styles.label}>
                Top Results: <span className={styles.value}>{topK}</span>
              </label>
              <input
                type="range"
                min="1"
                max="20"
                value={topK}
                onChange={(e) => setTopK(parseInt(e.target.value))}
                className={styles.slider}
              />
            </div>

            <div className={styles.controlGroup}>
              <label className={styles.label}>
                Similarity Threshold:{" "}
                <span className={styles.value}>
                  {(threshold * 100).toFixed(0)}%
                </span>
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={threshold}
                onChange={(e) => setThreshold(parseFloat(e.target.value))}
                className={styles.slider}
              />
            </div>
          </div>

          {/* Buttons */}
          <div className={styles.buttonGroup}>
            <button
              className={`${styles.button} ${styles.searchButton}`}
              onClick={handleSearch}
              disabled={!queryImage || loading}
            >
              {loading ? <><span className="material-symbols-outlined">sync</span> Searching...</> : <><span className="material-symbols-outlined">search</span> Search</>}
            </button>
            {queryImage && (
              <button
                className={`${styles.button} ${styles.clearButton}`}
                onClick={handleClear}
              >
                <span className="material-symbols-outlined">close</span> Clear
              </button>
            )}
          </div>

          {error && <div className={styles.error}><span className="material-symbols-outlined">warning</span> {error}</div>}
        </div>

        {/* Results Section */}
        {results && (
          <div className={styles.resultsSection}>
            <div className={styles.resultsHeader}>
              <h2 className={styles.resultsTitle}>
                Similar Products ({results.results_count} found)
              </h2>
              <p className={styles.resultsInfo}>
                Threshold: {(threshold * 100).toFixed(0)}% | Query ID:{" "}
                {results.embedding_dimension}D
              </p>
            </div>

            {results.results_count === 0 ? (
              <div className={styles.noResults}>
                <p>No similar products found</p>
                <p className={styles.noResultsHint}>
                  Try adjusting the threshold or uploading more products
                </p>
              </div>
            ) : (
              <div className={styles.resultsGrid}>
                {results.results.map((result, index) => (
                  <div key={result.id} className={styles.resultCard}>
                    <div className={styles.resultRank}>#{index + 1}</div>

                    {result.s3_url && (
                      <div className={styles.imageContainer}>
                        <img
                          src={fixImageUrl(result.s3_url)}
                          alt={result.filename}
                          className={styles.resultImage}
                        />
                      </div>
                    )}

                    <div className={styles.resultContent}>
                      {result.product_name && (
                        <p className={styles.productName}>
                          {result.product_name}
                        </p>
                      )}
                      {result.brand && (
                        <p className={styles.brand}>Brand: {result.brand}</p>
                      )}
                      {result.sku && (
                        <p className={styles.sku}>SKU: {result.sku}</p>
                      )}

                      <div className={styles.scoreBar}>
                        <div
                          className={styles.scoreBarFill}
                          style={{
                            width: `${Math.min(result.similarity_score * 100, 100)}%`,
                          }}
                        />
                      </div>
                      <p className={styles.similarity}>
                        Similarity:{" "}
                        <span className={styles.score}>
                          {(result.similarity_score * 100).toFixed(1)}%
                        </span>
                      </p>

                      {result.price && (
                        <p className={styles.price}>
                          ${result.price.toFixed(2)}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
