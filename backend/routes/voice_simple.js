import express from "express";
import twilio from "twilio";
import axios from "axios";

import {
  handleConversationalIntent,
  handleSilenceOrEmpty,
  getSmartPrompt,
  INTENT,
} from "../utils/conversational_intelligence.js";

const router = express.Router();
const VoiceResponse = twilio.twiml.VoiceResponse;

const activeCalls = new Map();

/* ======================= EXTERNAL API CONFIG ======================= */
const EXTERNAL_API_BASE = "http://192.168.1.40/jcbServiceEnginerAPIv7";
const COMPLAINT_API_URL =
  "http://192.168.1.40/jcbServiceEnginerAPIv7/ai_call_complaint.php";
const API_TIMEOUT = 20000;
const API_HEADERS = { JCBSERVICEAPI: "MakeInJcb" };

/* ======================= SERVICE CENTER LOCATIONS DATABASE ======================= */
const SERVICE_CENTERS = [
  {
    id: 1,
    city_name: "AJMER",
    branch_name: "AJMER",
    branch_code: "1",
    lat: 26.43488884,
    lng: 74.698112488,
    city_add:
      "F-100, Road No. 5, Riico Industrial Area, Near Power House, Palra, Ajmer",
    is_active: 1,
  },
  {
    id: 2,
    city_name: "ALWAR",
    branch_name: "ALWAR",
    branch_code: "2",
    lat: 27.582258224,
    lng: 76.647377014,
    city_add:
      "Khasra no. 2345, Tuleda Bye Pass, Alwar Bhiwadi Highway Alwar-301001",
    is_active: 1,
  },
  {
    id: 3,
    city_name: "BANSWARA",
    branch_name: "UDAIPUR",
    branch_code: "7",
    lat: 23.563598633,
    lng: 74.417541504,
    city_add:
      "Near Nayak Hotel, Udaipur - Dungarpur Link Road, Banswara-327001",
    is_active: 1,
  },
  {
    id: 4,
    city_name: "BHARATPUR",
    branch_name: "ALWAR",
    branch_code: "2",
    lat: 27.201648712,
    lng: 77.46295166,
    city_add: "Kurka house,Sewar road,Near Jain Mandir,Bharatpur (Raj.)",
    is_active: 1,
  },
  {
    id: 5,
    city_name: "BHILWARA",
    branch_name: "BHILWARA",
    branch_code: "3",
    lat: 25.374652863,
    lng: 74.623023987,
    city_add:
      "Kundan Complex, Sukhadiya Circle, Near Bewar Booking, Ajmer Road, Bhilwara",
    is_active: 1,
  },
  {
    id: 6,
    city_name: "BHIWADI",
    branch_name: "ALWAR",
    branch_code: "2",
    lat: 28.202623367,
    lng: 76.808448792,
    city_add:
      "Rajesh Motors (Raj.) Pvt. Ltd.,  Near Hutch Tower, Alwar Bye pass road, Bhiwadi, Distt. Alwar, (Raj.)",
    is_active: 1,
  },
  {
    id: 7,
    city_name: "DAUSA",
    branch_name: "JAIPUR",
    branch_code: "4",
    lat: 26.905101776,
    lng: 76.370185852,
    city_add:
      "Opp. Anand Goods transport co.Near Saras  Dairy Plant,  Agra By Pass, N.H-11,  Dausa -303303",
    is_active: 1,
  },
  {
    id: 8,
    city_name: "DHOLPUR",
    branch_name: "ALWAR",
    branch_code: "2",
    lat: 26.693515778,
    lng: 77.876922607,
    city_add: "Bharatpur Road, Layania Marriage Home, Dholpur",
    is_active: 1,
  },
  {
    id: 9,
    city_name: "DUNGARPUR",
    branch_name: "UDAIPUR",
    branch_code: "7",
    lat: 23.844612122,
    lng: 73.737922668,
    city_add:
      "T.P.Complex Shopno 1-2 Nr. Reliance Petrol Pump , Sagwara Road, Dunagarpur",
    is_active: 1,
  },
  {
    id: 10,
    city_name: "GONER ROAD",
    branch_name: "JAIPUR",
    branch_code: "4",
    lat: 26.889762878,
    lng: 75.873939514,
    city_add: "72, Goner Turn, Agra Road, Jaipur-302004, Rajasthan.",
    is_active: 1,
  },
  {
    id: 11,
    city_name: "JAIPUR",
    branch_name: "JAIPUR",
    branch_code: "4",
    lat: 26.865495682,
    lng: 75.681541443,
    city_add:
      "Khasra No. 1170-1175, Near Delhi Public School, Bhankrota, Ajmer Road, Jaipur, Rajasthan - 302026",
    is_active: 1,
  },
  {
    id: 12,
    city_name: "JHALAWAR",
    branch_name: "KOTA",
    branch_code: "5",
    lat: 24.547901154,
    lng: 76.194129944,
    city_add: "Opp. Roop Nagar Colony, Kota Road, Jhalawar",
    is_active: 1,
  },
  {
    id: 13,
    city_name: "JHUNJHUNU",
    branch_name: "SIKAR",
    branch_code: "6",
    lat: 28.09862709,
    lng: 75.374809265,
    city_add:
      "Opp. Police Line, Near Railway Crossing , Phase-2,Riico, Jhunjhunu",
    is_active: 1,
  },
  {
    id: 14,
    city_name: "KARAULI",
    branch_name: "JAIPUR",
    branch_code: "4",
    lat: 26.512748718,
    lng: 77.021934509,
    city_add:
      "Infront of S.P. Office, Shukla Colony Corner, Mandrayal Road, Karauli",
    is_active: 1,
  },
  {
    id: 15,
    city_name: "KEKRI",
    branch_name: "AJMER",
    branch_code: "1",
    lat: 25.961145401,
    lng: 75.157318115,
    city_add: "Ajmer Road, Near Peer Baba, Near R.T.O.Office, Kekri-305404",
    is_active: 1,
  },
  {
    id: 16,
    city_name: "KOTA",
    branch_name: "KOTA",
    branch_code: "5",
    lat: 25.12909317,
    lng: 75.868736267,
    city_add: "B -259, Ipia Road No-06, Near Railway Flyover, Kota",
    is_active: 1,
  },
  {
    id: 17,
    city_name: "KOTPUTLI",
    branch_name: "JAIPUR",
    branch_code: "4",
    lat: 27.680557251,
    lng: 76.160636902,
    city_add:
      "C/o Old Vijay Automobile N.H.8,Teh. Kotputli, Distt. Jaipur (Raj.)",
    is_active: 1,
  },
  {
    id: 18,
    city_name: "NEEM KA THANA",
    branch_name: "JAIPUR",
    branch_code: "4",
    lat: 27.741991043,
    lng: 75.788673401,
    city_add: "Opp. Jodla Johra, Neem Ka Thana, Dist. Sikar",
    is_active: 1,
  },
  {
    id: 19,
    city_name: "NIMBAHERA",
    branch_name: "BHILWARA",
    branch_code: "3",
    lat: 24.617570877,
    lng: 74.672302246,
    city_add:
      "Near Mahaveer Rastaurant,Eidgah Chauraha, Udaipur Road , Nimbahera-312602",
    is_active: 1,
  },
  {
    id: 20,
    city_name: "PRATAPGARH",
    branch_name: "BHILWARA",
    branch_code: "3",
    lat: 24.038845062,
    lng: 74.776138306,
    city_add:
      "Ambedkar Circle, Near Anand Service Centre, Opp. Bank Of India, Pratapgarh",
    is_active: 1,
  },
  {
    id: 21,
    city_name: "RAJSAMAND",
    branch_name: "UDAIPUR",
    branch_code: "7",
    lat: 25.078897476,
    lng: 73.866836548,
    city_add:
      "Near Indusind Bank Ltd. Tvs Chouraha, Shrinath Hotel, Kankroli, Rajsamand",
    is_active: 1,
  },
  {
    id: 22,
    city_name: "RAMGANJMANDI",
    branch_name: "KOTA",
    branch_code: "5",
    lat: 24.655239105,
    lng: 75.971496582,
    city_add: "Near Reliance Petrol Pump, Suket Road, Ramganj Mandi.",
    is_active: 1,
  },
  {
    id: 23,
    city_name: "SIKAR",
    branch_name: "SIKAR",
    branch_code: "6",
    lat: 27.591619492,
    lng: 75.171058655,
    city_add: "Opp. Parnami Motors, Near Circuit House,Jaipur Road , Sikar",
    is_active: 1,
  },
  {
    id: 25,
    city_name: "SUJANGARH",
    branch_name: "SIKAR",
    branch_code: "6",
    lat: 27.706758499,
    lng: 74.481445312,
    city_add:
      "Opp.krishi upaj mandi, salasar road, sujangarh, Distt. Churu PIN:331507",
    is_active: 1,
  },
  {
    id: 26,
    city_name: "TONK",
    branch_name: "JAIPUR",
    branch_code: "4",
    lat: 26.177381516,
    lng: 75.81086731,
    city_add: "Plot No.5, Captain Colony, Jaipur Road, Tonk, Distt.Tonk (Raj.)",
    is_active: 1,
  },
  {
    id: 27,
    city_name: "UDAIPUR",
    branch_name: "UDAIPUR",
    branch_code: "7",
    lat: 24.570493698,
    lng: 73.745994568,
    city_add:
      "A – 83, Road No. 1, Mewar Industrial Area, Madri, Udaipur (Raj.)",
    is_active: 1,
  },
  {
    id: 28,
    city_name: "VKIA",
    branch_name: "JAIPUR",
    branch_code: "4",
    lat: 27.0103827,
    lng: 75.7703344,
    city_add:
      "2nd Rd, New Karni Colony, Kishan Vatika, Ganesh Nagar, Jaipur, Rajasthan 302013",
    is_active: 1,
  },
];

/* ======================= DIGIT WORD MAP (Hindi + English + Hinglish) ======================= */
const DIGIT_WORD_MAP = {
  // Hindi
  शून्य: "0",
  सुन्य: "0",
  सून्य: "0",
  जीरो: "0",
  जीरों: "0",
  एक: "1",
  इक: "1",
  एक्क: "1",
  दो: "2",
  "दो ": "2",
  तीन: "3",
  तिन: "3",
  टीन: "3",
  चार: "4",
  चार्स: "4",
  पाँच: "5",
  पांच: "5",
  पाच: "5",
  पंच: "5",
  छह: "6",
  छः: "6",
  छ: "6",
  छे: "6",
  छ्ह: "6",
  सात: "7",
  साथ: "7",
  आठ: "8",
  अठ: "8",
  नौ: "9",
  नो: "9",
  नव: "9",
  // English
  zero: "0",
  oh: "0",
  o: "0",
  one: "1",
  two: "2",
  to: "2",
  three: "3",
  four: "4",
  for: "4",
  five: "5",
  six: "6",
  seven: "7",
  eight: "8",
  ate: "8",
  nine: "9",
  // Hinglish
  ek: "1",
  do: "2",
  teen: "3",
  tin: "3",
  char: "4",
  chaar: "4",
  panch: "5",
  paanch: "5",
  chhah: "6",
  chhe: "6",
  chheh: "6",
  saat: "7",
  sat: "7",
  aath: "8",
  ath: "8",
  nau: "9",
  nao: "9",
};

/* ---- NOISE WORDS TO IGNORE when extracting digits ---- */
const IGNORE_WORDS = new Set([
  "mera",
  "meri",
  "mere",
  "mera",
  "hamara",
  "hamaara",
  "number",
  "no",
  "num",
  "n",
  "nmbr",
  "machine",
  "chassis",
  "engine",
  "hai",
  "hain",
  "he",
  "ha",
  "h",
  "ka",
  "ki",
  "ke",
  "ko",
  "se",
  "par",
  "pe",
  "aapka",
  "apna",
  "mhara",
  "mharo",
  "phone",
  "mobile",
  "contact",
  "call",
  "batata",
  "bata",
  "bolunga",
  "bolunga",
  "yeh",
  "ye",
  "yahi",
  "vo",
  "wo",
  "aur",
  "bhi",
  "sirf",
  "bas",
  "the",
  "a",
  "an",
  "is",
  "and",
  "or",
  "my",
  "your",
  "okay",
  "ok",
  "theek",
  "thik",
  "haan",
  "ji",
  "yes",
  "नंबर",
  "नम्बर",
  "मशीन",
  "मेरा",
  "मेरी",
  "मेरे",
  "आपका",
  "आपकी",
  "फ़ोन",
  "मोबाइल",
  "है",
  "हैं",
  "का",
  "की",
  "के",
  "को",
  "से",
]);

/**
 * extractOnlyDigits — core number extractor
 * Handles: raw digits, spoken Hindi/English/Hinglish words, mixed input
 * Ignores noise context words ("mera number", "machine ka", etc.)
 *
 * KEY FIX: "दो" / "do" is only treated as digit 2 when it appears
 * in a purely numeric context (surrounded by other digit words/numbers).
 * In verb phrases like "सेव कर दो", "बता दो", "कर लो" — it is noise.
 */
function extractOnlyDigits(text) {
  if (!text) return "";
  const processed = text.toLowerCase().replace(/[।,!?;|]/g, " ");

  // ── Strip verb-suffix phrases that contain "do/दो" or "lo/ले" ──
  // e.g. "kar do", "bata do", "de do", "kar lo", "le lo", "save kar do"
  const verbNoise = processed
    .replace(
      /\b(kar|karo|karke|karein|bata|bolo|dedo|de|save|sev|chalao|chalana|chalte|ruk|ruko|sun|suno|lelo|le)\s+(do|दो|lo|लो|dena|लेना|देना)\b/gi,
      " ",
    )
    .replace(/\b(do|दो)\s+(baar|bar|minute|min|second|sec)\b/gi, " "); // "do baar" = twice, not digit

  const tokens = verbNoise.split(/[\s\-\/]+/).filter((t) => t.length > 0);
  let result = "";

  for (const token of tokens) {
    if (IGNORE_WORDS.has(token)) continue;
    if (/^\d+$/.test(token)) {
      result += token;
    } else if (DIGIT_WORD_MAP[token] !== undefined) {
      result += DIGIT_WORD_MAP[token];
    }
  }
  return result;
}

/**
 * extractPhoneDigits — same as extractOnlyDigits, used for phone numbers.
 * Extra safety: if result is less than 4 digits, return empty string
 * (avoids accepting stray "2" from noise phrases as partial phone).
 */
function extractPhoneDigits(text) {
  const digits = extractOnlyDigits(text);
  // Single stray digit from noise (e.g. "कर दो" → "2") — discard
  if (digits.length < 2) return "";
  return digits;
}

/* ======================= KEYWORDS ======================= */
const affirmativeKeywords = [
  // Hindi — Simple & clear affirmations
  "हान",
  "हां",
  "हाँ",
  "जी",
  "सही",
  "ठीक",
  "बिल्कुल",
  "ठीक है",
  "सही है",
  // Hindi — With pronouns (I, my, me context)
  "हा मैं हूँ",
  "हा मेरी है",
  "हा मेरा है",
  "हाँ मेरी",
  "हाँ मेरा",
  "हाँ मेरे",
  "मेरी है",
  "मेरा है",
  "हा मुझे ठीक",
  "मुझे ठीक",
  "मुझे सही",
  "मुझे ये",
  "मैं ठीक हूँ",
  "मैं सही हूँ",
  "main theek hun",
  // Standard affirmations
  "जी हां",
  "अमेजिंग मशीन",
  "मशीन",
  "जी हाँ",
  "हां जी",
  "हाँ जी",
  "बिल्कुल सही",
  "जी सर",
  "जी मैडम",
  "जी भैया",
  "जी दीदी",
  "अच्छा",
  "ओके",
  "ठीक रहेगा",
  "चलेगा",
  "हो गया",
  "माना",
  "दिया",
  "करो",
  "कर दो",
  "सही है",
  "ठीक है",
  "बराबर है",
  "दर्ज करो",
  "दर्ज कर",
  "रजिस्टर करो",
  "चल",
  "चल जाओ",
  "ठीक चल",
  "चलता है",
  "ठीक ठाक",
  "सब ठीक",
  "सब सही",
  "बढ़िया",
  "शानदार",
  "परफेक्ट",
  "एक्जैक्टली",
  "बिल्कुल वो ही",
  "वही है",
  "हा से",
  "हाँ से",
  "ये सही है",
  "ये ठीक है",
  "समझ गया",
  "ठीक हो गया",
  "आप बोलो",
  "आप करो",
  "आप ही करो",
  "तुम ही करो",
  "दे दो",
  "दे दीजिए",
  "ले लो",
  "ले लीजिए",
  "ले जाओ",
  "रख लो",
  "रख दो",
  // Hinglish / English — affirmations
  "yes",
  "yep",
  "yeah",
  "yup",
  "sure",
  "correct",
  "right",
  "ok",
  "okay",
  "okey",
  "fine",
  "good",
  "ji",
  "sahi",
  "theek",
  "thik",
  "bilkul",
  "haan",
  "han",
  "h",
  "hn",
  "absolutely",
  "definitely",
  "affirmative",
  "confirmed",
  "agreed",
  "accepted",
  "sounds good",
  "all good",
  "that works",
  "that is right",
  "that is correct",
  "kar do",
  "save karo",
  "register karo",
  "darz karo",
  "likh lo",
  "kar le",
  "proceed",
  "go ahead",
  "let's do it",
  "let's go",
  "keep going",
  "move on",
  "main theek",
  "main ready",
  "i am ready",
  "i am good",
  "i am fine",
  "my number",
  "my address",
  "my city",
  "my name",
];

const negativeKeywords = [
  // Hindi — Simple negations
  "नहीं",
  "नही",
  "ना",
  "नाह",
  "न",
  "गलत",
  "गलत है",
  // Hindi — With pronouns (Me/My/I context)
  "मेरा नहीं",
  "मेरी नहीं",
  "मेरे नहीं",
  "मेरी नही",
  "मेरा नही",
  "मुझे नहीं",
  "मुझे नही",
  "मैं नहीं",
  "मैं नही",
  "मुझे ये नहीं",
  "मेरा नहीं है",
  "ये मेरा नहीं",
  "मतलब नहीं",
  "मतलब नही",
  "मैं मतलब नहीं",
  "यह नहीं",
  "ये नहीं",
  // Standard negations
  "ये नहीं",
  "यह नहीं",
  "वह नहीं",
  "ये गलत",
  "ये सही नहीं",
  "यह सही नहीं",
  "मत",
  "मत करो",
  "मत दो",
  "नहीं करो",
  "मत हो",
  "नहीं होगा",
  "नहीं होना",
  "रहने दो",
  "रहने दीजिए",
  "जाने दो",
  "जाने दीजिए",
  "छोड़ दो",
  "जरूरत नहीं",
  "जरूरत नही",
  "जरा नहीं",
  "बिल्कुल नहीं",
  "कतई नहीं",
  "कभी नहीं",
  "ठीक नहीं",
  "ठीक नही",
  "सही नहीं",
  "सही नही",
  "बराबर नहीं",
  "बराबर नही",
  "नहीं भैया",
  "नहीं दीदी",
  "नहीं भैया जी",
  "न भैया",
  "न दीदी",
  "न हीं",
  "इससे नहीं",
  "इससे नही",
  "इस तरह नहीं",
  "इस तरह नही",
  "इस طा नहीं",
  "गलत है",
  "बिल्कुल गलत",
  "पूरी गलत",
  "एक दम गलत",
  "सब गलत",
  "अलग है",
  "भिन्न है",
  "दूसरा है",
  "और कुछ",
  "कुछ और",
  // Hinglish / English — negations
  "no",
  "nope",
  "nah",
  "na",
  "not",
  "dont",
  "don't",
  "never",
  "negative",
  "wrong",
  "incorrect",
  "galat",
  "nai",
  "nei",
  "disagree",
  "neither",
  "not at all",
  "definitely not",
  "absolutely not",
  "surely not",
  "never",
  "no way",
  "no thanks",
  "no need",
  "not needed",
  "no requirement",
  "sounds wrong",
  "that is wrong",
  "that is incorrect",
  "that does not work",
  "my number is not",
  "my address is not",
  "my city is not",
  "i am not",
  "i am not ready",
  "not ready",
  "not prepared",
  "not confirmed",
];

// Phrases where "nahi" appears BUT the intent is actually to confirm/accept
// e.g. "नहीं अब सही है" = "no [nothing more], it's correct now"
const falseNegativePhrases = [
  "नहीं अब सही",
  "nahi ab sahi",
  "nahi sahi hai",
  "नहीं बस सही",
  "नहीं ठीक है",
  "नहीं बस इतना",
  "nahi bas itna",
  "nahi sab theek",
  "नहीं सब ठीक",
  "no sab sahi",
  "nahi ab theek",
  "नहीं अब ठीक",
  "bas sahi hai",
  "बस सही है",
  "बस ठीक है",
  "nahi aur kuch nahi",
  "नहीं और कुछ नहीं",
  "bas yahi",
  "बस यही",
  "इतना ही काफी",
];

/* ─── CLARIFICATION KEYWORDS: Help identify when customer needs re-asking ──── */
const clarificationKeywords = new Set([
  "क्या",
  "कि",
  "ये",
  "वो",
  "यह",
  "इस",
  "उस",
  "जो",
  "जहा",
  "कहा",
  "क्या मतलब",
  "क्या हुआ",
  "किस की",
  "कौन",
  "कहाँ",
  "कब",
  "what",
  "which",
  "who",
  "where",
  "when",
  "why",
  "how",
  "क्या सुना",
  "क्या पहचाना",
  "क्या लगा",
  "क्या लगो",
  "haan but",
  "par",
  "lekin",
  "lekín",
  "but",
  "however",
  "sort of",
  "kind of",
  "maybe",
  "perhaps",
  "possible",
]);

/**
 * isFalseNegative — detects phrases that CONTAIN "nahi" but actually mean "done/confirmed"
 * e.g. "नहीं अब सही है सब कुछ" → customer saying "no [more issues], it's all correct"
 */
function isFalseNegative(text) {
  if (!text) return false;
  const t = text.toLowerCase();
  return falseNegativePhrases.some((p) => t.includes(p.toLowerCase()));
}

const uncertaintyKeywords = [
  // Hindi uncertainty
  "पता नहीं",
  "पता नही",
  "पता न",
  "मुझे पता नहीं",
  "मुझे नहीं पता",
  "मालूम नहीं",
  "मालूम नही",
  "नहीं मालूम",
  "जानकारी नहीं",
  "जानकारी नही",
  "याद नहीं",
  "याद नही",
  "नहीं याद",
  "भूल गया",
  "भूल गयी",
  "भूल गये",
  "समझ नहीं",
  "समझ नही",
  "नहीं समझ आ रहा",
  "समझ नहीं आया",
  "समझ में नहीं",
  // Uncertainty with pronouns
  "मेरा पता नहीं",
  "मेरी याद नहीं",
  "मेरे को ख़ैर",
  "मुझे मालूम नहीं",
  "मुझे समझ नहीं",
  "मैं नहीं जानता",
  "मैं नहीं जानती",
  "मुझे उम्मीद नहीं",
  "मुझे शक है",
  "क्या पता",
  "क्या जाने",
  "किसे पता",
  "संभव है",
  "हो सकता है",
  "शायद",
  "मेरा ख्याल",
  "मेरे ख्याल से",
  "मुझे लगता",
  "मेरे ख्याल में",
  // English uncertainty
  "dont know",
  "do not know",
  "don't know",
  "dunno",
  "no idea",
  "no clue",
  "not sure",
  "uncertain",
  "unsure",
  "forget",
  "forgot",
  "forgotten",
  "can't remember",
  "i think",
  "i guess",
  "maybe",
  "perhaps",
  "probably",
  "possibly",
  "perhaps",
  "sort of",
  "kind of",
  "like",
  "seems like",
  "appears to be",
  "i am not sure",
  "i dont remember",
  "i dont think",
  "not sure about",
  "maybe yes",
  "maybe no",
  "could be",
  "might be",
];

const repeatKeywords = [
  "repeat",
  "dobara",
  "fir se",
  "phir se",
  "dubara",
  "again",
  "once more",
  "samjha nahi",
  "क्या बोला",
  "क्या कहा",
  "phir bolo",
];
const pauseKeywords = [
  "रुको",
  "रुक",
  "रुकिए",
  "रुकिऐ",
  "ek minute",
  "ek min",
  "hold",
  "एक मिनट",
  "एक पल",
  "थोड़ी देर",
  "थोड़ा रुको",
  "रोको",
  "ठहरिये",
];

/* ======================= MACHINE TYPES ======================= */
const machineTypeKeywords = {
  Warranty: [
    "वारंटी",
    "warranty",
    "गारंटी",
    "guarantee",
    "free",
    "फ्री",
    "मुफ्त",
  ],
  "JCB Care": ["जीसीबी केयर", "jcb care", "केयर", "care", "annual", "yearly"],
  "Engine Care": ["इंजन केयर", "engine care", "engine protection"],
  Demo: ["डेमो", "demo", "demonstration", "test machine"],
  BHL: ["बीएचएल", "bhl", "backhoe", "back hoe"],
};

const machineStatusKeywords = {
  Breakdown: [
    "ब्रेकडाउन",
    "breakdown",
    "break down",
    "बिल्कुल बंद",
    "बंद है",
    "बंद हो गया",
    "पूरा बंद",
    "डाउन है",
    "बिल्कुल काम नहीं",
    "काम ही नहीं कर रहा",
    "शुरू नहीं हो रहा",
    "स्टार्ट नहीं हो रहा",
    "खराब हो गया",
    "मर गया",
    "start nahi ho raha",
    "chalu nahi ho raha",
    "dead",
    "stopped completely",
  ],
  "Running With Problem": [
    "चल रहा है लेकिन",
    "chal raha hai lekin",
    "चल तो रहा है",
    "running with problem",
    "working with issue",
    "working but",
    "partially working",
  ],
};

const jobLocationKeywords = {
  Workshop: [
    "वर्कशॉप",
    "workshop",
    "शॉप",
    "shop",
    "गैरेज",
    "garage",
    "घर पर",
    "घर",
    "घर में",
    "home",
    "होम",
    "गोदाम",
    "शेड",
    "shed",
    "service center",
  ],
  Onsite: [
    "साइट",
    "site",
    "साइट पर",
    "खेत",
    "खेत में",
    "field",
    "फील्ड",
    "जगह",
    "बाहर",
    "outdoor",
    "काम की जगह",
    "construction",
    "project",
    "road",
    "हाईवे",
  ],
};

/* ======================= COMPREHENSIVE COMPLAINT MAP ======================= */
const complaintMap = {
  Engine: {
    keywords: [
      "engine",
      "motor",
      "इंजन",
      "मोटर",
      "चालू नहीं",
      "शुरू नहीं",
      "मशीन चालू नहीं",
      "मशीन स्टार्ट नहीं",
      "मोटर खराब",
      "इंजन खराब",
      "इंजिन",
      "start नहीं",
      "chalu नहीं",
      "शुरुआत नहीं",
      "run नहीं",
      "झटके",
      "थरथार",
    ],
    priority: 10,
    subTitles: {
      "Start Problem": [
        "start",
        "स्टार्ट नहीं",
        "शुरू नहीं",
        "chalu nahi",
        "चालू नहीं",
        "starter",
        "cranking",
        "बंद है",
        "मर गया",
        "डेड",
      ],
      Overheating: [
        "overheat",
        "गर्म",
        "गरम",
        "heat",
        "temperature",
        "गर्मी",
        "बहुत गर्म",
        "high temperature",
        "आग",
      ],
      "Black Smoke": [
        "smoke",
        "धुआ",
        "काला धुआ",
        "black smoke",
        "smoking",
        "fumes",
        "dhaua",
      ],
      "Loss of Power": [
        "power कम",
        "weak",
        "कमजोर",
        "no power",
        "slow",
        "sluggish",
        "तेजी नहीं",
        "गति नहीं",
      ],
      "Knocking Noise": [
        "knock",
        "knocking",
        "टकटक",
        "chattering",
        "खटाखट",
        "खड़खड़",
      ],
      "Diesel Leak": [
        "leak",
        "लीक",
        "fuel leak",
        "diesel बह रहा",
        "ईंधन लीक",
        "तेल निकल रहा",
      ],
      "Abnormal Noise": [
        "noise",
        "आवाज",
        "sound",
        "शोर",
        "grinding",
        "whining",
        "whistling",
      ],
      "Fuel Consumption": [
        "fuel",
        "petrol",
        "diesel",
        "खर्च",
        "consumption",
        "mileage",
        "ईंधन खपत",
      ],
      Misfire: [
        "misfire",
        "coughing",
        "jerking",
        "stumbling",
        "कंपन",
        "झटका",
        "थरथराना",
      ],
    },
  },
  "Starting Trouble": {
    keywords: [
      // Hindi
      "स्टार्ट नहीं",
      "चालू नहीं",
      "शुरू नहीं",
      "बंद है",
      "चालू नहीं हो रहा",
      "स्टार्ट नहीं हो रहा",
      "मशीन नहीं चली",
      "इग्निशन नहीं",
      "क्रैंक",
      "स्टार्टिंग",
      "शुरु नहीं",
      "शुरुआत नहीं",
      "स्टार्ट नहीं होता",
      "स्टार्टर खराब",
      "स्टार्टर समस्या",
      "शुरुआत की समस्या",
      "चालू करने में समस्या",
      "मशीन स्टार्ट नहीं हो रही",
      "स्टार्ट करना मुश्किल",
      "स्टार्ट नहीं हो पा रहा",
      // English/Hinglish
      "starting",
      "start nahi",
      "chalu nahi",
      "band hai",
      "start ho nahi raha",
      "start problem",
      "starting problem",
      "start nahi hota",
      "start issue",
      "cold start",
      "hard start",
      "slow start",
      "no start",
      "wont start",
      "start nahi ho raha",
      "start hi nahi",
      "engine start",
      "crank",
      "ignition",
      "start karna",
      "starting trouble",
      "shuru nahi",
      "starter",
      "starter problem",
      "starting issue",
      "won't start",
      "doesn't start",
      "fails to start",
    ],
    priority: 10,
    subTitles: {
      "No Start Condition": [
        "no start",
        "बिल्कुल नहीं",
        "शुरू ही नहीं",
        "dead",
        "complete fail",
        "wont start",
        "start hi nahi",
        "bilkul nahi",
        "engine hi nahi",
      ],
      "Hard Starting": [
        "hard start",
        "कठिन",
        "मुश्किल से",
        "कई बार",
        "attempt",
        "mushkil",
        "baar baar",
      ],
      "Cold Starting Issue": [
        "cold start",
        "सर्द",
        "ठंड में",
        "morning",
        "raat ke baad",
        "subah",
        "sardi",
      ],
      "Slow Starting": [
        "slow start",
        "धीमा",
        "samay lagta",
        "late",
        "dheere",
        "der lagti",
      ],
      "Cranking Weak": [
        "cranking",
        "weak crank",
        "कमजोर क्रैंक",
        "rpm",
        "turnover",
        "ghoomta nahi",
      ],
      "Self Starter Fail": [
        "self",
        "self starter",
        "self nahi",
        "सेल्फ",
        "सेल्फ नहीं",
        "self problem",
      ],
    },
  },
  Transmission: {
    keywords: [
      "transmission",
      "gear",
      "shift",
      "गियर",
      "ट्रांसमिशन",
      "gear box",
      "ट्रांसमिशन खराब",
      "गियर समस्या",
      "शिफ्ट",
      "gear change",
      "shifting",
      "नहीं लग रहा",
      "गियर नहीं लग",
    ],
    priority: 9,
    subTitles: {
      "Gear Shifting Hard": [
        "shift hard",
        "shift difficult",
        "gear नहीं लग रहा",
        "grinding",
        "stuck",
        "jam",
        "मुश्किल",
        "जाम हो गया",
      ],
      Slipping: [
        "slipping",
        "rpm बढ़ रहा",
        "power loss",
        "slip करना",
        "खिसकना",
      ],
      "Neutral Problem": ["neutral", "neutral में फंस", "न्यूट्रल"],
      "Gear Grinding": [
        "grind",
        "grinding",
        "grinding noise",
        "scraping",
        "चरमरा",
        "खरखराहट",
      ],
    },
  },
  "Hydraulic System": {
    keywords: [
      "hydraulic",
      "pressure",
      "pump",
      "हाइड्रोलिक",
      "पंप",
      "दबाव",
      "प्रेशर",
      "pressure कम",
      "दबाव कम",
      "hydraulic oil",
      "हाइड्रोलिक तेल",
      "loader",
      "bucket",
      "boom",
      "arm",
    ],
    priority: 9,
    subTitles: {
      "Low Pressure": [
        "pressure कम",
        "प्रेशर कम",
        "दबाव कम",
        "low",
        "weak",
        "slow",
        "तेजी नहीं",
        "स्पीड कम",
      ],
      "Bucket Not Lifting": [
        "bucket नहीं उठ",
        "lift नहीं",
        "boom slow",
        "arm नहीं उठ",
        "उठता नहीं",
        "बाल्टी नहीं",
      ],
      "Hydraulic Leak": [
        "leak",
        "लीक",
        "oil leak",
        "seeping",
        "बह रहा",
        "dripping",
        "तेल गिरना",
      ],
      "Pump Failure": [
        "pump fail",
        "pump नहीं",
        "pump problem",
        "पंप खराब",
        "पंप मर गया",
      ],
      "Cylinder Problem": [
        "cylinder",
        "cylinder leak",
        "rod",
        "seal",
        "सिलेंडर",
      ],
      "Hose Pressure": ["hose", "hose leak", "pipe burst", "नली", "पाइप"],
    },
  },
  "Braking System": {
    keywords: [
      "brake",
      "ब्रेक",
      "braking",
      "stop",
      "रोक",
      "पैडल",
      "brake pedal",
      "ब्रेकिंग",
      "ब्रेक खराब",
      "रुकना मुश्किल",
      "disc brake",
      "band brake",
    ],
    priority: 10,
    subTitles: {
      "Brake Not Working": [
        "brake काम नहीं",
        "no braking",
        "brake fail",
        "नहीं रुक रहा",
        "ब्रेक नहीं",
        "रोकना नहीं",
      ],
      "Weak Braking": [
        "brake कमजोर",
        "weak",
        "slow stop",
        "soft pedal",
        "दुर्बल",
        "हल्का",
      ],
      "Brake Pads Worn": [
        "pads",
        "pad worn",
        "पैड",
        "पैड पहना",
        "पैड टूटा",
        "घिसाव",
      ],
      "Brake Fluid Leak": [
        "fluid leak",
        "brake leak",
        "पेडल दबता नहीं",
        "spongy pedal",
        "तरल लीक",
      ],
      "Brake Noise": [
        "noise",
        "squealing",
        "grinding",
        "creaking",
        "screeching",
        "शोर",
        "चीख",
      ],
    },
  },
  "Electrical System": {
    keywords: [
      "electrical",
      "battery",
      "light",
      "बिजली",
      "बैटरी",
      "स्टार्टर",
      "अल्टरनेटर",
      "wiring",
      "spark",
      "ignition",
    ],
    priority: 8,
    subTitles: {
      "Battery Problem": [
        "battery",
        "dead",
        "weak",
        "बैटरी नहीं चार्ज",
        "charge नहीं हो रहा",
      ],
      "Starter Motor": [
        "starter",
        "स्टार्टर",
        "cranking weak",
        "starter खराब",
        "no crank",
      ],
      "Alternator Problem": [
        "alternator",
        "charge नहीं",
        "alternator खराब",
        "बिजली नहीं",
      ],
      "Wiring Issue": ["wiring", "wire", "short", "spark", "electrical short"],
      "Light Problem": [
        "light",
        "लाइट",
        "headlight",
        "taillight",
        "बत्ती नहीं जल रही",
      ],
    },
  },
  "Cooling System": {
    keywords: [
      "cooling",
      "coolant",
      "radiator",
      "fan",
      "पंखा",
      "ठंडा करना",
      "water pump",
      "thermostat",
      "temperature",
      "water system",
    ],
    priority: 8,
    subTitles: {
      "Radiator Leak": [
        "radiator leak",
        "radiator खराब",
        "पानी निकल रहा",
        "water leak",
      ],
      "Fan Problem": ["fan", "पंखा", "fan काम नहीं", "fan slow", "fan noise"],
      Thermostat: ["thermostat", "temperature control", "temp problem"],
      "Water Pump": ["pump", "पंप", "water नहीं घूम रहा", "pump leak"],
    },
  },
  "AC/Cabin": {
    keywords: [
      // Hindi — the critical ones that were missing
      "ऐसी",
      "एसी",
      "ए.सी",
      "ए सी",
      "एअर कंडीशनर",
      "एयर कंडीशनर",
      "ठंडा नहीं",
      "ठंडक नहीं",
      "गरम हवा",
      "कैबिन गर्म",
      "ठंडी नहीं",
      "ऐसी खराब",
      "एसी खराब",
      "ऐसी बंद",
      "एसी बंद",
      "ऐसी काम नहीं",
      "ब्लोअर",
      "कंप्रेसर",
      "कंडेंसर",
      "फिल्टर",
      "एसी की खराबी",
      "एयर",
      "सी खराब",
      "ठंडक नहीं दे रहा",
      "हवा नहीं",
      "ठंड नहीं आ रही",
      // English / Hinglish
      "ac",
      "a.c",
      "a/c",
      "air conditioner",
      "air conditioning",
      "esi",
      "aisi",
      "aesi",
      "a c",
      "ac nahi",
      "ac band",
      "ac kharab",
      "cabin cool",
      "cooling nahi",
      "thanda nahi",
      "thandi nahi",
      "compressor",
      "condenser",
      "blower",
      "ac filter",
      "cabin hot",
      "ac chal nahi",
      "ac chalta nahi",
      "ac problem",
      "cool nahi kar raha",
      "ac cooling",
      "cooling band",
      "cabin temperature",
      "ac issue",
    ],
    priority: 8,
    subTitles: {
      "AC Not Cooling": [
        "ठंडा नहीं",
        "thanda nahi",
        "thandi nahi",
        "cooling नहीं",
        "cool nahi",
        "ac weak",
        "temperature high",
        "गरम हवा",
        "hot air",
        "ठंडक नहीं",
      ],
      "AC Not Working": [
        "ac काम नहीं",
        "ac band",
        "ac off",
        "ac chalta nahi",
        "compressor fail",
        "कंप्रेसर",
        "ac nahi chala",
        "बिल्कुल बंद",
      ],
      "Blower Problem": [
        "blower",
        "ब्लोअर",
        "blower noise",
        "blower kharab",
        "hawa nahi aa rahi",
        "हवा नहीं",
        "fan nahi",
      ],
      "Gas Leakage": [
        "gas",
        "gas leak",
        "refrigerant",
        "re-gas",
        "gas khatam",
        "गैस",
        "रेफ्रिजरेंट",
      ],
      "Filter Choked": [
        "filter",
        "filter chok",
        "filter kharab",
        "air flow कम",
        "dust",
        "jaam",
        "जाम",
      ],
    },
  },
  Steering: {
    keywords: [
      "steering",
      "पहिया",
      "wheel",
      "turn",
      "स्टीयरिंग",
      "पावर स्टीयरिंग",
      "power steering",
      "turning",
    ],
    priority: 8,
    subTitles: {
      "Hard Steering": [
        "hard",
        "heavy",
        "कड़ा",
        "difficult turn",
        "मुश्किल से मुड़ता",
      ],
      "Power Steering Fail": [
        "power steering",
        "पावर खो गया",
        "power loss",
        "steering काम नहीं",
      ],
      "Steering Noise": ["noise", "whining", "groaning", "creaking"],
      Vibration: ["vibration", "shake", "कंपन", "road feel"],
    },
  },
  Clutch: {
    keywords: [
      "clutch",
      "क्लच",
      "clutch pedal",
      "disengagement",
      "engagement",
      "क्लच पैडल",
      "क्लच खराब",
      "clutch plate",
    ],
    priority: 7,
    subTitles: {
      "Clutch Slip": [
        "slip",
        "slipping",
        "गति नहीं बढ़ रही",
        "rpm बढ़ता है",
        "क्लच फिसल",
      ],
      "Hard Pedal": [
        "hard",
        "tight",
        "कड़ा",
        "difficult depress",
        "पेडल कड़ा",
        "दबाना मुश्किल",
      ],
      "Clutch Noise": [
        "noise",
        "squeak",
        "groaning",
        "whistling",
        "शोर",
        "चीख",
      ],
      "Clutch Wear": ["wear", "worn", "friction कम", "response slow", "घिसाव"],
    },
  },
  "Fuel System": {
    keywords: [
      "fuel",
      "petrol",
      "diesel",
      "फ्यूल",
      "tank",
      "injector",
      "fuel pump",
      "fuel filter",
      "fuel supply",
    ],
    priority: 8,
    subTitles: {
      "Fuel Pump": ["pump", "pump fail", "no fuel supply", "fuel नहीं आ रहा"],
      "Fuel Filter": ["filter", "choke", "filter खराब", "fuel flow कम"],
      "Injector Problem": ["injector", "injector block", "spray problem"],
      "Fuel Leak": ["leak", "leaking", "fuel बह रहा", "tank leak"],
    },
  },
  "Bucket/Boom": {
    keywords: [
      "bucket",
      "boom",
      "bucket arm",
      "loader arm",
      "loader",
      "dipper",
      "arm",
      "bucket lift",
      "boom not rising",
    ],
    priority: 8,
    subTitles: {
      "Bucket Not Working": [
        "bucket नहीं",
        "bucket खराब",
        "bucket ठीक नहीं",
        "bucket stuck",
      ],
      "Boom Slow": [
        "boom slow",
        "boom power कम",
        "lifting slow",
        "लिफ्टिंग कमजोर",
      ],
      "Bucket Weld Crack": ["crack", "टूटा", "weld break", "टूटन"],
      "Arm Bent": ["bent", "टेढ़ा", "damage", "misalignment"],
    },
  },
  "Oil Leak": {
    keywords: ["oil leak", "leak", "oil", "तेल", "तेल बह रहा", "leaking"],
    priority: 7,
    subTitles: {
      "Engine Oil Leak": ["engine", "engine leak", "तेल टपक रहा"],
      "Transmission Leak": ["transmission", "gear oil leak"],
      "Hydraulic Leak": ["hydraulic", "hydraulic fluid leak"],
      "Seal Problem": ["seal", "gasket", "seal खराब"],
    },
  },
  Vibration: {
    keywords: ["vibration", "shake", "vibrate", "कंपन", "shaking", "tremor"],
    priority: 6,
    subTitles: {
      "Engine Vibration": ["engine", "engine shake", "unbalance"],
      "Driveline Vibration": ["drive", "drivetrain", "transmission"],
      "Wheel Vibration": ["wheel", "tyre", "balancing"],
    },
  },
  Noise: {
    keywords: [
      "noise",
      "sound",
      "आवाज",
      "creaking",
      "grinding",
      "clunking",
      "शोर",
      "ध्वनि",
      "खरखराहट",
    ],
    priority: 5,
    subTitles: {
      "Engine Knocking": ["knock", "knocking", "ping", "खटाखट", "टकटक"],
      Grinding: ["grinding", "grinding noise", "metal sound", "अपघर्षण"],
      Squealing: ["squeal", "squealing", "high pitch", "चीख"],
      Clunking: ["clunk", "clanking", "metallic", "धड़ाम"],
    },
  },
  "Wiper System": {
    keywords: [
      "wiper", "वाइपर", "wiper nahi chal raha", "wiper kharab",
      "wiper band", "wiper problem", "glass saaf nahi", "wiper chalana",
      "windshield wiper", "wipers"
    ],
    priority: 6,
    subTitles: {
      "Wiper Not Working": ["nahi chal raha", "band", "kharab", "nahi", "काम नहीं कर रहा"],
      "Wiper Slow": ["slow", "dheere", "dhima", "धीमी", "धीरे"],
      "Wiper Noise": ["kharkhara", "खरखराना"]
    }
  },
  "Tyre/Wheel": {
    keywords: [
      "tyre", "tire", "type", "टायर", "puncture", "flat", "pankchar",
      "chakka", "चक्का", "wheel kharab", "rim", "tube", "पहिया"
    ],
    priority: 6,
    subTitles: {
      "Puncture": ["puncture", "pankchar", "flat", "hawa nahi", "हवा नहीं", "फटा"],
      "Tyre Wear": ["ghisa", "wear", "purana", "घिसा", "पुरानी", "खराब"],
      "Rim Damage": ["rim", "bent", "toda", "टूटा", "टेढ़ा", "नुकसान"]
    }
  },
  "Track/Undercarriage": {
    keywords: [
      "track", "chain", "sprocket", "undercarriage", "ट्रैक", "चेन",
      "patri", "पटरी", "track nahi chal raha", "track utar gaya",
      "crawler", "undercarriage damage"
    ],
    priority: 7,
    subTitles: {
      "Track Off": ["utar gaya", "off", "girna", "nikal gaya", "उतर गई", "गिर गई"],
      "Chain Break": ["tuta", "break", "cut", "टूटी", "टूट गई", "कट गई"],
      "Sprocket Wear": ["ghisa", "wear", "sprocket", "घिसी", "घिस गई"]
    }
  },
  "Exhaust": {
    keywords: [
      "silencer", "exhaust", "साइलेंसर", "एग्जॉस्ट", "pipe", "dhuan pipe",
      "exhaust kharab", "silencer tuta", "muffler", "पाइप"
    ],
    priority: 5,
    subTitles: {
      "Silencer Broken": ["tuta", "crack", "phata", "दरार"],
      "Smoke from Exhaust": ["dhuan", "smoke", "कala", "काला"]
    }
  },
  "Cabin/Body": {
    keywords: [
      "glass", "शीशा", "sheesa", "door", "दरवाजा", "darwaza", "cabin",
      "seat", "सीट", "mirror", "deur", "body damage",
      "cabin tuta", "darwaza nahi band", "canopy", "कैनोपी"
    ],
    priority: 4,
    subTitles: {
      "Glass Broken": ["tuta", "crack", "दरार"],
      "Door Problem": ["band nahi", "khulta nahi", "खुलता नहीं"],
      "Seat Problem": ["tuti", "adjust nahi", "टूटी", "समायोजन नहीं"]
    }
  },
  "Electrical Accessories": {
    keywords: [
      "horn", "हॉर्न", "light", "लाइट", "indicator", "headlight",
      "work light", "horn nahi baj raha", "light nahi jal rahi",
      "batti", "बत्ती", "electrical", "battery", "बैटरी"
    ],
    priority: 5,
    subTitles: {
      "Horn Not Working": ["nahi baj raha", "silent", "बजता नहीं"],
      "Light Problem": ["headlight", "dark", "अंधेरा"]
    }
  },
  "General Problem": {
    keywords: [
      "problem",
      "issue",
      "समस्या",
      "दिक्कत",
      "खराब",
      "trouble",
      "परेशानी",
    ],
    priority: 1,
    subTitles: {
      "Service Needed": [
        "service",
        "maintenance",
        "check",
        "inspection",
        "सेवा",
        "रखरखाव",
      ],
      Other: ["other", "general", "कुछ खराब", "और", "अन्य"],
    },
  },
};

/* ======================= CITY MAPPING ======================= */
const cityToBranchMap = {
  ajmer: { branch: "AJMER", outlet: "AJMER", cityCode: "1" },
  अजमेर: { branch: "AJMER", outlet: "AJMER", cityCode: "1" },
  kekri: { branch: "AJMER", outlet: "KEKRI", cityCode: "1" },
  alwar: { branch: "ALWAR", outlet: "ALWAR", cityCode: "2" },
  अलवर: { branch: "ALWAR", outlet: "ALWAR", cityCode: "2" },
  bharatpur: { branch: "ALWAR", outlet: "BHARATPUR", cityCode: "2" },
  bhilwara: { branch: "BHILWARA", outlet: "BHILWARA", cityCode: "3" },
  भीलवाड़ा: { branch: "BHILWARA", outlet: "BHILWARA", cityCode: "3" },
  jaipur: { branch: "JAIPUR", outlet: "JAIPUR", cityCode: "4" },
  जयपुर: { branch: "JAIPUR", outlet: "JAIPUR", cityCode: "4" },
  kota: { branch: "KOTA", outlet: "KOTA", cityCode: "5" },
  कोटा: { branch: "KOTA", outlet: "KOTA", cityCode: "5" },
  sikar: { branch: "SIKAR", outlet: "SIKAR", cityCode: "6" },
  सीकर: { branch: "SIKAR", outlet: "SIKAR", cityCode: "6" },
  udaipur: { branch: "UDAIPUR", outlet: "UDAIPUR", cityCode: "7" },
  उदयपुर: { branch: "UDAIPUR", outlet: "UDAIPUR", cityCode: "7" },
};

/* ======================= SPEECH HELPERS ======================= */
function cleanSpeech(text) {
  if (!text) return "";
  return text
    .toLowerCase()
    .replace(/[।.,!?]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function safeAscii(text) {
  if (!text) return "Unknown";
  return text.replace(/[^\w\s\-]/g, "").trim() || "Unknown";
}

/**
 * extractCityName — Strip filler words from city input
 * Removes: abhi, to, mein, hai, par, shehar, machine, etc.
 */
function extractCityName(text) {
  if (!text) return "Unknown";
  return text
    .replace(/\b(abhi|to|mein|hai|par|shehar|machine|अभी|तो|में|है|पर|शहर|मशीन)\b/gi, "")
    .trim() || text.trim();
}

function countWords(text) {
  if (!text) return 0;
  return text
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 0).length;
}

function isUncertain(text) {
  if (!text) return false;
  const t = text.toLowerCase();
  return uncertaintyKeywords.some((k) => t.includes(k.toLowerCase()));
}

function isAffirmative(text) {
  if (!text) return false;
  const t = text.toLowerCase().trim();

  // Direct keyword match
  if (affirmativeKeywords.some((k) => t.includes(k.toLowerCase()))) return true;

  // Check for pronoun-based affirmations with "haan/ha/ji/theek" + possessive/personal pronouns
  // Match patterns like: "हा मेरा है", "हाँ मेरी है", "मुझे ठीक है", "मैं ठीक हूँ", "यह मेरी है"
  const affirmPronounPatterns = [
    /\b(ha|haa|haan|han|haa|hain|hi|he)\s+(mera|meri|mere|mero|mero|hamara|hamari|hamra)\b/i,
    /\b(mera|meri|mere|hamara|hamari)\s+(hai|he|h|a|sahi|theek|bilkul|ठीक|सही)\b/i,
    /\b(mujhe|hamko|hamhe|mujhko)\s+(theek|sahi|bilkul|sab|khub|badhiya|badhia)\b/i,
    /\b(main|mai|men|ham|hum|hamlog)\s+(theek|sahi|ready|tayyar|ok|fine|good)\b/i,
    /\b(yeh|ye|yah|yaha|iska|uska)\s+(sahi|theek|bilkul|ठीक|सही|ठीक है)\b/i,
  ];

  for (const pattern of affirmPronounPatterns) {
    if (pattern.test(t)) return true;
  }

  return false;
}

function isNegative(text) {
  if (!text) return false;
  const t = text.toLowerCase().trim();

  // Direct keyword match
  if (negativeKeywords.some((k) => t.includes(k.toLowerCase()))) return true;

  // Check for pronoun-based negations with "nahi/na/naa" + possessive/personal pronouns
  // Match patterns like: "मेरा नहीं है", "मुझे नहीं चाहिए", "मैं नहीं सोचता", "यह मेरी नहीं है"
  const negPronounPatterns = [
    /\b(mera|meri|mere|hamara|hamari|hamra)\s+(nahi|nah|na|hi|hee|not|galat|galti)\b/i,
    /\b(nahi|nah|na|hi|hee|not)\s+(mera|meri|mere|hamara|hamari|hamra)\b/i,
    /\b(mujhe|hamko|hamhe|mujhko)\s+(nahi|na|galat|bilkul)\s+(chahiye|dhara|pehchan|samjh|lage|lagta)\b/i,
    /\b(main|mai|men|ham|hum|hamlog)\s+(nahi|na|not|galat|bilkul|kbhi)\s+(hoon|hun|hu|theek|sahi|ready)\b/i,
    /\b(iska|uska|yah|yeh|ye|yaha)\s+(nahi|na|not|galat|bilkul)\b/i,
    /\b(nahi|na|not)\s+(hai|h|a|samajh|lag|clear)\b/i,
  ];

  for (const pattern of negPronounPatterns) {
    if (pattern.test(t)) return true;
  }

  return false;
}

function rejectInvalid(text) {
  if (!text || text.trim().length < 2) return true;
  if (isUncertain(text)) return true;
  const t = text.toLowerCase();
  if (repeatKeywords.some((k) => t.includes(k))) return true;
  if (pauseKeywords.some((k) => t.includes(k))) return true;
  return false;
}

/**
 * isValidAddress — strict check that address is real and actionable
 * Rules:
 *  • At least 8 characters
 *  • At least 2 meaningful tokens (not noise/filler words)
 *  • Must NOT be just city name + filler ("ajmer mein", "wahi hai")
 *  • Must NOT contain only generic words like "ghar", "yahan", "wahan"
 *  • Must NOT be a sentence about something else (e.g. "save kar do")
 */
const GENERIC_ONLY_WORDS = new Set([
  "ghar",
  "घर",
  "yahan",
  "यहां",
  "yaha",
  "wahan",
  "वहां",
  "waha",
  "yahaan",
  "wahaan",
  "same",
  "wahi",
  "wahin",
  "yahi",
  "usi",
  "iske",
  "save",
  "sev",
  "kar",
  "karo",
  "karna",
  "de",
  "do",
  "lo",
  "le",
  "bata",
  "bol",
  "number",
  "naam",
  "address",
  "pata",
  "jagah",
]);

function isValidAddress(text) {
  if (!text || text.trim().length < 8) return false;
  const t = text.trim().toLowerCase();

  // Pure yes/no is not an address
  if (isAffirmative(t) || isNegative(t)) return false;

  // Sentence about saving/actions — not an address
  if (/\b(save|sev|store|record|likho|darz|register)\b/i.test(t)) return false;

  // Contains "number" alone is not an address
  if (/^\s*(phone|mobile|contact)?\s*(number|no|num)\s*$/i.test(t))
    return false;

  const tokens = t.split(/\s+/).filter((w) => w.length > 0);
  if (tokens.length < 2) return false;

  // Count tokens that are real address words (not noise, not generic-only, not pure digits)
  const meaningful = tokens.filter(
    (w) =>
      !IGNORE_WORDS.has(w) &&
      !GENERIC_ONLY_WORDS.has(w) &&
      w.length > 2 &&
      !/^\d{1,3}$/.test(w), // standalone 1-3 digit numbers are not address words
  );

  // Need at least 2 real address words (e.g. "Gandhi Nagar", "Sikar road workshop")
  return meaningful.length >= 2;
}

/* ======================= DETECTION FUNCTIONS ======================= */
function detectMachineType(text) {
  if (!text) return "Warranty";
  const t = text.toLowerCase();
  for (const [type, keywords] of Object.entries(machineTypeKeywords)) {
    if (keywords.some((k) => t.includes(k.toLowerCase()))) return type;
  }
  return "Warranty";
}

function detectMachineStatus(text) {
  if (!text) return "Running With Problem";
  const t = text.toLowerCase();
  if (
    machineStatusKeywords["Breakdown"].some((k) => t.includes(k.toLowerCase()))
  )
    return "Breakdown";
  return "Running With Problem";
}

function detectJobLocation(text) {
  if (!text) return null;
  const t = text.toLowerCase();
  if (jobLocationKeywords["Workshop"].some((k) => t.includes(k.toLowerCase())))
    return "Workshop";
  if (jobLocationKeywords["Onsite"].some((k) => t.includes(k.toLowerCase())))
    return "Onsite";
  return null;
}

function detectComplaint(text) {
  if (!text) return null;
  const t = text.toLowerCase();
  let bestMatch = null;
  let highestScore = 0;

  const sorted = Object.entries(complaintMap).sort(
    (a, b) => (b[1].priority || 0) - (a[1].priority || 0),
  );
  for (const [category, config] of sorted) {
    let score = 0;
    for (const kw of config.keywords) {
      if (t.includes(kw.toLowerCase())) score += kw.length;
    }
    if (score > highestScore) {
      highestScore = score;
      bestMatch = category;
    }
  }
  console.log(
    `🔍 Complaint Detection: "${text}" → ${bestMatch || "NONE"} (Score: ${highestScore})`,
  );
  return { complaint: bestMatch, score: highestScore };
}

/**
 * detectAllComplaints — returns EVERY category that scores ≥ minScore,
 * sorted highest score first. Skips "General Problem" if any specific
 * complaint was found (General only included when nothing else matches).
 */
function detectAllComplaints(text, minScore = 4) {
  if (!text) return [];
  const t = text.toLowerCase();
  const results = [];

  const sorted = Object.entries(complaintMap).sort(
    (a, b) => (b[1].priority || 0) - (a[1].priority || 0),
  );
  for (const [category, config] of sorted) {
    let score = 0;
    for (const kw of config.keywords) {
      if (t.includes(kw.toLowerCase())) score += kw.length;
    }
    if (score >= minScore) {
      const sub = detectSubComplaint(category, text);
      results.push({ complaint: category, score, subTitle: sub.subTitle });
    }
  }

  // Sort by score descending
  results.sort((a, b) => b.score - a.score);

  // If specific complaints found, drop "General Problem" (it's a catch-all)
  const specific = results.filter((r) => r.complaint !== "General Problem");
  const final = specific.length > 0 ? specific : results;

  console.log(
    `🔍 ALL Complaints detected (${final.length}): ${final.map((r) => `${r.complaint}[${r.score}]`).join(", ") || "NONE"}`,
  );
  return final;
}

function detectSubComplaint(mainComplaint, text) {
  if (!mainComplaint || !complaintMap[mainComplaint])
    return { subTitle: "Other", confidence: 0.5 };
  const subTitles = complaintMap[mainComplaint].subTitles;
  if (!subTitles || Object.keys(subTitles).length === 0)
    return { subTitle: "Other", confidence: 1.0 };

  const t = text.toLowerCase();
  let bestMatch = null;
  let highestScore = 0;

  for (const [subTitle, keywords] of Object.entries(subTitles)) {
    let score = 0;
    for (const kw of keywords) {
      if (t.includes(kw.toLowerCase())) score += kw.length;
    }
    if (score > highestScore) {
      highestScore = score;
      bestMatch = subTitle;
    }
  }
  const confidence = highestScore > 0 ? Math.min(highestScore / 15, 1) : 0.5;
  return { subTitle: bestMatch || "Other", confidence };
}

function detectBranchAndOutlet(city) {
  if (!city) return { branch: "NA", outlet: "NA", cityCode: "NA" };
  const normalized = city.toLowerCase().trim();
  // Try exact match first
  if (cityToBranchMap[normalized]) return cityToBranchMap[normalized];
  // Try partial match
  for (const [key, val] of Object.entries(cityToBranchMap)) {
    if (normalized.includes(key) || key.includes(normalized)) return val;
  }
  return { branch: "NA", outlet: "NA", cityCode: "NA" };
}

function formatDateForExternal(date) {
  if (!date || date === "NA") return null;
  if (typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date)) return date;
  const d = new Date(date);
  if (isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function extractServiceDate(text) {
  if (!text) return null;
  const t = text.toLowerCase();
  const today = new Date();
  if (/\b(आज|aaj|today)\b/i.test(t)) return today;
  if (/\b(कल|kal|tomorrow)\b/i.test(t)) {
    const d = new Date(today);
    d.setDate(d.getDate() + 1);
    return d;
  }
  if (/\b(परसों|parso|parson)\b/i.test(t)) {
    const d = new Date(today);
    d.setDate(d.getDate() + 2);
    return d;
  }
  const m = t.match(/\b(\d{1,2})\s*(तारीख)?\s*(को)?\b/i);
  if (m) {
    const n = parseInt(m[1]);
    if (n >= 1 && n <= 31) {
      const d = new Date(today);
      d.setDate(n);
      if (d < today) d.setMonth(d.getMonth() + 1);
      return d;
    }
  }
  return null;
}

/* ======================= TWIML HELPERS ======================= */
/**
 * askWithListening — main gather helper
 * maxSpeechTime: total max seconds customer can speak
 * timeout: seconds of silence before gather stops
 */
function askWithListening(twiml, text, options = {}) {
  const { maxSpeechTime = 60, timeout = 8, speechTimeout = "auto" } = options;

  const gather = twiml.gather({
    input: "speech dtmf",
    language: "hi-IN",
    speechTimeout,
    timeout,
    maxSpeechTime,
    actionOnEmptyResult: true,
    action: "/voice/process",
    method: "POST",
  });
  gather.say({ voice: "Polly.Aditi", language: "hi-IN" }, text);
}

function ask(twiml, text) {
  askWithListening(twiml, text, {
    maxSpeechTime: 60,
    timeout: 8,
    speechTimeout: "auto",
  });
}

/** ask_number — extended listening for digit input (handles gaps/pauses between digit groups) */
function askNumber(twiml, text) {
  askWithListening(twiml, text, {
    maxSpeechTime: 120, // 2 min total
    timeout: 12, // 12 sec silence = done speaking
    speechTimeout: "auto",
  });
}

/* ======================= SERVICE CENTER LOCATION MATCHING ======================= */
/**
 * matchServiceCenter — Fuzzy match customer speech against SERVICE_CENTERS database
 * Matches if:
 *   1. Exact match on city_name (case-insensitive)
 *   2. First 2+ letters match city_name
 *   Returns matched center or null
 */
/* ======================= LEVENSHTEIN DISTANCE ======================= */
function levenshtein(a, b) {
  const m = a.length,
    n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

function matchServiceCenter(speechInput) {
  if (!speechInput || speechInput.trim().length < 2) return null;

  const input = speechInput.trim().toLowerCase();
  const normalized = input.replace(/[।,!?;|]/g, " ").split(/\s+/);

  console.log(`   🔍 Matching service center for: "${speechInput}"`);
  console.log(`   📍 Tokens: [${normalized.join(", ")}]`);

  let bestMatch = null;
  let bestScore = 0;

  for (const token of normalized) {
    if (token.length < 2) continue;

    for (const center of SERVICE_CENTERS) {
      if (!center.is_active) continue;
      const centerName = center.city_name.toLowerCase();

      // 1. Exact match — return immediately
      if (centerName === token) {
        console.log(`   ✅ EXACT MATCH: "${token}" → ${center.city_name}`);
        return center;
      }

      // 2. Prefix match (existing logic)
      if (centerName.startsWith(token) && token.length >= 2) {
        const score = token.length / centerName.length;
        if (score > bestScore) {
          bestScore = score;
          bestMatch = center;
          console.log(
            `   ✓ Prefix match: "${token}" → ${center.city_name} (${(score * 100).toFixed(0)}%)`,
          );
        }
      }

      // 3. Levenshtein fuzzy match — handles ASR errors
      // e.g. "jaypur" → JAIPUR, "bilwada" → BHILWARA, "kotha" → KOTA
      if (token.length >= 3) {
        const dist = levenshtein(token, centerName);
        const maxLen = Math.max(token.length, centerName.length);
        const similarity = 1 - dist / maxLen;

        if (similarity >= 0.75 && similarity > bestScore) {
          bestScore = similarity;
          bestMatch = center;
          console.log(
            `   ✓ Fuzzy match: "${token}" → ${center.city_name} (${(similarity * 100).toFixed(0)}%)`,
          );
        }
      }
    }
  }

  if (bestMatch) {
    console.log(
      `   ✅ MATCHED: ${bestMatch.city_name} (Branch: ${bestMatch.branch_name}, Score: ${bestScore.toFixed(2)})`,
    );
  } else {
    console.log(`   ❌ NO MATCH found`);
  }

  return bestMatch;
}

/* ======================= CHASSIS NUMBER VALIDATION ======================= */
/**
 * isValidChassisFormat — machine numbers are 4–8 digit numeric strings
 */
function isValidChassisFormat(num) {
  if (!num) return false;
  const clean = num.replace(/\D/g, "");
  return /^\d{4,8}$/.test(clean);
}

async function validateChassisViaAPI(chassisNo) {
  try {
    console.log(`\n🔍 API VALIDATION: ${chassisNo}`);
    const apiUrl = `${EXTERNAL_API_BASE}/get_machine_by_machine_no.php?machine_no=${chassisNo}`;
    const response = await axios.get(apiUrl, {
      timeout: API_TIMEOUT,
      headers: API_HEADERS,
      validateStatus: (s) => s < 500,
    });
    if (
      response.status === 200 &&
      response.data?.status === 1 &&
      response.data?.data
    ) {
      const d = response.data.data;
      console.log(
        `   ✅ VALID — Customer: ${d.customer_name}, City: ${d.city}`,
      );
      return {
        valid: true,
        data: {
          name: d.customer_name || "Unknown",
          city: d.city || "Unknown",
          model: d.machine_model || "Unknown",
          machineNo: d.machine_no || chassisNo,
          phone: d.customer_phone_no || "Unknown",
          subModel: d.sub_model || "NA",
          machineType: d.machine_type || "Warranty",
          businessPartnerCode: d.business_partner_code || "NA",
          purchaseDate: d.purchase_date || "NA",
          installationDate: d.installation_date || "NA",
        },
      };
    }
    console.log(`   ⚠️ NOT FOUND`);
    return { valid: false, reason: "Not found in database" };
  } catch (e) {
    console.error(`   ❌ API ERROR: ${e.message}`);
    return { valid: false, reason: "API error", error: e.message };
  }
}

/* ======================= EXTERNAL API — SUBMIT COMPLAINT ======================= */
async function submitComplaintToExternal(complaintData) {
  try {
    // IMPORTANT: Only convert name fields (customer data from API is already ASCII).
    // DO NOT run convertHindiToEnglish on complaint_details or machine_location_address
    // — it corrupts Hindi speech to unreadable letter-by-letter transliteration
    // e.g. "हाइड्रोलिक" → "H ID R L K" which the API rejects.
    const sanitized = {
      ...complaintData,
      customer_name: safeAscii(complaintData.customer_name || ""),
      caller_name: safeAscii(complaintData.caller_name || ""),
      contact_person: safeAscii(complaintData.contact_person || ""),
      // complaint_details, machine_location_address, job_location → keep as-is
    };

    console.log("\n📤 SUBMITTING COMPLAINT:");
    console.log(JSON.stringify(sanitized, null, 2));

    const response = await axios.post(COMPLAINT_API_URL, sanitized, {
      timeout: API_TIMEOUT,
      headers: { "Content-Type": "application/json", ...API_HEADERS },
      validateStatus: (s) => s < 500,
    });

    if (
      response.status !== 200 ||
      !response.data ||
      response.data.status !== 1
    ) {
      console.log(
        "⚠️ API Rejected:",
        response.data?.message || "Unknown error",
      );
      return {
        success: false,
        error: response.data?.message || "API rejected",
      };
    }

    const sapId =
      response.data.data?.complaint_sap_id ||
      response.data.data?.sap_id ||
      null;
    console.log("✅ Submitted. SAP ID:", sapId);
    return { success: true, data: response.data, sapId };
  } catch (e) {
    console.error("❌ Submit Error:", e.message);
    return { success: false, error: e.message };
  }
}

async function saveComplaint(callData) {
  try {
    const customer = callData.customerData;
    const installDate =
      customer.installationDate && customer.installationDate !== "NA"
        ? formatDateForExternal(customer.installationDate)
        : null;

    // ── Use auto-fetched location data from SERVICE_CENTERS matching ──
    const branch = callData.branch || "NA";
    const outlet = callData.outlet || "NA";
    const city_id = callData.city_id || "NA";
    const lat = callData.lat || 0;
    const lng = callData.lng || 0;

    // ── Multi-complaint: join all titles & sub-titles for API ──
    const allComplaints = callData.allComplaints || [];
    const primaryComplaint = allComplaints[0] || {
      complaint: callData.complaintTitle || "General Problem",
      subTitle: callData.complaintSubTitle || "Other",
    };
    const allTitles =
      allComplaints.length > 1
        ? allComplaints.map((c) => c.complaint).join(" | ")
        : primaryComplaint.complaint;
    const allSubTitles =
      allComplaints.length > 1
        ? allComplaints.map((c) => c.subTitle).join(" | ")
        : primaryComplaint.subTitle;

    console.log(`📋 Complaint title(s) for API: "${allTitles}"`);
    console.log(`📋 Sub-title(s) for API:       "${allSubTitles}"`);
    console.log(
      `📍 Location: Branch=${branch}, Outlet=${outlet}, City_ID=${city_id}`,
    );
    console.log(
      `📍 Machine Location (customer's words): ${callData.machineLocation || "Not specified"}`,
    );

    const payload = {
      machine_no: callData.chassis || "Unknown",
      customer_name: safeAscii(customer.name),
      caller_name: customer.name || "Not Provided",
      caller_no: callData.callerPhone || customer.phone || "Unknown",
      contact_person: customer.name || "Customer",
      contact_person_number:
        callData.callerPhone || customer.phone || "Unknown",
      machine_model: customer.machineType || "Unknown",
      sub_model: customer.model || "NA",
      installation_date: installDate || "2025-01-01",
      machine_type: callData.machineType || "Warranty",
      city_id: city_id,
      complain_by: "Customer",
      machine_status: callData.machineStatus || "Running With Problem",
      job_location: callData.jobLocation || "Onsite",
      branch: branch,
      outlet: outlet,
      complaint_details: callData.rawComplaint || "Not provided",
      complaint_title: allTitles,
      sub_title: allSubTitles,
      business_partner_code: customer.businessPartnerCode || "NA",
      complaint_sap_id: "NA",
      machine_location_address: callData.engineerAddress || "Not Provided",
      pincode: callData.pincode || "0",
      service_date: callData.serviceDate
        ? formatDateForExternal(callData.serviceDate)
        : "",
      from_time: callData.fromTime || "",
      to_time: callData.toTime || "",
      job_open_lat: lat,
      job_open_lng: lng,
      job_close_lat: 0,
      job_close_lng: 0,
    };

    return await submitComplaintToExternal(payload);
  } catch (e) {
    console.error("❌ saveComplaint error:", e.message);
    return { success: false, error: e.message };
  }
}

/* =====================================================================
   ROUTES
   ===================================================================== */

/* ---------- ENTRY POINT ---------- */
router.post("/", async (req, res) => {
  const { CallSid, From } = req.body;
  const twiml = new VoiceResponse();

  activeCalls.set(CallSid, {
    callSid: CallSid,
    from: From,
    step: "ivr_menu",
    retries: 0,
    partialMachineNo: "", // accumulates digit groups for machine number
    partialPhoneNo: "", // accumulates digit groups for phone
    customerData: null,
  });

  const gather = twiml.gather({
    input: "dtmf",
    numDigits: 1,
    timeout: 6,
    action: "/voice/process",
    method: "POST",
  });
  gather.say(
    { voice: "Polly.Aditi", language: "hi-IN" },
    "Namaskar! Rajesh Motors mein aapka swagat hai. Complaint darz karne ke liye ek dabayein, agent se baat ke liye do dabayein.",
  );

  res.type("text/xml").send(twiml.toString());
});

/* ======================= MAIN PROCESS HANDLER ======================= */
router.post("/process", async (req, res) => {
  try {
    const twiml = new VoiceResponse();
    const { CallSid, Digits, SpeechResult } = req.body;

    let callData = activeCalls.get(CallSid);
    if (!callData) {
      callData = {
        callSid: CallSid,
        step: "ivr_menu",
        retries: 0,
        partialMachineNo: "",
        partialPhoneNo: "",
      };
      activeCalls.set(CallSid, callData);
    }

    // Silence / empty input — repeat last question
    if (!SpeechResult && !Digits) {
      callData.retries = (callData.retries || 0) + 1;
      const silenceMsg = handleSilenceOrEmpty(callData);
      ask(twiml, silenceMsg);
      activeCalls.set(CallSid, callData);
      return res.type("text/xml").send(twiml.toString());
    }

    const rawSpeech = cleanSpeech(SpeechResult || "");

    console.log(`\n${"═".repeat(70)}`);
    console.log(
      `📞 [${CallSid.substring(0, 10)}] STEP: ${callData.step} | RETRY: ${callData.retries}`,
    );
    console.log(`🎤 Speech: "${SpeechResult}"`);
    console.log(`🧹 Cleaned: "${rawSpeech}"`);
    console.log(`${"═".repeat(70)}`);

    /* ──────────────────────────────────────────────────────
       STEP 0: IVR MENU
    ────────────────────────────────────────────────────── */
    if (callData.step === "ivr_menu") {
      if (!Digits) {
        ask(
          twiml,
          "Bhai sahab, complaint ke liye ek dabayein, aur seedha baat karne ke liye do dabayein.",
        );
        activeCalls.set(CallSid, callData);
        return res.type("text/xml").send(twiml.toString());
      }
      if (Digits === "2") {
        twiml.say(
          { voice: "Polly.Aditi", language: "hi-IN" },
          "Ji bilkul. Hum aapko abhi humare sahayak se jod rahe hain. Thodi der ruke, aapka kaam zaroor hoga.",
        );
        twiml.dial(process.env.HUMAN_AGENT_NUMBER || "+919876543210");
        activeCalls.delete(CallSid);
        return res.type("text/xml").send(twiml.toString());
      }
      if (Digits === "1") {
        callData.step = "ask_machine_no";
        callData.retries = 0;
        callData.partialMachineNo = "";
        callData.lastQuestion =
          "Pehle machine ka number chahiye. ek ek digit boliye.";
        askNumber(twiml, callData.lastQuestion);
        activeCalls.set(CallSid, callData);
        return res.type("text/xml").send(twiml.toString());
      }
      ask(
        twiml,
        "Maafi chahta hoon, yeh number nahi mila. Complaint ke liye ek dabayein, baat ke liye do dabayein.",
      );
      activeCalls.set(CallSid, callData);
      return res.type("text/xml").send(twiml.toString());
    }

    /* ──────────────────────────────────────────────────────
       STEP 1: ASK MACHINE NUMBER
       Smart digit accumulation:
         • If customer speaks in groups (slow/pauses), accumulate across turns
         • If a validation just failed, FRESH START — don't blend old digits
         • If total digits > 8, try all sliding windows (rightmost first)
           before giving up — handles the "overflow + wrong combo" case
         • Total hard-retry limit = 4 across entire machine-no session
    ────────────────────────────────────────────────────── */
    if (callData.step === "ask_machine_no") {
      // ── Conversational Intelligence Handler ──
      const ci = handleConversationalIntent(rawSpeech, callData);
      if (ci.handled) {
        if (ci.intent !== INTENT.WAIT && ci.intent !== INTENT.CHECKING) {
          callData.retries = (callData.retries || 0) + 1;
        }
        askNumber(twiml, ci.response);
        activeCalls.set(CallSid, callData);
        return res.type("text/xml").send(twiml.toString());
      }
      // ── End CI Handler ──

      const newDigits = extractOnlyDigits(rawSpeech);
      console.log(`   🔢 New digits this turn: "${newDigits}"`);
      console.log(
        `   📦 Partial buffer: "${callData.partialMachineNo}" | FreshStart: ${!!callData.machineNoFreshStart}`,
      );

      // ── After a failed validation, the NEXT turn always starts a clean buffer ──
      if (callData.machineNoFreshStart) {
        callData.partialMachineNo = "";
        callData.machineNoFreshStart = false;
      }

      callData.partialMachineNo = (callData.partialMachineNo || "") + newDigits;
      const accumulated = callData.partialMachineNo;
      console.log(
        `   ➕ Total buffer: "${accumulated}" (${accumulated.length} digits)`,
      );

      /* ---- helper: try to validate one candidate, return result or null ---- */
      const tryCandidate = async (candidate) => {
        if (!/^\d{4,8}$/.test(candidate)) return null;
        const r = await validateChassisViaAPI(candidate);
        return r.valid ? r : null;
      };

      /* ---- build ordered candidate list from the accumulated digit string ---- */
      const buildCandidates = (buf) => {
        const seen = new Set();
        const list = [];
        const add = (s) => {
          if (s && !seen.has(s) && /^\d{4,8}$/.test(s)) {
            seen.add(s);
            list.push(s);
          }
        };

        // Exact match first (only when 4–8 digits)
        if (buf.length >= 4 && buf.length <= 8) add(buf);

        // Sliding windows: rightmost preferred (last spoken = most recent attempt)
        for (let len = Math.min(8, buf.length); len >= 4; len--) {
          add(buf.slice(-len)); // from right
          add(buf.slice(0, len)); // from left
          // middle windows
          for (let start = 1; start + len <= buf.length; start++) {
            add(buf.slice(start, start + len));
          }
        }
        return list;
      };

      // ── Not enough digits yet — ask for more ──────────────────────────────
      if (accumulated.length < 4) {
        if (accumulated.length === 0) {
          callData.retries = (callData.retries || 0) + 1;
          if (callData.retries >= 4) {
            twiml.say(
              { voice: "Polly.Aditi", language: "hi-IN" },
              "Number samajh nahi aaya. Agent se connect kar rahe hain.",
            );
            twiml.dial(process.env.HUMAN_AGENT_NUMBER || "+919876543210");
            activeCalls.delete(CallSid);
            return res.type("text/xml").send(twiml.toString());
          }
          const noDigitHints = [
            "Machine par likha number ek ek digit mein boliye.",
            "Jaise — teen, paanch, do, saat. Aaram se boliye.",
            "Bill ya kagaz mein dekh ke boliye, main sun raha hoon.",
          ];
          callData.lastQuestion =
            noDigitHints[Math.min(callData.retries - 1, 2)];
          askNumber(twiml, callData.lastQuestion);
          activeCalls.set(CallSid, callData);
          return res.type("text/xml").send(twiml.toString());
        }
        // Some digits received, not enough — ask for rest without resetting buffer
        console.log(
          `   ⏳ Only ${accumulated.length} digit(s) — waiting for more`,
        );
        callData.lastQuestion = `${accumulated.split("").join(" ")} aaya. Ab baaki digits boliye.`;
        askNumber(twiml, callData.lastQuestion);
        activeCalls.set(CallSid, callData);
        return res.type("text/xml").send(twiml.toString());
      }

      // ── We have ≥ 4 digits — try all candidates ───────────────────────────
      const candidates = buildCandidates(accumulated);
      console.log(
        `   🔍 Trying ${candidates.length} candidate(s): [${candidates.slice(0, 6).join(", ")}${candidates.length > 6 ? "..." : ""}]`,
      );

      let validResult = null;
      let matchedCandidate = null;
      for (const candidate of candidates) {
        const r = await tryCandidate(candidate);
        if (r) {
          validResult = r;
          matchedCandidate = candidate;
          break;
        }
      }

      if (validResult) {
        // ✅ FOUND
        console.log(`   ✅ MATCHED on candidate: "${matchedCandidate}"`);
        callData.chassis = matchedCandidate;
        callData.partialMachineNo = "";
        callData.machineNoFreshStart = false;
        callData.customerData = validResult.data;
        callData.step = "confirm_customer";
        callData.retries = 0;
        const readable = matchedCandidate.split("").join(" ");
        callData.lastQuestion = `${validResult.data.name} ji, ${validResult.data.city} — kya yeh aapki machine hai?`;
        ask(twiml, callData.lastQuestion);
        activeCalls.set(CallSid, callData);
        return res.type("text/xml").send(twiml.toString());
      }

      // ── None of the candidates matched ────────────────────────────────────
      callData.retries = (callData.retries || 0) + 1;
      console.log(
        `   ❌ No match in ${candidates.length} candidates — Retry ${callData.retries}/4`,
      );

      if (callData.retries >= 4) {
        twiml.say(
          { voice: "Polly.Aditi", language: "hi-IN" },
          "Machine ka record nahi mila. Agent se connect kar rahe hain.",
        );
        twiml.dial(process.env.HUMAN_AGENT_NUMBER || "+919876543210");
        activeCalls.delete(CallSid);
        return res.type("text/xml").send(twiml.toString());
      }

      // Reset buffer; next turn will start fresh (flag set here, cleared at top of next turn)
      const triedDisplay = candidates[0]
        ? candidates[0].split("").join(" ")
        : accumulated.split("").join(" ");
      callData.partialMachineNo = "";
      callData.machineNoFreshStart = true; // ← key flag: don't blend next turn's digits with old buffer

      const retryMessages = [
        `${triedDisplay} record mein nahi mila. Dobara ek ek digit boliye.`,
        `Abhi bhi match nahi hua, dhire clearly boliye.`,
        `Ek baar aur boliye — main dhyan se sun raha hoon.`,
      ];
      callData.lastQuestion = retryMessages[Math.min(callData.retries - 1, 2)];
      askNumber(twiml, callData.lastQuestion);
      activeCalls.set(CallSid, callData);
      return res.type("text/xml").send(twiml.toString());
    }

    /* ──────────────────────────────────────────────────────
       STEP 2: CONFIRM CUSTOMER
       Bug fix: "आप मेरी मशीन है?" is a QUESTION (unclear), not negative.
       Only go back to machine number on clear "nahi". Ambiguous → re-ask once,
       then proceed to ask_city after 2 retries (don't loop forever).
    ────────────────────────────────────────────────────── */
    if (callData.step === "confirm_customer") {
      // ── Conversational Intelligence Handler ──
      const ci = handleConversationalIntent(rawSpeech, callData);
      if (ci.handled) {
        if (ci.intent !== INTENT.WAIT && ci.intent !== INTENT.CHECKING) {
          callData.retries = (callData.retries || 0) + 1;
        }
        ask(twiml, ci.response);
        activeCalls.set(CallSid, callData);
        return res.type("text/xml").send(twiml.toString());
      }
      // ── End CI Handler ──

      const name = callData.customerData?.name || "";
      const city = callData.customerData?.city || "";

      if (isAffirmative(rawSpeech)) {
        callData.step = "ask_city";
        callData.retries = 0;
        callData.lastQuestion = `Achha thik hai! Machine kahan par hai abhi? `;
        ask(twiml, callData.lastQuestion);
        activeCalls.set(CallSid, callData);
        return res.type("text/xml").send(twiml.toString());
      }

      if (isNegative(rawSpeech)) {
        callData.step = "ask_machine_no";
        callData.retries = 0;
        callData.partialMachineNo = "";
        callData.machineNoFreshStart = true;
        callData.lastQuestion =
          "Theek hai, sahi number dobara boliye.";
        askNumber(twiml, callData.lastQuestion);
        activeCalls.set(CallSid, callData);
        return res.type("text/xml").send(twiml.toString());
      }

      // Ambiguous (e.g. "आप मेरी मशीन है?" — question-form, not yes/no)
      callData.retries = (callData.retries || 0) + 1;
      if (callData.retries >= 2) {
        // Assume correct and move on — don't keep customer waiting
        callData.step = "ask_city";
        callData.retries = 0;
        callData.lastQuestion = `Theek hai ji. Aapki machine abhi kis shehar mein hai?`;
        ask(twiml, callData.lastQuestion);
        activeCalls.set(CallSid, callData);
        return res.type("text/xml").send(twiml.toString());
      }
      callData.lastQuestion = `${callData.customerData?.name || "Customer"} ji, ${callData.city || callData.customerData?.city || "location"} — kya yeh aapki machine hai?`;
      ask(twiml, callData.lastQuestion);
      activeCalls.set(CallSid, callData);
      return res.type("text/xml").send(twiml.toString());
    }

    /* ──────────────────────────────────────────────────────
       STEP 3: ASK CITY (machine location city)
       Now also tries fuzzy matching against SERVICE_CENTERS.
       If match found → auto-populate location data and skip to phone.
    ────────────────────────────────────────────────────── */
    if (callData.step === "ask_city") {
      // ── Conversational Intelligence Handler ──
      const ci = handleConversationalIntent(rawSpeech, callData);
      if (ci.handled) {
        if (ci.intent !== INTENT.WAIT && ci.intent !== INTENT.CHECKING) {
          callData.retries = (callData.retries || 0) + 1;
        }
        ask(twiml, ci.response);
        activeCalls.set(CallSid, callData);
        return res.type("text/xml").send(twiml.toString());
      }
      // ── End CI Handler ──

      if (rejectInvalid(rawSpeech)) {
        callData.retries = (callData.retries || 0) + 1;
        if (callData.retries >= 3) {
          // Fallback to customer's API city if available
          callData.machineLocation = callData.customerData?.city || "Not Provided";
          callData.city = extractCityName(callData.machineLocation);
          callData.step = "ask_engineer_location";
          callData.retries = 0;
          callData.lastQuestion =
            "Theek hai. Engineer kahan se bhejein — kaunsa shehar?";
          ask(twiml, callData.lastQuestion);
          activeCalls.set(CallSid, callData);
          return res.type("text/xml").send(twiml.toString());
        }
        ask(
          twiml,
          "Shehar ka naam boliye — Jaipur, Kota, Ajmer, Alwar, jahan bhi ho.",
        );
        activeCalls.set(CallSid, callData);
        return res.type("text/xml").send(twiml.toString());
      }

      // ✅ Accept any valid input — store as-is, will match in ask_engineer_location
      callData.machineLocation = rawSpeech.trim();
      callData.city = extractCityName(rawSpeech);
      callData.step = "ask_engineer_location";
      callData.retries = 0;
      callData.lastQuestion =
        "Engineer kahan se bhejein — kaunsa branch? Jaipur, Kota, Ajmer, Alwar, Sikar, Udaipur.";
      ask(twiml, callData.lastQuestion);
      activeCalls.set(CallSid, callData);
      return res.type("text/xml").send(twiml.toString());
    }

    /* ──────────────────────────────────────────────────────
       STEP 4: ASK ENGINEER BASE / ADDRESS
       Fuzzy match against SERVICE_CENTERS database.
       Auto-populate: branch, outlet, city_id, lat, lng, address
       No confirmation — match is final.
    ────────────────────────────────────────────────────── */
    if (callData.step === "ask_engineer_location") {
      // ── Conversational Intelligence Handler ──
      const ci = handleConversationalIntent(rawSpeech, callData);
      if (ci.handled) {
        if (ci.intent !== INTENT.WAIT && ci.intent !== INTENT.CHECKING) {
          callData.retries = (callData.retries || 0) + 1;
        }
        ask(twiml, ci.response);
        activeCalls.set(CallSid, callData);
        return res.type("text/xml").send(twiml.toString());
      }
      // ── End CI Handler ──

      // Handle pause requests — don't count against retries
      const isPauseRequest = pauseKeywords.some((k) => rawSpeech.toLowerCase().includes(k));
      if (isPauseRequest) {
        ask(twiml, "Bilkul, main sun raha hoon. Jab ready ho jayen, tab shehar ka naam boliye.");
        activeCalls.set(CallSid, callData);
        return res.type("text/xml").send(twiml.toString());
      }

      // Only reject pure silence/noise
      const isEmpty = !rawSpeech || rawSpeech.trim().length < 3;
      const isPureNoise =
        isEmpty ||
        isUncertain(rawSpeech) ||
        pauseKeywords.some((k) => rawSpeech.toLowerCase().includes(k));

      if (isPureNoise) {
        callData.retries = (callData.retries || 0) + 1;
        if (callData.retries >= 3) {
          // Give up — use machineLocation as fallback
          callData.engineerAddress = callData.machineLocation || callData.city || "Not Provided";
          callData.jobLocation = "Onsite";
          callData.branch = "NA";
          callData.outlet = "NA";
          callData.city_id = "NA";
          callData.lat = 0;
          callData.lng = 0;
          callData.sc_id = null;
          callData.step = "ask_phone";
          callData.retries = 0;
          callData.lastQuestion = _buildPhoneQuestion(callData);
          askNumber(twiml, callData.lastQuestion);
          activeCalls.set(CallSid, callData);
          return res.type("text/xml").send(twiml.toString());
        }
        ask(
          twiml,
          "Engineer kis jagah se aayenge — Jaipur, Kota, Ajmer, Alwar ?",
        );
        activeCalls.set(CallSid, callData);
        return res.type("text/xml").send(twiml.toString());
      }

      // Fuzzy match against SERVICE_CENTERS
      const matchedCenter = matchServiceCenter(rawSpeech);

      if (matchedCenter) {
        // ✅ MATCHED — Auto-populate all location data
        console.log(`   ✅ Service center matched: ${matchedCenter.city_name}`);
        callData.engineerAddress = matchedCenter.city_add;
        callData.branch = matchedCenter.branch_name;
        callData.outlet = matchedCenter.city_name;
        callData.city_id = matchedCenter.branch_code;
        callData.lat = matchedCenter.lat;
        callData.lng = matchedCenter.lng;
        callData.sc_id = matchedCenter.id;
        callData.jobLocation = detectJobLocation(rawSpeech) || "Workshop";
        callData.retries = 0;

        console.log(
          `   📍 Populated: Branch=${callData.branch}, Outlet=${callData.outlet}, City_ID=${callData.city_id}`,
        );

        // Move to next step – NO CONFIRMATION
        callData.step = "ask_phone";
        callData.lastQuestion = _buildPhoneQuestion(callData);
        askNumber(twiml, callData.lastQuestion);
        activeCalls.set(CallSid, callData);
        return res.type("text/xml").send(twiml.toString());
      }

      // ❌ NO MATCH — Use customer's custom input as address
      console.log(`   ⚠️ No service center matched — accepting custom address`);
      callData.engineerAddress = rawSpeech.trim();
      callData.jobLocation = detectJobLocation(rawSpeech) || "Onsite";
      callData.branch = "NA";
      callData.outlet = "NA";
      callData.city_id = "NA";
      callData.lat = 0;
      callData.lng = 0;
      callData.sc_id = null;
      callData.retries = 0;

      // Move to next step — NO CONFIRMATION
      callData.step = "ask_phone";
      callData.lastQuestion = _buildPhoneQuestion(callData);
      askNumber(twiml, callData.lastQuestion);
      activeCalls.set(CallSid, callData);
      return res.type("text/xml").send(twiml.toString());
    }

    /* ──────────────────────────────────────────────────────
       STEP 5: ASK / CONFIRM PHONE NUMBER
       Smart handling:
         • If API has a phone on file → read it back, ask confirm
         • "save kar lo / haan / sahi hai" → accept existing number
         • "nahi" on known phone → ask new number
         • Digit accumulation with fresh-start after confirm-no
         • If customer says "save" / "wahi" / "sahi" → treat as affirmative
    ────────────────────────────────────────────────────── */
    if (callData.step === "ask_phone") {
      // ── Conversational Intelligence Handler ──
      const ci = handleConversationalIntent(rawSpeech, callData);
      if (ci.handled) {
        if (ci.intent !== INTENT.WAIT && ci.intent !== INTENT.CHECKING) {
          callData.retries = (callData.retries || 0) + 1;
        }
        askNumber(twiml, ci.response);
        activeCalls.set(CallSid, callData);
        return res.type("text/xml").send(twiml.toString());
      }
      // ── End CI Handler ──

      const knownPhone = callData.customerData?.phone || "";

      // Detect "save/wahi/sahi/use this" intent — treat as confirming existing number
      const isSaveIntent =
        /\b(save|sev|wahi|wahin|usi|same|sahi|theek|haan|use|rakh|rakho|yahi|isko)\b/i.test(
          rawSpeech,
        ) && !/^\d/.test(rawSpeech.trim());

      // If customer confirms existing number (affirmative OR save-intent)
      if (
        (isAffirmative(rawSpeech) || isSaveIntent) &&
        knownPhone &&
        knownPhone !== "Unknown" &&
        callData.partialPhoneNo === ""
      ) {
        callData.callerPhone = knownPhone;
        callData.partialPhoneNo = "";
        callData.step = "ask_complaint";
        callData.retries = 0;
        callData.lastQuestion =
          "Achha ab btayein! Machine mein kya taklif hai?";
        ask(twiml, callData.lastQuestion);
        activeCalls.set(CallSid, callData);
        return res.type("text/xml").send(twiml.toString());
      }

      // Customer rejects known phone with no digits — collect new number
      if (isNegative(rawSpeech) && knownPhone && knownPhone !== "Unknown") {
        // FIX: Clear buffer regardless of current partial state
        // Previously only cleared when partialPhoneNo === "" which missed mid-entry rejections
        callData.partialPhoneNo = "";
        callData.retries = 0;
        callData.lastQuestion =
          "Theek hai ji. Apna sahi phone number boliye.";
        askNumber(twiml, callData.lastQuestion);
        activeCalls.set(CallSid, callData);
        return res.type("text/xml").send(twiml.toString());
      }

      // Extract phone digits (noise-filtered)
      const phoneDigits = extractPhoneDigits(rawSpeech);
      console.log(
        `   📱 Extracted phone digits: "${phoneDigits}" | Buffer: "${callData.partialPhoneNo}"`,
      );

      callData.partialPhoneNo = (callData.partialPhoneNo || "") + phoneDigits;
      const accumulated = callData.partialPhoneNo;
      console.log(
        `   ➕ Total phone: "${accumulated}" (${accumulated.length} digits)`,
      );

      // Accept 9-12 digits (handles slight ASR overshoot), slice to 10
      if (accumulated.length >= 9 && accumulated.length <= 12) {
        const phone = accumulated.length === 10 ? accumulated : accumulated.slice(-10);
        callData.callerPhone = phone;
        callData.partialPhoneNo = "";
        
        // Check if customer confirmed number in same breath (e.g. "9602031359 haan")
        const hasConfirmation = isAffirmative(rawSpeech.replace(/\d/g, "").trim());
        if (hasConfirmation) {
          // Skip confirm step — take number as-is
          callData.step = "ask_complaint";
          callData.retries = 0;
          callData.lastQuestion =
            "Achha btayein ! Machine mein kya taklif hai?";
          ask(twiml, callData.lastQuestion);
          activeCalls.set(CallSid, callData);
          return res.type("text/xml").send(twiml.toString());
        }
        
        // Ask for confirmation with grouped display
        callData.step = "confirm_phone";
        callData.retries = 0;
        const readable = `${phone.slice(0, 5)} ${phone.slice(5)}`;
        callData.lastQuestion = `${readable} — sahi hai?`;
        ask(twiml, callData.lastQuestion);
        activeCalls.set(CallSid, callData);
        return res.type("text/xml").send(twiml.toString());
      }

      if (accumulated.length > 0 && accumulated.length < 9) {
        const readable = accumulated.split("").join(" ");
        callData.lastQuestion = `${readable} aaya — baaki boliye.`;
        askNumber(twiml, callData.lastQuestion);
        activeCalls.set(CallSid, callData);
        return res.type("text/xml").send(twiml.toString());
      }

      // No usable digits
      callData.retries = (callData.retries || 0) + 1;
      if (callData.retries >= 4) {
        callData.callerPhone = knownPhone || "Unknown";
        callData.partialPhoneNo = "";
        callData.step = "ask_complaint";
        callData.retries = 0;
        callData.lastQuestion =
          "Theek hai. Ab machine ki taklif batayein.";
        ask(twiml, callData.lastQuestion);
        activeCalls.set(CallSid, callData);
        return res.type("text/xml").send(twiml.toString());
      }
      callData.lastQuestion =
        knownPhone && knownPhone !== "Unknown"
          ? `Humhare paas number ${knownPhone.split("").join(" ")} hai. Kya yeh sahi hai?`
          : "Apna mobile number boliye, ek ek digit mein.";
      askNumber(twiml, callData.lastQuestion);
      activeCalls.set(CallSid, callData);
      return res.type("text/xml").send(twiml.toString());
    }

    /* ──────────────────────────────────────────────────────
       STEP 5b: CONFIRM PHONE
    ────────────────────────────────────────────────────── */
    if (callData.step === "confirm_phone") {
      // ── Conversational Intelligence Handler ──
      const ci = handleConversationalIntent(rawSpeech, callData);
      if (ci.handled) {
        if (ci.intent !== INTENT.WAIT && ci.intent !== INTENT.CHECKING) {
          callData.retries = (callData.retries || 0) + 1;
        }
        ask(twiml, ci.response);
        activeCalls.set(CallSid, callData);
        return res.type("text/xml").send(twiml.toString());
      }
      // ── End CI Handler ──

      if (isAffirmative(rawSpeech)) {
        callData.step = "ask_complaint";
        callData.retries = 0;
        callData.lastQuestion =
          "Achha ji! Machine mein kya taklif hai? Engine, brake, hydraulic, AC — jo bhi problem ho, batayein.";
        ask(twiml, callData.lastQuestion);
        activeCalls.set(CallSid, callData);
        return res.type("text/xml").send(twiml.toString());
      }
      if (isNegative(rawSpeech)) {
        callData.partialPhoneNo = "";
        callData.step = "ask_phone";
        callData.retries = 0;
        callData.lastQuestion =
          "Theek hai, dobara boliye.";
        askNumber(twiml, callData.lastQuestion);
        activeCalls.set(CallSid, callData);
        return res.type("text/xml").send(twiml.toString());
      }
      callData.retries = (callData.retries || 0) + 1;
      if (callData.retries >= 3) {
        callData.step = "ask_complaint";
        callData.retries = 0;
        callData.lastQuestion =
          "Theek hai ji. Ab batayein — machine mein kya problem hai?";
        ask(twiml, callData.lastQuestion);
        activeCalls.set(CallSid, callData);
        return res.type("text/xml").send(twiml.toString());
      }
      ask(
        twiml,
        "Bhai sahab, bas haan ya nahi boliye — number sahi hai ki nahi?",
      );
      activeCalls.set(CallSid, callData);
      return res.type("text/xml").send(twiml.toString());
    }

    /* ──────────────────────────────────────────────────────
       STEP 6: ASK COMPLAINT
       • Detects ALL complaints mentioned (not just top one)
       • Accumulates across multiple turns if customer adds more
       • Stores array: callData.allComplaints = [{complaint, subTitle, score}]
       • Also appends if customer says "aur bhi" on re-ask
    ────────────────────────────────────────────────────── */
    if (callData.step === "ask_complaint") {
      // ── Conversational Intelligence Handler ──
      const ci = handleConversationalIntent(rawSpeech, callData);
      if (ci.handled && !ci.isComplaintDone) {
        if (ci.intent !== INTENT.WAIT && ci.intent !== INTENT.CHECKING) {
          callData.retries = (callData.retries || 0) + 1;
        }
        ask(twiml, ci.response);
        activeCalls.set(CallSid, callData);
        return res.type("text/xml").send(twiml.toString());
      }
      // ── End CI Handler ──
      // NOTE: if ci.isComplaintDone === true, fall through to normal logic

      if (rejectInvalid(rawSpeech)) {
        callData.retries = (callData.retries || 0) + 1;
        if (callData.retries >= 5) {
          twiml.say(
            { voice: "Polly.Aditi", language: "hi-IN" },
            "Bhai sahab, aawaz thodi saaf nahi aayi. Koi baat nahi, hum aapko hamare sahayak se jod dete hain. Woh aapki poori madad karenge.",
          );
          twiml.dial(process.env.HUMAN_AGENT_NUMBER || "+919876543210");
          activeCalls.delete(CallSid);
          return res.type("text/xml").send(twiml.toString());
        }
        const nudges = [
          "Machine mein kya taklif hai? Engine, brake, hydraulic, AC — jo bhi problem ho, batayein.",
          "Zara detail mein batayein — machine kya kar rahi hai?",
          "Chalu nahi ho rahi? Awaaz aa rahi? Koi aur dikkat?",
          "Kaunsa hissa theek nahi hai?",
        ];
        ask(twiml, nudges[Math.min(callData.retries - 1, nudges.length - 1)]);
        activeCalls.set(CallSid, callData);
        return res.type("text/xml").send(twiml.toString());
      }

      // Save / append raw complaint text
      callData.rawComplaint =
        (callData.rawComplaint ? callData.rawComplaint + " | " : "") +
        rawSpeech;
      callData.machineStatus = detectMachineStatus(callData.rawComplaint);
      callData.machineType = detectMachineType(callData.rawComplaint);

      // Capture job location if mentioned
      const locInComplaint = detectJobLocation(rawSpeech);
      if (locInComplaint && !callData.jobLocation)
        callData.jobLocation = locInComplaint;

      // Detect ALL complaints in cumulative text
      const allDetected = detectAllComplaints(callData.rawComplaint);
      console.log(`   📋 Total complaints so far: ${allDetected.length}`);

      if (allDetected.length === 0) {
        callData.retries = (callData.retries || 0) + 1;
        if (callData.retries >= 4) {
          // Fallback: save as General
          callData.allComplaints = [
            { complaint: "General Problem", subTitle: "Other", score: 0 },
          ];
          callData.complaintTitle = "General Problem";
          callData.complaintSubTitle = "Other";
          callData.step = "final_confirmation";
          callData.retries = 0;
          callData.lastQuestion = _buildSummary(callData);
          ask(twiml, callData.lastQuestion);
          activeCalls.set(CallSid, callData);
          return res.type("text/xml").send(twiml.toString());
        }
        callData.lastQuestion =
          "Kaunsa hissa theek nahi hai?";
        ask(twiml, callData.lastQuestion);
        activeCalls.set(CallSid, callData);
        return res.type("text/xml").send(twiml.toString());
      }

      // Store all detected complaints
      callData.allComplaints = allDetected;
      callData.complaintTitle = allDetected[0].complaint;
      callData.complaintSubTitle = allDetected[0].subTitle;
      callData.retries = 0;
      callData.step = "final_confirmation";

      // Go directly to final confirmation and submit — skip re-confirmation
      console.log(
        `   ✅ Detected ${allDetected.length} complaint(s) — proceeding to submit`,
      );
      callData.lastQuestion = _buildSummary(callData);
      ask(twiml, callData.lastQuestion);
      activeCalls.set(CallSid, callData);
      return res.type("text/xml").send(twiml.toString());
    }

    /* ──────────────────────────────────────────────────────
       STEP 7: FINAL CONFIRMATION (SKIPPED confirm_complaint)
       Removed re-confirmation step. Customer's first answer is final.
       Now just auto-processes and submits.
    ────────────────────────────────────────────────────── */

    /* ──────────────────────────────────────────────────────
       STEP 8: AUTO-SUBMIT (No re-confirmation)
       After detecting complaints, directly submit without asking Y/N
    ────────────────────────────────────────────────────── */
    if (callData.step === "final_confirmation") {
      // Any input triggers immediate submission — customer's first data is final
      console.log(`   📤 Proceeding with auto-submit on input: "${rawSpeech}"`);
      await _submitAndClose(twiml, callData, CallSid);
      return res.type("text/xml").send(twiml.toString());
    }

    // Fallback
    activeCalls.set(CallSid, callData);
    res.type("text/xml").send(twiml.toString());
  } catch (error) {
    console.error("❌ FATAL Error:", error);
    const twiml = new VoiceResponse();
    twiml.say(
      { voice: "Polly.Aditi", language: "hi-IN" },
      "Thodi technical dikkat aa gayi. Agent se connect kar rahe hain.",
    );
    twiml.dial(process.env.HUMAN_AGENT_NUMBER || "+919876543210");
    return res.type("text/xml").send(twiml.toString());
  }
});

/* ======================= HELPER: Build phone question ======================= */
function _buildPhoneQuestion(callData) {
  const knownPhone = callData.customerData?.phone;
  if (knownPhone && knownPhone !== "Unknown") {
    const readable = knownPhone.split("").join(" ");
    return `Humhare paas number ${readable} hai. Kya yeh sahi hai?`;
  }
  return "Apna mobile number boliye, ek ek digit mein.";
}

/**
 * _buildComplaintReadback — human-friendly natural readback of all complaints
 * e.g. ["Engine", "Braking System"] → "Engine aur Braking System"
 *      ["Engine", "Hydraulic System", "Noise"] → "Engine, Hydraulic System, aur Noise"
 */
function _buildComplaintReadback(complaints) {
  if (!complaints || complaints.length === 0) return "General Problem";

  // Build list with sub-title context
  const parts = complaints.map((c) => {
    if (c.subTitle && c.subTitle !== "Other")
      return `${c.complaint} (${c.subTitle})`;
    return c.complaint;
  });

  if (parts.length === 1) return parts[0];
  if (parts.length === 2) return `${parts[0]} aur ${parts[1]}`;
  return `${parts.slice(0, -1).join(", ")}, aur ${parts[parts.length - 1]}`;
}

/* ======================= HELPER: Build summary for final confirmation ======================= */
function _buildSummary(callData) {
  const name = callData.customerData?.name || "Unknown";
  const chassis = callData.chassis || "N/A";
  const city = callData.city || callData.customerData?.city || "N/A";
  const location = callData.engineerAddress || "Not provided";
  const phone = callData.callerPhone || callData.customerData?.phone || "N/A";

  // Multi-complaint readback
  const complaints = callData.allComplaints || [];

  const chassisReadable =
    chassis !== "N/A" ? chassis.split("").join(" ") : chassis;
  const phoneReadable = phone !== "N/A" ? phone.split("").join(" ") : phone;

  // Use customer's own words for complaint instead of category names
  const complaintText = callData.rawComplaint
    ? callData.rawComplaint
        .replace(/\s*\|\s*/g, ", ") // replace pipe separators with commas
        .substring(0, 150) // limit to 150 chars
    : _buildComplaintReadback(complaints);

  return `Ek baar confirm karta hoon — ${name}, machine ${chassisReadable}, ${city}, phone ${phoneReadable}, taklif: ${complaintText}. Sab sahi hai?`;
}

/* ======================= HELPER: Submit and close call ======================= */
async function _submitAndClose(twiml, callData, CallSid) {
  const allComplaints = callData.allComplaints || [];
  const complaintsLog =
    allComplaints.length > 0
      ? allComplaints.map((c) => `${c.complaint} (${c.subTitle})`).join(" | ")
      : `${callData.complaintTitle} — ${callData.complaintSubTitle}`;

  console.log("\n" + "=".repeat(70));
  console.log("📤 SUBMITTING COMPLAINT");
  console.log("=".repeat(70));
  console.log(`  Chassis:    ${callData.chassis}`);
  console.log(`  Customer:   ${callData.customerData?.name}`);
  console.log(`  Phone:      ${callData.callerPhone}`);
  console.log(`  City:       ${callData.city}`);
  console.log(`  Address:    ${callData.engineerAddress}`);
  console.log(`  Complaints: ${complaintsLog}`);
  console.log(`  Count:      ${allComplaints.length} problem(s)`);
  console.log(`  Status:     ${callData.machineStatus}`);
  console.log("=".repeat(70) + "\n");

  const result = await saveComplaint(callData);

  if (result.success && result.sapId) {
    twiml.say(
      { voice: "Polly.Aditi", language: "hi-IN" },
      `Complaint darz ho gayi. Number hai ${result.sapId.toString().split("").join(" ")} — note kar lijiye. Engineer jald call karenge. Namaskar!`,
    );
  } else {
    twiml.say(
      { voice: "Polly.Aditi", language: "hi-IN" },
      `Complaint mil gayi. Team jald aapko call karegi. Namaskar!`,
    );
  }

  twiml.hangup();
  activeCalls.delete(CallSid);
}

export default router;
