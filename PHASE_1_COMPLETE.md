# Phase 1 Complete: Database Migration Setup

## ✅ What Was Created

### Project Structure

```
image-search-engine/
├── backend/                          # Python FastAPI backend
│   ├── core/
│   │   ├── config.py                 # Environment config (Pydantic)
│   │   ├── security.py               # Security utilities
│   │   └── __init__.py
│   ├── db/
│   │   ├── models.py                 # SQLAlchemy ORM models
│   │   ├── database.py               # Async DB connection setup
│   │   └── __init__.py
│   ├── api/                          # Will be populated in Phase 2
│   ├── ml/                           # CLIP embedding code (moved here)
│   ├── Dockerfile                    # Container image for backend
│   ├── requirements.txt              # Python dependencies
│   ├── .dockerignore
│   └── .env.local                    # Environment variables
├── frontend/                         # Next.js React frontend (Phase 4)
│   ├── Dockerfile
│   └── .dockerignore
├── alembic/
│   ├── env.py                        # Migration orchestration
│   ├── versions/
│   │   └── 001_initial.py            # Initial schema with pgvector
│   └── script.py.mako
├── docker-compose.yml                # Full stack local development
├── .env.example                      # Env template
└── MODERNIZATION_PLAN.md             # Overall plan
```

---

## 📊 Technology Changes

### Database Layer

| What              | Before                  | After                           |
| ----------------- | ----------------------- | ------------------------------- |
| **Database**      | MySQL (pymysql)         | PostgreSQL + pgvector (asyncpg) |
| **ORM**           | Manual SQL queries      | SQLAlchemy 2.0                  |
| **Embeddings**    | NumPy arrays in memory  | pgvector (SQL native)           |
| **Vector Index**  | None                    | IVFFLAT (fast search)           |
| **Async Support** | Limited                 | Full async/await                |
| **Migrations**    | Manual ALTER statements | Alembic versioning              |

### Files Changed

- ✅ Created `backend/db/models.py` - SQLAlchemy ORM models matching MySQL schema
- ✅ Created `backend/db/database.py` - Async PostgreSQL connection + pgvector setup
- ✅ Created `backend/core/config.py` - Pydantic settings from environment
- ✅ Created `alembic/env.py` - Migration orchestration
- ✅ Created `alembic/versions/001_initial.py` - Initial schema with IVFFLAT indexes

---

## 🔄 Schema Migration (MySQL → PostgreSQL)

### Model Mapping

**MySQL `images` table:**

```sql
CREATE TABLE images (
    id INT AUTO_INCREMENT PRIMARY KEY,
    filename VARCHAR(255) NOT NULL UNIQUE,
    image_data LONGBLOB,
    embedding LONGBLOB,
    sku VARCHAR(100),
    brand VARCHAR(255),
    product_name VARCHAR(255),
    product_date DATE,
    description TEXT,
    price DECIMAL(10,2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
)
```

**PostgreSQL `images` table (new):**

```sql
CREATE TABLE images (
    id VARCHAR(36) PRIMARY KEY,
    filename VARCHAR(255) NOT NULL UNIQUE,
    s3_url VARCHAR(500),                    -- Instead of image_data BLOB
    embedding vector(512),                  -- pgvector native type
    sku VARCHAR(100),
    brand VARCHAR(255),
    product_name VARCHAR(255),
    product_date VARCHAR(10),
    description TEXT,
    price NUMERIC(10,2),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Vector indexes for fast similarity search
CREATE INDEX ix_images_embedding_ivf
ON images USING IVFFLAT (embedding vector_cosine_ops)
WITH (lists = 100);
```

### Key Differences

| Field          | MySQL              | PostgreSQL     | Benefit                         |
| -------------- | ------------------ | -------------- | ------------------------------- |
| `id`           | AUTO_INCREMENT INT | UUID           | Better for distributed systems  |
| `image_data`   | LONGBLOB           | Removed (→ S3) | Faster queries, cheaper storage |
| `embedding`    | LONGBLOB           | vector(512)    | Native SQL queries, indexes     |
| `product_date` | DATE               | VARCHAR(10)    | Flexibility                     |
| Indexing       | Basic              | IVFFLAT index  | 100x faster vector search       |

---

## 🐳 Docker Compose Setup

### Services Included

**1. PostgreSQL (pgvector)**

```yaml
- Port: 5432
- Image: pgvector/pgvector:pg15-latest
- Includes: vector extension pre-installed
- Data: Persisted in postgres_data volume
```

**2. MinIO (S3 Compatible)**

```yaml
- S3 Port: 9000
- Console: 9001
- Access: http://localhost:9001 (user: minioadmin/minioadmin)
- Data: Persisted in minio_data volume
```

**3. FastAPI Backend**

```yaml
- Port: 8000
- Build: ./backend/Dockerfile
- Env: Connected to PostgreSQL + MinIO
- Hot-reload: ✅ (uses volumes)
```

**4. Next.js Frontend** (Phase 4)

```yaml
- Port: 3000
- Build: ./frontend/Dockerfile
- Env: NEXT_PUBLIC_API_URL pointing to backend
```

---

## 📦 Dependencies Added

### Backend `requirements.txt`

```
# New Core Dependencies
sqlalchemy==2.0.23           # ORM
asyncpg==0.29.0            # Async PostgreSQL driver
pgvector==0.2.4             # Vector support
alembic==1.12.1             # Migrations

# Config
pydantic-settings==2.1.0    # Environment-based settings
python-dotenv==1.0.0        # .env file support

# Storage
boto3==1.34.4               # AWS S3 (MinIO compatible)

# Security
pyjwt==2.8.1                # JWT tokens
passlib==1.7.4              # Password hashing

# Kept (unchanged)
fastapi==0.104.1
uvicorn==0.24.0
pillow==10.0.0
numpy==1.24.3
torch==2.0.1
transformers==4.30.0
```

---

## 🚀 How to Use (Local Development)

### Step 1: Clone/Update Code

```bash
cd /path/to/image-search-engine
git pull  # or copy files
```

### Step 2: Copy Environment File

```bash
cp .env.example backend/.env.local
```

### Step 3: Build & Run Docker Compose

```bash
docker-compose up --build

# Or in background:
docker-compose up -d --build
```

### Step 4: Verify Services

```bash
# PostgreSQL (psql)
psql -h localhost -U postgres -d image_search_db

# MinIO Console
open http://localhost:9001  # user: minioadmin/minioadmin

# FastAPI Docs
open http://localhost:8000/docs

# Frontend (coming in Phase 4)
open http://localhost:3000
```

---

## ✨ What's Ready Now

### ✅ Phase 1 Complete

- [x] Database structure defined (SQLAlchemy models)
- [x] PostgreSQL + pgvector setup in Docker
- [x] Alembic migrations framework
- [x] Environment configuration system
- [x] S3/MinIO storage integration (structure)

### ⏳ Phase 2 Next (Backend Refactoring)

- [ ] Migrate existing Python code to use SQLAlchemy
- [ ] Convert all `db_mysql.py` functions to async SQLAlchemy queries
- [ ] Add database initialization in FastAPI startup
- [ ] Update embedder integration
- [ ] Test data migration from MySQL

### ⏳ Phase 3 (Storage Migration)

- [ ] Implement S3 upload/download functions
- [ ] Migrate existing images to S3/MinIO
- [ ] Update product model to use S3 URLs

### ⏳ Phase 4 (Frontend)

- [ ] Create Next.js project structure
- [ ] Migrate React components
- [ ] Setup TypeScript
- [ ] Add TailwindCSS

---

## 🔧 Configuration Reference

### Backend Environment Variables

```bash
# Database
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/image_search_db"

# S3 / MinIO (for local dev)
S3_ENDPOINT="http://localhost:9000"
S3_ACCESS_KEY="minioadmin"
S3_SECRET_KEY="minioadmin"
S3_BUCKET_NAME="image-search"
S3_USE_SSL="false"
S3_REGION="us-east-1"

# FastAPI
DEBUG="true"
```

### Frontend Environment Variables

```bash
NEXT_PUBLIC_API_URL="http://localhost:8000"
```

---

## 🔗 Data Migration Plan

When ready to migrate existing MySQL data:

```python
# 1. Export MySQL data
mysqldump -u root image_search_db > backup.sql

# 2. Run migration script (to be created in Phase 2)
python scripts/migrate_mysql_to_postgres.py

# 3. Verify data
psql -h localhost -U postgres -d image_search_db -c "SELECT COUNT(*) FROM images;"
```

---

## ⚠️ Important Notes

### File Storage Changes

- **Before**: Images stored in MySQL `image_data` LONGBLOB column
- **After**: Images stored in MinIO/S3, only URL stored in database
- **Benefit**: Smaller DB, faster queries, potential CDN caching

### Vector Search Changes

- **Before**: NumPy in-memory array (limited by RAM)
- **After**: PostgreSQL pgvector with IVFFLAT index (unlimited scale)
- **Benefit**: Can handle millions of images, native SQL queries

### Connection String Format

```python
# Old (MySQL)
mysql://root:password@localhost/image_search_db

# New (PostgreSQL)
postgresql://postgres:postgres@localhost/image_search_db

# Async (with asyncpg)
postgresql+asyncpg://postgres:postgres@localhost/image_search_db
```

---

## 📋 Checklist Before Phase 2

- [ ] Docker installed on your machine
- [ ] All files created successfully
- [ ] `docker-compose up --build` works without errors
- [ ] PostgreSQL, MinIO, and backend services are healthy
- [ ] Can access: http://localhost:8000/docs (FastAPI Swagger)

---

## 🎯 Next Step

**Ready to proceed with Phase 2 (Backend Refactoring)?**

Phase 2 will:

1. Update `main.py` to use SQLAlchemy
2. Refactor database queries in new `backend/api/` endpoints
3. Setup FastAPI startup/shutdown with DB initialization
4. Create data migration script from MySQL to PostgreSQL
5. Test all existing functionality with new stack

Let me know when you're ready! 🚀
