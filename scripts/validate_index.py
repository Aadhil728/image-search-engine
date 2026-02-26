#!/usr/bin/env python3
"""
Quick validation script to check index integrity.
Verifies embeddings are normalized and match filenames.
"""
import os
import json
import numpy as np
from pathlib import Path

INDEX_DIR = Path("index")
EMB_PATH = INDEX_DIR / "embeddings.npy"
META_PATH = INDEX_DIR / "meta.json"

def validate():
    print("[*] Validating index...")
    
    if not EMB_PATH.exists():
        print("❌ embeddings.npy not found")
        return False
    
    if not META_PATH.exists():
        print("❌ meta.json not found")
        return False
    
    # Load embeddings
    try:
        emb = np.load(str(EMB_PATH))
        print(f"✓ Loaded embeddings: shape {emb.shape}, dtype {emb.dtype}")
    except Exception as e:
        print(f"❌ Failed to load embeddings: {e}")
        return False
    
    # Load metadata
    try:
        with open(META_PATH, "r") as f:
            meta = json.load(f)
        files = meta.get("files", [])
        print(f"✓ Loaded metadata: {len(files)} files")
    except Exception as e:
        print(f"❌ Failed to load metadata: {e}")
        return False
    
    # Check counts match
    if emb.shape[0] != len(files):
        print(f"❌ MISMATCH: {emb.shape[0]} embeddings vs {len(files)} files!")
        return False
    
    print(f"✓ Counts match: {emb.shape[0]} embeddings")
    
    # Check normalization
    norms = np.linalg.norm(emb, axis=1)
    mean_norm = np.mean(norms)
    min_norm = np.min(norms)
    max_norm = np.max(norms)
    print(f"✓ Embedding norms: mean={mean_norm:.4f}, min={min_norm:.4f}, max={max_norm:.4f}")
    if not (0.99 < mean_norm < 1.01):
        print(f"⚠ WARNING: Embeddings may not be normalized (mean norm ≠ 1.0)")
    
    # Check first few files
    print(f"\n✓ First 5 files in index:")
    for i, fname in enumerate(files[:5]):
        norm_i = norms[i]
        print(f"  [{i}] {fname} (norm={norm_i:.4f})")
    
    print("\n✅ Index validation complete!")
    return True

if __name__ == "__main__":
    validate()
