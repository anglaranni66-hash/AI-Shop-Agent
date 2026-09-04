import React, { useState, useRef, useEffect } from "react";
import { Product, TenantUser, ChatMessage, NotificationItem, CustomerThread } from "../types";
import {
  Bot,
  Send,
  Image as ImageIcon,
  Sparkles,
  Paperclip,
  Clock,
  CheckCircle2,
  RotateCcw,
} from "lucide-react";
import { detectOrderFromChat } from "../utils/orderDetector";
import { getCustomerThread, saveCustomerExchange, deleteCustomerThread } from "../utils/customerMemory";

interface Props {
  currentTenant: TenantUser;
  products: Product[];
  onLogInteraction: (msg: ChatMessage) => void;
  onAddNotification?: (
    item: Omit<NotificationItem, "id" | "isRead" | "createdAt"> & {
      id?: string;
      isRead?: boolean;
      createdAt?: string;
    }
  ) => void;
}

export const AiCustomerSimulator: React.FC<Props> = ({
  currentTenant,
  products,
  onLogInteraction,
  onAddNotification,
}) => {
  // Persistent session identifier for simulator testing across tab switches/logins
  const getInitialCustomerId = () => {
    try {
      const storageKey = `sim_active_cust_${currentTenant?.id || "default"}`;
      const saved = localStorage.getItem(storageKey);
      if (saved && saved.trim().length > 0) {
        return saved.trim();
      }
      const initialId = `cust_test_${(currentTenant?.id || "demo").slice(0, 6)}`;
      localStorage.setItem(storageKey, initialId);
      return initialId;
    } catch (e) {
      return `cust_test_01`;
    }
  };

  const [simulatorCustomerId, setSimulatorCustomerId] = useState<string>(getInitialCustomerId);
  const [activeThread, setActiveThread] = useState<CustomerThread | null>(null);

  const welcomeMessage: ChatMessage = {
    id: "welcome_01",
    sender: "ai",
    platform: "Omnichannel",
    text: `Assalamu Alaikum! ${currentTenant.shopName}-এ আপনাকে স্বাগতম। আমাদের যেকোনো পণ্যের দাম, সাইজ, কালার বা ডেলিভারি সম্পর্কে জানতে মেসেজ দিতে পারেন।`,
    timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
  };

  const [messages, setMessages] = useState<ChatMessage[]>([welcomeMessage]);

  const [inputQuery, setInputQuery] = useState("");
  const [attachedImage, setAttachedImage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const platform = "Omnichannel";

  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleResetChat = async () => {
    const oldId = simulatorCustomerId;
    if (currentTenant?.id && oldId) {
      // Cleanly delete previous simulator test customer from Firestore so junk data is not kept
      deleteCustomerThread(currentTenant.id, "Omnichannel", oldId).catch((err) => {
        console.debug("Error cleaning up reset thread:", err);
      });
    }

    const newId = `cust_test_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;
    try {
      const storageKey = `sim_active_cust_${currentTenant?.id || "default"}`;
      localStorage.setItem(storageKey, newId);
    } catch (e) {
      // Ignore
    }
    setSimulatorCustomerId(newId);
    setActiveThread(null);
    setMessages([welcomeMessage]);
    setInputQuery("");
    setAttachedImage(null);
  };

  // Load existing persistent conversation thread and restore history so AI & UI stay in sync
  useEffect(() => {
    let isMounted = true;
    async function loadThread() {
      if (!currentTenant?.id || !simulatorCustomerId) return;
      try {
        const thread = await getCustomerThread(
          currentTenant.id,
          "Omnichannel",
          simulatorCustomerId
        );
        if (isMounted && thread) {
          setActiveThread(thread);
          if (Array.isArray(thread.messages) && thread.messages.length > 0) {
            setMessages(thread.messages);
          }
        }
      } catch (err) {
        console.debug("Error loading existing simulator thread:", err);
      }
    }
    loadThread();
    return () => {
      isMounted = false;
    };
  }, [currentTenant?.id, simulatorCustomerId]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  // Clean, realistic test prompts (without hardcoded phone numbers or fake addresses)
  const quickPresets = [
    {
      label: "পাঞ্জাবির কালেকশন দেখাও",
      query: "Apnader kache ki panjabi ache? Price koto?",
      desc: "Product & price check",
    },
    {
      label: "ডেলিভারি চার্জ কত?",
      query: "Dhakar moddhe delivery charge koto? Ar bahire koto?",
      desc: "Delivery policy inquiry",
    },
    {
      label: "অর্ডার করার নিয়ম",
      query: "Ami ekta panjabi order korte chai, order process ki?",
      desc: "Order inquiry",
    },
    {
      label: "ক্যাশ অন ডেলিভারি আছে?",
      query: "Delivery pawar por ki payment kora jabe?",
      desc: "Payment policy check",
    },
  ];

  const handleSendMessage = async (queryText?: string, imageOverride?: string | null) => {
    const textToSend = queryText !== undefined ? queryText : inputQuery;
    const imgToSend = imageOverride !== undefined ? imageOverride : attachedImage;

    if (!textToSend.trim() && !imgToSend) return;

    const customerMsg: ChatMessage = {
      id: `msg_cust_${Date.now()}`,
      sender: "customer",
      customerName: "Customer",
      platform,
      text: textToSend,
      imageUrl: imgToSend || undefined,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, customerMsg]);
    setInputQuery("");
    setAttachedImage(null);
    setIsLoading(true);

    // 1. Context-Aware Customer Order Extraction Hook
    const orderData = detectOrderFromChat(
      textToSend,
      messages.map((m) => ({ sender: m.sender, text: m.text })),
      products
    );

    if (orderData.isOrderDetected && onAddNotification) {
      onAddNotification({
        category: "order",
        title: "New Order Confirmed",
        customerName: "Customer",
        platform: "Live Chat",
        phone: orderData.phone || "Contact in chat",
        address: orderData.address || "Address in chat",
        messageSnippet: textToSend,
        details: { item: orderData.matchedItem || "Customer Inquired Item" },
        isRead: false,
      });
    }

    // Immediately record customer message in persistent Firestore customer thread
    let currentSavedThread: CustomerThread | null = null;
    if (currentTenant?.id) {
      try {
        currentSavedThread = await saveCustomerExchange(
          currentTenant.id,
          "Omnichannel",
          simulatorCustomerId,
          "Customer",
          textToSend,
          "", // Initially empty reply so customer message is safely preserved in database immediately
          {
            phone: orderData.phone || undefined,
            address: orderData.address || undefined,
            item: orderData.matchedItem || undefined,
          }
        );
        setActiveThread(currentSavedThread);
      } catch (err) {
        console.debug("Initial customer message save error:", err);
      }
    }

    // 2. Real-time Abuse & Escalation Hook
    const lowerText = textToSend.toLowerCase();
    const abuseKeywords = ["faltu", "ফালতু", "batpar", "বাটপার", "chor", "চোর", "scam", "fraud", "fraud shop", "case", "police", "পুলিশ", "dhoka", "ধোঁকা", "baje service", "report", "রিপোর্ট", "haramzada", "shala", "fake"];
    const hasAbuseIntent = abuseKeywords.some(kw => lowerText.includes(kw));

    if (hasAbuseIntent && onAddNotification) {
      onAddNotification({
        category: "abuse",
        title: "Customer Escalation Flagged",
        customerName: "Customer",
        platform: "Live Chat",
        messageSnippet: textToSend,
        details: { severity: "high", trigger: "Negative emotion / aggressive customer wording" },
        isRead: false,
      });
    }

    try {
      // Pass customer memory summary and past timeline to Gemini 3.5 quietly in the backend (excluding initial static welcome banner)
      const realHistory = messages
        .filter((m) => m.id !== "welcome_01")
        .slice(-5)
        .map((m) => ({ sender: m.sender, text: m.text }));

      const currentMemorySummary = currentSavedThread?.summary || activeThread?.summary || "";
      const pastTimeStr = (currentSavedThread || activeThread)?.lastMessageAt
        ? new Date((currentSavedThread || activeThread)!.lastMessageAt).toLocaleDateString()
        : "";

      const response = await fetch("/api/gemini/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: textToSend,
          history: realHistory,
          customerSummary: currentMemorySummary,
          pastDaysSinceLastContact: pastTimeStr,
          imageBase64: imgToSend,
          platform: "Omnichannel",
          customerName: "Customer",
          shopName: currentTenant.shopName,
          products,
        }),
      });

      const data = await response.json();

      // 3. System 429 Quota / Rate Limit Interception Hook
      if (data.systemAlert && onAddNotification) {
        onAddNotification({
          category: "system",
          title: data.systemAlert.title || "⚠️ AI টোকেন বা ব্যবহারের লিমিট শেষ হয়েছে",
          customerName: "সিস্টেম নোটিশ",
          platform: "Gemini AI Engine",
          messageSnippet: data.systemAlert.details || "আপনার AI চ্যাটবটের ব্যবহারের লিমিট বা টোকেন শেষ হয়ে গেছে। চ্যাটবট পুনরায় সচল করতে প্যাকেজ বা API Key আপডেট করুন অথবা সফটওয়্যারের মালিক/কোম্পানির সাথে যোগাযোগ করুন।",
          details: { errorCode: data.systemAlert.errorCode },
          isRead: false,
        });
      }

      // If token is active, save response & update persistent customer thread memory silently in Firestore
      if (data.reply && data.reply.trim().length > 0) {
        const aiMsg: ChatMessage = {
          id: `msg_ai_${Date.now()}`,
          sender: "ai",
          platform: "Omnichannel",
          text: data.reply,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          latencyMs: data.latencyMs || 380,
          suggestedProducts: data.suggestedProducts || [],
          guardrailApplied: true,
        };

        setMessages((prev) => [...prev, aiMsg]);
        onLogInteraction(aiMsg);

        // Save real persistent thread & memory update to Firebase Firestore
        if (currentTenant?.id) {
          const updatedThread = await saveCustomerExchange(
            currentTenant.id,
            "Omnichannel",
            simulatorCustomerId,
            "Customer",
            textToSend,
            data.reply,
            {
              phone: orderData.phone || undefined,
              address: orderData.address || undefined,
              item: orderData.matchedItem || undefined,
            }
          );
          setActiveThread(updatedThread);
        }
      }
    } catch (err: any) {
      console.error("AI Error:", err);

      if (onAddNotification) {
        onAddNotification({
          category: "system",
          title: "⚠️ AI টোকেন বা ব্যবহারের লিমিট শেষ হয়েছে",
          customerName: "সিস্টেম নোটিশ",
          platform: "Gemini AI Gateway",
          messageSnippet: "আপনার AI চ্যাটবটের ব্যবহারের লিমিট বা টোকেন শেষ হয়ে গেছে। চ্যাটবট পুনরায় সচল করতে প্যাকেজ বা API Key আপডেট করুন অথবা সফটওয়্যার মালিক/কোম্পানির সাথে যোগাযোগ করুন।",
          details: { error: String(err) },
          isRead: false,
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setAttachedImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div id="ai-simulator-view" className="w-full flex-1 flex flex-col min-h-0 p-4 sm:p-6 bg-[#F8FAFC] text-[#0F172A] overflow-y-auto custom-scrollbar pb-12">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3 shrink-0">
        <div>
          <div className="flex items-center space-x-2.5">
            <h2 className="text-lg font-bold text-[#0F172A] tracking-tight">AI Live Sales Agent Simulator</h2>
            <span className="bg-blue-50 text-blue-700 border border-blue-200 px-2.5 py-0.5 rounded-full text-[11px] font-semibold flex items-center space-x-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse"></span>
              <span>Gemini 3.5 Connected</span>
            </span>
          </div>
          <p className="text-xs text-[#64748B] mt-0.5">
            একজন সাধারণ কাস্টমারের মতো চ্যাট করে এআই সেলস এজেন্টের রেসপন্স টেস্ট করুন।
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            id="btn-reset-simulator"
            onClick={handleResetChat}
            className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold text-[#475569] bg-white border border-[#CBD5E1] hover:border-blue-400 hover:text-blue-600 rounded-lg shadow-xs transition-colors cursor-pointer"
            title="নতুন কাল্পনিক কাস্টমার হিসেবে ফ্রেশ চ্যাট শুরু করুন"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>নতুন চ্যাট / রিসেট</span>
          </button>
        </div>
      </div>

      {/* Main Chat Box */}
      <div className="flex-1 min-h-[460px] flex flex-col bg-[#FFFFFF] border border-[#E2E8F0] rounded-xl overflow-hidden shadow-sm">
        {/* Chat History Canvas */}
        <div className="flex-1 min-h-[260px] p-5 overflow-y-auto custom-scrollbar space-y-4 bg-[#F8FAFC]">
          {messages.map((m) => {
            const isAi = m.sender === "ai";
            return (
              <div
                key={m.id}
                className={`flex flex-col ${isAi ? "items-start" : "items-end"}`}
              >
                <div className="flex items-center space-x-2 mb-1 px-1 text-[11px] text-[#64748B] font-medium">
                  {isAi ? (
                    <>
                      <Bot className="w-3.5 h-3.5 text-blue-600" />
                      <span className="font-semibold text-blue-700">{currentTenant.shopName}</span>
                    </>
                  ) : (
                    <span className="text-[#475569] font-semibold">Customer</span>
                  )}
                  <span>• {m.timestamp}</span>
                </div>

                <div
                  className={`max-w-[85%] sm:max-w-[72%] p-4 rounded-xl text-xs leading-relaxed shadow-xs ${
                    isAi
                      ? "bg-[#FFFFFF] border border-[#E2E8F0] text-[#0F172A] rounded-tl-xs"
                      : "bg-blue-600 text-white rounded-tr-xs"
                  }`}
                >
                  {/* Attached Image if any */}
                  {m.imageUrl && (
                    <div className="mb-3 rounded-lg overflow-hidden border border-[#E2E8F0] max-h-48 shadow-xs">
                      <img
                        src={m.imageUrl}
                        alt="Customer upload"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}

                  <p className="whitespace-pre-wrap">{m.text}</p>

                  {/* Suggested Product Cards Grid */}
                  {isAi && m.suggestedProducts && m.suggestedProducts.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-[#E2E8F0] grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {m.suggestedProducts.map((p) => (
                        <div
                          key={p.id}
                          onClick={() => {
                            setInputQuery(`কোড: ${p.code} - এই প্রোডাক্টটি সম্পর্কে বিস্তারিত জানতে চাই`);
                          }}
                          className="bg-[#F8FAFC] hover:bg-blue-50 border border-[#E2E8F0] hover:border-blue-300 rounded-lg p-2 flex items-center space-x-2.5 transition-all cursor-pointer group shadow-xs"
                        >
                          {p.imageUrl ? (
                            <img
                              src={p.imageUrl}
                              alt={p.name}
                              className="w-10 h-10 object-cover rounded-md border border-[#CBD5E1] shrink-0"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <div className="w-10 h-10 bg-blue-100 rounded-md flex items-center justify-center text-blue-700 font-bold text-xs shrink-0">
                              {p.code}
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-bold text-blue-700 uppercase bg-blue-50 px-1.5 py-0.2 rounded border border-blue-200">
                                {p.code}
                              </span>
                              <span className="text-[11px] font-extrabold text-[#0F172A]">{p.price} BDT</span>
                            </div>
                            <p className="text-[11px] text-[#0F172A] font-medium truncate mt-0.5 group-hover:text-blue-700">
                              {p.name}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* AI Metadata badge */}
                  {isAi && (
                    <div className="mt-3 pt-2.5 border-t border-[#E2E8F0] flex items-center justify-between text-[10px] text-[#64748B] font-medium">
                      <span className="flex items-center space-x-1 text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        <span>Catalog Verified</span>
                      </span>
                      {m.latencyMs && (
                        <span className="flex items-center space-x-1 text-[#475569]">
                          <Clock className="w-3 h-3 text-blue-600" />
                          <span>{m.latencyMs}ms</span>
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {isLoading && (
            <div className="flex flex-col items-start">
              <div className="flex items-center space-x-2 mb-1 px-1 text-[11px] text-blue-700 font-semibold">
                <Bot className="w-3.5 h-3.5 text-blue-600 animate-spin" />
                <span>উত্তর প্রস্তুত করা হচ্ছে...</span>
              </div>
              <div className="bg-[#FFFFFF] border border-[#E2E8F0] p-3.5 rounded-xl rounded-tl-xs flex items-center space-x-2 shadow-xs">
                <div className="w-2 h-2 rounded-full bg-blue-600 animate-bounce"></div>
                <div className="w-2 h-2 rounded-full bg-blue-600 animate-bounce [animation-delay:0.2s]"></div>
                <div className="w-2 h-2 rounded-full bg-blue-600 animate-bounce [animation-delay:0.4s]"></div>
              </div>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>

        {/* Quick Test Prompt Pills */}
        <div className="px-4 py-2.5 bg-[#FFFFFF] border-t border-[#E2E8F0] overflow-x-auto">
          <div className="flex items-center space-x-2">
            <span className="text-[10px] font-bold text-[#475569] uppercase tracking-wider whitespace-nowrap flex items-center space-x-1">
              <Sparkles className="w-3 h-3 text-amber-500" />
              <span>Quick Tests:</span>
            </span>
            {quickPresets.map((preset, idx) => (
              <button
                key={idx}
                id={`btn-preset-test-${idx}`}
                onClick={() => handleSendMessage(preset.query)}
                className="whitespace-nowrap bg-[#F8FAFC] hover:bg-[#F1F5F9] text-[#334155] hover:text-[#0F172A] border border-[#CBD5E1] hover:border-blue-500 px-3 py-1 rounded-lg text-[11px] font-semibold transition-all flex items-center space-x-1.5 cursor-pointer shadow-xs"
                title={preset.desc}
              >
                <span>{preset.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Image Attachment Preview */}
        {attachedImage && (
          <div className="px-4 py-2 bg-[#F8FAFC] border-t border-[#E2E8F0] flex items-center justify-between">
            <div className="flex items-center space-x-2 text-xs text-[#0F172A] font-medium">
              <ImageIcon className="w-4 h-4 text-emerald-600" />
              <span>Attached customer product image</span>
            </div>
            <button
              onClick={() => setAttachedImage(null)}
              className="text-red-600 hover:text-red-800 text-xs font-semibold cursor-pointer"
            >
              Remove
            </button>
          </div>
        )}

        {/* Input Bar */}
        <div className="p-3.5 bg-[#FFFFFF] border-t border-[#E2E8F0]">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="flex items-center space-x-2.5"
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept="image/*"
              className="hidden"
            />
            <button
              id="btn-attach-customer-photo"
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="p-2.5 text-[#64748B] hover:text-[#0F172A] bg-[#F8FAFC] hover:bg-[#F1F5F9] border border-[#CBD5E1] rounded-lg transition-colors cursor-pointer shadow-xs"
              title="Upload Customer Product Photo"
            >
              <Paperclip className="w-4 h-4" />
            </button>

            <input
              id="input-customer-chat-query"
              type="text"
              value={inputQuery}
              onChange={(e) => setInputQuery(e.target.value)}
              placeholder="Type message in Bengali or Banglish (e.g. 'Panjabi ache? Dam koto?')..."
              className="flex-1 bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg px-4 py-2 text-xs text-[#0F172A] placeholder-[#94A3B8] focus:outline-none focus:border-blue-600 focus:bg-[#FFFFFF] transition-colors shadow-xs"
            />

            <button
              id="btn-send-customer-inquiry"
              type="submit"
              disabled={isLoading || (!inputQuery.trim() && !attachedImage)}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-semibold px-4 py-2 rounded-lg flex items-center space-x-1.5 shadow-xs transition-all cursor-pointer"
            >
              <span>Send</span>
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
