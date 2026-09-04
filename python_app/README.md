# AI Shop Agent — Windows Desktop Application (PC Software)

**AI-Powered Automated Sales & Customer Service Agent for Online Shop Owners**

---

## 🌟 Key Features & Architecture

1. **Multi-Tenant User Authentication & Isolated Databases**:
   - Modern Login/Register interface for shop owners.
   - Automatically provisions and isolates an SQLite database (`data/tenants/{tenant_id}/store.db`) per user upon sign up.

2. **Social Media Accounts Connection Panel**:
   - Instant connection and configuration hub for **Facebook Messenger**, **Instagram Direct Messages**, **WhatsApp Cloud API**, and **TikTok Shop Webhooks**.
   - Per-tenant storage for Webhook Callback URLs, Verify Tokens, Page IDs, and Access Keys.

3. **Dynamic Schema Product Catalog Management**:
   - Upload, view, edit, and delete product catalog items.
   - Dynamic schema attributes:
     - **Clothing items**: Size options (`M`, `L`, `XL`), colors, fabric, fit type.
     - **Food & Grocery items**: Weight, shelf-life, expiry date, dietary/halal certification, allergens.
     - **Electronics / Custom items**: Warranty, specs, voltage.

4. **Smart AI Auto-Reply System (Google Gemini 1.5 / Flash)**:
   - Understands standard English, Bengali, **Banglish** (e.g., *"Ei dress ta ki size M ache? Dam koto?"*), heavy spelling mistakes, and emojis (*"🔥😍"*).
   - **Multimodal image analysis**: Customer-uploaded product photos are matched against catalog items.
   - **Vector Similarity Search (`vector_db.py`)**: Indexes store items and extracts only the top-K relevant products into the prompt, slashing Gemini API costs and reducing response latency.
   - **Strict Boundary Guardrails**: The AI only answers based on the logged-in shop's isolated catalog. If a product is not in the store, it politely refuses and never hallucinates outside products.

5. **Multi-Platform Webhook Server (`webhook_listener.py`)**:
   - FastAPI server with endpoints for Meta Messenger, Instagram, WhatsApp, and TikTok webhooks.
   - Automatically routes incoming customer chats to `gemini_agent.py` and replies asynchronously.

---

## 🛠️ Step-by-Step Instructions to Run on Windows PC

### Step 1: Install Python
1. Download **Python 3.10, 3.11, or 3.12** from [python.org/downloads](https://www.python.org/downloads/).
2. **Crucial:** When running the Python installer on Windows, check the box:  
   ☑ **"Add Python to PATH"** before clicking Install.

---

### Step 2: Open Terminal & Navigate to Project
Open **Command Prompt (`cmd`)** or **PowerShell** and navigate to the extracted folder:
```cmd
cd path\to\python_app
```

---

### Step 3: Install Required Dependencies
Run:
```cmd
pip install -r requirements.txt
```

---

### Step 4: Set your Gemini API Key (Optional but Recommended)
Set your Google Gemini API key as an environment variable:
- In Command Prompt:
  ```cmd
  set GEMINI_API_KEY=AIzaSyYourGeminiApiKeyHere
  ```
- Or permanently in Windows:
  ```cmd
  setx GEMINI_API_KEY "AIzaSyYourGeminiApiKeyHere"
  ```
*(Note: If no API key is provided, the application automatically uses its built-in high-precision grounded rule engine).*

---

### Step 5: Launch the Desktop Application
Double-click `run.bat` or run in terminal:
```cmd
python main_app.py
```

---

### Step 6: (Optional) Run the Webhook Receiver Server
To accept live webhooks from Facebook, Instagram, WhatsApp, or TikTok:
```cmd
python webhook_listener.py 8000
```
To expose it to the internet for Meta/TikTok webhooks during local development, use **ngrok**:
```cmd
ngrok http 8000
```
Copy the generated `https://xxxx.ngrok-free.app/webhook/facebook` URL into the desktop app's **Social Connections** tab and your Meta App Dashboard.

---

## 📁 File Structure

```
python_app/
├── main_app.py            # Desktop UI built with CustomTkinter (Windows 11 Dark/Light theme)
├── gemini_agent.py        # Gemini 1.5 Flash agent, Banglish NLP, Multimodal photo processing, Guardrails
├── database_handler.py    # Multi-tenant isolated SQLite database engine & auth
├── vector_db.py           # Vector similarity search engine & semantic indexing
├── webhook_listener.py    # FastAPI multi-platform webhook server for FB, IG, WA, TT
├── requirements.txt       # Python package dependencies
├── run.bat                # Windows one-click launcher batch script
└── README.md              # Documentation and guide
```

---

## 🔑 Pre-Seeded Demo Accounts (Instant Testing)

1. **Fashion Boutique**:
   - Email: `owner@glamour.com`
   - Password: `admin123`
   - Pre-loaded with Velvet Panjabis, Georgette Kurtis, Graphic Tees (Sizes, Colors, Fabric attributes).

2. **Organic Food & Grocery**:
   - Email: `contact@dhakafresh.com`
   - Password: `admin123`
   - Pre-loaded with Kacchi Biryani, Sundarban Wild Honey, Hot Chili Sauce (Weight, Expiry, Dietary attributes).
