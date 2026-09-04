import React, { useState, useEffect, useRef } from "react";
import { TenantUser, Product, SocialConfig, ChatMessage, WebhookLog, NotificationItem } from "./types";
import {
  INITIAL_TENANTS,
  INITIAL_PRODUCTS,
  INITIAL_SOCIAL_CONFIGS,
  INITIAL_WEBHOOK_LOGS,
} from "./data/mockData";
import { DesktopWindowChrome } from "./components/DesktopWindowChrome";
import { AuthScreen } from "./components/AuthScreen";
import { ProductCatalog } from "./components/ProductCatalog";
import { SocialIntegrations } from "./components/SocialIntegrations";
import { AiCustomerSimulator } from "./components/AiCustomerSimulator";
import { VectorSearchInspector } from "./components/VectorSearchInspector";
import { WebhookEventLogs } from "./components/WebhookEventLogs";
import { PythonCodeHub } from "./components/PythonCodeHub";
import { db, doc, setDoc, deleteDoc, collection, onSnapshot, getDocs } from "./lib/firebase";

export default function App() {
  // Master Tenants list
  const [tenants, setTenants] = useState<TenantUser[]>(() => {
    const saved = localStorage.getItem("shop_agent_tenants");
    return saved ? JSON.parse(saved) : [];
  });

  // Current Logged In Tenant (null by default so new installation always shows Login/Register)
  const [currentTenant, setCurrentTenant] = useState<TenantUser | null>(() => {
    const saved = localStorage.getItem("shop_agent_current_tenant");
    return saved ? JSON.parse(saved) : null;
  });

  // Active Tab - Social Integrations first
  const [activeTab, setActiveTab] = useState<string>("social");

  // Isolated Products State per Tenant
  const [tenantProducts, setTenantProducts] = useState<Record<string, Product[]>>(() => {
    const saved = localStorage.getItem("shop_agent_products");
    return saved ? JSON.parse(saved) : {};
  });

  // Social Configs per Tenant (guarantees unverified channels are NOT falsely marked connected)
  const [tenantSocialConfigs, setTenantSocialConfigs] = useState<Record<string, SocialConfig[]>>(() => {
    const saved = localStorage.getItem("shop_agent_social_configs");
    if (!saved) return INITIAL_SOCIAL_CONFIGS;
    try {
      const parsed: Record<string, SocialConfig[]> = JSON.parse(saved);
      const sanitized: Record<string, SocialConfig[]> = {};
      for (const [tId, cfgs] of Object.entries(parsed)) {
        sanitized[tId] = cfgs.map((c) => {
          const hasRealCreds = Boolean(c.pageId && c.accessToken && c.pageId.trim() !== "" && c.accessToken.trim() !== "" && !c.accessToken.includes("..."));
          if (!hasRealCreds || !c.isConnected) {
            return { ...c, isConnected: false, lastSync: "Not connected" };
          }
          return c;
        });
      }
      return sanitized;
    } catch {
      return INITIAL_SOCIAL_CONFIGS;
    }
  });

  // Webhook Logs per Tenant
  const [tenantLogs, setTenantLogs] = useState<Record<string, WebhookLog[]>>(() => {
    const saved = localStorage.getItem("shop_agent_logs");
    return saved ? JSON.parse(saved) : { default: INITIAL_WEBHOOK_LOGS };
  });

  // Notification Center items per Tenant (Synced real-time from Cloud Firestore)
  const [tenantNotifications, setTenantNotifications] = useState<Record<string, NotificationItem[]>>({});

  // Python Code Hub Modal
  const [isCodeHubOpen, setIsCodeHubOpen] = useState(false);

  // Persistence effects
  useEffect(() => {
    localStorage.setItem("shop_agent_tenants", JSON.stringify(tenants));
  }, [tenants]);

  useEffect(() => {
    localStorage.setItem("shop_agent_current_tenant", JSON.stringify(currentTenant));
  }, [currentTenant]);

  useEffect(() => {
    localStorage.setItem("shop_agent_products", JSON.stringify(tenantProducts));
  }, [tenantProducts]);

  useEffect(() => {
    localStorage.setItem("shop_agent_social_configs", JSON.stringify(tenantSocialConfigs));
  }, [tenantSocialConfigs]);

  useEffect(() => {
    localStorage.setItem("shop_agent_logs", JSON.stringify(tenantLogs));
  }, [tenantLogs]);

  // Local storage effects - Notification syncing removed completely to save client storage space

  // Firestore Real-Time Listener for Current Tenant Products
  useEffect(() => {
    if (!currentTenant?.id) return;
    try {
      const productsRef = collection(db, "users", currentTenant.id, "products");
      const unsubscribe = onSnapshot(
        productsRef,
        (snapshot) => {
          if (!snapshot.empty) {
            const cloudProds: Product[] = [];
            snapshot.forEach((docSnap) => {
              const data = docSnap.data();
              cloudProds.push({
                id: docSnap.id,
                name: data.name || "Product",
                price: Number(data.price) || 0,
                category: data.category || "General",
                stock: Number(data.stock) || 0,
                description: data.description || "",
                imageUrl: data.image_url || data.imageUrl || "",
                attributes: data.attributes || {},
                createdAt: data.created_at || data.createdAt || new Date().toISOString(),
              });
            });
            if (cloudProds.length > 0) {
              setTenantProducts((prev) => ({
                ...prev,
                [currentTenant.id]: cloudProds,
              }));
            }
          }
        },
        (error) => {
          // Graceful fallback to local storage if offline or permission denied
          console.debug("[Firestore Realtime Sync] Offline/Local mode active:", error.message);
        }
      );
      return () => unsubscribe();
    } catch (err) {
      console.debug("[Firestore Init] Fallback to local storage:", err);
    }
  }, [currentTenant?.id]);

  // Firestore Real-Time Listener for Current Tenant Notifications
  useEffect(() => {
    if (!currentTenant?.id) return;
    try {
      const notifsRef = collection(db, "users", currentTenant.id, "notifications");
      const unsubscribe = onSnapshot(
        notifsRef,
        (snapshot) => {
          const cloudNotifs: NotificationItem[] = [];
          snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            cloudNotifs.push({
              id: docSnap.id,
              category: data.category || "system",
              title: data.title || "",
              customerName: data.customerName || data.customer_name || "",
              platform: data.platform || "",
              phone: data.phone || "",
              address: data.address || "",
              messageSnippet: data.messageSnippet || data.message_snippet || "",
              details: data.details || {},
              isRead: !!data.isRead,
              createdAt: data.createdAt || data.created_at || new Date().toISOString(),
            });
          });
          // Sort descending by creation date/time (latest first)
          cloudNotifs.sort((a, b) => {
            const dateA = new Date(a.createdAt).getTime() || 0;
            const dateB = new Date(b.createdAt).getTime() || 0;
            return dateB - dateA;
          });
          setTenantNotifications((prev) => ({
            ...prev,
            [currentTenant.id]: cloudNotifs,
          }));
        },
        (error) => {
          console.debug("[Firestore Notifications Sync] Error or offline:", error.message);
        }
      );
      return () => unsubscribe();
    } catch (err) {
      console.debug("[Firestore Notifications Init] Error:", err);
    }
  }, [currentTenant?.id]);

  // Auto-cleanup for notifications older than 30 days
  useEffect(() => {
    if (!currentTenant?.id) return;
    const cleanupOldNotifications = async () => {
      try {
        const notifsRef = collection(db, "users", currentTenant.id, "notifications");
        const snapshot = await getDocs(notifsRef);
        const now = new Date().getTime();
        const thirtyDaysInMs = 30 * 24 * 60 * 60 * 1000;

        snapshot.forEach(async (docSnap) => {
          const data = docSnap.data();
          const createdAtStr = data.createdAt || data.created_at;
          if (createdAtStr) {
            const createdTime = new Date(createdAtStr).getTime();
            if (now - createdTime > thirtyDaysInMs) {
              await deleteDoc(doc(db, "users", currentTenant.id, "notifications", docSnap.id));
              console.log(`[Auto-Cleanup] Auto-deleted old notification: ${docSnap.id}`);
            }
          }
        });
      } catch (err) {
        console.debug("[Notifications Cleanup] Error cleaning up old notifications:", err);
      }
    };
    cleanupOldNotifications();
  }, [currentTenant?.id]);

  // On-demand Firestore Chatbot Replies state (saves read costs)
  const [isFetchingLogs, setIsFetchingLogs] = useState(false);
  const [lastLogsFetchedAt, setLastLogsFetchedAt] = useState<string | null>(null);
  const [hasLoadedLogsFromCloud, setHasLoadedLogsFromCloud] = useState<Record<string, boolean>>({});

  const handleFetchChatbotRepliesFromCloud = async (force = false) => {
    if (!currentTenant) return;
    if (!force && hasLoadedLogsFromCloud[currentTenant.id]) {
      return;
    }
    setIsFetchingLogs(true);
    try {
      const logsRef = collection(db, "users", currentTenant.id, "chatbot_replies");
      const snapshot = await getDocs(logsRef);
      const cloudLogs: WebhookLog[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        cloudLogs.push({
          id: docSnap.id,
          platform: data.platform || "whatsapp",
          customerName: data.customerName || data.customer_name || "",
          customerPhone: data.customerPhone || data.customer_phone || "",
          incomingText: data.incomingText || data.incoming_text || "",
          imageUrl: data.imageUrl || data.image_url || "",
          aiReply: data.aiReply || data.ai_reply || "",
          replyImageUrl: data.replyImageUrl || data.reply_image_url || "",
          responderType: data.responderType || data.responder_type || "ai",
          responderName: data.responderName || data.responder_name || "AI Agent",
          latencyMs: Number(data.latencyMs) || 0,
          timestamp: data.timestamp || "Just now",
          createdAt: data.createdAt || data.created_at || new Date().toISOString(),
          isDemo: false,
        });
      });
      cloudLogs.sort((a, b) => {
        const dateA = new Date(a.createdAt || 0).getTime() || 0;
        const dateB = new Date(b.createdAt || 0).getTime() || 0;
        return dateB - dateA;
      });

      setTenantLogs((prev) => {
        const existingLocalDemos = (prev[currentTenant.id] || []).filter((l) => l.isDemo);
        return {
          ...prev,
          [currentTenant.id]: [...existingLocalDemos, ...cloudLogs],
        };
      });
      setHasLoadedLogsFromCloud((prev) => ({ ...prev, [currentTenant.id]: true }));
      setLastLogsFetchedAt(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      // Also fetch live events from server endpoint
      try {
        const eventsRes = await fetch(`/api/social/events?tenant_id=${encodeURIComponent(currentTenant.id)}`);
        if (eventsRes.ok) {
          const eventsData = await eventsRes.json();
          if (Array.isArray(eventsData.events) && eventsData.events.length > 0) {
            eventsData.events.forEach((ev: any) => {
              if (!cloudLogs.some((l) => l.id === ev.id)) {
                cloudLogs.push({
                  id: ev.id,
                  platform: ev.platform || "facebook",
                  customerName: ev.customerName || "Customer",
                  customerPhone: ev.customerPhone || "",
                  incomingText: ev.incomingText || "",
                  imageUrl: ev.imageUrl || "",
                  aiReply: ev.aiReply || "",
                  replyImageUrl: ev.replyImageUrl || "",
                  responderType: ev.responderType || "ai",
                  responderName: ev.responderName || "Gemini AI Agent",
                  latencyMs: Number(ev.latencyMs) || 0,
                  timestamp: ev.timestamp || "Just now",
                  createdAt: ev.createdAt || new Date().toISOString(),
                  isDemo: false,
                });
              }
            });
          }
        }
      } catch (evtErr) {
        console.debug("[Live Server Events Poll Notice]:", evtErr);
      }
    } catch (err) {
      console.debug("[Firestore Chatbot Replies Fetch Error]:", err);
    } finally {
      setIsFetchingLogs(false);
    }
  };

  const handleTabChange = (tab: "social" | "products" | "simulator" | "vector" | "logs") => {
    setActiveTab(tab);
    if (tab === "logs") {
      handleFetchChatbotRepliesFromCloud(false);
    }
  };

  // Auto-cleanup for chatbot logs older than 2 days (48 hours)
  useEffect(() => {
    if (!currentTenant?.id) return;
    const cleanupOldChatbotLogs = async () => {
      try {
        const logsRef = collection(db, "users", currentTenant.id, "chatbot_replies");
        const snapshot = await getDocs(logsRef);
        const now = new Date().getTime();
        const fortyEightHoursInMs = 2 * 24 * 60 * 60 * 1000; // 48 hours

        snapshot.forEach(async (docSnap) => {
          const data = docSnap.data();
          const createdAtStr = data.createdAt || data.created_at;
          if (createdAtStr) {
            const createdTime = new Date(createdAtStr).getTime();
            if (now - createdTime > fortyEightHoursInMs) {
              await deleteDoc(doc(db, "users", currentTenant.id, "chatbot_replies", docSnap.id));
              console.log(`[Auto-Cleanup] Auto-deleted old chatbot log: ${docSnap.id}`);
            }
          }
        });
      } catch (err) {
        console.debug("[Chatbot Logs Cleanup] Error cleaning up old logs:", err);
      }
    };
    cleanupOldChatbotLogs();
  }, [currentTenant?.id]);

  // Firestore Listener for Users Collection to sync registered tenants across devices/sessions
  useEffect(() => {
    try {
      const usersRef = collection(db, "users");
      const unsubscribe = onSnapshot(
        usersRef,
        (snapshot) => {
          const cloudUsers: TenantUser[] = [];
          if (!snapshot.empty) {
            snapshot.forEach((docSnap) => {
              const data = docSnap.data();
              const userEmail = data.email || data.username;
              if (userEmail) {
                cloudUsers.push({
                  id: docSnap.id,
                  shopName: data.shop_name || data.shopName || "My Store",
                  email: userEmail,
                  password: data.password || "",
                  businessCategory: data.business_category || data.businessCategory || "General",
                  createdAt: data.created_at || data.createdAt || new Date().toISOString(),
                });
              }
            });
          }
          setTenants(cloudUsers);
          localStorage.setItem("shop_agent_tenants", JSON.stringify(cloudUsers));

          // If current logged-in user was deleted from Firestore, log them out
          setCurrentTenant((prev) => {
            if (!prev) return null;
            const exists = cloudUsers.some(
              (u) => u.id === prev.id || u.email.toLowerCase() === prev.email.toLowerCase()
            );
            return exists ? prev : null;
          });
        },
        (error) => {
          console.debug("[Firestore Users Sync] Offline/Local fallback:", error.message);
        }
      );
      return () => unsubscribe();
    } catch (err) {
      console.debug("[Firestore Users Init] Offline local:", err);
    }
  }, []);

  // Tenant Authentication Handlers
  const handleLogin = (user: TenantUser) => {
    setCurrentTenant(user);
    if (!tenantProducts[user.id]) {
      setTenantProducts((prev) => ({
        ...prev,
        [user.id]: [],
      }));
    }
  };

  const handleLogout = () => {
    setCurrentTenant(null);
  };

  const handleRegister = async (shopName: string, email: string, password: string): Promise<TenantUser> => {
    const newId = `tenant_${Date.now().toString(36)}`;
    const newTenant: TenantUser = {
      id: newId,
      shopName,
      email,
      password,
      businessCategory: "General Retail",
      createdAt: new Date().toISOString(),
    };

    // Update local state
    setTenants((prev) => [...prev, newTenant]);
    setTenantProducts((prev) => ({
      ...prev,
      [newId]: [],
    }));

    // Async sync new user with username (email) and password directly to Firebase Firestore
    try {
      await setDoc(doc(db, "users", newTenant.id), {
        id: newTenant.id,
        username: newTenant.email,
        email: newTenant.email,
        password: newTenant.password,
        shop_name: newTenant.shopName,
        created_at: newTenant.createdAt,
      }, { merge: true });

      // Seed default sample notifications in Cloud Firestore
      const defaultNotifs = [
        {
          id: "notif_ord_1",
          category: "order",
          title: "New Order Confirmed",
          customerName: "Tanvir Ahmed",
          platform: "WhatsApp Business",
          phone: "+8801712345678",
          address: "House #42, Road #11, Sector #4, Uttara, Dhaka",
          messageSnippet: "Navy Blue Velvet Panjabi (Size L). Delivery please.",
          details: { order_value: 3850, item: "Royal Velvet Panjabi", qty: 1 },
          isRead: false,
          createdAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
        },
        {
          id: "notif_abs_1",
          category: "abuse",
          title: "Customer Escalation Flagged",
          customerName: "Rahim Chowdhury",
          platform: "Facebook Messenger",
          messageSnippet: "Apnader service ekdom faltu! Fraud shop, ekhono parcel ashe nai keno? Case korbo!",
          details: { severity: "high", reason: "Aggressive profanity & legal threat" },
          isRead: false,
          createdAt: new Date(Date.now() - 12 * 60 * 1000).toISOString(),
        },
        {
          id: "notif_sys_1",
          category: "system",
          title: "⚠️ AI টোকেন বা ব্যবহারের লিমিট শেষ হয়েছে",
          customerName: "সিস্টেম নোটিশ",
          platform: "Gemini AI Engine",
          messageSnippet: "আপনার AI চ্যাটবটের ব্যবহারের লিমিট বা টোকেন শেষ হয়ে গিয়েছে। চ্যাটবট সচল করতে আপনার প্যাকেজ বা API Key আপডেট করুন অথবা সফটওয়্যার কোম্পানির সাথে কথা বলুন।",
          details: { error_code: "429_QUOTA_EXCEEDED", silent_handled: true },
          isRead: false,
          createdAt: new Date(Date.now() - 28 * 60 * 1000).toISOString(),
        },
        {
          id: "notif_ord_2",
          category: "order",
          title: "Customer Address Provided",
          customerName: "Nusrat Jahan",
          platform: "Facebook Messenger",
          phone: "+8801822334455",
          address: "Flat 5A, Plot #14, Block C, Banani, Dhaka",
          messageSnippet: "Ami Cotton Saree ta nibo, cash on delivery te pathaben please.",
          details: { order_value: 2600, item: "Artisan Silk Saree" },
          isRead: false,
          createdAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
        },
      ];

      for (const notif of defaultNotifs) {
        await setDoc(doc(db, "users", newTenant.id, "notifications", notif.id), notif);
      }
    } catch (err) {
      console.debug("[Firestore Register] Syncing fallback to local state:", err);
    }

    return newTenant;
  };

  // Current Tenant's Data
  const currentProducts = currentTenant
    ? tenantProducts[currentTenant.id] || INITIAL_PRODUCTS[currentTenant.id] || []
    : [];

  const currentSocialConfigs = currentTenant
    ? tenantSocialConfigs[currentTenant.id] || INITIAL_SOCIAL_CONFIGS.default
    : INITIAL_SOCIAL_CONFIGS.default;

  const currentLogs = currentTenant
    ? tenantLogs[currentTenant.id] || INITIAL_WEBHOOK_LOGS
    : INITIAL_WEBHOOK_LOGS;

  const currentNotifications = currentTenant
    ? tenantNotifications[currentTenant.id] || tenantNotifications.default || []
    : [];

  // Notification Operations (Writing directly to Cloud Firestore)
  const handleToggleNotificationRead = async (id: string) => {
    if (!currentTenant) return;
    const currentList = tenantNotifications[currentTenant.id] || [];
    const item = currentList.find((n) => n.id === id);
    if (!item) return;

    // Optimistically update local UI state
    setTenantNotifications((prev) => {
      const list = prev[currentTenant.id] || [];
      const updated = list.map((n) => (n.id === id ? { ...n, isRead: !n.isRead } : n));
      return { ...prev, [currentTenant.id]: updated };
    });

    try {
      const notifRef = doc(db, "users", currentTenant.id, "notifications", id);
      await setDoc(notifRef, { isRead: !item.isRead }, { merge: true });
    } catch (e) {
      console.debug("[Firestore Toggle Read] Error updating cloud:", e);
    }
  };

  const handleMarkTabRead = async (category: "all" | "order" | "abuse" | "system") => {
    if (!currentTenant) return;
    const currentList = tenantNotifications[currentTenant.id] || [];
    const unreadFiltered = currentList.filter((n) => (category === "all" || n.category === category) && !n.isRead);

    // Optimistically update local UI state
    setTenantNotifications((prev) => {
      const list = prev[currentTenant.id] || [];
      const updated = list.map((n) => (category === "all" || n.category === category ? { ...n, isRead: true } : n));
      return { ...prev, [currentTenant.id]: updated };
    });

    try {
      for (const n of unreadFiltered) {
        const notifRef = doc(db, "users", currentTenant.id, "notifications", n.id);
        await setDoc(notifRef, { isRead: true }, { merge: true });
      }
    } catch (e) {
      console.debug("[Firestore Mark Tab Read] Error updating cloud:", e);
    }
  };

  const handleClearTab = async (category: "all" | "order" | "abuse" | "system") => {
    if (!currentTenant) return;
    const currentList = tenantNotifications[currentTenant.id] || [];
    const itemsToDelete = category === "all" ? currentList : currentList.filter((n) => n.category === category);

    // Optimistically update local UI state
    setTenantNotifications((prev) => {
      const list = prev[currentTenant.id] || [];
      const updated = category === "all" ? [] : list.filter((n) => n.category !== category);
      return { ...prev, [currentTenant.id]: updated };
    });

    try {
      for (const n of itemsToDelete) {
        const notifRef = doc(db, "users", currentTenant.id, "notifications", n.id);
        await deleteDoc(notifRef);
      }
    } catch (e) {
      console.debug("[Firestore Clear Tab] Error updating cloud:", e);
    }
  };

  const handleDeleteNotification = async (id: string) => {
    if (!currentTenant) return;

    // Optimistically update local UI state
    setTenantNotifications((prev) => {
      const list = prev[currentTenant.id] || [];
      const updated = list.filter((n) => n.id !== id);
      return { ...prev, [currentTenant.id]: updated };
    });

    try {
      const notifRef = doc(db, "users", currentTenant.id, "notifications", id);
      await deleteDoc(notifRef);
    } catch (e) {
      console.debug("[Firestore Delete Notification] Error updating cloud:", e);
    }
  };

  const handleAddNotification = async (
    item: Omit<NotificationItem, "id" | "isRead" | "createdAt"> & {
      id?: string;
      isRead?: boolean;
      createdAt?: string;
    }
  ) => {
    if (!currentTenant) return;
    const newId = item.id || `notif_${item.category.slice(0, 3)}_${Date.now()}`;
    const isoString = new Date().toISOString();
    const newItem: NotificationItem = {
      ...item,
      id: newId,
      isRead: item.isRead !== undefined ? item.isRead : false,
      createdAt: item.createdAt || isoString,
    };

    // Optimistically update local UI state
    setTenantNotifications((prev) => {
      const list = prev[currentTenant.id] || [];
      return { ...prev, [currentTenant.id]: [newItem, ...list] };
    });

    try {
      const notifRef = doc(db, "users", currentTenant.id, "notifications", newId);
      await setDoc(notifRef, {
        id: newItem.id,
        category: newItem.category,
        title: newItem.title,
        customerName: newItem.customerName || "",
        platform: newItem.platform || "",
        phone: newItem.phone || "",
        address: newItem.address || "",
        messageSnippet: newItem.messageSnippet || "",
        details: newItem.details || {},
        isRead: newItem.isRead,
        createdAt: newItem.createdAt,
      }, { merge: true });
    } catch (e) {
      console.debug("[Firestore Add Notification] Error updating cloud:", e);
    }
  };

  // Product Operations
  const handleAddProduct = async (newProd: Omit<Product, "id" | "createdAt">) => {
    if (!currentTenant) return;
    const newId = `prod_${Date.now().toString(36)}`;
    const prod: Product = {
      ...newProd,
      id: newId,
      createdAt: new Date().toISOString(),
    };

    setTenantProducts((prev) => ({
      ...prev,
      [currentTenant.id]: [prod, ...(prev[currentTenant.id] || [])],
    }));

    // Async sync to Firestore
    try {
      const prodDocRef = doc(db, "users", currentTenant.id, "products", newId);
      await setDoc(prodDocRef, {
        id: newId,
        name: prod.name,
        price: prod.price,
        category: prod.category,
        stock: prod.stock,
        description: prod.description,
        image_url: prod.imageUrl || "",
        attributes: prod.attributes || {},
        created_at: prod.createdAt,
      }, { merge: true });
    } catch (e) {
      console.debug("[Firestore Save] Offline local fallback active:", e);
    }
  };

  const handleDeleteProduct = async (id: string) => {
    if (!currentTenant) return;
    setTenantProducts((prev) => ({
      ...prev,
      [currentTenant.id]: (prev[currentTenant.id] || []).filter((p) => p.id !== id),
    }));

    // Async sync to Firestore
    try {
      const prodDocRef = doc(db, "users", currentTenant.id, "products", id);
      await deleteDoc(prodDocRef);
    } catch (e) {
      console.debug("[Firestore Delete] Offline local fallback active:", e);
    }
  };

  const handleEditProduct = async (updated: Product) => {
    if (!currentTenant) return;
    setTenantProducts((prev) => ({
      ...prev,
      [currentTenant.id]: (prev[currentTenant.id] || []).map((p) =>
        p.id === updated.id ? updated : p
      ),
    }));

    // Async sync to Firestore
    try {
      const prodDocRef = doc(db, "users", currentTenant.id, "products", updated.id);
      await setDoc(prodDocRef, {
        name: updated.name,
        price: updated.price,
        category: updated.category,
        stock: updated.stock,
        description: updated.description,
        image_url: updated.imageUrl || "",
        attributes: updated.attributes || {},
        updated_at: new Date().toISOString(),
      }, { merge: true });
    } catch (e) {
      console.debug("[Firestore Update] Offline local fallback active:", e);
    }
  };

  // Social Config Operations
  const handleUpdateSocialConfig = async (updated: SocialConfig) => {
    if (!currentTenant) return;
    setTenantSocialConfigs((prev) => {
      const existingList = prev[currentTenant.id] || INITIAL_SOCIAL_CONFIGS.default;
      const newList = existingList.map((c) => (c.platform === updated.platform ? updated : c));
      return {
        ...prev,
        [currentTenant.id]: newList,
      };
    });

    // Save to Firestore under users/{tenantId}
    try {
      const userRef = doc(db, "users", currentTenant.id);
      await setDoc(userRef, {
        [`social_config_${updated.platform}`]: {
          platform: updated.platform,
          name: updated.name,
          isConnected: updated.isConnected,
          webhookUrl: updated.webhookUrl,
          verifyToken: updated.verifyToken,
          pageId: updated.pageId,
          accessToken: updated.accessToken,
          pageName: updated.pageName || "",
          lastSync: updated.lastSync || "Just now",
          updatedAt: new Date().toISOString(),
        },
      }, { merge: true });
    } catch (e) {
      console.debug("[Firestore Social Config Sync] Offline fallback:", e);
    }
  };

  // Real-time listener for incoming Meta Webhooks delivered to server
  const processedRealEventIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!currentTenant) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/social/events?tenant_id=${currentTenant.id}`);
        if (!res.ok) return;
        const data = await res.json();
        if (Array.isArray(data.events)) {
          for (const ev of data.events) {
            if (!processedRealEventIds.current.has(ev.id)) {
              processedRealEventIds.current.add(ev.id);
              const newLog: WebhookLog = {
                id: ev.id,
                platform: ev.platform || "facebook",
                customerName: ev.customerName || "Facebook Customer",
                customerPhone: ev.customerPhone || "",
                incomingText: ev.incomingText || "Customer message received",
                imageUrl: ev.imageUrl,
                aiReply: ev.aiReply || "Acknowledged",
                latencyMs: ev.latencyMs || 450,
                timestamp: "Just now",
                responderType: "ai",
                responderName: "Gemini AI Agent",
                isDemo: false,
              };
              await handleAddChatbotReply(newLog, true);
              handleAddNotification({
                category: "order",
                title: "New Facebook Message",
                customerName: ev.customerName || "Facebook Messenger User",
                platform: "Facebook Messenger",
                messageSnippet: ev.incomingText || "New incoming Facebook inquiry",
                isRead: false,
              });
            }
          }
        }
      } catch (err) {
        // silent background check
      }
    }, 6000);

    return () => clearInterval(interval);
  }, [currentTenant]);

  // Chatbot Response Logs (Writing to Cloud Firestore only when real, not for demo/tests)
  const handleAddChatbotReply = async (
    log: Omit<WebhookLog, "createdAt"> & { createdAt?: string },
    saveToCloud = false
  ) => {
    if (!currentTenant) return;
    const logId = log.id || `wh_${Date.now()}`;
    const isoString = new Date().toISOString();
    const newLogEntry: WebhookLog = {
      ...log,
      id: logId,
      createdAt: log.createdAt || isoString,
    };

    // Optimistically update local UI state
    setTenantLogs((prev) => {
      const list = prev[currentTenant.id] || [];
      return { ...prev, [currentTenant.id]: [newLogEntry, ...list] };
    });

    // Save to Firestore only if explicitly requested, not a demo test, and is an AI/Robot reply
    if (saveToCloud && !newLogEntry.isDemo && newLogEntry.responderType === "ai") {
      try {
        const logRef = doc(db, "users", currentTenant.id, "chatbot_replies", logId);
        await setDoc(logRef, {
          id: newLogEntry.id,
          platform: newLogEntry.platform,
          customerName: newLogEntry.customerName || "",
          customerPhone: newLogEntry.customerPhone || "",
          incomingText: newLogEntry.incomingText || "",
          imageUrl: newLogEntry.imageUrl || "",
          aiReply: newLogEntry.aiReply || "",
          replyImageUrl: newLogEntry.replyImageUrl || "",
          responderType: newLogEntry.responderType,
          responderName: newLogEntry.responderName || "AI Agent",
          latencyMs: newLogEntry.latencyMs || 0,
          timestamp: newLogEntry.timestamp || "Just now",
          createdAt: newLogEntry.createdAt,
        }, { merge: true });
      } catch (e) {
        console.debug("[Firestore Add Chatbot Reply] Error updating cloud:", e);
      }
    }
  };

  const handleDeleteLog = async (id: string) => {
    if (!currentTenant) return;
    const logToDelete = (tenantLogs[currentTenant.id] || []).find((l) => l.id === id);

    // Optimistically remove from local state
    setTenantLogs((prev) => {
      const list = prev[currentTenant.id] || [];
      return {
        ...prev,
        [currentTenant.id]: list.filter((l) => l.id !== id),
      };
    });

    // If it was stored in Firestore, delete from cloud
    if (logToDelete && !logToDelete.isDemo) {
      try {
        const logRef = doc(db, "users", currentTenant.id, "chatbot_replies", id);
        await deleteDoc(logRef);
      } catch (err) {
        console.debug("[Firestore Delete Chatbot Reply Error]:", err);
      }
    }
  };

  const handleClearDemoLogs = () => {
    if (!currentTenant) return;
    setTenantLogs((prev) => {
      const list = prev[currentTenant.id] || [];
      return {
        ...prev,
        [currentTenant.id]: list.filter((l) => !l.isDemo),
      };
    });
  };

  // Webhook Simulation (Demo tests - strictly local, NO Firestore database writes)
  const handleSimulateIncomingWebhook = async (
    platform: "facebook" | "instagram" | "whatsapp" | "tiktok",
    options?: { withImage?: boolean; simulatedHumanReply?: boolean }
  ) => {
    if (!currentTenant) return;

    const sampleQueries: Record<string, { sender: string; text: string; imageUrl?: string }> = {
      whatsapp: {
        sender: "Rafiqul Islam (WA +8801811223344)",
        text: currentProducts.length > 0
          ? `Bhai apnader ${currentProducts[0].name} ta ki stock e ache? dam koto ar delivery charge koto?`
          : "Bhai apnader store e ki available ache?",
        imageUrl: options?.withImage && currentProducts.length > 0
          ? currentProducts[0].imageUrl
          : undefined,
      },
      facebook: {
        sender: "Nusrat Jahan (Messenger)",
        text: currentProducts.length > 1
          ? `Hello, ${currentProducts[1].name} er size M hobe? Order korte ki ki lagbe?`
          : "Hello, shop open ache?",
      },
      instagram: {
        sender: "style_enthusiast_bd (Instagram DM)",
        text: "Price of this item please? Can you deliver inside Dhaka today? 🔥",
        imageUrl: options?.withImage
          ? "https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=600&auto=format&fit=crop&q=80"
          : undefined,
      },
      tiktok: {
        sender: "tiktok_user_992 (TikTok Shop Message)",
        text: "Item ta nite chai bhai, cash on delivery available?",
      },
    };

    const target = sampleQueries[platform];

    if (options?.simulatedHumanReply) {
      // Simulating a real human agent replying from Meta Business Suite / WA Business App
      const newLog: WebhookLog = {
        id: `demo_human_${Date.now()}`,
        platform,
        customerName: target.sender,
        incomingText: target.text,
        imageUrl: target.imageUrl,
        aiReply: "Assalamu Alaikum! Ami Tanjil bolchi support theke. Apnar address ta din please, amra ajkei courier handover kore dicchi!",
        responderType: "human_agent",
        responderName: "Tanjil (Human Support Staff)",
        latencyMs: 0,
        timestamp: "Just now",
        isDemo: true,
        expiresAt: Date.now() + 90000,
      };

      await handleAddChatbotReply(newLog, false);
      setActiveTab("logs");
      return;
    }

    try {
      const res = await fetch("/api/gemini/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: target.text,
          platform,
          customerName: target.sender,
          shopName: currentTenant.shopName,
          products: currentProducts,
        }),
      });
      const data = await res.json();

      // If backend caught a 429 rate limit or quota exception:
      if (data.systemAlert) {
        handleAddNotification({
          category: "system",
          title: data.systemAlert.title || "⚠️ AI টোকেন বা ব্যবহারের লিমিট শেষ হয়েছে",
          customerName: "সিস্টেম নোটিশ",
          platform: "Gemini AI Engine",
          messageSnippet: data.systemAlert.details || "আপনার AI চ্যাটবটের ব্যবহারের লিমিট বা টোকেন শেষ হয়ে গেছে। চ্যাটবট পুনরায় সচল করতে প্যাকেজ বা API Key আপডেট করুন অথবা সফটওয়্যার মালিক/কোম্পানির সাথে যোগাযোগ করুন।",
          details: { errorCode: data.systemAlert.errorCode },
          isRead: false,
        });
      }

      const newLog: WebhookLog = {
        id: `demo_ai_${Date.now()}`,
        platform,
        customerName: target.sender,
        incomingText: target.text,
        imageUrl: target.imageUrl,
        aiReply: data.reply || "Automatic response generated and delivered.",
        replyImageUrl: currentProducts[0]?.imageUrl,
        responderType: "ai",
        latencyMs: data.latencyMs || 340,
        timestamp: "Just now",
        isDemo: true,
        expiresAt: Date.now() + 90000,
      };

      await handleAddChatbotReply(newLog, false);

      // Switch to logs tab to view result
      setActiveTab("logs");
    } catch (e: any) {
      console.error(e);
      handleAddNotification({
        category: "system",
        title: "API Network/Connection Alert",
        customerName: "System Guardian",
        platform: "AI Gateway",
        messageSnippet: e?.message || "Connection exception caught silently.",
        isRead: false,
      });
    }
  };

  const handleLogInteraction = async (msg: ChatMessage) => {
    if (!currentTenant) return;
    const newLog: WebhookLog = {
      id: `demo_chat_${Date.now()}`,
      platform: "whatsapp",
      customerName: msg.customerName || "Simulator Shopper",
      incomingText: "Interactive live chat simulation inquiry",
      aiReply: msg.text,
      latencyMs: msg.latencyMs || 390,
      timestamp: "Just now",
      responderType: "ai",
      isDemo: true,
      expiresAt: Date.now() + 90000,
    };

    await handleAddChatbotReply(newLog, false);
  };

  return (
    <div className="flex flex-col h-screen w-full bg-[#F8FAFC] text-[#0F172A] font-sans antialiased overflow-hidden">
      {/* Windows 11 Desktop Titlebar & Navigation Ribbon */}
      <DesktopWindowChrome
        currentTenant={currentTenant}
        onLogout={handleLogout}
        activeTab={activeTab}
        onTabChange={handleTabChange}
        onOpenCodeHub={() => setIsCodeHubOpen(true)}
        notifications={currentNotifications}
        onToggleRead={handleToggleNotificationRead}
        onMarkTabRead={handleMarkTabRead}
        onClearTab={handleClearTab}
        onDeleteNotification={handleDeleteNotification}
        onAddNotification={handleAddNotification}
      />

      {/* Main Workspace View Area with proper min-h-0 container */}
      <main className="flex-1 min-h-0 min-w-0 flex flex-col relative overflow-hidden">
        {!currentTenant ? (
          <AuthScreen
            onLogin={handleLogin}
            tenants={tenants}
            onRegister={handleRegister}
          />
        ) : (
          <>
            {activeTab === "social" && (
              <SocialIntegrations
                configs={currentSocialConfigs}
                currentTenant={currentTenant}
                onUpdateConfig={handleUpdateSocialConfig}
                onSimulateIncomingWebhook={handleSimulateIncomingWebhook}
              />
            )}

            {activeTab === "products" && (
              <ProductCatalog
                products={currentProducts}
                currentTenant={currentTenant}
                onAddProduct={handleAddProduct}
                onEditProduct={handleEditProduct}
                onDeleteProduct={handleDeleteProduct}
              />
            )}

            {activeTab === "simulator" && (
              <AiCustomerSimulator
                currentTenant={currentTenant}
                products={currentProducts}
                onLogInteraction={handleLogInteraction}
                onAddNotification={handleAddNotification}
              />
            )}

            {activeTab === "vector" && (
              <VectorSearchInspector
                products={currentProducts}
                currentTenant={currentTenant}
              />
            )}

            {activeTab === "logs" && (
              <WebhookEventLogs
                logs={currentLogs}
                currentTenant={currentTenant}
                onSimulateIncomingWebhook={handleSimulateIncomingWebhook}
                onFetchCloudLogs={() => handleFetchChatbotRepliesFromCloud(true)}
                isFetchingLogs={isFetchingLogs}
                lastLogsFetchedAt={lastLogsFetchedAt}
                onDeleteLog={handleDeleteLog}
                onClearDemoLogs={handleClearDemoLogs}
              />
            )}
          </>
        )}
      </main>

      {/* Python Source Code & ZIP Exporter Modal */}
      {isCodeHubOpen && (
        <PythonCodeHub onClose={() => setIsCodeHubOpen(false)} />
      )}
    </div>
  );
}
