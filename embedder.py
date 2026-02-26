# embedder.py
import numpy as np
from PIL import Image

import torch
from transformers import CLIPProcessor, CLIPModel

MODEL_NAME = "openai/clip-vit-base-patch32"

_device = torch.device("cpu")
_model = None
_processor = None


def _load_model():
    global _model, _processor
    if _model is None or _processor is None:
        _model = CLIPModel.from_pretrained(MODEL_NAME).to(_device)
        _processor = CLIPProcessor.from_pretrained(MODEL_NAME)
        _model.eval()


@torch.inference_mode()
def image_embedding_pil(img: Image.Image) -> np.ndarray:
    """
    Returns a L2-normalized embedding vector (float32) for the given PIL image.
    """
    _load_model()
    if img.mode != "RGB":
        img = img.convert("RGB")


    # To improve robustness we average features computed on multiple
    # crops and mirrored versions. This helps when images are framed,
    # have padding, or contain transparent backgrounds.
    def center_crop(im: Image.Image, scale: float) -> Image.Image:
        w, h = im.size
        new_w, new_h = int(w * scale), int(h * scale)
        left = (w - new_w) // 2
        top = (h - new_h) // 2
        return im.crop((left, top, left + new_w, top + new_h)).resize(im.size, Image.LANCZOS)

    crops = [img]
    # center crops at two scales
    for s in (0.9, 0.8):
        try:
            crops.append(center_crop(img, s))
        except Exception:
            pass

    # add horizontal flips of each crop
    crops = crops + [c.transpose(Image.FLIP_LEFT_RIGHT) for c in list(crops)]

    inputs = _processor(images=crops, return_tensors="pt").to(_device)
    feats = _model.get_image_features(**inputs)  # [N, dim]
    # Convert to CPU numpy and average across crops
    vecs = feats.cpu().numpy().astype(np.float32)
    vec = vecs.mean(axis=0)

    # Normalize (important for cosine similarity)
    norm = np.linalg.norm(vec) + 1e-12
    vec = vec / norm
    return vec


def cosine_similarity(a: np.ndarray, b: np.ndarray) -> float:
    """
    a and b should be normalized; returns cosine in [-1, 1]
    """
    return float(np.dot(a, b))
