# build_index.py
import os
import json
import numpy as np
from embedder import image_embedding_pil
import db_mysql

INDEX_DIR = "index"
EMB_PATH = os.path.join(INDEX_DIR, "embeddings.npy")
META_PATH = os.path.join(INDEX_DIR, "meta.json")


def load_existing_index():
    """Load existing index and metadata."""
    if os.path.exists(EMB_PATH) and os.path.exists(META_PATH):
        emb = np.load(EMB_PATH).astype(np.float32)
        with open(META_PATH, "r", encoding="utf-8") as f:
            meta = json.load(f)
        return emb, meta.get("files", [])
    return None, []


def build_index_incremental():
    """Build index from database - retrieves embeddings from MySQL."""
    os.makedirs(INDEX_DIR, exist_ok=True)

    # Get all embeddings and filenames from database
    embeddings, filenames = db_mysql.get_all_embeddings()
    
    if embeddings is None or len(filenames) == 0:
        print(f"[INFO] No images found in database")
        # Clear index if no files
        if os.path.exists(EMB_PATH):
            os.remove(EMB_PATH)
        if os.path.exists(META_PATH):
            os.remove(META_PATH)
        return

    print(f"[INFO] Building index from {len(filenames)} images in database...")
    
    # Ensure embeddings are normalized
    embeddings = np.asarray(embeddings, dtype=np.float32)
    if embeddings.ndim == 1:
        embeddings = embeddings.reshape(1, -1)
    norms = np.linalg.norm(embeddings, axis=1, keepdims=True)
    embeddings = embeddings / (norms + 1e-12)

    # Save index
    np.save(EMB_PATH, embeddings)
    with open(META_PATH, "w", encoding="utf-8") as f:
        json.dump({"files": filenames}, f, ensure_ascii=False, indent=2)

    print("\n✅ Done!")
    print(f"Saved: {EMB_PATH}")
    print(f"Saved: {META_PATH}")
    print(f"Total indexed: {len(filenames)}")


def main():
    build_index_incremental()


if __name__ == "__main__":
    main()
