-- PostgreSQL initialization for Image Search Engine Phase 3
-- This script creates the database schema with pgvector support

-- Create pgvector extension (available in timescaledb image)
CREATE EXTENSION IF NOT EXISTS vector;

-- Create the images table
CREATE TABLE IF NOT EXISTS images (
    id VARCHAR(36) PRIMARY KEY,
    filename VARCHAR(255) NOT NULL UNIQUE,
    s3_url VARCHAR(500),
    embedding vector(512),
    sku VARCHAR(100),
    brand VARCHAR(255),
    product_name VARCHAR(255),
    product_date VARCHAR(10),
    description TEXT,
    price NUMERIC(10, 2),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for common search fields
CREATE INDEX IF NOT EXISTS idx_images_sku ON images(sku);
CREATE INDEX IF NOT EXISTS idx_images_brand ON images(brand);
CREATE INDEX IF NOT EXISTS idx_images_product_name ON images(product_name);

-- Create IVFFLAT vector index for efficient similarity search
CREATE INDEX IF NOT EXISTS ix_images_embedding_ivf ON images 
    USING IVFFLAT (embedding vector_cosine_ops) WITH (lists = 100);

-- Log successful initialization
SELECT 'Phase 3: Image Search Database with pgvector initialized successfully!' AS message;
