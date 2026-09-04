import React, { useState } from "react";
import { SocialConfig, TenantUser } from "../types";
import {
  CheckCircle,
  Link2,
  Shield,
  Radio,
  Copy,
  Check,
  Key,
  Share2,
  Loader2,
  AlertCircle,
} from "lucide-react";

interface Props {
  configs: SocialConfig[];
  currentTenant: TenantUser;
  onUpdateConfig: (updated: SocialConfig) => void;
  onSimulateIncomingWebhook: (platform: "facebook" | "instagram" | "whatsapp" | "tiktok") => void;
}

export const SocialIntegrations: React.FC<Props> = ({
  configs,
  currentTenant,
  onUpdateConfig,
  onSimulateIncomingWebhook,
}) => {
  const [activePlatform, setActivePlatform] = useState<"facebook" | "instagram" | "whatsapp" | "tiktok">("facebook");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const selectedConfig = configs.find((c) => c.platform === activePlatform) || configs[0];

  const CENTRAL_GATEWAY_URL = "https://ai-shop-agent.onrender.com";

  const getCleanWebhookUrl = (plat: string, currentUrl?: string) => {
    // Return permanent production central cloud gateway URL
    return `${CENTRAL_GATEWAY_URL}/api/webhook/${plat}`;
  };

  const [webhookUrl, setWebhookUrl] = useState(() => getCleanWebhookUrl(selectedConfig.platform, selectedConfig.webhookUrl));
  const [verifyToken, setVerifyToken] = useState(selectedConfig.verifyToken || "shop_agent_secret_handshake_fb");
  const [pageId, setPageId] = useState(selectedConfig.pageId || "");
  const [accessToken, setAccessToken] = useState(selectedConfig.accessToken || "");
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationError, setVerificationError] = useState<string | null>(selectedConfig.verificationError || null);
  const [verificationSuccess, setVerificationSuccess] = useState<string | null>(null);

  const handleSelectPlatform = (p: "facebook" | "instagram" | "whatsapp" | "tiktok") => {
    setActivePlatform(p);
    const cfg = configs.find((c) => c.platform === p) || configs[0];
    setWebhookUrl(getCleanWebhookUrl(p, cfg.webhookUrl));
    setVerifyToken(cfg.verifyToken || `shop_agent_secret_handshake_${p.slice(0, 2)}`);
    setPageId(cfg.pageId || "");
    setAccessToken(cfg.accessToken || "");
    setSavedSuccess(false);
    setVerificationError(cfg.verificationError || null);
    setVerificationSuccess(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setVerificationError(null);
    setVerificationSuccess(null);
    setSavedSuccess(false);

    const cleanPageId = pageId.trim();
    const cleanToken = accessToken.trim();
    const cleanVerifyToken = verifyToken.trim() || "shop_agent_secret_handshake_fb";

    // 1. Client-side validation: Both Page ID and Token are required
    if (!cleanPageId || !cleanToken) {
      const err = activePlatform === "facebook"
        ? "Facebook Page ID এবং Page Access Token পূরণ করা আবশ্যক। ভুল বা খালি ক্রেডেনশিয়াল দিলে কানেক্ট করা সম্ভব নয়।"
        : "Page ID এবং Access Token পূরণ করা আবশ্যক।";
      setVerificationError(err);
      onUpdateConfig({
        ...selectedConfig,
        webhookUrl,
        verifyToken: cleanVerifyToken,
        pageId: cleanPageId,
        accessToken: cleanToken,
        isConnected: false,
        verificationError: err,
        lastSync: "Verification failed (Missing fields)",
      });
      return;
    }

    setIsVerifying(true);

    try {
      // 2. Call backend Meta Graph API verification endpoint
      const response = await fetch("/api/social/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platform: activePlatform,
          pageId: cleanPageId,
          accessToken: cleanToken,
          verifyToken: cleanVerifyToken,
          tenantId: currentTenant?.id || "default",
          shopName: currentTenant?.shopName || "Our Store",
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        // Verification failed! Show exact error and keep isConnected = false
        const errorMessage = data.details || data.error || "মেটা গ্রাফ এপিআই যাচাইকরণ ব্যর্থ হয়েছে।";
        setVerificationError(errorMessage);
        onUpdateConfig({
          ...selectedConfig,
          webhookUrl,
          verifyToken: cleanVerifyToken,
          pageId: cleanPageId,
          accessToken: cleanToken,
          isConnected: false,
          verificationError: errorMessage,
          lastSync: `Verification failed (${new Date().toLocaleTimeString()})`,
        });
      } else {
        // Verification succeeded!
        const pageName = data.page?.name || (activePlatform === "facebook" ? "Facebook Business Page" : "Channel Page");
        const successMessage = data.message || `মেটা গ্রাফ এপিআই ভেরিফিকেশন সফল! "${pageName}" পেজের সাথে কানেক্ট হয়েছে।`;
        
        setVerificationSuccess(successMessage);
        setSavedSuccess(true);
        setVerificationError(null);

        onUpdateConfig({
          ...selectedConfig,
          webhookUrl,
          verifyToken: cleanVerifyToken,
          pageId: data.page?.id || cleanPageId,
          accessToken: cleanToken,
          pageName,
          isConnected: true,
          verificationError: undefined,
          verifiedAt: data.verifiedAt || new Date().toISOString(),
          lastSync: `Verified & Connected at ${new Date().toLocaleTimeString()}`,
        });

        setTimeout(() => setSavedSuccess(false), 3500);
      }
    } catch (netErr: any) {
      console.error("Verification network error:", netErr);
      const netMsg = "সার্ভারের সাথে সংযোগ করা যায়নি। আপনার ইন্টারনেট সংযোগ চেক করুন।";
      setVerificationError(netMsg);
      onUpdateConfig({
        ...selectedConfig,
        webhookUrl,
        verifyToken: cleanVerifyToken,
        pageId: cleanPageId,
        accessToken: cleanToken,
        isConnected: false,
        verificationError: netMsg,
        lastSync: "Connection error",
      });
    } finally {
      setIsVerifying(false);
    }
  };

  const handleDisconnect = async () => {
    setIsVerifying(true);
    try {
      await fetch("/api/social/disconnect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platform: activePlatform,
          tenantId: currentTenant?.id || "default",
        }),
      });

      onUpdateConfig({
        ...selectedConfig,
        isConnected: false,
        verificationError: undefined,
        lastSync: `Disconnected at ${new Date().toLocaleTimeString()}`,
      });
      setVerificationSuccess(`${selectedConfig.name} চ্যানেলটি ডিসকানেক্ট করা হয়েছে।`);
      setVerificationError(null);
      setTimeout(() => setVerificationSuccess(null), 3000);
    } catch (e) {
      console.error("Disconnect error:", e);
    } finally {
      setIsVerifying(false);
    }
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(id);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Platform specific clean light theme branding definitions
  const platformThemes = {
    facebook: {
      displayName: "Facebook Messenger",
      badgeLabel: "Meta Graph API",
      subtitle: "Connect your official Facebook Business Page for automated messenger sales & replies.",
      brandHex: "#1877F2",
      containerBg: "bg-[#FFFFFF]",
      containerBorder: "border-[#1877F2]/40 ring-1 ring-[#1877F2]/20",
      topBarBg: "bg-[#EFF6FF]",
      topTileActive: "bg-[#F0F7FF] border-[#1877F2] shadow-sm",
      badgeBg: "bg-[#1877F2]/10 text-[#1877F2] border-[#1877F2]/25",
      actionBtn: "bg-[#1877F2] hover:bg-[#166FE5] text-white shadow-xs font-semibold",
      testBtn: "bg-blue-50 hover:bg-blue-100 text-[#1877F2] border-blue-200",
      focusBorder: "focus:border-[#1877F2] focus:ring-1 focus:ring-[#1877F2]",
      idLabel: "Facebook Page ID / Meta Business ID",
      idPlaceholder: "e.g. 10928301928301",
      tokenLabel: "Page Access Token (Permanent Meta System Token)",
      guideList: [
        "In Meta Developer Portal > App Dashboard, add the Webhooks & Messenger products.",
        "Paste the Webhook Callback URL and Handshake Verify Token below.",
        "Subscribe to 'messages' & 'messaging_postbacks' events for your Facebook Page.",
        "Click Save & Activate — the sales assistant starts handling customer messages instantly.",
      ],
    },
    whatsapp: {
      displayName: "WhatsApp Business Cloud",
      badgeLabel: "WhatsApp Cloud API",
      subtitle: "Direct 24/7 automated order booking, inquiries & catalog lookup on WhatsApp.",
      brandHex: "#16A34A",
      containerBg: "bg-[#FFFFFF]",
      containerBorder: "border-[#16A34A]/40 ring-1 ring-[#16A34A]/20",
      topBarBg: "bg-[#F0FDF4]",
      topTileActive: "bg-[#F0FDF4] border-[#16A34A] shadow-sm",
      badgeBg: "bg-[#16A34A]/10 text-[#15803D] border-[#16A34A]/25",
      actionBtn: "bg-[#16A34A] hover:bg-[#15803D] text-white shadow-xs font-semibold",
      testBtn: "bg-emerald-50 hover:bg-emerald-100 text-[#15803D] border-emerald-200",
      focusBorder: "focus:border-[#16A34A] focus:ring-1 focus:ring-[#16A34A]",
      idLabel: "WhatsApp Phone Number ID",
      idPlaceholder: "e.g. 104829104829104",
      tokenLabel: "WhatsApp Cloud Permanent API Bearer Token",
      guideList: [
        "In Meta Developers > WhatsApp > Configuration, set the Callback URL and Verify Token.",
        "Subscribe to the 'messages' webhook field.",
        "Paste your registered WhatsApp Phone Number ID and permanent token.",
        "Click Save & Activate — customer WhatsApp messages will receive automated replies.",
      ],
    },
    instagram: {
      displayName: "Instagram Direct Messaging",
      badgeLabel: "Instagram Graph API",
      subtitle: "Automate direct messages, story mentions, and product inquiries on Instagram.",
      brandHex: "#E1306C",
      containerBg: "bg-[#FFFFFF]",
      containerBorder: "border-[#E1306C]/40 ring-1 ring-[#E1306C]/20",
      topBarBg: "bg-[#FDF2F8]",
      topTileActive: "bg-[#FDF2F8] border-[#E1306C] shadow-sm",
      badgeBg: "bg-[#E1306C]/10 text-[#BE185D] border-[#E1306C]/25",
      actionBtn: "bg-gradient-to-r from-[#833AB4] via-[#E1306C] to-[#FD1D1D] hover:opacity-95 text-white font-semibold shadow-xs",
      testBtn: "bg-pink-50 hover:bg-pink-100 text-[#BE185D] border-pink-200",
      focusBorder: "focus:border-[#E1306C] focus:ring-1 focus:ring-[#E1306C]",
      idLabel: "Instagram Professional Account ID",
      idPlaceholder: "e.g. 178414001928374",
      tokenLabel: "Instagram Graph API Access Token",
      guideList: [
        "In Meta Developer App, add Instagram Graph API and link your IG Business Account.",
        "Configure Webhook Callback URL and Verify Token under Instagram webhooks.",
        "Subscribe to 'messages' and 'messaging_seen' events.",
        "Click Save & Activate — your Instagram DM auto-sales agent is live.",
      ],
    },
    tiktok: {
      displayName: "TikTok Shop & Messaging",
      badgeLabel: "TikTok Open Platform",
      subtitle: "Connect TikTok Shop and customer DM channels for automated catalog discovery.",
      brandHex: "#0F172A",
      containerBg: "bg-[#FFFFFF]",
      containerBorder: "border-slate-300 ring-1 ring-slate-200",
      topBarBg: "bg-[#F8FAFC]",
      topTileActive: "bg-[#F8FAFC] border-slate-800 shadow-sm",
      badgeBg: "bg-slate-100 text-slate-800 border-slate-300",
      actionBtn: "bg-[#0F172A] hover:bg-[#1E293B] text-white shadow-xs font-semibold",
      testBtn: "bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-300",
      focusBorder: "focus:border-slate-900 focus:ring-1 focus:ring-slate-900",
      idLabel: "TikTok Business ID / Shop ID",
      idPlaceholder: "e.g. 7192834019283",
      tokenLabel: "TikTok Business Access Token",
      guideList: [
        "In TikTok for Developers, configure your Webhook endpoints.",
        "Enter the Webhook Callback URL and Verify Token.",
        "Subscribe to customer message and order query events.",
        "Click Save & Activate — TikTok customer inquiries will receive AI replies.",
      ],
    },
  };

  const currentTheme = platformThemes[activePlatform];

  return (
    <div id="social-integrations-view" className="w-full flex-1 flex flex-col min-h-0 p-4 sm:p-6 bg-[#F8FAFC] text-[#0F172A] overflow-y-auto custom-scrollbar pb-20">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center space-x-2.5">
            <h2 className="text-lg font-bold text-[#0F172A] tracking-tight">Social Accounts &amp; Webhook Gateways</h2>
            <span className="bg-blue-50 text-blue-700 border border-blue-200 px-2.5 py-0.5 rounded-full text-[11px] font-semibold">
              Multi-Channel Sales Engine
            </span>
          </div>
          <p className="text-xs text-[#64748B] mt-0.5">
            Connect Facebook, WhatsApp, Instagram &amp; TikTok with isolated webhooks for <span className="text-[#0F172A] font-semibold">{currentTenant.shopName}</span>.
          </p>
        </div>
      </div>

      {/* 4 Social Platform Selector Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5 mb-6">
        {configs.map((c) => {
          const isSelected = c.platform === activePlatform;
          const theme = platformThemes[c.platform];
          const displayTitle =
            c.platform === "facebook"
              ? "Facebook"
              : c.platform === "instagram"
              ? "Instagram"
              : c.platform === "whatsapp"
              ? "WhatsApp Business"
              : "TikTok";

          return (
            <button
              key={c.platform}
              id={`btn-select-social-${c.platform}`}
              onClick={() => handleSelectPlatform(c.platform)}
              className={`p-3.5 rounded-xl border text-left transition-all relative overflow-hidden flex items-center justify-between cursor-pointer ${
                isSelected
                  ? theme.topTileActive
                  : "bg-[#FFFFFF] border-[#E2E8F0] hover:border-[#CBD5E1] hover:bg-[#F8FAFC] shadow-xs"
              }`}
            >
              <div className="flex items-center space-x-2 mr-2 min-w-0">
                <span
                  className="w-2.5 h-2.5 rounded-full shadow-xs shrink-0"
                  style={{ backgroundColor: theme.brandHex }}
                />
                <span className="text-xs font-bold text-[#0F172A] truncate">{displayTitle}</span>
              </div>

              {c.isConnected ? (
                <span className="flex items-center space-x-1 text-[10px] text-emerald-700 font-semibold bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full shrink-0">
                  <CheckCircle className="w-2.5 h-2.5" />
                  <span>CONNECTED</span>
                </span>
              ) : (
                <span className="flex items-center space-x-1 text-[10px] text-red-700 font-semibold bg-red-50 border border-red-200 px-2 py-0.5 rounded-full shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                  <span>NOT CONNECTED</span>
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Dynamic Brand Styled Configuration Box */}
      <div className={`${currentTheme.containerBg} border ${currentTheme.containerBorder} rounded-2xl shadow-sm transition-all flex flex-col mb-8`}>
        {/* Brand Top Banner */}
        <div className={`${currentTheme.topBarBg} px-6 py-4 border-b border-[#E2E8F0] flex flex-col sm:flex-row sm:items-center justify-between gap-4`}>
          <div className="flex items-center space-x-3.5">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-base shadow-xs shrink-0"
              style={{ backgroundColor: currentTheme.brandHex }}
            >
              {selectedConfig.name.charAt(0)}
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-base font-bold text-[#0F172A]">{currentTheme.displayName}</h3>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${currentTheme.badgeBg}`}>
                  {currentTheme.badgeLabel}
                </span>
              </div>
              <p className="text-xs text-[#64748B] mt-0.5">{currentTheme.subtitle}</p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              id={`btn-test-webhook-${activePlatform}`}
              type="button"
              onClick={() => onSimulateIncomingWebhook(activePlatform)}
              className={`${currentTheme.testBtn} border text-xs font-semibold px-3.5 py-1.5 rounded-lg flex items-center space-x-1.5 transition-all cursor-pointer shadow-xs`}
            >
              <Radio className="w-3.5 h-3.5 animate-pulse" />
              <span>Simulate Inbound Event</span>
            </button>
          </div>
        </div>

        {/* Form Body */}
        <div className="p-6">
          <form onSubmit={handleSave} className="space-y-4 text-xs">
            {/* Webhook URL */}
            <div>
              <label className="block text-[#334155] font-semibold mb-1.5 flex items-center justify-between">
                <span className="flex items-center space-x-1.5">
                  <Link2 className="w-3.5 h-3.5 text-blue-600" />
                  <span>Webhook Callback URL</span>
                </span>
                <button
                  type="button"
                  onClick={() => handleCopy(webhookUrl, "wh")}
                  className="text-blue-600 hover:text-blue-700 font-medium flex items-center space-x-1 text-[11px] cursor-pointer"
                >
                  {copiedKey === "wh" ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedKey === "wh" ? "Copied" : "Copy URL"}</span>
                </button>
              </label>
              <input
                id="input-webhook-url"
                type="text"
                required
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                className={`w-full bg-[#FFFFFF] border border-[#CBD5E1] rounded-lg px-3 py-2 text-[#0F172A] font-mono focus:outline-none ${currentTheme.focusBorder} transition-colors shadow-xs`}
              />
              
              {/* Central 24/7 Cloud Gateway Notice */}
              <div className="mt-2.5 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-[#065F46]">
                <div className="flex items-start space-x-2">
                  <span className="text-sm leading-none mt-0.5">🚀</span>
                  <div className="space-y-1">
                    <p className="font-semibold text-[11px] text-emerald-900">
                      Permanent 24/7 Cloud Gateway Webhook (Meta-Ready)
                    </p>
                    <p className="text-[11px] text-emerald-800 leading-relaxed">
                      এই পার্মানেন্ট HTTPS Webhook লিঙ্কটি সরাসরি ফেসবুকে বসিয়ে <strong>"Verify and Save"</strong> বাটনে ক্লিক করলেই ১ সেকেন্ডে ভেরিফাই হয়ে যাবে। কোনো CMD বা জটিলতা প্রয়োজন নেই!
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Handshake Verify Token */}
              <div>
                <label className="block text-[#334155] font-semibold mb-1.5 flex items-center justify-between">
                  <span>Verify Token (Secret Handshake)</span>
                  <button
                    type="button"
                    onClick={() => handleCopy(verifyToken, "vt")}
                    className="text-blue-600 hover:text-blue-700 font-medium flex items-center space-x-1 text-[11px] cursor-pointer"
                  >
                    {copiedKey === "vt" ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedKey === "vt" ? "Copied" : "Copy"}</span>
                  </button>
                </label>
                <input
                  id="input-verify-token"
                  type="text"
                  required
                  value={verifyToken}
                  onChange={(e) => setVerifyToken(e.target.value)}
                  className={`w-full bg-[#FFFFFF] border border-[#CBD5E1] rounded-lg px-3 py-2 text-[#0F172A] font-mono focus:outline-none ${currentTheme.focusBorder} transition-colors shadow-xs`}
                />
              </div>

              {/* ID Field */}
              <div>
                <label className="block text-[#334155] font-semibold mb-1.5">
                  {currentTheme.idLabel}
                </label>
                <input
                  id="input-page-id"
                  type="text"
                  value={pageId}
                  onChange={(e) => setPageId(e.target.value)}
                  placeholder={currentTheme.idPlaceholder}
                  className={`w-full bg-[#FFFFFF] border border-[#CBD5E1] rounded-lg px-3 py-2 text-[#0F172A] font-mono focus:outline-none ${currentTheme.focusBorder} transition-colors shadow-xs`}
                />
              </div>
            </div>

            {/* Permanent Token */}
            <div>
              <label className="block text-[#334155] font-semibold mb-1.5 flex items-center space-x-1.5">
                <Key className="w-3.5 h-3.5 text-amber-500" />
                <span>{currentTheme.tokenLabel}</span>
              </label>
              <input
                id="input-access-token"
                type="password"
                value={accessToken}
                onChange={(e) => setAccessToken(e.target.value)}
                placeholder="Paste Bearer / Graph API Token..."
                className={`w-full bg-[#FFFFFF] border border-[#CBD5E1] rounded-lg px-3 py-2 text-[#0F172A] font-mono focus:outline-none ${currentTheme.focusBorder} transition-colors shadow-xs`}
              />
            </div>

            {/* Verification Error Alert */}
            {verificationError && (
              <div className="p-4 bg-red-50/90 border border-red-200 rounded-xl flex items-start space-x-3 text-xs animate-in fade-in duration-200">
                <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-red-800 text-[13px]">
                    মেটা গ্রাফ এপিআই যাচাইকরণ ব্যর্থ হয়েছে (Connection Failed)
                  </div>
                  <div className="text-red-700 mt-1 leading-relaxed font-normal">
                    {verificationError}
                  </div>
                  <div className="text-red-600/90 text-[11px] mt-2 font-medium bg-red-100/60 p-2 rounded-lg border border-red-200/50">
                    💡 <strong>টিপস:</strong> মেটা ডেভেলপার পোর্টাল (developers.facebook.com) থেকে আপনার ফেসবুক পেজ আইডি এবং বৈধ Permanent Page Access Token কপি করে এখানে দিন। ডেমো বা ভুল আইডি/টোকেন দিলে মেটা কানেকশন গ্রহণ করবে না।
                  </div>
                </div>
              </div>
            )}

            {/* Verification Success Alert */}
            {verificationSuccess && (
              <div className="p-4 bg-emerald-50/90 border border-emerald-200 rounded-xl flex items-start space-x-3 text-xs animate-in fade-in duration-200">
                <CheckCircle className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-emerald-800 text-[13px]">
                    মেটা কানেকশন সফলভাবে সক্রিয় হয়েছে!
                  </div>
                  <div className="text-emerald-700 mt-1 leading-relaxed">
                    {verificationSuccess}
                  </div>
                </div>
              </div>
            )}

            {/* Footer Actions */}
            <div className="pt-3 flex items-center justify-between border-t border-[#E2E8F0] gap-3">
              <div>
                {savedSuccess ? (
                  <span className="text-emerald-600 font-semibold flex items-center space-x-1.5 text-xs">
                    <CheckCircle className="w-4 h-4" />
                    <span>Connection settings verified &amp; saved!</span>
                  </span>
                ) : (
                  <span className="text-[#64748B] text-[11px] block">
                    Last synced: {selectedConfig.lastSync || "Never"}
                  </span>
                )}
                {selectedConfig.pageName && selectedConfig.isConnected && (
                  <span className="text-[11px] text-blue-700 font-medium mt-0.5 block">
                    Connected Page: <strong>{selectedConfig.pageName}</strong>
                  </span>
                )}
              </div>

              <div className="flex items-center space-x-2 shrink-0">
                {selectedConfig.isConnected && (
                  <button
                    type="button"
                    onClick={handleDisconnect}
                    disabled={isVerifying}
                    className="px-3 py-2 rounded-lg text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 transition-colors cursor-pointer disabled:opacity-50"
                  >
                    Disconnect
                  </button>
                )}

                <button
                  id="btn-save-social-config"
                  type="submit"
                  disabled={isVerifying}
                  className={`${currentTheme.actionBtn} px-5 py-2.5 rounded-lg text-xs tracking-wide transition-all cursor-pointer flex items-center space-x-2 disabled:opacity-60 disabled:cursor-not-allowed`}
                >
                  {isVerifying ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Verifying with Meta API...</span>
                    </>
                  ) : (
                    <span>{selectedConfig.isConnected ? "Re-Verify & Save" : "Save & Activate Channel"}</span>
                  )}
                </button>
              </div>
            </div>
          </form>

          {/* Clean 4-step guide */}
          <div className="mt-6 p-4 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl">
            <div className="flex items-center space-x-2 text-xs font-bold text-[#0F172A] mb-2">
              <Shield className="w-3.5 h-3.5 text-blue-600" />
              <span>Developer Handshake &amp; Webhook Setup:</span>
            </div>
            <ol className="list-decimal list-inside text-[11px] text-[#475569] space-y-1">
              {currentTheme.guideList.map((step, idx) => (
                <li key={idx}>{step}</li>
              ))}
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
};
