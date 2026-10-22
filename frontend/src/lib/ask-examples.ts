/**
 * "Try a real question" on the free ask page — common problems people in India
 * face, written the way a worried person would actually type them.
 *
 * Each question stays in its own language (English, Hindi, or Hinglish) on both
 * UI languages: that mix is how people really ask. Topic names and other page
 * text live in i18n. No section numbers: India's criminal-law codes were renamed
 * in 2024, and a question doesn't need them. Tapping one sends it as written.
 */

export type AskTopic = "fraud" | "property" | "job" | "family" | "money" | "consumer" | "police";
export type AskFilter = "popular" | AskTopic;
export type ExampleLang = "en" | "hi" | "hinglish";

export interface AskExample {
  id: string;
  topic: AskTopic;
  lang: ExampleLang;
  text: string;
}

export const ASK_FILTERS: readonly AskFilter[] = [
  "popular",
  "fraud",
  "property",
  "job",
  "family",
  "money",
  "consumer",
  "police",
];

export const ASK_EXAMPLES: readonly AskExample[] = [
  { id: "fraud-digital-arrest", topic: "fraud", lang: "en", text: "A caller claiming to be from CBI says I'm under 'digital arrest' and must pay. Is this real?" },
  { id: "fraud-otp-debit", topic: "fraud", lang: "hi", text: "बिना OTP बताए मेरे बैंक खाते से पैसे कट गए, क्या बैंक पैसे लौटाएगा?" },
  { id: "fraud-task-scam", topic: "fraud", lang: "hinglish", text: "Online part-time job ke naam pe 'tasks' karwake ₹40,000 le liye. Complaint kahan karun?" },

  { id: "property-deposit", topic: "property", lang: "en", text: "My landlord won't return my security deposit even though I left the flat in good shape." },
  { id: "property-builder", topic: "property", lang: "hinglish", text: "Builder 3 saal se flat ka possession nahi de raha. Kya refund ke saath interest milega?" },
  { id: "property-sister-share", topic: "property", lang: "hi", text: "पिता की ज़मीन में भाई हिस्सा नहीं दे रहे — क्या बहन का भी बराबर हक़ है?" },
  { id: "property-eviction", topic: "property", lang: "en", text: "Can my landlord throw me out before my rent agreement ends?" },

  { id: "job-salary", topic: "job", lang: "en", text: "My company hasn't paid my salary for two months and HR has stopped replying. What can I do?" },
  { id: "job-full-final", topic: "job", lang: "hinglish", text: "Resign karne ke baad company full & final aur relieving letter nahi de rahi. Kya karun?" },
  { id: "job-pf", topic: "job", lang: "hi", text: "पुरानी कंपनी PF ट्रांसफर में मदद नहीं कर रही, अब क्या करें?" },
  { id: "job-harassment", topic: "job", lang: "en", text: "I was let go right after I complained about harassment at work. Is that allowed?" },

  { id: "family-dowry", topic: "family", lang: "hi", text: "शादी के बाद ससुराल वाले दहेज के लिए परेशान कर रहे हैं, मुझे क्या करना चाहिए?" },
  { id: "family-mutual-divorce", topic: "family", lang: "en", text: "How does divorce by mutual consent work, and how long does it take?" },
  { id: "family-maintenance", topic: "family", lang: "hinglish", text: "Pati ghar ka kharcha dena band kar chuke hain. Kya main maintenance maang sakti hoon?" },
  { id: "family-custody", topic: "family", lang: "en", text: "If we separate, who gets custody of our child?" },

  { id: "money-recovery-agent", topic: "money", lang: "hinglish", text: "Loan recovery agent roz call karke ghar walon ko dhamka rahe hain. Kya ye legal hai?" },
  { id: "money-cheque-bounce", topic: "money", lang: "en", text: "A friend's cheque to repay me bounced. What should I do now?" },
  { id: "money-friend-loan", topic: "money", lang: "hi", text: "दोस्त उधार लिए पैसे लौटाने से मना कर रहा है, कोई लिखा-पढ़ी नहीं है। क्या करूँ?" },

  { id: "consumer-refund", topic: "consumer", lang: "en", text: "An online store won't refund me for a phone that arrived damaged. Can I complain?" },
  { id: "consumer-flight", topic: "consumer", lang: "hinglish", text: "Flight cancel hui aur airline paise ki jagah sirf credit shell de rahi hai. Kya ye sahi hai?" },
  { id: "consumer-insurance", topic: "consumer", lang: "hi", text: "बीमा कंपनी ने अस्पताल का क्लेम बिना ठोस वजह के रिजेक्ट कर दिया, क्या करें?" },

  { id: "police-fir", topic: "police", lang: "hi", text: "पुलिस मेरी FIR दर्ज नहीं कर रही, अब मैं क्या कर सकता हूँ?" },
  { id: "police-questioning", topic: "police", lang: "en", text: "The police have called me to the station for questioning. What are my rights?" },
  { id: "police-challan", topic: "police", lang: "hinglish", text: "Traffic police ne galat challan kaat diya. Ise kaise challenge karun?" },
];

/** "Popular": one strong question from six different topics. */
export const POPULAR_IDS: readonly string[] = [
  "fraud-digital-arrest",
  "property-sister-share",
  "property-builder",
  "job-salary",
  "money-recovery-agent",
  "police-fir",
];

const LANG_RANK_HINDI_FIRST: Record<ExampleLang, number> = { hi: 0, hinglish: 1, en: 2 };

/** The questions for a filter. On the Hindi setting, Hindi comes first, then Hinglish, then English. */
export function examplesFor(filter: AskFilter, uiLang: string): AskExample[] {
  const list =
    filter === "popular"
      ? POPULAR_IDS.map((id) => ASK_EXAMPLES.find((e) => e.id === id)).filter((e): e is AskExample => Boolean(e))
      : ASK_EXAMPLES.filter((e) => e.topic === filter);
  if (uiLang !== "hi") return list;
  // Array.prototype.sort is stable, so the curated order holds within a language.
  return [...list].sort((a, b) => LANG_RANK_HINDI_FIRST[a.lang] - LANG_RANK_HINDI_FIRST[b.lang]);
}

/** `?topic=` from ads and the legal guides → the topic shown first. */
export function filterForTopicParam(topic: string | null | undefined): AskFilter {
  switch (topic) {
    case "property":
      return "property";
    case "family":
      return "family";
    case "labour":
      return "job";
    default:
      return "popular";
  }
}
