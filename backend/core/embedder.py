"""Image embedding using CLIP model."""
import numpy as np
import torch
from PIL import Image
from io import BytesIO
from typing import Tuple
from transformers import CLIPProcessor, CLIPModel
from core.config import settings


class CLIPEmbedder:
    """CLIP model for image embeddings."""
    
    def __init__(self):
        """Initialize CLIP model and processor."""
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        print(f"🤖 Using device: {self.device}")
        
        # Load pre-trained CLIP model
        print("📦 Loading CLIP model...")
        self.model = CLIPModel.from_pretrained("openai/clip-vit-base-patch32")
        self.processor = CLIPProcessor.from_pretrained("openai/clip-vit-base-patch32")
        
        # Move model to device and set to eval mode
        self.model.to(self.device)
        self.model.eval()
        print("✅ CLIP model loaded successfully")
        
        # Vector dimension for CLIP ViT-base-patch32
        self.embedding_dim = 512
    
    @torch.no_grad()
    def compute_embedding(self, image_data: BytesIO) -> np.ndarray:
        """
        Compute embedding for an image.
        
        Args:
            image_data: BytesIO object containing image data
            
        Returns:
            L2-normalized embedding vector (512-dim float32)
        """
        try:
            # Load image
            image_data.seek(0)
            image = Image.open(image_data).convert("RGB")
            
            # Process image
            inputs = self.processor(
                images=image,
                return_tensors="pt",
                padding=True,
            )
            
            # Move inputs to device
            inputs = {k: v.to(self.device) for k, v in inputs.items()}
            
            # Get image embeddings
            image_features = self.model.get_image_features(**inputs)
            
            # L2 normalize
            image_features = image_features / image_features.norm(p=2, dim=-1, keepdim=True)
            
            # Convert to numpy and return
            embedding = image_features.cpu().numpy().astype(np.float32).flatten()
            
            print(f"✅ Computed embedding: shape={embedding.shape}, dtype={embedding.dtype}")
            return embedding
            
        except Exception as e:
            print(f"❌ Error computing embedding: {e}")
            raise
    
    @torch.no_grad()
    def compute_text_embedding(self, text: str) -> np.ndarray:
        """Compute embedding for text (for future use)."""
        try:
            inputs = self.processor(
                text=text,
                return_tensors="pt",
                padding=True,
            )
            inputs = {k: v.to(self.device) for k, v in inputs.items()}
            text_features = self.model.get_text_features(**inputs)
            text_features = text_features / text_features.norm(p=2, dim=-1, keepdim=True)
            return text_features.cpu().numpy().astype(np.float32).flatten()
        except Exception as e:
            print(f"❌ Error computing text embedding: {e}")
            raise


# Global embedder instance
_embedder: CLIPEmbedder = None


def get_embedder() -> CLIPEmbedder:
    """Get or initialize CLIP embedder."""
    global _embedder
    if _embedder is None:
        _embedder = CLIPEmbedder()
    return _embedder


async def compute_image_embedding(image_data: BytesIO) -> np.ndarray:
    """Compute embedding for an image."""
    embedder = get_embedder()
    return embedder.compute_embedding(image_data)


async def compute_text_embedding(text: str) -> np.ndarray:
    """Compute embedding for text."""
    embedder = get_embedder()
    return embedder.compute_text_embedding(text)
