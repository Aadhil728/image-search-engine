"""Product CRUD endpoints."""
from typing import List, Optional
from uuid import uuid4
from pydantic import BaseModel

from fastapi import APIRouter, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from db.models import Image
from db.database import async_session

router = APIRouter(prefix="/api/v1/products", tags=["products"])


class ProductUpdateRequest(BaseModel):
    sku: Optional[str] = None
    brand: Optional[str] = None
    product_name: Optional[str] = None
    product_date: Optional[str] = None
    description: Optional[str] = None
    price: Optional[float] = None


@router.post("/create", status_code=status.HTTP_201_CREATED)
async def create_product(
    filename: str,
    s3_url: str,
    sku: str = None,
    brand: str = None,
    product_name: str = None,
    product_date: str = None,
    description: str = None,
    price: float = None,
):
    """Create a new product/image record."""
    try:
        async with async_session() as session:
            product = Image(
                id=str(uuid4()),
                filename=filename,
                s3_url=s3_url,
                sku=sku,
                brand=brand,
                product_name=product_name,
                product_date=product_date,
                description=description,
                price=price,
            )
            session.add(product)
            await session.commit()
            await session.refresh(product)
            return {"status": "success", "product": product.to_dict()}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to create product: {str(e)}")


@router.get("/list")
async def list_products(skip: int = 0, limit: int = 50):
    """List all products."""
    try:
        async with async_session() as session:
            from sqlalchemy import select
            result = await session.execute(select(Image).offset(skip).limit(limit))
            products = result.scalars().all()
            return {
                "status": "success",
                "count": len(products),
                "products": [p.to_dict() for p in products],
            }
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to list products: {str(e)}")


@router.get("/{product_id}")
async def get_product(product_id: str):
    """Get a specific product by ID."""
    try:
        async with async_session() as session:
            from sqlalchemy import select
            result = await session.execute(select(Image).where(Image.id == product_id))
            product = result.scalar_one_or_none()
            
            if not product:
                raise HTTPException(status_code=404, detail="Product not found")
            
            return {"status": "success", "product": product.to_dict()}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to get product: {str(e)}")


@router.put("/{product_id}")
async def update_product(
    product_id: str,
    data: ProductUpdateRequest,
):
    """Update product details."""
    try:
        async with async_session() as session:
            from sqlalchemy import select
            result = await session.execute(select(Image).where(Image.id == product_id))
            product = result.scalar_one_or_none()
            
            if not product:
                raise HTTPException(status_code=404, detail="Product not found")
            
            # Update fields if provided
            if data.sku is not None:
                product.sku = data.sku
            if data.brand is not None:
                product.brand = data.brand
            if data.product_name is not None:
                product.product_name = data.product_name
            if data.product_date is not None:
                product.product_date = data.product_date
            if data.description is not None:
                product.description = data.description
            if data.price is not None:
                product.price = data.price
            
            await session.commit()
            await session.refresh(product)
            return {"status": "success", "product": product.to_dict()}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to update product: {str(e)}")


@router.delete("/{product_id}", status_code=status.HTTP_200_OK)
async def delete_product(product_id: str):
    """Delete a product by ID."""
    try:
        async with async_session() as session:
            from sqlalchemy import select
            result = await session.execute(select(Image).where(Image.id == product_id))
            product = result.scalar_one_or_none()
            
            if not product:
                raise HTTPException(status_code=404, detail="Product not found")
            
            await session.delete(product)
            await session.commit()
            return {"status": "success", "message": f"Product {product_id} deleted"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to delete product: {str(e)}")
