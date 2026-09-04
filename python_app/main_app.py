"""
main_app.py
===========
AI-Powered Automated Sales & Customer Service Agent Desktop Application for Windows.
Built with CustomTkinter for a modern, sleek Windows 11 native dark/light user experience.

Includes:
1. Multi-Tenant User Authentication & Isolated Database Loader
2. Social Media Connection Panel (Facebook, Instagram, WhatsApp, TikTok)
3. Dynamic Schema Product Catalog Management (Clothing, Food, Electronics, Custom)
4. Smart Gemini 1.5 Auto-Reply & Live Chat Simulator (Banglish, Multimodal Images, Strict Guardrails)
5. Vector Similarity Search Inspector & Webhook Event Monitor
"""

import os
import sys
import json
import threading
from typing import Optional, Dict, Any, List
from PIL import Image, ImageTk

try:
    import customtkinter as ctk
    CTK_AVAILABLE = True
except ImportError:
    import tkinter as tk
    from tkinter import ttk, messagebox
    CTK_AVAILABLE = False

from database_handler import DatabaseHandler
from gemini_agent import GeminiAgent
from vector_db import VectorDatabase
from notification_manager import (
    NotificationBellWidget,
    NotificationModal,
    notification_manager,
    safe_gemini_call,
)


if CTK_AVAILABLE:
    ctk.set_appearance_mode("dark")
    ctk.set_default_color_theme("blue")
    BaseApp = ctk.CTk
else:
    BaseApp = tk.Tk


class ShopAgentDesktopApp(BaseApp):
    def __init__(self):
        super().__init__()
        self.title("AI Shop Agent - Sales & Customer Service Suite (Windows)")
        self.geometry("1180x760")
        self.minsize(980, 640)

        self.db_handler = DatabaseHandler()
        self.current_user: Optional[Dict[str, Any]] = None
        self.gemini_agent: Optional[GeminiAgent] = None

        self.active_tab = "products"
        self.customer_image_path: Optional[str] = None

        # Build initial Auth View
        self._build_auth_screen()

    # -------------------------------------------------------------
    # 1. Multi-Tenant Authentication Screen
    # -------------------------------------------------------------
    def _build_auth_screen(self):
        # Clear existing widgets
        for widget in self.winfo_children():
            widget.destroy()

        if CTK_AVAILABLE:
            self.auth_container = ctk.CTkFrame(self, corner_radius=16, fg_color="#18181b")
            self.auth_container.place(relx=0.5, rely=0.5, anchor="center", relwidth=0.48, relheight=0.82)

            title_lbl = ctk.CTkLabel(
                self.auth_container,
                text="🤖 AI Shop Agent",
                font=ctk.CTkFont(size=26, weight="bold"),
                text_color="#38bdf8"
            )
            title_lbl.pack(pady=(30, 6))

            subtitle_lbl = ctk.CTkLabel(
                self.auth_container,
                text="Automated Multi-Channel Sales Assistant for Online Stores",
                font=ctk.CTkFont(size=13),
                text_color="#94a3b8"
            )
            subtitle_lbl.pack(pady=(0, 24))

            # Segmented Switcher for Login / Register
            self.auth_mode_switch = ctk.CTkSegmentedButton(
                self.auth_container,
                values=["Login to Store", "Register New Shop"],
                command=self._on_auth_mode_change
            )
            self.auth_mode_switch.set("Login to Store")
            self.auth_mode_switch.pack(pady=(0, 18), padx=30, fill="x")

            self.auth_form_frame = ctk.CTkFrame(self.auth_container, fg_color="transparent")
            self.auth_form_frame.pack(fill="both", expand=True, padx=30)

            self._render_login_form()
        else:
            # Tkinter fallback
            lbl = tk.Label(self, text="AI Shop Agent Desktop App", font=("Arial", 20, "bold"))
            lbl.pack(pady=40)
            btn = tk.Button(self, text="Login with Demo Store", command=self._demo_login_fallback)
            btn.pack(pady=20)

    def _on_auth_mode_change(self, mode):
        if mode == "Login to Store":
            self._render_login_form()
        else:
            self._render_register_form()

    def _render_login_form(self):
        for w in self.auth_form_frame.winfo_children():
            w.destroy()

        ctk.CTkLabel(self.auth_form_frame, text="Shop Owner Email:", anchor="w").pack(fill="x", pady=(8, 2))
        self.email_entry = ctk.CTkEntry(self.auth_form_frame, placeholder_text="owner@glamour.com", height=38)
        self.email_entry.insert(0, "owner@glamour.com")
        self.email_entry.pack(fill="x", pady=(0, 10))

        ctk.CTkLabel(self.auth_form_frame, text="Password:", anchor="w").pack(fill="x", pady=(4, 2))
        self.pwd_entry = ctk.CTkEntry(self.auth_form_frame, placeholder_text="••••••••", show="*", height=38)
        self.pwd_entry.insert(0, "admin123")
        self.pwd_entry.pack(fill="x", pady=(0, 16))

        login_btn = ctk.CTkButton(
            self.auth_form_frame,
            text="🚀 Open Store Control Panel",
            height=42,
            font=ctk.CTkFont(size=14, weight="bold"),
            fg_color="#2563eb",
            hover_color="#1d4ed8",
            command=self._handle_login
        )
        login_btn.pack(fill="x", pady=(8, 12))

        # Quick Demo Account Switcher
        demo_lbl = ctk.CTkLabel(self.auth_form_frame, text="Pre-seeded Demo Stores:", text_color="#64748b", font=ctk.CTkFont(size=12))
        demo_lbl.pack(pady=(12, 4))

        demo_box = ctk.CTkFrame(self.auth_form_frame, fg_color="#27272a")
        demo_box.pack(fill="x", pady=4)

        b1 = ctk.CTkButton(demo_box, text="👗 Fashion Boutique", height=30, fg_color="#3b82f6", command=lambda: self._fill_credentials("owner@glamour.com", "admin123"))
        b1.pack(side="left", expand=True, padx=4, pady=6)

        b2 = ctk.CTkButton(demo_box, text="🥗 Organic Food & Grocery", height=30, fg_color="#10b981", command=lambda: self._fill_credentials("contact@dhakafresh.com", "admin123"))
        b2.pack(side="right", expand=True, padx=4, pady=6)

    def _fill_credentials(self, email, pwd):
        self.email_entry.delete(0, "end")
        self.email_entry.insert(0, email)
        self.pwd_entry.delete(0, "end")
        self.pwd_entry.insert(0, pwd)

    def _render_register_form(self):
        for w in self.auth_form_frame.winfo_children():
            w.destroy()

        ctk.CTkLabel(self.auth_form_frame, text="Store / Brand Name:", anchor="w").pack(fill="x", pady=(4, 2))
        self.reg_name_entry = ctk.CTkEntry(self.auth_form_frame, placeholder_text="e.g. Trendy Wardrobe BD", height=36)
        self.reg_name_entry.pack(fill="x", pady=(0, 6))

        ctk.CTkLabel(self.auth_form_frame, text="Store Category:", anchor="w").pack(fill="x", pady=(4, 2))
        self.reg_cat_combo = ctk.CTkComboBox(self.auth_form_frame, values=["Fashion & Clothing", "Food, Grocery & Gourmet", "Electronics & Gadgets", "Cosmetics & Skincare", "General Store"], height=36)
        self.reg_cat_combo.pack(fill="x", pady=(0, 6))

        ctk.CTkLabel(self.auth_form_frame, text="Email Address:", anchor="w").pack(fill="x", pady=(4, 2))
        self.reg_email_entry = ctk.CTkEntry(self.auth_form_frame, placeholder_text="owner@myshop.com", height=36)
        self.reg_email_entry.pack(fill="x", pady=(0, 6))

        ctk.CTkLabel(self.auth_form_frame, text="Password:", anchor="w").pack(fill="x", pady=(4, 2))
        self.reg_pwd_entry = ctk.CTkEntry(self.auth_form_frame, placeholder_text="Create password", show="*", height=36)
        self.reg_pwd_entry.pack(fill="x", pady=(0, 14))

        reg_btn = ctk.CTkButton(
            self.auth_form_frame,
            text="✨ Create Shop & Database",
            height=40,
            fg_color="#059669",
            hover_color="#047857",
            font=ctk.CTkFont(weight="bold"),
            command=self._handle_register
        )
        reg_btn.pack(fill="x", pady=(4, 8))

    def _handle_login(self):
        email = self.email_entry.get().strip()
        pwd = self.pwd_entry.get().strip()
        res = self.db_handler.login_user(email, pwd)
        if res.get("success"):
            self.current_user = res["user"]
            self.gemini_agent = GeminiAgent(tenant_id=self.current_user["id"], db_handler=self.db_handler)
            self._build_dashboard_screen()
        else:
            if CTK_AVAILABLE:
                err_dialog = ctk.CTkInputDialog(text=res.get("error", "Login failed"), title="Error")
            else:
                messagebox.showerror("Error", res.get("error", "Login failed"))

    def _handle_register(self):
        name = self.reg_name_entry.get().strip()
        cat = self.reg_cat_combo.get()
        email = self.reg_email_entry.get().strip()
        pwd = self.reg_pwd_entry.get().strip()
        if not name or not email or not pwd:
            return
        res = self.db_handler.register_user(shop_name=name, email=email, password=pwd, business_category=cat)
        if res.get("success"):
            self._handle_login_direct(email, pwd)

    def _handle_login_direct(self, email, pwd):
        res = self.db_handler.login_user(email, pwd)
        if res.get("success"):
            self.current_user = res["user"]
            self.gemini_agent = GeminiAgent(tenant_id=self.current_user["id"], db_handler=self.db_handler)
            self._build_dashboard_screen()

    def _demo_login_fallback(self):
        res = self.db_handler.login_user("owner@glamour.com", "admin123")
        self.current_user = res["user"]
        self.gemini_agent = GeminiAgent(tenant_id=self.current_user["id"], db_handler=self.db_handler)
        self._build_dashboard_screen()

    # -------------------------------------------------------------
    # 2. Main Dashboard & Workspace Shell
    # -------------------------------------------------------------
    def _build_dashboard_screen(self):
        for widget in self.winfo_children():
            widget.destroy()

        # Layout: Sidebar on Left, Content on Right
        self.sidebar = ctk.CTkFrame(self, width=240, corner_radius=0, fg_color="#18181b")
        self.sidebar.pack(side="left", fill="y")
        self.sidebar.pack_propagate(False)

        # Store Header in Sidebar
        shop_title = self.current_user["shop_name"] if self.current_user else "My Store"
        category_tag = self.current_user.get("business_category", "Store") if self.current_user else "Retail"

        ctk.CTkLabel(self.sidebar, text="🏪 AI Shop Agent", font=ctk.CTkFont(size=18, weight="bold"), text_color="#38bdf8").pack(pady=(20, 4), padx=16, anchor="w")
        ctk.CTkLabel(self.sidebar, text=shop_title, font=ctk.CTkFont(size=14, weight="bold"), text_color="#f8fafc", wraplength=200, justify="left").pack(padx=16, anchor="w")
        ctk.CTkLabel(self.sidebar, text=f"Tenant DB: {self.current_user['id']}", font=ctk.CTkFont(size=10), text_color="#64748b").pack(padx=16, pady=(2, 16), anchor="w")

        # Nav Buttons
        nav_items = [
            ("📦 Products Catalog", "products"),
            ("🌐 Social Connections", "social"),
            ("🤖 AI Chat Simulator", "simulator"),
            ("⚡ Vector Search DB", "vector"),
            ("📜 Live Activity Logs", "logs"),
        ]

        self.nav_buttons = {}
        for label, tab_key in nav_items:
            btn = ctk.CTkButton(
                self.sidebar,
                text=label,
                anchor="w",
                height=40,
                corner_radius=8,
                fg_color="#2563eb" if tab_key == self.active_tab else "transparent",
                hover_color="#1e293b",
                font=ctk.CTkFont(size=13),
                command=lambda k=tab_key: self._switch_tab(k)
            )
            btn.pack(fill="x", padx=12, pady=4)
            self.nav_buttons[tab_key] = btn

        # Bottom Logout in Sidebar
        logout_btn = ctk.CTkButton(
            self.sidebar,
            text="🚪 Logout / Switch Shop",
            fg_color="#dc2626",
            hover_color="#b91c1c",
            height=34,
            command=self._build_auth_screen
        )
        logout_btn.pack(side="bottom", fill="x", padx=12, pady=16)

        # Content Frame
        self.content_frame = ctk.CTkFrame(self, corner_radius=0, fg_color="#09090b")
        self.content_frame.pack(side="right", fill="both", expand=True)

        # Persistent Top Dashboard Header Bar (Active Webhook & Notification Bell)
        self.top_dashboard_bar = ctk.CTkFrame(self.content_frame, fg_color="#18181b", height=50, corner_radius=0)
        self.top_dashboard_bar.pack(fill="x", side="top")
        self.top_dashboard_bar.pack_propagate(False)

        # Left Info in Top Bar
        bar_left = ctk.CTkFrame(self.top_dashboard_bar, fg_color="transparent")
        bar_left.pack(side="left", padx=16, pady=8)
        ctk.CTkLabel(
            bar_left,
            text=f"🏪 {shop_title}",
            font=ctk.CTkFont(size=13, weight="bold"),
            text_color="#f8fafc"
        ).pack(side="left")
        ctk.CTkLabel(
            bar_left,
            text=f"• {category_tag}",
            font=ctk.CTkFont(size=11),
            text_color="#94a3b8"
        ).pack(side="left", padx=6)

        # Right Action Cluster: Active Webhook status + Notification Bell Icon
        bar_right = ctk.CTkFrame(self.top_dashboard_bar, fg_color="transparent")
        bar_right.pack(side="right", padx=16, pady=8)

        # Active Webhook status indicator
        webhook_status_tag = ctk.CTkLabel(
            bar_right,
            text="🟢 Active Webhook Gateway (Port 8000)",
            font=ctk.CTkFont(size=11, weight="bold"),
            text_color="#4ade80",
            fg_color="#064e3b",
            corner_radius=6,
            padx=10,
            pady=4
        )
        webhook_status_tag.pack(side="left", padx=(0, 10))

        # Notification Bell Icon with dynamic red counter badge right next to Active Webhook
        tenant_id = self.current_user["id"] if self.current_user else "default"
        self.notif_bell_widget = NotificationBellWidget(
            bar_right,
            tenant_id=tenant_id,
            on_click_callback=self._open_notifications_modal
        )
        self.notif_bell_widget.pack(side="left")

        # Tab Content Container (under top header)
        self.tab_container = ctk.CTkFrame(self.content_frame, corner_radius=0, fg_color="transparent")
        self.tab_container.pack(fill="both", expand=True)

        self._render_current_tab()

    def _open_notifications_modal(self):
        tenant_id = self.current_user["id"] if self.current_user else "default"
        NotificationModal(self, tenant_id=tenant_id, on_close=self._refresh_notif_badge)

    def _refresh_notif_badge(self):
        if hasattr(self, "notif_bell_widget") and self.notif_bell_widget:
            self.notif_bell_widget.refresh_badge()

    def _switch_tab(self, tab_key: str):
        self.active_tab = tab_key
        for k, btn in self.nav_buttons.items():
            btn.configure(fg_color="#2563eb" if k == tab_key else "transparent")
        self._render_current_tab()

    def _render_current_tab(self):
        for w in self.tab_container.winfo_children():
            w.destroy()

        if self.active_tab == "products":
            self._render_products_tab()
        elif self.active_tab == "social":
            self._render_social_tab()
        elif self.active_tab == "simulator":
            self._render_simulator_tab()
        elif self.active_tab == "vector":
            self._render_vector_tab()
        elif self.active_tab == "logs":
            self._render_logs_tab()

    # -------------------------------------------------------------
    # 3. Product Catalog Tab (Dynamic Schema Support)
    # -------------------------------------------------------------
    def _render_products_tab(self):
        top_bar = ctk.CTkFrame(self.tab_container, fg_color="transparent", height=50)
        top_bar.pack(fill="x", padx=24, pady=(20, 12))

        ctk.CTkLabel(top_bar, text="Product Catalog Management", font=ctk.CTkFont(size=20, weight="bold")).pack(side="left")

        add_btn = ctk.CTkButton(top_bar, text="+ Add New Product", fg_color="#10b981", hover_color="#059669", command=self._open_add_product_modal)
        add_btn.pack(side="right")

        # Search & Filter
        filter_bar = ctk.CTkFrame(self.tab_container, fg_color="#18181b", height=44)
        filter_bar.pack(fill="x", padx=24, pady=(0, 12))

        self.prod_search = ctk.CTkEntry(filter_bar, placeholder_text="Search product by name or keyword...", width=320)
        self.prod_search.pack(side="left", padx=10, pady=6)
        self.prod_search.bind("<Return>", lambda e: self._refresh_product_list())

        filter_btn = ctk.CTkButton(filter_bar, text="Search", width=80, command=self._refresh_product_list)
        filter_btn.pack(side="left", padx=6)

        # Products Scrollable Container
        self.products_scroll = ctk.CTkScrollableFrame(self.tab_container, fg_color="transparent")
        self.products_scroll.pack(fill="both", expand=True, padx=24, pady=(0, 20))

        self._refresh_product_list()

    def _refresh_product_list(self):
        for w in self.products_scroll.winfo_children():
            w.destroy()

        query = self.prod_search.get().strip() if hasattr(self, "prod_search") else None
        products = self.db_handler.get_products(search_query=query)

        if not products:
            ctk.CTkLabel(self.products_scroll, text="No products found in this tenant database. Click '+ Add New Product' above!", text_color="#94a3b8").pack(pady=40)
            return

        for p in products:
            card = ctk.CTkFrame(self.products_scroll, fg_color="#18181b", corner_radius=10)
            card.pack(fill="x", pady=6, padx=4)

            # Left side: Details
            info_frame = ctk.CTkFrame(card, fg_color="transparent")
            info_frame.pack(side="left", fill="both", expand=True, padx=16, pady=12)

            name_lbl = ctk.CTkLabel(info_frame, text=f"{p['name']} — {p['price']} BDT", font=ctk.CTkFont(size=15, weight="bold"), anchor="w")
            name_lbl.pack(fill="x")

            cat_stock = f"Category: {p['category']} | Stock: {p.get('stock', 10)} units | ID: {p['id']}"
            ctk.CTkLabel(info_frame, text=cat_stock, font=ctk.CTkFont(size=12), text_color="#38bdf8", anchor="w").pack(fill="x", pady=(2, 4))

            # Dynamic Attributes preview
            attrs = p.get("attributes", {})
            attr_strings = [f"{k.replace('_', ' ').title()}: {v}" for k, v in attrs.items() if v]
            if attr_strings:
                attr_preview = " • ".join(attr_strings)
                ctk.CTkLabel(info_frame, text=f"✨ {attr_preview}", font=ctk.CTkFont(size=11), text_color="#a1a1aa", anchor="w").pack(fill="x")

            desc = p.get("description", "")
            if desc:
                ctk.CTkLabel(info_frame, text=desc[:140] + ("..." if len(desc) > 140 else ""), font=ctk.CTkFont(size=12), text_color="#94a3b8", anchor="w").pack(fill="x", pady=(4, 0))

            # Action Buttons
            action_frame = ctk.CTkFrame(card, fg_color="transparent")
            action_frame.pack(side="right", padx=12, pady=12)

            del_btn = ctk.CTkButton(action_frame, text="Delete", width=70, height=30, fg_color="#ef4444", hover_color="#dc2626", command=lambda pid=p['id']: self._delete_product(pid))
            del_btn.pack(side="right", padx=4)

    def _delete_product(self, product_id: str):
        self.db_handler.delete_product(product_id)
        if self.gemini_agent:
            self.gemini_agent.refresh_product_index()
        self._refresh_product_list()

    def _open_add_product_modal(self):
        modal = ctk.CTkToplevel(self)
        modal.title("Add Product with Dynamic Attributes")
        modal.geometry("640x700")
        modal.grab_set()

        scroll = ctk.CTkScrollableFrame(modal, fg_color="transparent")
        scroll.pack(fill="both", expand=True, padx=20, pady=20)

        ctk.CTkLabel(scroll, text="Add New Catalog Item", font=ctk.CTkFont(size=18, weight="bold")).pack(anchor="w", pady=(0, 14))

        # Basic Fields
        ctk.CTkLabel(scroll, text="Product Name:").pack(anchor="w", pady=(4, 2))
        name_ent = ctk.CTkEntry(scroll, placeholder_text="e.g. Silk Embroidered Panjabi")
        name_ent.pack(fill="x", pady=(0, 8))

        row1 = ctk.CTkFrame(scroll, fg_color="transparent")
        row1.pack(fill="x", pady=(0, 8))

        ctk.CTkLabel(row1, text="Price (BDT):").pack(side="left", padx=(0, 6))
        price_ent = ctk.CTkEntry(row1, placeholder_text="2500", width=120)
        price_ent.pack(side="left", padx=(0, 16))

        ctk.CTkLabel(row1, text="Stock:").pack(side="left", padx=(0, 6))
        stock_ent = ctk.CTkEntry(row1, placeholder_text="20", width=80)
        stock_ent.insert(0, "20")
        stock_ent.pack(side="left")

        # Category Selector (Changes Dynamic Attribute fields!)
        ctk.CTkLabel(scroll, text="Product Category (Determines Dynamic Schema):").pack(anchor="w", pady=(6, 2))
        cat_combo = ctk.CTkComboBox(scroll, values=["Clothing & Fashion", "Food & Gourmet", "Electronics & Gadgets", "General Merchandise"])
        cat_combo.pack(fill="x", pady=(0, 10))

        # Dynamic Schema Attributes Container
        schema_box = ctk.CTkFrame(scroll, fg_color="#18181b", corner_radius=8)
        schema_box.pack(fill="x", pady=10, padx=2)

        ctk.CTkLabel(schema_box, text="⚡ Category Dynamic Attributes", font=ctk.CTkFont(size=13, weight="bold"), text_color="#38bdf8").pack(anchor="w", padx=12, pady=(10, 6))

        ctk.CTkLabel(schema_box, text="Sizes / Weight (comma-separated):").pack(anchor="w", padx=12, pady=(2, 2))
        dyn_spec1 = ctk.CTkEntry(schema_box, placeholder_text="e.g. M, L, XL or 500g Jar")
        dyn_spec1.pack(fill="x", padx=12, pady=(0, 8))

        ctk.CTkLabel(schema_box, text="Colors / Expiry / Shelf Life:").pack(anchor="w", padx=12, pady=(2, 2))
        dyn_spec2 = ctk.CTkEntry(schema_box, placeholder_text="e.g. Black, Navy Blue or 12 Months")
        dyn_spec2.pack(fill="x", padx=12, pady=(0, 8))

        ctk.CTkLabel(schema_box, text="Fabric / Ingredients / Warranty:").pack(anchor="w", padx=12, pady=(2, 2))
        dyn_spec3 = ctk.CTkEntry(schema_box, placeholder_text="e.g. 100% Combed Cotton or 1 Year Warranty")
        dyn_spec3.pack(fill="x", padx=12, pady=(0, 12))

        ctk.CTkLabel(scroll, text="Description:").pack(anchor="w", pady=(6, 2))
        desc_ent = ctk.CTkTextbox(scroll, height=80)
        desc_ent.pack(fill="x", pady=(0, 8))

        ctk.CTkLabel(scroll, text="Image URL:").pack(anchor="w", pady=(4, 2))
        img_ent = ctk.CTkEntry(scroll, placeholder_text="https://...")
        img_ent.pack(fill="x", pady=(0, 14))

        def save():
            name = name_ent.get().strip()
            price_val = float(price_ent.get() or 0)
            stock_val = int(stock_ent.get() or 10)
            cat_val = cat_combo.get()
            desc_val = desc_ent.get("1.0", "end").strip()
            img_val = img_ent.get().strip()

            attrs = {
                "spec_sizes_or_weight": [s.strip() for s in dyn_spec1.get().split(",") if s.strip()],
                "spec_colors_or_expiry": dyn_spec2.get().strip(),
                "spec_material_or_warranty": dyn_spec3.get().strip()
            }

            if name and price_val > 0:
                self.db_handler.add_product(
                    name=name,
                    price=price_val,
                    category=cat_val,
                    stock=stock_val,
                    description=desc_val,
                    image_url=img_val,
                    attributes=attrs
                )
                if self.gemini_agent:
                    self.gemini_agent.refresh_product_index()
                modal.destroy()
                self._refresh_product_list()

        save_btn = ctk.CTkButton(scroll, text="Save to Isolated Database", height=38, fg_color="#10b981", command=save)
        save_btn.pack(fill="x", pady=10)

    # -------------------------------------------------------------
    # 4. Social Media Accounts Connection Panel
    # -------------------------------------------------------------
    def _render_social_tab(self):
        scroll = ctk.CTkScrollableFrame(self.tab_container, fg_color="transparent")
        scroll.pack(fill="both", expand=True, padx=24, pady=20)

        ctk.CTkLabel(scroll, text="Social Media Connection Hub", font=ctk.CTkFont(size=20, weight="bold")).pack(anchor="w", pady=(0, 4))
        ctk.CTkLabel(scroll, text="Connect your 4 social channels. The AI agent automatically monitors incoming messages.", font=ctk.CTkFont(size=13), text_color="#94a3b8").pack(anchor="w", pady=(0, 20))

        configs = self.db_handler.get_social_configs()

        platforms = [
            ("facebook", "Facebook Messenger", "📘 Meta Messenger Webhook", "#1877F2"),
            ("instagram", "Instagram Direct Messages", "📸 Instagram Graph API", "#E1306C"),
            ("whatsapp", "WhatsApp Cloud API", "💬 WhatsApp Business Platform", "#25D366"),
            ("tiktok", "TikTok Shop Webhook", "🎵 TikTok Business Messaging", "#EE1D52"),
        ]

        for p_key, p_title, p_badge, p_color in platforms:
            cfg = configs.get(p_key, {})
            is_conn = bool(cfg.get("is_connected", 0))

            card = ctk.CTkFrame(scroll, fg_color="#18181b", corner_radius=12)
            card.pack(fill="x", pady=8)

            header = ctk.CTkFrame(card, fg_color="transparent")
            header.pack(fill="x", padx=16, pady=(14, 8))

            ctk.CTkLabel(header, text=p_title, font=ctk.CTkFont(size=16, weight="bold")).pack(side="left")
            status_tag = ctk.CTkLabel(header, text="🟢 CONNECTED & LISTENING" if is_conn else "⚪ NOT CONFIGURED", text_color="#4ade80" if is_conn else "#94a3b8", font=ctk.CTkFont(size=11, weight="bold"))
            status_tag.pack(side="right")

            body = ctk.CTkFrame(card, fg_color="transparent")
            body.pack(fill="x", padx=16, pady=(0, 14))

            # Config Inputs
            grid_frame = ctk.CTkFrame(body, fg_color="transparent")
            grid_frame.pack(fill="x", pady=4)

            # Webhook URL
            ctk.CTkLabel(grid_frame, text="Webhook Callback URL:", font=ctk.CTkFont(size=11), text_color="#a1a1aa").pack(anchor="w")
            wh_ent = ctk.CTkEntry(grid_frame, height=32)
            wh_ent.insert(0, cfg.get("webhook_url") or f"https://my-domain.ngrok-free.app/webhook/{p_key}")
            wh_ent.pack(fill="x", pady=(2, 6))

            # Verify Token & Access Token
            row = ctk.CTkFrame(grid_frame, fg_color="transparent")
            row.pack(fill="x", pady=2)

            f1 = ctk.CTkFrame(row, fg_color="transparent")
            f1.pack(side="left", fill="x", expand=True, padx=(0, 6))
            ctk.CTkLabel(f1, text="Verify Token:", font=ctk.CTkFont(size=11), text_color="#a1a1aa").pack(anchor="w")
            vt_ent = ctk.CTkEntry(f1, height=32)
            vt_ent.insert(0, cfg.get("verify_token") or "ai_shop_secret_token")
            vt_ent.pack(fill="x", pady=2)

            f2 = ctk.CTkFrame(row, fg_color="transparent")
            f2.pack(side="right", fill="x", expand=True, padx=(6, 0))
            ctk.CTkLabel(f2, text="Page ID / Phone ID:", font=ctk.CTkFont(size=11), text_color="#a1a1aa").pack(anchor="w")
            pid_ent = ctk.CTkEntry(f2, height=32)
            pid_ent.insert(0, cfg.get("page_id") or "")
            pid_ent.pack(fill="x", pady=2)

            ctk.CTkLabel(grid_frame, text="Access Key / API Token:", font=ctk.CTkFont(size=11), text_color="#a1a1aa").pack(anchor="w", pady=(4, 0))
            tok_ent = ctk.CTkEntry(grid_frame, placeholder_text="EAABw...", show="*", height=32)
            tok_ent.insert(0, cfg.get("access_token") or "")
            tok_ent.pack(fill="x", pady=2)

            # Save & Toggle
            btn_row = ctk.CTkFrame(body, fg_color="transparent")
            btn_row.pack(fill="x", pady=(8, 0))

            def make_save_fn(plat=p_key, w_e=wh_ent, v_e=vt_ent, p_e=pid_ent, t_e=tok_ent):
                def save_social():
                    self.db_handler.update_social_config(
                        platform=plat,
                        is_connected=True,
                        page_id=p_e.get().strip(),
                        access_token=t_e.get().strip(),
                        verify_token=v_e.get().strip(),
                        webhook_url=w_e.get().strip(),
                        app_secret=""
                    )
                    self._render_social_tab()
                return save_social

            save_btn = ctk.CTkButton(btn_row, text=f"Save & Connect {p_title}", height=32, fg_color="#2563eb", command=make_save_fn())
            save_btn.pack(side="left", padx=(0, 8))

    # -------------------------------------------------------------
    # 5. Smart AI Auto-Reply & Live Chat Simulator
    # -------------------------------------------------------------
    def _render_simulator_tab(self):
        container = ctk.CTkFrame(self.tab_container, fg_color="transparent")
        container.pack(fill="both", expand=True, padx=24, pady=20)

        # Header
        head = ctk.CTkFrame(container, fg_color="transparent")
        head.pack(fill="x", pady=(0, 10))
        ctk.CTkLabel(head, text="AI Customer Service & Sales Simulator", font=ctk.CTkFont(size=20, weight="bold")).pack(side="left")
        ctk.CTkLabel(head, text="Powered by Gemini 1.5 Flash + Vector DB Context", font=ctk.CTkFont(size=12), text_color="#38bdf8").pack(side="right")

        # Main Chat Box
        self.chat_history_box = ctk.CTkScrollableFrame(container, fg_color="#18181b", corner_radius=12)
        self.chat_history_box.pack(fill="both", expand=True, pady=(0, 12))

        # Initial Welcome Message in Chat
        shop_name = self.current_user["shop_name"] if self.current_user else "Store"
        self._add_chat_bubble(
            sender="AI Agent",
            text=f"Hello! I am your AI sales assistant for {shop_name}. I understand Banglish, typos, emojis, and customer product photos while strictly respecting your product catalog!",
            is_ai=True
        )

        # Quick Test Prompts (Banglish, Typos, Guardrail Test)
        presets_frame = ctk.CTkFrame(container, fg_color="transparent")
        presets_frame.pack(fill="x", pady=(0, 8))

        ctk.CTkLabel(presets_frame, text="Quick Tests:", font=ctk.CTkFont(size=11), text_color="#94a3b8").pack(side="left", padx=(0, 8))

        test_queries = [
            ("👗 Banglish Size Query", "Ei dress ta ki size L ache? Price koto?"),
            ("🚚 Delivery & Typos", "bhai panjbi ta ko dine pabo? delvery charge koto?"),
            ("🚫 Out-of-Stock Guardrail", "Do you sell iPhone 16 Pro Max or Italian Pizza?"),
            ("😍 Emojis & Slang", "bhaiya order korte chai 🔥😍"),
        ]

        for label, q_text in test_queries:
            btn = ctk.CTkButton(
                presets_frame,
                text=label,
                height=26,
                font=ctk.CTkFont(size=11),
                fg_color="#27272a",
                hover_color="#3f3f46",
                command=lambda t=q_text: self._set_query_text(t)
            )
            btn.pack(side="left", padx=3)

        # Input Area
        input_bar = ctk.CTkFrame(container, fg_color="#18181b", corner_radius=10)
        input_bar.pack(fill="x")

        self.chat_input = ctk.CTkEntry(input_bar, placeholder_text="Type customer message in English or Banglish...", height=44)
        self.chat_input.pack(side="left", fill="x", expand=True, padx=(12, 8), pady=8)
        self.chat_input.bind("<Return>", lambda e: self._send_simulated_message())

        # Multimodal Image Attachment Button
        self.img_attach_btn = ctk.CTkButton(
            input_bar,
            text="📷 Attach Photo",
            width=110,
            height=38,
            fg_color="#475569",
            hover_color="#334155",
            command=self._pick_customer_photo
        )
        self.img_attach_btn.pack(side="left", padx=(0, 8))

        send_btn = ctk.CTkButton(
            input_bar,
            text="Send Inquiry 🚀",
            width=120,
            height=38,
            fg_color="#2563eb",
            hover_color="#1d4ed8",
            command=self._send_simulated_message
        )
        send_btn.pack(side="right", padx=(0, 12))

    def _set_query_text(self, text: str):
        self.chat_input.delete(0, "end")
        self.chat_input.insert(0, text)

    def _pick_customer_photo(self):
        # Demo simulation for image attachment
        self.customer_image_path = "attached_sample_photo"
        self.img_attach_btn.configure(text="✅ Photo Attached", fg_color="#059669")

    def _add_chat_bubble(self, sender: str, text: str, is_ai: bool = False, meta_info: Optional[str] = None):
        bubble = ctk.CTkFrame(
            self.chat_history_box,
            fg_color="#1e3a8a" if is_ai else "#27272a",
            corner_radius=10
        )
        bubble.pack(fill="x", pady=4, padx=8)

        head = ctk.CTkLabel(bubble, text=sender, font=ctk.CTkFont(size=12, weight="bold"), text_color="#38bdf8" if is_ai else "#a1a1aa")
        head.pack(anchor="w", padx=12, pady=(8, 2))

        msg = ctk.CTkLabel(bubble, text=text, font=ctk.CTkFont(size=13), text_color="#f8fafc", wraplength=700, justify="left")
        msg.pack(anchor="w", padx=12, pady=(0, 8))

        if meta_info:
            ctk.CTkLabel(bubble, text=meta_info, font=ctk.CTkFont(size=10), text_color="#93c5fd").pack(anchor="w", padx=12, pady=(0, 6))

    def _send_simulated_message(self):
        query = self.chat_input.get().strip()
        if not query:
            return

        self._add_chat_bubble(sender="Customer (via WhatsApp / Messenger)", text=query, is_ai=False)
        self.chat_input.delete(0, "end")

        has_img = bool(self.customer_image_path)
        self.customer_image_path = None
        self.img_attach_btn.configure(text="📷 Attach Photo", fg_color="#475569")

        # Run AI generation in thread so UI does not freeze
        def task():
            if not self.gemini_agent:
                self.gemini_agent = GeminiAgent(tenant_id=self.current_user["id"], db_handler=self.db_handler)
            
            tenant_id = self.current_user["id"] if self.current_user else "default"
            res = safe_gemini_call(
                self.gemini_agent.generate_reply,
                customer_message=query,
                image_input="sample" if has_img else None,
                platform="Customer Simulator",
                customer_name="Test Customer",
                tenant_id=tenant_id
            )
            matched_names = [p["name"] for p in res.get("retrieved_products", [])]
            meta = f"⚡ Vector DB matched {len(matched_names)} items ({', '.join(matched_names[:2])}) | Latency: {res['latency_ms']}ms | Guardrail Active"
            self.after(0, lambda: self._add_chat_bubble(sender="🤖 Shop AI Agent", text=res["reply"], is_ai=True, meta_info=meta))
            self.after(0, self._refresh_notif_badge)

        threading.Thread(target=task, daemon=True).start()

    # -------------------------------------------------------------
    # 6. Vector Search Inspector
    # -------------------------------------------------------------
    def _render_vector_tab(self):
        scroll = ctk.CTkScrollableFrame(self.tab_container, fg_color="transparent")
        scroll.pack(fill="both", expand=True, padx=24, pady=20)

        ctk.CTkLabel(scroll, text="Vector Similarity Search Inspector", font=ctk.CTkFont(size=20, weight="bold")).pack(anchor="w", pady=(0, 4))
        ctk.CTkLabel(scroll, text="Inspect how vector embeddings retrieve exact product matches from the tenant's isolated catalog to minimize token cost.", font=ctk.CTkFont(size=13), text_color="#94a3b8").pack(anchor="w", pady=(0, 16))

        box = ctk.CTkFrame(scroll, fg_color="#18181b", corner_radius=10)
        box.pack(fill="x", pady=8)

        v_input = ctk.CTkEntry(box, placeholder_text="Type query to test vector matching (e.g. 'velvet blue panjabi', 'honey', 'biryani')", height=40)
        v_input.pack(side="left", fill="x", expand=True, padx=12, pady=12)

        results_box = ctk.CTkFrame(scroll, fg_color="transparent")
        results_box.pack(fill="both", expand=True, pady=10)

        def test_vector():
            for w in results_box.winfo_children():
                w.destroy()
            q = v_input.get().strip()
            if not self.gemini_agent:
                self.gemini_agent = GeminiAgent(tenant_id=self.current_user["id"], db_handler=self.db_handler)
            matches = self.gemini_agent.vector_db.search(q, top_k=5, min_threshold=0.01)

            if not matches:
                ctk.CTkLabel(results_box, text="No products met similarity threshold for this query.", text_color="#ef4444").pack(pady=20)
                return

            for m in matches:
                card = ctk.CTkFrame(results_box, fg_color="#18181b", corner_radius=8)
                card.pack(fill="x", pady=4)
                score = m.get("_similarity_score", 0.0)
                ctk.CTkLabel(card, text=f"🎯 Similarity Score: {score:.4f} | {m['name']} ({m['price']} BDT)", font=ctk.CTkFont(size=13, weight="bold"), text_color="#4ade80" if score > 0.3 else "#38bdf8").pack(anchor="w", padx=12, pady=(8, 2))
                ctk.CTkLabel(card, text=f"Category: {m['category']} | Attributes: {json.dumps(m.get('attributes', {}))}", font=ctk.CTkFont(size=11), text_color="#94a3b8").pack(anchor="w", padx=12, pady=(0, 8))

        search_btn = ctk.CTkButton(box, text="Run Vector Search", width=140, height=38, fg_color="#2563eb", command=test_vector)
        search_btn.pack(side="right", padx=12)

    # -------------------------------------------------------------
    # 7. Live Activity Logs Tab
    # -------------------------------------------------------------
    def _render_logs_tab(self):
        scroll = ctk.CTkScrollableFrame(self.tab_container, fg_color="transparent")
        scroll.pack(fill="both", expand=True, padx=24, pady=20)

        ctk.CTkLabel(scroll, text="Live Activity & Webhook Logs", font=ctk.CTkFont(size=20, weight="bold")).pack(anchor="w", pady=(0, 4))
        ctk.CTkLabel(scroll, text="Real-time message dispatches and automated AI sales replies for this store.", font=ctk.CTkFont(size=13), text_color="#94a3b8").pack(anchor="w", pady=(0, 16))

        logs = self.db_handler.get_chat_logs(limit=30)
        if not logs:
            ctk.CTkLabel(scroll, text="No interactions recorded yet. Try sending a message in the AI Chat Simulator tab!", text_color="#94a3b8").pack(pady=40)
            return

        for l in logs:
            row = ctk.CTkFrame(scroll, fg_color="#18181b", corner_radius=8)
            row.pack(fill="x", pady=4)

            top = ctk.CTkFrame(row, fg_color="transparent")
            top.pack(fill="x", padx=12, pady=(8, 2))

            plat_lbl = ctk.CTkLabel(top, text=f"📱 {l.get('platform', 'Chat')} • {l.get('customer_name', 'Customer')}", font=ctk.CTkFont(size=12, weight="bold"), text_color="#38bdf8")
            plat_lbl.pack(side="left")

            time_lbl = ctk.CTkLabel(top, text=f"Latency: {l.get('latency_ms', 0)}ms | {l.get('timestamp', '')}", font=ctk.CTkFont(size=11), text_color="#64748b")
            time_lbl.pack(side="right")

            ctk.CTkLabel(row, text=f"Customer Query: \"{l.get('incoming_message', '')}\"", font=ctk.CTkFont(size=12), text_color="#f1f5f9").pack(anchor="w", padx=12, pady=2)
            ctk.CTkLabel(row, text=f"AI Reply: \"{l.get('ai_reply', '')}\"", font=ctk.CTkFont(size=12), text_color="#4ade80", wraplength=700, justify="left").pack(anchor="w", padx=12, pady=(2, 8))


if __name__ == "__main__":
    app = ShopAgentDesktopApp()
    app.mainloop()
