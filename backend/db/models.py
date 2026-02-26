"""SQLAlchemy ORM models for the application."""
from datetime import datetime
from typing import Optional
from enum import Enum as PyEnum

from sqlalchemy import Column, DateTime, Numeric, String, Text, func, Integer, ForeignKey, Boolean, Enum
from sqlalchemy.orm import DeclarativeBase, relationship
from pgvector.sqlalchemy import Vector


class Base(DeclarativeBase):
    """Base class for all ORM models."""
    pass


# ============================================================
# ENUMS for Inventory System
# ============================================================

class MovementType(str, PyEnum):
    """Types of stock movements."""
    STOCK_IN = "stock_in"           # Purchase/Receive
    STOCK_OUT = "stock_out"         # Sale/Ship
    ADJUSTMENT = "adjustment"        # Manual adjustment
    RETURN_IN = "return_in"         # Customer return
    RETURN_OUT = "return_out"       # Return to supplier
    TRANSFER = "transfer"           # Transfer between locations
    DAMAGE = "damage"               # Damaged goods
    LOSS = "loss"                   # Lost/Stolen


class MovementStatus(str, PyEnum):
    """Status of stock movements."""
    PENDING = "pending"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


# ============================================================
# PRODUCT MODEL (existing)
# ============================================================


class Image(Base):
    """Image/Product model."""
    
    __tablename__ = "images"
    
    # Primary key
    id = Column("id", String(36), primary_key=True)
    
    # File info
    filename = Column("filename", String(255), unique=True, nullable=False, index=True)
    s3_url = Column("s3_url", String(500), nullable=True)
    
    # Embeddings (pgvector - 512-dim CLIP embeddings)
    embedding = Column("embedding", Vector(512), nullable=True)
    
    # Product metadata
    sku = Column("sku", String(100), nullable=True, index=True)
    brand = Column("brand", String(255), nullable=True, index=True)
    product_name = Column("product_name", String(255), nullable=True)
    product_date = Column("product_date", String(10), nullable=True)
    description = Column("description", Text, nullable=True)
    price = Column("price", Numeric(10, 2), nullable=True)
    
    # Timestamps
    created_at = Column("created_at", DateTime, server_default=func.now(), nullable=False)
    updated_at = Column("updated_at", DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)
    
    def __repr__(self) -> str:
        return f"<Image(id={self.id}, filename={self.filename}, sku={self.sku})>"
    
    def to_dict(self) -> dict:
        """Convert model to dictionary."""
        return {
            "id": self.id,
            "filename": self.filename,
            "s3_url": self.s3_url,
            "sku": self.sku,
            "brand": self.brand,
            "product_name": self.product_name,
            "product_date": self.product_date,
            "description": self.description,
            "price": float(self.price) if self.price else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


# ============================================================
# INVENTORY MANAGEMENT MODELS
# ============================================================

class Category(Base):
    """Product category for hierarchical organization."""
    
    __tablename__ = "categories"
    
    id = Column("id", Integer, primary_key=True, autoincrement=True)
    name = Column("name", String(100), nullable=False, index=True)
    slug = Column("slug", String(100), unique=True, nullable=False)
    description = Column("description", Text, nullable=True)
    parent_id = Column("parent_id", Integer, ForeignKey("categories.id"), nullable=True)
    is_active = Column("is_active", Boolean, default=True, nullable=False)
    sort_order = Column("sort_order", Integer, default=0)
    
    created_at = Column("created_at", DateTime, server_default=func.now(), nullable=False)
    updated_at = Column("updated_at", DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)
    
    # Relationships
    parent = relationship("Category", remote_side=[id], backref="children")
    
    def __repr__(self) -> str:
        return f"<Category(id={self.id}, name={self.name})>"
    
    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "name": self.name,
            "slug": self.slug,
            "description": self.description,
            "parent_id": self.parent_id,
            "is_active": self.is_active,
            "sort_order": self.sort_order,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class Supplier(Base):
    """Supplier/Vendor model for purchasing."""
    
    __tablename__ = "suppliers"
    
    id = Column("id", Integer, primary_key=True, autoincrement=True)
    code = Column("code", String(50), unique=True, nullable=False)
    name = Column("name", String(255), nullable=False, index=True)
    contact_person = Column("contact_person", String(100), nullable=True)
    email = Column("email", String(255), nullable=True)
    phone = Column("phone", String(50), nullable=True)
    address = Column("address", Text, nullable=True)
    city = Column("city", String(100), nullable=True)
    country = Column("country", String(100), nullable=True)
    payment_terms = Column("payment_terms", String(100), nullable=True)  # e.g., "Net 30"
    lead_time_days = Column("lead_time_days", Integer, default=7)  # Average delivery days
    is_active = Column("is_active", Boolean, default=True, nullable=False)
    notes = Column("notes", Text, nullable=True)
    
    created_at = Column("created_at", DateTime, server_default=func.now(), nullable=False)
    updated_at = Column("updated_at", DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)
    
    def __repr__(self) -> str:
        return f"<Supplier(id={self.id}, name={self.name})>"
    
    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "code": self.code,
            "name": self.name,
            "contact_person": self.contact_person,
            "email": self.email,
            "phone": self.phone,
            "address": self.address,
            "city": self.city,
            "country": self.country,
            "payment_terms": self.payment_terms,
            "lead_time_days": self.lead_time_days,
            "is_active": self.is_active,
            "notes": self.notes,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class Warehouse(Base):
    """Warehouse/Location model for multi-location inventory."""
    
    __tablename__ = "warehouses"
    
    id = Column("id", Integer, primary_key=True, autoincrement=True)
    code = Column("code", String(20), unique=True, nullable=False)
    name = Column("name", String(100), nullable=False, index=True)
    address = Column("address", Text, nullable=True)
    city = Column("city", String(100), nullable=True)
    country = Column("country", String(100), nullable=True)
    manager_name = Column("manager_name", String(100), nullable=True)
    phone = Column("phone", String(50), nullable=True)
    is_active = Column("is_active", Boolean, default=True, nullable=False)
    is_default = Column("is_default", Boolean, default=False)  # Default warehouse for operations
    
    created_at = Column("created_at", DateTime, server_default=func.now(), nullable=False)
    updated_at = Column("updated_at", DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)
    
    def __repr__(self) -> str:
        return f"<Warehouse(id={self.id}, name={self.name})>"
    
    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "code": self.code,
            "name": self.name,
            "address": self.address,
            "city": self.city,
            "country": self.country,
            "manager_name": self.manager_name,
            "phone": self.phone,
            "is_active": self.is_active,
            "is_default": self.is_default,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class InventoryStock(Base):
    """Inventory stock levels per product per warehouse."""
    
    __tablename__ = "inventory_stock"
    
    id = Column("id", Integer, primary_key=True, autoincrement=True)
    
    # Foreign Keys
    product_id = Column("product_id", String(36), ForeignKey("images.id"), nullable=False, index=True)
    warehouse_id = Column("warehouse_id", Integer, ForeignKey("warehouses.id"), nullable=False, index=True)
    category_id = Column("category_id", Integer, ForeignKey("categories.id"), nullable=True)
    supplier_id = Column("supplier_id", Integer, ForeignKey("suppliers.id"), nullable=True)
    
    # Stock quantities
    quantity_on_hand = Column("quantity_on_hand", Integer, default=0, nullable=False)
    quantity_reserved = Column("quantity_reserved", Integer, default=0, nullable=False)  # Reserved for orders
    quantity_available = Column("quantity_available", Integer, default=0, nullable=False)  # on_hand - reserved
    
    # Reorder management
    reorder_point = Column("reorder_point", Integer, default=10)  # Alert when stock falls below
    reorder_quantity = Column("reorder_quantity", Integer, default=50)  # How much to reorder
    safety_stock = Column("safety_stock", Integer, default=5)  # Minimum stock buffer
    max_stock_level = Column("max_stock_level", Integer, default=500)  # Maximum storage capacity
    
    # Costing
    unit_cost = Column("unit_cost", Numeric(10, 2), default=0)  # Last purchase cost
    average_cost = Column("average_cost", Numeric(10, 2), default=0)  # Weighted average cost
    
    # Location within warehouse
    bin_location = Column("bin_location", String(50), nullable=True)  # e.g., "A-12-3"
    
    # Batch/Lot tracking (optional)
    batch_number = Column("batch_number", String(100), nullable=True)
    expiry_date = Column("expiry_date", DateTime, nullable=True)
    
    # Status
    is_active = Column("is_active", Boolean, default=True, nullable=False)
    last_stock_count_date = Column("last_stock_count_date", DateTime, nullable=True)
    last_movement_date = Column("last_movement_date", DateTime, nullable=True)
    
    created_at = Column("created_at", DateTime, server_default=func.now(), nullable=False)
    updated_at = Column("updated_at", DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)
    
    # Relationships
    product = relationship("Image", backref="inventory_records")
    warehouse = relationship("Warehouse", backref="inventory_items")
    category = relationship("Category", backref="inventory_items")
    supplier = relationship("Supplier", backref="inventory_items")
    
    def __repr__(self) -> str:
        return f"<InventoryStock(product_id={self.product_id}, qty={self.quantity_on_hand})>"
    
    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "product_id": self.product_id,
            "warehouse_id": self.warehouse_id,
            "category_id": self.category_id,
            "supplier_id": self.supplier_id,
            "quantity_on_hand": self.quantity_on_hand,
            "quantity_reserved": self.quantity_reserved,
            "quantity_available": self.quantity_available,
            "reorder_point": self.reorder_point,
            "reorder_quantity": self.reorder_quantity,
            "safety_stock": self.safety_stock,
            "max_stock_level": self.max_stock_level,
            "unit_cost": float(self.unit_cost) if self.unit_cost else 0,
            "average_cost": float(self.average_cost) if self.average_cost else 0,
            "bin_location": self.bin_location,
            "batch_number": self.batch_number,
            "expiry_date": self.expiry_date.isoformat() if self.expiry_date else None,
            "is_active": self.is_active,
            "last_stock_count_date": self.last_stock_count_date.isoformat() if self.last_stock_count_date else None,
            "last_movement_date": self.last_movement_date.isoformat() if self.last_movement_date else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class StockMovement(Base):
    """Track all stock movements (in/out/adjustments)."""
    
    __tablename__ = "stock_movements"
    
    id = Column("id", Integer, primary_key=True, autoincrement=True)
    
    # Reference number for tracking
    reference_number = Column("reference_number", String(50), unique=True, nullable=False, index=True)
    
    # Movement type and status
    movement_type = Column("movement_type", String(20), nullable=False, index=True)
    status = Column("status", String(20), default="completed", nullable=False)
    
    # Foreign Keys
    product_id = Column("product_id", String(36), ForeignKey("images.id"), nullable=False, index=True)
    warehouse_id = Column("warehouse_id", Integer, ForeignKey("warehouses.id"), nullable=False)
    supplier_id = Column("supplier_id", Integer, ForeignKey("suppliers.id"), nullable=True)
    
    # Transfer destination (for transfer movements)
    to_warehouse_id = Column("to_warehouse_id", Integer, ForeignKey("warehouses.id"), nullable=True)
    
    # Quantities
    quantity = Column("quantity", Integer, nullable=False)  # Positive for in, negative for out
    quantity_before = Column("quantity_before", Integer, nullable=False)  # Stock before movement
    quantity_after = Column("quantity_after", Integer, nullable=False)  # Stock after movement
    
    # Costing
    unit_cost = Column("unit_cost", Numeric(10, 2), nullable=True)
    total_cost = Column("total_cost", Numeric(12, 2), nullable=True)
    
    # Related documents
    document_type = Column("document_type", String(50), nullable=True)  # PO, SO, ADJ, etc.
    document_number = Column("document_number", String(100), nullable=True)
    
    # Additional info
    reason = Column("reason", String(255), nullable=True)  # Reason for adjustment/damage
    notes = Column("notes", Text, nullable=True)
    performed_by = Column("performed_by", String(100), nullable=True)  # User who made the movement
    
    # Batch tracking
    batch_number = Column("batch_number", String(100), nullable=True)
    
    # Timestamps
    movement_date = Column("movement_date", DateTime, server_default=func.now(), nullable=False)
    created_at = Column("created_at", DateTime, server_default=func.now(), nullable=False)
    
    # Relationships
    product = relationship("Image", backref="stock_movements")
    warehouse = relationship("Warehouse", foreign_keys=[warehouse_id], backref="movements_from")
    to_warehouse = relationship("Warehouse", foreign_keys=[to_warehouse_id], backref="movements_to")
    supplier = relationship("Supplier", backref="stock_movements")
    
    def __repr__(self) -> str:
        return f"<StockMovement(ref={self.reference_number}, type={self.movement_type}, qty={self.quantity})>"
    
    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "reference_number": self.reference_number,
            "movement_type": self.movement_type,
            "status": self.status,
            "product_id": self.product_id,
            "warehouse_id": self.warehouse_id,
            "supplier_id": self.supplier_id,
            "to_warehouse_id": self.to_warehouse_id,
            "quantity": self.quantity,
            "quantity_before": self.quantity_before,
            "quantity_after": self.quantity_after,
            "unit_cost": float(self.unit_cost) if self.unit_cost else None,
            "total_cost": float(self.total_cost) if self.total_cost else None,
            "document_type": self.document_type,
            "document_number": self.document_number,
            "reason": self.reason,
            "notes": self.notes,
            "performed_by": self.performed_by,
            "batch_number": self.batch_number,
            "movement_date": self.movement_date.isoformat() if self.movement_date else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class PurchaseOrder(Base):
    """Purchase orders for restocking inventory."""
    
    __tablename__ = "purchase_orders"
    
    id = Column("id", Integer, primary_key=True, autoincrement=True)
    
    # PO Reference
    po_number = Column("po_number", String(50), unique=True, nullable=False, index=True)
    
    # Foreign Keys
    supplier_id = Column("supplier_id", Integer, ForeignKey("suppliers.id"), nullable=False)
    warehouse_id = Column("warehouse_id", Integer, ForeignKey("warehouses.id"), nullable=False)
    
    # Status: draft, submitted, approved, received, cancelled
    status = Column("status", String(20), default="draft", nullable=False, index=True)
    
    # Dates
    order_date = Column("order_date", DateTime, server_default=func.now(), nullable=False)
    expected_date = Column("expected_date", DateTime, nullable=True)
    received_date = Column("received_date", DateTime, nullable=True)
    
    # Totals
    subtotal = Column("subtotal", Numeric(12, 2), default=0)
    tax_amount = Column("tax_amount", Numeric(10, 2), default=0)
    shipping_cost = Column("shipping_cost", Numeric(10, 2), default=0)
    total_amount = Column("total_amount", Numeric(12, 2), default=0)
    
    # Additional info
    notes = Column("notes", Text, nullable=True)
    created_by = Column("created_by", String(100), nullable=True)
    approved_by = Column("approved_by", String(100), nullable=True)
    
    created_at = Column("created_at", DateTime, server_default=func.now(), nullable=False)
    updated_at = Column("updated_at", DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)
    
    # Relationships
    supplier = relationship("Supplier", backref="purchase_orders")
    warehouse = relationship("Warehouse", backref="purchase_orders")
    
    def __repr__(self) -> str:
        return f"<PurchaseOrder(po_number={self.po_number}, status={self.status})>"
    
    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "po_number": self.po_number,
            "supplier_id": self.supplier_id,
            "warehouse_id": self.warehouse_id,
            "status": self.status,
            "order_date": self.order_date.isoformat() if self.order_date else None,
            "expected_date": self.expected_date.isoformat() if self.expected_date else None,
            "received_date": self.received_date.isoformat() if self.received_date else None,
            "subtotal": float(self.subtotal) if self.subtotal else 0,
            "tax_amount": float(self.tax_amount) if self.tax_amount else 0,
            "shipping_cost": float(self.shipping_cost) if self.shipping_cost else 0,
            "total_amount": float(self.total_amount) if self.total_amount else 0,
            "notes": self.notes,
            "created_by": self.created_by,
            "approved_by": self.approved_by,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class PurchaseOrderItem(Base):
    """Line items for purchase orders."""
    
    __tablename__ = "purchase_order_items"
    
    id = Column("id", Integer, primary_key=True, autoincrement=True)
    
    # Foreign Keys
    purchase_order_id = Column("purchase_order_id", Integer, ForeignKey("purchase_orders.id"), nullable=False)
    product_id = Column("product_id", String(36), ForeignKey("images.id"), nullable=False)
    
    # Quantities
    quantity_ordered = Column("quantity_ordered", Integer, nullable=False)
    quantity_received = Column("quantity_received", Integer, default=0)
    
    # Pricing
    unit_price = Column("unit_price", Numeric(10, 2), nullable=False)
    total_price = Column("total_price", Numeric(12, 2), nullable=False)
    
    # Optional notes
    notes = Column("notes", Text, nullable=True)
    
    created_at = Column("created_at", DateTime, server_default=func.now(), nullable=False)
    
    # Relationships
    purchase_order = relationship("PurchaseOrder", backref="items")
    product = relationship("Image", backref="purchase_order_items")
    
    def __repr__(self) -> str:
        return f"<PurchaseOrderItem(po_id={self.purchase_order_id}, product={self.product_id})>"
    
    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "purchase_order_id": self.purchase_order_id,
            "product_id": self.product_id,
            "quantity_ordered": self.quantity_ordered,
            "quantity_received": self.quantity_received,
            "unit_price": float(self.unit_price) if self.unit_price else 0,
            "total_price": float(self.total_price) if self.total_price else 0,
            "notes": self.notes,
        }


class StockAlert(Base):
    """Stock alerts for low stock, overstock, etc."""
    
    __tablename__ = "stock_alerts"
    
    id = Column("id", Integer, primary_key=True, autoincrement=True)
    
    # Foreign Keys
    product_id = Column("product_id", String(36), ForeignKey("images.id"), nullable=False, index=True)
    warehouse_id = Column("warehouse_id", Integer, ForeignKey("warehouses.id"), nullable=False)
    
    # Alert type: low_stock, out_of_stock, overstock, expiring
    alert_type = Column("alert_type", String(30), nullable=False, index=True)
    
    # Alert details
    current_quantity = Column("current_quantity", Integer, nullable=False)
    threshold_quantity = Column("threshold_quantity", Integer, nullable=False)
    
    # Status
    is_resolved = Column("is_resolved", Boolean, default=False)
    resolved_at = Column("resolved_at", DateTime, nullable=True)
    resolved_by = Column("resolved_by", String(100), nullable=True)
    
    # Notes
    notes = Column("notes", Text, nullable=True)
    
    created_at = Column("created_at", DateTime, server_default=func.now(), nullable=False)
    
    # Relationships
    product = relationship("Image", backref="stock_alerts")
    warehouse = relationship("Warehouse", backref="stock_alerts")
    
    def __repr__(self) -> str:
        return f"<StockAlert(product={self.product_id}, type={self.alert_type})>"
    
    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "product_id": self.product_id,
            "warehouse_id": self.warehouse_id,
            "alert_type": self.alert_type,
            "current_quantity": self.current_quantity,
            "threshold_quantity": self.threshold_quantity,
            "is_resolved": self.is_resolved,
            "resolved_at": self.resolved_at.isoformat() if self.resolved_at else None,
            "resolved_by": self.resolved_by,
            "notes": self.notes,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
