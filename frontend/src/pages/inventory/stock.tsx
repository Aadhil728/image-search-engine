'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import {
  listStock,
  listWarehouses,
  listCategories,
  listSuppliers,
  createStock,
  createMovement,
  InventoryStock,
  Warehouse,
  Category,
  Supplier
} from '@/lib/inventoryApi';
import { listProducts } from '@/lib/api';
import styles from '@/styles/Inventory.module.css';
import InventoryLayout from '@/components/InventoryLayout';

export default function StockPage() {
  const router = useRouter();
  const [stocks, setStocks] = useState<InventoryStock[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Filters
  const [selectedWarehouse, setSelectedWarehouse] = useState<number | undefined>();
  const [selectedCategory, setSelectedCategory] = useState<number | undefined>();
  const [lowStockOnly, setLowStockOnly] = useState(router.query.low_stock === 'true');
  
  // Modals
  const [showAddStock, setShowAddStock] = useState(false);
  const [showMovement, setShowMovement] = useState(false);
  const [selectedStock, setSelectedStock] = useState<InventoryStock | null>(null);
  
  // Pagination
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const limit = 20;

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    loadStock();
  }, [selectedWarehouse, selectedCategory, lowStockOnly, page]);

  const loadInitialData = async () => {
    try {
      const [warehousesData, categoriesData, suppliersData, productsData] = await Promise.all([
        listWarehouses(true),
        listCategories(true),
        listSuppliers(undefined, true),
        listProducts(0, 1000)
      ]);
      setWarehouses(warehousesData.warehouses || []);
      setCategories(categoriesData.categories || []);
      setSuppliers(suppliersData.suppliers || []);
      setProducts(productsData.products || []);
    } catch (err) {
      console.error('Failed to load initial data:', err);
    }
  };

  const loadStock = async () => {
    try {
      setLoading(true);
      const data = await listStock({
        warehouse_id: selectedWarehouse,
        category_id: selectedCategory,
        low_stock_only: lowStockOnly,
        skip: page * limit,
        limit
      });
      setStocks(data.stock || []);
      setTotalCount(data.count || 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load stock');
    } finally {
      setLoading(false);
    }
  };

  const getStockStatus = (stock: InventoryStock) => {
    if (stock.quantity_on_hand === 0) return { label: 'Out of Stock', class: styles.statusDanger };
    if (stock.quantity_on_hand <= stock.safety_stock) return { label: 'Critical', class: styles.statusDanger };
    if (stock.quantity_on_hand <= stock.reorder_point) return { label: 'Low Stock', class: styles.statusWarning };
    if (stock.quantity_on_hand >= stock.max_stock_level) return { label: 'Overstock', class: styles.statusInfo };
    return { label: 'In Stock', class: styles.statusSuccess };
  };

  const getStockProgressColor = (stock: InventoryStock) => {
    const percentage = (stock.quantity_on_hand / stock.max_stock_level) * 100;
    if (percentage === 0) return '#ef4444';
    if (percentage < 20) return '#ef4444';
    if (percentage < 40) return '#f59e0b';
    if (percentage > 100) return '#06b6d4';
    return '#10b981';
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(value);
  };

  const handleOpenMovement = (stock: InventoryStock) => {
    setSelectedStock(stock);
    setShowMovement(true);
  };

  return (
    <InventoryLayout>
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.pageHeader}>
        <div>
          <Link href="/inventory" className={styles.secondaryBtn} style={{ marginBottom: '0.5rem', display: 'inline-flex' }}>
            <span className="material-symbols-outlined">arrow_back</span>
            Back
          </Link>
          <h1 className={styles.pageTitle}>
            <span className="material-symbols-outlined">package_2</span>
            Stock Management
          </h1>
        </div>
        <div className={styles.pageActions}>
          <button className={styles.primaryBtn} onClick={() => setShowAddStock(true)}>
            <span className="material-symbols-outlined">add</span>
            Add Stock Record
          </button>
        </div>
      </div>

      {/* Messages */}
      {success && (
        <div className={styles.successMessage}>
          <span className="material-symbols-outlined">check_circle</span>
          {success}
        </div>
      )}
      {error && (
        <div className={styles.errorMessage}>
          <span className="material-symbols-outlined">error</span>
          {error}
        </div>
      )}

      {/* Filters */}
      <div className={styles.filters}>
        <div className={styles.filterGroup}>
          <label className={styles.filterLabel}>Warehouse</label>
          <select
            className={styles.filterSelect}
            value={selectedWarehouse || ''}
            onChange={(e) => setSelectedWarehouse(e.target.value ? Number(e.target.value) : undefined)}
          >
            <option value="">All Warehouses</option>
            {warehouses.map(w => (
              <option key={w.id} value={w.id}>{w.name}</option>
            ))}
          </select>
        </div>
        <div className={styles.filterGroup}>
          <label className={styles.filterLabel}>Category</label>
          <select
            className={styles.filterSelect}
            value={selectedCategory || ''}
            onChange={(e) => setSelectedCategory(e.target.value ? Number(e.target.value) : undefined)}
          >
            <option value="">All Categories</option>
            {categories.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div className={styles.filterCheckbox}>
          <input
            type="checkbox"
            id="lowStockOnly"
            checked={lowStockOnly}
            onChange={(e) => setLowStockOnly(e.target.checked)}
          />
          <label htmlFor="lowStockOnly">Low Stock Only</label>
        </div>
      </div>

      {/* Stock Table */}
      {loading ? (
        <div className={styles.loading}>
          <span className="material-symbols-outlined">sync</span>
          Loading stock data...
        </div>
      ) : stocks.length === 0 ? (
        <div className={styles.emptyState} style={{ padding: '4rem', background: '#1e293b', borderRadius: '0.75rem' }}>
          <span className="material-symbols-outlined">inventory_2</span>
          <p>No stock records found</p>
          <button className={styles.primaryBtn} onClick={() => setShowAddStock(true)}>
            Add Stock Record
          </button>
        </div>
      ) : (
        <>
          <table className={styles.dataTable}>
            <thead>
              <tr>
                <th>Product</th>
                <th>Warehouse</th>
                <th>Quantity</th>
                <th>Status</th>
                <th>Reorder Point</th>
                <th>Unit Cost</th>
                <th>Value</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {stocks.map(stock => {
                const status = getStockStatus(stock);
                const progressWidth = Math.min((stock.quantity_on_hand / stock.max_stock_level) * 100, 100);
                return (
                  <tr key={stock.id}>
                    <td>
                      <div className={styles.productName}>
                        {stock.product?.product_name || stock.product?.filename || 'N/A'}
                      </div>
                      <span className={styles.quantitySub}>{stock.product?.sku || ''}</span>
                    </td>
                    <td>{stock.warehouse?.name || 'N/A'}</td>
                    <td>
                      <div className={styles.quantityDisplay}>
                        <span className={styles.quantityMain}>{stock.quantity_on_hand}</span>
                        <span className={styles.quantitySub}>
                          Avail: {stock.quantity_available} | Res: {stock.quantity_reserved}
                        </span>
                        <div className={styles.stockProgress}>
                          <div 
                            className={styles.stockProgressBar}
                            style={{ 
                              width: `${progressWidth}%`,
                              background: getStockProgressColor(stock)
                            }}
                          />
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className={`${styles.statusBadge} ${status.class}`}>
                        {status.label}
                      </span>
                    </td>
                    <td>{stock.reorder_point}</td>
                    <td>{formatCurrency(stock.unit_cost)}</td>
                    <td>{formatCurrency(stock.quantity_on_hand * stock.average_cost)}</td>
                    <td>
                      <div className={styles.tableActions}>
                        <button 
                          className={`${styles.iconBtn} ${styles.edit}`}
                          onClick={() => handleOpenMovement(stock)}
                          title="Add Movement"
                        >
                          <span className="material-symbols-outlined">swap_horiz</span>
                        </button>
                        <Link 
                          href={`/inventory/stock/${stock.id}`}
                          className={styles.iconBtn}
                          title="View Details"
                        >
                          <span className="material-symbols-outlined">visibility</span>
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Pagination */}
          <div className={styles.pagination}>
            <span className={styles.paginationInfo}>
              Showing {page * limit + 1} to {Math.min((page + 1) * limit, totalCount)} of {totalCount} records
            </span>
            <div className={styles.paginationButtons}>
              <button
                className={styles.paginationBtn}
                onClick={() => setPage(p => p - 1)}
                disabled={page === 0}
              >
                <span className="material-symbols-outlined">chevron_left</span>
                Previous
              </button>
              <button
                className={styles.paginationBtn}
                onClick={() => setPage(p => p + 1)}
                disabled={(page + 1) * limit >= totalCount}
              >
                Next
                <span className="material-symbols-outlined">chevron_right</span>
              </button>
            </div>
          </div>
        </>
      )}

      {/* Add Stock Modal */}
      {showAddStock && (
        <AddStockModal
          warehouses={warehouses}
          categories={categories}
          suppliers={suppliers}
          products={products}
          onClose={() => setShowAddStock(false)}
          onSuccess={(msg) => {
            setSuccess(msg);
            setShowAddStock(false);
            loadStock();
            setTimeout(() => setSuccess(''), 3000);
          }}
          onError={(msg) => setError(msg)}
        />
      )}

      {/* Movement Modal */}
      {showMovement && selectedStock && (
        <MovementModal
          stock={selectedStock}
          warehouses={warehouses}
          suppliers={suppliers}
          onClose={() => { setShowMovement(false); setSelectedStock(null); }}
          onSuccess={(msg) => {
            setSuccess(msg);
            setShowMovement(false);
            setSelectedStock(null);
            loadStock();
            setTimeout(() => setSuccess(''), 3000);
          }}
          onError={(msg) => setError(msg)}
        />
      )}
    </div>
    </InventoryLayout>
  );
}

// Add Stock Modal Component
function AddStockModal({ 
  warehouses, 
  categories, 
  suppliers, 
  products,
  onClose, 
  onSuccess, 
  onError 
}: {
  warehouses: Warehouse[];
  categories: Category[];
  suppliers: Supplier[];
  products: any[];
  onClose: () => void;
  onSuccess: (msg: string) => void;
  onError: (msg: string) => void;
}) {
  const [formData, setFormData] = useState({
    product_id: '',
    warehouse_id: warehouses.find(w => w.is_default)?.id || warehouses[0]?.id || 0,
    category_id: '',
    supplier_id: '',
    quantity_on_hand: 0,
    reorder_point: 10,
    reorder_quantity: 50,
    safety_stock: 5,
    max_stock_level: 500,
    unit_cost: 0,
    bin_location: ''
  });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.product_id || !formData.warehouse_id) {
      onError('Product and Warehouse are required');
      return;
    }

    try {
      setSubmitting(true);
      await createStock({
        product_id: formData.product_id,
        warehouse_id: Number(formData.warehouse_id),
        category_id: formData.category_id ? Number(formData.category_id) : undefined,
        supplier_id: formData.supplier_id ? Number(formData.supplier_id) : undefined,
        quantity_on_hand: formData.quantity_on_hand,
        reorder_point: formData.reorder_point,
        reorder_quantity: formData.reorder_quantity,
        safety_stock: formData.safety_stock,
        max_stock_level: formData.max_stock_level,
        unit_cost: formData.unit_cost,
        bin_location: formData.bin_location || undefined
      });
      onSuccess('Stock record created successfully');
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Failed to create stock record');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={styles.modal} onClick={onClose}>
      <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>
            <span className="material-symbols-outlined">add_box</span>
            Add Stock Record
          </h2>
          <button className={styles.modalClose} onClick={onClose}>
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className={styles.modalBody}>
            <div className={styles.formGrid}>
              <div className={`${styles.formGroup} ${styles.formGroupFull}`}>
                <label className={styles.formLabel}>Product *</label>
                <select
                  className={styles.formSelect}
                  value={formData.product_id}
                  onChange={(e) => setFormData({...formData, product_id: e.target.value})}
                  required
                >
                  <option value="">Select Product</option>
                  {products.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.product_name || p.filename} {p.sku ? `(${p.sku})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Warehouse *</label>
                <select
                  className={styles.formSelect}
                  value={formData.warehouse_id}
                  onChange={(e) => setFormData({...formData, warehouse_id: Number(e.target.value)})}
                  required
                >
                  {warehouses.map(w => (
                    <option key={w.id} value={w.id}>{w.name}</option>
                  ))}
                </select>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Category</label>
                <select
                  className={styles.formSelect}
                  value={formData.category_id}
                  onChange={(e) => setFormData({...formData, category_id: e.target.value})}
                >
                  <option value="">Select Category</option>
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Supplier</label>
                <select
                  className={styles.formSelect}
                  value={formData.supplier_id}
                  onChange={(e) => setFormData({...formData, supplier_id: e.target.value})}
                >
                  <option value="">Select Supplier</option>
                  {suppliers.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Initial Quantity</label>
                <input
                  type="number"
                  className={styles.formInput}
                  value={formData.quantity_on_hand}
                  onChange={(e) => setFormData({...formData, quantity_on_hand: Number(e.target.value)})}
                  min="0"
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Unit Cost ($)</label>
                <input
                  type="number"
                  className={styles.formInput}
                  value={formData.unit_cost}
                  onChange={(e) => setFormData({...formData, unit_cost: Number(e.target.value)})}
                  min="0"
                  step="0.01"
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Reorder Point</label>
                <input
                  type="number"
                  className={styles.formInput}
                  value={formData.reorder_point}
                  onChange={(e) => setFormData({...formData, reorder_point: Number(e.target.value)})}
                  min="0"
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Reorder Quantity</label>
                <input
                  type="number"
                  className={styles.formInput}
                  value={formData.reorder_quantity}
                  onChange={(e) => setFormData({...formData, reorder_quantity: Number(e.target.value)})}
                  min="0"
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Safety Stock</label>
                <input
                  type="number"
                  className={styles.formInput}
                  value={formData.safety_stock}
                  onChange={(e) => setFormData({...formData, safety_stock: Number(e.target.value)})}
                  min="0"
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Max Stock Level</label>
                <input
                  type="number"
                  className={styles.formInput}
                  value={formData.max_stock_level}
                  onChange={(e) => setFormData({...formData, max_stock_level: Number(e.target.value)})}
                  min="0"
                />
              </div>

              <div className={`${styles.formGroup} ${styles.formGroupFull}`}>
                <label className={styles.formLabel}>Bin Location</label>
                <input
                  type="text"
                  className={styles.formInput}
                  value={formData.bin_location}
                  onChange={(e) => setFormData({...formData, bin_location: e.target.value})}
                  placeholder="e.g., A-01-02"
                />
              </div>
            </div>
          </div>
          <div className={styles.modalFooter}>
            <button type="button" className={styles.secondaryBtn} onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className={styles.primaryBtn} disabled={submitting}>
              {submitting ? 'Creating...' : 'Create Stock Record'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Movement Modal Component
function MovementModal({
  stock,
  warehouses,
  suppliers,
  onClose,
  onSuccess,
  onError
}: {
  stock: InventoryStock;
  warehouses: Warehouse[];
  suppliers: Supplier[];
  onClose: () => void;
  onSuccess: (msg: string) => void;
  onError: (msg: string) => void;
}) {
  const [formData, setFormData] = useState({
    movement_type: 'stock_in',
    quantity: 1,
    supplier_id: '',
    to_warehouse_id: '',
    unit_cost: stock.unit_cost || 0,
    reason: '',
    notes: '',
    performed_by: ''
  });
  const [submitting, setSubmitting] = useState(false);

  const movementTypes = [
    { value: 'stock_in', label: 'Stock In', icon: 'arrow_downward' },
    { value: 'stock_out', label: 'Stock Out', icon: 'arrow_upward' },
    { value: 'adjustment', label: 'Adjustment', icon: 'tune' },
    { value: 'transfer', label: 'Transfer', icon: 'swap_horiz' },
    { value: 'return_in', label: 'Return In', icon: 'keyboard_return' },
    { value: 'return_out', label: 'Return Out', icon: 'undo' },
    { value: 'damage', label: 'Damage', icon: 'broken_image' },
    { value: 'loss', label: 'Loss', icon: 'error' }
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.quantity <= 0) {
      onError('Quantity must be greater than 0');
      return;
    }

    if (formData.movement_type === 'transfer' && !formData.to_warehouse_id) {
      onError('Please select destination warehouse for transfer');
      return;
    }

    try {
      setSubmitting(true);
      await createMovement({
        movement_type: formData.movement_type,
        product_id: stock.product_id,
        warehouse_id: stock.warehouse_id,
        quantity: formData.quantity,
        supplier_id: formData.supplier_id ? Number(formData.supplier_id) : undefined,
        to_warehouse_id: formData.to_warehouse_id ? Number(formData.to_warehouse_id) : undefined,
        unit_cost: formData.unit_cost,
        reason: formData.reason || undefined,
        notes: formData.notes || undefined,
        performed_by: formData.performed_by || undefined
      });
      onSuccess('Stock movement recorded successfully');
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Failed to record movement');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={styles.modal} onClick={onClose}>
      <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>
            <span className="material-symbols-outlined">swap_horiz</span>
            Record Stock Movement
          </h2>
          <button className={styles.modalClose} onClick={onClose}>
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className={styles.modalBody}>
            {/* Product Info */}
            <div style={{ marginBottom: '1.5rem', padding: '1rem', background: '#0f172a', borderRadius: '0.5rem' }}>
              <div style={{ fontWeight: 600, color: '#f8fafc' }}>
                {stock.product?.product_name || stock.product?.filename || 'Product'}
              </div>
              <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '0.25rem' }}>
                Current Stock: {stock.quantity_on_hand} | Warehouse: {stock.warehouse?.name}
              </div>
            </div>

            <div className={styles.formGrid}>
              <div className={`${styles.formGroup} ${styles.formGroupFull}`}>
                <label className={styles.formLabel}>Movement Type *</label>
                <select
                  className={styles.formSelect}
                  value={formData.movement_type}
                  onChange={(e) => setFormData({...formData, movement_type: e.target.value})}
                  required
                >
                  {movementTypes.map(t => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Quantity *</label>
                <input
                  type="number"
                  className={styles.formInput}
                  value={formData.quantity}
                  onChange={(e) => setFormData({...formData, quantity: Number(e.target.value)})}
                  min="1"
                  required
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Unit Cost ($)</label>
                <input
                  type="number"
                  className={styles.formInput}
                  value={formData.unit_cost}
                  onChange={(e) => setFormData({...formData, unit_cost: Number(e.target.value)})}
                  min="0"
                  step="0.01"
                />
              </div>

              {formData.movement_type === 'stock_in' && (
                <div className={`${styles.formGroup} ${styles.formGroupFull}`}>
                  <label className={styles.formLabel}>Supplier</label>
                  <select
                    className={styles.formSelect}
                    value={formData.supplier_id}
                    onChange={(e) => setFormData({...formData, supplier_id: e.target.value})}
                  >
                    <option value="">Select Supplier</option>
                    {suppliers.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {formData.movement_type === 'transfer' && (
                <div className={`${styles.formGroup} ${styles.formGroupFull}`}>
                  <label className={styles.formLabel}>Transfer To Warehouse *</label>
                  <select
                    className={styles.formSelect}
                    value={formData.to_warehouse_id}
                    onChange={(e) => setFormData({...formData, to_warehouse_id: e.target.value})}
                    required
                  >
                    <option value="">Select Destination</option>
                    {warehouses.filter(w => w.id !== stock.warehouse_id).map(w => (
                      <option key={w.id} value={w.id}>{w.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className={`${styles.formGroup} ${styles.formGroupFull}`}>
                <label className={styles.formLabel}>Reason</label>
                <input
                  type="text"
                  className={styles.formInput}
                  value={formData.reason}
                  onChange={(e) => setFormData({...formData, reason: e.target.value})}
                  placeholder="Brief reason for this movement"
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Performed By</label>
                <input
                  type="text"
                  className={styles.formInput}
                  value={formData.performed_by}
                  onChange={(e) => setFormData({...formData, performed_by: e.target.value})}
                  placeholder="Name of person"
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Notes</label>
                <input
                  type="text"
                  className={styles.formInput}
                  value={formData.notes}
                  onChange={(e) => setFormData({...formData, notes: e.target.value})}
                  placeholder="Additional notes"
                />
              </div>
            </div>
          </div>
          <div className={styles.modalFooter}>
            <button type="button" className={styles.secondaryBtn} onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className={styles.primaryBtn} disabled={submitting}>
              {submitting ? 'Recording...' : 'Record Movement'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
