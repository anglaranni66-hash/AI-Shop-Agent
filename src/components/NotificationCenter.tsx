import React, { useState } from "react";
import {
  Bell,
  Package,
  AlertTriangle,
  Zap,
  CheckCheck,
  Trash2,
  Phone,
  MapPin,
  Clock,
  CheckCircle2,
  ChevronDown,
  Copy,
  Check,
} from "lucide-react";
import { TenantUser, NotificationItem } from "../types";

export type { NotificationItem };

interface Props {
  currentTenant: TenantUser | null;
  notifications?: NotificationItem[];
  onToggleRead?: (id: string) => void;
  onMarkTabRead?: (category: "all" | "order" | "abuse" | "system") => void;
  onClearTab?: (category: "all" | "order" | "abuse" | "system") => void;
  onDeleteItem?: (id: string) => void;
  onAddNotification?: (
    item: Omit<NotificationItem, "id" | "isRead" | "createdAt"> & {
      id?: string;
      isRead?: boolean;
      createdAt?: string;
    }
  ) => void;
}

export const NotificationCenter: React.FC<Props> = ({
  currentTenant,
  notifications: propNotifications,
  onToggleRead: propOnToggleRead,
  onMarkTabRead: propOnMarkTabRead,
  onClearTab: propOnClearTab,
  onDeleteItem: propOnDeleteItem,
  onAddNotification: propOnAddNotification,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"all" | "order" | "abuse" | "system">("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => {
      setCopiedId(null);
    }, 1500);
  };

  // Intercepting deletes for confirmation prompts
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [clearTargetCategory, setClearTargetCategory] = useState<"all" | "order" | "abuse" | "system" | null>(null);

  // Local fallback state if props not provided
  const [localNotifications, setLocalNotifications] = useState<NotificationItem[]>([
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
      createdAt: "5 mins ago",
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
      createdAt: "12 mins ago",
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
      createdAt: "28 mins ago",
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
      createdAt: "1 hour ago",
    },
  ]);

  const notifications = propNotifications !== undefined ? propNotifications : localNotifications;

  const unreadCount = notifications.filter((n) => !n.isRead).length;
  const orderUnread = notifications.filter((n) => n.category === "order" && !n.isRead).length;
  const abuseUnread = notifications.filter((n) => n.category === "abuse" && !n.isRead).length;
  const systemUnread = notifications.filter((n) => n.category === "system" && !n.isRead).length;

  const currentList =
    activeTab === "all"
      ? notifications
      : notifications.filter((n) => n.category === activeTab);

  const handleMarkTabAsRead = () => {
    if (propOnMarkTabRead) {
      propOnMarkTabRead(activeTab);
    } else {
      setLocalNotifications((prev) =>
        prev.map((n) => (activeTab === "all" || n.category === activeTab ? { ...n, isRead: true } : n))
      );
    }
  };

  const handleClearTabTrigger = () => {
    setClearTargetCategory(activeTab);
  };

  const handleClearTabConfirm = () => {
    if (clearTargetCategory) {
      if (propOnClearTab) {
        propOnClearTab(clearTargetCategory);
      } else {
        setLocalNotifications((prev) =>
          clearTargetCategory === "all" ? [] : prev.filter((n) => n.category !== clearTargetCategory)
        );
      }
    }
    setClearTargetCategory(null);
  };

  const handleToggleItemRead = (id: string) => {
    if (propOnToggleRead) {
      propOnToggleRead(id);
    } else {
      setLocalNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: !n.isRead } : n))
      );
    }
  };

  const handleDeleteItemTrigger = (id: string) => {
    setDeleteTargetId(id);
  };

  const handleDeleteItemConfirm = () => {
    if (deleteTargetId) {
      if (propOnDeleteItem) {
        propOnDeleteItem(deleteTargetId);
      } else {
        setLocalNotifications((prev) => prev.filter((n) => n.id !== deleteTargetId));
      }
    }
    setDeleteTargetId(null);
  };

  const handleAddSample = (type: "order" | "abuse" | "system") => {
    if (type === "order") {
      const newOrder = {
        category: "order" as const,
        title: "New Order Detected",
        customerName: "Sabbir Hossain",
        platform: "WhatsApp Business",
        phone: "+8801911998877",
        address: "House 18, Road 3, Dhanmondi 27, Dhaka",
        messageSnippet: "Bhai delivery confirm koren, address & phone dilam.",
        isRead: false,
      };
      if (propOnAddNotification) {
        propOnAddNotification(newOrder);
      } else {
        setLocalNotifications((prev) => [
          { ...newOrder, id: `notif_ord_${Date.now()}`, createdAt: "Just now" },
          ...prev,
        ]);
      }
      setActiveTab("order");
    } else if (type === "abuse") {
      const newAbuse = {
        category: "abuse" as const,
        title: "Threat / Abusive Language Flagged",
        customerName: "Angry Shopper",
        platform: "Facebook Messenger",
        messageSnippet: "Chor batpar shop! Delivery keno hoy nai? Sobai ke bolbo batpar!",
        isRead: false,
      };
      if (propOnAddNotification) {
        propOnAddNotification(newAbuse);
      } else {
        setLocalNotifications((prev) => [
          { ...newAbuse, id: `notif_abs_${Date.now()}`, createdAt: "Just now" },
          ...prev,
        ]);
      }
      setActiveTab("abuse");
    } else {
      const newSys = {
        category: "system" as const,
        title: "⚠️ AI টোকেন বা ব্যবহারের লিমিট শেষ হয়েছে",
        customerName: "সিস্টেম নোটিশ",
        platform: "Gemini AI Engine",
        messageSnippet: "আপনার AI চ্যাটবটের ব্যবহারের লিমিট বা টোকেন শেষ হয়ে গেছে। চ্যাটবট পুনরায় সচল করতে প্যাকেজ বা API Key আপডেট করুন অথবা সফটওয়্যারের মালিক/কোম্পানির সাথে যোগাযোগ করুন।",
        isRead: false,
      };
      if (propOnAddNotification) {
        propOnAddNotification(newSys);
      } else {
        setLocalNotifications((prev) => [
          { ...newSys, id: `notif_sys_${Date.now()}`, createdAt: "Just now" },
          ...prev,
        ]);
      }
      setActiveTab("system");
    }
  };

  return (
    <>
      {/* 🔔 Header Notification Bell Button */}
      <button
        id="btn-notification-bell"
        onClick={() => setIsOpen(true)}
        className="relative flex items-center space-x-1.5 bg-[#FFFFFF] hover:bg-[#F1F5F9] border border-[#CBD5E1] text-[#0F172A] px-2.5 py-1 rounded-md text-xs font-semibold transition-all shadow-xs cursor-pointer"
        title="Open Notification & Escalation Center"
      >
        <Bell className="w-3.5 h-3.5 text-blue-600" />
        <span className="hidden sm:inline">Notifications</span>
        {unreadCount > 0 ? (
          <span
            id="notification-unread-badge"
            className="flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold text-white bg-red-600 rounded-full animate-pulse shadow-xs"
          >
            {unreadCount}
          </span>
        ) : null}
      </button>

      {/* 3-Tab Modal / Flyout Center */}
      {isOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div
            id="notification-modal-container"
            className="bg-[#FFFFFF] border border-[#CBD5E1] rounded-2xl w-full max-w-3xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden text-[#0F172A]"
          >
            {/* Modal Header */}
            <div className="px-6 py-4 bg-[#F8FAFC] border-b border-[#E2E8F0] flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600">
                  <Bell className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <h2 className="text-base font-bold text-[#0F172A]">
                      Notifications &amp; Escalation Center
                    </h2>
                    {unreadCount > 0 ? (
                      <span className="bg-red-50 text-red-600 border border-red-200 text-[10px] font-bold px-2 py-0.5 rounded-full">
                        {unreadCount} Unread
                      </span>
                    ) : (
                      <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center space-x-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600 inline" />
                        <span>All Caught Up</span>
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[#64748B]">
                    Real-time order extractions, abusive chat alerts &amp; silent 429 quota exceptions.
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  id="btn-mark-tab-read"
                  onClick={handleMarkTabAsRead}
                  className="flex items-center space-x-1.5 text-xs text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer"
                  title="Mark all notifications in this view as read"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  <span>{activeTab === "all" ? "Mark All Read" : "Mark Tab Read"}</span>
                </button>
                <button
                  id="btn-clear-tab"
                  onClick={handleClearTabTrigger}
                  className="p-1.5 text-[#64748B] hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                  title={activeTab === "all" ? "Clear all notifications" : "Clear current tab"}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                <button
                  id="btn-close-notification-modal"
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 text-[#64748B] hover:text-[#0F172A] hover:bg-slate-100 rounded-lg transition-colors cursor-pointer text-lg font-mono leading-none"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Categorized Filter Tabs with Full Visibility */}
            <div className="shrink-0 bg-white border-b border-[#E2E8F0] px-6 py-2.5 overflow-x-auto">
              <div className="flex items-center gap-2 min-w-max">
                <button
                  id="tab-btn-all"
                  onClick={() => setActiveTab("all")}
                  className={`inline-flex items-center space-x-2 px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                    activeTab === "all"
                      ? "bg-blue-50 text-blue-700 border border-blue-300 font-bold shadow-2xs"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-transparent"
                  }`}
                >
                  <Bell className="w-3.5 h-3.5 text-blue-600" />
                  <span>All Notifications</span>
                  <span className="px-1.5 py-0.5 text-[10px] rounded-full bg-slate-200/80 text-slate-700 font-bold leading-none">
                    {notifications.length}
                  </span>
                  {unreadCount > 0 && (
                    <span className="px-1.5 py-0.5 text-[10px] rounded-full bg-red-100 text-red-700 font-bold leading-none">
                      {unreadCount} new
                    </span>
                  )}
                </button>

                <button
                  id="tab-btn-orders"
                  onClick={() => setActiveTab("order")}
                  className={`inline-flex items-center space-x-2 px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                    activeTab === "order"
                      ? "bg-emerald-50 text-emerald-700 border border-emerald-300 font-bold shadow-2xs"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-transparent"
                  }`}
                >
                  <Package className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Orders</span>
                  {orderUnread > 0 && (
                    <span className="px-1.5 py-0.5 text-[10px] rounded-full bg-emerald-100 text-emerald-800 font-bold leading-none">
                      {orderUnread}
                    </span>
                  )}
                </button>

                <button
                  id="tab-btn-abuse"
                  onClick={() => setActiveTab("abuse")}
                  className={`inline-flex items-center space-x-2 px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                    activeTab === "abuse"
                      ? "bg-amber-50 text-amber-800 border border-amber-300 font-bold shadow-2xs"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-transparent"
                  }`}
                >
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                  <span>Abusive / Escalated</span>
                  {abuseUnread > 0 && (
                    <span className="px-1.5 py-0.5 text-[10px] rounded-full bg-amber-100 text-amber-800 font-bold leading-none">
                      {abuseUnread}
                    </span>
                  )}
                </button>

                <button
                  id="tab-btn-system"
                  onClick={() => setActiveTab("system")}
                  className={`inline-flex items-center space-x-2 px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                    activeTab === "system"
                      ? "bg-rose-50 text-rose-700 border border-rose-300 font-bold shadow-2xs"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-transparent"
                  }`}
                >
                  <Zap className="w-3.5 h-3.5 text-rose-600" />
                  <span>System / API Alerts</span>
                  {systemUnread > 0 && (
                    <span className="px-1.5 py-0.5 text-[10px] rounded-full bg-rose-100 text-rose-800 font-bold leading-none">
                      {systemUnread}
                    </span>
                  )}
                </button>
              </div>
            </div>

            {/* List Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-3 bg-[#F8FAFC] custom-scrollbar">
              {currentList.length === 0 ? (
                <div className="py-12 text-center text-[#94A3B8]">
                  <p className="text-sm font-semibold text-[#64748B]">No notifications in this category.</p>
                  <p className="text-xs text-[#94A3B8] mt-1">
                    New background events will automatically populate here.
                  </p>
                  {activeTab !== "all" && (
                    <button
                      onClick={() => setActiveTab("all")}
                      className="mt-3 text-xs text-blue-600 hover:text-blue-700 font-bold bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-200 cursor-pointer"
                    >
                      View All ({notifications.length}) Notifications
                    </button>
                  )}
                </div>
              ) : (
                currentList.map((item) => {
                  const isExpanded = expandedId === item.id;
                  return (
                    <div
                      key={item.id}
                      id={`notif-card-${item.id}`}
                      onClick={() => {
                        const nextExpanded = !isExpanded;
                        setExpandedId(nextExpanded ? item.id : null);
                        if (nextExpanded && !item.isRead) {
                          handleToggleItemRead(item.id);
                        }
                      }}
                      className={`rounded-xl border transition-all duration-200 overflow-hidden cursor-pointer ${
                        !item.isRead
                          ? "bg-blue-50/25 border-blue-200 hover:border-blue-300 shadow-xs ring-1 ring-blue-50/50"
                          : "bg-white border-slate-150 hover:border-slate-300"
                      } ${isExpanded ? "shadow-md ring-1 ring-slate-100" : "hover:shadow-xs"}`}
                    >
                      {/* Compact Header (Always Visible) */}
                      <div className="p-4 flex items-center justify-between gap-4 select-none">
                        <div className="flex items-center space-x-3.5 min-w-0 flex-1">
                          {/* Category Visual Icon Anchor */}
                          <div
                            className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 border ${
                              item.category === "order"
                                ? "bg-emerald-50 border-emerald-100 text-emerald-600"
                                : item.category === "abuse"
                                ? "bg-amber-50 border-amber-100 text-amber-600"
                                : "bg-rose-50 border-rose-100 text-rose-600"
                            }`}
                          >
                            {item.category === "order" ? (
                              <Package className="w-4.5 h-4.5" />
                            ) : item.category === "abuse" ? (
                              <AlertTriangle className="w-4.5 h-4.5" />
                            ) : (
                              <Zap className="w-4.5 h-4.5" />
                            )}
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center space-x-2">
                              <span
                                className={`text-[9px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-full border ${
                                  item.category === "order"
                                    ? "bg-emerald-50/50 border-emerald-200 text-emerald-700"
                                    : item.category === "abuse"
                                    ? "bg-amber-50/50 border-amber-200 text-amber-700"
                                    : "bg-rose-50/50 border-rose-200 text-rose-700"
                                }`}
                              >
                                {item.category === "order" ? "নতুন অর্ডার" : item.category === "abuse" ? "গ্রাহক রিপোর্ট" : "সিস্টেম অ্যালার্ট"}
                              </span>
                              <span className="text-[11px] font-medium text-slate-500">
                                {item.platform || "Platform"}
                              </span>
                            </div>
                            <h3 className="text-[13px] font-bold text-slate-800 truncate mt-1">
                              {item.title}
                            </h3>
                          </div>
                        </div>

                        {/* Right-aligned Stats & Controls */}
                        <div className="flex items-center space-x-3 shrink-0">
                          <div className="flex flex-col items-end text-[11px] text-slate-400">
                            <div className="flex items-center space-x-1">
                              <Clock className="w-3 h-3 text-slate-300" />
                              <span className="font-medium">{item.createdAt}</span>
                            </div>
                            <div className="flex items-center space-x-1.5 mt-0.5">
                              {!item.isRead && (
                                <span className="w-2.5 h-2.5 rounded-full bg-blue-600 animate-pulse" title="Unread"></span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center space-x-1.5 border-l border-slate-100 pl-3">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleToggleItemRead(item.id);
                              }}
                              className="text-[11px] text-blue-600 hover:text-blue-700 hover:underline cursor-pointer font-bold px-1 py-0.5"
                            >
                              {item.isRead ? "Unread" : "Read"}
                            </button>
                            <button
                              id={`btn-delete-notif-${item.id}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteItemTrigger(item.id);
                              }}
                              className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all cursor-pointer"
                              title="মুছে ফেলুন"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          <ChevronDown
                            className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${
                              isExpanded ? "transform rotate-180 text-blue-600" : ""
                            }`}
                          />
                        </div>
                      </div>

                      {/* Expandable Body (Visible ONLY when active/expanded) */}
                      {isExpanded && (
                        <div className="border-t border-slate-100 bg-slate-50/40 p-4 animate-in fade-in slide-in-from-top-1 duration-200">
                          {item.category === "order" && (
                            <div className="bg-white border border-slate-150 rounded-xl p-4 shadow-xs space-y-4">
                              {/* 1. Consolidated Identification & Platform Source */}
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1">
                                  <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400">প্ল্যাটফর্ম (Platform Source)</div>
                                  <div className="text-xs font-bold text-slate-800 flex items-center space-x-1.5">
                                    <span>{(item.platform || "").toLowerCase().includes("whatsapp") ? "🟢" : (item.platform || "").toLowerCase().includes("messenger") ? "🔵" : (item.platform || "").toLowerCase().includes("instagram") ? "🟣" : (item.platform || "").toLowerCase().includes("tiktok") ? "🖤" : "🟢"}</span>
                                    <span>{item.platform || "Platform"}</span>
                                  </div>
                                </div>
                                <div className="space-y-1">
                                  <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400">কাস্টমার আইডি / নাম</div>
                                  <div className="text-xs font-bold text-slate-800 flex items-center space-x-2">
                                    <span>👤</span>
                                    <span>{item.phone || item.customerName || "Customer"}</span>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        const idToCopy = item.phone || item.customerName || "";
                                        handleCopyToClipboard(idToCopy, `id-${item.id}`);
                                      }}
                                      className="px-1.5 py-0.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 bg-slate-100/80 rounded border border-slate-200 transition-all cursor-pointer flex items-center space-x-1"
                                      title="আইডি বা নাম কপি করুন"
                                    >
                                      {copiedId === `id-${item.id}` ? (
                                        <span className="text-[10px] text-emerald-600 font-bold">কপি হয়েছে! ✓</span>
                                      ) : (
                                        <>
                                          <Copy className="w-3 h-3 text-slate-500" />
                                          <span className="text-[10px] font-semibold text-slate-600">কপি</span>
                                        </>
                                      )}
                                    </button>
                                  </div>
                                </div>
                              </div>

                              {/* 2. Raw Message Order Box & Copy */}
                              <div className="space-y-2 pt-3 border-t border-slate-100">
                                <div className="text-[10.5px] uppercase font-bold tracking-wider text-slate-500">কাস্টমারের দেওয়া তথ্য</div>
                                <textarea
                                  readOnly
                                  value={item.messageSnippet || `নাম: ${item.customerName || ""}\nফোন: ${item.phone || ""}\nঠিকানা: ${item.address || ""}`}
                                  className="w-full h-24 bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs text-slate-700 font-medium leading-relaxed resize-none focus:outline-none"
                                />
                                <div className="flex justify-start">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const textToCopy = item.messageSnippet || `নাম: ${item.customerName || ""}\nফোন: ${item.phone || ""}\nঠিকানা: ${item.address || ""}`;
                                      handleCopyToClipboard(textToCopy, item.id);
                                    }}
                                    className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 transition-all cursor-pointer shadow-2xs"
                                  >
                                    {copiedId === item.id ? (
                                      <>
                                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                                        <span className="text-emerald-700 font-bold">কপি হয়েছে!</span>
                                      </>
                                    ) : (
                                      <>
                                        <Copy className="w-3.5 h-3.5 text-slate-500" />
                                        <span>📋 কপি করুন</span>
                                      </>
                                    )}
                                  </button>
                                </div>
                              </div>

                              {/* 4. Manual Order Confirmation & Disclaimer */}
                              <div className="pt-3 border-t border-slate-100 space-y-2">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    alert(`অর্ডারটি সফলভাবে কনফার্ম করা হয়েছে!\nআইডি: ${item.phone || item.customerName}`);
                                  }}
                                  className="w-full bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold py-2 px-4 rounded-xl shadow-xs transition-colors cursor-pointer flex items-center justify-center space-x-2"
                                >
                                  <CheckCircle2 className="w-4 h-4" />
                                  <span>অর্ডার কনফার্ম করুন</span>
                                </button>
                                <p className="text-[10.5px] text-slate-500 text-center font-medium leading-relaxed">
                                  ⚠️ এই তথ্যগুলো কাস্টমার দিয়েছেন, অবশ্যই নাম ও ঠিকানা ম্যানুয়ালি চেক করে অর্ডারটি কনফার্ম করুন।
                                </p>
                              </div>
                            </div>
                          )}

                          {item.category === "abuse" && (
                            <div className="bg-white border border-amber-200 rounded-xl p-4 shadow-xs space-y-3.5">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1">
                                  <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400">প্ল্যাটফর্ম (Platform Source)</div>
                                  <div className="text-xs font-bold text-slate-800 flex items-center space-x-1.5">
                                    <span>{(item.platform || "").toLowerCase().includes("whatsapp") ? "🟢" : (item.platform || "").toLowerCase().includes("messenger") ? "🔵" : (item.platform || "").toLowerCase().includes("instagram") ? "🟣" : (item.platform || "").toLowerCase().includes("tiktok") ? "🖤" : "🟢"}</span>
                                    <span>{item.platform || "Platform"}</span>
                                  </div>
                                </div>
                                <div className="space-y-1">
                                  <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400">কাস্টমার আইডি / নাম</div>
                                  <div className="text-xs font-bold text-slate-800 flex items-center space-x-2">
                                    <span>👤</span>
                                    <span>{item.phone || item.customerName || "Customer"}</span>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        const idToCopy = item.phone || item.customerName || "";
                                        handleCopyToClipboard(idToCopy, `id-${item.id}`);
                                      }}
                                      className="px-1.5 py-0.5 text-amber-700 hover:text-amber-900 hover:bg-amber-100/80 bg-amber-50 rounded border border-amber-200 transition-all cursor-pointer flex items-center space-x-1"
                                      title="আইডি বা নাম কপি করুন"
                                    >
                                      {copiedId === `id-${item.id}` ? (
                                        <span className="text-[10px] text-emerald-600 font-bold">কপি হয়েছে! ✓</span>
                                      ) : (
                                        <>
                                          <Copy className="w-3 h-3 text-amber-700" />
                                          <span className="text-[10px] font-semibold text-amber-800">কপি</span>
                                        </>
                                      )}
                                    </button>
                                  </div>
                                </div>
                              </div>

                              <div className="space-y-2 pt-2 border-t border-slate-100">
                                <div className="text-[10px] uppercase font-bold tracking-wider text-amber-600 font-bold">গ্রাহকের পাঠানো চ্যাট টেক্সট</div>
                                <textarea
                                  readOnly
                                  value={item.messageSnippet || ""}
                                  className="w-full h-20 bg-amber-50/30 border border-amber-200 rounded-lg p-3 text-xs text-[#78350F] font-bold leading-relaxed resize-none focus:outline-none"
                                />
                                <div className="flex justify-start">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleCopyToClipboard(item.messageSnippet || "", item.id);
                                    }}
                                    className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border border-amber-200 bg-white hover:bg-amber-50/40 text-xs font-semibold text-amber-700 transition-all cursor-pointer shadow-2xs"
                                  >
                                    {copiedId === item.id ? (
                                      <>
                                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                                        <span className="text-emerald-700 font-bold">কপি হয়েছে!</span>
                                      </>
                                    ) : (
                                      <>
                                        <Copy className="w-3.5 h-3.5 text-slate-500" />
                                        <span>📋 কপি করুন</span>
                                      </>
                                    )}
                                  </button>
                                </div>
                              </div>

                              <div className="text-[11px] text-amber-800 font-medium bg-amber-50/30 p-2.5 rounded-lg border border-amber-100 leading-relaxed">
                                💡 **পরামর্শ:** গ্রাহক অশালীন শব্দ ব্যবহার করায় এআই বট চ্যাট সাময়িকভাবে হোল্ড করে রেখেছে। অনুগ্রহ করে অবিলম্বে ম্যানুয়ালি চ্যাটবক্সটি চেক করে গ্রাহকের সাথে কথা বলুন।
                              </div>
                            </div>
                          )}

                          {item.category === "system" && (
                            <div className="bg-white border border-rose-200 rounded-xl p-4 shadow-xs space-y-3.5">
                              <div className="flex items-center justify-between">
                                <div className="space-y-1">
                                  <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400">অ্যালার্ট উৎস</div>
                                  <div className="text-xs font-bold text-slate-800">⚡ {item.platform || "System"}</div>
                                </div>
                                <div className="bg-rose-50 text-rose-800 text-[10px] font-bold px-2 py-0.5 rounded-md border border-rose-200 uppercase font-mono">
                                  অ্যাকশন প্রয়োজন
                                </div>
                              </div>

                              <div className="space-y-2 pt-2 border-t border-slate-100">
                                <div className="text-[10px] uppercase font-bold tracking-wider text-rose-600 font-bold">অ্যালার্ট মেসেজ</div>
                                <div className="bg-rose-50/40 border-l-3 border-rose-500 rounded-r-lg p-3 text-xs text-rose-950 font-sans leading-relaxed">
                                  {item.messageSnippet}
                                </div>
                              </div>

                              <div className="text-[11px] text-emerald-800 font-medium bg-emerald-50/40 p-3 rounded-lg border border-emerald-100 leading-relaxed">
                                ✓ **সুরক্ষা সচল:** গ্রাহককে কোনো রোবটিক মেসেজ বা এরর দেখানো হয়নি (বট নিরব আছে)। অবিলম্বে প্যাকেজ রিনিউ করতে বা এপিআই কী সেটআপ চেক করতে সফটওয়্যার প্রোভাইডারের সাথে যোগাযোগ করুন।
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Bottom Simulation Bar */}
            <div className="px-6 py-3 bg-[#F8FAFC] border-t border-[#E2E8F0] flex items-center justify-between text-xs">
              <span className="text-[#64748B] font-medium">Quick Test Events:</span>
              <div className="flex items-center space-x-2">
                <button
                  id="btn-sim-order"
                  onClick={() => handleAddSample("order")}
                  className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-300 px-2.5 py-1 rounded text-[11px] font-semibold cursor-pointer"
                >
                  + Simulate Order
                </button>
                <button
                  id="btn-sim-abuse"
                  onClick={() => handleAddSample("abuse")}
                  className="bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-300 px-2.5 py-1 rounded text-[11px] font-semibold cursor-pointer"
                >
                  + Simulate Abuse Flag
                </button>
                <button
                  id="btn-sim-system"
                  onClick={() => handleAddSample("system")}
                  className="bg-red-50 hover:bg-red-100 text-red-700 border border-red-300 px-2.5 py-1 rounded text-[11px] font-semibold cursor-pointer"
                >
                  + Simulate 429 Alert
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ⚠️ Delete Single Item Confirmation Modal */}
      {deleteTargetId && (
        <div className="fixed inset-0 z-[60] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div id="delete-single-confirmation-modal" className="bg-[#FFFFFF] border border-[#CBD5E1] rounded-2xl w-full max-w-md p-6 shadow-2xl overflow-hidden text-[#0F172A] animate-in zoom-in-95 duration-150">
            <div className="flex items-start space-x-3.5 mb-4">
              <div className="p-2.5 bg-red-50 border border-red-200 rounded-xl text-red-600 shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-[#0F172A]">মেসেজটি মুছে ফেলতে চান?</h3>
                <p className="text-xs text-[#64748B] mt-1">Delete this notification?</p>
              </div>
            </div>
            
            <div className="bg-[#FFFBFB] border border-red-100 rounded-xl p-3.5 text-xs text-red-950 font-medium mb-5 leading-relaxed">
              ⚠️ আপনি কিন্তু একটি মেসেজ ডিলিট করতেছেন। এই মেসেজ ডিলিট করা হয়ে গেলে আপনি কিন্তু পরবর্তীতে আর কখনোই ফিরে পাবেন না।
            </div>

            <div className="flex items-center justify-end space-x-2.5">
              <button
                id="btn-cancel-single-delete"
                onClick={() => setDeleteTargetId(null)}
                className="px-4 py-2 bg-slate-50 hover:bg-slate-100 border border-[#CBD5E1] text-[#0F172A] rounded-lg text-xs font-semibold transition-all cursor-pointer"
              >
                Cancel (বাতিল)
              </button>
              <button
                id="btn-confirm-single-delete"
                onClick={handleDeleteItemConfirm}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-all cursor-pointer"
              >
                Yes, Delete (মুছে ফেলুন)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ⚠️ Clear Tab Confirmation Modal */}
      {clearTargetCategory && (
        <div className="fixed inset-0 z-[60] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div id="clear-tab-confirmation-modal" className="bg-[#FFFFFF] border border-[#CBD5E1] rounded-2xl w-full max-w-md p-6 shadow-2xl overflow-hidden text-[#0F172A] animate-in zoom-in-95 duration-150">
            <div className="flex items-start space-x-3.5 mb-4">
              <div className="p-2.5 bg-red-50 border border-red-200 rounded-xl text-red-600 shrink-0">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-[#0F172A]">সব মেসেজ মুছে ফেলতে চান?</h3>
                <p className="text-xs text-[#64748B] mt-1">Clear all notifications in this category?</p>
              </div>
            </div>
            
            <div className="bg-[#FFFBFB] border border-red-100 rounded-xl p-3.5 text-xs text-red-950 font-medium mb-5 leading-relaxed">
              ⚠️ আপনি কিন্তু একবারে সব মেসেজ ডিলিট করতেছেন। মেসেজগুলো যদি একবার ডিলিট হয়, আপনি আর কখনোই রিকভারি করতে পারবেন না।
            </div>

            <div className="flex items-center justify-end space-x-2.5">
              <button
                id="btn-cancel-clear-all"
                onClick={() => setClearTargetCategory(null)}
                className="px-4 py-2 bg-slate-50 hover:bg-slate-100 border border-[#CBD5E1] text-[#0F172A] rounded-lg text-xs font-semibold transition-all cursor-pointer"
              >
                Cancel (বাতিল)
              </button>
              <button
                id="btn-confirm-clear-all"
                onClick={handleClearTabConfirm}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-all cursor-pointer"
              >
                Yes, Clear All (সব মুছুন)
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
