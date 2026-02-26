"""Main FastAPI application."""
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from core.config import settings
from db.database import close_db, init_db
from api import admin_router, products_router, search_router, inventory_router

# Lifecycle events
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize and cleanup on startup/shutdown."""
    # Startup
    print("🚀 Starting up FastAPI application...")
    try:
        await init_db()
        print("✅ Database initialized successfully")
    except Exception as e:
        print(f"❌ Database initialization failed: {e}")
    
    # Ensure MinIO bucket is public for browser access
    try:
        from core.storage import ensure_bucket_public
        await ensure_bucket_public()
    except Exception as e:
        print(f"⚠️ MinIO bucket policy setup: {e}")
    
    yield
    
    # Shutdown
    print("🛑 Shutting down...")
    await close_db()
    print("✅ Shutdown complete")


# Create FastAPI app with CORS
app = FastAPI(
    title=settings.API_TITLE,
    version=settings.API_VERSION,
    lifespan=lifespan,
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API routers
app.include_router(admin_router)
app.include_router(products_router)
app.include_router(search_router)
app.include_router(inventory_router)


# Health check endpoint
@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return JSONResponse(
        status_code=200,
        content={"status": "ok", "message": "FastAPI backend is running"}
    )


# API v1 endpoints status
@app.get("/api/v1/status")
async def api_status():
    """API status endpoint with available endpoints."""
    return {
        "status": "operational",
        "version": settings.API_VERSION,
        "debug": settings.DEBUG,
        "endpoints": {
            "admin": {
                "POST /api/v1/admin/upload": "Upload new product image",
                "DELETE /api/v1/admin/product/{product_id}": "Delete product",
                "GET /api/v1/admin/stats": "Get admin statistics"
            },
            "products": {
                "POST /api/v1/products/create": "Create product record",
                "GET /api/v1/products/list": "List all products",
                "GET /api/v1/products/{product_id}": "Get product details",
                "PUT /api/v1/products/{product_id}": "Update product",
                "DELETE /api/v1/products/{product_id}": "Delete product"
            },
            "search": {
                "POST /api/v1/search/": "Search similar images",
                "GET /api/v1/search/status": "Search engine status"
            }
        },
        "database": "PostgreSQL 15",
        "storage": "MinIO S3-compatible",
        "docs": "/docs (Swagger UI)",
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.DEBUG,
    )
