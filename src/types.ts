export interface TenantUser {
  id: string;
  shopName: string;
  email: string;
  password?: string;
  businessCategory?: string;
  createdAt: string;
}

export interface Product {
  id: string;
  name: string;
  price: number;
  category: string;
  stock: number;
  description: string;
  imageUrl?: string;
  attributes: Record<string, any>;
  createdAt: string;
}

export interface SocialConfig {
  platform: "facebook" | "instagram" | "whatsapp" | "tiktok";
  name: string;
  icon: string;
  color: string;
  isConnected: boolean;
  webhookUrl: string;
  verifyToken: string;
  pageId: string;
  accessToken: string;
  appSecret?: string;
  lastSync?: string;
  pageName?: string;
  verificationError?: string;
  verifiedAt?: string;
}

export interface ChatMessage {
  id: string;
  sender: "customer" | "ai" | "system";
  customerName?: string;
  platform: string;
  text: string;
  imageUrl?: string;
  timestamp: string;
  latencyMs?: number;
  retrievedProducts?: Product[];
  suggestedProducts?: Array<{
    id: string;
    code: string;
    name: string;
    price: number;
    imageUrl?: string;
    category?: string;
    attributes?: Record<string, any>;
  }>;
  guardrailApplied?: boolean;
}

export interface WebhookLog {
  id: string;
  platform: "facebook" | "instagram" | "whatsapp" | "tiktok";
  customerName: string;
  customerPhone?: string;
  incomingText: string;
  imageUrl?: string;
  aiReply: string;
  replyImageUrl?: string;
  responderType?: "ai" | "human_agent";
  responderName?: string;
  latencyMs: number;
  timestamp: string;
  createdAt?: string;
  isDemo?: boolean;
  expiresAt?: number;
}

export interface VectorSearchResult {
  product: Product;
  similarityScore: number;
  matchedTokens: string[];
}

export interface NotificationItem {
  id: string;
  category: "order" | "abuse" | "system";
  title: string;
  customerName?: string;
  platform?: string;
  phone?: string;
  address?: string;
  messageSnippet?: string;
  details?: Record<string, any>;
  isRead: boolean;
  createdAt: string;
}

export interface CustomerThread {
  id: string;
  customerId: string;
  customerName: string;
  platform: string;
  phone?: string;
  address?: string;
  summary?: string;
  lastMessageSnippet?: string;
  lastMessageAt?: string;
  totalMessages: number;
  messages?: ChatMessage[];
  createdAt: string;
  updatedAt?: string;
}
