'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  getStockLevelsReport,
  getLowStockReport,
  getMovementHistoryReport,
  getStockValuationReport,
  listWarehouses,
  Warehouse
} from '@/lib/inventoryApi';
import styles from '@/styles/Inventory.module.css';
import InventoryLayout from '@/components/InventoryLayout';

type ReportType = 'stock-levels' | 'low-stock' | 'movements' | 'valuation';

export default function ReportsPage() {
  const [activeReport, setActiveReport] = useState<ReportType>('stock-levels');
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [selectedWarehouse, setSelectedWarehouse] = useState<number | undefined>();
  const [reportData, setReportData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Movement report filters
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [movementType, setMovementType] = useState('');

  useEffect(() => {
    loadWarehouses();
  }, []);

  useEffect(() => {
    loadReport();
  }, [activeReport, selectedWarehouse]);

  const loadWarehouses = async () => {
    try {
      const data = await listWarehouses(true);
      setWarehouses(data.warehouses || []);
    } catch (err) {
      console.error('Failed to load warehouses:', err);
    }
  };

  const loadReport = async () => {
    try {
      setLoading(true);
      setError('');
      let data;

      switch (activeReport) {
        case 'stock-levels':
          data = await getStockLevelsReport(selectedWarehouse);
          break;
        case 'low-stock':
          data = await getLowStockReport(selectedWarehouse);
          break;
        case 'movements':
          data = await getMovementHistoryReport({
            warehouse_id: selectedWarehouse,
            date_from: dateFrom || undefined,
            date_to: dateTo || undefined,
            movement_type: movementType || undefined
          });
          break;
        case 'valuation':
          data = await getStockValuationReport(selectedWarehouse);
          break;
      }

      setReportData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load report');
    } finally {
      setLoading(false);
    }
  };

  const reports = [
    { id: 'stock-levels' as ReportType, label: 'Stock Levels', icon: 'inventory' },
    { id: 'low-stock' as ReportType, label: 'Low Stock', icon: 'warning' },
    { id: 'movements' as ReportType, label: 'Movement History', icon: 'swap_horiz' },
    { id: 'valuation' as ReportType, label: 'Stock Valuation', icon: 'payments' }
  ];

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(value);
  };

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat('en-US').format(value);
  };

  const exportToCSV = () => {
    if (!reportData?.data?.length) return;

    const headers = Object.keys(reportData.data[0]).join(',');
    const rows = reportData.data.map((row: any) => 
      Object.values(row).map(v => typeof v === 'string' && v.includes(',') ? `"${v}"` : v).join(',')
    ).join('\n');

    const csv = `${headers}\n${rows}`;
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeReport}-report-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
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
            <span className="material-symbols-outlined">analytics</span>
            Inventory Reports
          </h1>
        </div>
        <div className={styles.pageActions}>
          {reportData?.data?.length > 0 && (
            <button className={styles.secondaryBtn} onClick={exportToCSV}>
              <span className="material-symbols-outlined">download</span>
              Export CSV
            </button>
          )}
        </div>
      </div>

      {/* Report Tabs */}
      <div className={styles.filters} style={{ gap: '0.5rem', marginBottom: '1.5rem' }}>
        {reports.map(report => (
          <button
            key={report.id}
            className={activeReport === report.id ? styles.primaryBtn : styles.secondaryBtn}
            onClick={() => setActiveReport(report.id)}
            style={{ flex: 'initial' }}
          >
            <span className="material-symbols-outlined">{report.icon}</span>
            {report.label}
          </button>
        ))}
      </div>

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

        {activeReport === 'movements' && (
          <>
            <div className={styles.filterGroup}>
              <label className={styles.filterLabel}>From Date</label>
              <input
                type="date"
                className={styles.filterInput}
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>
            <div className={styles.filterGroup}>
              <label className={styles.filterLabel}>To Date</label>
              <input
                type="date"
                className={styles.filterInput}
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>
            <div className={styles.filterGroup}>
              <label className={styles.filterLabel}>Movement Type</label>
              <select
                className={styles.filterSelect}
                value={movementType}
                onChange={(e) => setMovementType(e.target.value)}
              >
                <option value="">All Types</option>
                <option value="stock_in">Stock In</option>
                <option value="stock_out">Stock Out</option>
                <option value="adjustment">Adjustment</option>
                <option value="transfer">Transfer</option>
              </select>
            </div>
            <button
              className={styles.primaryBtn}
              onClick={loadReport}
              style={{ alignSelf: 'flex-end' }}
            >
              <span className="material-symbols-outlined">refresh</span>
              Update
            </button>
          </>
        )}
      </div>

      {error && (
        <div className={styles.errorMessage}>
          <span className="material-symbols-outlined">error</span>
          {error}
        </div>
      )}

      {loading ? (
        <div className={styles.loading}>
          <span className="material-symbols-outlined">sync</span>
          Loading report...
        </div>
      ) : reportData ? (
        <>
          {/* Report Summary */}
          <div className={styles.movementSummary} style={{ marginBottom: '1.5rem' }}>
            <div className={styles.movementStats}>
              <div className={styles.movementStat}>
                <span className={styles.movementIcon} style={{ color: '#3b82f6' }}>
                  <span className="material-symbols-outlined">description</span>
                </span>
                <div>
                  <span className={styles.movementLabel}>Total Items</span>
                  <span className={styles.movementValue}>{formatNumber(reportData.total_items || reportData.total_movements || 0)}</span>
                </div>
              </div>
              {reportData.total_value !== undefined && (
                <div className={styles.movementStat}>
                  <span className={styles.movementIcon} style={{ color: '#10b981' }}>
                    <span className="material-symbols-outlined">payments</span>
                  </span>
                  <div>
                    <span className={styles.movementLabel}>Total Value</span>
                    <span className={styles.movementValue}>{formatCurrency(reportData.total_value)}</span>
                  </div>
                </div>
              )}
              {reportData.urgent_items !== undefined && (
                <div className={styles.movementStat}>
                  <span className={styles.movementIcon} style={{ color: '#ef4444' }}>
                    <span className="material-symbols-outlined">error</span>
                  </span>
                  <div>
                    <span className={styles.movementLabel}>Urgent (Out of Stock)</span>
                    <span className={styles.movementValue}>{reportData.urgent_items}</span>
                  </div>
                </div>
              )}
              <div className={styles.movementStat}>
                <span className={styles.movementIcon} style={{ color: '#8b5cf6' }}>
                  <span className="material-symbols-outlined">schedule</span>
                </span>
                <div>
                  <span className={styles.movementLabel}>Generated</span>
                  <span className={styles.movementValue} style={{ fontSize: '0.9rem' }}>
                    {new Date(reportData.generated_at).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Report Data Table */}
          {reportData.data?.length > 0 ? (
            <div style={{ overflowX: 'auto' }}>
              {activeReport === 'stock-levels' && <StockLevelsTable data={reportData.data} />}
              {activeReport === 'low-stock' && <LowStockTable data={reportData.data} />}
              {activeReport === 'movements' && <MovementHistoryTable data={reportData.data} summary={reportData.summary_by_type} />}
              {activeReport === 'valuation' && <ValuationTable data={reportData.data} />}
            </div>
          ) : (
            <div className={styles.emptyState} style={{ padding: '4rem', background: '#1e293b', borderRadius: '0.75rem' }}>
              <span className="material-symbols-outlined">description</span>
              <p>No data available for this report</p>
            </div>
          )}
        </>
      ) : null}
    </div>
    </InventoryLayout>
  );
}

function StockLevelsTable({ data }: { data: any[] }) {
  return (
    <table className={styles.dataTable}>
      <thead>
        <tr>
          <th>Product</th>
          <th>SKU</th>
          <th>Warehouse</th>
          <th>Category</th>
          <th>On Hand</th>
          <th>Reserved</th>
          <th>Available</th>
          <th>Reorder Point</th>
          <th>Status</th>
          <th>Value</th>
        </tr>
      </thead>
      <tbody>
        {data.map((row, i) => (
          <tr key={i}>
            <td><span className={styles.productName}>{row.product_name || 'N/A'}</span></td>
            <td style={{ fontFamily: 'monospace', fontSize: '0.85rem', color: '#94a3b8' }}>{row.sku || '-'}</td>
            <td>{row.warehouse || '-'}</td>
            <td>{row.category || '-'}</td>
            <td style={{ fontWeight: 600 }}>{row.quantity_on_hand}</td>
            <td>{row.quantity_reserved}</td>
            <td>{row.quantity_available}</td>
            <td>{row.reorder_point}</td>
            <td>
              <span className={`${styles.statusBadge} ${
                row.status === 'Out of Stock' ? styles.statusDanger :
                row.status === 'Low Stock' ? styles.statusWarning :
                styles.statusSuccess
              }`}>
                {row.status}
              </span>
            </td>
            <td>${row.value.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function LowStockTable({ data }: { data: any[] }) {
  return (
    <table className={styles.dataTable}>
      <thead>
        <tr>
          <th>Product</th>
          <th>SKU</th>
          <th>Warehouse</th>
          <th>Supplier</th>
          <th>On Hand</th>
          <th>Reorder Point</th>
          <th>Shortage</th>
          <th>Reorder Qty</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        {data.map((row, i) => (
          <tr key={i}>
            <td><span className={styles.productName}>{row.product_name || 'N/A'}</span></td>
            <td style={{ fontFamily: 'monospace', fontSize: '0.85rem', color: '#94a3b8' }}>{row.sku || '-'}</td>
            <td>{row.warehouse || '-'}</td>
            <td>{row.supplier || '-'}</td>
            <td style={{ fontWeight: 600, color: row.quantity_on_hand === 0 ? '#ef4444' : '#f59e0b' }}>
              {row.quantity_on_hand}
            </td>
            <td>{row.reorder_point}</td>
            <td style={{ color: '#ef4444', fontWeight: 600 }}>{row.shortage}</td>
            <td>{row.reorder_quantity}</td>
            <td>
              <span className={`${styles.statusBadge} ${
                row.status === 'Out of Stock' ? styles.statusDanger : styles.statusWarning
              }`}>
                {row.status}
              </span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function MovementHistoryTable({ data, summary }: { data: any[], summary: any }) {
  return (
    <>
      {summary && Object.keys(summary).length > 0 && (
        <div style={{ marginBottom: '1.5rem', display: 'flex', flexWrap: 'wrap', gap: '1rem' }}>
          {Object.entries(summary).map(([type, stats]: [string, any]) => (
            <div key={type} style={{ 
              padding: '1rem', 
              background: '#1e293b', 
              borderRadius: '0.5rem',
              border: '1px solid #334155',
              minWidth: '150px'
            }}>
              <div style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', marginBottom: '0.25rem' }}>
                {type.replace('_', ' ')}
              </div>
              <div style={{ fontSize: '1.25rem', fontWeight: 600, color: '#f8fafc' }}>{stats.count} txns</div>
              <div style={{ fontSize: '0.85rem', color: '#94a3b8' }}>
                {stats.total_quantity} units • ${stats.total_value.toLocaleString()}
              </div>
            </div>
          ))}
        </div>
      )}
      <table className={styles.dataTable}>
        <thead>
          <tr>
            <th>Reference</th>
            <th>Date</th>
            <th>Type</th>
            <th>Product</th>
            <th>SKU</th>
            <th>Warehouse</th>
            <th>Quantity</th>
            <th>Unit Cost</th>
            <th>Total Cost</th>
            <th>By</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr key={i}>
              <td style={{ fontFamily: 'monospace', fontSize: '0.8rem', color: '#94a3b8' }}>{row.reference_number}</td>
              <td style={{ fontSize: '0.85rem' }}>{row.movement_date ? new Date(row.movement_date).toLocaleDateString() : '-'}</td>
              <td>
                <span className={styles.statusBadge} style={{
                  background: ['stock_in', 'return_in'].includes(row.movement_type) ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                  color: ['stock_in', 'return_in'].includes(row.movement_type) ? '#10b981' : '#ef4444',
                  textTransform: 'capitalize'
                }}>
                  {row.movement_type.replace('_', ' ')}
                </span>
              </td>
              <td><span className={styles.productName}>{row.product_name || 'N/A'}</span></td>
              <td style={{ fontFamily: 'monospace', fontSize: '0.85rem', color: '#94a3b8' }}>{row.sku || '-'}</td>
              <td>{row.warehouse || '-'}</td>
              <td style={{ 
                fontWeight: 600, 
                color: ['stock_in', 'return_in'].includes(row.movement_type) ? '#10b981' : '#ef4444'
              }}>
                {['stock_in', 'return_in'].includes(row.movement_type) ? '+' : ''}{row.quantity}
              </td>
              <td>${row.unit_cost.toFixed(2)}</td>
              <td>${row.total_cost.toFixed(2)}</td>
              <td style={{ fontSize: '0.85rem', color: '#94a3b8' }}>{row.performed_by || '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

function ValuationTable({ data }: { data: any[] }) {
  return (
    <table className={styles.dataTable}>
      <thead>
        <tr>
          <th>Product</th>
          <th>SKU</th>
          <th>Warehouse</th>
          <th>Category</th>
          <th>Quantity</th>
          <th>Avg Cost</th>
          <th>Total Value</th>
          <th>% of Total</th>
        </tr>
      </thead>
      <tbody>
        {data.map((row, i) => {
          const totalValue = data.reduce((sum, r) => sum + r.total_value, 0);
          const percentage = ((row.total_value / totalValue) * 100).toFixed(1);
          return (
            <tr key={i}>
              <td><span className={styles.productName}>{row.product_name || 'N/A'}</span></td>
              <td style={{ fontFamily: 'monospace', fontSize: '0.85rem', color: '#94a3b8' }}>{row.sku || '-'}</td>
              <td>{row.warehouse || '-'}</td>
              <td>{row.category || '-'}</td>
              <td style={{ fontWeight: 600 }}>{row.quantity}</td>
              <td>${row.average_cost.toFixed(2)}</td>
              <td style={{ fontWeight: 600, color: '#10b981' }}>${row.total_value.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
              <td>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <div style={{ 
                    width: '60px', 
                    height: '6px', 
                    background: '#334155', 
                    borderRadius: '3px',
                    overflow: 'hidden'
                  }}>
                    <div style={{ 
                      width: `${percentage}%`, 
                      height: '100%', 
                      background: '#3b82f6',
                      borderRadius: '3px'
                    }} />
                  </div>
                  <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>{percentage}%</span>
                </div>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
