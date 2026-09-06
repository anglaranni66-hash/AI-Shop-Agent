import React, { useState } from "react";
import { TenantUser } from "../types";
import { Bot, ArrowRight, UserPlus, LogIn, Eye, EyeOff, CheckCircle, ShieldCheck } from "lucide-react";

interface Props {
  onLogin: (user: TenantUser) => void;
  tenants: TenantUser[];
  onRegister: (shopName: string, email: string, password: string) => Promise<TenantUser>;
}

export const AuthScreen: React.FC<Props> = ({ onLogin, tenants, onRegister }) => {
  const [mode, setMode] = useState<"login" | "register">("login");

  // Login form state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  // Registration form state
  const [shopName, setShopName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regConfirmPassword, setRegConfirmPassword] = useState("");
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanEmail = email.trim().toLowerCase();
    const cleanPassword = password.trim();

    if (!cleanEmail || !cleanPassword) {
      setError("Please enter both email and password.");
      return;
    }

    const found = tenants.find(
      (t) => t.email.toLowerCase() === cleanEmail
    );

    if (found) {
      if (found.password && found.password !== cleanPassword) {
        setError("Incorrect password. Please verify and try again.");
        return;
      }
      onLogin(found);
    } else {
      setError("No account found with this email. Please register a new account.");
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanShopName = shopName.trim();
    const cleanEmail = regEmail.trim().toLowerCase();
    const cleanPwd = regPassword.trim();
    const cleanConfirmPwd = regConfirmPassword.trim();

    if (!cleanShopName || !cleanEmail || !cleanPwd || !cleanConfirmPwd) {
      setError("Please fill in all the required fields.");
      return;
    }

    // Password validation: 6-10 characters length guideline
    if (cleanPwd.length < 6 || cleanPwd.length > 10) {
      setError("Password must be between 6 and 10 characters long.");
      return;
    }

    if (cleanPwd !== cleanConfirmPwd) {
      setError("The two passwords do not match. Please recheck and confirm.");
      return;
    }

    // Check if email already registered
    const existing = tenants.find((t) => t.email.toLowerCase() === cleanEmail);
    if (existing) {
      setError("An account with this email already exists. Please login instead.");
      return;
    }

    try {
      setLoading(true);
      const newTenant = await onRegister(cleanShopName, cleanEmail, cleanPwd);
      onLogin(newTenant);
    } catch (err: any) {
      setError(err?.message || "Failed to create account. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div id="auth-screen" className="w-full flex-1 flex flex-col items-center justify-start sm:justify-center p-4 sm:p-6 bg-[#F1F5F9] text-[#0F172A] overflow-y-auto custom-scrollbar min-h-0 pb-16 my-auto">
      <div className="w-full max-w-md bg-[#FFFFFF] border border-[#CBD5E1] rounded-2xl p-7 shadow-lg">
        {/* Branding & Header */}
        <div className="text-center mb-5">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-white border border-[#CBD5E1] p-1.5 mb-2.5 shadow-sm overflow-hidden">
            <img src="/logo.jpg" alt="Business Logo" className="w-full h-full object-contain rounded-xl" referrerPolicy="no-referrer" />
          </div>
          <h1 className="text-xl font-bold text-[#0F172A] tracking-tight">AI Shop Agent Suite</h1>
          <p className="text-xs text-[#64748B] mt-1 font-medium">
            Official E-Commerce Platform • Operated by <strong className="text-[#334155]">MD. RIFAT HOSSAIN</strong>
          </p>
        </div>

        {/* Mode Switcher */}
        <div className="flex bg-[#F8FAFC] p-1 rounded-xl border border-[#E2E8F0] mb-5">
          <button
            id="auth-mode-login"
            type="button"
            onClick={() => {
              setMode("login");
              setError(null);
            }}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg flex items-center justify-center space-x-1.5 transition-all cursor-pointer ${
              mode === "login"
                ? "bg-[#FFFFFF] text-blue-700 border border-[#CBD5E1] shadow-xs"
                : "text-[#64748B] hover:text-[#0F172A]"
            }`}
          >
            <LogIn className="w-3.5 h-3.5" />
            <span>Login to Account</span>
          </button>
          <button
            id="auth-mode-register"
            type="button"
            onClick={() => {
              setMode("register");
              setError(null);
            }}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg flex items-center justify-center space-x-1.5 transition-all cursor-pointer ${
              mode === "register"
                ? "bg-[#FFFFFF] text-blue-700 border border-[#CBD5E1] shadow-xs"
                : "text-[#64748B] hover:text-[#0F172A]"
            }`}
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Create New Account</span>
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs font-medium space-y-1.5">
            <div>{error}</div>
            {error.includes("already exists") && (
              <button
                type="button"
                onClick={() => {
                  localStorage.removeItem("shop_agent_tenants");
                  localStorage.removeItem("shop_agent_current_tenant");
                  window.location.reload();
                }}
                className="text-[11px] underline text-red-800 hover:text-red-950 font-semibold cursor-pointer block"
              >
                ডিলিট করা অ্যাকাউন্টের মেমরি রিসেট করতে এখানে ক্লিক করুন (Reset Local Cache)
              </button>
            )}
          </div>
        )}

        {/* Login Form */}
        {mode === "login" ? (
          <form onSubmit={handleLoginSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[#334155] mb-1.5">
                Username / Email Address
              </label>
              <input
                id="input-login-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="yourname@gmail.com"
                className="w-full bg-[#FFFFFF] border border-[#CBD5E1] rounded-lg px-3 py-2 text-sm text-[#0F172A] placeholder-[#94A3B8] focus:outline-none focus:border-blue-600 transition-colors shadow-xs"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-[#334155]">Password</label>
                <button
                  type="button"
                  onClick={() => setShowLoginPassword(!showLoginPassword)}
                  className="text-[11px] text-[#64748B] hover:text-blue-600 flex items-center space-x-1 cursor-pointer"
                >
                  {showLoginPassword ? (
                    <>
                      <EyeOff className="w-3 h-3" />
                      <span>Hide</span>
                    </>
                  ) : (
                    <>
                      <Eye className="w-3 h-3" />
                      <span>Show</span>
                    </>
                  )}
                </button>
              </div>
              <input
                id="input-login-password"
                type={showLoginPassword ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                className="w-full bg-[#FFFFFF] border border-[#CBD5E1] rounded-lg px-3 py-2 text-sm text-[#0F172A] placeholder-[#94A3B8] focus:outline-none focus:border-blue-600 transition-colors shadow-xs"
              />
            </div>

            <button
              id="btn-login-submit"
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-lg text-xs tracking-wide shadow-xs transition-all flex items-center justify-center space-x-2 mt-2 cursor-pointer disabled:opacity-60"
            >
              <span>Login to Store</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </form>
        ) : (
          /* Registration Form */
          <form onSubmit={handleRegisterSubmit} className="space-y-3.5">
            <div>
              <label className="block text-xs font-semibold text-[#334155] mb-1">
                Shop / Store Name
              </label>
              <input
                id="input-reg-shopname"
                type="text"
                required
                value={shopName}
                onChange={(e) => setShopName(e.target.value)}
                placeholder="e.g. My Shop / Brand Name"
                className="w-full bg-[#FFFFFF] border border-[#CBD5E1] rounded-lg px-3 py-2 text-sm text-[#0F172A] placeholder-[#94A3B8] focus:outline-none focus:border-blue-600 transition-colors shadow-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#334155] mb-1">
                Email Address (This will be your Username)
              </label>
              <input
                id="input-reg-email"
                type="email"
                required
                value={regEmail}
                onChange={(e) => setRegEmail(e.target.value)}
                placeholder="owner@yourmail.com"
                className="w-full bg-[#FFFFFF] border border-[#CBD5E1] rounded-lg px-3 py-2 text-sm text-[#0F172A] placeholder-[#94A3B8] focus:outline-none focus:border-blue-600 transition-colors shadow-xs"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-[#334155]">
                  Password (৬ থেকে ১০ অক্ষরের মধ্যে দিন)
                </label>
                <button
                  type="button"
                  onClick={() => setShowRegPassword(!showRegPassword)}
                  className="text-[11px] text-[#64748B] hover:text-blue-600 flex items-center space-x-1 cursor-pointer"
                >
                  {showRegPassword ? (
                    <>
                      <EyeOff className="w-3 h-3" />
                      <span>Hide</span>
                    </>
                  ) : (
                    <>
                      <Eye className="w-3 h-3" />
                      <span>Show</span>
                    </>
                  )}
                </button>
              </div>
              <input
                id="input-reg-pwd"
                type={showRegPassword ? "text" : "password"}
                required
                minLength={6}
                maxLength={10}
                value={regPassword}
                onChange={(e) => setRegPassword(e.target.value)}
                placeholder="৬ - ১০ ক্যারেক্টার পাসওয়ার্ড"
                className="w-full bg-[#FFFFFF] border border-[#CBD5E1] rounded-lg px-3 py-2 text-sm text-[#0F172A] placeholder-[#94A3B8] focus:outline-none focus:border-blue-600 transition-colors shadow-xs"
              />
              <p className="text-[10px] text-[#64748B] mt-0.5">
                • পাসওয়ার্ড অবশ্যই ৬ থেকে ১০ ক্যারেক্টার বা অক্ষরের হতে হবে।
              </p>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-[#334155]">
                  Confirm Password (একই পাসওয়ার্ড পুনরায় দিন)
                </label>
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="text-[11px] text-[#64748B] hover:text-blue-600 flex items-center space-x-1 cursor-pointer"
                >
                  {showConfirmPassword ? (
                    <>
                      <EyeOff className="w-3 h-3" />
                      <span>Hide</span>
                    </>
                  ) : (
                    <>
                      <Eye className="w-3 h-3" />
                      <span>Show</span>
                    </>
                  )}
                </button>
              </div>
              <input
                id="input-reg-confirm-pwd"
                type={showConfirmPassword ? "text" : "password"}
                required
                minLength={6}
                maxLength={10}
                value={regConfirmPassword}
                onChange={(e) => setRegConfirmPassword(e.target.value)}
                placeholder="পুনরায় পাসওয়ার্ড লিখুন"
                className="w-full bg-[#FFFFFF] border border-[#CBD5E1] rounded-lg px-3 py-2 text-sm text-[#0F172A] placeholder-[#94A3B8] focus:outline-none focus:border-blue-600 transition-colors shadow-xs"
              />
              {regPassword && regConfirmPassword && (
                <div className="mt-1 flex items-center space-x-1 text-[11px]">
                  {regPassword === regConfirmPassword ? (
                    <span className="text-emerald-600 font-medium flex items-center space-x-1">
                      <CheckCircle className="w-3 h-3" />
                      <span>Password matched</span>
                    </span>
                  ) : (
                    <span className="text-red-500 font-medium">
                      Passwords do not match
                    </span>
                  )}
                </div>
              )}
            </div>

            <button
              id="btn-register-submit"
              type="submit"
              disabled={loading}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2.5 rounded-lg text-xs tracking-wide shadow-xs transition-all flex items-center justify-center space-x-2 mt-3 cursor-pointer disabled:opacity-60"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>{loading ? "Creating Account..." : "Create Account"}</span>
            </button>
          </form>
        )}

        {/* Legal Business Footer for Meta Compliance */}
        <div className="mt-6 pt-4 border-t border-[#E2E8F0] text-center text-[11px] text-[#64748B] space-y-1.5">
          <p className="font-semibold text-[#1E293B]">
            Legal Entity: <strong>MD. RIFAT HOSSAIN</strong> (Brand: AI Shop Agent)
          </p>
          <p className="text-[10px] text-[#64748B]">
            Address: Dhawrah, Shailkupa, Jhenaidah, Khulna - 7320, Bangladesh
          </p>
          <p className="text-[10px] text-[#64748B]">
            Official Email: <a href="mailto:fefsdgxdfbx@gmail.com" className="text-blue-600 font-medium hover:underline">fefsdgxdfbx@gmail.com</a> • Phone: <a href="tel:+8801761576600" className="text-blue-600 font-medium hover:underline">01761576600</a>
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-2.5 gap-y-1 pt-1 text-[11px] text-blue-600 font-medium">
            <a href="/about-us.html" target="_blank" rel="noopener noreferrer" className="hover:underline">
              About Us
            </a>
            <span>•</span>
            <a href="/contact.html" target="_blank" rel="noopener noreferrer" className="hover:underline">
              Contact
            </a>
            <span>•</span>
            <a href="/privacy-policy.html" target="_blank" rel="noopener noreferrer" className="hover:underline">
              Privacy Policy
            </a>
            <span>•</span>
            <a href="/terms-of-service.html" target="_blank" rel="noopener noreferrer" className="hover:underline">
              Terms of Service
            </a>
            <span>•</span>
            <a href="/data-deletion.html" target="_blank" rel="noopener noreferrer" className="hover:underline">
              Data Deletion
            </a>
          </div>
          <p className="text-[10px] text-[#94A3B8] pt-1">
            © 2026 MD. RIFAT HOSSAIN. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
};
