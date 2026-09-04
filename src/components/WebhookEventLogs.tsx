import React, { useState, useEffect } from "react";
import { WebhookLog, TenantUser } from "../types";
import {
  Radio,
  Clock,
  Zap,
  CheckCircle2,
  HelpCircle,
  Server,
  Code2,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  Filter,
  UserCheck,
  Bot,
  Image as ImageIcon,
  MessageSquare,
  Sparkles,
  FlaskConical,
  Trash2,
  RefreshCw,
  Search,
  ExternalLink,
  Maximize2,
  X,
  Send,
  Cloud,
  CheckCheck,
} from "lucide-react";

interface Props {
  logs: WebhookLog[];
  currentTenant: TenantUser;
  onSimulateIncomingWebhook: (
    platform: "facebook" | "instagram" | "whatsapp" | "tiktok",
    options?: { withImage?: boolean; simulatedHumanReply?: boolean }
  ) => void;
  onFetchCloudLogs?: () => void;
  isFetchingLogs?: boolean;
  lastLogsFetchedAt?: string | null;
  onDeleteLog?: (id: string) => void;
  onClearDemoLogs?: () => void;
}

export const WebhookEventLogs: React.FC<Props> = ({
  logs,
  currentTenant,
  onSimulateIncomingWebhook,
  onFetchCloudLogs,
  isFetchingLogs = false,
  lastLogsFetchedAt,
  onDeleteLog,
  onClearDemoLogs,
}) => {
  const [selectedFilter, setSelectedFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [copiedToken, setCopiedToken] = useState(false);
  const [copiedTextId, setCopiedTextId] = useState<string | null>(null);
  const [showExplainer, setShowExplainer] = useState(false);
  const [isDemoToolsOpen, setIsDemoToolsOpen] = useState(false);
  const [lightboxImage, setLightboxImage] = useState<{ url: string; title: string } | null>(null);
  const [now, setNow] = useState(Date.now());

  // Refresh clock every second to update remaining demo countdowns & auto-expire
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Filter out expired demo logs after 90 seconds
  const activeLogs = logs.filter((log) => {
    if (log.expiresAt && log.expiresAt < now) {
      return false;
    }
    return true;
  });

  const demoCount = activeLogs.filter((l) => l.isDemo).length;

  // Platform specific full themes, subtle tinted card backgrounds, and badges
  const getPlatformMeta = (p: string) => {
    switch (p.toLowerCase()) {
      case "whatsapp":
        return {
          name: "WhatsApp",
          badgeBg: "bg-[#25D366] text-white",
          cardBg: "bg-[#F0FDF4] border-[#BBF7D0] hover:border-[#86EFAC]", // Subtle green tint
          bubbleCustomer: "bg-white text-[#0F172A] border-emerald-100",
          bubbleBot: "bg-[#DCF8C6] text-slate-900 border-emerald-300",
          botAvatarBg: "bg-[#16A34A] text-white border-emerald-700",
          botFooterText: "text-emerald-800",
          tagColor: "text-[#16A34A]",
        };
      case "facebook":
        return {
          name: "Messenger",
          badgeBg: "bg-[#0084FF] text-white",
          cardBg: "bg-[#EFF6FF] border-[#BFDBFE] hover:border-[#93C5FD]", // Subtle blue tint
          bubbleCustomer: "bg-white text-[#0F172A] border-blue-100",
          bubbleBot: "bg-[#0084FF] text-white border-blue-500",
          botAvatarBg: "bg-[#0084FF] text-white border-blue-600",
          botFooterText: "text-blue-100",
          tagColor: "text-[#0084FF]",
        };
      case "instagram":
        return {
          name: "Instagram",
          badgeBg: "bg-gradient-to-tr from-[#FD1D1D] to-[#833AB4] text-white",
          cardBg: "bg-[#FFF1F2] border-[#FECDD3] hover:border-[#FDA4AF]", // Subtle soft pink/red tint
          bubbleCustomer: "bg-white text-[#0F172A] border-rose-100",
          bubbleBot: "bg-gradient-to-r from-[#FFF0F5] to-[#FCE7F3] text-pink-950 border-pink-300",
          botAvatarBg: "bg-gradient-to-tr from-[#FD1D1D] to-[#833AB4] text-white border-pink-600",
          botFooterText: "text-pink-900",
          tagColor: "text-[#E1306C]",
        };
      case "tiktok":
        return {
          name: "TikTok Shop",
          badgeBg: "bg-black text-[#25F4EE] border border-slate-700",
          cardBg: "bg-[#F8FAFC] border-slate-300 hover:border-slate-400", // Subtle dark/slate tint
          bubbleCustomer: "bg-white text-[#0F172A] border-slate-200",
          bubbleBot: "bg-[#0F172A] text-[#F8FAFC] border-slate-700",
          botAvatarBg: "bg-black text-[#25F4EE] border-slate-700",
          botFooterText: "text-slate-300",
          tagColor: "text-slate-900",
        };
      default:
        return {
          name: "Omni Webhook",
          badgeBg: "bg-slate-700 text-white",
          cardBg: "bg-white border-slate-200 hover:border-slate-300",
          bubbleCustomer: "bg-[#F1F5F9] text-[#0F172A] border-slate-200",
          bubbleBot: "bg-[#E2E8F0] text-slate-900 border-slate-300",
          botAvatarBg: "bg-slate-700 text-white border-slate-800",
          botFooterText: "text-slate-700",
          tagColor: "text-slate-700",
        };
    }
  };

  const filteredLogs = activeLogs.filter((log) => {
    const matchesFilter =
      selectedFilter === "all" || log.platform.toLowerCase() === selectedFilter.toLowerCase();

    const matchesSearch =
      !searchQuery.trim() ||
      log.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.incomingText.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.aiReply.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (log.customerPhone && log.customerPhone.includes(searchQuery));

    return matchesFilter && matchesSearch;
  });

  const handleCopyVerifyToken = () => {
    navigator.clipboard.writeText(`shop_agent_secret_${currentTenant.id}`);
    setCopiedToken(true);
    setTimeout(() => setCopiedToken(false), 2000);
  };

  const handleCopyText = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedTextId(id);
    setTimeout(() => setCopiedTextId(null), 2000);
  };

  const extractUrls = (text: string) => {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return text.match(urlRegex) || [];
  };

  return (
    <div
      id="webhook-logs-view"
      className="w-full flex-1 flex flex-col min-h-0 p-3 sm:p-4 bg-[#F8FAFC] text-[#0F172A] overflow-y-auto custom-scrollbar pb-20"
    >
      {/* Top Header & Cloud Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 mb-3 bg-white border border-[#CBD5E1] rounded-xl p-3 shadow-xs shrink-0">
        <div>
          <div className="flex items-center space-x-2">
            <h2 className="text-sm sm:text-base font-bold text-[#0F172A] tracking-tight">
              Webhook Live Chat Stream
            </h2>
            <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full text-[10px] font-semibold flex items-center space-x-1">
              <Radio className="w-2.5 h-2.5 text-emerald-600 animate-pulse" />
              <span>Listening Active</span>
            </span>
          </div>
          <div className="flex items-center flex-wrap gap-1.5 text-[11px] text-[#64748B] mt-0.5">
            <span>Store: <strong className="text-blue-700 font-mono">{currentTenant.shopName}</strong></span>
            <span>•</span>
            <span className="flex items-center space-x-1">
              <Cloud className="w-3 h-3 text-blue-500" />
              <span>On-Demand Mode</span>
              {lastLogsFetchedAt && (
                <span className="text-[10px] text-slate-400 font-mono">
                  (Last: {lastLogsFetchedAt})
                </span>
              )}
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center flex-wrap gap-1.5">
          {onFetchCloudLogs && (
            <button
              id="btn-sync-cloud-logs"
              onClick={onFetchCloudLogs}
              disabled={isFetchingLogs}
              className="text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-[#CBD5E1] bg-[#F8FAFC] hover:bg-slate-100 text-[#334155] flex items-center space-x-1 transition-all cursor-pointer shadow-xs disabled:opacity-50"
              title="Sync latest robot replies on demand"
            >
              <RefreshCw className={`w-3 h-3 text-blue-600 ${isFetchingLogs ? "animate-spin" : ""}`} />
              <span>{isFetchingLogs ? "Syncing..." : "Sync Cloud"}</span>
            </button>
          )}

          {demoCount > 0 && onClearDemoLogs && (
            <button
              id="btn-clear-demo-logs"
              onClick={onClearDemoLogs}
              className="text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900 flex items-center space-x-1 transition-all cursor-pointer shadow-xs"
              title="Delete all temporary test messages in 1 click"
            >
              <Trash2 className="w-3 h-3 text-amber-700" />
              <span>Clear Demos ({demoCount})</span>
            </button>
          )}

          <button
            id="btn-toggle-demo-tools"
            onClick={() => setIsDemoToolsOpen(!isDemoToolsOpen)}
            className={`text-xs font-semibold px-2.5 py-1.5 rounded-lg border flex items-center space-x-1 transition-all cursor-pointer shadow-xs ${
              isDemoToolsOpen
                ? "bg-amber-50 text-amber-800 border-amber-300"
                : "bg-[#FFFFFF] text-[#475569] hover:text-[#0F172A] border-[#CBD5E1] hover:bg-[#F1F5F9]"
            }`}
          >
            <FlaskConical className="w-3 h-3 text-amber-600" />
            <span>{isDemoToolsOpen ? "Close Demo Tools" : "Demo / Test"}</span>
            {isDemoToolsOpen ? <ChevronUp className="w-3 h-3 text-amber-600" /> : <ChevronDown className="w-3 h-3 text-[#64748B]" />}
          </button>
        </div>
      </div>

      {/* Mini Demo Testing Bar */}
      {isDemoToolsOpen && (
        <div className="bg-[#FFFBEB] border border-[#FDE68A] rounded-xl p-3 mb-3 shadow-xs shrink-0 animate-in fade-in duration-100">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-[#92400E] flex items-center space-x-1">
              <Sparkles className="w-3.5 h-3.5 text-amber-600" />
              <span>Simulate Incoming Customer Message (ডেটাবেজে সেভ হবে না):</span>
            </span>
            <span className="text-[10px] text-amber-700 font-mono bg-amber-100 px-1.5 py-0.5 rounded">
              Auto-disappears in 90s
            </span>
          </div>

          <div className="flex items-center flex-wrap gap-1.5 text-xs">
            <button
              onClick={() => onSimulateIncomingWebhook("whatsapp", { withImage: true })}
              className="bg-[#22C55E] hover:bg-[#16A34A] text-white px-2.5 py-1 rounded-md transition-colors text-[11px] font-semibold cursor-pointer shadow-xs"
            >
              + WhatsApp (Img)
            </button>
            <button
              onClick={() => onSimulateIncomingWebhook("facebook")}
              className="bg-[#1877F2] hover:bg-[#1D4ED8] text-white px-2.5 py-1 rounded-md transition-colors text-[11px] font-semibold cursor-pointer shadow-xs"
            >
              + Messenger
            </button>
            <button
              onClick={() => onSimulateIncomingWebhook("instagram", { withImage: true })}
              className="bg-gradient-to-r from-[#F58529] via-[#DD2A7B] to-[#8134AF] hover:opacity-90 text-white px-2.5 py-1 rounded-md transition-opacity text-[11px] font-semibold cursor-pointer shadow-xs"
            >
              + Instagram
            </button>
            <button
              onClick={() => onSimulateIncomingWebhook("tiktok")}
              className="bg-[#0F172A] hover:bg-black text-[#25F4EE] border border-slate-700 px-2.5 py-1 rounded-md transition-colors text-[11px] font-semibold cursor-pointer shadow-xs"
            >
              + TikTok Shop
            </button>
            <button
              onClick={() => onSimulateIncomingWebhook("facebook", { simulatedHumanReply: true })}
              className="bg-purple-600 hover:bg-purple-700 text-white px-2.5 py-1 rounded-md transition-colors text-[11px] font-semibold cursor-pointer shadow-xs"
            >
              + Human Staff Reply
            </button>
          </div>
        </div>
      )}

      {/* Webhook Endpoint Info Mini Banner */}
      <div className="bg-white border border-[#CBD5E1] rounded-xl p-2.5 mb-3 shadow-xs shrink-0">
        <div className="flex items-center justify-between cursor-pointer" onClick={() => setShowExplainer(!showExplainer)}>
          <div className="flex items-center space-x-2 text-xs">
            <Server className="w-3.5 h-3.5 text-blue-600" />
            <span className="font-bold text-[#0F172A]">Webhook Endpoint &amp; Verification</span>
            <code className="hidden sm:inline bg-slate-100 text-blue-700 px-2 py-0.5 rounded font-mono text-[10.5px]">
              https://api.yourshop.com/webhook/{currentTenant.id}
            </code>
          </div>
          <button className="text-slate-500 hover:text-slate-800 text-[11px] font-semibold flex items-center space-x-1 cursor-pointer">
            <span>{showExplainer ? "Hide" : "Details"}</span>
            {showExplainer ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
        </div>

        {showExplainer && (
          <div className="mt-2 pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-[11px]">
            <div className="flex items-center space-x-1.5">
              <span className="text-slate-500">Verify Token:</span>
              <code className="bg-slate-100 text-slate-800 px-2 py-0.5 rounded font-mono text-[10px]">
                shop_agent_secret_{currentTenant.id}
              </code>
              <button
                onClick={handleCopyVerifyToken}
                className="hover:bg-slate-100 p-1 rounded transition-colors text-slate-600 cursor-pointer"
              >
                {copiedToken ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
              </button>
            </div>
            <span className="text-slate-400 text-[10px]">Meta Developer Portal &gt; Webhooks &gt; Page / WhatsApp</span>
          </div>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3 shrink-0">
        <div className="flex items-center space-x-1 overflow-x-auto pb-0.5">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mr-1">
            Channel:
          </span>
          {[
            { id: "all", label: `All (${activeLogs.length})`, color: "bg-slate-800 text-white" },
            { id: "whatsapp", label: "WhatsApp", color: "bg-[#22C55E] text-white" },
            { id: "facebook", label: "Messenger", color: "bg-[#1877F2] text-white" },
            { id: "instagram", label: "Instagram", color: "bg-[#E1306C] text-white" },
            { id: "tiktok", label: "TikTok", color: "bg-slate-900 text-[#25F4EE]" },
          ].map((f) => {
            const isSelected = selectedFilter === f.id;
            return (
              <button
                key={f.id}
                onClick={() => setSelectedFilter(f.id)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer whitespace-nowrap shadow-xs ${
                  isSelected
                    ? `${f.color} shadow-xs font-bold`
                    : "bg-white text-slate-600 hover:text-slate-900 border border-slate-300 hover:bg-slate-50"
                }`}
              >
                {f.label}
              </button>
            );
          })}
        </div>

        <div className="relative min-w-[200px]">
          <Search className="w-3 h-3 text-slate-400 absolute left-2.5 top-2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search conversations..."
            className="w-full bg-white border border-slate-300 pl-7 pr-3 py-1 rounded-lg text-[11px] text-[#0F172A] focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-xs"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-2 top-1.5 text-slate-400 hover:text-slate-600"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* Activity Feed: Realistic Natural-Sized Chat View */}
      {filteredLogs.length === 0 ? (
        <div className="p-8 text-center text-xs text-slate-500 bg-white border border-slate-200 rounded-xl shadow-xs space-y-1">
          <MessageSquare className="w-6 h-6 text-slate-400 mx-auto mb-1" />
          <p className="font-semibold text-xs text-slate-700">No message stream logs found</p>
          <p className="text-[11px] text-slate-500">
            Incoming customer chats will appear in realistic message bubbles here.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredLogs.map((log) => {
            const meta = getPlatformMeta(log.platform);
            const isExpanded = expandedLogId === log.id;
            const isHuman = log.responderType === "human_agent";
            const isDemo = Boolean(log.isDemo);
            const remainingSec = log.expiresAt ? Math.max(0, Math.ceil((log.expiresAt - now) / 1000)) : null;
            const customerUrls = extractUrls(log.incomingText);
            const botUrls = extractUrls(log.aiReply);

            return (
              <div
                key={log.id}
                className={`${meta.cardBg} border rounded-xl p-3 shadow-xs transition-all`}
              >
                {/* Slim Header Bar for this Conversation */}
                <div className="flex items-center justify-between text-[11px] mb-2 pb-1.5 border-b border-black/5">
                  <div className="flex items-center space-x-1.5">
                    <span className={`${meta.badgeBg} text-[9.5px] font-bold px-1.5 py-0.5 rounded shadow-xs`}>
                      {meta.name}
                    </span>
                    <span className="font-bold text-slate-800 text-[11.5px]">
                      {log.customerName}
                    </span>
                    {isDemo && (
                      <span className="bg-amber-100 text-amber-800 text-[9px] font-bold px-1.5 py-0.2 rounded border border-amber-200">
                        DEMO {remainingSec !== null ? `(${remainingSec}s)` : ""}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center space-x-2 text-[10.5px] text-slate-400">
                    <span className="flex items-center space-x-1">
                      <Clock className="w-3 h-3 text-slate-400" />
                      <span>{log.timestamp}</span>
                    </span>

                    {onDeleteLog && (
                      <button
                        onClick={() => onDeleteLog(log.id)}
                        className="text-slate-400 hover:text-rose-600 p-0.5 rounded transition-colors cursor-pointer"
                        title="Delete log"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Chat Bubbles Container */}
                <div className="space-y-2 py-0.5">
                  {/* --- CUSTOMER INBOUND (Left) --- */}
                  <div className="flex items-start space-x-2 max-w-[85%] sm:max-w-[70%]">
                    <div className="w-6 h-6 rounded-full bg-slate-200 border border-slate-300 flex items-center justify-center text-slate-700 font-bold text-[10px] shrink-0">
                      {log.customerName ? log.customerName.charAt(0).toUpperCase() : "C"}
                    </div>

                    <div className="space-y-1">
                      {/* Customer Bubble */}
                      <div className={`${meta.bubbleCustomer} border px-3 py-2 rounded-2xl rounded-tl-xs text-[12px] leading-relaxed shadow-xs break-words`}>
                        <p className="whitespace-pre-wrap">{log.incomingText}</p>

                        {/* Customer Attached Image (Compact Thumbnail with Zoom) */}
                        {log.imageUrl && (
                          <div className="mt-1.5 pt-1.5 border-t border-slate-200">
                            <div
                              onClick={() =>
                                setLightboxImage({
                                  url: log.imageUrl!,
                                  title: `Photo from ${log.customerName}`,
                                })
                              }
                              className="relative group inline-flex items-center space-x-1.5 cursor-pointer bg-white px-2 py-1 rounded-lg border border-slate-300 shadow-xs hover:border-blue-400"
                            >
                              <img
                                src={log.imageUrl}
                                alt="Customer upload"
                                className="w-10 h-10 object-cover rounded-md"
                              />
                              <div className="text-[10px] text-slate-600 font-medium">
                                <span className="block font-bold text-slate-800">Attached Photo</span>
                                <span className="text-blue-600 flex items-center space-x-0.5">
                                  <Maximize2 className="w-2.5 h-2.5" />
                                  <span>Click to view</span>
                                </span>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Link previews if any */}
                        {customerUrls.length > 0 && (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {customerUrls.map((url, i) => (
                              <a
                                key={i}
                                href={url}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center space-x-1 text-[10px] text-blue-600 hover:underline bg-white px-1.5 py-0.5 rounded border border-blue-200 font-mono"
                              >
                                <ExternalLink className="w-2 h-2" />
                                <span>{url.replace(/^https?:\/\//, '').slice(0, 24)}...</span>
                              </a>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* --- ROBOT / AGENT OUTBOUND (Right) --- */}
                  <div className="flex items-start justify-end space-x-2 ml-auto max-w-[85%] sm:max-w-[70%]">
                    <div className="space-y-1 text-right">
                      {/* Bot Bubble */}
                      <div className={`${meta.bubbleBot} border px-3 py-2 rounded-2xl rounded-tr-xs text-[12px] leading-relaxed text-left shadow-xs break-words`}>
                        <p className="whitespace-pre-wrap">{log.aiReply}</p>

                        {/* Product Suggestion Image Thumbnail if any */}
                        {log.replyImageUrl && (
                          <div className="mt-1.5 pt-1.5 border-t border-black/10">
                            <div
                              onClick={() =>
                                setLightboxImage({
                                  url: log.replyImageUrl!,
                                  title: "Grounded Catalog Item Attached",
                                })
                              }
                              className="relative group inline-flex items-center space-x-1.5 cursor-pointer bg-white px-2 py-1 rounded-lg border border-slate-200 shadow-xs hover:border-slate-400"
                            >
                              <img
                                src={log.replyImageUrl}
                                alt="Catalog product"
                                className="w-10 h-10 object-cover rounded-md"
                              />
                              <div className="text-[10px] text-slate-800 font-medium">
                                <span className="block font-bold text-slate-900">Catalog Item</span>
                                <span className="text-blue-600 flex items-center space-x-0.5">
                                  <Maximize2 className="w-2.5 h-2.5" />
                                  <span>Click to view</span>
                                </span>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Link previews if any */}
                        {botUrls.length > 0 && (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {botUrls.map((url, i) => (
                              <a
                                key={i}
                                href={url}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center space-x-1 text-[10px] text-slate-800 hover:underline bg-white px-1.5 py-0.5 rounded border border-slate-200 font-mono"
                              >
                                <ExternalLink className="w-2 h-2" />
                                <span>{url.replace(/^https?:\/\//, '').slice(0, 24)}...</span>
                              </a>
                            ))}
                          </div>
                        )}

                        {/* Inline Minimal Footer inside bubble */}
                        <div className={`mt-1 pt-1 border-t border-black/10 flex items-center justify-between text-[9.5px] ${meta.botFooterText} font-medium`}>
                          <span className="flex items-center space-x-1">
                            <CheckCheck className="w-3 h-3 opacity-80" />
                            <span>{isHuman ? "Human Agent" : `AI Bot • ${log.latencyMs}ms`}</span>
                          </span>

                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => handleCopyText(log.id, log.aiReply)}
                              className="hover:underline flex items-center space-x-0.5 cursor-pointer"
                            >
                              {copiedTextId === log.id ? (
                                <Check className="w-2.5 h-2.5" />
                              ) : (
                                <Copy className="w-2.5 h-2.5" />
                              )}
                              <span>{copiedTextId === log.id ? "Copied" : "Copy"}</span>
                            </button>

                            <button
                              onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                              className="hover:underline flex items-center space-x-0.5 cursor-pointer font-mono"
                            >
                              <Code2 className="w-2.5 h-2.5" />
                              <span>{isExpanded ? "Hide" : "JSON"}</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className={`w-6 h-6 rounded-full ${meta.botAvatarBg} border flex items-center justify-center font-bold text-[10px] shrink-0`}>
                      {isHuman ? <UserCheck className="w-3 h-3" /> : <Bot className="w-3 h-3" />}
                    </div>
                  </div>
                </div>

                {/* Compact Raw JSON Drawer */}
                {isExpanded && (
                  <div className="mt-2 bg-[#0F172A] text-[#F8FAFC] p-2.5 rounded-lg border border-slate-700 font-mono text-[10px] overflow-x-auto shadow-inner">
                    <pre className="select-all">
                      {JSON.stringify(
                        {
                          event_id: log.id,
                          channel: log.platform,
                          sender: log.customerName,
                          incoming_text: log.incomingText,
                          reply_text: log.aiReply,
                          latency_ms: log.latencyMs,
                        },
                        null,
                        2
                      )}
                    </pre>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Lightbox Modal */}
      {lightboxImage && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-3">
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-3 max-w-lg w-full shadow-2xl relative animate-in fade-in zoom-in-95 duration-100">
            <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-slate-800">
              <span className="text-xs font-bold text-slate-200 truncate">
                {lightboxImage.title}
              </span>
              <button
                onClick={() => setLightboxImage(null)}
                className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex justify-center bg-black/50 rounded-lg overflow-hidden p-1 max-h-[65vh]">
              <img
                src={lightboxImage.url}
                alt="Zoom preview"
                className="max-h-[60vh] object-contain rounded"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
