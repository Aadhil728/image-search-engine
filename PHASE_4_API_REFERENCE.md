# Phase 4 Frontend API Reference

## Table of Contents

1. [API Client Library](#api-client-library)
2. [Search API](#search-api)
3. [Upload API](#upload-api)
4. [Product Management API](#product-management-api)
5. [System Status API](#system-status-api)
6. [Component API](#component-api)
7. [Type Definitions](#type-definitions)
8. [Error Handling](#error-handling)
9. [Examples](#examples)

---

## API Client Library

**Location**: `src/lib/api.ts`

### Configuration

```tsx
const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

// All requests target this backend
// Configure via environment: NEXT_PUBLIC_API_BASE_URL
```

### Initialization

```tsx
import {
  searchSimilarImages,
  uploadProduct,
  getSearchStatus,
  listProducts,
  getProduct,
  deleteProduct,
  getAdminStats,
} from "@/lib/api";

// All functions ready to use
// No initialization required
```

---

## Search API

### searchSimilarImages()

Performs semantic image search using CLIP embeddings and pgvector.

```tsx
searchSimilarImages(
  file: File,
  topK?: number,
  threshold?: number
): Promise<SearchResponse>
```

**Parameters**:

| Parameter   | Type   | Default  | Description                                    |
| ----------- | ------ | -------- | ---------------------------------------------- |
| `file`      | File   | Required | Image file to search (.jpg, .png, .webp, etc.) |
| `topK`      | number | 5        | Maximum results to return (1-20)               |
| `threshold` | number | 0.5      | Minimum similarity score (0.0-1.0)             |

**Returns**: Promise<SearchResponse>

**Response Format**:

```tsx
interface SearchResponse {
  query_embedding: number[]; // 512-dimensional vector
  results: SearchResult[]; // Array of matching products
  search_time_ms: number; // Query execution time
}

interface SearchResult {
  rank: number; // 1-based ranking
  product_id: string; // Unique product identifier
  filename: string; // Image filename in storage
  similarity_score: number; // Cosine similarity (0-1)
  metadata: ProductMetadata; // Product information
  image_url: string; // Path to image in MinIO
}

interface ProductMetadata {
  name: string; // Product name
  brand: string; // Brand name
  sku: string; // Stock keeping unit
  price: number; // Price in USD
  date_added: string; // ISO 8601 date
  description: string; // Product description
}
```

**Example**:

```tsx
import { searchSimilarImages } from "@/lib/api";

async function handleSearch(imageFile: File) {
  try {
    const response = await searchSimilarImages(
      imageFile,
      (topK = 10),
      (threshold = 0.6),
    );

    console.log(`Found ${response.results.length} results`);
    console.log(`Search took ${response.search_time_ms}ms`);

    response.results.forEach((result) => {
      console.log(`${result.rank}. ${result.metadata.name}`);
      console.log(`   Score: ${(result.similarity_score * 100).toFixed(1)}%`);
    });
  } catch (error) {
    console.error("Search failed:", error);
  }
}
```

**Error Cases**:

```tsx
// File too large (>10 MB)
// Error: 413 Payload Too Large

// Invalid image format
// Error: 400 Bad Request - "Invalid image format"

// No products in database
// Returns: SearchResponse with empty results array

// Network timeout
// Error: NetworkError - "Connection timeout"
```

---

## Upload API

### uploadProduct()

Uploads product image and metadata. Automatically computes CLIP embedding.

```tsx
uploadProduct(
  file: File,
  metadata?: ProductMetadata
): Promise<UploadResponse>
```

**Parameters**:

| Parameter              | Type            | Default  | Description         |
| ---------------------- | --------------- | -------- | ------------------- |
| `file`                 | File            | Required | Product image file  |
| `metadata`             | ProductMetadata | Optional | Product information |
| `metadata.name`        | string          | ""       | Product name        |
| `metadata.brand`       | string          | ""       | Brand name          |
| `metadata.sku`         | string          | ""       | Stock keeping unit  |
| `metadata.price`       | number          | 0        | Price in USD        |
| `metadata.date_added`  | string          | Today    | ISO 8601 date       |
| `metadata.description` | string          | ""       | Product description |

**Returns**: Promise<UploadResponse>

**Response Format**:

```tsx
interface UploadResponse {
  product_id: string; // UUID of uploaded product
  filename: string; // Stored filename in S3
  metadata: ProductMetadata; // Echoed back metadata
  embedding_computed: boolean; // CLIP embedding success
  image_url: string; // URL to image in MinIO
  message: string; // Status message
}
```

**Example**:

```tsx
import { uploadProduct } from "@/lib/api";

async function handleUpload(imageFile: File, formData: ProductMetadata) {
  try {
    const response = await uploadProduct(imageFile, {
      name: formData.name,
      brand: formData.brand,
      sku: formData.sku,
      price: parseFloat(formData.price),
      date_added: formData.date_added,
      description: formData.description,
    });

    if (response.embedding_computed) {
      console.log(`✅ Product uploaded: ${response.product_id}`);
      console.log(`Image URL: ${response.image_url}`);
    } else {
      console.warn("⚠️ Upload successful but embedding computation pending");
    }
  } catch (error) {
    console.error("Upload failed:", error);
  }
}
```

**Error Cases**:

```tsx
// File too large (>10 MB)
// Error: 413 Payload Too Large - "File size exceeds 10 MB limit"

// Invalid image format
// Error: 400 Bad Request - "Only image files accepted"

// Storage error
// Error: 500 Internal Server Error - "S3 storage failed"

// Database error
// Error: 500 Internal Server Error - "Failed to save product"

// Network timeout
// Error: NetworkError - "Upload interrupted"
```

---

## Product Management API

### listProducts()

Lists all products with pagination.

```tsx
listProducts(
  limit?: number,
  offset?: number
): Promise<ListProductsResponse>
```

**Parameters**:

| Parameter | Type   | Default | Description       |
| --------- | ------ | ------- | ----------------- |
| `limit`   | number | 10      | Results per page  |
| `offset`  | number | 0       | Pagination offset |

**Returns**: Promise<ListProductsResponse>

**Response Format**:

```tsx
interface ListProductsResponse {
  products: Product[];
  total: number;
  limit: number;
  offset: number;
  has_more: boolean;
}

interface Product {
  product_id: string;
  filename: string;
  metadata: ProductMetadata;
  embedding: number[]; // 512-dim CLIP vector
  image_url: string;
  created_at: string;
  updated_at: string;
}
```

**Example**:

```tsx
import { listProducts } from "@/lib/api";

async function loadProducts() {
  try {
    const response = await listProducts((limit = 20), (offset = 0));
    console.log(
      `Showing ${response.products.length} of ${response.total} products`,
    );

    response.products.forEach((product) => {
      console.log(`${product.metadata.name} ($${product.metadata.price})`);
    });
  } catch (error) {
    console.error("Failed to load products:", error);
  }
}
```

### getProduct()

Retrieves single product details.

```tsx
getProduct(productId: string): Promise<Product>
```

**Parameters**:

| Parameter   | Type   | Description  |
| ----------- | ------ | ------------ |
| `productId` | string | Product UUID |

**Returns**: Promise<Product>

**Example**:

```tsx
import { getProduct } from "@/lib/api";

async function viewProduct(id: string) {
  try {
    const product = await getProduct(id);
    console.log(`${product.metadata.name}`);
    console.log(`SKU: ${product.metadata.sku}`);
    console.log(`Embedding dimension: ${product.embedding.length}`);
  } catch (error) {
    console.error("Product not found:", error);
  }
}
```

### deleteProduct()

Deletes product from database.

```tsx
deleteProduct(productId: string): Promise<DeleteResponse>
```

**Parameters**:

| Parameter   | Type   | Description            |
| ----------- | ------ | ---------------------- |
| `productId` | string | Product UUID to delete |

**Returns**: Promise<DeleteResponse>

**Response Format**:

```tsx
interface DeleteResponse {
  message: string;
  product_id: string;
  deleted: boolean;
}
```

**Example**:

```tsx
import { deleteProduct } from "@/lib/api";

async function removeProduct(id: string) {
  try {
    const response = await deleteProduct(id);
    if (response.deleted) {
      console.log(`✅ Product deleted: ${id}`);
    }
  } catch (error) {
    console.error("Delete failed:", error);
  }
}
```

---

## System Status API

### getSearchStatus()

Gets current system status and CLIP model information.

```tsx
getSearchStatus(): Promise<SearchStatus>
```

**Parameters**: None

**Returns**: Promise<SearchStatus>

**Response Format**:

```tsx
interface SearchStatus {
  model_name: string; // "ViT-B/32"
  device: string; // "cpu", "cuda", or "mps"
  embedding_dimension: number; // 512
  index_size: number; // Number of indexed products
  status: "ok" | "error"; // System status
}
```

**Example**:

```tsx
import { getSearchStatus } from "@/lib/api";

async function checkSystemStatus() {
  try {
    const status = await getSearchStatus();
    console.log(`Model: ${status.model_name}`);
    console.log(`Device: ${status.device}`);
    console.log(`Indexed products: ${status.index_size}`);
    console.log(
      `Status: ${status.status === "ok" ? "✅ Healthy" : "❌ Error"}`,
    );
  } catch (error) {
    console.error("Status check failed:", error);
  }
}
```

### getAdminStats()

Gets administrative statistics.

```tsx
getAdminStats(): Promise<AdminStats>
```

**Parameters**: None

**Returns**: Promise<AdminStats>

**Response Format**:

```tsx
interface AdminStats {
  total_products: number;
  total_embeddings: number;
  storage_used_mb: number;
  index_stats: {
    lists: number;
    probes: number;
    indexed_records: number;
  };
  database_stats: {
    connections: number;
    queries_per_second: number;
  };
}
```

**Example**:

```tsx
import { getAdminStats } from "@/lib/api";

async function showAdminDashboard() {
  try {
    const stats = await getAdminStats();
    console.log(`Products: ${stats.total_products}`);
    console.log(`Storage used: ${stats.storage_used_mb} MB`);
    console.log(`Vector index: ${stats.index_stats.indexed_records} records`);
  } catch (error) {
    console.error("Stats retrieval failed:", error);
  }
}
```

---

## Component API

### Navigation Component

React component for app-wide navigation.

**Location**: `src/components/Navigation.tsx`

```tsx
import Navigation from "@/components/Navigation";

export default function MyApp() {
  return (
    <>
      <Navigation />
      {/* Page content */}
    </>
  );
}
```

**Props**: None

**Features**:

- Logo and branding
- Links to /search and /upload pages
- External links to API docs and MinIO
- Status indicator
- Responsive mobile menu

---

### SearchPage Component

Full-featured search interface.

**Location**: `src/components/SearchPage.tsx`

```tsx
import SearchPage from "@/components/SearchPage";

export default function Search() {
  return <SearchPage />;
}
```

**Props**: None

**State Management** (Internal):

- `queryImage`: File | null
- `results`: SearchResult[]
- `loading`: boolean
- `error`: string | null
- `topK`: number (1-20)
- `threshold`: number (0-1)

**Features**:

- Drag-drop file upload
- Image preview with removal
- Configurable search parameters
- Results grid with similarity visualization
- Model status display
- Error handling

---

### UploadPage Component

Product upload interface.

**Location**: `src/components/UploadPage.tsx`

```tsx
import UploadPage from "@/components/UploadPage";

export default function Upload() {
  return <UploadPage />;
}
```

**Props**: None

**State Management** (Internal):

- `file`: File | null
- `preview`: string | null
- `metadata`: ProductMetadata
- `loading`: boolean
- `error`: string | null
- `success`: boolean

**Features**:

- Drag-drop file upload
- Image preview
- Metadata form
- File validation
- Success/error feedback

---

## Type Definitions

### SearchResponse

```tsx
interface SearchResponse {
  query_embedding: number[]; // 512-dimensional CLIP vector
  results: SearchResult[]; // Array of matches
  search_time_ms: number; // Backend query time
}
```

### SearchResult

```tsx
interface SearchResult {
  rank: number; // 1-based position
  product_id: string; // UUID
  filename: string; // S3 filename
  similarity_score: number; // 0-1 cosine similarity
  metadata: ProductMetadata; // Product info
  image_url: string; // MinIO URL
}
```

### ProductMetadata

```tsx
interface ProductMetadata {
  name: string;
  brand: string;
  sku: string;
  price: number;
  date_added: string; // ISO 8601
  description: string;
}
```

### UploadResponse

```tsx
interface UploadResponse {
  product_id: string; // UUID
  filename: string; // S3 filename
  metadata: ProductMetadata; // Echoed
  embedding_computed: boolean; // CLIP success
  image_url: string; // MinIO URL
  message: string; // Status
}
```

### SearchStatus

```tsx
interface SearchStatus {
  model_name: string; // "ViT-B/32"
  device: string; // "cpu"|"cuda"|"mps"
  embedding_dimension: number; // 512
  index_size: number; // Product count
  status: "ok" | "error";
}
```

### AdminStats

```tsx
interface AdminStats {
  total_products: number;
  total_embeddings: number;
  storage_used_mb: number;
  index_stats: Record<string, any>;
  database_stats: Record<string, any>;
}
```

---

## Error Handling

### Error Structure

```tsx
interface APIError {
  response?: Response;
  status?: number;
  statusText?: string;
  data?: {
    detail: string; // Error message
    error: string; // Error type
    code: string; // Error code
  };
}
```

### Common HTTP Status Codes

| Status | Meaning           | Action                 |
| ------ | ----------------- | ---------------------- |
| 200    | Success           | Data in response       |
| 201    | Created           | Resource created       |
| 400    | Bad Request       | Invalid parameters     |
| 404    | Not Found         | Resource doesn't exist |
| 413    | Payload Too Large | File >10 MB            |
| 500    | Server Error      | Backend failure        |
| 503    | Unavailable       | Service down           |

### Error Handling Example

```tsx
try {
  const results = await searchSimilarImages(file, 10, 0.5);
  // Process results
} catch (error) {
  if (error instanceof TypeError) {
    console.error("Network error:", error.message);
  } else if (error.status === 413) {
    console.error("File too large");
  } else if (error.status === 500) {
    console.error("Server error - backend may be offline");
  } else {
    console.error("Unknown error:", error);
  }
}
```

---

## Examples

### Example 1: Complete Search Workflow

```tsx
import React, { useState } from "react";
import { searchSimilarImages } from "@/lib/api";

export function SearchExample() {
  const [file, setFile] = useState<File | null>(null);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  const handleSearch = async () => {
    if (!file) return;

    setLoading(true);
    try {
      const response = await searchSimilarImages(file, 10, 0.5);
      setResults(response.results);
      console.log(`Found ${response.results.length} similar products`);
    } catch (error) {
      console.error("Search failed:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <input
        type="file"
        onChange={(e) => setFile(e.target.files?.[0] || null)}
      />
      <button onClick={handleSearch} disabled={!file || loading}>
        {loading ? "Searching..." : "Search"}
      </button>

      <div>
        {results.map((result) => (
          <div key={result.product_id}>
            <h3>{result.metadata.name}</h3>
            <p>Score: {(result.similarity_score * 100).toFixed(1)}%</p>
          </div>
        ))}
      </div>
    </div>
  );
}
```

### Example 2: Complete Upload Workflow

```tsx
import React, { useState } from "react";
import { uploadProduct } from "@/lib/api";

export function UploadExample() {
  const [file, setFile] = useState<File | null>(null);
  const [metadata, setMetadata] = useState({
    name: "",
    brand: "",
    sku: "",
    price: 0,
    date_added: new Date().toISOString().split("T")[0],
    description: "",
  });
  const [loading, setLoading] = useState(false);

  const handleUpload = async () => {
    if (!file) return;

    setLoading(true);
    try {
      const response = await uploadProduct(file, metadata);
      if (response.embedding_computed) {
        alert(`✅ Product uploaded: ${response.product_id}`);
      }
    } catch (error) {
      alert(`❌ Upload failed: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <input
        type="file"
        onChange={(e) => setFile(e.target.files?.[0] || null)}
      />

      <input
        placeholder="Product Name"
        value={metadata.name}
        onChange={(e) => setMetadata({ ...metadata, name: e.target.value })}
      />

      <input
        placeholder="Brand"
        value={metadata.brand}
        onChange={(e) => setMetadata({ ...metadata, brand: e.target.value })}
      />

      <button onClick={handleUpload} disabled={!file || loading}>
        {loading ? "Uploading..." : "Upload"}
      </button>
    </div>
  );
}
```

### Example 3: System Status Display

```tsx
import React, { useEffect, useState } from "react";
import { getSearchStatus } from "@/lib/api";

export function StatusDisplay() {
  const [status, setStatus] = useState(null);

  useEffect(() => {
    getSearchStatus().then(setStatus);
  }, []);

  if (!status) return <div>Loading...</div>;

  return (
    <div>
      <h2>System Status</h2>
      <p>Model: {status.model_name}</p>
      <p>Device: {status.device}</p>
      <p>Embedding Dimension: {status.embedding_dimension}</p>
      <p>Indexed Products: {status.index_size}</p>
      <p>Status: {status.status === "ok" ? "✅ Healthy" : "❌ Error"}</p>
    </div>
  );
}
```

---

## Best Practices

### Performance

1. **Debounce Search**: Avoid firing multiple searches rapidly
2. **Cache Results**: Store recent searches for quick access
3. **Lazy Load Images**: Use image URLs in grid instead of base64
4. **Pagination**: Use limit/offset for large product lists

### Error Handling

1. **Always use try-catch** around API calls
2. **Show user feedback** for all operations
3. **Log errors** for debugging
4. **Handle timeout** gracefully

### Type Safety

1. **Use interfaces** for all data structures
2. **Validate file types** before upload
3. **Type check responses** with TypeScript
4. **Catch unexpected fields** with proper types

### Security

1. **Validate file size** client-side
2. **Sanitize file names** server-side
3. **Use HTTPS** in production
4. **Validate metadata** inputs

---

**Last Updated**: Phase 4 Implementation Complete
**Version**: 1.0
