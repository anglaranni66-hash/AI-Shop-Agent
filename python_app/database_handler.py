"""
database_handler.py
===================
Multi-Tenant Database Engine for AI Shop Agent.
Isolates each shop owner's catalog, settings, and logs into a dedicated SQLite database per tenant:
  - `data/master_users.db`: User authentication & tenant registry.
  - `data/tenants/{tenant_id}/store.db`: Isolated shop database (products, dynamic attributes, social configs, chat logs).
"""

import os
import json
import sqlite3
import hashlib
import uuid
from datetime import datetime
from typing import List, Dict, Any, Optional

DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")
TENANTS_DIR = os.path.join(DATA_DIR, "tenants")
MASTER_DB_PATH = os.path.join(DATA_DIR, "master_users.db")


def hash_password(password: str) -> str:
    """Hashes password using SHA256 with salt for multi-tenant auth."""
    salt = "ai_shop_salt_2025"
    return hashlib.sha256((password + salt).encode("utf-8")).hexdigest()


class DatabaseHandler:
    def __init__(self, tenant_id: Optional[str] = None):
        os.makedirs(DATA_DIR, exist_ok=True)
        os.makedirs(TENANTS_DIR, exist_ok=True)
        self._init_master_db()
        self.tenant_id = tenant_id
        if self.tenant_id:
            self._init_tenant_db(self.tenant_id)

    # -------------------------------------------------------------
    # 1. Master DB (User Authentication & Multi-Tenancy)
    # -------------------------------------------------------------
    def _get_master_conn(self) -> sqlite3.Connection:
        conn = sqlite3.connect(MASTER_DB_PATH)
        conn.row_factory = sqlite3.Row
        return conn

    def _init_master_db(self):
        conn = self._get_master_conn()
        cursor = conn.cursor()
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                shop_name TEXT NOT NULL,
                email TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                business_category TEXT DEFAULT 'General',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        conn.commit()

        # Seed default demo account if empty
        cursor.execute("SELECT COUNT(*) FROM users")
        if cursor.fetchone()[0] == 0:
            demo_id = "tenant_fashion_01"
            cursor.execute("""
                INSERT INTO users (id, shop_name, email, password_hash, business_category)
                VALUES (?, ?, ?, ?, ?)
            """, (demo_id, "Glamour Velvet Boutique", "owner@glamour.com", hash_password("admin123"), "Fashion & Apparel"))
            conn.commit()
            self._init_tenant_db(demo_id)
            self._seed_demo_products(demo_id, "fashion")

            demo_food_id = "tenant_food_02"
            cursor.execute("""
                INSERT INTO users (id, shop_name, email, password_hash, business_category)
                VALUES (?, ?, ?, ?, ?)
            """, (demo_food_id, "Dhaka Fresh Organics & Gourmet", "contact@dhakafresh.com", hash_password("admin123"), "Food & Grocery"))
            conn.commit()
            self._init_tenant_db(demo_food_id)
            self._seed_demo_products(demo_food_id, "food")

        conn.close()

    def register_user(self, shop_name: str, email: str, password: str, business_category: str = "General") -> Dict[str, Any]:
        """Registers a new shop owner and creates an isolated database for them."""
        conn = self._get_master_conn()
        cursor = conn.cursor()
        try:
            user_id = f"tenant_{uuid.uuid4().hex[:10]}"
            pwd_hash = hash_password(password)
            cursor.execute("""
                INSERT INTO users (id, shop_name, email, password_hash, business_category)
                VALUES (?, ?, ?, ?, ?)
            """, (user_id, shop_name, email.strip().lower(), pwd_hash, business_category))
            conn.commit()
            # Initialize isolated tenant database
            self._init_tenant_db(user_id)
            return {"success": True, "user_id": user_id, "shop_name": shop_name, "email": email}
        except sqlite3.IntegrityError:
            return {"success": False, "error": "An account with this email already exists."}
        except Exception as e:
            return {"success": False, "error": str(e)}
        finally:
            conn.close()

    def login_user(self, email: str, password: str) -> Dict[str, Any]:
        """Authenticates user and assigns the session to their tenant database."""
        conn = self._get_master_conn()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM users WHERE email = ?", (email.strip().lower(),))
        row = cursor.fetchone()
        conn.close()

        if not row:
            return {"success": False, "error": "Invalid email or password."}

        pwd_hash = hash_password(password)
        if row["password_hash"] != pwd_hash:
            return {"success": False, "error": "Invalid email or password."}

        user_id = row["id"]
        self.tenant_id = user_id
        self._init_tenant_db(user_id)
        return {
            "success": True,
            "user": {
                "id": row["id"],
                "shop_name": row["shop_name"],
                "email": row["email"],
                "business_category": row["business_category"],
                "created_at": row["created_at"]
            }
        }

    # -------------------------------------------------------------
    # 2. Tenant-Specific Isolated Database
    # -------------------------------------------------------------
    def _get_tenant_db_path(self, tenant_id: str) -> str:
        tenant_folder = os.path.join(TENANTS_DIR, tenant_id)
        os.makedirs(tenant_folder, exist_ok=True)
        return os.path.join(tenant_folder, "store.db")

    def _get_tenant_conn(self, tenant_id: Optional[str] = None) -> sqlite3.Connection:
        tid = tenant_id or self.tenant_id
        if not tid:
            raise ValueError("Tenant ID is required to access store database.")
        db_path = self._get_tenant_db_path(tid)
        conn = sqlite3.connect(db_path)
        conn.row_factory = sqlite3.Row
        return conn

    def _init_tenant_db(self, tenant_id: str):
        """Initializes tables inside the user's isolated store.db"""
        conn = self._get_tenant_conn(tenant_id)
        cursor = conn.cursor()

        # Products Table with dynamic JSON attributes
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS products (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                price REAL NOT NULL,
                category TEXT NOT NULL,
                stock INTEGER DEFAULT 10,
                description TEXT,
                image_url TEXT,
                attributes_json TEXT DEFAULT '{}',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        # Social Media Integrations Table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS social_configs (
                platform TEXT PRIMARY KEY,
                is_connected INTEGER DEFAULT 0,
                page_id TEXT DEFAULT '',
                access_token TEXT DEFAULT '',
                verify_token TEXT DEFAULT '',
                webhook_url TEXT DEFAULT '',
                app_secret TEXT DEFAULT '',
                extra_config_json TEXT DEFAULT '{}',
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        # Chat & AI Reply Logs
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS chat_logs (
                id TEXT PRIMARY KEY,
                platform TEXT,
                customer_id TEXT,
                customer_name TEXT,
                incoming_message TEXT,
                incoming_image_url TEXT,
                ai_reply TEXT,
                retrieved_product_ids TEXT,
                latency_ms INTEGER,
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        # Seed social platforms if missing
        platforms = ["facebook", "instagram", "whatsapp", "tiktok"]
        for p in platforms:
            cursor.execute("INSERT OR IGNORE INTO social_configs (platform) VALUES (?)", (p,))

        conn.commit()
        conn.close()

    # -------------------------------------------------------------
    # 3. Product Catalog Operations (Dynamic Schema)
    # -------------------------------------------------------------
    def get_products(self, category_filter: Optional[str] = None, search_query: Optional[str] = None) -> List[Dict[str, Any]]:
        conn = self._get_tenant_conn()
        cursor = conn.cursor()
        query = "SELECT * FROM products WHERE 1=1"
        params = []

        if category_filter and category_filter != "All":
            query += " AND category = ?"
            params.append(category_filter)

        if search_query:
            query += " AND (name LIKE ? OR description LIKE ?)"
            params.extend([f"%{search_query}%", f"%{search_query}%"])

        query += " ORDER BY created_at DESC"
        cursor.execute(query, params)
        rows = cursor.fetchall()
        conn.close()

        products = []
        for r in rows:
            prod = dict(r)
            try:
                prod["attributes"] = json.loads(prod.get("attributes_json") or "{}")
            except Exception:
                prod["attributes"] = {}
            products.append(prod)
        return products

    def get_product_by_id(self, product_id: str) -> Optional[Dict[str, Any]]:
        conn = self._get_tenant_conn()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM products WHERE id = ?", (product_id,))
        row = cursor.fetchone()
        conn.close()
        if not row:
            return None
        prod = dict(row)
        try:
            prod["attributes"] = json.loads(prod.get("attributes_json") or "{}")
        except Exception:
            prod["attributes"] = {}
        return prod

    def add_product(self, name: str, price: float, category: str, stock: int, description: str, image_url: str, attributes: Dict[str, Any]) -> Dict[str, Any]:
        conn = self._get_tenant_conn()
        cursor = conn.cursor()
        product_id = f"prod_{uuid.uuid4().hex[:8]}"
        attr_json = json.dumps(attributes)
        cursor.execute("""
            INSERT INTO products (id, name, price, category, stock, description, image_url, attributes_json)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (product_id, name, float(price), category, int(stock), description, image_url, attr_json))
        conn.commit()
        conn.close()
        return {"success": True, "product_id": product_id}

    def update_product(self, product_id: str, name: str, price: float, category: str, stock: int, description: str, image_url: str, attributes: Dict[str, Any]) -> Dict[str, Any]:
        conn = self._get_tenant_conn()
        cursor = conn.cursor()
        attr_json = json.dumps(attributes)
        cursor.execute("""
            UPDATE products
            SET name = ?, price = ?, category = ?, stock = ?, description = ?, image_url = ?, attributes_json = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        """, (name, float(price), category, int(stock), description, image_url, attr_json, product_id))
        conn.commit()
        conn.close()
        return {"success": True}

    def delete_product(self, product_id: str) -> Dict[str, Any]:
        conn = self._get_tenant_conn()
        cursor = conn.cursor()
        cursor.execute("DELETE FROM products WHERE id = ?", (product_id,))
        conn.commit()
        conn.close()
        return {"success": True}

    # -------------------------------------------------------------
    # 4. Social Media Configs
    # -------------------------------------------------------------
    def get_social_configs(self) -> Dict[str, Dict[str, Any]]:
        conn = self._get_tenant_conn()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM social_configs")
        rows = cursor.fetchall()
        conn.close()
        configs = {}
        for r in rows:
            configs[r["platform"]] = dict(r)
        return configs

    def update_social_config(self, platform: str, is_connected: bool, page_id: str, access_token: str, verify_token: str, webhook_url: str, app_secret: str, extra_config: Optional[Dict] = None) -> Dict[str, Any]:
        conn = self._get_tenant_conn()
        cursor = conn.cursor()
        extra_json = json.dumps(extra_config or {})
        cursor.execute("""
            INSERT INTO social_configs (platform, is_connected, page_id, access_token, verify_token, webhook_url, app_secret, extra_config_json, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(platform) DO UPDATE SET
                is_connected = excluded.is_connected,
                page_id = excluded.page_id,
                access_token = excluded.access_token,
                verify_token = excluded.verify_token,
                webhook_url = excluded.webhook_url,
                app_secret = excluded.app_secret,
                extra_config_json = excluded.extra_config_json,
                updated_at = CURRENT_TIMESTAMP
        """, (platform, 1 if is_connected else 0, page_id, access_token, verify_token, webhook_url, app_secret, extra_json))
        conn.commit()
        conn.close()
        return {"success": True}

    # -------------------------------------------------------------
    # 5. Chat History & Webhook Logs
    # -------------------------------------------------------------
    def log_chat_interaction(self, platform: str, customer_id: str, customer_name: str, incoming_message: str, incoming_image_url: str, ai_reply: str, retrieved_product_ids: List[str], latency_ms: int) -> str:
        conn = self._get_tenant_conn()
        cursor = conn.cursor()
        log_id = f"log_{uuid.uuid4().hex[:8]}"
        prod_ids_str = ",".join(retrieved_product_ids)
        cursor.execute("""
            INSERT INTO chat_logs (id, platform, customer_id, customer_name, incoming_message, incoming_image_url, ai_reply, retrieved_product_ids, latency_ms)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (log_id, platform, customer_id, customer_name, incoming_message, incoming_image_url, ai_reply, prod_ids_str, latency_ms))
        conn.commit()
        conn.close()
        return log_id

    def get_chat_logs(self, limit: int = 50) -> List[Dict[str, Any]]:
        conn = self._get_tenant_conn()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM chat_logs ORDER BY timestamp DESC LIMIT ?", (limit,))
        rows = cursor.fetchall()
        conn.close()
        return [dict(r) for r in rows]

    def get_customer_history(self, customer_id: str, limit: int = 6) -> List[Dict[str, Any]]:
        """Retrieves recent conversation exchanges for a specific customer across sessions."""
        conn = self._get_tenant_conn()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT incoming_message, ai_reply, timestamp
            FROM chat_logs
            WHERE customer_id = ?
            ORDER BY timestamp DESC
            LIMIT ?
        """, (customer_id, limit))
        rows = cursor.fetchall()
        conn.close()
        # Return in chronological order
        return [dict(r) for r in reversed(rows)]

    # -------------------------------------------------------------
    # 6. Demo Data Seeder
    # -------------------------------------------------------------
    def _seed_demo_products(self, tenant_id: str, store_type: str):
        conn = self._get_tenant_conn(tenant_id)
        cursor = conn.cursor()
        if store_type == "fashion":
            products = [
                (
                    "prod_f01",
                    "Royal Embroidered Velvet Panjabi",
                    3850.0,
                    "Clothing",
                    15,
                    "Premium handcrafted navy blue velvet Panjabi with gold zari neckline embroidery. Perfect for wedding and festive occasions.",
                    "https://images.unsplash.com/photo-1597983073493-88cd35cf93b0?w=600&auto=format&fit=crop&q=80",
                    json.dumps({
                        "available_sizes": ["M (40)", "L (42)", "XL (44)", "XXL (46)"],
                        "colors": ["Midnight Navy", "Maroon Crimson", "Emerald Green"],
                        "fabric": "100% Micro Velvet",
                        "fit_type": "Semi-Slim Fit"
                    })
                ),
                (
                    "prod_f02",
                    "Floral Printed Georgette Party Kurti",
                    1890.0,
                    "Clothing",
                    24,
                    "Breathable printed georgette three-piece kurti set with matching chiffon dupatta and soft cotton inner lining.",
                    "https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?w=600&auto=format&fit=crop&q=80",
                    json.dumps({
                        "available_sizes": ["S (36)", "M (38)", "L (40)", "XL (42)"],
                        "colors": ["Pastel Peach", "Sky Blue", "Lilac"],
                        "fabric": "Georgette & Chiffon",
                        "care": "Dry clean or gentle hand wash"
                    })
                ),
                (
                    "prod_f03",
                    "Classic Oversized Graphic Cotton Tee",
                    750.0,
                    "Clothing",
                    50,
                    "220 GSM heavyweight combed organic cotton drop-shoulder streetwear t-shirt with high-density screen print.",
                    "https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=600&auto=format&fit=crop&q=80",
                    json.dumps({
                        "available_sizes": ["M", "L", "XL"],
                        "colors": ["Jet Black", "Cloud White", "Charcoal Gray"],
                        "fabric": "100% Combed Cotton (220 GSM)",
                        "fit_type": "Oversized Streetwear"
                    })
                )
            ]
        else:
            products = [
                (
                    "prod_g01",
                    "Premium Kacchi Dum Biryani Meal Box",
                    480.0,
                    "Food & Gourmet",
                    30,
                    "Authentic aromatic basmati rice cooked with tender mutton chunks, aloo, shahi masala, boiled egg, and complimentary burhani.",
                    "https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=600&auto=format&fit=crop&q=80",
                    json.dumps({
                        "portion_weight": "650g (Serves 1)",
                        "shelf_life": "Consume within 3 hours of delivery",
                        "dietary": "Halal Certified",
                        "allergens": "Contains dairy (ghee), nuts"
                    })
                ),
                (
                    "prod_g02",
                    "Organic Sundarban Raw Wild Honey",
                    950.0,
                    "Grocery",
                    40,
                    "100% pure unprocessed wild flower raw honey directly harvested from deep mangroves of Sundarbans forest.",
                    "https://images.unsplash.com/photo-1587049352846-4a222e784d38?w=600&auto=format&fit=crop&q=80",
                    json.dumps({
                        "net_weight": "500g Glass Jar",
                        "expiry_date": "24 Months from packaging",
                        "grade": "100% Pure Raw Grade A",
                        "storage": "Store at room temperature"
                    })
                ),
                (
                    "prod_g03",
                    "Artisanal Mango Habanero Chili Sauce",
                    320.0,
                    "Condiments",
                    60,
                    "Spicy and tangy slow-simmered hot sauce crafted with ripe seasonal mangoes and fiery habanero peppers.",
                    "https://images.unsplash.com/photo-1590779033100-9f60a05a013d?w=600&auto=format&fit=crop&q=80",
                    json.dumps({
                        "net_weight": "250ml Bottle",
                        "expiry_date": "12 Months (Refrigerate after opening)",
                        "heat_level": "Extra Hot (4/5)",
                        "dietary": "Vegan, Gluten-Free"
                    })
                )
            ]

        for p in products:
            cursor.execute("""
                INSERT OR IGNORE INTO products (id, name, price, category, stock, description, image_url, attributes_json)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, p)
        conn.commit()
        conn.close()
