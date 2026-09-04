"""
notification_manager.py
=======================
Isolated Notification, Order Extraction, Abuse Escalation & Silent API Limit Module
for the AI Shop Agent Windows Desktop Suite.

Features:
1. SQLite Persistence (`notifications.db`):
   - Categorized records: 'order', 'abuse', 'system'
   - Timestamping, read/unread states, customer details, and metadata.
2. Background Interceptors & Intelligence:
   - Automatic Order Detection: Extracts phone numbers & shipping addresses from chat messages.
   - Abuse & Threat Detection: Flags severe profanity, harassment, or abusive tone for human escalation.
   - Silent 429 Quota & API Error Interceptor: Catches Gemini API exceptions without leaking error messages to social media clients.
3. Desktop GUI Integration:
   - Notification Bell with dynamic unread counter badge.
   - 3-Tab Categorized Modal Panel:
     * Tab 1: Orders (Customer Name, Platform, Phone, Address, Time)
     * Tab 2: Abusive / Escalated Chats (Customer Name, Platform, Message Snippet)
     * Tab 3: System / API Alerts (API Quota Errors, Connection issues)
"""

import os
import re
import json
import sqlite3
import uuid
from datetime import datetime
from typing import Dict, Any, List, Optional, Tuple

try:
    import customtkinter as ctk
    CTK_AVAILABLE = True
    TK_AVAILABLE = True
    WidgetBase = ctk.CTkFrame
    ToplevelBase = ctk.CTkToplevel
except ImportError:
    try:
        import tkinter as tk
        from tkinter import ttk, messagebox
        CTK_AVAILABLE = False
        TK_AVAILABLE = True
        WidgetBase = tk.Frame
        ToplevelBase = tk.Toplevel
    except ImportError:
        CTK_AVAILABLE = False
        TK_AVAILABLE = False
        WidgetBase = object
        ToplevelBase = object


# Default database location
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DEFAULT_DB_PATH = os.path.join(BASE_DIR, "notifications.db")


# -----------------------------------------------------------------------------
# 1. SQLite Storage & Notification Manager Engine
# -----------------------------------------------------------------------------
class NotificationManager:
    """
    Central notification manager handling local SQLite persistence,
    order extraction, abuse filtering, and silent quota exception capture.
    """

    def __init__(self, db_path: str = DEFAULT_DB_PATH):
        self.db_path = db_path
        self._init_db()

    def _get_conn(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    def _init_db(self):
        """Initializes notifications table schema."""
        conn = self._get_conn()
        cur = conn.cursor()
        cur.execute("""
            CREATE TABLE IF NOT EXISTS notifications (
                id TEXT PRIMARY KEY,
                tenant_id TEXT DEFAULT 'default',
                category TEXT NOT NULL, /* 'order', 'abuse', 'system' */
                title TEXT NOT NULL,
                customer_name TEXT DEFAULT '',
                platform TEXT DEFAULT '',
                phone TEXT DEFAULT '',
                address TEXT DEFAULT '',
                message_snippet TEXT DEFAULT '',
                details_json TEXT DEFAULT '{}',
                is_read INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        conn.commit()

        # Seed sample notifications if table is newly created
        cur.execute("SELECT COUNT(*) FROM notifications")
        if cur.fetchone()[0] == 0:
            self._seed_initial_demo_notifications(conn)

        conn.close()

    def _seed_initial_demo_notifications(self, conn: sqlite3.Connection):
        """Seeds initial realistic sample records for first-time desktop launch."""
        cur = conn.cursor()
        samples = [
            (
                f"notif_{uuid.uuid4().hex[:8]}",
                "default",
                "order",
                "New Order Confirmed",
                "Tanvir Ahmed",
                "WhatsApp Business",
                "+8801712345678",
                "House #42, Road #11, Sector #4, Uttara, Dhaka",
                "Navy Blue Velvet Panjabi (Size L). Delivery please.",
                json.dumps({"order_value": 3850, "item": "Royal Velvet Panjabi", "qty": 1}),
                0,
                datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            ),
            (
                f"notif_{uuid.uuid4().hex[:8]}",
                "default",
                "abuse",
                "Customer Escalation Flagged",
                "Rahim Chowdhury",
                "Facebook Messenger",
                "",
                "",
                "Apnader service ekdom faltu! Fraud shop, ekhono parcel ashe nai keno? Case korbo!",
                json.dumps({"severity": "high", "flag_reason": "Aggressive profanity & legal threat"}),
                0,
                datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            ),
            (
                f"notif_{uuid.uuid4().hex[:8]}",
                "default",
                "system",
                "⚠️ AI টোকেন বা ব্যবহারের লিমিট শেষ হয়েছে",
                "সিস্টেম নোটিশ",
                "Gemini AI Engine",
                "",
                "",
                "আপনার AI চ্যাটবটের ব্যবহারের লিমিট বা টোকেন শেষ হয়ে গিয়েছে। চ্যাটবট সচল করতে আপনার প্যাকেজ বা API Key আপডেট করুন অথবা সফটওয়্যার কোম্পানির সাথে কথা বলুন।",
                json.dumps({"error_code": "429_QUOTA_EXCEEDED", "silent_handled": True}),
                0,
                datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            )
        ]
        cur.executemany("""
            INSERT INTO notifications 
            (id, tenant_id, category, title, customer_name, platform, phone, address, message_snippet, details_json, is_read, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, samples)
        conn.commit()

    # -------------------------------------------------------------------------
    # Record Insertion Helpers
    # -------------------------------------------------------------------------
    def record_order(
        self,
        customer_name: str,
        platform: str,
        phone: str,
        address: str,
        raw_message: str = "",
        details: Optional[Dict[str, Any]] = None,
        tenant_id: str = "default"
    ) -> str:
        """Saves a detected customer order event quietly into notifications.db."""
        notif_id = f"notif_ord_{uuid.uuid4().hex[:8]}"
        conn = self._get_conn()
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO notifications (id, tenant_id, category, title, customer_name, platform, phone, address, message_snippet, details_json, is_read)
            VALUES (?, ?, 'order', ?, ?, ?, ?, ?, ?, ?, 0)
        """, (
            notif_id,
            tenant_id,
            f"Order: {customer_name}",
            customer_name or "Valued Customer",
            platform or "Social Chat",
            phone or "N/A",
            address or "N/A",
            raw_message[:280] if raw_message else "Order details received",
            json.dumps(details or {})
        ))
        conn.commit()
        conn.close()
        return notif_id

    def record_abuse(
        self,
        customer_name: str,
        platform: str,
        message_snippet: str,
        severity: str = "high",
        tenant_id: str = "default"
    ) -> str:
        """Flags severe negative/abusive language and pushes an escalation alert."""
        notif_id = f"notif_abs_{uuid.uuid4().hex[:8]}"
        conn = self._get_conn()
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO notifications (id, tenant_id, category, title, customer_name, platform, message_snippet, details_json, is_read)
            VALUES (?, ?, 'abuse', ?, ?, ?, ?, ?, 0)
        """, (
            notif_id,
            tenant_id,
            f"Escalation: {customer_name}",
            customer_name or "User",
            platform or "Social Chat",
            message_snippet[:300],
            json.dumps({"severity": severity, "detected_at": datetime.now().isoformat()})
        ))
        conn.commit()
        conn.close()
        return notif_id

    def record_system_alert(
        self,
        title: str,
        error_message: str,
        error_code: str = "429_QUOTA",
        tenant_id: str = "default"
    ) -> str:
        """Silently logs Gemini API rate limit (429) or connection alerts."""
        notif_id = f"notif_sys_{uuid.uuid4().hex[:8]}"
        conn = self._get_conn()
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO notifications (id, tenant_id, category, title, customer_name, platform, message_snippet, details_json, is_read)
            VALUES (?, ?, 'system', ?, 'System Guardian', 'Gemini AI Gateway', ?, ?, 0)
        """, (
            notif_id,
            tenant_id,
            title,
            error_message[:400],
            json.dumps({"error_code": error_code, "timestamp": datetime.now().isoformat()})
        ))
        conn.commit()
        conn.close()
        return notif_id

    # Friendly aliases for recording
    add_order_notification = record_order
    add_abuse_notification = record_abuse
    add_system_alert = record_system_alert

    # -------------------------------------------------------------------------
    # Retrieval & Status Management
    # -------------------------------------------------------------------------
    def get_notifications(
        self,
        category: Optional[str] = None,
        unread_only: bool = False,
        tenant_id: Optional[str] = None,
        limit: int = 100
    ) -> List[Dict[str, Any]]:
        """Retrieves notifications filtered by category, read status, or tenant."""
        conn = self._get_conn()
        cur = conn.cursor()
        query = "SELECT * FROM notifications WHERE 1=1"
        params = []

        if category and category != "all":
            query += " AND category = ?"
            params.append(category)

        if unread_only:
            query += " AND is_read = 0"

        if tenant_id and tenant_id != "all":
            query += " AND (tenant_id = ? OR tenant_id = 'default')"
            params.append(tenant_id)

        query += " ORDER BY created_at DESC LIMIT ?"
        params.append(limit)

        cur.execute(query, params)
        rows = cur.fetchall()
        conn.close()

        items = []
        for r in rows:
            d = dict(r)
            try:
                d["details"] = json.loads(d.get("details_json") or "{}")
            except Exception:
                d["details"] = {}
            items.append(d)
        return items

    def get_unread_count(self, tenant_id: Optional[str] = None, category: Optional[str] = None) -> int:
        """Returns the total number of unread notifications."""
        conn = self._get_conn()
        cur = conn.cursor()
        query = "SELECT COUNT(*) FROM notifications WHERE is_read = 0"
        params = []

        if category and category != "all":
            query += " AND category = ?"
            params.append(category)

        if tenant_id and tenant_id != "all":
            query += " AND (tenant_id = ? OR tenant_id = 'default')"
            params.append(tenant_id)

        cur.execute(query, params)
        count = cur.fetchone()[0]
        conn.close()
        return count

    def get_unread_counts(self, tenant_id: Optional[str] = None) -> Dict[str, int]:
        """Returns broken-down unread counts per tab category and total."""
        orders = self.get_unread_count(tenant_id=tenant_id, category="order")
        abuse = self.get_unread_count(tenant_id=tenant_id, category="abuse")
        system = self.get_unread_count(tenant_id=tenant_id, category="system")
        total = orders + abuse + system
        return {
            "total": total,
            "order": orders,
            "orders": orders,
            "abuse": abuse,
            "system": system,
        }

    def mark_as_read(self, notification_id: str):
        conn = self._get_conn()
        cur = conn.cursor()
        cur.execute("UPDATE notifications SET is_read = 1 WHERE id = ?", (notification_id,))
        conn.commit()
        conn.close()

    def mark_all_as_read(self, category: Optional[str] = None, tenant_id: Optional[str] = None):
        conn = self._get_conn()
        cur = conn.cursor()
        query = "UPDATE notifications SET is_read = 1 WHERE 1=1"
        params = []
        if category and category != "all":
            query += " AND category = ?"
            params.append(category)
        if tenant_id and tenant_id != "all":
            query += " AND (tenant_id = ? OR tenant_id = 'default')"
            params.append(tenant_id)
        cur.execute(query, params)
        conn.commit()
        conn.close()

    def clear_notifications(self, category: Optional[str] = None, tenant_id: Optional[str] = None):
        conn = self._get_conn()
        cur = conn.cursor()
        query = "DELETE FROM notifications WHERE 1=1"
        params = []
        if category and category != "all":
            query += " AND category = ?"
            params.append(category)
        if tenant_id and tenant_id != "all":
            query += " AND (tenant_id = ? OR tenant_id = 'default')"
            params.append(tenant_id)
        cur.execute(query, params)
        conn.commit()
        conn.close()

    def delete_notification(self, notification_id: str):
        """Deletes a single notification by its ID."""
        conn = self._get_conn()
        cur = conn.cursor()
        cur.execute("DELETE FROM notifications WHERE id = ?", (notification_id,))
        conn.commit()
        conn.close()


# Singleton global manager instance for zero-config imports
notification_manager = NotificationManager()


# -----------------------------------------------------------------------------
# 2. Intelligence & Regex Extractors (Order & Abuse Detection)
# -----------------------------------------------------------------------------
PHONE_PATTERN = re.compile(r'(?:\+?880|0)?1[3-9]\d{8}\b')
ADDRESS_KEYWORDS = [
    "house", "road", "block", "sector", "flat", "avenue", "lane",
    "dhaka", "chittagong", "sylhet", "rajshahi", "khulna", "barishal", "rangpur", "mymensingh", "comilla", "gazipur", "narayanganj",
    "uttara", "mirpur", "dhanmondi", "gulshan", "banani", "mohammadpur", "badda", "motijheel", "bashundhara", "wari",
    "thana", "zilla", "district", "post code", "holding",
    "বাসা", "রোড", "সেক্টর", "ব্লক", "ঢাকা", "চট্টগ্রাম", "ঠিকানা", "থানা", "জেলা"
]

ABUSE_KEYWORDS = [
    # English
    "scam", "scammer", "fraud", "cheat", "bastard", "idiot", "stupid", "sue you", "police", "court case", "lawyer",
    # Banglish & Bengali
    "faltu", "batpar", "batpari", "chora", "chor", "dhokabaj", "harami", "madarchod", "bokachoda", "kutta",
    "dhandabaaz", "case korbo", "police e jabo", "report korbo", "foul", "fokir", "bogus"
]


def detect_order_info(text: str) -> Optional[Dict[str, str]]:
    """
    Scans a message for phone numbers and delivery address indications.
    Returns dict with extracted phone and address if both or phone is present.
    """
    if not text:
        return None

    # 1. Phone extraction
    phones = PHONE_PATTERN.findall(text)
    found_phone = phones[0] if phones else None

    # 2. Address keyword heuristic
    text_lower = text.lower()
    has_address = any(kw in text_lower for kw in ADDRESS_KEYWORDS)

    if found_phone:
        # Extract address line heuristic
        address_snippet = text
        if has_address:
            # Clean up snippet
            address_snippet = text.strip()
        return {
            "phone": found_phone,
            "address": address_snippet if has_address else "Address provided in chat context",
            "is_complete_order": bool(found_phone and has_address)
        }
    elif has_address and len(text) > 20:
        return {
            "phone": "Pending Confirmation",
            "address": text.strip(),
            "is_complete_order": False
        }

    return None


def detect_abuse(text: str) -> bool:
    """
    Flags abusive, threatening, or severe escalation customer messages.
    """
    if not text:
        return False
    text_lower = text.lower()
    for kw in ABUSE_KEYWORDS:
        if kw in text_lower:
            return True
    return False


# -----------------------------------------------------------------------------
# 3. Silent Gemini Quota / Error Interceptor Wrapper
# -----------------------------------------------------------------------------
def safe_gemini_call(
    agent_func,
    *args,
    tenant_id: str = "default",
    platform: str = "Facebook Messenger",
    customer_name: str = "Customer",
    customer_message: str = "",
    **kwargs
) -> Dict[str, Any]:
    """
    Strict try-except wrapper around Gemini API calls.
    Catches 429 QuotaExceeded or Connection errors silently:
    - Never forwards raw technical errors to customers on social media.
    - Immediately saves an alert into `notifications.db`.
    - Returns a graceful fallback response.
    """
    try:
        # Check for order detection before/during call
        if customer_message:
            order_info = detect_order_info(customer_message)
            if order_info and order_info.get("phone"):
                notification_manager.record_order(
                    customer_name=customer_name,
                    platform=platform,
                    phone=order_info["phone"],
                    address=order_info.get("address", ""),
                    raw_message=customer_message,
                    tenant_id=tenant_id
                )

            # Check for abuse detection
            if detect_abuse(customer_message):
                notification_manager.record_abuse(
                    customer_name=customer_name,
                    platform=platform,
                    message_snippet=customer_message,
                    severity="high",
                    tenant_id=tenant_id
                )

        # Execute the agent call
        result = agent_func(*args, **kwargs)
        return result

    except Exception as e:
        err_str = str(e)
        is_quota_429 = "429" in err_str or "ResourceExhausted" in err_str or "quota" in err_str.lower()

        if is_quota_429:
            # 1. Silently record 429 Quota Alert into notifications.db
            notification_manager.record_system_alert(
                title="Gemini API Quota Exceeded (HTTP 429)",
                error_message=f"Rate limit or quota threshold reached on Gemini API. Error: {err_str[:250]}",
                error_code="429_QUOTA_EXCEEDED",
                tenant_id=tenant_id
            )
        else:
            # General Connection Error
            notification_manager.record_system_alert(
                title="Gemini API Connection Issue",
                error_message=f"Unexpected AI Gateway error: {err_str[:250]}",
                error_code="500_API_EXCEPTION",
                tenant_id=tenant_id
            )

        # 2. Return clean, polite customer fallback (DO NOT leak error text to social media)
        return {
            "reply": "Thank you for reaching out! We are currently checking our inventory and will assist you shortly. Please share any specific requirements you have!",
            "retrieved_products": [],
            "latency_ms": 120,
            "model": "rule-based-silent-fallback",
            "guardrail_applied": True,
            "quota_handled_silently": True
        }


# -------------------------------------------------------------
# 4. CustomTkinter Desktop GUI Components (Bell Badge & 3-Tab Modal)
# -------------------------------------------------------------
class NotificationBellWidget(WidgetBase):
    """
    Interactive Notification Bell Icon with dynamic red counter badge.
    Designed for embedding directly in the top header or sidebar next to Webhook Status.
    """

    def __init__(self, master=None, tenant_id: str = "default", on_click_callback=None, **kwargs):
        if CTK_AVAILABLE:
            super().__init__(master, fg_color="transparent", **kwargs)
            self.tenant_id = tenant_id
            self.on_click_callback = on_click_callback
            self._build_ui()
            self.refresh_badge()
        else:
            self.tenant_id = tenant_id
            self.on_click_callback = on_click_callback

    def _build_ui(self):
        if not CTK_AVAILABLE:
            return
        # Container
        self.btn_frame = ctk.CTkFrame(self, fg_color="#27272a", corner_radius=8, cursor="hand2")
        self.btn_frame.pack(side="left", padx=2, pady=2)
        self.btn_frame.bind("<Button-1>", lambda e: self._handle_click())

        # Bell Icon Button
        self.bell_lbl = ctk.CTkLabel(
            self.btn_frame,
            text="🔔 Notifications",
            font=ctk.CTkFont(size=12, weight="bold"),
            text_color="#f8fafc"
        )
        self.bell_lbl.pack(side="left", padx=(8, 4), pady=4)
        self.bell_lbl.bind("<Button-1>", lambda e: self._handle_click())

        # Red Badge Counter
        self.badge_lbl = ctk.CTkLabel(
            self.btn_frame,
            text="0",
            font=ctk.CTkFont(size=10, weight="bold"),
            fg_color="#ef4444",
            text_color="#ffffff",
            corner_radius=10,
            width=20,
            height=20
        )
        self.badge_lbl.pack(side="left", padx=(0, 6), pady=4)
        self.badge_lbl.bind("<Button-1>", lambda e: self._handle_click())

    def _handle_click(self):
        if not CTK_AVAILABLE:
            return
        if self.on_click_callback:
            self.on_click_callback()
        else:
            NotificationModal(self.winfo_toplevel(), tenant_id=self.tenant_id, on_close=self.refresh_badge)

    def refresh_badge(self):
        """Updates the badge count dynamically from SQLite."""
        if not CTK_AVAILABLE:
            return
        try:
            unread = notification_manager.get_unread_count(tenant_id=self.tenant_id)
            if unread > 0:
                self.badge_lbl.configure(text=str(unread), fg_color="#ef4444")
                self.btn_frame.configure(fg_color="#3f3f46")
            else:
                self.badge_lbl.configure(text="0", fg_color="#475569")
                self.btn_frame.configure(fg_color="#27272a")
        except Exception:
            pass


class NotificationModal(ToplevelBase):
    """
    3-Tab Notification Center Modal / Side Panel:
    - Tab 1: Orders (Customer Name, Platform, Phone, Address, Time)
    - Tab 2: Abusive / Escalated Chats (Customer Name, Platform, Message Snippet)
    - Tab 3: System / API Alerts (API Quota Errors, Connection issues)
    """

    def __init__(self, parent=None, tenant_id: str = "default", on_close=None):
        if not CTK_AVAILABLE:
            return
        super().__init__(parent)
        self.tenant_id = tenant_id
        self.on_close_callback = on_close

        self.title("Store Notifications & Escalation Center")
        self.geometry("780x620")
        self.minsize(680, 520)
        self.attributes("-topmost", True)

        self.active_tab = "all"
        self._build_ui()
        self._load_tab_content()

    def _build_ui(self):
        # Header Bar
        header = ctk.CTkFrame(self, fg_color="#18181b", height=60, corner_radius=0)
        header.pack(fill="x", side="top")

        title_box = ctk.CTkFrame(header, fg_color="transparent")
        title_box.pack(side="left", padx=18, pady=12)

        ctk.CTkLabel(
            title_box,
            text="🔔 Notifications & Alert Center",
            font=ctk.CTkFont(size=17, weight="bold"),
            text_color="#38bdf8"
        ).pack(anchor="w")

        ctk.CTkLabel(
            title_box,
            text="Real-time order extractions, abusive chat escalations & silent Gemini 429 quota alerts",
            font=ctk.CTkFont(size=11),
            text_color="#94a3b8"
        ).pack(anchor="w")

        # Top Action Buttons
        btn_box = ctk.CTkFrame(header, fg_color="transparent")
        btn_box.pack(side="right", padx=16, pady=12)

        mark_all_btn = ctk.CTkButton(
            btn_box,
            text="✓ Mark View as Read",
            height=30,
            font=ctk.CTkFont(size=11, weight="bold"),
            fg_color="#2563eb",
            hover_color="#1d4ed8",
            command=self._mark_current_tab_read
        )
        mark_all_btn.pack(side="left", padx=4)

        clear_btn = ctk.CTkButton(
            btn_box,
            text="🗑 Clear View",
            height=30,
            font=ctk.CTkFont(size=11),
            fg_color="#3f3f46",
            hover_color="#dc2626",
            command=self._clear_current_tab
        )
        clear_btn.pack(side="left", padx=4)

        # Tab Navigation Ribbon (Categorized with All default)
        nav_frame = ctk.CTkFrame(self, fg_color="#09090b", height=46, corner_radius=0)
        nav_frame.pack(fill="x", padx=16, pady=(12, 6))

        self.tab_buttons = {}
        tabs_meta = [
            ("all", "📋 All Notifications", "#38bdf8"),
            ("order", "📦 Orders", "#10b981"),
            ("abuse", "⚠️ Abusive / Escalated", "#f59e0b"),
            ("system", "⚡ System / API Alerts", "#ef4444"),
        ]

        for cat_key, cat_label, cat_color in tabs_meta:
            btn = ctk.CTkButton(
                nav_frame,
                text=cat_label,
                height=36,
                font=ctk.CTkFont(size=12, weight="bold"),
                fg_color="#1e293b" if self.active_tab == cat_key else "transparent",
                hover_color="#334155",
                command=lambda k=cat_key: self._switch_tab(k)
            )
            btn.pack(side="left", expand=True, fill="x", padx=4, pady=4)
            self.tab_buttons[cat_key] = btn

        # Scrollable Notifications List Container
        self.list_container = ctk.CTkScrollableFrame(self, fg_color="#09090b")
        self.list_container.pack(fill="both", expand=True, padx=16, pady=(0, 16))

        # Bottom Quick Test Trigger Bar
        test_bar = ctk.CTkFrame(self, fg_color="#18181b", height=44, corner_radius=0)
        test_bar.pack(fill="x", side="bottom")

        ctk.CTkLabel(test_bar, text="Quick Simulator:", font=ctk.CTkFont(size=11), text_color="#64748b").pack(side="left", padx=12)

        t1 = ctk.CTkButton(
            test_bar,
            text="+ Test Order Event",
            height=26,
            font=ctk.CTkFont(size=10),
            fg_color="#059669",
            command=self._sim_order
        )
        t1.pack(side="left", padx=4)

        t2 = ctk.CTkButton(
            test_bar,
            text="+ Test Abuse Flag",
            height=26,
            font=ctk.CTkFont(size=10),
            fg_color="#d97706",
            command=self._sim_abuse
        )
        t2.pack(side="left", padx=4)

        t3 = ctk.CTkButton(
            test_bar,
            text="+ Test 429 Quota Alert",
            height=26,
            font=ctk.CTkFont(size=10),
            fg_color="#dc2626",
            command=self._sim_quota
        )
        t3.pack(side="left", padx=4)

    def _switch_tab(self, tab_key: str):
        self.active_tab = tab_key
        for k, btn in self.tab_buttons.items():
            btn.configure(fg_color="#1e293b" if k == tab_key else "transparent")
        self._load_tab_content()

    def _load_tab_content(self):
        for w in self.list_container.winfo_children():
            w.destroy()

        notifs = notification_manager.get_notifications(
            category=self.active_tab,
            tenant_id=self.tenant_id,
            limit=50
        )

        if not notifs:
            empty_box = ctk.CTkFrame(self.list_container, fg_color="transparent")
            empty_box.pack(pady=60)
            icon = "📦" if self.active_tab == "order" else "⚠️" if self.active_tab == "abuse" else "⚡"
            ctk.CTkLabel(empty_box, text=f"{icon} No notifications in this tab.", font=ctk.CTkFont(size=14, weight="bold"), text_color="#94a3b8").pack()
            ctk.CTkLabel(empty_box, text="New background events will automatically populate here.", font=ctk.CTkFont(size=12), text_color="#64748b").pack(pady=4)
            return

        for item in notifs:
            is_unread = item.get("is_read") == 0
            card = ctk.CTkFrame(
                self.list_container,
                fg_color="#18181b" if not is_unread else "#1e293b",
                border_width=1 if is_unread else 0,
                border_color="#3b82f6" if is_unread else "#27272a",
                corner_radius=10
            )
            card.pack(fill="x", pady=5, padx=2)

            # Card Header
            card_head = ctk.CTkFrame(card, fg_color="transparent")
            card_head.pack(fill="x", padx=14, pady=(10, 4))

            # Title & Status Tag
            tag_color = "#10b981" if self.active_tab == "order" else "#f59e0b" if self.active_tab == "abuse" else "#ef4444"
            cat_name = "ORDER" if self.active_tab == "order" else "ESCALATION" if self.active_tab == "abuse" else "SYSTEM 429"

            ctk.CTkLabel(
                card_head,
                text=f"[{cat_name}] {item['title']}",
                font=ctk.CTkFont(size=13, weight="bold"),
                text_color=tag_color
            ).pack(side="left")

            if is_unread:
                ctk.CTkLabel(
                    card_head,
                    text="● NEW UNREAD",
                    font=ctk.CTkFont(size=10, weight="bold"),
                    text_color="#60a5fa"
                ).pack(side="left", padx=8)

            time_str = item.get("created_at", "")
            
            # Action controls on header
            action_box = ctk.CTkFrame(card_head, fg_color="transparent")
            action_box.pack(side="right")

            del_item_btn = ctk.CTkButton(
                action_box,
                text="🗑",
                width=24,
                height=22,
                font=ctk.CTkFont(size=10),
                fg_color="transparent",
                hover_color="#450a0a",
                text_color="#94a3b8",
                command=lambda nid=item["id"]: self._delete_single_notif(nid)
            )
            del_item_btn.pack(side="right", padx=(4, 0))

            ctk.CTkLabel(
                action_box,
                text=f"🕒 {time_str}",
                font=ctk.CTkFont(size=10),
                text_color="#94a3b8"
            ).pack(side="right")

            # Card Details based on category
            body = ctk.CTkFrame(card, fg_color="transparent")
            body.pack(fill="x", padx=14, pady=(0, 10))

            if self.active_tab == "order":
                # Tab 1: Orders (Customer Name, Platform, Phone, Address, Time)
                grid = ctk.CTkFrame(body, fg_color="#09090b", corner_radius=6)
                grid.pack(fill="x", pady=4)

                r1 = ctk.CTkFrame(grid, fg_color="transparent")
                r1.pack(fill="x", padx=10, pady=4)
                ctk.CTkLabel(r1, text=f"👤 Customer: {item.get('customer_name') or 'Customer'}", font=ctk.CTkFont(size=12, weight="bold"), text_color="#f8fafc").pack(side="left")
                ctk.CTkLabel(r1, text=f"📱 Platform: {item.get('platform') or 'Social'}", font=ctk.CTkFont(size=11), text_color="#38bdf8").pack(side="right")

                r2 = ctk.CTkFrame(grid, fg_color="transparent")
                r2.pack(fill="x", padx=10, pady=2)
                ctk.CTkLabel(r2, text=f"📞 Phone: {item.get('phone') or 'N/A'}", font=ctk.CTkFont(size=12, weight="bold"), text_color="#4ade80").pack(side="left")

                r3 = ctk.CTkFrame(grid, fg_color="transparent")
                r3.pack(fill="x", padx=10, pady=(2, 6))
                ctk.CTkLabel(r3, text=f"📍 Address: {item.get('address') or 'N/A'}", font=ctk.CTkFont(size=11), text_color="#cbd5e1", wraplength=580, justify="left").pack(anchor="w")

                if item.get("message_snippet"):
                    ctk.CTkLabel(body, text=f"💬 Customer Chat: \"{item['message_snippet']}\"", font=ctk.CTkFont(size=11), text_color="#94a3b8", wraplength=580, justify="left").pack(anchor="w", pady=(4, 0))

            elif self.active_tab == "abuse":
                # Tab 2: Abusive / Escalated Chats (Customer Name, Platform, Message Snippet)
                grid = ctk.CTkFrame(body, fg_color="#09090b", corner_radius=6)
                grid.pack(fill="x", pady=4)

                r1 = ctk.CTkFrame(grid, fg_color="transparent")
                r1.pack(fill="x", padx=10, pady=4)
                ctk.CTkLabel(r1, text=f"👤 Customer: {item.get('customer_name') or 'Customer'}", font=ctk.CTkFont(size=12, weight="bold"), text_color="#fca5a5").pack(side="left")
                ctk.CTkLabel(r1, text=f"📱 Platform: {item.get('platform') or 'Social'}", font=ctk.CTkFont(size=11), text_color="#38bdf8").pack(side="right")

                msg_box = ctk.CTkFrame(body, fg_color="#450a0a", corner_radius=6)
                msg_box.pack(fill="x", pady=4)
                ctk.CTkLabel(msg_box, text=f"⚠️ Flagged Message Snippet:\n\"{item.get('message_snippet', '')}\"", font=ctk.CTkFont(size=11), text_color="#fecaca", wraplength=580, justify="left").pack(anchor="w", padx=10, pady=8)

            else:
                # Tab 3: System / API Alerts (API Quota Errors, Connection issues)
                err_box = ctk.CTkFrame(body, fg_color="#09090b", corner_radius=6)
                err_box.pack(fill="x", pady=4)

                ctk.CTkLabel(err_box, text=f"⚙️ Status: Intercepted & Handled Silently (Customer chat remained clean)", font=ctk.CTkFont(size=11, weight="bold"), text_color="#38bdf8").pack(anchor="w", padx=10, pady=(6, 2))
                ctk.CTkLabel(err_box, text=f"Log: {item.get('message_snippet', '')}", font=ctk.CTkFont(size=11), text_color="#e2e8f0", wraplength=580, justify="left").pack(anchor="w", padx=10, pady=(2, 6))

    def _mark_current_tab_read(self):
        notification_manager.mark_all_as_read(category=self.active_tab, tenant_id=self.tenant_id)
        self._load_tab_content()
        if self.on_close_callback:
            self.on_close_callback()

    def _clear_current_tab(self):
        notification_manager.clear_notifications(category=self.active_tab, tenant_id=self.tenant_id)
        self._load_tab_content()
        if self.on_close_callback:
            self.on_close_callback()

    def _delete_single_notif(self, notif_id: str):
        notification_manager.delete_notification(notif_id)
        self._load_tab_content()
        if self.on_close_callback:
            self.on_close_callback()

    def _sim_order(self):
        notification_manager.record_order(
            customer_name="Sabbir Hossain",
            platform="Facebook Messenger",
            phone="+8801822334455",
            address="Plot #7, Road #2, Dhanmondi 27, Dhaka",
            raw_message="Bhaiya 2 ta Kurti order korbo. Delivery address pathalam.",
            tenant_id=self.tenant_id
        )
        self._load_tab_content()
        if self.on_close_callback:
            self.on_close_callback()

    def _sim_abuse(self):
        notification_manager.record_abuse(
            customer_name="Angry Shopper",
            platform="WhatsApp Business",
            message_snippet="Batpar shop! Delivery late keno? Sobai ke report korbo!",
            severity="high",
            tenant_id=self.tenant_id
        )
        self._load_tab_content()
        if self.on_close_callback:
            self.on_close_callback()

    def _sim_quota(self):
        notification_manager.record_system_alert(
            title="Gemini API Quota 429 Intercepted",
            error_message="ResourceExhausted 429: Rate limit exceeded for Gemini API. Clean offline fallback used.",
            error_code="429_QUOTA_EXCEEDED",
            tenant_id=self.tenant_id
        )
        self._load_tab_content()
        if self.on_close_callback:
            self.on_close_callback()
