import React, { useState, useEffect } from "react";
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
  Sparkles,
  ChevronDown,
  ChevronUp,
  Building2,
  Zap,
  ExternalLink,
  Trash2,
} from "lucide-react";

interface Props {
  configs: SocialConfig[];
  currentTenant: TenantUser;
  onUpdateConfig: (updated: SocialConfig) => void;
  onSimulateIncomingWebhook: (platform: "facebook" | "instagram" | "whatsapp" | "tiktok") => void;
}

interface DiscoveredPage {
  id: string;
  name: string;
  category: string;
  accessToken: string;
  pictureUrl?: string;
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
  const [verifyToken, setVerifyToken] = useState(
    selectedConfig.verifyToken && selectedConfig.verifyToken.startsWith("aishopagent")
      ? selectedConfig.verifyToken
      : "aishopagent_secret_token_2025"
  );
  const [pageId, setPageId] = useState(selectedConfig.pageId || "");
  const [accessToken, setAccessToken] = useState(selectedConfig.accessToken || "");
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationError, setVerificationError] = useState<string | null>(selectedConfig.verificationError || null);
  const [verificationSuccess, setVerificationSuccess] = useState<string | null>(null);

  // 1-Click Page Auto Discovery state
  // User's official Meta App ID: 1037142862491389 (Live Mode Activated)
  const DEFAULT_META_APP_ID = "1037142862491389";
  const [appIdInput, setAppIdInput] = useState(() => {
    const saved = localStorage.getItem("meta_app_id");
    if (!saved || saved === "2748431182224268" || saved === "1211245858746878" || saved === "2241054986685445" || saved.length < 10) {
      localStorage.setItem("meta_app_id", DEFAULT_META_APP_ID);
      return DEFAULT_META_APP_ID;
    }
    return saved;
  });
  const [userTokenInput, setUserTokenInput] = useState("");
  const [isFetchingPages, setIsFetchingPages] = useState(false);
  const [isSdkLoggingIn, setIsSdkLoggingIn] = useState(false);
  const [discoveredPages, setDiscoveredPages] = useState<DiscoveredPage[]>([]);
  const [showManualSetup, setShowManualSetup] = useState(false);
  const [showAppIdModal, setShowAppIdModal] = useState(false);
  const [diagnosticsResult, setDiagnosticsResult] = useState<{ status: "ok" | "error"; message: string } | null>(null);

  // Initialize Facebook JS SDK & message listener for OAuth popup handoff
  useEffect(() => {
    const currentAppId = localStorage.getItem("meta_app_id") || DEFAULT_META_APP_ID;
    if (currentAppId === "2748431182224268") {
      localStorage.setItem("meta_app_id", DEFAULT_META_APP_ID);
      setAppIdInput(DEFAULT_META_APP_ID);
    }

    // Global listener for OAuth callback window
    const handleAuthMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === "FB_OAUTH_TOKEN" && event.data.accessToken) {
        setIsSdkLoggingIn(false);
        const token = event.data.accessToken;
        setUserTokenInput(token);
        setAccessToken(token);
        handleFetchUserPages(token);
      } else if (event.data && event.data.type === "FB_OAUTH_ERROR") {
        setIsSdkLoggingIn(false);
        setVerificationError(`Facebook Login Error: ${event.data.error || "অনুমোদন পাওয়া যায়নি।"}`);
      }
    };

    window.addEventListener("message", handleAuthMessage);

    // BroadcastChannel for reliable cross-window / cross-frame handoff
    let bc: BroadcastChannel | null = null;
    try {
      bc = new BroadcastChannel("fb_oauth_handoff_channel");
      bc.onmessage = (event) => {
        if (event.data && event.data.type === "FB_OAUTH_TOKEN" && event.data.accessToken) {
          setIsSdkLoggingIn(false);
          const token = event.data.accessToken;
          setUserTokenInput(token);
          setAccessToken(token);
          handleFetchUserPages(token);
        }
      };
    } catch (e) {
      console.warn("BroadcastChannel not supported:", e);
    }

    // Server-side OAuth Polling & Cross-Sandbox Bridge (Polls server every 700ms)
    const serverPollInterval = setInterval(async () => {
      try {
        const tenantId = currentTenant?.id || "default";
        const res = await fetch(`/api/social/oauth-status?tenant_id=${encodeURIComponent(tenantId)}`);
        if (!res.ok) return;
        const data = await res.json();

        if (data && data.hasSession) {
          if (data.autoConnected && data.connectedPage) {
            setIsSdkLoggingIn(false);
            setPageId(data.connectedPage.id);
            setAccessToken(data.connectedPage.accessToken);
            setSavedSuccess(true);
            setVerificationError(null);
            setVerificationSuccess(`🎉 ফেসবুক পেজ "${data.connectedPage.name}" সফলভাবে কানেক্ট হয়েছে এবং মেসেঞ্জার স্বয়ংক্রিয়ভাবে সক্রিয় করা হয়েছে!`);
            onUpdateConfig({
              ...selectedConfig,
              isConnected: true,
              pageId: data.connectedPage.id,
              pageName: data.connectedPage.name,
              accessToken: data.connectedPage.accessToken,
              lastSync: "Just now",
            });
            if (Array.isArray(data.pages)) {
              setDiscoveredPages(data.pages);
            }
            // Clear session so it only triggers once
            fetch("/api/social/oauth-clear", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ tenant_id: tenantId }),
            }).catch(() => {});
          } else if (Array.isArray(data.pages) && data.pages.length > 0) {
            setIsSdkLoggingIn(false);
            setDiscoveredPages(data.pages);
            if (data.accessToken) {
              setUserTokenInput(data.accessToken);
              setAccessToken(data.accessToken);
            }
            setVerificationSuccess(`আপনার ${data.pages.length}টি ফেসবুক পেজ পাওয়া গেছে! নিচে থেকে কানেক্ট করুন।`);
            fetch("/api/social/oauth-clear", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ tenant_id: tenantId }),
            }).catch(() => {});
          }
        }
      } catch (pollErr) {
        // Quiet failure during background poll
      }
    }, 700);

    // Initial sync with server's active channel configuration
    const tenantId = currentTenant?.id || "default";
    fetch(`/api/social/status?platform=facebook&tenant_id=${encodeURIComponent(tenantId)}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.isConnected && data.channel) {
          if (!selectedConfig.isConnected || selectedConfig.pageId !== data.channel.pageId) {
            setPageId(data.channel.pageId);
            setAccessToken(data.channel.accessToken);
            onUpdateConfig({
              ...selectedConfig,
              isConnected: true,
              pageId: data.channel.pageId,
              pageName: data.channel.pageName,
              accessToken: data.channel.accessToken,
              lastSync: "Just now",
            });
          }
        }
      })
      .catch(() => {});

    // Check localStorage handoff periodically (polls every 350ms)
    const interval = setInterval(() => {
      const handoffToken = localStorage.getItem("fb_oauth_token_handoff");
      if (handoffToken) {
        localStorage.removeItem("fb_oauth_token_handoff");
        setIsSdkLoggingIn(false);
        setUserTokenInput(handoffToken);
        setAccessToken(handoffToken);
        handleFetchUserPages(handoffToken);
      }
    }, 350);

    if (typeof window !== "undefined" && !document.getElementById("facebook-jssdk")) {
      const script = document.createElement("script");
      script.id = "facebook-jssdk";
      script.src = "https://connect.facebook.net/en_US/sdk.js";
      script.async = true;
      script.defer = true;
      script.crossOrigin = "anonymous";
      document.body.appendChild(script);
    }

    return () => {
      window.removeEventListener("message", handleAuthMessage);
      if (bc) bc.close();
      clearInterval(interval);
      clearInterval(serverPollInterval);
    };
  }, [currentTenant?.id, selectedConfig.isConnected, selectedConfig.pageId]);

  const handleFbSdkLogin = () => {
    const effectiveAppId = (appIdInput || localStorage.getItem("meta_app_id") || DEFAULT_META_APP_ID).trim();
    localStorage.setItem("meta_app_id", effectiveAppId);
    setIsSdkLoggingIn(true);
    setVerificationError(null);
    setVerificationSuccess("ফেসবুকে লগইন সম্পন্ন হচ্ছে... পপ-আপে অনুমোদন সম্পন্ন করুন।");

    // Use current origin so BroadcastChannel, localStorage, and postMessage are 100% same-origin
    const redirectUri = `${window.location.origin}/oauth-callback.html`;
    const scopes = "pages_show_list,pages_messaging,pages_manage_metadata,public_profile";
    const tenantId = currentTenant?.id || "default";
    const oauthUrl = `https://www.facebook.com/v19.0/dialog/oauth?client_id=${effectiveAppId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scopes)}&response_type=token&state=${encodeURIComponent(tenantId)}`;

    const win = window as any;
    // If Facebook JS SDK is available and working
    if (win.FB && typeof win.FB.login === "function") {
      try {
        win.FB.init({
          appId: effectiveAppId,
          cookie: true,
          xfbml: true,
          version: "v19.0",
        });

        win.FB.login(
          (response: any) => {
            setIsSdkLoggingIn(false);
            if (response.authResponse && response.authResponse.accessToken) {
              const token = response.authResponse.accessToken;
              setUserTokenInput(token);
              setAccessToken(token);
              handleFetchUserPages(token);
            } else {
              // Direct popup window fallback
              const popup = window.open(oauthUrl, "facebook_login", "width=620,height=760,top=80,left=100");
              if (!popup) {
                setVerificationError("পপ-আপ উইন্ডো ব্লক করা হয়েছে। অনুগ্রহ করে ব্রাউজারের অ্যাড্রেস বারে পপ-আপ অনুমতি (Allow) দিন অথবা নতুন ট্যাবে অ্যাপটি ওপেন করুন।");
              }
            }
          },
          {
            scope: scopes,
            return_scopes: true,
          }
        );
        return;
      } catch (err: any) {
        console.warn("FB SDK init failed, falling back to popup:", err);
      }
    }

    // Direct OAuth Popup fallback (works inside iframes & all browsers)
    const popup = window.open(oauthUrl, "facebook_login", "width=620,height=760,top=80,left=100");
    if (!popup) {
      setIsSdkLoggingIn(false);
      setVerificationError("পপ-আপ উইন্ডোটি ব্লক করা হয়েছে। ব্রাউজারের URL বারে পপ-আপ অ্যালাও করুন বা নতুন ট্যাবে অ্যাপটি খুলুন।");
    }
  };

  const handleSelectPlatform = (p: "facebook" | "instagram" | "whatsapp" | "tiktok") => {
    setActivePlatform(p);
    const cfg = configs.find((c) => c.platform === p) || configs[0];
    setWebhookUrl(getCleanWebhookUrl(p, cfg.webhookUrl));
    setVerifyToken(
      cfg.verifyToken && cfg.verifyToken.startsWith("aishopagent")
        ? cfg.verifyToken
        : "aishopagent_secret_token_2025"
    );
    setPageId(cfg.pageId || "");
    setAccessToken(cfg.accessToken || "");
    setSavedSuccess(false);
    setVerificationError(cfg.verificationError || null);
    setVerificationSuccess(null);
    setDiscoveredPages([]);
  };

  // 1-Click Fetch All Facebook Pages
  const handleFetchUserPages = async (tokenToUse?: string) => {
    const effectiveToken = (tokenToUse || userTokenInput || accessToken).trim();
    if (!effectiveToken) {
      setVerificationError("ফেসবুক পেজ তালিকা লোড করতে আপনার মেটা টোকেন প্রদান করুন।");
      return;
    }

    setIsFetchingPages(true);
    setVerificationError(null);

    try {
      const res = await fetch("/api/social/facebook/pages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessToken: effectiveToken }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setVerificationError(data.error || "ফেসবুক পেজ লোড করা যায়নি। টোকেনটি সঠিক কিনা চেক করুন।");
        setDiscoveredPages([]);
      } else if (Array.isArray(data.pages) && data.pages.length > 0) {
        setDiscoveredPages(data.pages);
        if (data.pages.length === 1) {
          const onlyPage = data.pages[0];
          setVerificationSuccess(`আপনার ফেসবুক পেজ "${onlyPage.name}" পাওয়া গেছে! স্বয়ংক্রিয়ভাবে কানেক্ট করা হচ্ছে...`);
          setPageId(onlyPage.id);
          setAccessToken(onlyPage.accessToken);
          await executeVerification(onlyPage.id, onlyPage.accessToken, verifyToken);
        } else {
          setVerificationSuccess(`আপনার অ্যাকাউন্টের ${data.pages.length}টি ফেসবুক পেজ পাওয়া গেছে! নিচে থেকে আপনার পেজটি নির্বাচন করে কানেক্ট করুন।`);
        }
      } else {
        setVerificationError("এই টোকেনের অধীনে কোনো ফেসবুক পেজ পাওয়া যায়নি। নিশ্চিত করুন আপনার আইডিতে পেজ অ্যাডমিন রোল রয়েছে।");
        setDiscoveredPages([]);
      }
    } catch (err: any) {
      setVerificationError("সার্ভার থেকে পেজ তালিকা আনা যায়নি। ইন্টারনেট কানেকশন চেক করুন।");
    } finally {
      setIsFetchingPages(false);
    }
  };

  // 1-Click Connect a Discovered Page
  const handleConnectDiscoveredPage = async (page: DiscoveredPage) => {
    setPageId(page.id);
    setAccessToken(page.accessToken);
    await executeVerification(page.id, page.accessToken, verifyToken);
  };

  const executeVerification = async (targetPageId: string, targetToken: string, targetVerifyToken: string) => {
    const cleanPageId = targetPageId.trim();
    const cleanToken = targetToken.trim();
    const cleanVerifyToken = targetVerifyToken.trim() || "aishopagent_secret_token_2025";

    if (!cleanPageId || !cleanToken) {
      const err = activePlatform === "facebook"
        ? "Facebook Page ID এবং Page Access Token পূরণ করা আবশ্যক।"
        : "Page ID এবং Access Token পূরণ করা আবশ্যক।";
      setVerificationError(err);
      return;
    }

    setIsVerifying(true);
    setVerificationError(null);
    setVerificationSuccess(null);

    try {
      const verifyPayload = {
        platform: activePlatform,
        pageId: cleanPageId,
        accessToken: cleanToken,
        verifyToken: cleanVerifyToken,
        tenantId: currentTenant?.id || "default",
        shopName: currentTenant?.shopName || "Our Store",
      };

      const response = await fetch("/api/social/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(verifyPayload),
      });

      const data = await response.json();

      // Proactively sync to central cloud gateway
      if (typeof window !== "undefined" && !window.location.origin.includes("onrender.com")) {
        try {
          await fetch(`${CENTRAL_GATEWAY_URL}/api/social/verify`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(verifyPayload),
          });
        } catch (cloudSyncErr) {
          console.warn("Central cloud gateway sync notice:", cloudSyncErr);
        }
      }

      if (!response.ok || !data.success) {
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
        const pageName = data.page?.name || (activePlatform === "facebook" ? "Facebook Business Page" : "Channel Page");
        const successMessage = data.message || `মেটা গ্রাফ এপিআই ভেরিফিকেশন সফল! "${pageName}" পেজের সাথে স্বয়ংক্রিয়ভাবে কানেক্ট হয়েছে।`;
        
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
    } finally {
      setIsVerifying(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    await executeVerification(pageId, accessToken, verifyToken);
  };

  const handleDisconnect = async () => {
    setIsVerifying(true);
    setDiagnosticsResult(null);
    try {
      await fetch("/api/social/disconnect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platform: activePlatform,
          tenantId: currentTenant?.id || "default",
        }),
      });

      setPageId("");
      setAccessToken("");
      setUserTokenInput("");
      setDiscoveredPages([]);

      onUpdateConfig({
        ...selectedConfig,
        pageId: "",
        accessToken: "",
        pageName: undefined,
        isConnected: false,
        verificationError: undefined,
        verifiedAt: undefined,
        lastSync: `Disconnected at ${new Date().toLocaleTimeString()}`,
      });
      setVerificationSuccess(`${selectedConfig.name} চ্যানেলটি ডিসকানেক্ট করা হয়েছে।`);
      setVerificationError(null);
      setTimeout(() => setVerificationSuccess(null), 4000);
    } catch (e) {
      console.error("Disconnect error:", e);
    } finally {
      setIsVerifying(false);
    }
  };

  const handleRunLiveDiagnostics = async () => {
    if (!selectedConfig.pageId || !selectedConfig.accessToken) {
      setDiagnosticsResult({
        status: "error",
        message: "কোনো Page ID বা Token পাওয়া যায়নি। অনুগ্রহ করে পেজ কানেক্ট করুন।",
      });
      return;
    }

    setIsVerifying(true);
    setDiagnosticsResult(null);

    try {
      const response = await fetch("/api/social/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platform: activePlatform,
          pageId: selectedConfig.pageId,
          accessToken: selectedConfig.accessToken,
          verifyToken: selectedConfig.verifyToken,
          tenantId: currentTenant?.id || "default",
          shopName: currentTenant?.shopName || "Our Store",
        }),
      });

      const data = await response.json();
      if (response.ok && data.success) {
        setDiagnosticsResult({
          status: "ok",
          message: `✅ লাইভ পিং সফল! মেটা এপিআই ও ফেসবুক পেজ (${data.page?.name || selectedConfig.pageName || selectedConfig.pageId}) সক্রিয়ভাবে সংযুক্ত রয়েছে। ক্লাউড ওয়েবহুক সাবস্ক্রিপশন চালু আছে।`,
        });
      } else {
        setDiagnosticsResult({
          status: "error",
          message: `❌ মেটা পিং ব্যর্থ: ${data.details || data.error || "টোকেনটি অবৈধ বা মেয়াদোত্তীর্ণ হতে পারে।"}`
        });
      }
    } catch (err: any) {
      setDiagnosticsResult({
        status: "error",
        message: `সার্ভার সংযোগ ত্রুটি: ${err.message || String(err)}`
      });
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
          {/* Active Connection & Live Diagnostics Status Card */}
          <div className={`mb-6 p-4 sm:p-5 rounded-2xl border transition-all ${
            selectedConfig.isConnected
              ? "bg-gradient-to-r from-emerald-50 via-teal-50/40 to-white border-emerald-300 shadow-sm"
              : "bg-white border-slate-200 shadow-xs"
          }`}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center space-x-3.5">
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center font-bold text-lg shrink-0 shadow-xs ${
                  selectedConfig.isConnected
                    ? "bg-emerald-600 text-white ring-4 ring-emerald-100"
                    : "bg-slate-100 text-slate-400"
                }`}>
                  {selectedConfig.isConnected ? <CheckCircle className="w-6 h-6" /> : <Building2 className="w-5 h-5" />}
                </div>

                <div>
                  <div className="flex items-center space-x-2">
                    <h4 className="text-sm sm:text-base font-extrabold text-slate-900">
                      {selectedConfig.isConnected ? (selectedConfig.pageName || selectedConfig.name) : "ফেসবুক পেজ সংযুক্ত নেই"}
                    </h4>
                    {selectedConfig.isConnected ? (
                      <span className="text-emerald-700 bg-emerald-100/80 border border-emerald-300 px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-wide flex items-center space-x-1">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping mr-1" />
                        🟢 LIVE CONNECTED
                      </span>
                    ) : (
                      <span className="text-slate-600 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full text-[11px] font-medium">
                        ⚪ Not Connected
                      </span>
                    )}
                  </div>

                  <div className="text-xs text-slate-600 mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                    {selectedConfig.isConnected ? (
                      <>
                        <span>পেজ আইডি: <strong className="font-mono text-slate-900 bg-white px-1.5 py-0.5 rounded border border-slate-200">{selectedConfig.pageId}</strong></span>
                        <span>•</span>
                        <span className="text-emerald-700 font-semibold">মেটা ওয়েবহুক ও মেসেজিং সক্রিয়</span>
                        {selectedConfig.verifiedAt && (
                          <>
                            <span>•</span>
                            <span className="text-slate-400">ভেরিফাইড: {new Date(selectedConfig.verifiedAt).toLocaleTimeString()}</span>
                          </>
                        )}
                      </>
                    ) : (
                      <span className="text-slate-500">নিচের "Continue with Facebook" বাটনে চাপ দিয়ে লগইন করলেই স্বয়ংক্রিয়ভাবে পেজ কানেক্ট হবে।</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Action Buttons for Connected Page */}
              {selectedConfig.isConnected ? (
                <div className="flex items-center space-x-2 shrink-0">
                  <button
                    type="button"
                    id="btn-run-diagnostics"
                    disabled={isVerifying}
                    onClick={handleRunLiveDiagnostics}
                    className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-semibold px-3 py-2 rounded-xl flex items-center space-x-1.5 shadow-xs transition-all cursor-pointer disabled:opacity-50"
                  >
                    {isVerifying ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5 text-amber-500" />}
                    <span>ডায়াগনস্টিক টেস্ট</span>
                  </button>
                  <button
                    type="button"
                    id="btn-disconnect-social-page"
                    disabled={isVerifying}
                    onClick={handleDisconnect}
                    className="bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 text-xs font-semibold px-3 py-2 rounded-xl flex items-center space-x-1.5 transition-all cursor-pointer disabled:opacity-50"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>ডিসকানেক্ট</span>
                  </button>
                </div>
              ) : null}
            </div>

            {/* Diagnostics result banner */}
            {diagnosticsResult && (
              <div className={`mt-3 p-3 rounded-lg text-xs font-medium ${
                diagnosticsResult.status === "ok"
                  ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                  : "bg-red-50 text-red-800 border border-red-200"
              }`}>
                {diagnosticsResult.message}
              </div>
            )}
          </div>

          {/* 1-Click Auto-Discovery Card for Facebook */}
          {activePlatform === "facebook" && (
            <div className="mb-6 p-4 sm:p-5 bg-gradient-to-br from-blue-50/90 to-indigo-50/60 border border-blue-200/80 rounded-xl shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                <div className="flex items-center space-x-2.5">
                  <div className="w-9 h-9 rounded-lg bg-[#1877F2] text-white flex items-center justify-center shadow-xs">
                    <Zap className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-[#0F172A] text-sm flex items-center space-x-2">
                      <span>১-ক্লিকে ফেসবুক পেজ কানেক্ট (Facebook 1-Click Connect)</span>
                      <span className="bg-[#1877F2]/10 text-[#1877F2] text-[10px] px-2 py-0.5 rounded-full font-semibold">Official SDK</span>
                    </h4>
                    <p className="text-[#64748B] text-[11px] mt-0.5">
                      বড় কোম্পানিদের মতো সরাসরি ফেসবুক লগইন পপ-আপের মাধ্যমে পেজ সিলেক্ট করুন অথবা ১-ক্লিকে পেজ লোড করুন।
                    </p>
                  </div>
                </div>

                {/* Direct 1-Click Facebook Popup Login Button */}
                <div className="flex flex-col items-end gap-1.5 shrink-0">
                  <button
                    type="button"
                    id="btn-fb-sdk-login"
                    disabled={isSdkLoggingIn}
                    onClick={handleFbSdkLogin}
                    className="bg-[#1877F2] hover:bg-[#166FE5] active:scale-[0.98] text-white text-xs font-bold px-4 py-2.5 rounded-xl flex items-center justify-center space-x-2 shadow-sm transition-all cursor-pointer disabled:opacity-50"
                  >
                    {isSdkLoggingIn ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                      </svg>
                    )}
                    <span>{isSdkLoggingIn ? "ফেসবুকে কানেক্ট হচ্ছে..." : "🔵 Continue with Facebook"}</span>
                  </button>
                  <span className="text-[10px] text-slate-500 font-medium">
                    লগইন শেষে পেজ স্বয়ংক্রিয়ভাবে কানেক্ট হবে
                  </span>
                </div>
              </div>

              {/* Meta Redirect URI Helper Bar for whitelisting */}
              <div className="p-2.5 bg-blue-50/70 border border-blue-200/80 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px]">
                <div className="text-slate-700">
                  <span className="font-semibold text-blue-900">মেটা অ্যাপ সেটিংস:</span> যদি "URL blocked" দেখায়, মেটা অ্যাপের <em>Client OAuth settings &gt; Valid OAuth Redirect URIs</em> বক্সে এই URL-টি যোগ করুন:
                </div>
                <div className="flex items-center space-x-1.5 shrink-0">
                  <code className="font-mono text-[10px] bg-white text-slate-800 px-2 py-1 rounded border border-blue-200 max-w-[240px] truncate">
                    {typeof window !== "undefined" ? `${window.location.origin}/oauth-callback.html` : "/oauth-callback.html"}
                  </code>
                  <button
                    type="button"
                    onClick={() => {
                      if (typeof window !== "undefined") {
                        navigator.clipboard.writeText(`${window.location.origin}/oauth-callback.html`);
                        setVerificationSuccess("OAuth Redirect URI ক্লিপবোর্ডে কপি করা হয়েছে!");
                      }
                    }}
                    className="bg-white hover:bg-blue-50 text-blue-700 border border-blue-300 font-semibold px-2 py-1 rounded text-[10px] flex items-center space-x-1 cursor-pointer transition-colors shadow-2xs"
                  >
                    <Copy className="w-3 h-3" />
                    <span>কপি</span>
                  </button>
                </div>
              </div>

              {/* Or Quick Graph API Token Option */}
              <div className="pt-2 border-t border-blue-200/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                <div className="text-slate-600 text-[11px]">
                  অথবা মেটা টোকেন থাকলে নিচে পেস্ট করে আপনার সব পেজ এক ক্লিকে লোড করুন:
                </div>
                <a
                  href="https://developers.facebook.com/tools/explorer/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#1877F2] hover:underline font-semibold text-[11px] flex items-center space-x-1 shrink-0"
                >
                  <span>🔗 মেটা থেকে টোকেন কপি করুন (Graph Explorer)</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>

              {/* Token input & Fetch button */}
              <div className="flex flex-col sm:flex-row gap-2 mt-2.5">
                <div className="relative flex-1">
                  <input
                    id="input-discovery-token"
                    type="password"
                    value={userTokenInput || accessToken}
                    onChange={(e) => {
                      setUserTokenInput(e.target.value);
                      setAccessToken(e.target.value);
                    }}
                    placeholder="মেটা টোকেন পেস্ট করুন (EAA...)..."
                    className="w-full bg-[#FFFFFF] border border-blue-200 rounded-lg pl-3 pr-8 py-2 text-[#0F172A] text-xs font-mono focus:outline-none focus:border-[#1877F2] shadow-xs"
                  />
                </div>
                <button
                  type="button"
                  id="btn-fetch-my-pages"
                  disabled={isFetchingPages}
                  onClick={() => handleFetchUserPages()}
                  className="bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold px-4 py-2 rounded-lg flex items-center justify-center space-x-2 shadow-xs transition-all cursor-pointer disabled:opacity-50 shrink-0"
                >
                  {isFetchingPages ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Building2 className="w-3.5 h-3.5" />}
                  <span>{isFetchingPages ? "পেজ খোঁজা হচ্ছে..." : "🔍 আমার সব পেজ লোড করুন"}</span>
                </button>
              </div>

              {/* Discovered Pages List */}
              {discoveredPages.length > 0 && (
                <div className="mt-4 space-y-2.5">
                  <div className="text-[11px] font-bold text-blue-900 flex items-center justify-between">
                    <span>আপনার অ্যাকাউন্টের পেজসমূহ ({discoveredPages.length}টি পাওয়া গেছে):</span>
                    <span className="text-slate-500 font-normal">যেকোনো একটি পেজ বেছে কানেক্ট বাটনে চাপুন</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {discoveredPages.map((p) => {
                      const isThisConnected = selectedConfig.isConnected && selectedConfig.pageId === p.id;
                      return (
                        <div
                          key={p.id}
                          className={`p-3 rounded-xl border transition-all flex items-center justify-between ${
                            isThisConnected
                              ? "bg-emerald-50/80 border-emerald-300 ring-1 ring-emerald-200 shadow-xs"
                              : "bg-[#FFFFFF] border-blue-100 hover:border-blue-300 shadow-xs"
                          }`}
                        >
                          <div className="flex items-center space-x-2.5 min-w-0 mr-2">
                            {p.pictureUrl ? (
                              <img src={p.pictureUrl} alt={p.name} className="w-8 h-8 rounded-full object-cover border border-slate-200 shrink-0" />
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-blue-100 text-[#1877F2] flex items-center justify-center font-bold text-xs shrink-0">
                                {p.name.charAt(0)}
                              </div>
                            )}
                            <div className="min-w-0">
                              <div className="font-bold text-[#0F172A] text-xs truncate">{p.name}</div>
                              <div className="text-[10px] text-slate-500 truncate">ID: {p.id} • {p.category}</div>
                            </div>
                          </div>

                          <button
                            type="button"
                            id={`btn-connect-page-${p.id}`}
                            disabled={isVerifying}
                            onClick={() => handleConnectDiscoveredPage(p)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-all cursor-pointer shrink-0 ${
                              isThisConnected
                                ? "bg-emerald-600 text-white shadow-xs hover:bg-emerald-700"
                                : "bg-[#1877F2] hover:bg-[#166FE5] text-white shadow-xs"
                            }`}
                          >
                            {isVerifying ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : isThisConnected ? (
                              <Check className="w-3 h-3" />
                            ) : (
                              <Zap className="w-3 h-3" />
                            )}
                            <span>{isThisConnected ? "সংযুক্ত আছে" : "⚡ কানেক্ট করুন"}</span>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="mb-4">
            <button
              type="button"
              onClick={() => setShowManualSetup(!showManualSetup)}
              className="text-xs font-semibold text-slate-600 hover:text-slate-900 flex items-center space-x-1.5 cursor-pointer py-1"
            >
              <span>{showManualSetup ? "ম্যানুয়াল ক্রেডেনশিয়াল সেটিংস লুকান" : "⚙️ ম্যানুয়াল ক্রেডেনশিয়াল ও Webhook URLs দেখুন"}</span>
              {showManualSetup ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>

          <form onSubmit={handleSave} className={`space-y-4 text-xs ${!showManualSetup && activePlatform === "facebook" ? "hidden" : "block"}`}>
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

          {/* Legal Business Footer for Meta Verification */}
          <div className="mt-6 pt-4 border-t border-[#E2E8F0] flex flex-col md:flex-row items-center justify-between text-[11px] text-[#64748B] gap-2">
            <div>
              Legal Entity: <span className="font-semibold text-[#1E293B]">MD. RIFAT HOSSAIN</span> (AI Shop Agent) • Dhawrah, Shailkupa, Jhenaidah - 7320
            </div>
            <div className="flex items-center space-x-3 text-blue-600 font-medium">
              <a href="/privacy-policy.html" target="_blank" rel="noopener noreferrer" className="hover:underline flex items-center space-x-1">
                <span>Privacy Policy</span>
                <ExternalLink className="w-3 h-3" />
              </a>
              <span>•</span>
              <a href="/terms-of-service.html" target="_blank" rel="noopener noreferrer" className="hover:underline flex items-center space-x-1">
                <span>Terms of Service</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
