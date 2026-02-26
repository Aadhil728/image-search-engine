"""Admin endpoints for upload and management."""
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, status
from uuid import uuid4

router = APIRouter(prefix="/api/v1/admin", tags=["admin"])


@router.post("/upload", status_code=status.HTTP_201_CREATED)
async def upload_product(
    file: UploadFile = File(...),
    sku: str = Form(None),
    brand: str = Form(None),
    product_name: str = Form(None),
    product_date: str = Form(None),
    description: str = Form(None),
    price: float = Form(None),
):
    """
    Upload a new product image.
    
    - Accepts image file
    - Stores in MinIO S3 storage
    - Computes CLIP embedding
    - Creates database record with metadata
    """
    try:
        from io import BytesIO
        from core.storage import upload_to_minio
        from core.embedder import compute_image_embedding
        from db.models import Image
        from db.database import async_session
        from sqlalchemy.dialects.postgresql import insert
        import numpy as np
        
        # Generate unique ID and filename
        product_id = str(uuid4())
        file_extension = file.filename.split(".")[-1] if "." in file.filename else "jpg"
        s3_filename = f"{product_id}.{file_extension}"
        
        # Read file content once into memory
        content = await file.read()
        
        # Create two separate BytesIO objects - one for upload, one for embedding
        file_bytes_upload = BytesIO(content)
        file_bytes_embed = BytesIO(content)
        
        # Upload to MinIO
        s3_url = await upload_to_minio(
            bucket="image-search",
            file_key=s3_filename,
            file_data=file_bytes_upload,
            content_type=file.content_type or "image/jpeg"
        )
        
        # Compute CLIP embedding (using separate BytesIO)
        print(f"🔍 Computing embedding for: {file.filename}")
        embedding = await compute_image_embedding(file_bytes_embed)
        
        # Store in database with embedding
        async with async_session() as session:
            product = Image(
                id=product_id,
                filename=file.filename,
                s3_url=s3_url,
                sku=sku,
                brand=brand,
                product_name=product_name,
                product_date=product_date,
                description=description,
                price=price,
                embedding=embedding,  # Store normalized CLIP embedding
            )
            session.add(product)
            await session.commit()
            await session.refresh(product)
            
            return {
                "status": "success",
                "message": "Product uploaded successfully",
                "product": product.to_dict(),
                "s3_url": s3_url,
                "embedding_computed": True,
                "embedding_dimension": len(embedding),
            }
    except Exception as e:
        print(f"❌ Upload error: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Upload failed: {str(e)}"
        )


@router.delete("/product/{product_id}", status_code=status.HTTP_200_OK)
async def delete_product(product_id: str):
    """Delete a product and its associated files."""
    try:
        from core.storage import delete_from_minio
        from db.models import Image, InventoryStock, StockMovement, StockAlert, PurchaseOrderItem
        from db.database import async_session
        from sqlalchemy import select, delete as sql_delete
        
        async with async_session() as session:
            # Get product
            result = await session.execute(
                select(Image).where(Image.id == product_id)
            )
            product = result.scalar_one_or_none()
            
            if not product:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Product not found"
                )
            
            # Delete related inventory records first (foreign key constraints)
            # Delete stock alerts
            await session.execute(
                sql_delete(StockAlert).where(StockAlert.product_id == product_id)
            )
            
            # Delete stock movements
            await session.execute(
                sql_delete(StockMovement).where(StockMovement.product_id == product_id)
            )
            
            # Delete purchase order items
            await session.execute(
                sql_delete(PurchaseOrderItem).where(PurchaseOrderItem.product_id == product_id)
            )
            
            # Delete inventory stock
            await session.execute(
                sql_delete(InventoryStock).where(InventoryStock.product_id == product_id)
            )
            
            # Delete from MinIO if URL exists
            if product.s3_url:
                try:
                    s3_key = product.s3_url.split("/")[-1]
                    await delete_from_minio(bucket="image-search", file_key=s3_key)
                except Exception as e:
                    print(f"Warning: Failed to delete from MinIO: {e}")
            
            # Delete from database
            await session.delete(product)
            await session.commit()
            
            return {
                "status": "success",
                "message": f"Product {product_id} deleted successfully"
            }
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Delete error: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Delete failed: {str(e)}"
        )


@router.get("/stats")
async def admin_stats():
    """Get admin statistics."""
    try:
        from db.models import Image
        from db.database import async_session
        from sqlalchemy import select, func
        
        async with async_session() as session:
            # Count total products
            result = await session.execute(select(func.count(Image.id)))
            total_count = result.scalar() or 0
            
            return {
                "status": "success",
                "statistics": {
                    "total_products": total_count,
                    "storage_backend": "MinIO (S3-compatible)",
                    "database": "PostgreSQL 15",
                    "vector_support": "pgvector (Phase 2+)"
                }
            }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to get stats: {str(e)}"
        )
