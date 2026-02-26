"""
Inventory Management API endpoints.
Handles stock management, movements, suppliers, warehouses, and reports.
"""
from datetime import datetime, timedelta
from typing import List, Optional
from decimal import Decimal
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_, desc, asc, case
from sqlalchemy.orm import selectinload
from pydantic import BaseModel, Field

from db.database import get_session
from db.models import (
    Image, Category, Supplier, Warehouse, 
    InventoryStock, StockMovement, PurchaseOrder, 
    PurchaseOrderItem, StockAlert
)

router = APIRouter(prefix="/api/v1/inventory", tags=["Inventory"])


# ============================================================
# PYDANTIC SCHEMAS
# ============================================================

# Category Schemas
class CategoryCreate(BaseModel):
    name: str
    slug: str
    description: Optional[str] = None
    parent_id: Optional[int] = None
    is_active: bool = True
    sort_order: int = 0


class CategoryUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    parent_id: Optional[int] = None
    is_active: Optional[bool] = None
    sort_order: Optional[int] = None


# Supplier Schemas
class SupplierCreate(BaseModel):
    code: str
    name: str
    contact_person: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    country: Optional[str] = None
    payment_terms: Optional[str] = None
    lead_time_days: int = 7
    notes: Optional[str] = None


class SupplierUpdate(BaseModel):
    name: Optional[str] = None
    contact_person: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    country: Optional[str] = None
    payment_terms: Optional[str] = None
    lead_time_days: Optional[int] = None
    is_active: Optional[bool] = None
    notes: Optional[str] = None


# Warehouse Schemas
class WarehouseCreate(BaseModel):
    code: str
    name: str
    address: Optional[str] = None
    city: Optional[str] = None
    country: Optional[str] = None
    manager_name: Optional[str] = None
    phone: Optional[str] = None
    is_default: bool = False


class WarehouseUpdate(BaseModel):
    name: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    country: Optional[str] = None
    manager_name: Optional[str] = None
    phone: Optional[str] = None
    is_active: Optional[bool] = None
    is_default: Optional[bool] = None


# Stock Schemas
class StockCreate(BaseModel):
    product_id: str
    warehouse_id: int
    category_id: Optional[int] = None
    supplier_id: Optional[int] = None
    quantity_on_hand: int = 0
    reorder_point: int = 10
    reorder_quantity: int = 50
    safety_stock: int = 5
    max_stock_level: int = 500
    unit_cost: float = 0
    bin_location: Optional[str] = None


class StockUpdate(BaseModel):
    category_id: Optional[int] = None
    supplier_id: Optional[int] = None
    reorder_point: Optional[int] = None
    reorder_quantity: Optional[int] = None
    safety_stock: Optional[int] = None
    max_stock_level: Optional[int] = None
    unit_cost: Optional[float] = None
    bin_location: Optional[str] = None


# Stock Movement Schemas
class StockMovementCreate(BaseModel):
    movement_type: str  # stock_in, stock_out, adjustment, etc.
    product_id: str
    warehouse_id: int
    quantity: int
    supplier_id: Optional[int] = None
    to_warehouse_id: Optional[int] = None  # For transfers
    unit_cost: Optional[float] = None
    document_type: Optional[str] = None
    document_number: Optional[str] = None
    reason: Optional[str] = None
    notes: Optional[str] = None
    performed_by: Optional[str] = None
    batch_number: Optional[str] = None


# Purchase Order Schemas
class POItemCreate(BaseModel):
    product_id: str
    quantity_ordered: int
    unit_price: float
    notes: Optional[str] = None


class PurchaseOrderCreate(BaseModel):
    supplier_id: int
    warehouse_id: int
    expected_date: Optional[datetime] = None
    items: List[POItemCreate]
    notes: Optional[str] = None
    created_by: Optional[str] = None


# ============================================================
# HELPER FUNCTIONS
# ============================================================

def generate_reference_number(prefix: str = "MOV") -> str:
    """Generate unique reference number."""
    timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
    unique_id = str(uuid.uuid4())[:6].upper()
    return f"{prefix}-{timestamp}-{unique_id}"


def generate_po_number() -> str:
    """Generate unique PO number."""
    timestamp = datetime.now().strftime("%Y%m%d")
    unique_id = str(uuid.uuid4())[:6].upper()
    return f"PO-{timestamp}-{unique_id}"


# ============================================================
# CATEGORY ENDPOINTS
# ============================================================

@router.get("/categories")
async def list_categories(
    skip: int = 0,
    limit: int = 100,
    is_active: Optional[bool] = None,
    session: AsyncSession = Depends(get_session)
):
    """List all categories."""
    query = select(Category).order_by(Category.sort_order, Category.name)
    
    if is_active is not None:
        query = query.where(Category.is_active == is_active)
    
    query = query.offset(skip).limit(limit)
    result = await session.execute(query)
    categories = result.scalars().all()
    
    return {
        "count": len(categories),
        "categories": [c.to_dict() for c in categories]
    }


@router.post("/categories")
async def create_category(
    data: CategoryCreate,
    session: AsyncSession = Depends(get_session)
):
    """Create a new category."""
    category = Category(**data.model_dump())
    session.add(category)
    await session.commit()
    await session.refresh(category)
    return category.to_dict()


@router.put("/categories/{category_id}")
async def update_category(
    category_id: int,
    data: CategoryUpdate,
    session: AsyncSession = Depends(get_session)
):
    """Update a category."""
    result = await session.execute(select(Category).where(Category.id == category_id))
    category = result.scalar_one_or_none()
    
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")
    
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(category, key, value)
    
    await session.commit()
    await session.refresh(category)
    return category.to_dict()


@router.delete("/categories/{category_id}")
async def delete_category(
    category_id: int,
    session: AsyncSession = Depends(get_session)
):
    """Delete a category (soft delete - sets is_active to False)."""
    result = await session.execute(select(Category).where(Category.id == category_id))
    category = result.scalar_one_or_none()
    
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")
    
    category.is_active = False
    await session.commit()
    return {"message": "Category deactivated successfully"}


# ============================================================
# SUPPLIER ENDPOINTS
# ============================================================

@router.get("/suppliers")
async def list_suppliers(
    skip: int = 0,
    limit: int = 100,
    is_active: Optional[bool] = None,
    search: Optional[str] = None,
    session: AsyncSession = Depends(get_session)
):
    """List all suppliers."""
    query = select(Supplier).order_by(Supplier.name)
    
    if is_active is not None:
        query = query.where(Supplier.is_active == is_active)
    
    if search:
        query = query.where(
            or_(
                Supplier.name.ilike(f"%{search}%"),
                Supplier.code.ilike(f"%{search}%")
            )
        )
    
    query = query.offset(skip).limit(limit)
    result = await session.execute(query)
    suppliers = result.scalars().all()
    
    return {
        "count": len(suppliers),
        "suppliers": [s.to_dict() for s in suppliers]
    }


@router.post("/suppliers")
async def create_supplier(
    data: SupplierCreate,
    session: AsyncSession = Depends(get_session)
):
    """Create a new supplier."""
    supplier = Supplier(**data.model_dump())
    session.add(supplier)
    await session.commit()
    await session.refresh(supplier)
    return supplier.to_dict()


@router.get("/suppliers/{supplier_id}")
async def get_supplier(
    supplier_id: int,
    session: AsyncSession = Depends(get_session)
):
    """Get supplier details."""
    result = await session.execute(select(Supplier).where(Supplier.id == supplier_id))
    supplier = result.scalar_one_or_none()
    
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")
    
    return supplier.to_dict()


@router.put("/suppliers/{supplier_id}")
async def update_supplier(
    supplier_id: int,
    data: SupplierUpdate,
    session: AsyncSession = Depends(get_session)
):
    """Update a supplier."""
    result = await session.execute(select(Supplier).where(Supplier.id == supplier_id))
    supplier = result.scalar_one_or_none()
    
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")
    
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(supplier, key, value)
    
    await session.commit()
    await session.refresh(supplier)
    return supplier.to_dict()


# ============================================================
# WAREHOUSE ENDPOINTS
# ============================================================

@router.get("/warehouses")
async def list_warehouses(
    skip: int = 0,
    limit: int = 100,
    is_active: Optional[bool] = None,
    session: AsyncSession = Depends(get_session)
):
    """List all warehouses."""
    query = select(Warehouse).order_by(Warehouse.name)
    
    if is_active is not None:
        query = query.where(Warehouse.is_active == is_active)
    
    query = query.offset(skip).limit(limit)
    result = await session.execute(query)
    warehouses = result.scalars().all()
    
    return {
        "count": len(warehouses),
        "warehouses": [w.to_dict() for w in warehouses]
    }


@router.post("/warehouses")
async def create_warehouse(
    data: WarehouseCreate,
    session: AsyncSession = Depends(get_session)
):
    """Create a new warehouse."""
    warehouse = Warehouse(**data.model_dump())
    session.add(warehouse)
    await session.commit()
    await session.refresh(warehouse)
    return warehouse.to_dict()


@router.get("/warehouses/{warehouse_id}")
async def get_warehouse(
    warehouse_id: int,
    session: AsyncSession = Depends(get_session)
):
    """Get warehouse details."""
    result = await session.execute(select(Warehouse).where(Warehouse.id == warehouse_id))
    warehouse = result.scalar_one_or_none()
    
    if not warehouse:
        raise HTTPException(status_code=404, detail="Warehouse not found")
    
    return warehouse.to_dict()


@router.put("/warehouses/{warehouse_id}")
async def update_warehouse(
    warehouse_id: int,
    data: WarehouseUpdate,
    session: AsyncSession = Depends(get_session)
):
    """Update a warehouse."""
    result = await session.execute(select(Warehouse).where(Warehouse.id == warehouse_id))
    warehouse = result.scalar_one_or_none()
    
    if not warehouse:
        raise HTTPException(status_code=404, detail="Warehouse not found")
    
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(warehouse, key, value)
    
    await session.commit()
    await session.refresh(warehouse)
    return warehouse.to_dict()


# ============================================================
# INVENTORY STOCK ENDPOINTS
# ============================================================

@router.get("/stock")
async def list_stock(
    skip: int = 0,
    limit: int = 100,
    warehouse_id: Optional[int] = None,
    category_id: Optional[int] = None,
    supplier_id: Optional[int] = None,
    low_stock_only: bool = False,
    search: Optional[str] = None,
    session: AsyncSession = Depends(get_session)
):
    """List inventory stock with filters."""
    query = select(InventoryStock).options(
        selectinload(InventoryStock.product),
        selectinload(InventoryStock.warehouse),
        selectinload(InventoryStock.category),
        selectinload(InventoryStock.supplier)
    )
    
    if warehouse_id:
        query = query.where(InventoryStock.warehouse_id == warehouse_id)
    if category_id:
        query = query.where(InventoryStock.category_id == category_id)
    if supplier_id:
        query = query.where(InventoryStock.supplier_id == supplier_id)
    if low_stock_only:
        query = query.where(InventoryStock.quantity_on_hand <= InventoryStock.reorder_point)
    
    query = query.offset(skip).limit(limit)
    result = await session.execute(query)
    stocks = result.scalars().all()
    
    stock_list = []
    for stock in stocks:
        stock_dict = stock.to_dict()
        stock_dict["product"] = stock.product.to_dict() if stock.product else None
        stock_dict["warehouse"] = stock.warehouse.to_dict() if stock.warehouse else None
        stock_dict["category"] = stock.category.to_dict() if stock.category else None
        stock_dict["supplier"] = stock.supplier.to_dict() if stock.supplier else None
        stock_list.append(stock_dict)
    
    return {
        "count": len(stock_list),
        "stock": stock_list
    }


@router.post("/stock")
async def create_stock(
    data: StockCreate,
    session: AsyncSession = Depends(get_session)
):
    """Create inventory stock record for a product."""
    # Check if product exists
    result = await session.execute(select(Image).where(Image.id == data.product_id))
    product = result.scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    # Check if warehouse exists
    result = await session.execute(select(Warehouse).where(Warehouse.id == data.warehouse_id))
    warehouse = result.scalar_one_or_none()
    if not warehouse:
        raise HTTPException(status_code=404, detail="Warehouse not found")
    
    # Check if stock record already exists
    result = await session.execute(
        select(InventoryStock).where(
            and_(
                InventoryStock.product_id == data.product_id,
                InventoryStock.warehouse_id == data.warehouse_id
            )
        )
    )
    existing = result.scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=400, detail="Stock record already exists for this product/warehouse")
    
    stock = InventoryStock(
        **data.model_dump(),
        quantity_available=data.quantity_on_hand,
        average_cost=data.unit_cost
    )
    session.add(stock)
    await session.commit()
    await session.refresh(stock)
    return stock.to_dict()


@router.get("/stock/{stock_id}")
async def get_stock(
    stock_id: int,
    session: AsyncSession = Depends(get_session)
):
    """Get stock details."""
    result = await session.execute(
        select(InventoryStock)
        .options(
            selectinload(InventoryStock.product),
            selectinload(InventoryStock.warehouse)
        )
        .where(InventoryStock.id == stock_id)
    )
    stock = result.scalar_one_or_none()
    
    if not stock:
        raise HTTPException(status_code=404, detail="Stock record not found")
    
    stock_dict = stock.to_dict()
    stock_dict["product"] = stock.product.to_dict() if stock.product else None
    stock_dict["warehouse"] = stock.warehouse.to_dict() if stock.warehouse else None
    return stock_dict


@router.put("/stock/{stock_id}")
async def update_stock(
    stock_id: int,
    data: StockUpdate,
    session: AsyncSession = Depends(get_session)
):
    """Update stock settings (not quantities - use movements for that)."""
    result = await session.execute(select(InventoryStock).where(InventoryStock.id == stock_id))
    stock = result.scalar_one_or_none()
    
    if not stock:
        raise HTTPException(status_code=404, detail="Stock record not found")
    
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(stock, key, value)
    
    await session.commit()
    await session.refresh(stock)
    return stock.to_dict()


@router.get("/stock/product/{product_id}")
async def get_stock_by_product(
    product_id: str,
    session: AsyncSession = Depends(get_session)
):
    """Get all stock records for a product across warehouses."""
    result = await session.execute(
        select(InventoryStock)
        .options(selectinload(InventoryStock.warehouse))
        .where(InventoryStock.product_id == product_id)
    )
    stocks = result.scalars().all()
    
    total_on_hand = sum(s.quantity_on_hand for s in stocks)
    total_available = sum(s.quantity_available for s in stocks)
    
    return {
        "product_id": product_id,
        "total_on_hand": total_on_hand,
        "total_available": total_available,
        "warehouses": [
            {
                **s.to_dict(),
                "warehouse": s.warehouse.to_dict() if s.warehouse else None
            }
            for s in stocks
        ]
    }


# ============================================================
# STOCK MOVEMENT ENDPOINTS
# ============================================================

@router.get("/movements")
async def list_movements(
    skip: int = 0,
    limit: int = 100,
    product_id: Optional[str] = None,
    warehouse_id: Optional[int] = None,
    movement_type: Optional[str] = None,
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
    session: AsyncSession = Depends(get_session)
):
    """List stock movements with filters."""
    query = select(StockMovement).options(
        selectinload(StockMovement.product),
        selectinload(StockMovement.warehouse)
    ).order_by(desc(StockMovement.movement_date))
    
    if product_id:
        query = query.where(StockMovement.product_id == product_id)
    if warehouse_id:
        query = query.where(StockMovement.warehouse_id == warehouse_id)
    if movement_type:
        query = query.where(StockMovement.movement_type == movement_type)
    if date_from:
        query = query.where(StockMovement.movement_date >= date_from)
    if date_to:
        query = query.where(StockMovement.movement_date <= date_to)
    
    query = query.offset(skip).limit(limit)
    result = await session.execute(query)
    movements = result.scalars().all()
    
    movement_list = []
    for m in movements:
        m_dict = m.to_dict()
        m_dict["product"] = m.product.to_dict() if m.product else None
        m_dict["warehouse"] = m.warehouse.to_dict() if m.warehouse else None
        movement_list.append(m_dict)
    
    return {
        "count": len(movement_list),
        "movements": movement_list
    }


@router.post("/movements")
async def create_movement(
    data: StockMovementCreate,
    session: AsyncSession = Depends(get_session)
):
    """Create a stock movement (stock in, stock out, adjustment, etc.)."""
    # Get current stock
    result = await session.execute(
        select(InventoryStock).where(
            and_(
                InventoryStock.product_id == data.product_id,
                InventoryStock.warehouse_id == data.warehouse_id
            )
        )
    )
    stock = result.scalar_one_or_none()
    
    if not stock:
        raise HTTPException(
            status_code=404, 
            detail="No stock record found for this product/warehouse. Create stock record first."
        )
    
    # Determine quantity change
    quantity_change = data.quantity
    if data.movement_type in ["stock_out", "damage", "loss", "return_out"]:
        quantity_change = -abs(data.quantity)
        if stock.quantity_on_hand + quantity_change < 0:
            raise HTTPException(
                status_code=400, 
                detail=f"Insufficient stock. Available: {stock.quantity_on_hand}"
            )
    elif data.movement_type in ["stock_in", "return_in"]:
        quantity_change = abs(data.quantity)
    
    # Record movement
    movement = StockMovement(
        reference_number=generate_reference_number(),
        movement_type=data.movement_type,
        status="completed",
        product_id=data.product_id,
        warehouse_id=data.warehouse_id,
        supplier_id=data.supplier_id,
        to_warehouse_id=data.to_warehouse_id,
        quantity=quantity_change,
        quantity_before=stock.quantity_on_hand,
        quantity_after=stock.quantity_on_hand + quantity_change,
        unit_cost=Decimal(str(data.unit_cost)) if data.unit_cost else stock.unit_cost,
        total_cost=Decimal(str(data.unit_cost or float(stock.unit_cost))) * abs(quantity_change),
        document_type=data.document_type,
        document_number=data.document_number,
        reason=data.reason,
        notes=data.notes,
        performed_by=data.performed_by,
        batch_number=data.batch_number
    )
    session.add(movement)
    
    # Update stock
    stock.quantity_on_hand += quantity_change
    stock.quantity_available = stock.quantity_on_hand - stock.quantity_reserved
    stock.last_movement_date = datetime.now()
    
    # Update average cost for stock_in
    if data.movement_type == "stock_in" and data.unit_cost:
        # Weighted average cost calculation
        old_value = float(stock.average_cost or 0) * (stock.quantity_on_hand - quantity_change)
        new_value = data.unit_cost * quantity_change
        stock.average_cost = Decimal(str((old_value + new_value) / stock.quantity_on_hand))
        stock.unit_cost = Decimal(str(data.unit_cost))
    
    # Handle transfer to another warehouse
    if data.movement_type == "transfer" and data.to_warehouse_id:
        # Get or create destination stock
        result = await session.execute(
            select(InventoryStock).where(
                and_(
                    InventoryStock.product_id == data.product_id,
                    InventoryStock.warehouse_id == data.to_warehouse_id
                )
            )
        )
        dest_stock = result.scalar_one_or_none()
        
        if not dest_stock:
            dest_stock = InventoryStock(
                product_id=data.product_id,
                warehouse_id=data.to_warehouse_id,
                quantity_on_hand=0,
                quantity_available=0,
                unit_cost=stock.unit_cost,
                average_cost=stock.average_cost
            )
            session.add(dest_stock)
        
        dest_stock.quantity_on_hand += abs(quantity_change)
        dest_stock.quantity_available = dest_stock.quantity_on_hand - dest_stock.quantity_reserved
        dest_stock.last_movement_date = datetime.now()
    
    # Check for low stock alert
    if stock.quantity_on_hand <= stock.reorder_point:
        alert = StockAlert(
            product_id=data.product_id,
            warehouse_id=data.warehouse_id,
            alert_type="low_stock" if stock.quantity_on_hand > 0 else "out_of_stock",
            current_quantity=stock.quantity_on_hand,
            threshold_quantity=stock.reorder_point
        )
        session.add(alert)
    
    await session.commit()
    await session.refresh(movement)
    
    return {
        "movement": movement.to_dict(),
        "stock_after": stock.to_dict()
    }


@router.get("/movements/{movement_id}")
async def get_movement(
    movement_id: int,
    session: AsyncSession = Depends(get_session)
):
    """Get movement details."""
    result = await session.execute(
        select(StockMovement)
        .options(
            selectinload(StockMovement.product),
            selectinload(StockMovement.warehouse)
        )
        .where(StockMovement.id == movement_id)
    )
    movement = result.scalar_one_or_none()
    
    if not movement:
        raise HTTPException(status_code=404, detail="Movement not found")
    
    m_dict = movement.to_dict()
    m_dict["product"] = movement.product.to_dict() if movement.product else None
    m_dict["warehouse"] = movement.warehouse.to_dict() if movement.warehouse else None
    return m_dict


# ============================================================
# PURCHASE ORDER ENDPOINTS
# ============================================================

@router.get("/purchase-orders")
async def list_purchase_orders(
    skip: int = 0,
    limit: int = 100,
    status: Optional[str] = None,
    supplier_id: Optional[int] = None,
    session: AsyncSession = Depends(get_session)
):
    """List purchase orders."""
    query = select(PurchaseOrder).options(
        selectinload(PurchaseOrder.supplier),
        selectinload(PurchaseOrder.warehouse),
        selectinload(PurchaseOrder.items)
    ).order_by(desc(PurchaseOrder.created_at))
    
    if status:
        query = query.where(PurchaseOrder.status == status)
    if supplier_id:
        query = query.where(PurchaseOrder.supplier_id == supplier_id)
    
    query = query.offset(skip).limit(limit)
    result = await session.execute(query)
    orders = result.scalars().all()
    
    order_list = []
    for o in orders:
        o_dict = o.to_dict()
        o_dict["supplier"] = o.supplier.to_dict() if o.supplier else None
        o_dict["warehouse"] = o.warehouse.to_dict() if o.warehouse else None
        o_dict["items_count"] = len(o.items)
        order_list.append(o_dict)
    
    return {
        "count": len(order_list),
        "purchase_orders": order_list
    }


@router.post("/purchase-orders")
async def create_purchase_order(
    data: PurchaseOrderCreate,
    session: AsyncSession = Depends(get_session)
):
    """Create a purchase order."""
    # Calculate totals
    subtotal = sum(item.quantity_ordered * item.unit_price for item in data.items)
    
    po = PurchaseOrder(
        po_number=generate_po_number(),
        supplier_id=data.supplier_id,
        warehouse_id=data.warehouse_id,
        status="draft",
        expected_date=data.expected_date,
        subtotal=Decimal(str(subtotal)),
        total_amount=Decimal(str(subtotal)),
        notes=data.notes,
        created_by=data.created_by
    )
    session.add(po)
    await session.flush()
    
    # Add items
    for item_data in data.items:
        item = PurchaseOrderItem(
            purchase_order_id=po.id,
            product_id=item_data.product_id,
            quantity_ordered=item_data.quantity_ordered,
            unit_price=Decimal(str(item_data.unit_price)),
            total_price=Decimal(str(item_data.quantity_ordered * item_data.unit_price)),
            notes=item_data.notes
        )
        session.add(item)
    
    await session.commit()
    await session.refresh(po)
    
    return po.to_dict()


@router.get("/purchase-orders/{po_id}")
async def get_purchase_order(
    po_id: int,
    session: AsyncSession = Depends(get_session)
):
    """Get purchase order details with items."""
    result = await session.execute(
        select(PurchaseOrder)
        .options(
            selectinload(PurchaseOrder.supplier),
            selectinload(PurchaseOrder.warehouse),
            selectinload(PurchaseOrder.items).selectinload(PurchaseOrderItem.product)
        )
        .where(PurchaseOrder.id == po_id)
    )
    po = result.scalar_one_or_none()
    
    if not po:
        raise HTTPException(status_code=404, detail="Purchase order not found")
    
    po_dict = po.to_dict()
    po_dict["supplier"] = po.supplier.to_dict() if po.supplier else None
    po_dict["warehouse"] = po.warehouse.to_dict() if po.warehouse else None
    po_dict["items"] = [
        {
            **item.to_dict(),
            "product": item.product.to_dict() if item.product else None
        }
        for item in po.items
    ]
    
    return po_dict


@router.post("/purchase-orders/{po_id}/receive")
async def receive_purchase_order(
    po_id: int,
    performed_by: Optional[str] = None,
    session: AsyncSession = Depends(get_session)
):
    """Receive a purchase order - creates stock movements and updates inventory."""
    result = await session.execute(
        select(PurchaseOrder)
        .options(selectinload(PurchaseOrder.items))
        .where(PurchaseOrder.id == po_id)
    )
    po = result.scalar_one_or_none()
    
    if not po:
        raise HTTPException(status_code=404, detail="Purchase order not found")
    
    if po.status != "approved":
        raise HTTPException(status_code=400, detail="Purchase order must be approved before receiving")
    
    # Process each item
    for item in po.items:
        # Create stock movement
        movement_data = StockMovementCreate(
            movement_type="stock_in",
            product_id=item.product_id,
            warehouse_id=po.warehouse_id,
            quantity=item.quantity_ordered,
            supplier_id=po.supplier_id,
            unit_cost=float(item.unit_price),
            document_type="PO",
            document_number=po.po_number,
            performed_by=performed_by
        )
        
        # Get or create stock record
        result = await session.execute(
            select(InventoryStock).where(
                and_(
                    InventoryStock.product_id == item.product_id,
                    InventoryStock.warehouse_id == po.warehouse_id
                )
            )
        )
        stock = result.scalar_one_or_none()
        
        if not stock:
            stock = InventoryStock(
                product_id=item.product_id,
                warehouse_id=po.warehouse_id,
                supplier_id=po.supplier_id,
                quantity_on_hand=0,
                quantity_available=0
            )
            session.add(stock)
            await session.flush()
        
        # Create movement
        movement = StockMovement(
            reference_number=generate_reference_number("RCV"),
            movement_type="stock_in",
            status="completed",
            product_id=item.product_id,
            warehouse_id=po.warehouse_id,
            supplier_id=po.supplier_id,
            quantity=item.quantity_ordered,
            quantity_before=stock.quantity_on_hand,
            quantity_after=stock.quantity_on_hand + item.quantity_ordered,
            unit_cost=item.unit_price,
            total_cost=item.total_price,
            document_type="PO",
            document_number=po.po_number,
            performed_by=performed_by
        )
        session.add(movement)
        
        # Update stock
        stock.quantity_on_hand += item.quantity_ordered
        stock.quantity_available = stock.quantity_on_hand - stock.quantity_reserved
        stock.unit_cost = item.unit_price
        stock.last_movement_date = datetime.now()
        
        # Update item received quantity
        item.quantity_received = item.quantity_ordered
    
    # Update PO status
    po.status = "received"
    po.received_date = datetime.now()
    
    await session.commit()
    
    return {"message": "Purchase order received successfully", "po_number": po.po_number}


@router.put("/purchase-orders/{po_id}/status")
async def update_po_status(
    po_id: int,
    status: str,
    approved_by: Optional[str] = None,
    session: AsyncSession = Depends(get_session)
):
    """Update purchase order status (draft -> submitted -> approved -> received/cancelled)."""
    valid_statuses = ["draft", "submitted", "approved", "received", "cancelled"]
    if status not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of: {valid_statuses}")
    
    result = await session.execute(select(PurchaseOrder).where(PurchaseOrder.id == po_id))
    po = result.scalar_one_or_none()
    
    if not po:
        raise HTTPException(status_code=404, detail="Purchase order not found")
    
    po.status = status
    if status == "approved" and approved_by:
        po.approved_by = approved_by
    
    await session.commit()
    
    return {"message": f"Purchase order status updated to {status}"}


# ============================================================
# STOCK ALERTS ENDPOINTS
# ============================================================

@router.get("/alerts")
async def list_alerts(
    skip: int = 0,
    limit: int = 100,
    is_resolved: Optional[bool] = None,
    alert_type: Optional[str] = None,
    session: AsyncSession = Depends(get_session)
):
    """List stock alerts."""
    query = select(StockAlert).options(
        selectinload(StockAlert.product),
        selectinload(StockAlert.warehouse)
    ).order_by(desc(StockAlert.created_at))
    
    if is_resolved is not None:
        query = query.where(StockAlert.is_resolved == is_resolved)
    if alert_type:
        query = query.where(StockAlert.alert_type == alert_type)
    
    query = query.offset(skip).limit(limit)
    result = await session.execute(query)
    alerts = result.scalars().all()
    
    alert_list = []
    for a in alerts:
        a_dict = a.to_dict()
        a_dict["product"] = a.product.to_dict() if a.product else None
        a_dict["warehouse"] = a.warehouse.to_dict() if a.warehouse else None
        alert_list.append(a_dict)
    
    return {
        "count": len(alert_list),
        "alerts": alert_list
    }


@router.put("/alerts/{alert_id}/resolve")
async def resolve_alert(
    alert_id: int,
    resolved_by: Optional[str] = None,
    notes: Optional[str] = None,
    session: AsyncSession = Depends(get_session)
):
    """Mark an alert as resolved."""
    result = await session.execute(select(StockAlert).where(StockAlert.id == alert_id))
    alert = result.scalar_one_or_none()
    
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    
    alert.is_resolved = True
    alert.resolved_at = datetime.now()
    alert.resolved_by = resolved_by
    if notes:
        alert.notes = notes
    
    await session.commit()
    
    return {"message": "Alert resolved"}


# ============================================================
# DASHBOARD & REPORTS ENDPOINTS
# ============================================================

@router.get("/dashboard/summary")
async def get_dashboard_summary(
    warehouse_id: Optional[int] = None,
    session: AsyncSession = Depends(get_session)
):
    """Get inventory dashboard summary statistics."""
    # Base queries
    stock_query = select(InventoryStock).where(InventoryStock.is_active == True)
    if warehouse_id:
        stock_query = stock_query.where(InventoryStock.warehouse_id == warehouse_id)
    
    result = await session.execute(stock_query)
    stocks = result.scalars().all()
    
    # Calculate metrics
    total_products = len(stocks)
    total_quantity = sum(s.quantity_on_hand for s in stocks)
    total_value = sum(float(s.quantity_on_hand) * float(s.average_cost or 0) for s in stocks)
    
    low_stock_items = [s for s in stocks if s.quantity_on_hand <= s.reorder_point]
    out_of_stock_items = [s for s in stocks if s.quantity_on_hand == 0]
    
    # Get active alerts count
    alert_result = await session.execute(
        select(func.count(StockAlert.id)).where(StockAlert.is_resolved == False)
    )
    active_alerts = alert_result.scalar() or 0
    
    # Get recent movements (last 7 days)
    week_ago = datetime.now() - timedelta(days=7)
    movements_result = await session.execute(
        select(StockMovement).where(StockMovement.movement_date >= week_ago)
    )
    recent_movements = movements_result.scalars().all()
    
    stock_in = sum(m.quantity for m in recent_movements if m.movement_type == "stock_in")
    stock_out = sum(abs(m.quantity) for m in recent_movements if m.movement_type == "stock_out")
    
    # Get pending POs
    po_result = await session.execute(
        select(func.count(PurchaseOrder.id)).where(
            PurchaseOrder.status.in_(["draft", "submitted", "approved"])
        )
    )
    pending_pos = po_result.scalar() or 0
    
    return {
        "total_products": total_products,
        "total_quantity": total_quantity,
        "total_value": round(total_value, 2),
        "low_stock_count": len(low_stock_items),
        "out_of_stock_count": len(out_of_stock_items),
        "active_alerts": active_alerts,
        "pending_purchase_orders": pending_pos,
        "movements_last_7_days": {
            "stock_in": stock_in,
            "stock_out": stock_out,
            "net_change": stock_in - stock_out
        }
    }


@router.get("/reports/stock-levels")
async def report_stock_levels(
    warehouse_id: Optional[int] = None,
    category_id: Optional[int] = None,
    session: AsyncSession = Depends(get_session)
):
    """Stock level report - current quantities by product."""
    query = select(InventoryStock).options(
        selectinload(InventoryStock.product),
        selectinload(InventoryStock.warehouse),
        selectinload(InventoryStock.category)
    ).where(InventoryStock.is_active == True)
    
    if warehouse_id:
        query = query.where(InventoryStock.warehouse_id == warehouse_id)
    if category_id:
        query = query.where(InventoryStock.category_id == category_id)
    
    result = await session.execute(query)
    stocks = result.scalars().all()
    
    report_data = []
    for s in stocks:
        report_data.append({
            "product_id": s.product_id,
            "product_name": s.product.product_name if s.product else None,
            "sku": s.product.sku if s.product else None,
            "warehouse": s.warehouse.name if s.warehouse else None,
            "category": s.category.name if s.category else None,
            "quantity_on_hand": s.quantity_on_hand,
            "quantity_reserved": s.quantity_reserved,
            "quantity_available": s.quantity_available,
            "reorder_point": s.reorder_point,
            "status": "Out of Stock" if s.quantity_on_hand == 0 else ("Low Stock" if s.quantity_on_hand <= s.reorder_point else "In Stock"),
            "value": round(float(s.quantity_on_hand) * float(s.average_cost or 0), 2)
        })
    
    return {
        "generated_at": datetime.now().isoformat(),
        "total_items": len(report_data),
        "total_value": sum(r["value"] for r in report_data),
        "data": report_data
    }


@router.get("/reports/low-stock")
async def report_low_stock(
    warehouse_id: Optional[int] = None,
    session: AsyncSession = Depends(get_session)
):
    """Low stock report - items below reorder point."""
    query = select(InventoryStock).options(
        selectinload(InventoryStock.product),
        selectinload(InventoryStock.warehouse),
        selectinload(InventoryStock.supplier)
    ).where(
        and_(
            InventoryStock.is_active == True,
            InventoryStock.quantity_on_hand <= InventoryStock.reorder_point
        )
    )
    
    if warehouse_id:
        query = query.where(InventoryStock.warehouse_id == warehouse_id)
    
    query = query.order_by(asc(InventoryStock.quantity_on_hand))
    result = await session.execute(query)
    stocks = result.scalars().all()
    
    report_data = []
    for s in stocks:
        report_data.append({
            "product_id": s.product_id,
            "product_name": s.product.product_name if s.product else None,
            "sku": s.product.sku if s.product else None,
            "warehouse": s.warehouse.name if s.warehouse else None,
            "supplier": s.supplier.name if s.supplier else None,
            "quantity_on_hand": s.quantity_on_hand,
            "reorder_point": s.reorder_point,
            "reorder_quantity": s.reorder_quantity,
            "shortage": s.reorder_point - s.quantity_on_hand,
            "status": "Out of Stock" if s.quantity_on_hand == 0 else "Low Stock"
        })
    
    return {
        "generated_at": datetime.now().isoformat(),
        "total_items": len(report_data),
        "urgent_items": len([r for r in report_data if r["quantity_on_hand"] == 0]),
        "data": report_data
    }


@router.get("/reports/movement-history")
async def report_movement_history(
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
    product_id: Optional[str] = None,
    warehouse_id: Optional[int] = None,
    movement_type: Optional[str] = None,
    session: AsyncSession = Depends(get_session)
):
    """Movement history report."""
    query = select(StockMovement).options(
        selectinload(StockMovement.product),
        selectinload(StockMovement.warehouse)
    ).order_by(desc(StockMovement.movement_date))
    
    if date_from:
        query = query.where(StockMovement.movement_date >= date_from)
    if date_to:
        query = query.where(StockMovement.movement_date <= date_to)
    if product_id:
        query = query.where(StockMovement.product_id == product_id)
    if warehouse_id:
        query = query.where(StockMovement.warehouse_id == warehouse_id)
    if movement_type:
        query = query.where(StockMovement.movement_type == movement_type)
    
    result = await session.execute(query)
    movements = result.scalars().all()
    
    # Summary by type
    summary = {}
    for m in movements:
        if m.movement_type not in summary:
            summary[m.movement_type] = {"count": 0, "total_quantity": 0, "total_value": 0}
        summary[m.movement_type]["count"] += 1
        summary[m.movement_type]["total_quantity"] += abs(m.quantity)
        summary[m.movement_type]["total_value"] += float(m.total_cost or 0)
    
    report_data = []
    for m in movements:
        report_data.append({
            "reference_number": m.reference_number,
            "movement_date": m.movement_date.isoformat() if m.movement_date else None,
            "movement_type": m.movement_type,
            "product_name": m.product.product_name if m.product else None,
            "sku": m.product.sku if m.product else None,
            "warehouse": m.warehouse.name if m.warehouse else None,
            "quantity": m.quantity,
            "unit_cost": float(m.unit_cost) if m.unit_cost else 0,
            "total_cost": float(m.total_cost) if m.total_cost else 0,
            "performed_by": m.performed_by
        })
    
    return {
        "generated_at": datetime.now().isoformat(),
        "total_movements": len(report_data),
        "summary_by_type": summary,
        "data": report_data
    }


@router.get("/reports/stock-valuation")
async def report_stock_valuation(
    warehouse_id: Optional[int] = None,
    session: AsyncSession = Depends(get_session)
):
    """Stock valuation report (using average cost)."""
    query = select(InventoryStock).options(
        selectinload(InventoryStock.product),
        selectinload(InventoryStock.warehouse),
        selectinload(InventoryStock.category)
    ).where(
        and_(
            InventoryStock.is_active == True,
            InventoryStock.quantity_on_hand > 0
        )
    )
    
    if warehouse_id:
        query = query.where(InventoryStock.warehouse_id == warehouse_id)
    
    result = await session.execute(query)
    stocks = result.scalars().all()
    
    report_data = []
    total_value = 0
    
    for s in stocks:
        value = float(s.quantity_on_hand) * float(s.average_cost or 0)
        total_value += value
        
        report_data.append({
            "product_id": s.product_id,
            "product_name": s.product.product_name if s.product else None,
            "sku": s.product.sku if s.product else None,
            "warehouse": s.warehouse.name if s.warehouse else None,
            "category": s.category.name if s.category else None,
            "quantity": s.quantity_on_hand,
            "average_cost": round(float(s.average_cost or 0), 2),
            "total_value": round(value, 2)
        })
    
    # Sort by value descending
    report_data.sort(key=lambda x: x["total_value"], reverse=True)
    
    return {
        "generated_at": datetime.now().isoformat(),
        "total_items": len(report_data),
        "total_value": round(total_value, 2),
        "data": report_data
    }


# ============================================================
# ANALYTICS ENDPOINTS (For Dashboard Charts)
# ============================================================

@router.get("/analytics/movement-trends")
async def get_movement_trends(
    days: int = Query(30, ge=7, le=90),
    warehouse_id: Optional[int] = None,
    session: AsyncSession = Depends(get_session)
):
    """Get daily movement trends for line/bar charts."""
    start_date = datetime.now() - timedelta(days=days)
    
    query = select(StockMovement).where(
        and_(
            StockMovement.movement_date >= start_date,
            StockMovement.status == "completed"
        )
    )
    if warehouse_id:
        query = query.where(StockMovement.warehouse_id == warehouse_id)
    
    result = await session.execute(query)
    movements = result.scalars().all()
    
    # Group by date
    daily_data = {}
    for i in range(days):
        date = (datetime.now() - timedelta(days=days-i-1)).strftime("%Y-%m-%d")
        daily_data[date] = {"date": date, "stock_in": 0, "stock_out": 0, "adjustments": 0, "net": 0}
    
    for m in movements:
        date_key = m.movement_date.strftime("%Y-%m-%d")
        if date_key in daily_data:
            if m.movement_type == "stock_in":
                daily_data[date_key]["stock_in"] += m.quantity
            elif m.movement_type == "stock_out":
                daily_data[date_key]["stock_out"] += abs(m.quantity)
            else:
                daily_data[date_key]["adjustments"] += m.quantity
    
    # Calculate net
    for d in daily_data.values():
        d["net"] = d["stock_in"] - d["stock_out"] + d["adjustments"]
    
    return {
        "period_days": days,
        "data": list(daily_data.values())
    }


@router.get("/analytics/stock-by-category")
async def get_stock_by_category(
    warehouse_id: Optional[int] = None,
    session: AsyncSession = Depends(get_session)
):
    """Get stock distribution by category for pie charts."""
    query = select(InventoryStock).options(
        selectinload(InventoryStock.category)
    ).where(InventoryStock.is_active == True)
    
    if warehouse_id:
        query = query.where(InventoryStock.warehouse_id == warehouse_id)
    
    result = await session.execute(query)
    stocks = result.scalars().all()
    
    # Group by category
    category_data = {}
    for s in stocks:
        cat_name = s.category.name if s.category else "Uncategorized"
        if cat_name not in category_data:
            category_data[cat_name] = {"name": cat_name, "quantity": 0, "value": 0, "items": 0}
        category_data[cat_name]["quantity"] += s.quantity_on_hand
        category_data[cat_name]["value"] += float(s.quantity_on_hand) * float(s.average_cost or 0)
        category_data[cat_name]["items"] += 1
    
    data = list(category_data.values())
    total_value = sum(d["value"] for d in data)
    
    # Add percentage
    for d in data:
        d["value"] = round(d["value"], 2)
        d["percentage"] = round((d["value"] / total_value * 100) if total_value > 0 else 0, 1)
    
    # Sort by value
    data.sort(key=lambda x: x["value"], reverse=True)
    
    return {"data": data, "total_value": round(total_value, 2)}


@router.get("/analytics/stock-by-warehouse")
async def get_stock_by_warehouse(
    session: AsyncSession = Depends(get_session)
):
    """Get stock distribution by warehouse for bar charts."""
    query = select(InventoryStock).options(
        selectinload(InventoryStock.warehouse)
    ).where(InventoryStock.is_active == True)
    
    result = await session.execute(query)
    stocks = result.scalars().all()
    
    # Group by warehouse
    warehouse_data = {}
    for s in stocks:
        wh_name = s.warehouse.name if s.warehouse else "Unknown"
        if wh_name not in warehouse_data:
            warehouse_data[wh_name] = {"name": wh_name, "quantity": 0, "value": 0, "items": 0, "low_stock": 0}
        warehouse_data[wh_name]["quantity"] += s.quantity_on_hand
        warehouse_data[wh_name]["value"] += float(s.quantity_on_hand) * float(s.average_cost or 0)
        warehouse_data[wh_name]["items"] += 1
        if s.quantity_on_hand <= s.reorder_point:
            warehouse_data[wh_name]["low_stock"] += 1
    
    data = list(warehouse_data.values())
    for d in data:
        d["value"] = round(d["value"], 2)
    
    data.sort(key=lambda x: x["value"], reverse=True)
    
    return {"data": data}


@router.get("/analytics/top-products")
async def get_top_products(
    limit: int = Query(10, ge=5, le=50),
    by: str = Query("value", regex="^(value|quantity)$"),
    warehouse_id: Optional[int] = None,
    session: AsyncSession = Depends(get_session)
):
    """Get top products by value or quantity for bar charts."""
    query = select(InventoryStock).options(
        selectinload(InventoryStock.product)
    ).where(
        and_(InventoryStock.is_active == True, InventoryStock.quantity_on_hand > 0)
    )
    
    if warehouse_id:
        query = query.where(InventoryStock.warehouse_id == warehouse_id)
    
    result = await session.execute(query)
    stocks = result.scalars().all()
    
    data = []
    for s in stocks:
        value = float(s.quantity_on_hand) * float(s.average_cost or 0)
        data.append({
            "product_id": s.product_id,
            "name": s.product.product_name if s.product else (s.product.sku if s.product else "Unknown"),
            "sku": s.product.sku if s.product else None,
            "quantity": s.quantity_on_hand,
            "value": round(value, 2)
        })
    
    # Sort by selected metric
    data.sort(key=lambda x: x[by], reverse=True)
    
    return {"data": data[:limit], "sorted_by": by}


@router.get("/analytics/alerts-summary")
async def get_alerts_summary(
    session: AsyncSession = Depends(get_session)
):
    """Get alerts summary by type for dashboard."""
    result = await session.execute(
        select(StockAlert).where(StockAlert.is_resolved == False)
    )
    alerts = result.scalars().all()
    
    summary = {
        "low_stock": 0,
        "out_of_stock": 0,
        "overstock": 0,
        "expiring_soon": 0,
        "total": len(alerts)
    }
    
    for a in alerts:
        if a.alert_type in summary:
            summary[a.alert_type] += 1
    
    return summary


@router.get("/analytics/inventory-health")
async def get_inventory_health(
    warehouse_id: Optional[int] = None,
    session: AsyncSession = Depends(get_session)
):
    """Get overall inventory health metrics."""
    query = select(InventoryStock).where(InventoryStock.is_active == True)
    if warehouse_id:
        query = query.where(InventoryStock.warehouse_id == warehouse_id)
    
    result = await session.execute(query)
    stocks = result.scalars().all()
    
    total = len(stocks)
    if total == 0:
        return {
            "health_score": 100,
            "in_stock_pct": 0,
            "low_stock_pct": 0,
            "out_of_stock_pct": 0,
            "optimal_pct": 0,
            "details": {"in_stock": 0, "low_stock": 0, "out_of_stock": 0, "optimal": 0}
        }
    
    out_of_stock = sum(1 for s in stocks if s.quantity_on_hand == 0)
    low_stock = sum(1 for s in stocks if 0 < s.quantity_on_hand <= s.reorder_point)
    in_stock = sum(1 for s in stocks if s.quantity_on_hand > s.reorder_point)
    optimal = sum(1 for s in stocks if s.reorder_point < s.quantity_on_hand < (s.max_stock_level or 9999))
    
    # Calculate health score (100 = all optimal, 0 = all out of stock)
    health_score = round(((optimal * 100) + (in_stock * 80) + (low_stock * 40)) / total, 1)
    
    return {
        "health_score": health_score,
        "in_stock_pct": round(in_stock / total * 100, 1),
        "low_stock_pct": round(low_stock / total * 100, 1),
        "out_of_stock_pct": round(out_of_stock / total * 100, 1),
        "optimal_pct": round(optimal / total * 100, 1),
        "details": {
            "in_stock": in_stock,
            "low_stock": low_stock,
            "out_of_stock": out_of_stock,
            "optimal": optimal,
            "total": total
        }
    }

