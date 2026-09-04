import { db, doc, setDoc, getDoc, collection, getDocs, deleteDoc } from "../lib/firebase";
import { CustomerThread, ChatMessage } from "../types";

// In-memory per-thread sequential mutex queue to guarantee atomic message processing under high concurrency
const threadQueues = new Map<string, Promise<any>>();

export function queueThreadOperation<T>(threadKey: string, op: () => Promise<T>): Promise<T> {
  const currentPromise = threadQueues.get(threadKey) || Promise.resolve();
  const nextPromise = currentPromise.then(
    () => op(),
    () => op()
  );
  threadQueues.set(threadKey, nextPromise);
  return nextPromise;
}

/**
 * Sanitizes thread ID for Firebase keys (e.g. "wa_8801711223344" or "fb_nusrat_jahan")
 */
export function getThreadId(platform: string, customerIdOrName: string): string {
  const cleanPlatform = (platform || "web").toLowerCase().replace(/[^a-z0-9]/g, "");
  const cleanId = (customerIdOrName || "customer").toLowerCase().replace(/[^a-z0-9]/g, "_").slice(0, 40);
  return `thread_${cleanPlatform}_${cleanId}`;
}

/**
 * Calculates human-readable elapsed time string (e.g. "3 days ago", "Yesterday", "2 hours ago")
 */
export function formatElapsedTime(isoString?: string): string {
  if (!isoString) return "First contact";
  const past = new Date(isoString).getTime();
  const now = Date.now();
  const diffMs = now - past;
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays > 1) return `${diffDays} days ago`;
  if (diffDays === 1) return "Yesterday";
  if (diffHours >= 1) return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
  const diffMins = Math.floor(diffMs / (1000 * 60));
  if (diffMins >= 1) return `${diffMins} min${diffMins > 1 ? "s" : ""} ago`;
  return "Just now";
}

/**
 * Extracts comprehensive key facts from dropped customer messages
 * (Colors, sizes, locations, product types, budgets, intents, phones, notes).
 */
export function extractFactsFromDroppedMessage(
  msg: ChatMessage,
  existingSummary: string
): string[] {
  if (msg.sender !== "customer" || !msg.text || msg.text.trim().length === 0) {
    return [];
  }

  const rawText = msg.text.trim();
  const lowerText = rawText.toLowerCase();
  const extractedFacts: string[] = [];

  // 1. Color Extraction
  const colorMap: Array<{ pattern: RegExp; label: string }> = [
    { pattern: /\b(কালো|black)\b/i, label: "কালো (Black)" },
    { pattern: /\b(সাদা|white)\b/i, label: "সাদা (White)" },
    { pattern: /\b(লাল|red)\b/i, label: "লাল (Red)" },
    { pattern: /\b(নীল|blue|navy)\b/i, label: "নীল/Navy" },
    { pattern: /\b(সবুজ|green|olive)\b/i, label: "সবুজ/Olive" },
    { pattern: /\b(হলুদ|yellow)\b/i, label: "হলুদ (Yellow)" },
    { pattern: /\b(মেরুন|maroon|খয়েরি)\b/i, label: "মেরুন (Maroon)" },
    { pattern: /\b(গোলাপি|pink)\b/i, label: "গোলাপি (Pink)" },
    { pattern: /\b(বেগুনি|purple)\b/i, label: "বেগুনি (Purple)" },
    { pattern: /\b(সোনালী|gold|golden)\b/i, label: "সোনালী (Gold)" },
    { pattern: /\b(ছাই|grey|gray)\b/i, label: "ছাই (Grey)" },
    { pattern: /\b(কমলা|orange)\b/i, label: "কমলা (Orange)" },
    { pattern: /\b(অফহোয়াইট|off-white|offwhite|beige)\b/i, label: "Off-White" },
  ];
  const detectedColors: string[] = [];
  colorMap.forEach(({ pattern, label }) => {
    if (pattern.test(lowerText)) detectedColors.push(label);
  });
  if (detectedColors.length > 0) {
    extractedFacts.push(`পছন্দের কালার: ${Array.from(new Set(detectedColors)).join(", ")}`);
  }

  // 2. Size Extraction
  const sizeRegex = /\b(xs|s|m|l|xl|xxl|2xl|3xl|4xl|free\s*size|36|38|40|42|44|46|48|50|২৮|৩০|৩২|৩৪|৩৬|৩৮|৪০|৪২|৪৪|৪৬)\b/gi;
  const sizeMatches = lowerText.match(sizeRegex);
  if (sizeMatches && sizeMatches.length > 0) {
    const cleanSizes = Array.from(new Set(sizeMatches.map((s) => s.toUpperCase())));
    extractedFacts.push(`পছন্দের সাইজ: ${cleanSizes.join(", ")}`);
  }

  // 3. Location Extraction
  const locationList = [
    "ঢাকা", "চট্টগ্রাম", "সিলেট", "রাজশাহী", "খুলনা", "বরিশাল", "রংপুর", "ময়মনসিংহ",
    "কুমিল্লা", "বগুড়া", "নোয়াখালী", "নারায়ণগঞ্জ", "গাজীপুর", "সাভার", "কক্সবাজার",
    "যশোর", "পাবনা", "টাঙ্গাইল", "উত্তরা", "মিরপুর", "ধানমন্ডি", "গুলশান", "বনানী",
    "মোহাম্মদপুর", "বাড্ডা", "বসুন্ধরা", "মতিঝিল", "যাত্রাবাড়ী", "খিলগাঁও", "রামপুরা",
    "dhaka", "chittagong", "sylhet", "rajshahi", "khulna", "barisal", "rangpur",
    "mymensingh", "comilla", "bogra", "gazipur", "savar", "uttara", "mirpur",
    "dhanmondi", "gulshan", "banani", "mohammadpur", "basundhara", "badda"
  ];
  const detectedLocations = locationList.filter((loc) => lowerText.includes(loc));
  if (detectedLocations.length > 0) {
    extractedFacts.push(`লোকেশন: ${Array.from(new Set(detectedLocations)).join(", ")}`);
  }

  // 4. Products & Categories
  const productTypes: Array<{ pattern: RegExp; name: string }> = [
    { pattern: /(পাঞ্জাবি|panjabi|punjabi)/i, name: "পাঞ্জাবি" },
    { pattern: /(শাড়ি|saree|shari)/i, name: "শাড়ি" },
    { pattern: /(শার্ট|shirt)/i, name: "শার্ট" },
    { pattern: /(টি-শার্ট|t-shirt|tshirt)/i, name: "টি-শার্ট" },
    { pattern: /(প্যান্ট|pant|trouser|jeans)/i, name: "প্যান্ট" },
    { pattern: /(কুর্তি|kurti|থ্রিপিস|three\s*piece)/i, name: "কুর্তি/থ্রিপিস" },
    { pattern: /(বোরকা|burqa|hijab|হিজাব)/i, name: "বোরকা/হিজাব" },
    { pattern: /(জুতা|shoe|loafer)/i, name: "জুতা/Loafer" },
    { pattern: /(ঘড়ি|watch)/i, name: "ঘড়ি" },
    { pattern: /(পারফিউম|perfume|attar|আতর)/i, name: "পারফিউম/আতর" },
  ];
  const foundProducts: string[] = [];
  productTypes.forEach(({ pattern, name }) => {
    if (pattern.test(lowerText)) foundProducts.push(name);
  });
  if (foundProducts.length > 0) {
    extractedFacts.push(`আগ্রহের পণ্য: ${Array.from(new Set(foundProducts)).join(", ")}`);
  }

  // 5. Inquiries, Budget & Preferences
  if (/(দাম|price|cost|koto|কত)/i.test(lowerText)) {
    extractedFacts.push("দামের তথ্য জেনেছেন");
  }
  if (/(delivery|ডেলিভারি|charge|চার্জ)/i.test(lowerText)) {
    extractedFacts.push("ডেলিভারি নিয়ম জানতে চেয়েছেন");
  }
  if (/(ক্যাশ\s*অন|cod|cash\s*on)/i.test(lowerText)) {
    extractedFacts.push("ক্যাশ অন ডেলিভারি আগ্রহ");
  }
  if (/(ডিসকাউন্ট|discount|অফার|offer)/i.test(lowerText)) {
    extractedFacts.push("ডিসকাউন্ট/অফার অনুসন্ধান");
  }

  // 6. Phone number in message
  const phoneMatch = rawText.match(/(?:(?:\+|00)88|01)?01[3-9]\d{8}/);
  if (phoneMatch) {
    extractedFacts.push(`Phone: ${phoneMatch[0]}`);
  }

  // 7. General custom requirement if not matched standard keyword
  if (extractedFacts.length === 0 && rawText.length >= 6 && !/^(hi|hello|hey|assalamu|salam|ok|thik|haa|na)\b/i.test(lowerText)) {
    let cleanSnippet = rawText.replace(/[\n]+/g, " ").trim();
    if (cleanSnippet.length > 80) cleanSnippet = cleanSnippet.slice(0, 80) + "...";
    if (cleanSnippet) {
      extractedFacts.push(`নোট: "${cleanSnippet}"`);
    }
  }

  return extractedFacts;
}

/**
 * Merges extracted facts into existing summary without duplicates
 */
export function mergeFactsIntoSummary(
  existingSummary: string,
  newFacts: string[]
): string {
  let summary = existingSummary || "";
  if (!newFacts || newFacts.length === 0) return summary;

  const validNew = newFacts.filter((fact) => {
    const trimmed = fact.trim();
    return trimmed.length > 0 && !summary.includes(trimmed);
  });

  if (validNew.length > 0) {
    summary = summary ? `${summary} | ${validNew.join(" | ")}` : validNew.join(" | ");
  }

  return summary;
}

/**
 * Fast synchronous and comprehensive dropped-message summarizer
 */
export function summarizeDroppedMessagesSync(
  existingSummary: string,
  droppedMessages: ChatMessage[],
  extractedData?: { phone?: string; address?: string; item?: string }
): string {
  let summary = existingSummary || "";

  droppedMessages.forEach((msg) => {
    const facts = extractFactsFromDroppedMessage(msg, summary);
    summary = mergeFactsIntoSummary(summary, facts);
  });

  if (extractedData?.phone && extractedData.phone.trim().length >= 8) {
    summary = mergeFactsIntoSummary(summary, [`Phone: ${extractedData.phone.trim()}`]);
  }
  if (extractedData?.address && extractedData.address.trim().length >= 6) {
    summary = mergeFactsIntoSummary(summary, [`ঠিকানা: ${extractedData.address.trim()}`]);
  }
  if (extractedData?.item && extractedData.item.trim().length >= 3) {
    summary = mergeFactsIntoSummary(summary, [`পণ্য: ${extractedData.item.trim()}`]);
  }

  return summary;
}

export async function summarizeDroppedMessagesAsync(
  existingSummary: string,
  droppedMessages: ChatMessage[],
  extractedData?: { phone?: string; address?: string; item?: string }
): Promise<string> {
  let summary = existingSummary || "";

  // 1. Try server-side AI summarizer first
  try {
    const res = await fetch("/api/gemini/summarize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        existingSummary: summary,
        droppedMessages: droppedMessages.map((m) => ({ sender: m.sender, text: m.text })),
      }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.summary && data.summary.trim().length > 0) {
        return data.summary.trim();
      }
    }
  } catch (err) {
    console.debug("[Summarizer] API summary fallback to rule extractor:", err);
  }

  // 2. Fallback to rule-based sync extractor if AI fails
  return summarizeDroppedMessagesSync(summary, droppedMessages, extractedData);
}

/**
 * Retrieves a customer's persistent conversation thread and memory from Firestore.
 */
export async function getCustomerThread(
  userId: string,
  platform: string,
  customerIdentifier: string
): Promise<CustomerThread | null> {
  if (!userId) return null;
  const threadId = getThreadId(platform, customerIdentifier);

  try {
    const threadRef = doc(db, "users", userId, "customer_threads", threadId);
    const snap = await getDoc(threadRef);
    if (snap.exists()) {
      const data = snap.data();
      const totalMessages = Number(data.totalMessages) || 0;
      let rawSummary = data.summary || "";

      return {
        id: snap.id,
        customerId: data.customerId || customerIdentifier,
        customerName: data.customerName || customerIdentifier,
        platform: data.platform || platform,
        phone: data.phone || "",
        address: data.address || "",
        summary: rawSummary,
        lastMessageSnippet: data.lastMessageSnippet || "",
        lastMessageAt: data.lastMessageAt || data.updatedAt || "",
        totalMessages,
        messages: Array.isArray(data.messages) ? data.messages : [],
        createdAt: data.createdAt || new Date().toISOString(),
        updatedAt: data.updatedAt || new Date().toISOString(),
      };
    }
  } catch (err) {
    console.debug("[CustomerMemory] Local/offline fallback for thread:", err);
  }

  // Check local fallback
  try {
    const local = localStorage.getItem(`thread_${userId}_${threadId}`);
    if (local) {
      const parsed = JSON.parse(local);
      return parsed;
    }
  } catch (e) {
    // Ignore
  }

  return null;
}

/**
 * Updates a customer thread with a new exchange (customer message + AI reply),
 * keeps the LAST 5 messages in active history array, and archives older messages into summary.
 * Uses atomic per-thread mutex queue to safely handle rapid multi-message concurrency.
 */
export function saveCustomerExchange(
  userId: string,
  platform: string,
  customerIdentifier: string,
  customerName: string,
  customerMessage: string,
  aiReply: string,
  extractedData?: { phone?: string; address?: string; item?: string }
): Promise<CustomerThread> {
  const threadId = getThreadId(platform, customerIdentifier);

  return queueThreadOperation(threadId, async () => {
    const existing = await getCustomerThread(userId, platform, customerIdentifier);
    const nowIso = new Date().toISOString();

    const prevMessages: ChatMessage[] = existing?.messages ? [...existing.messages] : [];

    // Build full queue of messages
    const fullQueue: ChatMessage[] = [...prevMessages];
    let updatedTotalMessages = existing?.totalMessages || 0;

    // Check if customer message is already the last item
    const lastMsg = fullQueue[fullQueue.length - 1];
    const isAiFollowUp =
      lastMsg &&
      lastMsg.sender === "customer" &&
      lastMsg.text.trim() === customerMessage.trim() &&
      aiReply &&
      aiReply.trim().length > 0;

    if (isAiFollowUp) {
      // Append AI reply
      fullQueue.push({
        id: `ai_${Date.now()}`,
        sender: "ai",
        platform,
        text: aiReply.trim(),
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      });
      updatedTotalMessages += 1;
    } else {
      // Append customer message
      fullQueue.push({
        id: `cust_${Date.now()}`,
        sender: "customer",
        customerName: customerName || "Customer",
        platform,
        text: customerMessage.trim(),
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      });
      updatedTotalMessages += 1;

      if (aiReply && aiReply.trim().length > 0) {
        fullQueue.push({
          id: `ai_${Date.now() + 1}`,
          sender: "ai",
          platform,
          text: aiReply.trim(),
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        });
        updatedTotalMessages += 1;
      }
    }

    // Active window: strictly the LAST 5 messages
    const keptMessages = fullQueue.slice(-5);
    // Dropped messages: older messages that are now rolling out of the 5-message window
    const droppedMessages = fullQueue.length > 5 ? fullQueue.slice(0, fullQueue.length - 5) : [];

    let updatedSummary = existing?.summary || "";

    // If there are dropped messages OR conversation count > 5, immediately inspect and merge facts into summary!
    if (droppedMessages.length > 0 || updatedTotalMessages > 5) {
      updatedSummary = await summarizeDroppedMessagesAsync(
        updatedSummary,
        droppedMessages.length > 0 ? droppedMessages : fullQueue.slice(0, Math.max(0, fullQueue.length - 5)),
        extractedData
      );
    }

    // Clean and sanitize phone/address
    let finalPhone = (extractedData?.phone || existing?.phone || "").trim();
    let finalAddress = (extractedData?.address || existing?.address || "").trim();

    // Strip conversational noise from address
    if (
      finalAddress.toLowerCase().includes("ami ekta") ||
      finalAddress.toLowerCase().includes("provided via") ||
      finalAddress.toLowerCase().includes("dhakar moddhe") ||
      finalAddress.toLowerCase().includes("koto") ||
      finalAddress.toLowerCase().includes("charge")
    ) {
      finalAddress = "";
    }

    const updatedThread: CustomerThread = {
      id: threadId,
      customerId: customerIdentifier,
      customerName: customerName || existing?.customerName || "Customer",
      platform,
      phone: finalPhone,
      address: finalAddress,
      summary: updatedSummary,
      lastMessageSnippet: customerMessage.slice(0, 80),
      lastMessageAt: nowIso,
      totalMessages: updatedTotalMessages,
      messages: keptMessages.map((m) => ({
        id: m.id,
        sender: m.sender,
        platform: m.platform || platform,
        text: m.text,
        timestamp: m.timestamp,
      })),
      createdAt: existing?.createdAt || nowIso,
      updatedAt: nowIso,
    };

    // 1. Save to local storage for fast client access
    try {
      localStorage.setItem(`thread_${userId}_${threadId}`, JSON.stringify(updatedThread));
    } catch (e) {
      // Ignore
    }

    // 2. Sync cleanly to Firebase Firestore
    if (userId) {
      try {
        const threadRef = doc(db, "users", userId, "customer_threads", threadId);
        await setDoc(
          threadRef,
          {
            id: updatedThread.id,
            customerId: updatedThread.customerId,
            customerName: updatedThread.customerName,
            platform: updatedThread.platform,
            phone: updatedThread.phone,
            address: updatedThread.address,
            summary: updatedThread.summary,
            lastMessageSnippet: updatedThread.lastMessageSnippet,
            lastMessageAt: updatedThread.lastMessageAt,
            totalMessages: updatedThread.totalMessages,
            messages: updatedThread.messages,
            createdAt: updatedThread.createdAt,
            updatedAt: updatedThread.updatedAt,
          },
          { merge: true }
        );
      } catch (err) {
        console.debug("[CustomerMemory] Cloud save fallback:", err);
      }
    }

    return updatedThread;
  });
}

/**
 * Fetches all persistent customer threads for a shop
 */
export async function getAllCustomerThreads(userId: string): Promise<CustomerThread[]> {
  if (!userId) return [];
  const threads: CustomerThread[] = [];

  try {
    const colRef = collection(db, "users", userId, "customer_threads");
    const snap = await getDocs(colRef);
    snap.forEach((docSnap) => {
      const data = docSnap.data();
      const totalMessages = Number(data.totalMessages) || 0;
      let rawSummary = data.summary || "";

      threads.push({
        id: docSnap.id,
        customerId: data.customerId || "",
        customerName: data.customerName || "Customer",
        platform: data.platform || "WhatsApp",
        phone: data.phone || "",
        address: data.address || "",
        summary: rawSummary,
        lastMessageSnippet: data.lastMessageSnippet || "",
        lastMessageAt: data.lastMessageAt || data.updatedAt || "",
        totalMessages,
        messages: Array.isArray(data.messages) ? data.messages : [],
        createdAt: data.createdAt || new Date().toISOString(),
        updatedAt: data.updatedAt || new Date().toISOString(),
      });
    });
  } catch (err) {
    console.debug("[CustomerMemory] Error fetching all threads:", err);
  }

  return threads;
}

/**
 * Deletes a customer thread from Firestore and local storage when reset/cleared
 */
export async function deleteCustomerThread(
  userId: string,
  platform: string,
  customerIdentifier: string
): Promise<boolean> {
  if (!userId || !customerIdentifier) return false;
  const threadId = getThreadId(platform, customerIdentifier);

  // 1. Remove from local storage
  try {
    localStorage.removeItem(`thread_${userId}_${threadId}`);
  } catch (e) {
    // Ignore
  }

  // 2. Delete document from Firestore
  try {
    const threadRef = doc(db, "users", userId, "customer_threads", threadId);
    await deleteDoc(threadRef);
    return true;
  } catch (err) {
    console.debug("[CustomerMemory] Error deleting customer thread from Firestore:", err);
    return false;
  }
}
