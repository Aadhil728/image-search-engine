# Phase 1 Testing Guide - Local Docker Development Setup

## ✅ Prerequisites Check

Before we start, verify you have:

### Required Software

- **Docker Desktop** installed and running
- **Docker Compose** (comes with Docker Desktop)
- **Git** (optional, for version control)
- **curl** (for testing endpoints)

### Check Installation

**Windows (PowerShell):**

```powershell
docker --version
docker-compose --version
```

**macOS/Linux (Terminal):**

```bash
docker --version
docker-compose --version
```

Expected output:

```
Docker version 24.x.x or higher
Docker Compose version 2.x.x or higher
```

---

## 🚀 STEP 1: Prepare Your Project

### 1.1 Navigate to Project Directory

```bash
cd /path/to/image-search-engine
# or on Windows:
cd C:\Users\Brill\Desktop\image-search-engine\image-search-engine
```

### 1.2 Create Environment File

Copy the template to `.env.local`:

```bash
cp .env.example backend/.env.local
```

Or manually create `backend/.env.local` with:

```env
# Database
DATABASE_URL=postgresql://postgres:postgres@postgres:5432/image_search_db

# S3 / MinIO (Local Development)
S3_ENDPOINT=http://minio:9000
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin
S3_BUCKET_NAME=image-search
S3_USE_SSL=false
S3_REGION=us-east-1

# FastAPI
DEBUG=true
```

### 1.3 Verify Project Structure

Check that these files exist:

```
✓ docker-compose.yml
✓ backend/requirements.txt
✓ backend/Dockerfile
✓ backend/core/config.py
✓ backend/db/models.py
✓ backend/db/database.py
✓ alembic/env.py
✓ alembic/versions/001_initial.py
```

---

## 🐳 STEP 2: Build & Start Docker Services

### 2.1 Build Images (First Time Only)

```bash
docker-compose build
```

**What happens:**

- Builds PostgreSQL + pgvector image
- Builds MinIO image
- Builds FastAPI backend image
- Takes 5-10 minutes first time
- Subsequent runs are cached (faster)

### 2.2 Start All Services

```bash
docker-compose up
```

**What you should see:**

```
image_search_postgres ... healthy
image_search_minio ... healthy
image_search_backend ... Uvicorn running on http://0.0.0.0:8000
```

**To run in background:**

```bash
docker-compose up -d
```

### 2.3 Check Service Status

```bash
docker-compose ps
```

Expected output:

```
NAME                    STATUS
image_search_postgres   Up (healthy)
image_search_minio      Up (healthy)
image_search_backend    Up (healthy)
```

---

## ✨ STEP 3: Verify Each Service

### 3.1 Test FastAPI Backend

```bash
# Test health endpoint
curl http://localhost:8000/health

# Expected response:
# {"status":"ok"}
```

### 3.2 View FastAPI Automatic Documentation

Open in browser:

```
http://localhost:8000/docs
```

You should see the **Swagger UI** with all API endpoints (currently empty, will be filled in Phase 2).

### 3.3 Test MinIO S3 Storage

Open in browser:

```
http://localhost:9001
```

Login with:

- **Username:** minioadmin
- **Password:** minioadmin

You should see the MinIO console. Navigate to **Buckets** and create a bucket named `image-search` if it doesn't exist.

### 3.4 Test PostgreSQL Connection

```bash
# Connect to PostgreSQL container
docker exec -it image_search_postgres psql -U postgres -d image_search_db

# Inside psql, run:
postgres=# \dt
postgres=# SELECT COUNT(*) FROM images;
postgres=# \q  # to exit
```

Expected output:

```
 Schema |       Name       | Type  |  Owner
--------+------------------+-------+----------
 public | images           | table | postgres
(1 row)

 count
-------
     0
(1 row)
```

---

## 🧪 STEP 4: Quick Functionality Test

### 4.1 Create a Test Database Connection

```bash
# Enter Python shell in backend container
docker exec -it image_search_backend python

# In Python:
>>> from sqlalchemy import create_engine, text
>>> engine = create_engine("postgresql://postgres:postgres@postgres:5432/image_search_db")
>>> with engine.connect() as conn:
...     result = conn.execute(text("SELECT version()"))
...     print(result.fetchone())
>>> exit()
```

Expected output:

```
('PostgreSQL 15.x (Debian 15.x-1.pgdg120+1) on x86_64-pc-linux-gnu, compiled by gcc (Debian 12.2.0-14+0~20221219.11+debian~deb12u1) 12.2.0, 64-bit',)
```

### 4.2 Test pgvector Extension

```bash
docker exec -it image_search_postgres psql -U postgres -d image_search_db -c "SELECT version(); SELECT * FROM pg_extension WHERE extname = 'vector';"
```

Expected: pgvector extension is installed ✓

---

## 📊 STEP 5: Verify Database Schema

### 5.1 List Tables

```bash
docker exec -it image_search_postgres psql -U postgres -d image_search_db -c "\dt"
```

Should show:

```
            List of relations
 Schema |  Name  | Type  |  Owner
--------+--------+-------+----------
 public | images | table | postgres
```

### 5.2 Inspect Images Table

```bash
docker exec -it image_search_postgres psql -U postgres -d image_search_db -c "\d images"
```

Should show all columns:

```
                          Table "public.images"
     Column      |            Type             | Collation | Nullable | Default
-----------------+-----------------------------+-----------+----------+---------
 id              | character varying(36)       |           | not null |
 filename        | character varying(255)      |           | not null |
 s3_url          | character varying(500)      |           |          |
 embedding       | vector                      |           |          |
 sku             | character varying(100)      |           |          |
 brand           | character varying(255)      |           |          |
 product_name    | character varying(255)      |           |          |
 product_date    | character varying(10)       |           |          |
 description     | text                        |           |          |
 price           | numeric(10,2)               |           |          |
 created_at      | timestamp without time zone |           | not null | now()
 updated_at      | timestamp without time zone |           | not null | now()
```

### 5.3 Check Vector Index

```bash
docker exec -it image_search_postgres psql -U postgres -d image_search_db -c "\di"
```

Should show IVFFLAT index:

```
                           List of relations
 Schema |               Name               | Type  |  Owner
--------+----------------------------------+-------+----------
 public | ix_images_brand                  | index | postgres
 public | ix_images_embedding_ivf          | index | postgres  ← vector index
 public | ix_images_filename               | index | postgres
 public | ix_images_sku                    | index | postgres
```

---

## 🛠️ STEP 6: Troubleshooting

### Issue: "Cannot connect to Docker daemon"

**Solution:** Start Docker Desktop (on Windows/Mac) or Docker service (on Linux)

### Issue: Port 5432 already in use

**Solution:** Stop conflicting service

```bash
# Find what's using port 5432
lsof -i :5432  # macOS/Linux
netstat -ano | findstr :5432  # Windows

# Change port in docker-compose.yml:
# Change "5432:5432" to "5433:5432"
# Then connect with: postgresql://postgres:postgres@localhost:5433/...
```

### Issue: "Service unhealthy"

**Solution:** Check logs

```bash
docker-compose logs postgres      # PostgreSQL logs
docker-compose logs minio         # MinIO logs
docker-compose logs backend        # Backend logs
```

### Issue: "Cannot find module" errors in backend

**Solution:** Rebuild images

```bash
docker-compose down
docker-compose build --no-cache
docker-compose up
```

### Issue: MinIO bucket not created

**Solution:** Create manually via console

1. Open http://localhost:9001
2. Click "Buckets" → "Create Bucket"
3. Name: `image-search`
4. Click "Create"

---

## 📋 STEP 7: Verify Everything Works

Run this checklist:

- [ ] **Docker Desktop running** - No errors in status bar
- [ ] **All services healthy** - `docker-compose ps` shows all "Up (healthy)"
- [ ] **FastAPI docs accessible** - http://localhost:8000/docs loads
- [ ] **MinIO console accessible** - http://localhost:9001 loads
- [ ] **PostgreSQL responsive** - Can query database
- [ ] **pgvector installed** - Extension exists in database
- [ ] **Schema created** - Tables exist with correct columns
- [ ] **Indexes created** - IVFFLAT index present

---

## 📊 STEP 8: Performance Baseline

Test database performance:

### Test Query Performance

```bash
docker exec -it image_search_postgres psql -U postgres -d image_search_db -c "
EXPLAIN ANALYZE
SELECT * FROM images
ORDER BY embedding <-> ARRAY[0,0,0];
"
```

This shows the query plan. Good sign: Uses `ix_images_embedding_ivf` index.

---

## 🎯 STEP 9: Next Steps

### When Everything Works ✅

Once all services are healthy and tests pass:

1. **Keep docker-compose running** in background:

   ```bash
   docker-compose up -d
   ```

2. **Ready for Phase 2** - Backend refactoring
   - I'll create new API endpoints
   - Refactor existing code to use SQLAlchemy
   - Add migrations
   - Migrate data from MySQL (if needed)

### If Issues Occur ❌

1. **Check logs**: `docker-compose logs service-name`
2. **Restart services**: `docker-compose restart`
3. **Full reset**:
   ```bash
   docker-compose down -v  # Remove volumes too
   docker-compose up --build
   ```

---

## 💾 STEP 10: Backup & Persistence

### Data Persistence

All data is stored in Docker volumes:

- `postgres_data` - PostgreSQL database files
- `minio_data` - MinIO storage

These persist even if containers stop!

### Backup Database

```bash
# Export PostgreSQL dump
docker exec image_search_postgres pg_dump -U postgres image_search_db > backup.sql

# Later, restore from backup:
docker exec -i image_search_postgres psql -U postgres image_search_db < backup.sql
```

---

## 🔗 USEFUL COMMANDS

### View Logs

```bash
# All services
docker-compose logs

# Specific service
docker-compose logs backend
docker-compose logs postgres
docker-compose logs minio

# Follow logs (like tail -f)
docker-compose logs -f backend
```

### Stop Services

```bash
# Stop but keep data
docker-compose stop

# Stop and remove everything
docker-compose down

# Stop and remove everything + volumes
docker-compose down -v
```

### Access Containers

```bash
# Shell in backend
docker exec -it image_search_backend bash

# Shell in postgres
docker exec -it image_search_postgres bash

# Python shell in backend
docker exec -it image_search_backend python
```

### View Running Processes

```bash
docker-compose ps

# Detailed info
docker-compose ps -a
```

---

## 📱 Access Points Summary

| Service           | URL                         | Credentials           |
| ----------------- | --------------------------- | --------------------- |
| **FastAPI Docs**  | http://localhost:8000/docs  | N/A                   |
| **FastAPI ReDoc** | http://localhost:8000/redoc | N/A                   |
| **MinIO Console** | http://localhost:9001       | minioadmin/minioadmin |
| **PostgreSQL**    | localhost:5432              | postgres/postgres     |
| **Database**      | image_search_db             | N/A                   |

---

## ✨ Success Indicators

You'll know Phase 1 testing is successful when:

1. ✅ All Docker containers healthy
2. ✅ Can access FastAPI Swagger docs
3. ✅ Can login to MinIO console
4. ✅ Can query PostgreSQL database
5. ✅ pgvector extension loaded
6. ✅ Images table with correct schema exists
7. ✅ IVFFLAT vector index present
8. ✅ No error logs in docker-compose output

When all ✅, we're ready for **Phase 2: Backend Refactoring**!

---

## 🎬 Ready to Test?

Start with:

```bash
docker-compose up
```

Then run through the verification steps above.

**Let me know when you're ready or if you hit any issues!** 🚀
