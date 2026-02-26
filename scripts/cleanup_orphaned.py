"""Clean up local image files that are not in the database."""
import os
from pathlib import Path
import db_mysql

IMAGES_DIR = Path(__file__).resolve().parent / "images_db"

def cleanup_orphaned_files():
    """Remove files from images_db/ that don't have a database entry."""
    if not IMAGES_DIR.exists():
        print("images_db/ folder not found")
        return
    
    # Get all files in directory
    local_files = set()
    for f in IMAGES_DIR.iterdir():
        if f.is_file():
            local_files.add(f.name)
    
    # Get all files in database
    db_files = set(db_mysql.get_all_images())
    
    # Find orphaned files (in filesystem but not in database)
    orphaned = local_files - db_files
    
    if not orphaned:
        print("✓ No orphaned files found!")
        return
    
    print(f"\nFound {len(orphaned)} orphaned file(s):")
    for fname in sorted(orphaned):
        print(f"  - {fname}")
    
    # Ask for confirmation
    response = input("\nDelete these files? (yes/no): ").strip().lower()
    if response not in ['yes', 'y']:
        print("Cancelled.")
        return
    
    # Delete orphaned files
    deleted_count = 0
    for fname in orphaned:
        filepath = IMAGES_DIR / fname
        try:
            filepath.unlink()
            print(f"✓ Deleted: {fname}")
            deleted_count += 1
        except Exception as e:
            print(f"✗ Failed to delete {fname}: {e}")
    
    print(f"\n✅ Deleted {deleted_count} orphaned file(s)")

if __name__ == "__main__":
    cleanup_orphaned_files()
