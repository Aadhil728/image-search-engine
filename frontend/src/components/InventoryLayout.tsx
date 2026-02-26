'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import styles from '@/styles/InventoryLayout.module.css';

interface InventoryLayoutProps {
  children: React.ReactNode;
}

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

export default function InventoryLayout({ children }: InventoryLayoutProps) {
  const router = useRouter();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <div className={styles.pageWrapper}>
      {/* Sidebar */}
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

      {/* Main Content */}
      <main className={`${styles.mainContent} ${sidebarCollapsed ? styles.expanded : ''}`}>
        {children}
      </main>
    </div>
  );
}
