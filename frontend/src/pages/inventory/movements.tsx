'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  listMovements,
  listWarehouses,
  StockMovement,
  Warehouse
} from '@/lib/inventoryApi';
import styles from '../../styles/Inventory.module.css';
import InventoryLayout from '@/components/InventoryLayout';

export default function MovementsPage() {
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filters
  const [selectedWarehouse, setSelectedWarehouse] = useState<number | undefined>();
  const [selectedType, setSelectedType] = useState<string>('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Pagination
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const limit = 25;

  const movementTypes = [
    { value: 'stock_in', label: 'Stock In', color: '#10b981' },
    { value: 'stock_out', label: 'Stock Out', color: '#ef4444' },
    { value: 'adjustment', label: 'Adjustment', color: '#8b5cf6' },
    { value: 'transfer', label: 'Transfer', color: '#3b82f6' },
    { value: 'return_in', label: 'Return In', color: '#10b981' },
    { value: 'return_out', label: 'Return Out', color: '#f59e0b' },
    { value: 'damage', label: 'Damage', color: '#ef4444' },
    { value: 'loss', label: 'Loss', color: '#ef4444' }
  ];

  useEffect(() => {
    loadWarehouses();
  }, []);

  useEffect(() => {
    loadMovements();
  }, [selectedWarehouse, selectedType, dateFrom, dateTo, page]);

  const loadWarehouses = async () => {
    try {
      const data = await listWarehouses(true);
      setWarehouses(data.warehouses || []);
    } catch (err) {
      console.error('Failed to load warehouses:', err);
    }
  };

  const loadMovements = async () => {
    try {
      setLoading(true);
      const data = await listMovements({
        warehouse_id: selectedWarehouse,
        movement_type: selectedType || undefined,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
        skip: page * limit,
        limit
      });
      setMovements(data.movements || []);
      setTotalCount(data.count || 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load movements');
    } finally {
      setLoading(false);
    }
  };

  const getMovementTypeInfo = (type: string) => {
    return movementTypes.find(t => t.value === type) || { label: type, color: '#64748b' };
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatCurrency = (value: number | null | undefined) => {
    if (value == null) return '-';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(value);
  };

  const getQuantityDisplay = (movement: StockMovement) => {
    const isPositive = ['stock_in', 'return_in'].includes(movement.movement_type);
    const color = isPositive ? '#10b981' : '#ef4444';
    const prefix = isPositive ? '+' : '';
    return (
      <span style={{ color, fontWeight: 600 }}>
        {prefix}{movement.quantity}
      </span>
    );
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
            <span className="material-symbols-outlined">swap_horiz</span>
            Stock Movements
          </h1>
        </div>
        <div className={styles.pageActions}>
          <Link href="/inventory/stock" className={styles.primaryBtn}>
            <span className="material-symbols-outlined">add</span>
            New Movement
          </Link>
        </div>
      </div>

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
            onChange={(e) => { setSelectedWarehouse(e.target.value ? Number(e.target.value) : undefined); setPage(0); }}
          >
            <option value="">All Warehouses</option>
            {warehouses.map(w => (
              <option key={w.id} value={w.id}>{w.name}</option>
            ))}
          </select>
        </div>
        <div className={styles.filterGroup}>
          <label className={styles.filterLabel}>Movement Type</label>
          <select
            className={styles.filterSelect}
            value={selectedType}
            onChange={(e) => { setSelectedType(e.target.value); setPage(0); }}
          >
            <option value="">All Types</option>
            {movementTypes.map(t => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>
        <div className={styles.filterGroup}>
          <label className={styles.filterLabel}>From Date</label>
          <input
            type="date"
            className={styles.filterInput}
            value={dateFrom}
            onChange={(e) => { setDateFrom(e.target.value); setPage(0); }}
          />
        </div>
        <div className={styles.filterGroup}>
          <label className={styles.filterLabel}>To Date</label>
          <input
            type="date"
            className={styles.filterInput}
            value={dateTo}
            onChange={(e) => { setDateTo(e.target.value); setPage(0); }}
          />
        </div>
      </div>

      {/* Movements Table */}
      {loading ? (
        <div className={styles.loading}>
          <span className="material-symbols-outlined">sync</span>
          Loading movements...
        </div>
      ) : movements.length === 0 ? (
        <div className={styles.emptyState} style={{ padding: '4rem', background: '#1e293b', borderRadius: '0.75rem' }}>
          <span className="material-symbols-outlined">swap_horiz</span>
          <p>No stock movements found</p>
        </div>
      ) : (
        <>
          <table className={styles.dataTable}>
            <thead>
              <tr>
                <th>Reference</th>
                <th>Date</th>
                <th>Type</th>
                <th>Product</th>
                <th>Warehouse</th>
                <th>Qty Change</th>
                <th>Before → After</th>
                <th>Cost</th>
                <th>By</th>
              </tr>
            </thead>
            <tbody>
              {movements.map(movement => {
                const typeInfo = getMovementTypeInfo(movement.movement_type);
                return (
                  <tr key={movement.id}>
                    <td>
                      <span style={{ fontFamily: 'monospace', fontSize: '0.8rem', color: '#94a3b8' }}>
                        {movement.reference_number}
                      </span>
                    </td>
                    <td style={{ fontSize: '0.85rem', color: '#94a3b8' }}>
                      {formatDate(movement.movement_date)}
                    </td>
                    <td>
                      <span
                        className={styles.statusBadge}
                        style={{ 
                          background: `${typeInfo.color}20`, 
                          color: typeInfo.color,
                          textTransform: 'capitalize'
                        }}
                      >
                        {typeInfo.label}
                      </span>
                    </td>
                    <td>
                      <div className={styles.productName}>
                        {movement.product?.product_name || movement.product?.filename || 'N/A'}
                      </div>
                      <span className={styles.quantitySub}>{movement.product?.sku || ''}</span>
                    </td>
                    <td>{movement.warehouse?.name || 'N/A'}</td>
                    <td>{getQuantityDisplay(movement)}</td>
                    <td>
                      <span style={{ color: '#64748b' }}>
                        {movement.quantity_before} → {movement.quantity_after}
                      </span>
                    </td>
                    <td>{formatCurrency(movement.total_cost)}</td>
                    <td style={{ fontSize: '0.85rem', color: '#94a3b8' }}>
                      {movement.performed_by || '-'}
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
      </div>
    </InventoryLayout>
  );
}
