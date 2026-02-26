"""Database connection and session management."""
from typing import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy import text

from core.config import settings
from db.models import Base

# Convert PostgreSQL URL to async format
database_url = settings.DATABASE_URL

# For local development, if using regular postgresql://, convert to asyncpg
if database_url.startswith("postgresql://"):
    database_url = database_url.replace("postgresql://", "postgresql+asyncpg://")
elif database_url.startswith("postgres://"):
    database_url = database_url.replace("postgres://", "postgresql+asyncpg://")

# Create async engine
engine = create_async_engine(
    database_url,
    echo=settings.DEBUG,
    future=True,
    pool_pre_ping=True,  # Test connection before using
    connect_args={"timeout": 10}
)

# Session factory
async_session = sessionmaker(
    engine, class_=AsyncSession, expire_on_commit=False, future=True
)


async def get_session() -> AsyncGenerator[AsyncSession, None]:
    """Get a database session for dependency injection."""
    async with async_session() as session:
        try:
            yield session
        finally:
            await session.close()


async def init_db():
    """Initialize database - create tables, pgvector extension, and indexes."""
    try:
        async with engine.begin() as conn:
            # Enable pgvector extension
            try:
                await conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
                print("✅ pgvector extension enabled")
            except Exception as e:
                print(f"⚠️  pgvector extension note: {e}")
            
            # Create all tables
            await conn.run_sync(Base.metadata.create_all)
            print("✅ Database tables created/verified")
            
            # Create IVFFLAT vector index for similarity search
            try:
                await conn.execute(text("""
                    CREATE INDEX IF NOT EXISTS ix_images_embedding_ivf 
                    ON images 
                    USING IVFFLAT (embedding vector_cosine_ops) 
                    WITH (lists = 100)
                """))
                print("✅ Vector similarity index created")
            except Exception as e:
                print(f"⚠️  Vector index note: {e}")
                
    except Exception as e:
        print(f"❌ Database initialization error: {e}")
        raise


async def close_db():
    """Close database connection."""
    await engine.dispose()
    print("✅ Database connection closed")
