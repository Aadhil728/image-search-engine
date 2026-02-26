## Purpose
Short, practical guidance to help AI code assistants edit and extend this image-search project safely and effectively.

## Big picture
- Service: a FastAPI app exposing search and admin endpoints (`main.py`).
- Indexing: embeddings are stored in `index/embeddings.npy` and metadata in `index/meta.json` (see `build_index.py`).
- Embeddings: produced by `embedder.py` using a CLIP model; vectors are L2-normalized float32.
- Storage: two modes coexist — local `images_db/` file storage (used by some helpers) and MySQL as the canonical source of truth (`db_mysql.py`).

## Key files to read before editing
- `main.py` — primary server, mounts static assets, in-memory index lifecycle, admin endpoints (`/admin/upload`, `/admin/delete`, `/reindex`, `/search`).
- `build_index.py` — creates `index/embeddings.npy` and `index/meta.json` from MySQL via `db_mysql.get_all_embeddings()`.
- `embedder.py` — computes image embeddings (averages multiple crops/flips). Note `_device` is set to CPU; change to CUDA if GPU available.
- `db_mysql.py` — MySQL schema and helper functions. MySQL is the single source of truth for images and embeddings.
- `index/meta.json` — example metadata format: `{ "files": [ ... ] }` correlates row-wise with `embeddings.npy`.

## Project-specific conventions & invariants
- Embeddings MUST be L2-normalized (the code enforces this before saving and during queries). Keep `float32` dtype.
- Filenames are used as unique keys in MySQL (`filename` is UNIQUE). Avoid renaming files without updating DB or index.
- Admin upload flow writes embeddings into MySQL then updates the in-memory index immediately; disk persistence is done via `_save_index_to_disk()` (background task).
- `build_index.py` pulls embeddings from MySQL; running it and then `load_index_from_disk()` is the canonical reindex path for offline rebuilds.

## Common developer workflows (commands & endpoints)
- Run the app (development):
  - `python -m uvicorn main:app --reload --port 8000`
- Build index from DB (CLI):
  - `python build_index.py` (writes `index/embeddings.npy` and `index/meta.json`)
- Trigger reindex at runtime:
  - POST `/reindex` (calls `build_index_now()`)
- Upload via admin UI/API (stores in MySQL & updates in-memory index):
  - POST `/admin/upload` with multipart files
- Search (example):
  - POST `/search` with a multipart image file; query parameters `top_k`, `threshold` exist in `main.py`.

## Embedding & similarity details (important for correctness)
- `embedder.image_embedding_pil()` returns normalized vector (numpy float32). The app relies on normalization for cosine similarity.
- In `main.py`, similarity is computed via dot product; results are remapped to `[0,1]` as `scores01 = (sims + 1.0)/2.0`.
- `build_index.py` and `main._save_index_to_disk()` explicitly normalize before saving — preserve this when modifying save/load logic.

## Database notes & safety
- `db_mysql.DB_CONFIG` contains connection defaults; CI/devs should set secure credentials via environment or local overrides before connecting to production DB.
- `db_mysql.init_db()` is called on startup; it creates `images` table if missing. Be careful when changing schema; provide migrations and backward-compatible changes.
- Embeddings are stored as raw float32 bytes in `embedding` LONGBLOB column; any change to dtype/shape must include migration and `build_index.py` updates.

## Where to change behavior
- To switch to GPU inference: edit `_device` in `embedder.py` (e.g., `torch.device('cuda')`) and ensure runtime has CUDA + matching `torch`.
- To change indexing backend (faiss / approximate): `build_index.py` and `main.py` are the integration points — both expect a saved embeddings numpy array and meta file.

## Debugging tips
- Use printed log lines: `main.py` prints debug info for top matches and DB actions (search for `[DEBUG]`, `[DB]`, `[ERROR]`).
- If index not loading, check `index/embeddings.npy` and `index/meta.json` consistency (rows must match `files` length).
- To reproduce a fresh index locally: populate MySQL via `/admin/upload` or use a script to insert rows, then run `python build_index.py`.

## Examples to include in PRs
- Reference concrete files when changing logic: mention `main.py`, `embedder.py`, `build_index.py`, and `db_mysql.py` in the PR description.
- When adding fields to DB, include migration steps and update `db_mysql.init_db()` to keep compatibility.

---
If any area above is unclear or you want deeper examples (e.g., how to run a local MySQL container, or where to enable GPU), tell me which part to expand.
