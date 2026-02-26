'use client';

import { useState, useEffect, useMemo } from 'react';
import Image from 'next/image';
import { listProducts, deleteProduct, updateProduct } from '@/lib/api';
import styles from '@/styles/Dashboard.module.css';

interface Product {
  id: string;
  filename: string;
  s3_url: string;
  sku?: string;
  brand?: string;
  product_name?: string;
  product_date?: string;
  description?: string;
  price?: number;
  created_at?: string;
}

// Convert internal Docker URLs to localhost URLs for browser access
const fixImageUrl = (url: string | undefined): string => {
  if (!url) return '';
  return url.replace('http://minio:9000', 'http://localhost:9000');
};

export default function Dashboard() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string>('');
  
  // Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBrands, setSelectedBrands] = useState<string[]>([]);
  const [priceMin, setPriceMin] = useState<number>(0);
  const [priceMax, setPriceMax] = useState<number>(10000);
  const [sortBy, setSortBy] = useState<string>('newest');
  const [priceRangeActive, setPriceRangeActive] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Load products on mount
  useEffect(() => {
    loadProducts();
  }, []);

  // Get unique brands from products
  const uniqueBrands = useMemo(() => {
    const brands = products
      .map(p => p.brand)
      .filter((brand): brand is string => !!brand);
    return [...new Set(brands)].sort();
  }, [products]);

  // Calculate price range from products
  const priceRange = useMemo(() => {
    const prices = products.map(p => p.price || 0).filter(p => p > 0);
    if (prices.length === 0) return { min: 0, max: 10000 };
    return {
      min: Math.floor(Math.min(...prices)),
      max: Math.ceil(Math.max(...prices))
    };
  }, [products]);

  // Initialize price range when products load
  useEffect(() => {
    if (products.length > 0 && !priceRangeActive) {
      setPriceMin(priceRange.min);
      setPriceMax(priceRange.max);
    }
  }, [priceRange, products.length, priceRangeActive]);

  // Filter and sort products
  const filteredProducts = useMemo(() => {
    let result = [...products];

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(p => 
        (p.product_name?.toLowerCase().includes(query)) ||
        (p.brand?.toLowerCase().includes(query)) ||
        (p.sku?.toLowerCase().includes(query)) ||
        (p.description?.toLowerCase().includes(query))
      );
    }

    // Brand filter
    if (selectedBrands.length > 0) {
      result = result.filter(p => p.brand && selectedBrands.includes(p.brand));
    }

    // Price filter (only apply if user has interacted with slider)
    if (priceRangeActive) {
      result = result.filter(p => (p.price || 0) >= priceMin && (p.price || 0) <= priceMax);
    }

    // Sort
    switch (sortBy) {
      case 'newest':
        result.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
        break;
      case 'oldest':
        result.sort((a, b) => (a.created_at || '').localeCompare(b.created_at || ''));
        break;
      case 'price-low':
        result.sort((a, b) => (a.price || 0) - (b.price || 0));
        break;
      case 'price-high':
        result.sort((a, b) => (b.price || 0) - (a.price || 0));
        break;
      case 'name-asc':
        result.sort((a, b) => (a.product_name || '').localeCompare(b.product_name || ''));
        break;
      case 'name-desc':
        result.sort((a, b) => (b.product_name || '').localeCompare(a.product_name || ''));
        break;
    }

    return result;
  }, [products, searchQuery, selectedBrands, priceMin, priceMax, sortBy]);

  const loadProducts = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await listProducts(0, 500);
      setProducts(response.products || []);
    } catch (err) {
      setError('Failed to load products');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (productId: string) => {
    try {
      await deleteProduct(productId);
      setProducts(products.filter(p => p.id !== productId));
      setDeleteConfirm(null);
      setSuccessMessage('Product deleted successfully');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      setError('Failed to delete product');
      console.error(err);
    }
  };

  const handleEdit = (product: Product) => {
    setEditingProduct({ ...product });
  };

  const handleSave = async () => {
    if (!editingProduct) return;

    try {
      await updateProduct(editingProduct.id, {
        sku: editingProduct.sku,
        brand: editingProduct.brand,
        product_name: editingProduct.product_name,
        product_date: editingProduct.product_date,
        description: editingProduct.description,
        price: editingProduct.price,
      });
      
      setProducts(products.map(p => 
        p.id === editingProduct.id ? editingProduct : p
      ));
      setEditingProduct(null);
      setSuccessMessage('Product updated successfully');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      setError('Failed to update product');
      console.error(err);
    }
  };

  const handleCancel = () => {
    setEditingProduct(null);
  };

  const handleBrandToggle = (brand: string) => {
    setSelectedBrands(prev => 
      prev.includes(brand)
        ? prev.filter(b => b !== brand)
        : [...prev, brand]
    );
  };

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedBrands([]);
    setPriceMin(priceRange.min);
    setPriceMax(priceRange.max);
    setPriceRangeActive(false);
    setSortBy('newest');
  };

  const hasActiveFilters = searchQuery || selectedBrands.length > 0 || priceRangeActive || sortBy !== 'newest';

  return (
    <div className={styles.pageWrapper}>
      {/* Sidebar */}
      <aside className={`${styles.sidebar} ${sidebarCollapsed ? styles.collapsed : ''}`}>
        <div className={styles.sidebarHeader}>
          <h3 className={styles.sidebarTitle}>
            {!sidebarCollapsed && <><span className="material-symbols-outlined">tune</span> Filters</>}
          </h3>
          <button 
            className={styles.collapseBtn}
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          >
            <span className="material-symbols-outlined">{sidebarCollapsed ? 'chevron_right' : 'chevron_left'}</span>
          </button>
        </div>

        {!sidebarCollapsed && (
          <div className={styles.sidebarContent}>
            {/* Search */}
            <div className={styles.filterSection}>
              <label className={styles.filterLabel}><span className="material-symbols-outlined">search</span> Search Products</label>
              <input
                type="text"
                placeholder="Search by name, brand, SKU..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={styles.searchInput}
              />
            </div>

            {/* Sort */}
            <div className={styles.filterSection}>
              <label className={styles.filterLabel}><span className="material-symbols-outlined">sort</span> Sort By</label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className={styles.sortSelect}
              >
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
                <option value="price-low">Price: Low to High</option>
                <option value="price-high">Price: High to Low</option>
                <option value="name-asc">Name: A to Z</option>
                <option value="name-desc">Name: Z to A</option>
              </select>
            </div>

            {/* Brand Filter */}
            <div className={styles.filterSection}>
              <label className={styles.filterLabel}><span className="material-symbols-outlined">sell</span> Brand</label>
              <div className={styles.brandList}>
                {uniqueBrands.length === 0 ? (
                  <p className={styles.noBrands}>No brands available</p>
                ) : (
                  uniqueBrands.map(brand => (
                    <label key={brand} className={styles.brandCheckbox}>
                      <input
                        type="checkbox"
                        checked={selectedBrands.includes(brand)}
                        onChange={() => handleBrandToggle(brand)}
                      />
                      <span>{brand}</span>
                      <span className={styles.brandCount}>
                        ({products.filter(p => p.brand === brand).length})
                      </span>
                    </label>
                  ))
                )}
              </div>
            </div>

            {/* Price Range Slider */}
            <div className={styles.filterSection}>
              <label className={styles.filterLabel}><span className="material-symbols-outlined">payments</span> Price Range</label>
              <div className={styles.priceSliderContainer}>
                <div className={styles.priceValues}>
                  <span>${priceMin}</span>
                  <span>${priceMax}</span>
                </div>
                <div className={styles.sliderTrack}>
                  <div 
                    className={styles.sliderRange}
                    style={{
                      left: `${((priceMin - priceRange.min) / (priceRange.max - priceRange.min)) * 100}%`,
                      right: `${100 - ((priceMax - priceRange.min) / (priceRange.max - priceRange.min)) * 100}%`
                    }}
                  />
                </div>
                <div className={styles.sliderInputs}>
                  <input
                    type="range"
                    min={priceRange.min}
                    max={priceRange.max}
                    value={priceMin}
                    onChange={(e) => {
                      const value = Math.min(Number(e.target.value), priceMax - 10);
                      setPriceMin(value);
                      setPriceRangeActive(true);
                    }}
                    className={styles.sliderInput}
                  />
                  <input
                    type="range"
                    min={priceRange.min}
                    max={priceRange.max}
                    value={priceMax}
                    onChange={(e) => {
                      const value = Math.max(Number(e.target.value), priceMin + 10);
                      setPriceMax(value);
                      setPriceRangeActive(true);
                    }}
                    className={styles.sliderInput}
                  />
                </div>
              </div>
            </div>

            {/* Clear Filters */}
            {hasActiveFilters && (
              <button onClick={clearFilters} className={styles.clearFiltersBtn}>
                <span className="material-symbols-outlined">close</span> Clear All Filters
              </button>
            )}
          </div>
        )}
      </aside>

      {/* Main Content */}
      <main className={styles.mainContent}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.titleBlock}>
            <Image
              src="/nabco.png"
              alt="Nabco Furniture"
              width={180}
              height={58}
              className={styles.headerLogo}
              priority
            />
            <h1 className={styles.title}>Product Dashboard</h1>
            <p className={styles.subtitle}>Manage your furniture catalog - View, Edit, and Delete products</p>
          </div>
        </div>

        {/* Stats Bar */}
        <div className={styles.statsBar}>
          <div className={styles.statsLeft}>
            <div className={styles.statItem}>
              <span className={styles.statValue}>{products.length}</span>
              <span className={styles.statLabel}>Total Products</span>
            </div>
            <div className={styles.statItem}>
              <span className={styles.statValue}>{filteredProducts.length}</span>
              <span className={styles.statLabel}>Showing</span>
            </div>
            <div className={styles.statItem}>
              <span className={styles.statValue}>{uniqueBrands.length}</span>
              <span className={styles.statLabel}>Brands</span>
            </div>
          </div>
          <button onClick={loadProducts} className={styles.refreshBtn}>
            <span className="material-symbols-outlined">refresh</span> Refresh
          </button>
        </div>

        {/* Messages */}
        {error && <div className={styles.errorMessage}>{error}</div>}
        {successMessage && <div className={styles.successMessage}>{successMessage}</div>}

        {/* Active Filters Display */}
        {hasActiveFilters && (
          <div className={styles.activeFilters}>
            <span className={styles.activeFiltersLabel}>Active Filters:</span>
            {searchQuery && (
              <span className={styles.filterTag}>
                Search: "{searchQuery}"
                <button onClick={() => setSearchQuery('')}>×</button>
              </span>
            )}
            {selectedBrands.map(brand => (
              <span key={brand} className={styles.filterTag}>
                {brand}
                <button onClick={() => handleBrandToggle(brand)}>×</button>
              </span>
            ))}
            {priceRangeActive && (
              <span className={styles.filterTag}>
                Price: ${priceMin} - ${priceMax}
                <button onClick={() => { setPriceMin(priceRange.min); setPriceMax(priceRange.max); setPriceRangeActive(false); }}>×</button>
              </span>
            )}
            {sortBy !== 'newest' && (
              <span className={styles.filterTag}>
                Sort: {sortBy}
                <button onClick={() => setSortBy('newest')}>×</button>
              </span>
            )}
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className={styles.loading}>
            <div className={styles.spinner}></div>
            <p>Loading products...</p>
          </div>
        )}

        {/* Empty State */}
        {!loading && filteredProducts.length === 0 && (
          <div className={styles.emptyState}>
            {products.length === 0 ? (
              <p>No products found. Upload some products to get started!</p>
            ) : (
              <>
                <p>No products match your filters.</p>
                <button onClick={clearFilters} className={styles.clearFiltersBtn}>
                  Clear Filters
                </button>
              </>
            )}
          </div>
        )}

        {/* Products Grid */}
        {!loading && filteredProducts.length > 0 && (
          <div className={styles.productsGrid}>
            {filteredProducts.map((product) => (
              <div key={product.id} className={styles.productCard}>
                {/* Product Image */}
                <div className={styles.imageContainer}>
                  <img
                    src={fixImageUrl(product.s3_url)}
                    alt={product.filename}
                    className={styles.productImage}
                  />
                </div>

                {/* Product Info */}
                <div className={styles.productInfo}>
                  <h3 className={styles.productName}>
                    {product.product_name || product.filename}
                  </h3>
                  {product.brand && (
                    <p className={styles.brand}>Brand: {product.brand}</p>
                  )}
                  {product.sku && (
                    <p className={styles.sku}>SKU: {product.sku}</p>
                  )}
                  {product.price && (
                    <p className={styles.price}>${product.price.toFixed(2)}</p>
                  )}
                  {product.description && (
                    <p className={styles.description}>{product.description}</p>
                  )}
                </div>

                <div className={styles.actions}>
                  <button
                    onClick={() => handleEdit(product)}
                    className={styles.editBtn}
                  >
                    <span className="material-symbols-outlined">edit</span> Edit
                  </button>
                  <button
                    onClick={() => setDeleteConfirm(product.id)}
                    className={styles.deleteBtn}
                  >
                    <span className="material-symbols-outlined">delete</span> Delete
                  </button>
                </div>

                {/* Delete Confirmation */}
                {deleteConfirm === product.id && (
                  <div className={styles.confirmOverlay}>
                    <div className={styles.confirmBox}>
                      <p>Delete this product?</p>
                      <div className={styles.confirmActions}>
                        <button
                          onClick={() => handleDelete(product.id)}
                          className={styles.confirmDelete}
                        >
                          Yes, Delete
                        </button>
                        <button
                          onClick={() => setDeleteConfirm(null)}
                          className={styles.confirmCancel}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Edit Modal */}
      {editingProduct && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <h2 className={styles.modalTitle}>Edit Product</h2>
            
            <div className={styles.modalImage}>
              <img
                src={fixImageUrl(editingProduct.s3_url)}
                alt={editingProduct.filename}
              />
            </div>

            <div className={styles.formGroup}>
              <label>Product Name</label>
              <input
                type="text"
                value={editingProduct.product_name || ''}
                onChange={(e) => setEditingProduct({
                  ...editingProduct,
                  product_name: e.target.value
                })}
              />
            </div>

            <div className={styles.formGroup}>
              <label>Brand</label>
              <input
                type="text"
                value={editingProduct.brand || ''}
                onChange={(e) => setEditingProduct({
                  ...editingProduct,
                  brand: e.target.value
                })}
              />
            </div>

            <div className={styles.formGroup}>
              <label>SKU</label>
              <input
                type="text"
                value={editingProduct.sku || ''}
                onChange={(e) => setEditingProduct({
                  ...editingProduct,
                  sku: e.target.value
                })}
              />
            </div>

            <div className={styles.formGroup}>
              <label>Price ($)</label>
              <input
                type="number"
                step="0.01"
                value={editingProduct.price || ''}
                onChange={(e) => setEditingProduct({
                  ...editingProduct,
                  price: parseFloat(e.target.value) || 0
                })}
              />
            </div>

            <div className={styles.formGroup}>
              <label>Description</label>
              <textarea
                value={editingProduct.description || ''}
                onChange={(e) => setEditingProduct({
                  ...editingProduct,
                  description: e.target.value
                })}
                rows={3}
              />
            </div>

            <div className={styles.modalActions}>
              <button onClick={handleSave} className={styles.saveBtn}>
                💾 Save Changes
              </button>
              <button onClick={handleCancel} className={styles.cancelBtn}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
