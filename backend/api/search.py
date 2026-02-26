"""Search endpoint for vector similarity."""
from fastapi import APIRouter, HTTPException, UploadFile, File, status
from fastapi.responses import JSONResponse
import numpy as np
from io import BytesIO

router = APIRouter(prefix="/api/v1/search", tags=["search"])


@router.post("/")
async def search_similar(
    file: UploadFile = File(...),
    top_k: int = 5,
    threshold: float = 0.5,
):
    """
    Search for similar images using vector similarity.
    
    - Accepts an image file
    - Computes embedding using CLIP model
    - Returns top_k most similar products from database
    - Filters results by similarity threshold
    """
    try:
        from core.embedder import compute_image_embedding
        from db.database import async_session
        from db.models import Image as ImageModel
        from sqlalchemy import select, func, text
        
        # Read image file
        content = await file.read()
        image_bytes = BytesIO(content)
        
        # Compute embedding using CLIP
        print(f"🔍 Computing embedding for: {file.filename}")
        query_embedding = await compute_image_embedding(image_bytes)
        
        async with async_session() as session:
            # Query for similar images using vector distance
            # Simpler approach: fetch all products and compute similarities locally
            
            result = await session.execute(
                select(ImageModel)
            )
            products = result.scalars().all()
            
            # Compute similarities locally
            similarities = []
            for product in products:
                if product.embedding is not None:
                    try:
                        # Convert embedding to numpy array
                        # pgvector returns list or array, convert to float32 numpy array
                        if isinstance(product.embedding, list):
                            db_embedding = np.array(product.embedding, dtype=np.float32)
                        else:
                            db_embedding = np.array(product.embedding, dtype=np.float32)
                        
                        # Ensure query embedding is float32
                        query_emb_normalized = query_embedding.astype(np.float32)
                        
                        # Cosine similarity (dot product of normalized vectors)
                        similarity = float(np.dot(query_emb_normalized, db_embedding))
                        
                        if similarity >= threshold:
                            similarities.append((product, similarity))
                    except Exception as e:
                        print(f"⚠️ Error processing product {product.id}: {e}")
                        continue
            
            # Sort by similarity descending
            similarities.sort(key=lambda x: x[1], reverse=True)
            top_results = similarities[:top_k]
            
            return {
                "status": "success",
                "query_file": file.filename,
                "embedding_dimension": len(query_embedding),
                "top_k": top_k,
                "threshold": threshold,
                "results_count": len(top_results),
                "results": [
                    {
                        **p.to_dict(),
                        "similarity_score": float(score)
                    }
                    for p, score in top_results
                ],
            }
    except Exception as e:
        print(f"❌ Search error: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Search failed: {str(e)}"
        )


@router.get("/status")
async def search_status():
    """Get search engine status."""
    try:
        from core.embedder import get_embedder
        embedder = get_embedder()
        return {
            "status": "ready",
            "model": "OpenAI CLIP ViT-base-patch32",
            "vector_dimension": embedder.embedding_dim,
            "device": str(embedder.device),
            "similarity_metric": "cosine",
            "message": "Vector search enabled with pgvector"
        }
    except Exception as e:
        return {
            "status": "initializing",
            "model": "CLIP",
            "message": f"Loading: {str(e)}"
        }
