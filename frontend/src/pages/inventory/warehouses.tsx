'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  listWarehouses,
  createWarehouse,
  updateWarehouse,
  Warehouse
} from '@/lib/inventoryApi';
import styles from '@/styles/Inventory.module.css';
import InventoryLayout from '@/components/InventoryLayout';

export default function WarehousesPage() {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingWarehouse, setEditingWarehouse] = useState<Warehouse | null>(null);

  useEffect(() => {
    loadWarehouses();
  }, []);

  const loadWarehouses = async () => {
    try {
      setLoading(true);
      const data = await listWarehouses();
      setWarehouses(data.warehouses || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load warehouses');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (warehouse: Warehouse) => {
    setEditingWarehouse(warehouse);
    setShowModal(true);
  };

  const handleCreate = () => {
    setEditingWarehouse(null);
    setShowModal(true);
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
            <span className="material-symbols-outlined">warehouse</span>
            Warehouses
          </h1>
        </div>
        <div className={styles.pageActions}>
          <button className={styles.primaryBtn} onClick={handleCreate}>
            <span className="material-symbols-outlined">add</span>
            Add Warehouse
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

      {/* Warehouses Grid */}
      {loading ? (
        <div className={styles.loading}>
          <span className="material-symbols-outlined">sync</span>
          Loading warehouses...
        </div>
      ) : warehouses.length === 0 ? (
        <div className={styles.emptyState} style={{ padding: '4rem', background: '#1e293b', borderRadius: '0.75rem' }}>
          <span className="material-symbols-outlined">warehouse</span>
          <p>No warehouses found</p>
          <button className={styles.primaryBtn} onClick={handleCreate}>
            Add Warehouse
          </button>
        </div>
      ) : (
        <div className={styles.statsGrid} style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
          {warehouses.map(warehouse => (
            <div key={warehouse.id} className={styles.statCard} style={{ flexDirection: 'column', alignItems: 'stretch', padding: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                    <span className="material-symbols-outlined" style={{ color: '#3b82f6' }}>warehouse</span>
                    <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600, color: '#f8fafc' }}>
                      {warehouse.name}
                    </h3>
                    {warehouse.is_default && (
                      <span className={styles.badge} style={{ background: '#10b981' }}>Default</span>
                    )}
                  </div>
                  <span style={{ fontFamily: 'monospace', fontSize: '0.8rem', color: '#64748b' }}>
                    {warehouse.code}
                  </span>
                </div>
                <span className={`${styles.statusBadge} ${warehouse.is_active ? styles.statusSuccess : styles.statusDanger}`}>
                  {warehouse.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.875rem', color: '#94a3b8', flex: 1 }}>
                {warehouse.address && (
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '1rem', flexShrink: 0 }}>location_on</span>
                    <span>{warehouse.address}</span>
                  </div>
                )}
                {(warehouse.city || warehouse.country) && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginLeft: '1.5rem' }}>
                    {[warehouse.city, warehouse.country].filter(Boolean).join(', ')}
                  </div>
                )}
                {warehouse.manager_name && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>person</span>
                    <span>{warehouse.manager_name}</span>
                  </div>
                )}
                {warehouse.phone && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>phone</span>
                    <span>{warehouse.phone}</span>
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid #334155' }}>
                <button
                  className={`${styles.iconBtn} ${styles.edit}`}
                  onClick={() => handleEdit(warehouse)}
                  title="Edit"
                >
                  <span className="material-symbols-outlined">edit</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <WarehouseModal
          warehouse={editingWarehouse}
          onClose={() => { setShowModal(false); setEditingWarehouse(null); }}
          onSuccess={(msg) => {
            setSuccess(msg);
            setShowModal(false);
            setEditingWarehouse(null);
            loadWarehouses();
            setTimeout(() => setSuccess(''), 3000);
          }}
          onError={(msg) => setError(msg)}
        />
      )}
    </div>
    </InventoryLayout>
  );
}

function WarehouseModal({
  warehouse,
  onClose,
  onSuccess,
  onError
}: {
  warehouse: Warehouse | null;
  onClose: () => void;
  onSuccess: (msg: string) => void;
  onError: (msg: string) => void;
}) {
  const [formData, setFormData] = useState({
    code: warehouse?.code || '',
    name: warehouse?.name || '',
    address: warehouse?.address || '',
    city: warehouse?.city || '',
    country: warehouse?.country || '',
    manager_name: warehouse?.manager_name || '',
    phone: warehouse?.phone || '',
    is_default: warehouse?.is_default ?? false,
    is_active: warehouse?.is_active ?? true
  });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.code || !formData.name) {
      onError('Code and Name are required');
      return;
    }

    try {
      setSubmitting(true);
      if (warehouse) {
        await updateWarehouse(warehouse.id, formData);
        onSuccess('Warehouse updated successfully');
      } else {
        await createWarehouse(formData);
        onSuccess('Warehouse created successfully');
      }
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Operation failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={styles.modal} onClick={onClose}>
      <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>
            <span className="material-symbols-outlined">warehouse</span>
            {warehouse ? 'Edit Warehouse' : 'Add Warehouse'}
          </h2>
          <button className={styles.modalClose} onClick={onClose}>
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className={styles.modalBody}>
            <div className={styles.formGrid}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Code *</label>
                <input
                  type="text"
                  className={styles.formInput}
                  value={formData.code}
                  onChange={(e) => setFormData({...formData, code: e.target.value})}
                  placeholder="e.g., WH001"
                  required
                  disabled={!!warehouse}
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Name *</label>
                <input
                  type="text"
                  className={styles.formInput}
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  required
                />
              </div>
              <div className={`${styles.formGroup} ${styles.formGroupFull}`}>
                <label className={styles.formLabel}>Address</label>
                <input
                  type="text"
                  className={styles.formInput}
                  value={formData.address}
                  onChange={(e) => setFormData({...formData, address: e.target.value})}
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>City</label>
                <input
                  type="text"
                  className={styles.formInput}
                  value={formData.city}
                  onChange={(e) => setFormData({...formData, city: e.target.value})}
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Country</label>
                <input
                  type="text"
                  className={styles.formInput}
                  value={formData.country}
                  onChange={(e) => setFormData({...formData, country: e.target.value})}
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Manager Name</label>
                <input
                  type="text"
                  className={styles.formInput}
                  value={formData.manager_name}
                  onChange={(e) => setFormData({...formData, manager_name: e.target.value})}
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Phone</label>
                <input
                  type="text"
                  className={styles.formInput}
                  value={formData.phone}
                  onChange={(e) => setFormData({...formData, phone: e.target.value})}
                />
              </div>
              <div className={styles.filterCheckbox}>
                <input
                  type="checkbox"
                  id="isDefault"
                  checked={formData.is_default}
                  onChange={(e) => setFormData({...formData, is_default: e.target.checked})}
                />
                <label htmlFor="isDefault">Default Warehouse</label>
              </div>
              {warehouse && (
                <div className={styles.filterCheckbox}>
                  <input
                    type="checkbox"
                    id="isActive"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({...formData, is_active: e.target.checked})}
                  />
                  <label htmlFor="isActive">Active</label>
                </div>
              )}
            </div>
          </div>
          <div className={styles.modalFooter}>
            <button type="button" className={styles.secondaryBtn} onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className={styles.primaryBtn} disabled={submitting}>
              {submitting ? 'Saving...' : (warehouse ? 'Update' : 'Create')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
