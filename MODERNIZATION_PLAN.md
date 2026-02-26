# Image Search Engine - Modernization Plan (Option B)

## Architecture: Python Backend (FastAPI) + Next.js Frontend + PostgreSQL + Hostinger VPS

---

## 📋 OVERVIEW

```
LOCAL DEVELOPMENT
├── Backend: FastAPI + SQLAlchemy + PostgreSQL (via Docker)
├── Frontend: Next.js 14 + TypeScript (localhost:3000)
├── Storage: MinIO (local S3-compatible)
└── Database: PostgreSQL (Docker container)

HOSTINGER VPS PRODUCTION
├── Backend: FastAPI via Gunicorn + Supervisor
├── Frontend: Next.js (built static/serverless)
├── Reverse Proxy: Nginx
├── Database: PostgreSQL (native or managed)
├── Storage: Backblaze B2 (cheaper than S3, S3-compatible)
├── SSL: Let's Encrypt (via Certbot)
├── Domain: Your domain with DNS pointing to VPS
└── Monitoring: Basic logging + health checks
```

---

## 🎯 PROJECT STRUCTURE (After Migration)

```
image-search-engine/
├── backend/                    # Python FastAPI
│   ├── main.py
│   ├── db/
│   │   ├── models.py          # SQLAlchemy ORM models
│   │   ├── database.py        # DB connection + migrations
│   │   └── seed.py
│   ├── api/
│   │   ├── products.py        # Product CRUD endpoints
│   │   ├── search.py          # Search endpoints
│   │   └── admin.py           # Admin endpoints
│   ├── core/
│   │   ├── config.py          # Environment config
│   │   ├── security.py        # Auth (if needed)
│   │   └── dependencies.py
│   ├── ml/
│   │   ├── embedder.py        # CLIP embeddings (unchanged)
│   │   └── models/
│   ├── requirements.txt
│   ├── .env                   # Local ENV vars
│   ├── .env.example           # Template
│   ├── alembic/               # DB migrations
│   ├── Dockerfile
│   └── docker-compose.yml     # Local dev setup
│
├── frontend/                   # Next.js React
│   ├── src/
│   │   ├── app/
│   │   │   ├── layout.tsx
│   │   │   ├── page.tsx
│   │   │   ├── admin/
│   │   │   │   ├── page.tsx
│   │   │   │   └── add-product/
│   │   │   │       └── page.tsx
│   │   │   ├── search/
│   │   │   │   └── page.tsx
│   │   │   └── api/            # Optional: Next.js API routes
│   │   ├── components/
│   │   ├── lib/
│   │   │   └── api-client.ts  # Axios/fetch config
│   │   ├── hooks/
│   │   └── styles/
│   ├── public/
│   ├── package.json
│   ├── tsconfig.json
│   ├── next.config.js
│   ├── .env.local
│   ├── .env.local.example
│   ├── Dockerfile
│   └── .dockerignore
│
├── docker-compose.yml          # Local dev: FastAPI + PG + MinIO + Frontend
├── nginx.conf                  # VPS Nginx config
├── supervisor/
│   └── fastapi.conf            # VPS Supervisor config
├── .github/
│   └── workflows/
│       └── deploy.yml          # CI/CD (optional)
├── docs/
│   ├── LOCAL_SETUP.md
│   ├── VPS_DEPLOYMENT.md
│   └── MIGRATION_GUIDE.md
└── README.md
```

---

## 🔄 PHASE-BY-PHASE IMPLEMENTATION PLAN

### **PHASE 1: Database Migration (3-4 days)**

**Goal:** Replace MySQL with PostgreSQL + pgvector

**Files to create/modify:**

- `backend/db/models.py` - SQLAlchemy models
- `backend/db/database.py` - Connection setup
- `backend/alembic/versions/` - Migration scripts
- `.env` - Database credentials
- `docker-compose.yml` - PostgreSQL + MinIO services

**Key Changes:**

```python
# From: pymysql + manual SQL
# To: SQLAlchemy 2.0 + Pydantic

# Example model:
from sqlalchemy import Column, String, DateTime, func
from pgvector.sqlalchemy import Vector

class Image(Base):
    __tablename__ = "images"

    id = Column(Integer, primary_key=True)
    filename = Column(String(255), unique=True, index=True)
    sku = Column(String(100))
    brand = Column(String(255))
    product_name = Column(String(255))
    embedding = Column(Vector(512))  # pgvector!
    s3_url = Column(String(500))     # S3 path instead of BLOB
    created_at = Column(DateTime, server_default=func.now())
```

**Effort:** 3-4 days
**Risk:** Low (data migration tool available)

---

### **PHASE 2: Backend Refactoring (4-5 days)**

**Goal:** Convert to SQLAlchemy ORM + add proper dependency injection

**Files to update:**

- `backend/main.py` - Add SQLAlchemy setup, CORS for Next.js
- `backend/db_mysql.py` → `backend/db/queries.py` - Rewrite with SQLAlchemy
- `backend/embedder.py` - No changes needed!
- All API endpoints in `backend/api/`

**What stays the same:**

- ✅ FastAPI structure
- ✅ CLIP embeddings generation
- ✅ All API endpoints
- ✅ Admin/search/product logic

**What changes:**

- ✅ Replace pymysql with SQLAlchemy
- ✅ Replace manual SQL with ORM
- ✅ Better type hints
- ✅ Add async/await properly
- ✅ Add CORS headers for Next.js

**Effort:** 4-5 days
**Risk:** Low (logic stays same, just refactored)

---

### **PHASE 3: File Storage Migration (2 days)**

**Goal:** Move images from MySQL BLOB to S3/MinIO

**Setup:**

```bash
# Local development: MinIO (free S3 clone)
docker run -p 9000:9000 minio/minio server /data

# Production: Backblaze B2 Application Key
# Alternative: AWS S3 (but B2 is 6x cheaper!)
```

**Files to create:**

- `backend/core/storage.py` - S3 client wrapper
- Update product upload endpoint

**Changes:**

```python
# From: store image in MySQL BLOB
# To: upload to S3, store URL in DB

async def upload_product(file: UploadFile):
    # 1. Generate embedding
    embedding = image_embedding_pil(img)

    # 2. Upload to S3
    s3_url = await storage.upload(file.file, file.filename)

    # 3. Save metadata to DB (no BLOB)
    image = Image(
        filename=file.filename,
        embedding=embedding,
        s3_url=s3_url,  # Just store URL
        brand=brand,
        # ...
    )
```

**Effort:** 2 days
**Risk:** Low

---

### **PHASE 4: Frontend Migration (5-6 days)**

**Goal:** Convert Jinja2 templates + Vanilla JS to Next.js 14

**New files to create:**

```
frontend/src/app/
├── page.tsx                    # Landing page
├── layout.tsx                  # Root layout
├── search/page.tsx             # Search page
└── admin/
    ├── page.tsx                # Admin dashboard
    ├── add-product/
    │   └── page.tsx            # Add product form
    └── layout.tsx
```

**Component migration:**

- Admin page → React component
- Add product form → React component with form validation
- Search page → React component with image upload
- Header/Navigation → Reusable component

**Styling:**

- Remove custom CSS → TailwindCSS
- Much faster development!

**API Integration:**

```typescript
// frontend/lib/api-client.ts
const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export const apiClient = {
  search: (file: File) => {
    /* ... */
  },
  uploadProduct: (formData: FormData) => {
    /* ... */
  },
  getProducts: (page: number) => {
    /* ... */
  },
};
```

**Effort:** 5-6 days
**Risk:** Low (UI logic mostly portable)

---

### **PHASE 5: Docker & Local Development Setup (2 days)**

**Create `docker-compose.yml`:**

```yaml
version: "3.9"
services:
  postgres:
    image: pgvector/pgvector:pg15-latest
    ports:
      - "5432:5432"
    environment:
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: image_search_db
    volumes:
      - postgres_data:/var/lib/postgresql/data

  minio:
    image: minio/minio
    ports:
      - "9000:9000"
      - "9001:9001"
    environment:
      MINIO_ROOT_USER: minioadmin
      MINIO_ROOT_PASSWORD: minioadmin
    volumes:
      - minio_data:/data
    command: server /data --console-address ":9001"

  backend:
    build: ./backend
    ports:
      - "8000:8000"
    environment:
      DATABASE_URL: postgresql://postgres:postgres@postgres:5432/image_search_db
      S3_ENDPOINT: http://minio:9000
      PYTHONUNBUFFERED: 1
    depends_on:
      - postgres
      - minio
    volumes:
      - ./backend:/app
    command: uvicorn main:app --host 0.0.0.0 --reload

  frontend:
    build: ./frontend
    ports:
      - "3000:3000"
    environment:
      NEXT_PUBLIC_API_URL: http://localhost:8000
    depends_on:
      - backend
    volumes:
      - ./frontend:/app
    command: npm run dev

volumes:
  postgres_data:
  minio_data:
```

**Effort:** 2 days
**Risk:** Very Low

---

### **PHASE 6: VPS Deployment Setup (3 days)**

**Create deployment configuration:**

- `nginx.conf` - Reverse proxy setup
- `supervisor/fastapi.conf` - Process management
- `.env.production` - Production credentials
- Deployment scripts

**On Hostinger VPS (Ubuntu/Debian):**

```bash
# 1. SSH into VPS
ssh root@your-vps-ip

# 2. Install dependencies
sudo apt update
sudo apt install -y python3.11 python3-pip nodejs npm postgresql postgresql-contrib nginx supervisor git certbot python3-certbot-nginx

# 3. Clone your repo
cd /var/www
git clone https://github.com/yourusername/image-search-engine.git
cd image-search-engine

# 4. Setup backend
cd backend
python3.11 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

**Effort:** 3 days
**Risk:** Medium (VPS specific, but straightforward)

---

## 📊 COMPLETE TIMELINE

| Phase     | Task                | Timeline       | Risk           |
| --------- | ------------------- | -------------- | -------------- |
| 1         | Database Migration  | 3-4 days       | 🟢 Low         |
| 2         | Backend Refactoring | 4-5 days       | 🟢 Low         |
| 3         | Storage Migration   | 2 days         | 🟢 Low         |
| 4         | Frontend Migration  | 5-6 days       | 🟢 Low         |
| 5         | Docker Setup        | 2 days         | 🟢 Low         |
| 6         | VPS Deployment      | 3 days         | 🟡 Medium      |
| 7         | Testing + Buffer    | 2-3 days       | -              |
| **TOTAL** |                     | **21-25 days** | 🟢 Low Overall |

---

## 🚀 HOSTINGER VPS DEPLOYMENT CHECKLIST

### DNS & Domain Setup

- [ ] Point domain DNS to Hostinger VPS IP
- [ ] Wait for DNS propagation (24-48 hours)
- [ ] Test DNS: `nslookup yourdomain.com`

### Server Setup

- [ ] SSH access configured
- [ ] Firewall rules (port 80, 443 open)
- [ ] Install PostgreSQL (or use Hostinger managed DB)
- [ ] Install Nginx, Node.js, Python 3.11

### Backend Deployment

- [ ] Clone repo from GitHub
- [ ] Setup Python venv + install dependencies
- [ ] Configure `.env.production` with DB credentials
- [ ] Setup Supervisor for FastAPI (auto-restart on crash)
- [ ] Configure Gunicorn (production WSGI server)

### Frontend Deployment

- [ ] Build Next.js: `npm run build`
- [ ] Deploy built files (static + serverless functions)
- [ ] Point Nginx to Next.js output directory

### SSL/HTTPS

- [ ] Install Let's Encrypt certificate with Certbot
- [ ] Auto-renewal setup
- [ ] Redirect HTTP → HTTPS in Nginx

### Storage

- [ ] Create Backblaze B2 bucket
- [ ] Generate API key
- [ ] Configure in `.env.production`

### Monitoring & Backups

- [ ] Setup daily PostgreSQL backups
- [ ] Monitor disk space
- [ ] Setup log rotation
- [ ] Optional: Uptime monitoring (Pingdom, etc.)

---

## 📂 WHAT I'LL CREATE FOR YOU

When you're ready, I'll build:

1. ✅ **Backend refactored** with SQLAlchemy + async + pgvector
2. ✅ **Frontend** - Complete Next.js app (TypeScript + TailwindCSS)
3. ✅ **Docker setup** - Full docker-compose for local development
4. ✅ **Database migrations** - Alembic scripts for schema
5. ✅ **Storage layer** - S3 client for MinIO/B2
6. ✅ **Nginx config** - Ready for Hostinger
7. ✅ **Supervisor config** - Process management on VPS
8. ✅ **Deployment guide** - Step-by-step VPS setup
9. ✅ **Documentation** - All the setup instructions

---

## 💰 HOSTINGER VPS COST BREAKDOWN

| Item               | Monthly Cost      | Notes                    |
| ------------------ | ----------------- | ------------------------ |
| Hostinger VPS      | $3.99-$7.99       | Basic shared VPS         |
| Backblaze B2       | ~$0.006/GB upload | Very cheap storage       |
| Domain (if needed) | ~$1.99/year       | If not already purchased |
| **TOTAL**          | ~$5-10/month      | Extremely affordable!    |

**Note:** PostgreSQL and Nginx are free (included with Linux)

---

## 🎯 NEXT STEPS

1. **Do you want me to start implementation?** → Answer: YES or provide preferences
2. **Hostinger VPS specs?** → CPU cores, RAM, storage?
3. **Domain name?** → What's your domain?
4. **Storage preference?** → Backblaze B2 or AWS S3?
5. **Database preference?** → Managed DB or self-hosted PostgreSQL on VPS?

---

## ⚠️ IMPORTANT NOTES FOR HOSTINGER

✅ **Hostinger VPS advantages for this project:**

- Affordable ($3.99+)
- Root access (full control)
- Can run Docker (on higher tiers)
- Good for production Python apps
- Support team available

⚠️ **Keep in mind:**

- Entry-level plans are shared resources
- PostgreSQL + FastAPI need minimum 2GB RAM
- Recommend "VPS Premium" or higher plan
- Backup strategy is YOUR responsibility
- No managed Kubernetes (but not needed)

---

## 🔒 SECURITY BEST PRACTICES

1. **Environment variables** - Never commit `.env` or secrets
2. **Database credentials** - Use strong passwords
3. **API rate limiting** - Add to FastAPI
4. **CORS configuration** - Restrict to your domain only
5. **HTTPS everywhere** - Let's Encrypt (free)
6. **Regular backups** - Daily PostgreSQL dumps to B2
7. **Firewall rules** - Only ports 80, 443, 22 open

---

**Ready to begin Phase 1? Let me know and I'll start building! 🚀**
