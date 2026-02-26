"""Clear uploads and images_db folders."""
import os
import shutil
from pathlib import Path

def clear_folder(folder_path):
    """Delete all files in a folder."""
    path = Path(folder_path)
    if not path.exists():
        print(f"✓ {folder_path} does not exist (skipped)")
        return
    
    try:
        for item in path.iterdir():
            if item.is_file():
                item.unlink()
                print(f"  Deleted: {item.name}")
            elif item.is_dir():
                shutil.rmtree(item)
                print(f"  Deleted folder: {item.name}")
        print(f"✓ Cleared {folder_path}/")
    except Exception as e:
        print(f"✗ Error clearing {folder_path}: {e}")

print("Clearing local folders (using database instead)...\n")
clear_folder("uploads")
clear_folder("images_db")
print("\n✅ Done! All local files cleared.")
