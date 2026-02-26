'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  listAlerts,
  acknowledgeAlert,
  resolveAlert,
  StockAlert
} from '@/lib/inventoryApi';
import styles from '@/styles/Inventory.module.css';
import InventoryLayout from '@/components/InventoryLayout';

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<StockAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [resolvedFilter, setResolvedFilter] = useState<string>('false');
  const [alertTypeFilter, setAlertTypeFilter] = useState('');

  useEffect(() => {
    loadAlerts();
  }, [resolvedFilter, alertTypeFilter]);

  const loadAlerts = async () => {
    try {
      setLoading(true);
      const isResolved = resolvedFilter === '' ? undefined : resolvedFilter === 'true';
      const data = await listAlerts({
        is_resolved: isResolved,
        alert_type: alertTypeFilter || undefined,
        limit: 100
      });
      setAlerts(data.alerts || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load alerts');
    } finally {
      setLoading(false);
    }
  };

  const handleAcknowledge = async (alertId: number) => {
    try {
      await acknowledgeAlert(alertId, 'Admin');
      setSuccess('Alert acknowledged');
      loadAlerts();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to acknowledge alert');
    }
  };

  const handleResolve = async (alertId: number) => {
    try {
      await resolveAlert(alertId, 'Admin');
      setSuccess('Alert resolved');
      loadAlerts();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to resolve alert');
    }
  };

  const getAlertIcon = (type: string) => {
    switch (type) {
      case 'low_stock': return 'trending_down';
      case 'out_of_stock': return 'remove_shopping_cart';
      case 'overstock': return 'inventory_2';
      case 'expiring_soon': return 'schedule';
      default: return 'warning';
    }
  };

  const getAlertColor = (type: string) => {
    switch (type) {
      case 'low_stock': return styles.statusWarning;
      case 'out_of_stock': return styles.statusDanger;
      case 'overstock': return styles.statusInfo;
      case 'expiring_soon': return styles.statusWarning;
      default: return '';
    }
  };

  const getAlertBgColor = (type: string) => {
    switch (type) {
      case 'low_stock': return 'rgba(245, 158, 11, 0.1)';
      case 'out_of_stock': return 'rgba(239, 68, 68, 0.1)';
      case 'overstock': return 'rgba(59, 130, 246, 0.1)';
      case 'expiring_soon': return 'rgba(245, 158, 11, 0.1)';
      default: return 'rgba(100, 116, 139, 0.1)';
    }
  };

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  };

  // Count active alerts by type
  const activeAlerts = alerts.filter(a => !a.is_resolved);
  const alertCounts = {
    low_stock: activeAlerts.filter(a => a.alert_type === 'low_stock').length,
    out_of_stock: activeAlerts.filter(a => a.alert_type === 'out_of_stock').length,
    overstock: activeAlerts.filter(a => a.alert_type === 'overstock').length,
    expiring_soon: activeAlerts.filter(a => a.alert_type === 'expiring_soon').length
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
            <span className="material-symbols-outlined">notifications_active</span>
            Stock Alerts
          </h1>
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

      {/* Summary Cards */}
      {resolvedFilter === 'false' && (
        <div className={styles.statsGrid}>
          <div className={styles.statCard} style={{ borderColor: '#f59e0b' }}>
            <div className={styles.statIcon} style={{ background: 'rgba(245, 158, 11, 0.2)', color: '#f59e0b' }}>
              <span className="material-symbols-outlined">trending_down</span>
            </div>
            <div className={styles.statContent}>
              <span className={styles.statValue}>{alertCounts.low_stock}</span>
              <span className={styles.statLabel}>Low Stock</span>
            </div>
          </div>
          <div className={styles.statCard} style={{ borderColor: '#ef4444' }}>
            <div className={styles.statIcon} style={{ background: 'rgba(239, 68, 68, 0.2)', color: '#ef4444' }}>
              <span className="material-symbols-outlined">remove_shopping_cart</span>
            </div>
            <div className={styles.statContent}>
              <span className={styles.statValue}>{alertCounts.out_of_stock}</span>
              <span className={styles.statLabel}>Out of Stock</span>
            </div>
          </div>
          <div className={styles.statCard} style={{ borderColor: '#3b82f6' }}>
            <div className={styles.statIcon} style={{ background: 'rgba(59, 130, 246, 0.2)', color: '#3b82f6' }}>
              <span className="material-symbols-outlined">inventory_2</span>
            </div>
            <div className={styles.statContent}>
              <span className={styles.statValue}>{alertCounts.overstock}</span>
              <span className={styles.statLabel}>Overstock</span>
            </div>
          </div>
          <div className={styles.statCard} style={{ borderColor: '#f59e0b' }}>
            <div className={styles.statIcon} style={{ background: 'rgba(245, 158, 11, 0.2)', color: '#f59e0b' }}>
              <span className="material-symbols-outlined">schedule</span>
            </div>
            <div className={styles.statContent}>
              <span className={styles.statValue}>{alertCounts.expiring_soon}</span>
              <span className={styles.statLabel}>Expiring Soon</span>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className={styles.filters}>
        <div className={styles.filterGroup}>
          <label className={styles.filterLabel}>Status</label>
          <select
            className={styles.filterSelect}
            value={resolvedFilter}
            onChange={(e) => setResolvedFilter(e.target.value)}
          >
            <option value="false">Active</option>
            <option value="true">Resolved</option>
            <option value="">All</option>
          </select>
        </div>
        <div className={styles.filterGroup}>
          <label className={styles.filterLabel}>Alert Type</label>
          <select
            className={styles.filterSelect}
            value={alertTypeFilter}
            onChange={(e) => setAlertTypeFilter(e.target.value)}
          >
            <option value="">All Types</option>
            <option value="low_stock">Low Stock</option>
            <option value="out_of_stock">Out of Stock</option>
            <option value="overstock">Overstock</option>
            <option value="expiring_soon">Expiring Soon</option>
          </select>
        </div>
      </div>

      {/* Alerts List */}
      {loading ? (
        <div className={styles.loading}>
          <span className="material-symbols-outlined">sync</span>
          Loading alerts...
        </div>
      ) : alerts.length === 0 ? (
        <div className={styles.emptyState} style={{ padding: '4rem', background: '#1e293b', borderRadius: '0.75rem' }}>
          <span className="material-symbols-outlined">check_circle</span>
          <p>{resolvedFilter === 'false' ? 'No active alerts - all clear!' : 'No alerts found'}</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {alerts.map(alert => (
            <div
              key={alert.id}
              style={{
                background: getAlertBgColor(alert.alert_type),
                border: `1px solid ${alert.is_resolved ? 'rgba(100, 116, 139, 0.3)' : 'rgba(255, 255, 255, 0.1)'}`,
                borderRadius: '0.75rem',
                padding: '1rem 1.5rem',
                display: 'flex',
                alignItems: 'center',
                gap: '1rem',
                opacity: alert.is_resolved ? 0.6 : 1
              }}
            >
              {/* Icon */}
              <div
                style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: alert.is_resolved ? 'rgba(100, 116, 139, 0.2)' : getAlertBgColor(alert.alert_type),
                  flexShrink: 0
                }}
              >
                <span
                  className="material-symbols-outlined"
                  style={{
                    fontSize: '24px',
                    color: alert.is_resolved ? '#64748b' : (
                      alert.alert_type === 'out_of_stock' ? '#ef4444' :
                      alert.alert_type === 'overstock' ? '#3b82f6' : '#f59e0b'
                    )
                  }}
                >
                  {alert.is_resolved ? 'check_circle' : getAlertIcon(alert.alert_type)}
                </span>
              </div>

              {/* Content */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                  <span className={`${styles.statusBadge} ${getAlertColor(alert.alert_type)}`}>
                    {alert.alert_type.replace('_', ' ')}
                  </span>
                  {alert.is_acknowledged && !alert.is_resolved && (
                    <span className={`${styles.statusBadge} ${styles.statusInfo}`}>
                      Acknowledged
                    </span>
                  )}
                  {alert.is_resolved && (
                    <span className={`${styles.statusBadge} ${styles.statusSuccess}`}>
                      Resolved
                    </span>
                  )}
                </div>
                <p style={{ margin: 0, color: '#f8fafc', fontWeight: 500 }}>
                  {alert.message}
                </p>
                <p style={{ margin: '0.25rem 0 0', color: '#94a3b8', fontSize: '0.875rem' }}>
                  Created: {formatDate(alert.created_at)}
                  {alert.resolved_at && ` • Resolved: ${formatDate(alert.resolved_at)}`}
                </p>
              </div>

              {/* Actions */}
              {!alert.is_resolved && (
                <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
                  {!alert.is_acknowledged && (
                    <button
                      className={styles.secondaryBtn}
                      onClick={() => handleAcknowledge(alert.id)}
                      title="Acknowledge"
                    >
                      <span className="material-symbols-outlined">visibility</span>
                      Acknowledge
                    </button>
                  )}
                  <button
                    className={styles.primaryBtn}
                    onClick={() => handleResolve(alert.id)}
                    title="Resolve"
                  >
                    <span className="material-symbols-outlined">check</span>
                    Resolve
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
    </InventoryLayout>
  );
}
