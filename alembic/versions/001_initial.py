"""Create images table with pgvector support.

Revision ID: 001_initial
Revises: 
Create Date: 2024-02-17 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers
revision = '001_initial'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Create initial schema."""
    # Create pgvector extension
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")
    
    # Create images table
    op.create_table(
        'images',
        sa.Column('id', sa.String(36), nullable=False),
        sa.Column('filename', sa.String(255), nullable=False),
        sa.Column('s3_url', sa.String(500), nullable=True),
        sa.Column('embedding', postgresql.UUID(as_uuid=False), nullable=True),  # Will be vector(512)
        sa.Column('sku', sa.String(100), nullable=True),
        sa.Column('brand', sa.String(255), nullable=True),
        sa.Column('product_name', sa.String(255), nullable=True),
        sa.Column('product_date', sa.String(10), nullable=True),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('price', sa.Numeric(precision=10, scale=2), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Create indexes
    op.create_index(op.f('ix_images_filename'), 'images', ['filename'], unique=True)
    op.create_index(op.f('ix_images_sku'), 'images', ['sku'], unique=False)
    op.create_index(op.f('ix_images_brand'), 'images', ['brand'], unique=False)
    
    # After table creation, modify embedding column to use pgvector
    op.execute("""
        ALTER TABLE images 
        ALTER COLUMN embedding TYPE vector(512) USING NULL::vector(512)
    """)
    
    # Create IVFFLAT index for fast vector search
    op.execute("""
        CREATE INDEX ix_images_embedding_ivf 
        ON images 
        USING IVFFLAT (embedding vector_cosine_ops)
        WITH (lists = 100)
    """)


def downgrade() -> None:
    """Revert initial schema."""
    op.drop_index(op.f('ix_images_embedding_ivf'), table_name='images')
    op.drop_index(op.f('ix_images_brand'), table_name='images')
    op.drop_index(op.f('ix_images_sku'), table_name='images')
    op.drop_index(op.f('ix_images_filename'), table_name='images')
    op.drop_table('images')
