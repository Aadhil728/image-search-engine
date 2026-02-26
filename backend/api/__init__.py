"""API routes package."""
from api.admin import router as admin_router
from api.products import router as products_router
from api.search import router as search_router
from api.inventory import router as inventory_router

__all__ = ["admin_router", "products_router", "search_router", "inventory_router"]
