# Database-First Image Management

Your application is now set up to use the database as the source of truth.

## Step 1: Clean Up Orphaned Files (Optional)

If you have any old image files that aren't in the database, run:

```bash
python cleanup_orphaned.py
```

This will:

- Find all files in `images_db/` folder
- Compare with images in the database
- Show you which files don't have database entries
- Ask for confirmation before deleting

## Step 2: Admin Panel - View Database Images

1. Go to **http://localhost:8000/admin**
2. You'll see a table of all images in the database:
   - **Preview**: Thumbnail of the image
   - **Filename**: Name of the image file
   - **Actions**: Delete button

All images displayed are from the **MySQL database**, not the filesystem.

## Step 3: Upload New Images

1. Click **Upload Images** button
2. Select images from your computer
3. Images are automatically:
   - ✓ Saved to `images_db/` folder
   - ✓ Indexed with CLIP embeddings
   - ✓ Stored in MySQL database
   - ✓ Appear in the admin table

## Step 4: Delete Images

Click **Delete** on any image to:

- ✓ Remove from `images_db/` folder
- ✓ Remove from MySQL database
- ✓ Automatically removed from admin table

## Step 5: Search Using Database Images

1. Go to **http://localhost:8000/**
2. Upload a query image
3. The app finds similar images by comparing embeddings stored in the database
4. Returns top matches from your indexed collection

---

## Database Structure

Your images are now stored in the `images` table with:

- `id`: Auto-incremented ID
- `filename`: Image file name
- `file_path`: Full path to the image
- `embedding`: CLIP embedding (512-dimensional vector)
- `created_at`: Upload timestamp
- `updated_at`: Last modified timestamp

All operations stay synchronized between the filesystem and database automatically.
