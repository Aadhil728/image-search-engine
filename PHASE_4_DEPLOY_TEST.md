# Phase 4 Deployment & Testing Guide

## Quick Start

### Prerequisites

- Docker and Docker Compose running
- Phase 3 backend healthy and running
- All `.env` files properly configured

### Deploy Phase 4 Frontend

```bash
# Navigate to project directory
cd ~/Desktop/image-search-engine/image-search-engine

# Rebuild containers to load Phase 4 components
docker compose up -d --build

# Monitor frontend startup
docker logs -f image_search_frontend

# Check all services are healthy
docker ps

# Expected output: All services running (STATUS: Up)
```

### Access the Frontend

```
🌐 Frontend:     http://localhost:3000
📚 API Docs:     http://localhost:8000/docs
🪣 MinIO:        http://localhost:9001
🐘 PostgreSQL:   localhost:5432
```

## Verification Checklist

### Step 1: Verify Services Running

```bash
# Check container status
docker ps --format "table {{.Names}}\t{{.Status}}"

# Expected output:
# image_search_postgres    Up 2 hours
# image_search_minio       Up 2 hours
# image_search_backend     Up 2 hours
# image_search_frontend    Up (started ~1 min)
```

### Step 2: Test Backend Health

```bash
# Health check endpoint
curl http://localhost:8000/health

# Expected response:
# {"status":"healthy","timestamp":"2024-01-15T..."}

# Get search status
curl http://localhost:8000/api/v1/status

# Expected response with CLIP model info
```

### Step 3: Test Frontend Loading

```bash
# Open in browser
open http://localhost:3000

# Or test with curl
curl http://localhost:3000 \
  -H "Accept: text/html" | head -50

# Should return HTML with Phase 4 landing page
```

### Step 4: Check Navigation

1. **HomePage** (http://localhost:3000)
   - ✅ Hero section with "Image Search Engine"
   - ✅ 4 feature cards (AI Model, Fast Search, Storage, Vectors)
   - ✅ "Search Similar Images" button
   - ✅ "Upload Products" button
   - ✅ Tech stack table
   - ✅ Quick links section

2. **Navigation Bar** (appears on all pages)
   - ✅ Logo visible
   - ✅ Search page link
   - ✅ Upload page link
   - ✅ API Docs link (external)
   - ✅ MinIO link (external)
   - ✅ Status indicator (should show green)

3. **Search Page** (http://localhost:3000/search)
   - ✅ Upload drop zone visible
   - ✅ Top-K slider (1-20)
   - ✅ Similarity threshold slider (0-1)
   - ✅ Search button
   - ✅ Model status section

4. **Upload Page** (http://localhost:3000/upload)
   - ✅ Upload drop zone visible
   - ✅ Metadata form fields
   - ✅ Info panel on right
   - ✅ Upload button
   - ✅ File validation info

## End-to-End Testing

### Test Flow 1: Upload Product

**Objective**: Upload an image and verify it's stored and indexed

**Steps**:

1. **Get a test image**

   ```bash
   # Download sample product image
   wget https://via.placeholder.com/400x400?text=ProductImage \
     -O test_product.jpg

   # Or use any local image file
   cp ~/Pictures/sample.jpg test_product.jpg
   ```

2. **Navigate to upload page**
   - Go to http://localhost:3000/upload
   - Or click "📤 Upload Products" from home

3. **Upload image**
   - Drag `test_product.jpg` onto upload zone
   - Or click to select file
   - Verify image preview appears

4. **Fill metadata** (optional but recommended)
   - Name: "Test Product"
   - Brand: "TestBrand"
   - SKU: "TEST-001"
   - Price: "99.99"
   - Description: "Test product for search"

5. **Submit upload**
   - Click "📤 Upload Product"
   - Wait for success message
   - Note the product ID

6. **Verify in backend**

   ```bash
   # List products
   curl http://localhost:8000/api/v1/products

   # Should include uploaded product

   # Check MinIO storage
   # Visit http://localhost:9001
   # Login: minioadmin / minioadmin
   # Browse to /images bucket
   ```

**Expected Results**:

- ✅ Success message appears
- ✅ Product ID displayed
- ✅ Image appears in MinIO console
- ✅ Product accessible via `/api/v1/products`

### Test Flow 2: Search for Similar Images

**Objective**: Search the uploaded product and receive results

**Steps**:

1. **Prepare test image**

   ```bash
   # Use same image or similar variant
   cp test_product.jpg query_image.jpg

   # Or download similar image
   wget https://via.placeholder.com/400x400?text=SimilarProduct \
     -O query_image.jpg
   ```

2. **Navigate to search page**
   - Go to http://localhost:3000/search
   - Or click "🔍 Search Similar Images" from home

3. **Upload query image**
   - Drag `query_image.jpg` onto upload zone
   - Preview appears immediately

4. **Configure search parameters**
   - Top-K: Leave at 5 (or set to 10)
   - Similarity Threshold: 0.5 (or adjust as needed)

5. **Execute search**
   - Click "🔍 Search" button
   - Progress indicator appears
   - Wait for results (~1 second)

6. **Verify results**
   - Results grid appears below
   - Each result shows:
     - Product image thumbnail
     - Similarity score (0-1)
     - Progress bar filled to match score
     - Product details (name, brand, SKU, price)
     - Rank number

**Expected Results**:

- ✅ Results appear within 1-2 seconds
- ✅ Same product has highest similarity (~0.9+)
- ✅ Correct number of results (≤ top_k)
- ✅ All results have similarity ≥ threshold
- ✅ Scores decrease in ranking order

### Test Flow 3: Test API Endpoints Directly

**Objective**: Verify all API endpoints responding correctly

**Search via HTTP**:

```bash
# Create test image file
cp test_product.jpg search_test.jpg

# POST to search endpoint
curl -X POST http://localhost:8000/api/v1/search \
  -F "file=@search_test.jpg" \
  -F "top_k=5" \
  -F "threshold=0.5"

# Response includes query embedding and results array
```

**Get Status**:

```bash
# Get system status
curl http://localhost:8000/api/v1/status

# Response:
# {
#   "model": "ViT-B/32",
#   "device": "cpu",
#   "embedding_dimension": 512,
#   "index_records": 1,
#   "status": "ok"
# }
```

**List Products**:

```bash
# Get all products
curl "http://localhost:8000/api/v1/products?limit=10&offset=0"

# Response: List of all products with metadata
```

**Get Single Product**:

```bash
# Get specific product
curl http://localhost:8000/api/v1/products/{product_id}

# Response: Product details with full metadata
```

### Test Flow 4: Test UI Responsiveness

**Objective**: Verify responsive design on different screen sizes

**Desktop (Full Page)**:

1. Open http://localhost:3000
2. Verify all components visible
3. Feature grid shows 4 columns
4. Navigation bar horizontal

**Tablet (1024px)**:

```bash
# Open DevTools and set responsive mode
# Set viewport to 1024x768

# Verify:
# - Feature grid shows 2-3 columns
# - Navigation bar still horizontal
# - Buttons stack properly
```

**Mobile (375px)**:

```bash
# Open DevTools and set responsive mode
# Set viewport to 375x667

# Verify:
# - Feature grid stacks to 1 column
# - Navigation shows mobile menu
# - Buttons stack vertically
# - Upload zone fills width
# - Forms still usable
```

## Performance Testing

### Search Latency

```bash
# Time a single search
time curl -X POST http://localhost:8000/api/v1/search \
  -F "file=@test_product.jpg" > /dev/null

# Expected: <2 seconds total (including network)
# Backend processing: <100ms typically
# CLIP embedding: ~500-1000ms
```

### Throughput

```bash
# Download Apache Bench if not installed
# macOS: brew install httpd
# Linux: apt-get install apache2-utils
# Windows: Download from Apache

# Run 100 requests with 10 concurrent
ab -n 100 -c 10 http://localhost:3000

# Check results:
# - Requests/sec (throughput)
# - Mean time per request
# - Max time per request
```

## Debugging

### Frontend Logs

```bash
# View frontend container logs
docker logs -f image_search_frontend

# Look for:
# - Module not found errors
# - Type errors
# - CORS errors
# - Connection refused
```

### Backend Logs

```bash
# View backend container logs
docker logs -f image_search_backend

# Look for:
# - Request received messages
# - CLIP embedding completed
# - Database errors
# - S3 storage errors
```

### Database Logs

```bash
# Check PostgreSQL
docker logs -f image_search_postgres

# Look for:
# - Connection errors
# - Query errors
# - pgvector issues
```

### Browser Console

1. Open browser DevTools (F12)
2. Go to Console tab
3. Look for JavaScript errors
4. Check Network tab for failed requests

## Common Issues & Solutions

### Issue: Frontend Won't Load (404)

**Cause**: Frontend container not running or failed to build

**Solution**:

```bash
# Check container status
docker ps | grep frontend

# If not running, start it
docker compose up -d frontend

# If build failed, rebuild
docker compose build --no-cache frontend
docker compose up -d frontend

# Check logs
docker logs image_search_frontend | tail -50
```

### Issue: Search Returns No Results

**Cause**: No products uploaded or search threshold too high

**Solution**:

```bash
# Verify products exist
curl http://localhost:8000/api/v1/products

# If empty, upload products first via UI or:
curl -X POST http://localhost:8000/api/v1/upload \
  -F "file=@test_product.jpg"

# Try lower similarity threshold (0.3 instead of 0.5)
```

### Issue: API Docs Link Opens but Returns Error

**Cause**: Backend container not healthy

**Solution**:

```bash
# Check backend status
curl http://localhost:8000/health

# If fails, restart backend
docker compose restart backend

# Wait 10 seconds for startup
sleep 10

# Try again
curl http://localhost:8000/health
```

### Issue: Upload Returns 413 Payload Too Large

**Cause**: File exceeds 10 MB limit

**Solution**:

- Use smaller image file (<10 MB)
- Compress image before upload
- Frontend validates client-side, but can bypass

### Issue: Cannot Connect to MinIO

**Cause**: MinIO container not running or network issue

**Solution**:

```bash
# Check MinIO status
docker ps | grep minio

# Restart if needed
docker compose restart minio

# Wait for startup
sleep 5

# Test connection
curl http://localhost:9000

# Try MinIO console
open http://localhost:9001
```

## Data Cleanup

### Clear Search Results (No Data Loss)

```bash
# Just refresh page in browser
# No data is deleted
```

### Delete Specific Product

```bash
# Via backend API
curl -X DELETE http://localhost:8000/api/v1/products/{product_id}

# Via CLI
docker exec image_search_backend \
  python -c "from db_mysql import delete_product; delete_product('{product_id}')"
```

### Reset Database Completely

```bash
# WARNING: DELETES ALL DATA

# Stop services
docker compose down

# Remove database volume
docker volume rm image_search_postgres_data

# Restart services (blank database)
docker compose up -d

# Wait for initialization
sleep 10

# Verify empty
curl http://localhost:8000/api/v1/products
```

## Monitoring

### Real-Time Metrics

```bash
# Monitor container stats
docker stats image_search_frontend image_search_backend image_search_postgres

# Shows: CPU %, Memory, Network I/O

# Watch for:
# - CPU consistently >50% (slow queries)
# - Memory >80% (resource leak)
# - High network I/O (data transfer)
```

### Check Disk Usage

```bash
# MinIO storage
docker exec image_search_minio mc du /minio/images

# PostgreSQL
docker exec image_search_postgres psql -U imageuser -d imagedb \
  -c "SELECT pg_size_pretty(pg_database_size('imagedb'))"

# Total disk
df -h /var/lib/docker/volumes
```

## Performance Optimization

### For Production

```bash
# 1. Enable caching in nginx.conf
# add cache headers for static assets

# 2. Compress images before storage
# QUALITY 75-85 in upload handler

# 3. Increase PostgreSQL buffer
# shared_buffers = 256MB
# work_mem = 4MB

# 4. Update IVFFLAT parameters
# lists=200 (more accuracy)
# probes=20 (more speed)

# 5. Enable connection pooling
# pgbouncer min_pool_size=10
```

## Success Criteria

Phase 4 is working correctly when:

✅ Frontend loads at http://localhost:3000
✅ Navigation bar visible on all pages
✅ Search page has upload zone and controls
✅ Upload page has metadata form
✅ Can upload product image successfully
✅ Can search and receive results in <2 seconds
✅ Results show similarity scores and product info
✅ API Docs link works and shows endpoints
✅ MinIO console accessible at localhost:9001
✅ All pages responsive on mobile (375px)
✅ No console errors in browser DevTools
✅ No critical errors in Docker logs

## Next Steps

After successful Phase 4 testing:

1. **Phase 5**: Production VPS Deployment
   - [ ] Set up VPS on Hostinger
   - [ ] Configure Nginx reverse proxy
   - [ ] Enable SSL/TLS
   - [ ] Set up domain
   - [ ] Configure systemd services

2. **Phase 6**: Optimization
   - [ ] Image compression
   - [ ] Query caching
   - [ ] Database optimization
   - [ ] Load testing

3. **Phase 7**: Advanced Features
   - [ ] User authentication
   - [ ] Admin dashboard
   - [ ] Analytics
   - [ ] Rate limiting

---

**Done?** All Phase 4 systems operational and tested ✅
**Next?** Proceed to Phase 5 VPS deployment
