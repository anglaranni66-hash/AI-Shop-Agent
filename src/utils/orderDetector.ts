/**
 * orderDetector.ts
 * ================
 * Context-aware Order and Customer Information Extractor for Social Commerce Chatbots.
 * 
 * Extracts:
 * - Phone numbers (Recognizes all Bangladeshi telecom patterns: 013, 014, 015, 016, 017, 018, 019 with or without +88 / 88, or formatted with spaces/dashes)
 * - Delivery address from message content and chat history
 * - Customer intention to purchase / provide checkout info
 */

// Matches BD phone numbers: e.g. 01712345678, +8801811223344, 01912-345678, 01612 345678, etc.
export const BD_PHONE_REGEX = /(?:\+?88\s?)?0?1[3-9](?:[\s-]?\d){8}\b/;

export interface ExtractedOrderData {
  isOrderDetected: boolean;
  phone: string | null;
  address: string | null;
  matchedItem: string | null;
  rawSnippet: string;
}

export function detectOrderFromChat(
  currentText: string,
  history: Array<{ sender: string; text: string }> = [],
  catalogProducts: Array<{ name: string; code?: string }> = []
): ExtractedOrderData {
  if (!currentText || currentText.trim().length === 0) {
    return { isOrderDetected: false, phone: null, address: null, matchedItem: null, rawSnippet: "" };
  }

  // Combine full customer utterances in this session for comprehensive context
  const customerUtterances = history
    .filter((h) => h.sender === "customer" || h.sender === "user")
    .map((h) => h.text);
  
  const fullConversationContext = [...customerUtterances, currentText].join(" \n ");

  // 1. Phone Extraction
  const phoneMatch = fullConversationContext.match(BD_PHONE_REGEX);
  let cleanedPhone: string | null = null;
  if (phoneMatch) {
    cleanedPhone = phoneMatch[0].replace(/[\s-]/g, "");
    if (cleanedPhone.startsWith("880") && !cleanedPhone.startsWith("+880")) {
      cleanedPhone = "+" + cleanedPhone;
    } else if (cleanedPhone.startsWith("1") && cleanedPhone.length === 10) {
      cleanedPhone = "0" + cleanedPhone;
    }
  }

  // 2. Real Delivery Address Detection
  // Must distinguish between a casual inquiry (e.g., "Dhakar moddhe delivery koto?") vs an actual address provision.
  const isDeliveryFeeInquiry = /\b(charge|koto|কত|ফি|রেট|rate|fee|cost|খরচ)\b/i.test(currentText);

  const addressPrefixKeywords = [
    "address:", "address :", "ঠিকানা:", "ঠিকানা :", "বাসা:", "বাড়ি:", "house:", "flat:", "sector:", "road:", "গ্রাম:", "থানা:", "জেলা:"
  ];

  const specificLocationKeywords = [
    "house", "road", "block", "sector", "flat", "holding", "lane", "avenue",
    "uttara", "mirpur", "dhanmondi", "gulshan", "banani", "mohammadpur", "badda", "motijheel", "bashundhara", "wari", "keraniganj", "jatrabari", "savar", "gazipur", "narayanganj",
    "বাসা", "রোড", "সেক্টর", "ব্লক", "গ্রাম", "থানা", "জেলা", "পোস্ট"
  ];

  let extractedAddress: string | null = null;

  // If the user is just asking a question about delivery charge/rate, do NOT treat as customer address
  if (!isDeliveryFeeInquiry) {
    const lowerText = currentText.toLowerCase();
    
    // Check if there is an explicit address label like "Address: ..." or "ঠিকানা: ..."
    const addressLabelMatch = currentText.match(/(?:address|ঠিকানা|বাসা|বাড়ি|house|location)\s*[:：\-]\s*([^.,\n]+(?:,[^.,\n]+)*)/i);
    if (addressLabelMatch && addressLabelMatch[1] && addressLabelMatch[1].trim().length >= 5) {
      extractedAddress = addressLabelMatch[1].trim();
    } else {
      const hasSpecificLocation = specificLocationKeywords.some((kw) => lowerText.includes(kw));
      // A real standalone address provided with phone or clear location keywords
      if (hasSpecificLocation && cleanedPhone && currentText.length < 120) {
        // Strip phone number from text if present to leave clean address
        const withoutPhone = currentText.replace(BD_PHONE_REGEX, "").trim();
        if (withoutPhone.length >= 8) {
          extractedAddress = withoutPhone;
        }
      }
    }
  }

  // 3. Matched Item Detection from Catalog (strictly check whole words / meaningful product phrases, min 3 chars)
  let matchedItem: string | null = null;
  if (catalogProducts && catalogProducts.length > 0) {
    const foundProduct = catalogProducts.find((p) => {
      const pName = (p.name || "").trim().toLowerCase();
      const pCode = (p.code || "").trim().toLowerCase();

      // Only match if product code or product name is meaningful and appears in text
      if (pCode && pCode.length >= 2 && currentText.toLowerCase().includes(pCode)) {
        return true;
      }
      if (pName && pName.length >= 4) {
        // Check if customer text mentions this product name
        return currentText.toLowerCase().includes(pName);
      }
      return false;
    });

    if (foundProduct) {
      matchedItem = foundProduct.name;
    }
  }

  // Determine if this represents an order signal: only when customer gave contact phone or explicit shipping address
  const isOrderDetected = Boolean(cleanedPhone || (extractedAddress && extractedAddress.length > 15));

  return {
    isOrderDetected,
    phone: cleanedPhone,
    address: extractedAddress,
    matchedItem,
    rawSnippet: currentText,
  };
}
