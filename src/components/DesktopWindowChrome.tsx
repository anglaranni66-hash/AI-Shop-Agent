import React, { useState, useRef, useEffect } from "react";
import { TenantUser, NotificationItem } from "../types";
import {
  Bot,
  Package,
  Share2,
  Database,
  Activity,
  Store,
  ArrowRightLeft,
  ChevronDown,
  Mail,
  Calendar,
  ShieldCheck,
  Building2,
  X,
} from "lucide-react";
import { NotificationCenter } from "./NotificationCenter";

interface Props {
  currentTenant: TenantUser | null;
  onLogout: () => void;
  activeTab: string;
  onTabChange: (tab: string) => void;
  onOpenCodeHub: () => void;
  notifications?: NotificationItem[];
  onToggleRead?: (id: string) => void;
  onMarkTabRead?: (category: "all" | "order" | "abuse" | "system") => void;
  onClearTab?: (category: "all" | "order" | "abuse" | "system") => void;
  onDeleteNotification?: (id: string) => void;
  onAddNotification?: (
    item: Omit<NotificationItem, "id" | "isRead" | "createdAt"> & {
      id?: string;
      isRead?: boolean;
      createdAt?: string;
    }
  ) => void;
}

export const DesktopWindowChrome: React.FC<Props> = ({
  currentTenant,
  onLogout,
  activeTab,
  onTabChange,
  onOpenCodeHub,
  notifications,
  onToggleRead,
  onMarkTabRead,
  onClearTab,
  onDeleteNotification,
  onAddNotification,
}) => {
  const [showStoreDetails, setShowStoreDetails] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowStoreDetails(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const tabs = [
    { id: "social", label: "Social Integrations", icon: Share2 },
    { id: "products", label: "Product Catalog", icon: Package },
    { id: "simulator", label: "AI Sales Simulator", icon: Bot },
    { id: "vector", label: "Vector Search", icon: Database },
    { id: "logs", label: "Activity & Webhooks", icon: Activity },
  ];

  return (
    <header id="desktop-window-chrome" className="bg-[#FFFFFF] border-b border-[#E2E8F0] text-[#0F172A] select-none shrink-0 z-30 shadow-xs">
      {/* Top Windows Title Bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-[#F8FAFC] border-b border-[#E2E8F0] text-xs">
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2.5 text-[#0F172A] font-bold tracking-tight text-xs">
            <div className="w-7 h-7 rounded-lg bg-white border border-[#CBD5E1] p-0.5 flex items-center justify-center shadow-xs overflow-hidden shrink-0">
              <img src="/logo.jpg" alt="Business Logo" className="w-full h-full object-contain rounded-md" referrerPolicy="no-referrer" />
            </div>
            <span>AI Shop Agent Suite</span>
          </div>
        </div>

        <div className="flex items-center space-x-2.5">
          {/* Shop Name Button & Details Popover Card */}
          {currentTenant && (
            <div className="relative" ref={dropdownRef}>
              <button
                type="button"
                id="btn-shop-details-toggle"
                onClick={() => setShowStoreDetails(!showStoreDetails)}
                className="flex items-center space-x-2 bg-white hover:bg-[#F1F5F9] border border-[#CBD5E1] text-[#0F172A] px-2.5 py-1 rounded-md text-xs font-semibold shadow-xs transition-all cursor-pointer"
              >
                <Store className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                <span className="max-w-[140px] truncate">{currentTenant.shopName}</span>
                <ChevronDown className={`w-3 h-3 text-[#64748B] transition-transform duration-200 ${showStoreDetails ? "rotate-180" : ""}`} />
              </button>

              {/* Store Details Popover Card */}
              {showStoreDetails && (
                <div className="absolute right-0 mt-2 w-72 bg-white border border-[#CBD5E1] rounded-xl shadow-xl z-50 p-4 text-xs animate-in fade-in slide-in-from-top-2 duration-150">
                  <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F0] mb-3">
                    <div className="flex items-center space-x-2">
                      <div className="p-1.5 bg-blue-50 border border-blue-200 rounded-lg text-blue-600">
                        <Store className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="font-bold text-[#0F172A] text-sm leading-tight">{currentTenant.shopName}</h4>
                        <span className="inline-flex items-center space-x-1 text-[10px] text-emerald-600 font-medium bg-emerald-50 px-1.5 py-0.5 rounded mt-0.5">
                          <ShieldCheck className="w-2.5 h-2.5" />
                          <span>Active Store Account</span>
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowStoreDetails(false)}
                      className="text-[#94A3B8] hover:text-[#0F172A] p-1 rounded-md hover:bg-[#F1F5F9] cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="space-y-2.5 text-[#334155]">
                    <div className="flex items-start space-x-2.5 p-2 bg-[#F8FAFC] rounded-lg border border-[#F1F5F9]">
                      <Mail className="w-3.5 h-3.5 text-blue-600 shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <div className="text-[10px] font-medium text-[#64748B]">Account Email</div>
                        <div className="font-semibold text-[#0F172A] truncate" title={currentTenant.email}>
                          {currentTenant.email}
                        </div>
                      </div>
                    </div>

                    {currentTenant.businessCategory && (
                      <div className="flex items-start space-x-2.5 p-2 bg-[#F8FAFC] rounded-lg border border-[#F1F5F9]">
                        <Building2 className="w-3.5 h-3.5 text-purple-600 shrink-0 mt-0.5" />
                        <div>
                          <div className="text-[10px] font-medium text-[#64748B]">Business Category</div>
                          <div className="font-semibold text-[#0F172A]">{currentTenant.businessCategory}</div>
                        </div>
                      </div>
                    )}

                    <div className="flex items-start space-x-2.5 p-2 bg-[#F8FAFC] rounded-lg border border-[#F1F5F9]">
                      <Calendar className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                      <div>
                        <div className="text-[10px] font-medium text-[#64748B]">Account Created</div>
                        <div className="font-semibold text-[#0F172A]">
                          {new Date(currentTenant.createdAt).toLocaleDateString("en-US", {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          })}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-3.5 pt-2.5 border-t border-[#E2E8F0] flex items-center justify-between">
                    <span className="text-[10px] text-[#94A3B8]">ID: {currentTenant.id.substring(0, 8)}...</span>
                    <button
                      type="button"
                      onClick={() => {
                        setShowStoreDetails(false);
                        onLogout();
                      }}
                      className="flex items-center space-x-1 text-red-600 hover:text-red-700 font-semibold text-[11px] px-2 py-1 hover:bg-red-50 rounded-md transition-colors cursor-pointer"
                    >
                      <ArrowRightLeft className="w-3 h-3" />
                      <span>Switch Store</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Notification Center Bell with live Red Badge */}
          {currentTenant && (
            <NotificationCenter
              currentTenant={currentTenant}
              notifications={notifications}
              onToggleRead={onToggleRead}
              onMarkTabRead={onMarkTabRead}
              onClearTab={onClearTab}
              onDeleteItem={onDeleteNotification}
              onAddNotification={onAddNotification}
            />
          )}
        </div>
      </div>

      {/* Main App Navigation Ribbon */}
      {currentTenant && (
        <nav className="flex items-center justify-between px-4 py-2 bg-[#FFFFFF] text-xs gap-3">
          <div className="flex items-center space-x-1.5 overflow-x-auto custom-scrollbar whitespace-nowrap py-0.5">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  id={`tab-btn-${tab.id}`}
                  onClick={() => onTabChange(tab.id)}
                  className={`px-3.5 py-1.5 rounded-lg font-semibold text-xs flex items-center space-x-2 transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                    isActive
                      ? "bg-blue-50 text-blue-700 border border-blue-200 shadow-xs"
                      : "text-[#475569] hover:text-[#0F172A] hover:bg-[#F8FAFC]"
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${isActive ? "text-blue-600" : "text-[#64748B]"}`} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          <div className="flex items-center space-x-2 text-xs shrink-0">
            <button
              id="btn-logout-switch"
              onClick={onLogout}
              className="flex items-center space-x-1.5 text-[#475569] hover:text-[#0F172A] bg-[#F8FAFC] hover:bg-[#F1F5F9] border border-[#CBD5E1] px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all cursor-pointer shadow-xs whitespace-nowrap"
            >
              <ArrowRightLeft className="w-3 h-3 text-blue-600" />
              <span>Switch Store</span>
            </button>
          </div>
        </nav>
      )}
    </header>
  );
};
