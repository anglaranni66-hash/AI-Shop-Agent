"""
firebase_config.py
==================
Enterprise Multi-Tenant Firebase Architecture (Firestore + Firebase Storage)
for AI Shop Agent & Cloud Catalog Management.

Architecture & Schema:
----------------------
1. Firestore Collections & Multi-Tenant Hierarchy:
   - Collection `users/{shop_owner_id}`:
       * id: str
       * shop_name: str
       * email: str
       * business_category: str
       * settings: dict
       * oauth_tokens: dict
       * created_at: timestamp
       * updated_at: timestamp

   - Sub-Collection `users/{shop_owner_id}/products/{product_id}`:
       * id: str
       * name: str
       * price: float | int
       * category: str
       * stock: int
       * description: str
       * image_url: str (Lightweight HTTPS public CDN/Storage URL only)
       * attributes: dict (size, color, weight, etc.)
       * created_at: timestamp
       * updated_at: timestamp

2. Automatic PIL Compression & Storage Pipeline:
   - `upload_product_image_and_get_url(local_path, shop_id, product_id)`
   - PC images are downscaled (max 1080x1080) and compressed to high-efficiency WebP/JPEG (quality=80)
   - Zero bulky base64 or raw blobs in Firestore — only optimized HTTPS public URLs stored.
"""

import os
import io
import json
import logging
from typing import Dict, Any, List, Optional
from datetime import datetime
from PIL import Image

logger = logging.getLogger("FirebaseConfig")
logger.setLevel(logging.INFO)

# Firebase Admin SDK Safe Import with Graceful Fallback
FIREBASE_INITIALIZED = False
_db = None
_bucket = None

try:
    import firebase_admin
    from firebase_admin import credentials, firestore, storage
    FIREBASE_AVAILABLE = True
except ImportError:
    FIREBASE_AVAILABLE = False
    logger.warning("[FirebaseConfig] 'firebase-admin' package not installed. Run 'pip install firebase-admin'.")


def init_firebase(
    service_account_path_or_dict: Optional[Any] = None,
    storage_bucket_name: Optional[str] = None
) -> bool:
    """
    Initializes Firebase Admin SDK using service account credentials and configures Firestore + Storage.
    Supports:
      1. Filepath to serviceAccountKey.json
      2. Inline JSON string via FIREBASE_SERVICE_ACCOUNT_JSON env var
      3. Google Application Default Credentials (ADC)
    """
    global FIREBASE_INITIALIZED, _db, _bucket

    if not FIREBASE_AVAILABLE:
        logger.warning("[FirebaseConfig] Firebase Admin SDK unavailable.")
        return False

    if FIREBASE_INITIALIZED and _db is not None:
        return True

    try:
        cred = None
        bucket_name = (
            storage_bucket_name
            or os.environ.get("FIREBASE_STORAGE_BUCKET")
            or os.environ.get("GCS_BUCKET_NAME")
        )

        # 1. From provided argument
        if service_account_path_or_dict:
            if isinstance(service_account_path_or_dict, str):
                if os.path.exists(service_account_path_or_dict):
                    cred = credentials.Certificate(service_account_path_or_dict)
                elif service_account_path_or_dict.strip().startswith("{"):
                    cred_dict = json.loads(service_account_path_or_dict)
                    cred = credentials.Certificate(cred_dict)
            elif isinstance(service_account_path_or_dict, dict):
                cred = credentials.Certificate(service_account_path_or_dict)

        # 2. From Environment Variable Filepath
        if not cred and os.environ.get("FIREBASE_SERVICE_ACCOUNT_KEY"):
            key_path = os.environ.get("FIREBASE_SERVICE_ACCOUNT_KEY", "")
            if os.path.exists(key_path):
                cred = credentials.Certificate(key_path)

        # 3. From Environment Variable JSON String
        if not cred and os.environ.get("FIREBASE_SERVICE_ACCOUNT_JSON"):
            try:
                cred_dict = json.loads(os.environ.get("FIREBASE_SERVICE_ACCOUNT_JSON", "{}"))
                if cred_dict:
                    cred = credentials.Certificate(cred_dict)
            except Exception as json_err:
                logger.error(f"[FirebaseConfig] Failed to parse FIREBASE_SERVICE_ACCOUNT_JSON: {json_err}")

        # 4. Fallback to Application Default Credentials (ADC)
        if not cred:
            try:
                cred = credentials.ApplicationDefault()
            except Exception:
                cred = None

        if not firebase_admin._apps:
            app_options = {}
            if bucket_name:
                app_options["storageBucket"] = bucket_name
            if cred:
                firebase_admin.initialize_app(cred, app_options)
            else:
                firebase_admin.initialize_app(options=app_options)

        _db = firestore.client()
        if bucket_name:
            _bucket = storage.bucket(bucket_name)
        else:
            try:
                _bucket = storage.bucket()
            except Exception:
                _bucket = None

        FIREBASE_INITIALIZED = True
        logger.info("[FirebaseConfig] Firebase Admin SDK initialized successfully.")
        return True

    except Exception as e:
        logger.error(f"[FirebaseConfig] Firebase initialization failed: {e}")
        return False


def get_firestore_client():
    """Returns initialized Firestore client or None if offline."""
    if not FIREBASE_INITIALIZED:
        init_firebase()
    return _db


def get_storage_bucket():
    """Returns initialized Firebase Storage bucket or None."""
    if not FIREBASE_INITIALIZED:
        init_firebase()
    return _bucket


# ----------------------------------------------------------------------
# 1. Multi-Tenant Shop & Product Firestore Operations
# ----------------------------------------------------------------------

def get_tenant_profile(shop_owner_id: str) -> Optional[Dict[str, Any]]:
    """
    Fetches shop profile from Firestore `users/{shop_owner_id}`.
    """
    db = get_firestore_client()
    if not db:
        return None
    try:
        doc_ref = db.collection("users").document(shop_owner_id)
        doc = doc_ref.get()
        if doc.exists:
            data = doc.to_dict() or {}
            data["id"] = doc.id
            return data
        return None
    except Exception as e:
        logger.error(f"[FirebaseConfig] Error fetching tenant profile {shop_owner_id}: {e}")
        return None


def upsert_tenant_profile(shop_owner_id: str, profile_data: Dict[str, Any]) -> bool:
    """
    Creates or updates shop owner record in `users/{shop_owner_id}`.
    """
    db = get_firestore_client()
    if not db:
        return False
    try:
        doc_ref = db.collection("users").document(shop_owner_id)
        payload = {
            **profile_data,
            "updated_at": firestore.SERVER_TIMESTAMP
        }
        doc_ref.set(payload, merge=True)
        return True
    except Exception as e:
        logger.error(f"[FirebaseConfig] Error upserting tenant profile {shop_owner_id}: {e}")
        return False


def get_tenant_products(shop_owner_id: str) -> List[Dict[str, Any]]:
    """
    Fetches all active products from sub-collection `users/{shop_owner_id}/products`.
    """
    db = get_firestore_client()
    if not db:
        return []
    try:
        products_ref = db.collection("users").document(shop_owner_id).collection("products")
        docs = products_ref.stream()
        products = []
        for doc in docs:
            item = doc.to_dict() or {}
            item["id"] = doc.id
            products.append(item)
        return products
    except Exception as e:
        logger.error(f"[FirebaseConfig] Error streaming products for {shop_owner_id}: {e}")
        return []


def upsert_tenant_product(shop_owner_id: str, product_id: str, product_data: Dict[str, Any]) -> bool:
    """
    Creates or updates a product in `users/{shop_owner_id}/products/{product_id}`.
    """
    db = get_firestore_client()
    if not db:
        return False
    try:
        doc_ref = (
            db.collection("users")
            .document(shop_owner_id)
            .collection("products")
            .document(product_id)
        )
        payload = {
            "id": product_id,
            "name": product_data.get("name", "Product"),
            "price": float(product_data.get("price", 0)),
            "category": product_data.get("category", "General"),
            "stock": int(product_data.get("stock", 0)),
            "description": product_data.get("description", ""),
            "image_url": product_data.get("image_url", ""),
            "attributes": product_data.get("attributes", {}),
            "updated_at": firestore.SERVER_TIMESTAMP
        }
        doc_ref.set(payload, merge=True)
        return True
    except Exception as e:
        logger.error(f"[FirebaseConfig] Error upserting product {product_id} for {shop_owner_id}: {e}")
        return False


def delete_tenant_product(shop_owner_id: str, product_id: str) -> bool:
    """Deletes a product document from Firestore."""
    db = get_firestore_client()
    if not db:
        return False
    try:
        doc_ref = (
            db.collection("users")
            .document(shop_owner_id)
            .collection("products")
            .document(product_id)
        )
        doc_ref.delete()
        return True
    except Exception as e:
        logger.error(f"[FirebaseConfig] Error deleting product {product_id} for {shop_owner_id}: {e}")
        return False


# ----------------------------------------------------------------------
# 2. Automated PIL Image Compression & Cloud Storage Uploader
# ----------------------------------------------------------------------

def compress_image_to_bytes(
    image_input: Any,
    max_dimension: int = 1080,
    quality: int = 80,
    output_format: str = "JPEG"
) -> bytes:
    """
    High-performance image compression using Pillow:
    - Downscales large desktop/camera images preserving aspect ratio.
    - Strips heavy EXIF metadata.
    - Compresses to high-efficiency JPEG or WebP bytes buffer.
    """
    if isinstance(image_input, str):
        img = Image.open(image_input)
    elif isinstance(image_input, (bytes, bytearray)):
        img = Image.open(io.BytesIO(image_input))
    elif isinstance(image_input, Image.Image):
        img = image_input
    else:
        raise ValueError(f"Unsupported image input type: {type(image_input)}")

    # Convert to RGB if RGBA/Palette and saving as JPEG
    if output_format.upper() in ["JPEG", "JPG"]:
        if img.mode in ("RGBA", "LA", "P"):
            background = Image.new("RGB", img.size, (255, 255, 255))
            if img.mode == "P":
                img = img.convert("RGBA")
            background.paste(img, mask=img.split()[-1] if img.mode in ("RGBA", "LA") else None)
            img = background
        elif img.mode != "RGB":
            img = img.convert("RGB")

    # Resize if exceeding max_dimension
    width, height = img.size
    if max(width, height) > max_dimension:
        ratio = max_dimension / max(width, height)
        new_size = (int(width * ratio), int(height * ratio))
        img = img.resize(new_size, Image.Resampling.LANCZOS)

    output_buffer = io.BytesIO()
    img.save(
        output_buffer,
        format=output_format,
        quality=quality,
        optimize=True
    )
    return output_buffer.getvalue()


def upload_product_image_and_get_url(
    local_path: str,
    shop_id: str,
    product_id: str,
    make_public: bool = True
) -> str:
    """
    Core Pipeline Function:
    1. Validates local file existence.
    2. Compresses desktop image to lightweight JPEG via Pillow.
    3. Uploads to Firebase Storage path `tenants/{shop_id}/products/{product_id}.jpg`.
    4. Makes blob publicly accessible and constructs clean HTTPS CDN URL.
    5. Saves ONLY the lightweight HTTPS URL in Firestore `users/{shop_id}/products/{product_id}`.
    6. Returns the HTTPS URL string.
    """
    if not os.path.exists(local_path):
        raise FileNotFoundError(f"Local image file not found at path: {local_path}")

    # Step 1: Compress image
    compressed_bytes = compress_image_to_bytes(local_path, max_dimension=1080, quality=80, output_format="JPEG")
    blob_path = f"tenants/{shop_id}/products/{product_id}.jpg"

    bucket = get_storage_bucket()
    if not bucket:
        # Fallback simulation URL if Firebase Storage bucket not yet configured in local test mode
        logger.warning(f"[FirebaseConfig] Storage bucket not initialized. Using simulated HTTPS storage URL.")
        simulated_url = f"https://storage.googleapis.com/ai-shop-storage/tenants/{shop_id}/products/{product_id}.jpg"
        # Update Firestore with URL
        upsert_tenant_product(shop_id, product_id, {"image_url": simulated_url})
        return simulated_url

    # Step 2: Upload to Cloud Storage
    blob = bucket.blob(blob_path)
    blob.upload_from_string(
        compressed_bytes,
        content_type="image/jpeg"
    )

    # Step 3: Make publicly accessible or get public URL
    if make_public:
        try:
            blob.make_public()
            public_url = blob.public_url
        except Exception:
            public_url = f"https://storage.googleapis.com/{bucket.name}/{blob_path}"
    else:
        public_url = f"https://storage.googleapis.com/{bucket.name}/{blob_path}"

    # Step 4: Persist URL in Firestore (optimizing database size and costs)
    upsert_tenant_product(shop_id, product_id, {"image_url": public_url})

    logger.info(f"[FirebaseConfig] Uploaded & compressed product image for {product_id} -> {public_url}")
    return public_url
