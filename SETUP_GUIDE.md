# Image Search Engine - Complete Setup Guide

This project uses a **FastAPI backend** with a **Next.js frontend**. Both run separately on different ports.

## Architecture

```
┌─────────────────────────────────────────┐
│         Next.js Frontend                │
│    (http://localhost:3000)              │
│  - Landing page                         │
│  - Product upload form                  │
│  - Admin dashboard                      │
└────────────────┬────────────────────────┘
                 │
                 ↓ HTTP/REST API
┌─────────────────────────────────────────┐
│         FastAPI Backend                 │
│    (http://localhost:8000)              │
│  - Image upload & storage               │
│  - Embedding generation                 │
│  - MySQL database                       │
│  - Search API                           │
└─────────────────────────────────────────┘
```

## Prerequisites

- Python 3.10+
- Node.js 18+
- MySQL (Docker recommended)
- npm

## Quick Start

### 1. Start FastAPI Backend

```bash
cd image-search-engine  # Backend folder
pip install -r requirements.txt
uvicorn main:app --reload
```

Backend runs on: **http://localhost:8000**

### 2. Start Next.js Frontend

```bash
cd frontend  # Frontend folder
npm install
npm run dev
```

Frontend runs on: **http://localhost:3000**

## Features

### Frontend (Next.js)

**Landing Page (`/`)**
- Overview and navigation
- Quick links to upload and admin

**Product Upload (`/products`)**
- Multi-image upload with previews
- Metadata form:
  - SKU
  - Brand
  - Product Name
  - Date
  - Description
  - Price
- Real-time validation
- Upload progress indicator

**Admin Dashboard (`/admin`)**
- View all products
- Real-time statistics:
  - Total products
  - Indexed count
  - Recent uploads (7 days)
- Product management table
- Delete products

### Backend (FastAPI)

**Endpoints:**
- `POST /admin/upload` - Upload product images
- `GET /admin/images` - List all images
- `DELETE /api/admin/product/{filename}` - Delete product
- `PATCH /api/admin/product/{filename}` - Update product metadata
- `POST /search` - Search similar images
- `GET /api/admin/kpis` - Get dashboard stats
- `GET /image/{filename}` - Download image

**Features:**
- AI-powered image embeddings (CLIP)
- MySQL database storage
- Cosine similarity search
- CORS enabled for frontend

## Directory Structure

```
project-root/
├── image-search-engine/          # FastAPI Backend
│   ├── main.py                   # Main application
│   ├── embedder.py               # CLIP embeddings
│   ├── db_mysql.py               # Database layer
│   ├── build_index.py            # Index building
│   ├── requirements.txt          # Python dependencies
│   ├── index/                    # Embedding indexes
│   ├── scripts/                  # Utility scripts
│   ├── templates/                # HTML templates
│   ├── static/                   # CSS/JS assets
│   └── assets/                   # Images/logos
│
└── frontend/                      # Next.js Frontend
    ├── src/
    │   ├── app/
    │   │   ├── page.tsx          # Landing page
    │   │   ├── products/
    │   │   │   └── page.tsx      # Upload page
    │   │   ├── admin/
    │   │   │   └── page.tsx      # Admin dashboard
    │   │   ├── api/
    │   │   │   └── products/
    │   │   │       └── upload/
    │   │   │           └── route.ts
    │   │   └── layout.tsx
    │   ├── components/
    │   │   └── UploadForm.tsx
    │   └── globals.css
    ├── package.json
    ├── tsconfig.json
    ├── tailwind.config.ts
    ├── .env.local
    └── README.md
```

## Configuration

### Backend (.env or environment)

Create a `.env` file in the backend folder if needed:

```env
DATABASE_HOST=localhost
DATABASE_USER=root
DATABASE_PASSWORD=your_password
DATABASE_NAME=image_search_db
```

### Frontend (.env.local)

Already created in `frontend/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

## Database Setup

### Using Docker Compose (Recommended)

If you have a Docker setup:

```bash
docker-compose up -d mysql
```

### Manual MySQL Setup

1. Create database:
```sql
CREATE DATABASE image_search_db;
USE image_search_db;
```

2. Tables are auto-created by the backend on first run

## Environment Variables

### Production Deployment

**Backend:**
```env
DATABASE_HOST=your-db-host
DATABASE_USER=your-user
DATABASE_PASSWORD=your-password
```

**Frontend:**
```env
NEXT_PUBLIC_API_URL=https://your-api-domain.com
```

## Common Tasks

### Upload Products

1. Go to http://localhost:3000/products
2. Select images
3. Add metadata (optional)
4. Click "Upload Products"

### View Admin Dashboard

1. Go to http://localhost:3000/admin
2. View statistics and product list
3. Delete products if needed

### Rebuild Image Index

```bash
cd image-search-engine
python build_index.py
```

### Search Similar Images

Go to http://localhost:3000 and use the image search feature.

## Development

### Making Changes

**Backend Changes:**
- Edit files in `image-search-engine/`
- Server auto-reloads with `--reload` flag

**Frontend Changes:**
- Edit files in `frontend/src/`
- Hot reload automatically in dev mode

### Building for Production

**Backend:**
```bash
# No build needed, run with:
uvicorn main:app --host 0.0.0.0 --port 8000
```

**Frontend:**
```bash
cd frontend
npm run build
npm start
```

## Troubleshooting

### "Cannot find module 'fastapi'"

```bash
cd image-search-engine
pip install -r requirements.txt
```

### "Command 'npm' not found"

Install Node.js from https://nodejs.org/

### "Connection refused" when uploading

- Ensure FastAPI backend is running on port 8000
- Check `.env.local` in frontend has correct API URL
- Check CORS is enabled in main.py

### "Image not found in database"

- Verify MySQL is running
- Check database credentials in backend
- Run `python build_index.py` to rebuild

## Tech Stack

**Backend:**
- FastAPI (async web framework)
- PyMySQL (MySQL driver)
- Transformers + CLIP (image embeddings)
- NumPy (numerical computing)
- Pillow (image processing)

**Frontend:**
- Next.js 15 (React framework)
- TypeScript (type safety)
- Tailwind CSS (styling)
- App Router (modern routing)

## Performance Tips

1. **Image optimization:**
   - Upload optimized JPG/PNG files
   - Recommended: max 5MB per image

2. **Batch uploads:**
   - Upload multiple images at once
   - More efficient than single uploads

3. **Database:**
   - Keep MySQL well-maintained
   - Regular backups recommended

## Support & Documentation

- [FastAPI Docs](https://fastapi.tiangolo.com)
- [Next.js Docs](https://nextjs.org/docs)
- [CLIP Model](https://huggingface.co/openai/clip-vit-base-patch32)
- [Tailwind CSS](https://tailwindcss.com/docs)

## License

This project is provided as-is for educational and commercial use.
