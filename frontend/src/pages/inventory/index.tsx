'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { 
  getDashboardSummary, 
  listAlerts, 
  listWarehouses,
  getMovementTrends,
  getStockByCategory,
  getStockByWarehouse,
  getTopProducts,
  getInventoryHealth,
  getAlertsSummary,
  DashboardSummary,
  StockAlert,
  Warehouse,
  MovementTrendData,
  CategoryStockData,
  WarehouseStockData,
  TopProductData,
  InventoryHealthData,
  AlertsSummary
} from '@/lib/inventoryApi';
import styles from '@/styles/InventoryDashboard.module.css';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16'];

const navItems = [
  { href: '/inventory', icon: 'dashboard', label: 'Dashboard' },
  { href: '/inventory/stock', icon: 'inventory_2', label: 'View Stock' },
  { href: '/inventory/movements', icon: 'swap_horiz', label: 'Stock Movements' },
  { href: '/inventory/purchase-orders', icon: 'shopping_cart', label: 'Purchase Orders' },
  { href: '/inventory/suppliers', icon: 'local_shipping', label: 'Suppliers' },
  { href: '/inventory/warehouses', icon: 'warehouse', label: 'Warehouses' },
  { href: '/inventory/alerts', icon: 'notifications', label: 'Alerts' },
  { href: '/inventory/reports', icon: 'assessment', label: 'Reports' },
];

export default function InventoryDashboard() {
  const router = useRouter();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [alerts, setAlerts] = useState<StockAlert[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [selectedWarehouse, setSelectedWarehouse] = useState<number | undefined>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  
  // Chart data states
  const [movementTrends, setMovementTrends] = useState<MovementTrendData[]>([]);
  const [categoryData, setCategoryData] = useState<CategoryStockData[]>([]);
  const [warehouseData, setWarehouseData] = useState<WarehouseStockData[]>([]);
  const [topProducts, setTopProducts] = useState<TopProductData[]>([]);
  const [healthData, setHealthData] = useState<InventoryHealthData | null>(null);
  const [alertsSummary, setAlertsSummary] = useState<AlertsSummary | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    loadDashboardData();
  }, [selectedWarehouse]);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const [
        summaryData, 
        alertsData, 
        warehousesData, 
        trendsData,
        categoryResult,
        warehouseResult,
        topProductsResult,
        healthResult,
        alertsSummaryResult
      ] = await Promise.all([
        getDashboardSummary(selectedWarehouse),
        listAlerts({ is_resolved: false, limit: 5 }),
        listWarehouses(true),
        getMovementTrends(30, selectedWarehouse),
        getStockByCategory(selectedWarehouse),
        getStockByWarehouse(),
        getTopProducts(8, 'value', selectedWarehouse),
        getInventoryHealth(selectedWarehouse),
        getAlertsSummary()
      ]);
      
      setSummary(summaryData);
      setAlerts(alertsData.alerts || []);
      setWarehouses(warehousesData.warehouses || []);
      setMovementTrends(trendsData.data || []);
      setCategoryData(categoryResult.data || []);
      setWarehouseData(warehouseResult.data || []);
      setTopProducts(topProductsResult.data || []);
      setHealthData(healthResult);
      setAlertsSummary(alertsSummaryResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `$${(value / 1000).toFixed(1)}K`;
    return `$${value.toFixed(0)}`;
  };

  const formatNumber = (value: number) => {
    if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
    return value.toLocaleString();
  };

  const getCurrentTime = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 18) return 'Good Afternoon';
    return 'Good Evening';
  };

  // Sidebar component
  const Sidebar = () => (
    <aside className={`${styles.sidebar} ${sidebarCollapsed ? styles.collapsed : ''}`}>
      <div className={styles.sidebarHeader}>
        <div className={styles.logo}>
          <span className="material-symbols-outlined">inventory</span>
          {!sidebarCollapsed && <span>Inventory</span>}
        </div>
        <button 
          className={styles.collapseBtn}
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
        >
          <span className="material-symbols-outlined">
            {sidebarCollapsed ? 'chevron_right' : 'chevron_left'}
          </span>
        </button>
      </div>
      
      <nav className={styles.sidebarNav}>
        {navItems.map((item) => (
          <Link 
            key={item.href}
            href={item.href}
            className={`${styles.sidebarItem} ${router.pathname === item.href ? styles.active : ''}`}
          >
            <span className="material-symbols-outlined">{item.icon}</span>
            {!sidebarCollapsed && <span>{item.label}</span>}
          </Link>
        ))}
      </nav>

      <div className={styles.sidebarFooter}>
        <Link href="/" className={styles.sidebarItem}>
          <span className="material-symbols-outlined">arrow_back</span>
          {!sidebarCollapsed && <span>Back to Home</span>}
        </Link>
      </div>
    </aside>
  );

  if (loading) {
    return (
      <div className={styles.pageWrapper}>
        <Sidebar />
        <main className={styles.mainContent}>
          <div className={styles.loadingScreen}>
            <div className={styles.loadingSpinner}></div>
            <p>Loading dashboard...</p>
          </div>
        </main>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.pageWrapper}>
        <Sidebar />
        <main className={styles.mainContent}>
          <div className={styles.errorScreen}>
            <span className="material-symbols-outlined">error</span>
            <p>{error}</p>
            <button onClick={loadDashboardData} className={styles.retryBtn}>Retry</button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className={styles.pageWrapper}>
      <Sidebar />

      {/* Main Content */}
      <main className={styles.mainContent}>
        {/* Header */}
        <header className={styles.header}>
          <div className={styles.headerLeft}>
            <h1 className={styles.greeting}>{getCurrentTime()}, Admin</h1>
            <p className={styles.subtitle}>Here&apos;s what&apos;s happening with your inventory today.</p>
          </div>
          <div className={styles.headerRight}>
            <select
              className={styles.warehouseSelect}
              value={selectedWarehouse || ''}
              onChange={(e) => setSelectedWarehouse(e.target.value ? Number(e.target.value) : undefined)}
            >
              <option value="">All Warehouses</option>
              {warehouses.map(w => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </select>
            <button className={styles.refreshBtn} onClick={loadDashboardData}>
              <span className="material-symbols-outlined">refresh</span>
            </button>
            <Link href="/inventory/reports" className={styles.exportBtn}>
              <span className="material-symbols-outlined">download</span>
              Export
            </Link>
          </div>
        </header>

        {/* Stats Cards */}
        <div className={styles.statsGrid}>
          <div className={styles.statCard}>
            <div className={styles.statHeader}>
              <span className="material-symbols-outlined">inventory_2</span>
              <span className={styles.statLabel}>Total Products</span>
            </div>
            <div className={styles.statValue}>{formatNumber(summary?.total_products || 0)}</div>
            <div className={styles.statChange}>
              <span className={`${styles.changeIndicator} ${styles.neutral}`}>
                <span className="material-symbols-outlined">horizontal_rule</span>
              </span>
              <span>items in system</span>
            </div>
          </div>

          <div className={styles.statCard}>
            <div className={styles.statHeader}>
              <span className="material-symbols-outlined">trending_up</span>
              <span className={styles.statLabel}>Total Value</span>
            </div>
            <div className={styles.statValue}>{formatCurrency(summary?.total_value || 0)}</div>
            <div className={styles.statChange}>
              <span className={`${styles.changeIndicator} ${styles.positive}`}>
                <span className="material-symbols-outlined">arrow_upward</span>
              </span>
              <span>inventory valuation</span>
            </div>
          </div>

          <div className={styles.statCard}>
            <div className={styles.statHeader}>
              <span className="material-symbols-outlined">warning</span>
              <span className={styles.statLabel}>Low Stock</span>
            </div>
            <div className={styles.statValue} style={{ color: '#f59e0b' }}>
              {summary?.low_stock_count || 0}
            </div>
            <div className={styles.statChange}>
              <span className={`${styles.changeIndicator} ${(summary?.low_stock_count || 0) > 0 ? styles.negative : styles.positive}`}>
                <span className="material-symbols-outlined">
                  {(summary?.low_stock_count || 0) > 0 ? 'arrow_downward' : 'check'}
                </span>
              </span>
              <span>items below reorder</span>
            </div>
          </div>

          <div className={styles.statCard}>
            <div className={styles.statHeader}>
              <span className="material-symbols-outlined">notifications</span>
              <span className={styles.statLabel}>Active Alerts</span>
            </div>
            <div className={styles.statValue} style={{ color: '#ef4444' }}>
              {summary?.active_alerts || 0}
            </div>
            <div className={styles.statChange}>
              <span className={`${styles.changeIndicator} ${(summary?.active_alerts || 0) > 0 ? styles.negative : styles.positive}`}>
                <span className="material-symbols-outlined">
                  {(summary?.active_alerts || 0) > 0 ? 'priority_high' : 'check'}
                </span>
              </span>
              <span>requiring attention</span>
            </div>
          </div>
        </div>

        {/* Main Charts Row */}
        <div className={styles.chartsRow}>
          {/* Movement Trends Chart */}
          <div className={styles.chartCard} style={{ flex: 2 }}>
            <div className={styles.chartHeader}>
              <h3>
                <span className="material-symbols-outlined">show_chart</span>
                Stock Movement Trends
              </h3>
              <span className={styles.chartPeriod}>Last 30 Days</span>
            </div>
            <div className={styles.chartBody}>
              {mounted && movementTrends.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <AreaChart data={movementTrends} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorStockIn" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorStockOut" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis 
                      dataKey="date" 
                      stroke="#64748b"
                      tick={{ fill: '#94a3b8', fontSize: 11 }}
                      tickFormatter={(value) => {
                        const date = new Date(value);
                        return `${date.getMonth() + 1}/${date.getDate()}`;
                      }}
                    />
                    <YAxis stroke="#64748b" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: '#1e293b', 
                        border: '1px solid #334155',
                        borderRadius: '8px',
                        color: '#f8fafc'
                      }}
                    />
                    <Area type="monotone" dataKey="stock_in" stackId="1" stroke="#10b981" fill="url(#colorStockIn)" name="Stock In" />
                    <Area type="monotone" dataKey="stock_out" stackId="2" stroke="#ef4444" fill="url(#colorStockOut)" name="Stock Out" />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className={styles.noData}>
                  <span className="material-symbols-outlined">show_chart</span>
                  <p>No movement data available</p>
                </div>
              )}
            </div>
            <div className={styles.chartLegend}>
              <div className={styles.legendItem}>
                <span className={styles.legendDot} style={{ background: '#10b981' }}></span>
                <span>Stock In</span>
                <span className={styles.legendValue}>+{formatNumber(movementTrends.reduce((sum, d) => sum + d.stock_in, 0))}</span>
              </div>
              <div className={styles.legendItem}>
                <span className={styles.legendDot} style={{ background: '#ef4444' }}></span>
                <span>Stock Out</span>
                <span className={styles.legendValue}>-{formatNumber(movementTrends.reduce((sum, d) => sum + d.stock_out, 0))}</span>
              </div>
              <div className={styles.legendItem}>
                <span className={styles.legendDot} style={{ background: '#3b82f6' }}></span>
                <span>Net Change</span>
                <span className={styles.legendValue} style={{ color: '#10b981' }}>
                  +{formatNumber(movementTrends.reduce((sum, d) => sum + d.stock_in - d.stock_out, 0))}
                </span>
              </div>
            </div>
          </div>

          {/* Stock by Category Pie Chart */}
          <div className={styles.chartCard} style={{ flex: 1 }}>
            <div className={styles.chartHeader}>
              <h3>
                <span className="material-symbols-outlined">donut_large</span>
                Stock by Category
              </h3>
            </div>
            <div className={styles.chartBody}>
              {mounted && categoryData.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={categoryData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={2}
                      dataKey="value"
                      nameKey="name"
                    >
                      {categoryData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: '#1e293b', 
                        border: '1px solid #334155',
                        borderRadius: '8px',
                        color: '#f8fafc'
                      }}
                      formatter={(value: number) => formatCurrency(value)}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className={styles.noData}>
                  <span className="material-symbols-outlined">donut_large</span>
                  <p>No category data</p>
                </div>
              )}
            </div>
            <div className={styles.categoryLegend}>
              {categoryData.slice(0, 4).map((cat, i) => (
                <div key={cat.name} className={styles.categoryItem}>
                  <span className={styles.categoryDot} style={{ background: COLORS[i % COLORS.length] }}></span>
                  <span className={styles.categoryName}>{cat.name}</span>
                  <span className={styles.categoryPct}>{cat.percentage}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Second Charts Row */}
        <div className={styles.chartsRow}>
          {/* Stock by Warehouse */}
          <div className={styles.chartCard} style={{ flex: 1 }}>
            <div className={styles.chartHeader}>
              <h3>
                <span className="material-symbols-outlined">warehouse</span>
                Stock by Warehouse
              </h3>
            </div>
            <div className={styles.chartBody}>
              {mounted && warehouseData.length > 0 ? (
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={warehouseData} layout="vertical" margin={{ left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis type="number" stroke="#64748b" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                    <YAxis 
                      dataKey="name" 
                      type="category" 
                      stroke="#64748b" 
                      tick={{ fill: '#94a3b8', fontSize: 11 }}
                      width={100}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: '#1e293b', 
                        border: '1px solid #334155',
                        borderRadius: '8px',
                        color: '#f8fafc'
                      }}
                      formatter={(value: number, name: string) => [formatNumber(value), name === 'value' ? 'Value' : 'Quantity']}
                    />
                    <Bar dataKey="quantity" fill="#3b82f6" radius={[0, 4, 4, 0]} name="Quantity" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className={styles.noData}>
                  <span className="material-symbols-outlined">warehouse</span>
                  <p>No warehouse data</p>
                </div>
              )}
            </div>
          </div>

          {/* Top Products by Value */}
          <div className={styles.chartCard} style={{ flex: 1 }}>
            <div className={styles.chartHeader}>
              <h3>
                <span className="material-symbols-outlined">leaderboard</span>
                Top Products by Value
              </h3>
            </div>
            <div className={styles.chartBody}>
              {mounted && topProducts.length > 0 ? (
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={topProducts} margin={{ left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis 
                      dataKey="name" 
                      stroke="#64748b" 
                      tick={{ fill: '#94a3b8', fontSize: 10 }}
                      interval={0}
                      angle={-45}
                      textAnchor="end"
                      height={60}
                    />
                    <YAxis stroke="#64748b" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: '#1e293b', 
                        border: '1px solid #334155',
                        borderRadius: '8px',
                        color: '#f8fafc'
                      }}
                      formatter={(value: number) => formatCurrency(value)}
                    />
                    <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                      {topProducts.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className={styles.noData}>
                  <span className="material-symbols-outlined">leaderboard</span>
                  <p>No product data</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Health and Alerts Row */}
        <div className={styles.chartsRow}>
          {/* Inventory Health */}
          <div className={styles.chartCard} style={{ flex: 1 }}>
            <div className={styles.chartHeader}>
              <h3>
                <span className="material-symbols-outlined">health_and_safety</span>
                Inventory Health
              </h3>
            </div>
            <div className={styles.healthContent}>
              <div className={styles.healthGauge}>
                <svg viewBox="0 0 100 100" className={styles.gaugeSvg}>
                  <circle cx="50" cy="50" r="40" fill="none" stroke="#334155" strokeWidth="8" />
                  <circle 
                    cx="50" 
                    cy="50" 
                    r="40" 
                    fill="none" 
                    stroke={healthData ? (healthData.health_score >= 80 ? '#10b981' : healthData.health_score >= 60 ? '#f59e0b' : '#ef4444') : '#64748b'}
                    strokeWidth="8"
                    strokeDasharray={`${(healthData?.health_score || 0) * 2.51} 251`}
                    strokeLinecap="round"
                    transform="rotate(-90 50 50)"
                  />
                </svg>
                <div className={styles.gaugeValue}>
                  <span className={styles.gaugeNumber}>{Math.round(healthData?.health_score || 0)}%</span>
                  <span className={styles.gaugeLabel}>Health Score</span>
                </div>
              </div>
              <div className={styles.healthBars}>
                <div className={styles.healthBar}>
                  <div className={styles.healthBarLabel}>
                    <span>In Stock</span>
                    <span>{healthData?.in_stock_pct?.toFixed(0) || 0}%</span>
                  </div>
                  <div className={styles.healthBarTrack}>
                    <div className={styles.healthBarFill} style={{ width: `${healthData?.in_stock_pct || 0}%`, background: '#10b981' }}></div>
                  </div>
                </div>
                <div className={styles.healthBar}>
                  <div className={styles.healthBarLabel}>
                    <span>Low Stock</span>
                    <span>{healthData?.low_stock_pct?.toFixed(0) || 0}%</span>
                  </div>
                  <div className={styles.healthBarTrack}>
                    <div className={styles.healthBarFill} style={{ width: `${healthData?.low_stock_pct || 0}%`, background: '#f59e0b' }}></div>
                  </div>
                </div>
                <div className={styles.healthBar}>
                  <div className={styles.healthBarLabel}>
                    <span>Out of Stock</span>
                    <span>{healthData?.out_of_stock_pct?.toFixed(0) || 0}%</span>
                  </div>
                  <div className={styles.healthBarTrack}>
                    <div className={styles.healthBarFill} style={{ width: `${healthData?.out_of_stock_pct || 0}%`, background: '#ef4444' }}></div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Recent Alerts */}
          <div className={styles.chartCard} style={{ flex: 1 }}>
            <div className={styles.chartHeader}>
              <h3>
                <span className="material-symbols-outlined">notifications_active</span>
                Recent Alerts
              </h3>
              <Link href="/inventory/alerts" className={styles.viewAllLink}>View All</Link>
            </div>
            <div className={styles.alertsList}>
              {alerts.length > 0 ? (
                alerts.slice(0, 5).map((alert) => (
                  <div key={alert.id} className={styles.alertItem}>
                    <span className={`material-symbols-outlined ${styles.alertIcon}`} style={{
                      color: alert.alert_type === 'out_of_stock' ? '#ef4444' : 
                             alert.alert_type === 'low_stock' ? '#f59e0b' : '#3b82f6'
                    }}>
                      {alert.alert_type === 'low_stock' ? 'warning' : 
                       alert.alert_type === 'out_of_stock' ? 'error' : 
                       alert.alert_type === 'overstock' ? 'inventory' : 'schedule'}
                    </span>
                    <div className={styles.alertInfo}>
                      <span className={styles.alertMessage}>{alert.product?.product_name || alert.product?.filename || 'Product'}</span>
                      <span className={styles.alertType}>{alert.alert_type.replace('_', ' ')}</span>
                    </div>
                    <span className={styles.alertQty}>Qty: {alert.current_quantity}</span>
                  </div>
                ))
              ) : (
                <div className={styles.noAlerts}>
                  <span className="material-symbols-outlined">check_circle</span>
                  <p>No active alerts</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
