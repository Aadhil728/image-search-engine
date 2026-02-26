'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  listPurchaseOrders,
  getPurchaseOrder,
  createPurchaseOrder,
  updatePOStatus,
  receivePurchaseOrder,
  listSuppliers,
  listWarehouses,
  PurchaseOrder,
  Supplier,
  Warehouse
} from '@/lib/inventoryApi';
import { listProducts } from '@/lib/api';
import styles from '@/styles/Inventory.module.css';
import InventoryLayout from '@/components/InventoryLayout';

export default function PurchaseOrdersPage() {
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<PurchaseOrder | null>(null);

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    loadOrders();
  }, [statusFilter]);

  const loadInitialData = async () => {
    try {
      const [suppliersData, warehousesData, productsData] = await Promise.all([
        listSuppliers(undefined, true),
        listWarehouses(true),
        listProducts(0, 1000)
      ]);
      setSuppliers(suppliersData.suppliers || []);
      setWarehouses(warehousesData.warehouses || []);
      setProducts(productsData.products || []);
    } catch (err) {
      console.error('Failed to load initial data:', err);
    }
  };

  const loadOrders = async () => {
    try {
      setLoading(true);
      const data = await listPurchaseOrders({ status: statusFilter || undefined });
      setOrders(data.purchase_orders || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load orders');
    } finally {
      setLoading(false);
    }
  };

  const handleViewOrder = async (orderId: number) => {
    try {
      const data = await getPurchaseOrder(orderId);
      setSelectedOrder(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load order details');
    }
  };

  const handleStatusChange = async (orderId: number, newStatus: string) => {
    try {
      await updatePOStatus(orderId, newStatus, 'Admin');
      setSuccess(`Order status updated to ${newStatus}`);
      loadOrders();
      if (selectedOrder?.id === orderId) {
        handleViewOrder(orderId);
      }
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update status');
    }
  };

  const handleReceive = async (orderId: number) => {
    try {
      await receivePurchaseOrder(orderId, 'Admin');
      setSuccess('Purchase order received successfully');
      loadOrders();
      setSelectedOrder(null);
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to receive order');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return styles.statusInfo;
      case 'submitted': return styles.statusWarning;
      case 'approved': return styles.statusSuccess;
      case 'received': return styles.statusSuccess;
      case 'cancelled': return styles.statusDanger;
      default: return '';
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(value);
  };

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
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
              <span className="material-symbols-outlined">shopping_cart</span>
              Purchase Orders
            </h1>
          </div>
          <div className={styles.pageActions}>
            <button className={styles.primaryBtn} onClick={() => setShowCreateModal(true)}>
              <span className="material-symbols-outlined">add</span>
              Create PO
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
          <label className={styles.filterLabel}>Status</label>
          <select
            className={styles.filterSelect}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">All Statuses</option>
            <option value="draft">Draft</option>
            <option value="submitted">Submitted</option>
            <option value="approved">Approved</option>
            <option value="received">Received</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      {/* Orders Table */}
      {loading ? (
        <div className={styles.loading}>
          <span className="material-symbols-outlined">sync</span>
          Loading purchase orders...
        </div>
      ) : orders.length === 0 ? (
        <div className={styles.emptyState} style={{ padding: '4rem', background: '#1e293b', borderRadius: '0.75rem' }}>
          <span className="material-symbols-outlined">shopping_cart</span>
          <p>No purchase orders found</p>
          <button className={styles.primaryBtn} onClick={() => setShowCreateModal(true)}>
            Create Purchase Order
          </button>
        </div>
      ) : (
        <table className={styles.dataTable}>
          <thead>
            <tr>
              <th>PO Number</th>
              <th>Supplier</th>
              <th>Warehouse</th>
              <th>Order Date</th>
              <th>Expected</th>
              <th>Items</th>
              <th>Total</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {orders.map(order => (
              <tr key={order.id}>
                <td>
                  <span style={{ fontFamily: 'monospace', fontWeight: 600, color: '#3b82f6' }}>
                    {order.po_number}
                  </span>
                </td>
                <td>{order.supplier?.name || 'N/A'}</td>
                <td>{order.warehouse?.name || 'N/A'}</td>
                <td>{formatDate(order.order_date)}</td>
                <td>{formatDate(order.expected_date)}</td>
                <td>{order.items_count || 0}</td>
                <td style={{ fontWeight: 600 }}>{formatCurrency(order.total_amount)}</td>
                <td>
                  <span className={`${styles.statusBadge} ${getStatusColor(order.status)}`}>
                    {order.status}
                  </span>
                </td>
                <td>
                  <div className={styles.tableActions}>
                    <button
                      className={styles.iconBtn}
                      onClick={() => handleViewOrder(order.id)}
                      title="View Details"
                    >
                      <span className="material-symbols-outlined">visibility</span>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <CreatePOModal
          suppliers={suppliers}
          warehouses={warehouses}
          products={products}
          onClose={() => setShowCreateModal(false)}
          onSuccess={(msg) => {
            setSuccess(msg);
            setShowCreateModal(false);
            loadOrders();
            setTimeout(() => setSuccess(''), 3000);
          }}
          onError={(msg) => setError(msg)}
        />
      )}

      {/* View Order Modal */}
      {selectedOrder && (
        <ViewPOModal
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
          onStatusChange={handleStatusChange}
          onReceive={handleReceive}
          getStatusColor={getStatusColor}
          formatCurrency={formatCurrency}
          formatDate={formatDate}
        />
      )}
      </div>
    </InventoryLayout>
  );
}

function CreatePOModal({
  suppliers,
  warehouses,
  products,
  onClose,
  onSuccess,
  onError
}: {
  suppliers: Supplier[];
  warehouses: Warehouse[];
  products: any[];
  onClose: () => void;
  onSuccess: (msg: string) => void;
  onError: (msg: string) => void;
}) {
  const [formData, setFormData] = useState({
    supplier_id: suppliers[0]?.id || 0,
    warehouse_id: warehouses.find(w => w.is_default)?.id || warehouses[0]?.id || 0,
    expected_date: '',
    notes: ''
  });
  const [items, setItems] = useState<{product_id: string; quantity_ordered: number; unit_price: number}[]>([
    { product_id: '', quantity_ordered: 1, unit_price: 0 }
  ]);
  const [submitting, setSubmitting] = useState(false);

  const addItem = () => {
    setItems([...items, { product_id: '', quantity_ordered: 1, unit_price: 0 }]);
  };

  const removeItem = (index: number) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index));
    }
  };

  const updateItem = (index: number, field: string, value: any) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  const calculateTotal = () => {
    return items.reduce((sum, item) => sum + (item.quantity_ordered * item.unit_price), 0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validItems = items.filter(item => item.product_id && item.quantity_ordered > 0);
    if (validItems.length === 0) {
      onError('Please add at least one item');
      return;
    }

    try {
      setSubmitting(true);
      await createPurchaseOrder({
        supplier_id: formData.supplier_id,
        warehouse_id: formData.warehouse_id,
        expected_date: formData.expected_date || undefined,
        items: validItems,
        notes: formData.notes || undefined,
        created_by: 'Admin'
      });
      onSuccess('Purchase order created successfully');
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Failed to create order');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={styles.modal} onClick={onClose}>
      <div className={styles.modalContent} onClick={e => e.stopPropagation()} style={{ maxWidth: '800px' }}>
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>
            <span className="material-symbols-outlined">add_shopping_cart</span>
            Create Purchase Order
          </h2>
          <button className={styles.modalClose} onClick={onClose}>
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className={styles.modalBody}>
            <div className={styles.formGrid}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Supplier *</label>
                <select
                  className={styles.formSelect}
                  value={formData.supplier_id}
                  onChange={(e) => setFormData({...formData, supplier_id: Number(e.target.value)})}
                  required
                >
                  {suppliers.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
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
                <label className={styles.formLabel}>Expected Date</label>
                <input
                  type="date"
                  className={styles.formInput}
                  value={formData.expected_date}
                  onChange={(e) => setFormData({...formData, expected_date: e.target.value})}
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Notes</label>
                <input
                  type="text"
                  className={styles.formInput}
                  value={formData.notes}
                  onChange={(e) => setFormData({...formData, notes: e.target.value})}
                />
              </div>
            </div>

            {/* Items */}
            <div style={{ marginTop: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <label className={styles.formLabel} style={{ margin: 0 }}>Order Items</label>
                <button type="button" className={styles.secondaryBtn} onClick={addItem}>
                  <span className="material-symbols-outlined">add</span>
                  Add Item
                </button>
              </div>
              <table className={styles.dataTable}>
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Quantity</th>
                    <th>Unit Price</th>
                    <th>Total</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, index) => (
                    <tr key={index}>
                      <td>
                        <select
                          className={styles.formSelect}
                          value={item.product_id}
                          onChange={(e) => updateItem(index, 'product_id', e.target.value)}
                          style={{ minWidth: '200px' }}
                        >
                          <option value="">Select Product</option>
                          {products.map(p => (
                            <option key={p.id} value={p.id}>
                              {p.product_name || p.filename} {p.sku ? `(${p.sku})` : ''}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <input
                          type="number"
                          className={styles.formInput}
                          value={item.quantity_ordered}
                          onChange={(e) => updateItem(index, 'quantity_ordered', Number(e.target.value))}
                          min="1"
                          style={{ width: '80px' }}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          className={styles.formInput}
                          value={item.unit_price}
                          onChange={(e) => updateItem(index, 'unit_price', Number(e.target.value))}
                          min="0"
                          step="0.01"
                          style={{ width: '100px' }}
                        />
                      </td>
                      <td>${(item.quantity_ordered * item.unit_price).toFixed(2)}</td>
                      <td>
                        <button
                          type="button"
                          className={`${styles.iconBtn} ${styles.delete}`}
                          onClick={() => removeItem(index)}
                          disabled={items.length === 1}
                        >
                          <span className="material-symbols-outlined">delete</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={3} style={{ textAlign: 'right', fontWeight: 600 }}>Total:</td>
                    <td style={{ fontWeight: 600, color: '#10b981' }}>${calculateTotal().toFixed(2)}</td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
          <div className={styles.modalFooter}>
            <button type="button" className={styles.secondaryBtn} onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className={styles.primaryBtn} disabled={submitting}>
              {submitting ? 'Creating...' : 'Create Order'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ViewPOModal({
  order,
  onClose,
  onStatusChange,
  onReceive,
  getStatusColor,
  formatCurrency,
  formatDate
}: {
  order: PurchaseOrder;
  onClose: () => void;
  onStatusChange: (id: number, status: string) => void;
  onReceive: (id: number) => void;
  getStatusColor: (status: string) => string;
  formatCurrency: (value: number) => string;
  formatDate: (date: string | null | undefined) => string;
}) {
  return (
    <div className={styles.modal} onClick={onClose}>
      <div className={styles.modalContent} onClick={e => e.stopPropagation()} style={{ maxWidth: '800px' }}>
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>
            <span className="material-symbols-outlined">receipt_long</span>
            {order.po_number}
          </h2>
          <button className={styles.modalClose} onClick={onClose}>
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <div className={styles.modalBody}>
          {/* Order Info */}
          <div className={styles.formGrid} style={{ marginBottom: '1.5rem' }}>
            <div>
              <label className={styles.formLabel}>Supplier</label>
              <p style={{ margin: 0, color: '#f8fafc' }}>{order.supplier?.name}</p>
            </div>
            <div>
              <label className={styles.formLabel}>Warehouse</label>
              <p style={{ margin: 0, color: '#f8fafc' }}>{order.warehouse?.name}</p>
            </div>
            <div>
              <label className={styles.formLabel}>Order Date</label>
              <p style={{ margin: 0, color: '#f8fafc' }}>{formatDate(order.order_date)}</p>
            </div>
            <div>
              <label className={styles.formLabel}>Expected Date</label>
              <p style={{ margin: 0, color: '#f8fafc' }}>{formatDate(order.expected_date)}</p>
            </div>
            <div>
              <label className={styles.formLabel}>Status</label>
              <span className={`${styles.statusBadge} ${getStatusColor(order.status)}`}>
                {order.status}
              </span>
            </div>
            <div>
              <label className={styles.formLabel}>Total</label>
              <p style={{ margin: 0, color: '#10b981', fontWeight: 600, fontSize: '1.25rem' }}>
                {formatCurrency(order.total_amount)}
              </p>
            </div>
          </div>

          {/* Items */}
          {order.items && order.items.length > 0 && (
            <>
              <label className={styles.formLabel}>Order Items</label>
              <table className={styles.dataTable}>
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Ordered</th>
                    <th>Received</th>
                    <th>Unit Price</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {order.items.map((item: any, index: number) => (
                    <tr key={index}>
                      <td>{item.product?.product_name || item.product?.filename || 'N/A'}</td>
                      <td>{item.quantity_ordered}</td>
                      <td>{item.quantity_received || 0}</td>
                      <td>{formatCurrency(item.unit_price)}</td>
                      <td>{formatCurrency(item.total_price)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>
        <div className={styles.modalFooter}>
          {order.status === 'draft' && (
            <button
              className={styles.primaryBtn}
              onClick={() => onStatusChange(order.id, 'submitted')}
            >
              Submit for Approval
            </button>
          )}
          {order.status === 'submitted' && (
            <>
              <button
                className={styles.primaryBtn}
                onClick={() => onStatusChange(order.id, 'approved')}
              >
                Approve
              </button>
              <button
                className={styles.secondaryBtn}
                onClick={() => onStatusChange(order.id, 'cancelled')}
                style={{ borderColor: '#ef4444', color: '#ef4444' }}
              >
                Cancel
              </button>
            </>
          )}
          {order.status === 'approved' && (
            <button
              className={styles.primaryBtn}
              onClick={() => onReceive(order.id)}
            >
              <span className="material-symbols-outlined">check</span>
              Receive Order
            </button>
          )}
          <button className={styles.secondaryBtn} onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
