"""MySQL database connection and operations for the image search app."""
import pymysql
import numpy as np
from typing import List, Optional, Tuple

# MySQL connection configuration
DB_CONFIG = {
    "host": "localhost",
    "port": 3306,
    "user": "root",
    "password": "",
    "database": "image_search_db",
    "charset": "utf8mb4",
}


def get_connection():
    """Get a MySQL database connection."""
    return pymysql.connect(**DB_CONFIG)


def init_db():
    """Initialize database - creates table if it doesn't exist."""
    try:
        conn = get_connection()
        cursor = conn.cursor()
        
        # Create images table if not exists (image_data will store binary)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS images (
                id INT AUTO_INCREMENT PRIMARY KEY,
                filename VARCHAR(255) NOT NULL UNIQUE,
                image_data LONGBLOB,
                embedding LONGBLOB,
                sku VARCHAR(100),
                brand VARCHAR(255),
                product_name VARCHAR(255),
                product_date DATE,
                description TEXT,
                price DECIMAL(10,2),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_filename (filename)
            )
        """)

        # Ensure legacy installs get the new column if missing
        # Ensure legacy installs get the new columns if missing
        try:
            # helper to add column if not exists
            def add_column_if_missing(col_name, col_def):
                cursor.execute("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=%s AND TABLE_NAME='images' AND COLUMN_NAME=%s", (DB_CONFIG['database'], col_name))
                col = cursor.fetchone()
                if not col:
                    cursor.execute(f"ALTER TABLE images ADD COLUMN {col_name} {col_def}")
                    print(f"[DB] Added missing column: {col_name}")

            add_column_if_missing('image_data', 'LONGBLOB')
            add_column_if_missing('sku', "VARCHAR(100)")
            add_column_if_missing('brand', "VARCHAR(255)")
            add_column_if_missing('product_name', "VARCHAR(255)")
            add_column_if_missing('product_date', "DATE")
            add_column_if_missing('description', "TEXT")
            add_column_if_missing('price', "DECIMAL(10,2)")
        except Exception:
            # If INFORMATION_SCHEMA not accessible, ignore and continue
            pass
        
        conn.commit()
        cursor.close()
        conn.close()
        print("✓ Database initialized")
    except Exception as e:
        print(f"✗ Database init error: {e}")


def add_image_to_db(filename: str, image_bytes: bytes = None, embedding: np.ndarray = None,
                    sku: str = None, brand: str = None, product_name: str = None,
                    product_date: str = None, description: str = None, price: float = None) -> bool:
    """Add or update an image in the database. Accepts optional product metadata."""
    conn = None
    try:
        conn = get_connection()
        cursor = conn.cursor()
        
        # Convert embedding to binary if provided
        embedding_blob = None
        if embedding is not None:
            embedding_blob = embedding.astype(np.float32).tobytes()
        
        # Try to insert, if exists then update
        try:
            cursor.execute("""
                INSERT INTO images (filename, image_data, embedding, sku, brand, product_name, product_date, description, price)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (filename, image_bytes, embedding_blob, sku, brand, product_name, product_date, description, price))
        except pymysql.IntegrityError:
            # Filename already exists, update it
            cursor.execute("""
                UPDATE images SET image_data = %s, embedding = %s, sku = %s, brand = %s, product_name = %s, product_date = %s, description = %s, price = %s, updated_at = CURRENT_TIMESTAMP
                WHERE filename = %s
            """, (image_bytes, embedding_blob, sku, brand, product_name, product_date, description, price, filename))
        
        conn.commit()
        cursor.close()
        conn.close()
        print(f"✓ Added/updated {filename} in database")
        return True
    except Exception as e:
        print(f"✗ Error adding image {filename} to DB: {e}")
        import traceback
        traceback.print_exc()
        if conn:
            try:
                conn.close()
            except:
                pass
        return False


def delete_image_from_db(filename: str) -> bool:
    """Delete an image from the database."""
    try:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("DELETE FROM images WHERE filename = %s", (filename,))
        conn.commit()
        cursor.close()
        conn.close()
        return True
    except Exception as e:
        print(f"✗ Error deleting image {filename}: {e}")
        return False


def get_all_images() -> List[str]:
    """Get list of all image filenames from the database."""
    try:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT filename FROM images ORDER BY filename ASC")
        results = cursor.fetchall()
        cursor.close()
        conn.close()
        return [row[0] for row in results]
    except Exception as e:
        print(f"✗ Error fetching images: {e}")
        return []


def get_all_images_with_meta() -> List[dict]:
    """Return list of images with metadata as dictionaries."""
    try:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT filename, sku, brand, product_name, product_date, description, price, image_data IS NOT NULL as has_data FROM images ORDER BY filename ASC")
        results = cursor.fetchall()
        cursor.close()
        conn.close()

        out = []
        for row in results:
            filename, sku, brand, product_name, product_date, description, price, has_data = row
            out.append({
                "filename": filename,
                "sku": sku,
                "brand": brand,
                "name": product_name,
                "date": product_date.isoformat() if product_date else None,
                "description": description,
                "price": float(price) if price is not None else None,
                "has_data": bool(has_data),
            })
        return out
    except Exception as e:
        print(f"✗ Error fetching images with meta: {e}")
        return []


def get_metadata_for_image(filename: str) -> Optional[dict]:
    try:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT sku, brand, product_name, product_date, description, price FROM images WHERE filename=%s", (filename,))
        row = cursor.fetchone()
        cursor.close()
        conn.close()
        if not row:
            return None
        sku, brand, product_name, product_date, description, price = row
        return {
            "sku": sku,
            "brand": brand,
            "name": product_name,
            "date": product_date.isoformat() if product_date else None,
            "description": description,
            "price": float(price) if price is not None else None,
        }
    except Exception as e:
        print(f"✗ Error fetching metadata for {filename}: {e}")
        return None


def get_products(q: str = None, brand: str = None, sku: str = None, page: int = 1, per_page: int = 25) -> dict:
    """Return paginated list of products with basic metadata and total count."""
    try:
        conn = get_connection()
        cursor = conn.cursor()

        where_clauses = []
        params = []
        if q:
            where_clauses.append("(filename LIKE %s OR product_name LIKE %s OR brand LIKE %s OR sku LIKE %s)")
            like_q = f"%{q}%"
            params.extend([like_q, like_q, like_q, like_q])
        if brand:
            where_clauses.append("brand = %s")
            params.append(brand)
        if sku:
            where_clauses.append("sku = %s")
            params.append(sku)

        where_sql = "" if not where_clauses else "WHERE " + " AND ".join(where_clauses)

        # Count total
        count_sql = f"SELECT COUNT(*) FROM images {where_sql}"
        cursor.execute(count_sql, tuple(params))
        total = int(cursor.fetchone()[0])

        # Pagination
        offset = max(0, (int(page) - 1) * int(per_page))
        data_sql = f"SELECT filename, sku, brand, product_name, product_date, description, price, image_data IS NOT NULL as has_data FROM images {where_sql} ORDER BY filename ASC LIMIT %s OFFSET %s"
        data_params = params + [int(per_page), offset]
        cursor.execute(data_sql, tuple(data_params))
        rows = cursor.fetchall()
        cursor.close()
        conn.close()

        items = []
        for filename, sku_v, brand_v, product_name_v, product_date_v, description_v, price_v, has_data in rows:
            items.append({
                "filename": filename,
                "sku": sku_v,
                "brand": brand_v,
                "name": product_name_v,
                "date": product_date_v.isoformat() if product_date_v else None,
                "description": description_v,
                "price": float(price_v) if price_v is not None else None,
                "has_data": bool(has_data),
            })

        return {"items": items, "total": total, "page": int(page), "per_page": int(per_page)}
    except Exception as e:
        print(f"✗ Error getting products: {e}")
        return {"items": [], "total": 0, "page": int(page), "per_page": int(per_page)}


def update_image_metadata(filename: str, sku: str = None, brand: str = None, product_name: str = None, product_date: str = None, description: str = None, price: float = None) -> bool:
    """Update metadata fields for a given image filename."""
    try:
        conn = get_connection()
        cursor = conn.cursor()
        # Build SET clauses
        sets = []
        params = []
        if sku is not None:
            sets.append("sku = %s")
            params.append(sku)
        if brand is not None:
            sets.append("brand = %s")
            params.append(brand)
        if product_name is not None:
            sets.append("product_name = %s")
            params.append(product_name)
        if product_date is not None:
            sets.append("product_date = %s")
            params.append(product_date)
        if description is not None:
            sets.append("description = %s")
            params.append(description)
        if price is not None:
            sets.append("price = %s")
            params.append(price)

        if not sets:
            cursor.close()
            conn.close()
            return True

        sql = f"UPDATE images SET {', '.join(sets)}, updated_at = CURRENT_TIMESTAMP WHERE filename = %s"
        params.append(filename)
        cursor.execute(sql, tuple(params))
        conn.commit()
        cursor.close()
        conn.close()
        return True
    except Exception as e:
        print(f"✗ Error updating metadata for {filename}: {e}")
        return False


def get_embedding_for_image(filename: str) -> Optional[np.ndarray]:
    """Get embedding vector for a specific image."""
    try:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT embedding FROM images WHERE filename = %s", (filename,))
        result = cursor.fetchone()
        cursor.close()
        conn.close()
        
        if result and result[0]:
            return np.frombuffer(result[0], dtype=np.float32)
        return None
    except Exception as e:
        print(f"✗ Error fetching embedding for {filename}: {e}")
        return None


def get_all_embeddings() -> Tuple[Optional[np.ndarray], List[str]]:
    """Get all embeddings and corresponding filenames."""
    try:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT filename, embedding FROM images WHERE embedding IS NOT NULL ORDER BY filename ASC")
        results = cursor.fetchall()
        cursor.close()
        conn.close()
        
        if not results:
            return None, []
        
        filenames = []
        embeddings = []
        
        for filename, embedding_blob in results:
            if embedding_blob:
                filenames.append(filename)
                embeddings.append(np.frombuffer(embedding_blob, dtype=np.float32))
        
        if not embeddings:
            return None, []
        
        # Stack and normalize
        emb_array = np.vstack(embeddings).astype(np.float32)
        norms = np.linalg.norm(emb_array, axis=1, keepdims=True)
        emb_array = emb_array / (norms + 1e-12)
        
        return emb_array, filenames
    except Exception as e:
        print(f"✗ Error fetching all embeddings: {e}")
        return None, []


def count_images_in_db() -> int:
    """Get total count of images in database."""
    try:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM images")
        count = cursor.fetchone()[0]
        cursor.close()
        conn.close()
        return count
    except Exception as e:
        print(f"✗ Error counting images: {e}")
        return 0


def get_image_binary(filename: str) -> Optional[bytes]:
    """Get the image binary data from the database."""
    try:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT image_data FROM images WHERE filename = %s", (filename,))
        result = cursor.fetchone()
        cursor.close()
        conn.close()
        
        if result and result[0]:
            return result[0]
        return None
    except Exception as e:
        print(f"✗ Error fetching image binary for {filename}: {e}")
        return None


def count_indexed_images() -> int:
    """Return count of images that have embeddings (indexed)."""
    try:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM images WHERE embedding IS NOT NULL")
        count = cursor.fetchone()[0]
        cursor.close()
        conn.close()
        return int(count)
    except Exception as e:
        print(f"✗ Error counting indexed images: {e}")
        return 0


def get_recent_uploads(limit: int = 10) -> List[dict]:
    """Return recent uploads with basic metadata ordered by created_at desc."""
    try:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute(
            "SELECT filename, sku, brand, product_name, created_at FROM images ORDER BY created_at DESC LIMIT %s",
            (limit,),
        )
        rows = cursor.fetchall()
        cursor.close()
        conn.close()
        out = []
        for filename, sku, brand, product_name, created_at in rows:
            out.append({
                "filename": filename,
                "sku": sku,
                "brand": brand,
                "name": product_name,
                "created_at": created_at.isoformat() if created_at else None,
            })
        return out
    except Exception as e:
        print(f"✗ Error fetching recent uploads: {e}")
        return []
