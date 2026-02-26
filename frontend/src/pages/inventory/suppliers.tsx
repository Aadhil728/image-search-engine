'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  listSuppliers,
  createSupplier,
  updateSupplier,
  Supplier
} from '@/lib/inventoryApi';
import styles from '@/styles/Inventory.module.css';
import InventoryLayout from '@/components/InventoryLayout';

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);

  useEffect(() => {
    loadSuppliers();
  }, [search]);

  const loadSuppliers = async () => {
    try {
      setLoading(true);
      const data = await listSuppliers(search || undefined, true);
      setSuppliers(data.suppliers || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load suppliers');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (supplier: Supplier) => {
    setEditingSupplier(supplier);
    setShowModal(true);
  };

  const handleCreate = () => {
    setEditingSupplier(null);
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
            <span className="material-symbols-outlined">local_shipping</span>
            Suppliers
          </h1>
        </div>
        <div className={styles.pageActions}>
          <button className={styles.primaryBtn} onClick={handleCreate}>
            <span className="material-symbols-outlined">add</span>
            Add Supplier
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

      {/* Search */}
      <div className={styles.filters}>
        <div className={styles.filterGroup} style={{ flex: 1 }}>
          <label className={styles.filterLabel}>Search Suppliers</label>
          <input
            type="text"
            className={styles.filterInput}
            style={{ width: '100%', maxWidth: '400px' }}
            placeholder="Search by name or code..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Suppliers Table */}
      {loading ? (
        <div className={styles.loading}>
          <span className="material-symbols-outlined">sync</span>
          Loading suppliers...
        </div>
      ) : suppliers.length === 0 ? (
        <div className={styles.emptyState} style={{ padding: '4rem', background: '#1e293b', borderRadius: '0.75rem' }}>
          <span className="material-symbols-outlined">local_shipping</span>
          <p>No suppliers found</p>
          <button className={styles.primaryBtn} onClick={handleCreate}>
            Add Supplier
          </button>
        </div>
      ) : (
        <table className={styles.dataTable}>
          <thead>
            <tr>
              <th>Code</th>
              <th>Name</th>
              <th>Contact Person</th>
              <th>Email</th>
              <th>Phone</th>
              <th>Location</th>
              <th>Lead Time</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {suppliers.map(supplier => (
              <tr key={supplier.id}>
                <td>
                  <span style={{ fontFamily: 'monospace', fontSize: '0.85rem', color: '#94a3b8' }}>
                    {supplier.code}
                  </span>
                </td>
                <td>
                  <span className={styles.productName}>{supplier.name}</span>
                </td>
                <td>{supplier.contact_person || '-'}</td>
                <td>
                  {supplier.email ? (
                    <a href={`mailto:${supplier.email}`} style={{ color: '#3b82f6' }}>
                      {supplier.email}
                    </a>
                  ) : '-'}
                </td>
                <td>{supplier.phone || '-'}</td>
                <td>
                  {supplier.city || supplier.country ? (
                    <span style={{ color: '#94a3b8' }}>
                      {[supplier.city, supplier.country].filter(Boolean).join(', ')}
                    </span>
                  ) : '-'}
                </td>
                <td>{supplier.lead_time_days} days</td>
                <td>
                  <span className={`${styles.statusBadge} ${supplier.is_active ? styles.statusSuccess : styles.statusDanger}`}>
                    {supplier.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td>
                  <div className={styles.tableActions}>
                    <button
                      className={`${styles.iconBtn} ${styles.edit}`}
                      onClick={() => handleEdit(supplier)}
                      title="Edit"
                    >
                      <span className="material-symbols-outlined">edit</span>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Modal */}
      {showModal && (
        <SupplierModal
          supplier={editingSupplier}
          onClose={() => { setShowModal(false); setEditingSupplier(null); }}
          onSuccess={(msg) => {
            setSuccess(msg);
            setShowModal(false);
            setEditingSupplier(null);
            loadSuppliers();
            setTimeout(() => setSuccess(''), 3000);
          }}
          onError={(msg) => setError(msg)}
        />
      )}
    </div>
    </InventoryLayout>
  );
}

function SupplierModal({
  supplier,
  onClose,
  onSuccess,
  onError
}: {
  supplier: Supplier | null;
  onClose: () => void;
  onSuccess: (msg: string) => void;
  onError: (msg: string) => void;
}) {
  const [formData, setFormData] = useState({
    code: supplier?.code || '',
    name: supplier?.name || '',
    contact_person: supplier?.contact_person || '',
    email: supplier?.email || '',
    phone: supplier?.phone || '',
    address: supplier?.address || '',
    city: supplier?.city || '',
    country: supplier?.country || '',
    payment_terms: supplier?.payment_terms || '',
    lead_time_days: supplier?.lead_time_days || 7,
    notes: supplier?.notes || '',
    is_active: supplier?.is_active ?? true
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
      if (supplier) {
        await updateSupplier(supplier.id, formData);
        onSuccess('Supplier updated successfully');
      } else {
        await createSupplier(formData);
        onSuccess('Supplier created successfully');
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
            <span className="material-symbols-outlined">local_shipping</span>
            {supplier ? 'Edit Supplier' : 'Add Supplier'}
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
                  placeholder="e.g., SUP001"
                  required
                  disabled={!!supplier}
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
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Contact Person</label>
                <input
                  type="text"
                  className={styles.formInput}
                  value={formData.contact_person}
                  onChange={(e) => setFormData({...formData, contact_person: e.target.value})}
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Email</label>
                <input
                  type="email"
                  className={styles.formInput}
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
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
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Lead Time (days)</label>
                <input
                  type="number"
                  className={styles.formInput}
                  value={formData.lead_time_days}
                  onChange={(e) => setFormData({...formData, lead_time_days: Number(e.target.value)})}
                  min="1"
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
              <div className={`${styles.formGroup} ${styles.formGroupFull}`}>
                <label className={styles.formLabel}>Payment Terms</label>
                <input
                  type="text"
                  className={styles.formInput}
                  value={formData.payment_terms}
                  onChange={(e) => setFormData({...formData, payment_terms: e.target.value})}
                  placeholder="e.g., Net 30"
                />
              </div>
              <div className={`${styles.formGroup} ${styles.formGroupFull}`}>
                <label className={styles.formLabel}>Notes</label>
                <textarea
                  className={styles.formTextarea}
                  value={formData.notes}
                  onChange={(e) => setFormData({...formData, notes: e.target.value})}
                  rows={3}
                />
              </div>
              {supplier && (
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
              {submitting ? 'Saving...' : (supplier ? 'Update' : 'Create')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
