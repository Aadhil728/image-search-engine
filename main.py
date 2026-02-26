# main.py
import os
import json
import asyncio
import io
from pathlib import Path
from typing import List, Dict, Any, Optional

import numpy as np
from fastapi import FastAPI, Request, UploadFile, File, Query
from fastapi.responses import HTMLResponse, JSONResponse, FileResponse, StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
import imghdr
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from PIL import Image

from embedder import image_embedding_pil
from fastapi import Body
import db_mysql

BASE_DIR = Path(__file__).resolve().parent

STATIC_DIR = BASE_DIR / "static"
ASSETS_DIR = BASE_DIR / "assets"
TEMPLATES_DIR = BASE_DIR / "templates"
IMAGES_DB_DIR = BASE_DIR / "images_db"
UPLOADS_DIR = BASE_DIR / "uploads"
INDEX_DIR = BASE_DIR / "index"
EMB_PATH = INDEX_DIR / "embeddings.npy"
META_PATH = INDEX_DIR / "meta.json"

ALLOWED_EXT = {".jpg", ".jpeg", ".png", ".webp"}

app = FastAPI()

# Enable CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:8000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Static mounts - only static assets, not file storage
app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")
app.mount("/assets", StaticFiles(directory=str(ASSETS_DIR)), name="assets")

templates = Jinja2Templates(directory=str(TEMPLATES_DIR))


def _init_state() -> None:
    """Ensure `app.state` has storage for index and files."""
    app.state.db_emb = None  # type: Optional[np.ndarray]
    app.state.db_files = []  # type: List[str]


def load_index_from_disk() -> int:
    """Load index files into memory and return number of files indexed."""
    if not EMB_PATH.exists() or not META_PATH.exists():
        app.state.db_emb = None
        app.state.db_files = []
        return 0

    emb = np.load(str(EMB_PATH)).astype(np.float32)
    with open(META_PATH, "r", encoding="utf-8") as f:
        meta = json.load(f)
    files = meta.get("files", [])
    if emb is None or len(files) != emb.shape[0]:
        app.state.db_emb = None
        app.state.db_files = []
        return 0

    # Ensure row-wise L2-normalization (fixes issues if embeddings were modified)
    norms = np.linalg.norm(emb, axis=1, keepdims=True)
    emb = emb / (norms + 1e-12)

    app.state.db_emb = emb
    app.state.db_files = files
    return len(files)


def build_index_now() -> int:
    """Rebuild index from `images_db` folder (delegates to `build_index.py`)."""
    from build_index import main as build_main

    build_main()
    return load_index_from_disk()


@app.on_event("startup")
def _startup() -> None:
    INDEX_DIR.mkdir(parents=True, exist_ok=True)
    _init_state()
    
    # Initialize MySQL database
    try:
        db_mysql.init_db()
    except Exception as e:
        print(f"Warning: MySQL initialization failed: {e}")
    
    load_index_from_disk()


async def _read_upload_file_to_bytes(upload: UploadFile) -> bytes:
    """Read uploaded file to bytes without saving to disk. Uses async read."""
    content = await upload.read()
    try:
        await upload.close()
    except Exception:
        pass
    return content


def _create_query_embedding(path: Path) -> np.ndarray:
    img = Image.open(path)
    emb = image_embedding_pil(img)
    # ensure 1D float32 and normalized
    emb = np.asarray(emb, dtype=np.float32)
    if emb.ndim == 2 and emb.shape[0] == 1:
        emb = emb.reshape(-1)
    norm = np.linalg.norm(emb) + 1e-12
    emb = emb / norm
    return emb


def _find_top_matches(q_emb: np.ndarray, top_k: int):
    """Return tuple (idxs, scores01) of top-k matches by cosine similarity.

    Embeddings are expected to be L2-normalized; returns scores in [0,1].
    """
    db_emb: Optional[np.ndarray] = getattr(app.state, "db_emb", None)
    if db_emb is None or db_emb.size == 0:
        return np.array([], dtype=int), np.array([], dtype=float)
    # ensure q_emb is 1D float32 and normalized
    q = np.asarray(q_emb, dtype=np.float32).reshape(-1)
    q = q / (np.linalg.norm(q) + 1e-12)
    sims = np.dot(db_emb, q)
    scores01 = (sims + 1.0) / 2.0
    if top_k >= scores01.shape[0]:
        idxs = np.argsort(-scores01)
    else:
        # faster selection for large DBs
        idxs = np.argpartition(-scores01, top_k - 1)[:top_k]
        idxs = idxs[np.argsort(-scores01[idxs])]
    return idxs, scores01


async def _save_index_to_disk() -> None:
    """Async task to save current in-memory index to disk."""
    try:
        db_emb = getattr(app.state, "db_emb", None)
        db_files = getattr(app.state, "db_files", [])
        
        if db_emb is not None and len(db_files) > 0:
            INDEX_DIR.mkdir(parents=True, exist_ok=True)
            # Ensure row-wise normalization before saving
            emb_to_save = np.asarray(db_emb, dtype=np.float32)
            if emb_to_save.ndim == 1:
                emb_to_save = emb_to_save.reshape(1, -1)
            norms = np.linalg.norm(emb_to_save, axis=1, keepdims=True)
            emb_to_save = emb_to_save / (norms + 1e-12)
            np.save(str(EMB_PATH), emb_to_save)
            with open(META_PATH, "w", encoding="utf-8") as f:
                json.dump({"files": db_files}, f, ensure_ascii=False, indent=2)
    except Exception as e:
        print(f"[ERROR] Failed to save index: {e}")


@app.get("/image/{filename}")
async def get_image(filename: str):
    """Serve image file from MySQL database."""
    try:
        image_data = db_mysql.get_image_binary(filename)
        if image_data:
            # detect image type
            img_type = imghdr.what(None, h=image_data)
            if img_type == "jpeg":
                media_type = "image/jpeg"
            elif img_type == "png":
                media_type = "image/png"
            elif img_type == "gif":
                media_type = "image/gif"
            else:
                media_type = "application/octet-stream"

            return StreamingResponse(io.BytesIO(image_data), media_type=media_type)
    except Exception as e:
        print(f"[ERROR] Failed to fetch image {filename}: {e}")
    return JSONResponse(status_code=404, content={"error": "Image not found"})


@app.get("/landing", response_class=HTMLResponse)
async def landing(request: Request):
    return templates.TemplateResponse("landing.html", {"request": request})


@app.get("/", response_class=HTMLResponse)
async def home(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})


@app.post("/reindex")
async def reindex():
    count = build_index_now()
    return {"indexed": count}


# --- Admin CRUD endpoints -------------------------------------------------


@app.get("/admin", response_class=HTMLResponse)
async def admin_page(request: Request):
    return templates.TemplateResponse("admin.html", {"request": request})


@app.get("/add-product", response_class=HTMLResponse)
async def add_product_page(request: Request):
    return templates.TemplateResponse("add-product.html", {"request": request})


@app.get("/admin/dashboard", response_class=HTMLResponse)
async def admin_dashboard(request: Request):
    return templates.TemplateResponse("dashboard.html", {"request": request})


@app.get("/api/admin/kpis")
async def api_admin_kpis():
    try:
        total = db_mysql.count_images_in_db()
        indexed = db_mysql.count_indexed_images()
        # recent uploads last 7 days (approximation: count recent 7 entries)
        recent = len(db_mysql.get_recent_uploads(7))
        # placeholder for avg query time — not tracked yet
        avg_query_time = None
        return {"total_products": total, "indexed": indexed, "recent_uploads_7d": recent, "avg_query_time": avg_query_time}
    except Exception as e:
        print(f"[API ERROR] /api/admin/kpis: {e}")
        return {"total_products": 0, "indexed": 0, "recent_uploads_7d": 0, "avg_query_time": None}


@app.get("/api/admin/recent-uploads")
async def api_admin_recent_uploads(limit: int = 10):
    try:
        rows = db_mysql.get_recent_uploads(limit)
        return {"recent": rows}
    except Exception as e:
        print(f"[API ERROR] /api/admin/recent-uploads: {e}")
        return {"recent": []}


@app.get('/api/admin/products')
async def api_admin_products(q: str = None, brand: str = None, sku: str = None, page: int = 1, per_page: int = 25):
    try:
        res = db_mysql.get_products(q=q, brand=brand, sku=sku, page=page, per_page=per_page)
        # attach indexed count for dashboard convenience
        res['indexed'] = db_mysql.count_indexed_images()
        return res
    except Exception as e:
        print(f"[API ERROR] /api/admin/products: {e}")
        return {"items": [], "total": 0, "page": page, "per_page": per_page}


@app.patch('/api/admin/product/{filename}')
async def api_update_product(filename: str, payload: dict):
    # payload may contain sku, brand, name, date, description, price
    try:
        ok = db_mysql.update_image_metadata(filename,
                                           sku=payload.get('sku'),
                                           brand=payload.get('brand'),
                                           product_name=payload.get('name'),
                                           product_date=payload.get('date'),
                                           description=payload.get('description'),
                                           price=payload.get('price'))
        return {"ok": bool(ok)}
    except Exception as e:
        print(f"[API ERROR] patch product {filename}: {e}")
        return {"ok": False}


@app.delete('/api/admin/product/{filename}')
async def api_delete_product(filename: str):
    """Delete a single product (image + metadata) via API and update in-memory index."""
    try:
        ok = db_mysql.delete_image_from_db(filename)
        # update in-memory index if present
        db_files = getattr(app.state, 'db_files', [])
        db_emb = getattr(app.state, 'db_emb', None)
        if ok and filename in db_files:
            idx = db_files.index(filename)
            # remove from lists
            if db_emb is not None and db_emb.size > 0:
                mask = [i for i in range(len(db_files)) if i != idx]
                if mask:
                    app.state.db_emb = db_emb[mask].astype(np.float32)
                    app.state.db_files = [db_files[i] for i in mask]
                else:
                    app.state.db_emb = None
                    app.state.db_files = []
            else:
                app.state.db_files = [f for f in db_files if f != filename]
            # persist
            asyncio.create_task(_save_index_to_disk())
        return {"ok": bool(ok)}
    except Exception as e:
        print(f"[API ERROR] delete product {filename}: {e}")
        return {"ok": False}


@app.get("/admin/images")
async def admin_list_images():
    # Always fetch from MySQL database (real-time source of truth)
    try:
        files = db_mysql.get_all_images_with_meta()
        count = db_mysql.count_images_in_db()
        print(f"[ADMIN] Fetched {count} images from database")
        return {"files": files, "indexed": count}
    except Exception as e:
        print(f"[DB ERROR] Failed to fetch from MySQL: {e}")
        import traceback
        traceback.print_exc()
        return {"files": [], "indexed": 0}


@app.post("/admin/upload")
async def admin_upload(request: Request, files: list[UploadFile] = File(...)):
    """Upload images to database only (no local storage) and update index in real-time."""
    saved: list[str] = []
    embeddings_to_add = []
    # Read optional metadata fields from form (applied to all uploaded files)
    try:
        form = await request.form()
    except Exception:
        form = {}

    sku = form.get("sku")
    brand = form.get("brand")
    product_name = form.get("name")
    product_date = form.get("date")
    description = form.get("description")
    price = form.get("price")

    # Process files: generate embeddings and store in database only (no local disk storage)
    for up in files:
        name = os.path.basename(up.filename or "upload.png")
        content = await up.read()
        
        try:
            # Generate embedding from bytes in memory
            img = Image.open(io.BytesIO(content))
            emb = image_embedding_pil(img)
            embeddings_to_add.append((name, emb))
            saved.append(name)
            
            # Store in MySQL database only (pass content bytes + metadata)
            try:
                db_mysql.add_image_to_db(name, content, emb, sku=sku, brand=brand, product_name=product_name, product_date=product_date, description=description, price=price)
                print(f"[DB] Stored in MySQL: {name}")
            except Exception as e:
                print(f"[DB ERROR] Failed to store {name} in MySQL: {e}")
        except Exception as e:
            print(f"[ERROR] Failed to embed {name}: {e}")
    
    # Update in-memory index immediately (no wait!)
    if embeddings_to_add:
        db_emb = getattr(app.state, "db_emb", None)
        db_files = getattr(app.state, "db_files", [])

        # Prepare lists for appending
        append_names = []
        append_embs = []

        # If db_emb exists, allow in-place replacement for files with same name
        for name, emb in embeddings_to_add:
            if name in db_files:
                # replace existing embedding at same index
                idx = db_files.index(name)
                if db_emb is None:
                    # should not happen, but handle gracefully
                    db_emb = np.expand_dims(emb, axis=0)
                else:
                    db_emb[idx] = emb
            else:
                append_names.append(name)
                append_embs.append(emb)

        # Append new files if any
        if append_names:
            new_embs = np.vstack(append_embs).astype(np.float32)
            if db_emb is not None and db_emb.size > 0:
                app.state.db_emb = np.vstack([db_emb, new_embs]).astype(np.float32)
                app.state.db_files = db_files + append_names
            else:
                app.state.db_emb = new_embs
                app.state.db_files = append_names
        else:
            # only replacements happened
            app.state.db_emb = db_emb
            app.state.db_files = db_files

        # Save to disk in background (non-blocking)
        asyncio.create_task(_save_index_to_disk())
    
    indexed = len(getattr(app.state, "db_files", []))
    return {"saved": saved, "indexed": indexed}


@app.post("/admin/delete")
async def admin_delete(payload: dict = Body(...)):
    """Delete files and update index in real-time (instantly in-memory)."""
    names = payload.get("filenames") or []
    removed: list[str] = []
    errors: dict = {}
    
    db_files = getattr(app.state, "db_files", [])
    db_emb = getattr(app.state, "db_emb", None)
    
    # Find indices to remove
    indices_to_keep = []
    for i, fname in enumerate(db_files):
        if fname not in names:
            indices_to_keep.append(i)
        else:
            removed.append(fname)
    
    # Delete from MySQL database (no local file storage used)
    for n in removed:
        try:
            db_mysql.delete_image_from_db(n)
            print(f"[DB] Deleted from MySQL: {n}")
        except Exception as e:
            errors[n] = str(e)
    
    # Update in-memory index immediately (no wait!)
    if removed and db_emb is not None and len(indices_to_keep) > 0:
        app.state.db_emb = db_emb[indices_to_keep].astype(np.float32)
        app.state.db_files = [db_files[i] for i in indices_to_keep]
    elif not indices_to_keep:
        # All deleted
        app.state.db_emb = None
        app.state.db_files = []
    
    # Save to disk in background (non-blocking)
    if removed:
        asyncio.create_task(_save_index_to_disk())
    
    indexed = len(getattr(app.state, "db_files", []))
    return {"removed": removed, "errors": errors, "indexed": indexed}


@app.post("/search")
async def search_image(
    file: UploadFile = File(...),
    top_k: int = Query(10000, ge=1),
    threshold: float = Query(0.80, ge=0.0, le=1.0),
):
    """Search uploaded image against the in-memory index and return matches."""
    db_emb: Optional[np.ndarray] = getattr(app.state, "db_emb", None)
    db_files: List[str] = getattr(app.state, "db_files", [])

    if db_emb is None or not db_files:
        return JSONResponse(
            status_code=200,
            content={
                "indexed": 0,
                "top_k": top_k,
                "threshold": threshold,
                "query_url": None,
                "results": [],
                "message": "Index not found. Run: python build_index.py (or call /reindex).",
            },
        )

    try:
        file_bytes = await _read_upload_file_to_bytes(file)
        img = Image.open(io.BytesIO(file_bytes))
    except Exception as e:
        print(f"[ERROR] failed reading upload file: {e}")
        return JSONResponse(status_code=500, content={"message": "Failed to read uploaded file."})

    try:
        emb = image_embedding_pil(img)
        # ensure 1D float32 and normalized
        q_emb = np.asarray(emb, dtype=np.float32)
        if q_emb.ndim == 2 and q_emb.shape[0] == 1:
            q_emb = q_emb.reshape(-1)
        norm = np.linalg.norm(q_emb) + 1e-12
        q_emb = q_emb / norm
    except Exception as e:
        print(f"[ERROR] failed creating query embedding: {e}")
        return JSONResponse(status_code=500, content={"message": "Failed to compute image embedding. Ensure the file is a valid image."})

    idxs, scores01 = _find_top_matches(q_emb, top_k)

    # Debug: log top indices and corresponding filenames/scores
    try:
        top_debug = []
        for ii in idxs:
            i_idx = int(ii)
            sc = float(scores01[i_idx])
            top_debug.append((i_idx, db_files[i_idx], sc))
        print(f"[DEBUG] search top matches: {top_debug}")
    except Exception as _:
        pass

    results: List[Dict[str, Any]] = []
    for i in idxs:
        score = float(scores01[i])
        if score >= threshold:
            fname = db_files[int(i)]
            # enrich with metadata when available
            meta = db_mysql.get_metadata_for_image(fname) or {}
            results.append({"filename": fname, "score": score, "url": f"/image/{fname}", "meta": meta})
    message: Optional[str] = None
    if not results:
        message = "No matching images found."

    best_score: Optional[float] = None
    if scores01.size:
        best_score = float(np.max(scores01))

    return {
        "indexed": int(db_emb.shape[0]),
        "top_k": top_k,
        "threshold": threshold,
        "query_url": None,
        "results": results,
        "best_score": best_score,
        "message": message,
    }
