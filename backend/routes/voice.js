import express from "express";
import twilio from "twilio";
import axios from "axios";

import CallSession from "../models/CallSession.js";
import Customer from "../models/Customer.js";
import Complaint from "../models/Complaint.js";
import complaintMap from "../utils/complaintClassifier.js";

const router = express.Router();
const VoiceResponse = twilio.twiml.VoiceResponse;

/* =======================
   EXTERNAL API CONFIG
======================= */
const EXTERNAL_API_BASE = "http://gprs.rajeshmotors.com/jcbServiceEnginerAPIv7";
const COMPLAINT_API_URL =
  "http://gprs.rajeshmotors.com/jcbServiceEnginerAPIv7/ai_call_complaint.php";
const API_TIMEOUT = 20000;
const API_HEADERS = {
  JCBSERVICEAPI: "MakeInJcb",
};

/* =======================
   BRANCH, OUTLET & CITY CODE MAPPING
======================= */
const cityToBranchMap = {
  // AJMER Branch (Code: 1)
  ajmer: { branch: "AJMER", outlet: "AJMER", cityCode: "1" },
  kekri: { branch: "AJMER", outlet: "KEKRI", cityCode: "1" },

  // ALWAR Branch (Code: 2)
  alwar: { branch: "ALWAR", outlet: "ALWAR", cityCode: "2" },
  bharatpur: { branch: "ALWAR", outlet: "BHARATPUR", cityCode: "2" },
  bhiwadi: { branch: "ALWAR", outlet: "BHIWADI", cityCode: "2" },
  dholpur: { branch: "ALWAR", outlet: "DHOLPUR", cityCode: "2" },

  // BHILWARA Branch (Code: 3)
  bhilwara: { branch: "BHILWARA", outlet: "BHILWARA", cityCode: "3" },
  nimbahera: { branch: "BHILWARA", outlet: "NIMBAHERA", cityCode: "3" },
  pratapgarh: { branch: "BHILWARA", outlet: "PRATAPGARH", cityCode: "3" },

  // JAIPUR Branch (Code: 4)
  dausa: { branch: "JAIPUR", outlet: "DAUSA", cityCode: "4" },
  "goner road": { branch: "JAIPUR", outlet: "GONER ROAD", cityCode: "4" },
  jaipur: { branch: "JAIPUR", outlet: "JAIPUR", cityCode: "4" },
  karauli: { branch: "JAIPUR", outlet: "KARAULI", cityCode: "4" },
  karoli: { branch: "JAIPUR", outlet: "KARAULI", cityCode: "4" },
  kotputli: { branch: "JAIPUR", outlet: "KOTPUTLI", cityCode: "4" },
  "neem ka thana": { branch: "JAIPUR", outlet: "NEEM KA THANA", cityCode: "4" },
  tonk: { branch: "JAIPUR", outlet: "TONK", cityCode: "4" },
  vkia: { branch: "JAIPUR", outlet: "VKIA", cityCode: "4" },

  // KOTA Branch (Code: 5)
  jhalawar: { branch: "KOTA", outlet: "JHALAWAR", cityCode: "5" },
  kota: { branch: "KOTA", outlet: "KOTA", cityCode: "5" },
  ramganjmandi: { branch: "KOTA", outlet: "RAMGANJMANDI", cityCode: "5" },

  // SIKAR Branch (Code: 6)
  jhunjhunu: { branch: "SIKAR", outlet: "JHUNJHUNU", cityCode: "6" },
  sikar: { branch: "SIKAR", outlet: "SIKAR", cityCode: "6" },
  sujangarh: { branch: "SIKAR", outlet: "SUJANGARH", cityCode: "6" },

  // UDAIPUR Branch (Code: 7)
  banswara: { branch: "UDAIPUR", outlet: "BANSWARA", cityCode: "7" },
  dungarpur: { branch: "UDAIPUR", outlet: "DUNGARPUR", cityCode: "7" },
  rajsamand: { branch: "UDAIPUR", outlet: "RAJSAMAND", cityCode: "7" },
  udaipur: { branch: "UDAIPUR", outlet: "UDAIPUR", cityCode: "7" },
};

function detectBranchAndOutlet(city) {
  if (!city) return { branch: "NA", outlet: "NA", cityCode: "NA" };
  const normalized = city.toLowerCase().trim();
  const result = cityToBranchMap[normalized];
  return result || { branch: "NA", outlet: "NA", cityCode: "NA" };
}

/* =======================
   EXTERNAL API - FETCH CUSTOMER
======================= */
async function fetchCustomerFromExternal({ phone, chassisNo }) {
  try {
    let apiUrl = null;

    if (phone && phone.length === 10) {
      apiUrl = `${EXTERNAL_API_BASE}/get_machine_by_phone_no.php?phone_no=${phone}`;
    } else if (chassisNo && chassisNo.length >= 4) {
      apiUrl = `${EXTERNAL_API_BASE}/get_machine_by_machine_no.php?machine_no=${chassisNo}`;
    }

    if (!apiUrl) {
      console.log("⚠️  No valid identifier for external API");
      return null;
    }

    console.log(`🌐 Calling external API: ${apiUrl}`);

    const response = await axios.get(apiUrl, {
      timeout: API_TIMEOUT,
      headers: API_HEADERS,
      validateStatus: (status) => status < 500,
    });

    if (response.status !== 200) {
      console.log(`⚠️  External API returned status: ${response.status}`);
      return null;
    }

    const apiResponse = response.data;

    if (!apiResponse || apiResponse.status !== 1 || !apiResponse.data) {
      console.log("⚠️  External API returned invalid response");
      return null;
    }

    const customerData = apiResponse.data;

    const normalized = {
      chassisNo: customerData.machine_no || chassisNo || "Unknown",
      phone: customerData.customer_phone_no || phone || "Unknown",
      name: customerData.customer_name || "Unknown",
      city: customerData.city || "Unknown",
      model: customerData.machine_model || "Unknown",
      subModel: customerData.sub_model || "NA",
      machineType: customerData.machine_type || "Unknown",
      businessPartnerCode: customerData.business_partner_code || "NA",
      purchaseDate:
        customerData.purchase_date || customerData.installation_date || "NA",
      installationDate: customerData.installation_date || "NA",
      source: "EXTERNAL_API",
    };

    if (normalized.chassisNo === "Unknown" && normalized.phone === "Unknown") {
      console.log("⚠️  External API data missing both chassis and phone");
      return null;
    }

    console.log("✅ External API returned valid customer data:", normalized);
    return normalized;
  } catch (error) {
    if (error.code === "ECONNABORTED") {
      console.error("⏱️  External API timeout:", error.message);
    } else if (error.code === "ECONNREFUSED") {
      console.error("🔌 External API connection refused:", error.message);
    } else {
      console.error("❌ External API error:", error.message);
    }
    return null;
  }
}

/* =======================
   EXTERNAL API - SUBMIT COMPLAINT
======================= */
async function submitComplaintToExternal(complaintData) {
  try {
    console.log(
      `🌐 Submitting complaint to external API: ${COMPLAINT_API_URL}`,
    );
    console.log(
      "📦 Complaint payload:",
      JSON.stringify(complaintData, null, 2),
    );

    const response = await axios.post(COMPLAINT_API_URL, complaintData, {
      timeout: API_TIMEOUT,
      headers: {
        "Content-Type": "application/json",
        JCBSERVICEAPI: "MakeInJcb",
      },
      validateStatus: (status) => status < 500,
    });

    console.log(`📨 External API response status: ${response.status}`);
    console.log(
      "📨 External API response data:",
      JSON.stringify(response.data, null, 2),
    );

    if (response.status !== 200) {
      console.log(
        `⚠️  External complaint API returned non-200 status: ${response.status}`,
      );
      return {
        success: false,
        error: `HTTP ${response.status}`,
        data: response.data,
      };
    }

    const apiResponse = response.data;

    if (!apiResponse || apiResponse.status !== 1) {
      console.log(
        "⚠️  External API rejected complaint:",
        apiResponse?.message || "Unknown error",
      );
      return {
        success: false,
        error: apiResponse?.message || "External API rejected complaint",
        data: apiResponse,
      };
    }

    let sapId = null;
    if (apiResponse.data) {
      sapId =
        apiResponse.data.complaint_sap_id ||
        apiResponse.data.sap_id ||
        apiResponse.data.complaintSapId ||
        apiResponse.data.id ||
        null;
    }

    console.log("✅ External complaint API accepted submission successfully");
    if (sapId) {
      console.log(`✅ SAP ID returned: ${sapId}`);
    }

    return {
      success: true,
      data: apiResponse,
      sapId: sapId,
    };
  } catch (error) {
    if (error.code === "ECONNABORTED") {
      console.error("⏱️  External complaint API timeout:", error.message);
      return { success: false, error: "Request timeout" };
    } else if (error.code === "ECONNREFUSED") {
      console.error(
        "🔌 External complaint API connection refused:",
        error.message,
      );
      return { success: false, error: "Connection refused" };
    } else if (error.response) {
      console.error(
        "❌ External complaint API error response:",
        error.response.status,
        error.response.data,
      );
      return {
        success: false,
        error: `Server error: ${error.response.status}`,
        data: error.response.data,
      };
    } else if (error.request) {
      console.error("❌ No response from external complaint API");
      return { success: false, error: "No response from server" };
    } else {
      console.error("❌ External complaint API error:", error.message);
      return { success: false, error: error.message };
    }
  }
}

/* =======================
   Complaint convert to English
======================= */
function translateComplaintToEnglish(rawText) {
  if (!rawText) return "Not provided by caller";

  let text = rawText.toLowerCase();

  // Replace Hindi keywords with English
  for (const [hindi, english] of Object.entries(hindiToEnglishMap)) {
    const regex = new RegExp(hindi, "gi");
    text = text.replace(regex, english);
  }

  // Cleanup - remove Hindi characters completely
  text = text
    .replace(/\s+/g, " ")
    .replace(/[^\x00-\x7F]/g, "") // Remove non-ASCII characters
    .trim();

  return text || "Not provided by caller";
}

/* =======================
   TEXT PROCESSING UTILITIES
======================= */
function cleanSpeech(text) {
  if (!text) return "";
  return text
    .toLowerCase()
    .replace(/[।.,!?]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeText(text) {
  if (!text) return "";
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

function safeAscii(text) {
  if (!text) return "Unknown";
  
  // First try to transliterate common Hindi names to English
  let transliterated = text;
  
  // Common Hindi to English transliterations
  const transliterationMap = {
    'आज': 'Aaj',
    'कल': 'Kal',
    'बजे': 'Baje',
    'राम': 'Ram',
    'श्याम': 'Shyam',
    'मोहन': 'Mohan',
    'सोहन': 'Sohan',
    'रवि': 'Ravi',
    'विजय': 'Vijay',
    'राज': 'Raj',
    'कुमार': 'Kumar',
    'सिंह': 'Singh',
    'शर्मा': 'Sharma',
    'वर्मा': 'Verma',
    'गुप्ता': 'Gupta'
  };
  
  // Apply transliteration
  for (const [hindi, english] of Object.entries(transliterationMap)) {
    transliterated = transliterated.replace(new RegExp(hindi, 'g'), english);
  }
  
  // Remove remaining non-ASCII characters
  const cleaned = transliterated
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x00-\x7F]/g, "")
    .trim();
  
  return cleaned || "Unknown";
}

function getCallerName(call, customerData) {
  // 1️⃣ Prefer what caller actually said (cleaned to ASCII)
  const spokenName = normalizePersonName(call.temp.complaintGivenByName);
  if (spokenName) {
    const asciiName = safeAscii(spokenName);
    if (asciiName && asciiName !== "Unknown" && asciiName.length >= 2) {
      return asciiName;
    }
  }

  // 2️⃣ Fallback to registered customer name (already ASCII clean from API)
  if (customerData?.name && customerData.name !== "Unknown") {
    return safeAscii(customerData.name);
  }

  // 3️⃣ Absolute fallback
  return "Not Provided";
}

function formatDateForExternal(date) {
  if (!date) return "";
  if (typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return date;
  }

  const d = new Date(date);
  if (isNaN(d.getTime())) return "";

  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");

  return `${yyyy}-${mm}-${dd}`;
}

/* =======================
   HINDI → English Caller Names
======================= */
function normalizePersonName(text) {
  if (!text) return null;

  // Remove common time-related words and numbers
  const cleaned = text
    .replace(/[0-9]/g, "")
    .replace(/(kya|kaun|hai|bolo|repeat|dobara|aaj|kal|baje|subah|sham|din|raat|ghante|minute)/gi, "")
    .replace(/[:]/g, "") // Remove colons
    .trim();

  // Check if result is meaningful (at least 2 chars and not just punctuation)
  if (cleaned.length >= 2 && /[a-zA-Z\u0900-\u097F]/.test(cleaned)) {
    return cleaned;
  }

  return null;
}

/* =======================
   HINDI → ENGLISH NORMALIZER
======================= */
const hindiToEnglishMap = {
  "टायर नहीं": "tyre",
  टायर: "tyre",
  एसी: "ac",
  ऐसी: "ac",
  "ए.सी": "ac",
  "ए सी": "ac",
  इंजन: "engine",
  इंडियन: "engine",
  हाइड्रोलिक: "hydraulic",
  हाइड्रॉलिक: "hydraulic",
  बिजली: "electrical",
  इलेक्ट्रिकल: "electrical",
  बैटरी: "battery",
  "नॉट वर्किंग": "not working",
  "वर्क नहीं": "not working",
  "काम नहीं कर रहा है": "not working",
  "काम नहीं कर रही है": "not working",
  "काम नहीं कर रहा": "not working",
  "काम नहीं कर रही": "not working",
  "काम नहीं": "not working",
  "कॉलिंग नहीं": "cooling not working",
  "कूलिंग नहीं": "cooling not working",
  "ठंडा नहीं": "cooling",
  "ठंडी नहीं": "cooling",
  ठंडा: "cooling",
  ठंडी: "cooling",
  कूलिंग: "cooling",
  खराब: "breakdown",
  बंद: "breakdown",
  ब्रेकडाउन: "breakdown",
  "ब्रेक डाउन": "breakdown",
  "चल रहा": "running",
  चालू: "running",
  प्रॉब्लम: "problem",
  दिक्कत: "problem",
  समस्या: "problem",
  वारंटी: "warranty",
  केयर: "care",
  डेमो: "demo",
  स्मोक: "smoke",
  धुआ: "smoke",
  नॉइज: "noise",
  आवाज: "noise",
  गरम: "overheat",
  ओवरहीट: "overheat",
  स्टार्ट: "start",
  मिसिंग: "missing",
  हीट: "heat",
  प्रेशर: "pressure",
  लीक: "leak",
  स्लो: "slow",
  धीरे: "slow",
  कम: "low",
  स्टार्टर: "starter",
  सेल्फ: "self",
  वायरिंग: "wiring",
  लाइट: "light",
  आरपीएम: "rpm",
  मीटर: "meter",
  पंक्चर: "puncture",
  फटा: "burst",
  कट: "cut",
  डेड: "dead",
  गियर: "gear",
  ब्रेक: "brake",
  रिवर्स: "reverse",
  रॉड: "rod",
  रैम: "ram",
  सील: "seal",
  बेंड: "bend",
  टूटा: "broken",
  होस: "hose",
  पाइप: "pipe",
  ट्रैक: "track",
  रोलर: "roller",
  आइडलर: "idler",
  स्प्रॉकेट: "sprocket",
};

const sortedHindiKeys = Object.keys(hindiToEnglishMap).sort(
  (a, b) => b.length - a.length,
);

function normalizeHindiIntent(text) {
  if (!text) return "";
  let normalized = text;
  for (const hindi of sortedHindiKeys) {
    if (normalized.includes(hindi)) {
      normalized += " " + hindiToEnglishMap[hindi];
    }
  }
  return normalized;
}

/* =======================
   FOLLOW UP QUESTIONS
======================= */
const followUpQuestions = {
  "AC System": {
    question:
      "AC cooling nahi kar rahi hai ya bilkul kaam nahi kar rahi hai? Cooling hai ya band hai?",
    options: {
      cooling: "AC not Cooling",
      thanda: "AC not Cooling",
      एक: "AC",
      "nahi kar rahi": "AC not Cooling",
      "कूलिंग नहीं": "AC not Cooling",
      "ठंडा नहीं": "AC not Cooling",
      "ठंडी नहीं": "AC not Cooling",
      band: "AC not Working",
      "not working": "AC not Working",
      kaam: "AC not Working",
      "काम नहीं": "AC not Working",
      बंद: "AC not Working",
    },
  },

  Engine: {
    question:
      "Engine mein kya dikkat hai? Overheating hai, smoke aa raha hai, noise hai ya start mein problem hai?",
    options: {
      overheat: "Engine Over heating",
      garam: "Engine Over heating",
      heat: "Engine Over heating",
      गरम: "Engine Over heating",
      smoke: "Smoke problem",
      dhua: "Smoke problem",
      धुआ: "Smoke problem",
      noise: "Abnormal Noise",
      awaz: "Abnormal Noise",
      आवाज: "Abnormal Noise",
      start: "Not Starting/Starting problem",
      missing: "Missing problem",
      मिसिंग: "Missing problem",
    },
  },

  Hydraulic: {
    question:
      "Hydraulic mein kya problem hai? Pressure kam hai, leak hai ya machine slow chal rahi hai?",
    options: {
      pressure: "Pressure down",
      kam: "Pressure down",
      कम: "Pressure down",
      leak: "Hydraulic pump leak",
      लीक: "Hydraulic pump leak",
      slow: "Machine performance low/Slow working",
      dheere: "Machine performance low/Slow working",
      धीरे: "Machine performance low/Slow working",
    },
  },

  "Electrical Complaint": {
    question:
      "Electrical mein kya dikkat hai? Battery hai, self starter hai, wiring hai ya light mein problem hai?",
    options: {
      battery: "Battery problem",
      बैटरी: "Battery problem",
      starter: "Self/Starter motor problem",
      self: "Self/Starter motor problem",
      सेल्फ: "Self/Starter motor problem",
      wiring: "Wiring problem",
      वायरिंग: "Wiring problem",
      light: "Light not working",
      लाइट: "Light not working",
      rpm: "speed/rpm meter not working",
      meter: "speed/rpm meter not working",
      मीटर: "speed/rpm meter not working",
    },
  },

  "Tyre/Battery": {
    question:
      "Tyre mein kya problem hai? Phatta gaya hai, puncture hai ya cut hai?",
    options: {
      puncture: "Tyre puncture",
      phatta: "Tyre puncture",
      burst: "Tyre puncture",
      फटा: "Tyre puncture",
      cut: "Tyre cut",
      कट: "Tyre cut",
      battery: "Battery problem",
      dead: "Battery problem",
      बैटरी: "Battery problem",
    },
  },

  "Transmission/Axle components": {
    question:
      "Transmission mein kya problem hai? Gear hai, brake hai ya reverse mein dikkat hai?",
    options: {
      gear: "Gear box problem",
      gearbox: "Gear box problem",
      गियर: "Gear box problem",
      brake: "Brake problem",
      ब्रेक: "Brake problem",
      reverse: "Reverse forward issue",
      रिवर्स: "Reverse forward issue",
    },
  },

  "Ram/Cylinder": {
    question:
      "Ram ya cylinder mein kya problem hai? Leak hai, rod bend hai ya rod toot gaya hai?",
    options: {
      leak: "Ram leak",
      लीक: "Ram leak",
      bend: "Rod bend",
      बेंड: "Rod bend",
      toot: "Rod broken",
      broken: "Rod broken",
      टूटा: "Rod broken",
      seal: "Seal leak",
      सील: "Seal leak",
    },
  },

  Hose: {
    question:
      "Hose mein kya problem hai? Cut hai, leak hai ya O-ring mein dikkat hai?",
    options: {
      cut: "Hose cut",
      कट: "Hose cut",
      leak: "Hose leakages",
      लीक: "Hose leakages",
      "o ring": "Hose O ring Cut",
      oring: "Hose O ring Cut",
    },
  },

  "Under Carriage": {
    question:
      "Under carriage mein kya problem hai? Track hai, roller hai ya idler mein dikkat hai?",
    options: {
      track: "Track Motor leak",
      ट्रैक: "Track Motor leak",
      roller: "Roller leakage",
      रोलर: "Roller leakage",
      idler: "Idler wheel noise",
      आइडलर: "Idler wheel noise",
    },
  },
};

/* =======================
   HINDI NUMBER MAP
======================= */
const hindiNumberMap = {
  shunya: "0",
  zero: "0",
  ek: "1",
  do: "2",
  teen: "3",
  char: "4",
  chaar: "4",
  paanch: "5",
  panch: "5",
  chhe: "6",
  che: "6",
  saat: "7",
  aath: "8",
  nau: "9",
};

function wordsToDigits(text) {
  if (!text) return "";
  let result = "";
  text.split(" ").forEach((word) => {
    if (hindiNumberMap[word]) {
      result += hindiNumberMap[word];
    }
  });
  return result;
}

/* =======================
   DETECTION FUNCTIONS
======================= */
function isConfusedSpeech(text) {
  if (!text) return false;
  const confusionWords = [
    "kya",
    "repeat",
    "dobara",
    "samajh nahi aaya",
    "samajh nahi",
    "fir se",
  ];
  return confusionWords.some((word) => text.includes(word));
}

function detectComplaintIntent(text) {
  if (!text) return null;

  const matches = [];
  const words = text.split(" ");
  const SKIP_KEYWORDS = ["ek", "not working", "band"];

  for (const [title, data] of Object.entries(complaintMap)) {
    for (const keyword of data.keywords) {
      if (SKIP_KEYWORDS.includes(keyword)) continue;

      if (
        text.includes(keyword) ||
        words.some(
          (w) => w.length > 2 && (keyword.includes(w) || w.includes(keyword)),
        )
      ) {
        matches.push(title);
        break;
      }
    }
  }

  if (matches.length === 0) return null;

  return {
    primary: matches[0],
    secondary: matches.slice(1),
    confidence: matches.length === 1 ? 0.95 : 0.6,
  };
}

function detectMachineType(text) {
  if (!text) return null;

  if (text.includes("warranty") || text.includes("वारंटी")) {
    return "Warranty";
  }
  if (text.includes("care") || text.includes("केयर")) {
    if (text.includes("engine")) return "Engine Care";
    return "JCB Care";
  }
  if (text.includes("demo") || text.includes("डेमो")) {
    return "Demo";
  }

  return null;
}

function detectMachineStatus(text) {
  if (!text) return null;

  if (
    text.includes("breakdown") ||
    text.includes("break down") ||
    text.includes("खराब") ||
    text.includes("बंद") ||
    text.includes("ब्रेकडाउन") ||
    text.includes("ब्रेक डाउन")
  ) {
    return "Break Down";
  }

  if (
    text.includes("running") ||
    text.includes("चल रहा") ||
    text.includes("चालू")
  ) {
    if (
      text.includes("problem") ||
      text.includes("dikkat") ||
      text.includes("दिक्कत") ||
      text.includes("प्रॉब्लम")
    ) {
      return "Running With Problem";
    }
    return "Running OK";
  }

  return null;
}

function ask(twiml, text, call) {
  call.temp.lastQuestion = text;

  const gather = twiml.gather({
    input: "speech",
    language: "hi-IN",
    speechTimeout: "auto",
    timeout: 6,
    actionOnEmptyResult: true,
    action: "/voice/process",
    method: "POST",
  });

  gather.say({ voice: "Polly.Aditi", language: "hi-IN" }, text);
}

/* =======================
   SAVE COMPLAINT
======================= */
async function saveComplaint(twiml, call, CallSid) {
  let customerData = call.temp.customerData;

  if (!customerData) {
    console.log("⚠️  Customer data not in session, fetching from database...");
    try {
      const customer = await Customer.findById(call.temp.customerId);
      if (!customer) {
        console.error("❌ Customer not found in database");
        twiml.say(
          { voice: "Polly.Aditi", language: "hi-IN" },
          "Technical error. Aapko agent se connect kiya ja raha hai.",
        );
        twiml.dial(process.env.HUMAN_AGENT_NUMBER);
        call.step = "done";
        return;
      }

      customerData = {
        chassisNo: customer.chassisNo,
        phone: customer.phone,
        name: customer.name,
        city: customer.city,
        model: customer.model,
        subModel: customer.subModel || "NA",
        machineType: customer.machineType,
        businessPartnerCode: customer.businessPartnerCode || "NA",
        purchaseDate: customer.purchaseDate || "NA",
        installationDate: customer.installationDate || "NA",
      };
      console.log("✅ Customer data retrieved from database");
    } catch (error) {
      console.error("❌ Error fetching customer:", error.message);
      twiml.say(
        { voice: "Polly.Aditi", language: "hi-IN" },
        "Technical error. Aapko agent se connect kiya ja raha hai.",
      );
      twiml.dial(process.env.HUMAN_AGENT_NUMBER);
      call.step = "done";
      return;
    }
  }

  const branchOutlet = detectBranchAndOutlet(customerData.city);

  const installationDate =
    formatDateForExternal(customerData.installationDate) ||
    formatDateForExternal(customerData.purchaseDate) ||
    "";
  
  // Get caller name and ensure it's ASCII-safe
  const callerNameFinal = getCallerName(call, customerData);

  // Get caller phone - use what they said or fallback to registered phone
  const callerPhoneFinal =
    call.temp.complaintGivenByPhone &&
    /^\d{10}$/.test(call.temp.complaintGivenByPhone)
      ? call.temp.complaintGivenByPhone
      : customerData.phone;

  // Translate complaint details to English (removing all Hindi characters)
  const complaintDetailsEnglish = translateComplaintToEnglish(
    call.temp.rawComplaint || ""
  );

  // Ensure subtitle is not "Other" if we have a valid one
  const finalSubTitle = call.temp.complaintSubTitle && 
                        call.temp.complaintSubTitle !== "Other" 
                        ? call.temp.complaintSubTitle 
                        : "Other";

  console.log("🔍 Final processed data:");
  console.log("   Caller Name:", callerNameFinal);
  console.log("   Caller Phone:", callerPhoneFinal);
  console.log("   Complaint Details:", complaintDetailsEnglish);
  console.log("   Subtitle:", finalSubTitle);

  /* ════════════════════════════════════════════════════════════════
     PREPARE EXTERNAL API PAYLOAD - ALL FIELDS IN ENGLISH
  ════════════════════════════════════════════════════════════════ */
  const complaintApiData = {
    machine_no: customerData.chassisNo || "Unknown",
    customer_name: safeAscii(customerData.name),
    caller_name: callerNameFinal,
    contact_person: callerNameFinal,
    caller_no: callerPhoneFinal,
    machine_model: customerData.machineType || "Unknown",
    sub_model: customerData.model || "NA",
    installation_date: installationDate,
    machine_type: call.temp.machineType || "Warranty",
    complain_by: "Customer",
    machine_status: call.temp.machineStatus || "Unknown",
    job_location: call.temp.jobLocation || "Onsite",
    branch: branchOutlet.branch,
    outlet: branchOutlet.outlet,
    city_id: branchOutlet.cityCode,
    complaint_details: complaintDetailsEnglish,
    complaint_title: call.temp.complaintTitle || "NA",
    sub_title: finalSubTitle,
    business_partner_code: customerData.businessPartnerCode || "NA",
    complaint_sap_id: "NA",
  };

  console.log("🌐 Submitting complaint to external API...");
  const externalResult = await submitComplaintToExternal(complaintApiData);

  let sapId = null;
  if (externalResult.success) {
    sapId = externalResult.sapId;
    if (sapId) {
      console.log(
        `✅ External API submission successful with SAP ID: ${sapId}`,
      );
    } else {
      console.log("✅ External API submission successful (no SAP ID returned)");
    }
  } else {
    console.error(
      `❌ External API submission failed: ${externalResult.error || "Unknown error"}`,
    );
    console.log("⚠️  Continuing with local database save...");
  }

  const complaintDbData = {
    customerId: call.temp.customerId,
    machineNo: customerData.chassisNo || "Unknown",
    chassisNo: customerData.chassisNo || "Unknown",
    customerName: safeAscii(customerData.name),
    registeredPhone: customerData.phone || "Unknown",
    machineModel: customerData.model || "Unknown",
    subModel: customerData.subModel || "NA",
    machineType: call.temp.machineType || "Warranty",
    purchaseDate: customerData.purchaseDate || "NA",
    installationDate: customerData.installationDate || "NA",
    businessPartnerCode: customerData.businessPartnerCode || "NA",
    complaintGivenByName: callerNameFinal,
    complaintGivenByPhone: callerPhoneFinal,
    machineStatus: call.temp.machineStatus || "Unknown",
    jobLocation: call.temp.jobLocation || "Onsite",
    branch: branchOutlet.branch,
    outlet: branchOutlet.outlet,
    city_id: branchOutlet.cityCode,
    description_raw: complaintDetailsEnglish,
    complaintTitle: call.temp.complaintTitle || "NA",
    complaintSubTitle: finalSubTitle,
    complaintSapId: sapId || null,
    callSid: CallSid,
    source: "IVR_VOICE_BOT",
    complainBy: "Customer",
  };

  try {
    console.log("💾 Saving complaint to local database...");
    const savedComplaint = await Complaint.create(complaintDbData);
    console.log(
      `✅ Complaint saved to database with ID: ${savedComplaint._id}`,
    );
    console.log(
      "✅ Complaint details:",
      call.temp.complaintTitle,
      "/",
      finalSubTitle,
    );
  } catch (dbError) {
    console.error("❌ Failed to save complaint to database:", dbError.message);
  }

  call.step = "done";
  twiml.say(
    { voice: "Polly.Aditi", language: "hi-IN" },
    "Dhanyavaad. Aapki complaint register ho gayi hai. Hamari team jaldi hi aapko contact karegi.",
  );
  twiml.hangup();
}

/* =======================
   INCOMING CALL HANDLER
======================= */
router.post("/", async (req, res) => {
  const { CallSid, From } = req.body;
  const twiml = new VoiceResponse();

  await CallSession.findOneAndUpdate(
    { callSid: CallSid },
    {
      callSid: CallSid,
      from: From,
      step: "ivr_menu",
      temp: { retries: 0 },
    },
    { upsert: true, new: true },
  );

  const gather = twiml.gather({
    input: "dtmf",
    numDigits: 1,
    timeout: 5,
    action: "/voice/process",
    method: "POST",
  });

  gather.say(
    { voice: "Polly.Aditi", language: "hi-IN" },
    "Complaint register karne ke liye ek dabayien. Human agent se baat karne ke liye do dabayien.",
  );

  res.type("text/xml").send(twiml.toString());
});

/* =======================
   CALL PROCESSING HANDLER
======================= */
router.post("/process", async (req, res) => {
  const twiml = new VoiceResponse();
  const { CallSid, Digits, SpeechResult } = req.body;

  const call = await CallSession.findOne({ callSid: CallSid });
  if (!call) {
    twiml.say("Technical error.");
    twiml.hangup();
    return res.type("text/xml").send(twiml.toString());
  }

  if (!SpeechResult && !Digits) {
    ask(twiml, call.temp.lastQuestion || "Kripya apna jawab bolein.", call);
    await call.save();
    return res.type("text/xml").send(twiml.toString());
  }

  if (call.step === "ivr_menu") {
    if (Digits === "2") {
      twiml.say("Aapko agent se connect kiya ja raha hai.");
      twiml.dial(process.env.HUMAN_AGENT_NUMBER);
      return res.type("text/xml").send(twiml.toString());
    }

    if (Digits === "1") {
      call.step = "ask_identifier";
      ask(
        twiml,
        "Welcome to Rajesh JCB motors. Kripya apni machine ka chassis number ya registered mobile number boliye.",
        call,
      );
      await call.save();
      return res.type("text/xml").send(twiml.toString());
    }

    ask(twiml, "Kripya ek ya do dabayien.", call);
    await call.save();
    return res.type("text/xml").send(twiml.toString());
  }

  const rawSpeech = normalizeText(cleanSpeech(SpeechResult || ""));
  const speech = normalizeHindiIntent(rawSpeech);

  console.log("🎤 RAW SPEECH :", SpeechResult);
  console.log("🧹 CLEANED    :", rawSpeech);
  console.log("🔤 NORMALIZED :", speech);

  if (speech.length > 0 && isConfusedSpeech(speech)) {
    ask(twiml, call.temp.lastQuestion || "Kripya dobara bolein.", call);
    await call.save();
    return res.type("text/xml").send(twiml.toString());
  }

  if (!speech) {
    call.temp.retries = (call.temp.retries || 0) + 1;

    if (call.temp.retries >= 3) {
      twiml.say(
        "Humein aawaz sunai nahi de rahi. Aapko agent se connect kiya ja raha hai.",
      );
      twiml.dial(process.env.HUMAN_AGENT_NUMBER);
      return res.type("text/xml").send(twiml.toString());
    }

    ask(twiml, call.temp.lastQuestion || "Kripya apna jawab bolein.", call);
    await call.save();
    return res.type("text/xml").send(twiml.toString());
  }

  switch (call.step) {
    case "ask_identifier": {
      let digits = speech.replace(/\D/g, "");

      if (digits.length < 10) {
        const wordDigits = wordsToDigits(speech);
        if (wordDigits.length >= 10) {
          digits = wordDigits;
        }
      }

      let chassis = speech.replace(/\s+/g, "").toUpperCase();
      const digitFromWords = wordsToDigits(speech);
      if (digitFromWords.length >= 4) {
        chassis = digitFromWords;
      }

      console.log("🔍 Fetching customer data from external API...");

      const externalData = await fetchCustomerFromExternal({
        phone: digits.length === 10 ? digits : null,
        chassisNo: chassis.length >= 4 ? chassis : null,
      });

      if (!externalData) {
        call.temp.retries = (call.temp.retries || 0) + 1;

        if (call.temp.retries >= 3) {
          twiml.say(
            { voice: "Polly.Aditi", language: "hi-IN" },
            "Humein details verify nahi ho pa rahi. Aapko agent se connect kiya ja raha hai.",
          );
          twiml.dial(process.env.HUMAN_AGENT_NUMBER);
          await call.save();
          return res.type("text/xml").send(twiml.toString());
        }

        ask(
          twiml,
          "Record nahi mila. Kripya chassis number ya registered mobile number dobara boliye.",
          call,
        );
        break;
      }

      let customer = null;
      try {
        customer = await Customer.findOne({
          $or: [
            { chassisNo: externalData.chassisNo },
            { phone: externalData.phone },
          ],
        });

        if (customer) {
          customer.chassisNo = externalData.chassisNo;
          customer.phone = externalData.phone;
          customer.name = externalData.name;
          customer.city = externalData.city;
          customer.model = externalData.model;
          customer.subModel = externalData.subModel;
          customer.machineType = externalData.machineType;
          customer.businessPartnerCode = externalData.businessPartnerCode;
          customer.purchaseDate = externalData.purchaseDate;
          customer.installationDate = externalData.installationDate;
          customer.source = externalData.source;
          customer.lastUpdated = new Date();
          await customer.save();
          console.log("✅ Existing customer updated from API:", customer._id);
        } else {
          customer = await Customer.create({
            chassisNo: externalData.chassisNo,
            phone: externalData.phone,
            name: externalData.name,
            city: externalData.city,
            model: externalData.model,
            subModel: externalData.subModel,
            machineType: externalData.machineType,
            businessPartnerCode: externalData.businessPartnerCode,
            purchaseDate: externalData.purchaseDate,
            installationDate: externalData.installationDate,
            source: externalData.source,
          });
          console.log("✅ New customer created from API:", customer._id);
        }
      } catch (saveError) {
        console.error("❌ Failed to save/update customer:", saveError.message);
        twiml.say(
          { voice: "Polly.Aditi", language: "hi-IN" },
          "Technical error. Aapko agent se connect kiya ja raha hai.",
        );
        twiml.dial(process.env.HUMAN_AGENT_NUMBER);
        await call.save();
        return res.type("text/xml").send(twiml.toString());
      }

      call.temp.customerId = customer._id.toString();
      call.temp.customerData = {
        chassisNo: externalData.chassisNo,
        phone: externalData.phone,
        name: externalData.name,
        city: externalData.city,
        model: externalData.model,
        subModel: externalData.subModel,
        machineType: externalData.machineType,
        businessPartnerCode: externalData.businessPartnerCode,
        purchaseDate: externalData.purchaseDate,
        installationDate: externalData.installationDate,
      };
      call.temp.retries = 0;
      call.step = "ask_complaint_given_by_name";

      ask(
        twiml,
        `Aapka record mil gaya. ${externalData.name} ji, complaint kis ke naam se register karni hai?`,
        call,
      );
      break;
    }

    case "ask_complaint_given_by_name": {
      // Improved name validation
      const cleanedName = normalizePersonName(rawSpeech);
      
      if (!cleanedName || cleanedName.length < 2) {
        call.temp.retries = (call.temp.retries || 0) + 1;
        
        if (call.temp.retries >= 2) {
          // Use customer's registered name as fallback
          call.temp.complaintGivenByName = call.temp.customerData?.name || "Customer";
          call.temp.retries = 0;
          call.step = "ask_complaint_given_by_phone";
          ask(twiml, "Complaint dene wale ka phone number boliye.", call);
          break;
        }
        
        ask(twiml, "Kripya apna poora naam batayein.", call);
        break;
      }
      
      call.temp.complaintGivenByName = rawSpeech; // Store raw speech, will be cleaned later
      call.temp.retries = 0;
      call.step = "ask_complaint_given_by_phone";
      ask(twiml, "Complaint dene wale ka phone number boliye.", call);
      break;
    }

    case "ask_complaint_given_by_phone": {
      let digits = speech.replace(/\D/g, "");

      if (digits.length < 10) {
        const wordDigits = wordsToDigits(speech);
        if (wordDigits.length >= 10) {
          digits = wordDigits;
        }
      }

      if (digits.length !== 10) {
        call.temp.retries = (call.temp.retries || 0) + 1;
        
        if (call.temp.retries >= 2) {
          // Use registered phone as fallback
          call.temp.complaintGivenByPhone = call.temp.customerData?.phone || "Unknown";
          call.temp.retries = 0;
          call.step = "ask_machine_type";
          ask(
            twiml,
            "Machine ka type batayein. Warranty hai, JCB Care hai, Engine Care hai ya demo machine hai?",
            call,
          );
          break;
        }
        
        ask(twiml, "Kripya 10 digit ka phone number boliye.", call);
        break;
      }

      call.temp.complaintGivenByPhone = digits;
      call.temp.retries = 0;
      call.step = "ask_machine_type";
      ask(
        twiml,
        "Machine ka type batayein. Warranty hai, JCB Care hai, Engine Care hai ya demo machine hai?",
        call,
      );
      break;
    }

    case "ask_machine_type": {
      const machineType = detectMachineType(speech);

      if (!machineType) {
        call.temp.retries = (call.temp.retries || 0) + 1;

        if (call.temp.retries >= 2) {
          call.temp.machineType = "Warranty";
          call.temp.retries = 0;
          call.step = "ask_machine_status";
          ask(
            twiml,
            "Machine break down hai ya problem ke saath chal rahi hai?",
            call,
          );
          break;
        }

        ask(
          twiml,
          "Kripya boliye: warranty, JCB care, engine care ya demo.",
          call,
        );
        break;
      }

      call.temp.machineType = machineType;
      call.temp.retries = 0;
      call.step = "ask_machine_status";
      ask(
        twiml,
        "Machine break down hai ya problem ke saath chal rahi hai?",
        call,
      );
      break;
    }

    case "ask_machine_status": {
      const machineStatus = detectMachineStatus(speech);

      if (!machineStatus) {
        call.temp.retries = (call.temp.retries || 0) + 1;

        if (call.temp.retries >= 2) {
          call.temp.machineStatus = "Running With Problem";
          call.temp.retries = 0;
          call.step = "ask_job_location";
          ask(twiml, "Machine kahan hai? Site par hai ya workshop mein?", call);
          break;
        }

        ask(
          twiml,
          "Kripya boliye: break down hai ya problem ke saath chal rahi hai.",
          call,
        );
        break;
      }

      call.temp.machineStatus = machineStatus;
      call.temp.retries = 0;
      call.step = "ask_job_location";
      ask(twiml, "Machine kahan hai? Site par hai ya workshop mein?", call);
      break;
    }

    case "ask_job_location": {
      let jobLocation = "Onsite";

      if (
        speech.includes("workshop") ||
        speech.includes("वर्कशॉप") ||
        speech.includes("garage")
      ) {
        jobLocation = "Work Shop";
      }

      call.temp.jobLocation = jobLocation;
      call.step = "ask_complaint";
      call.temp.retries = 0;
      ask(twiml, "Machine ki complaint batayein.", call);
      break;
    }

    case "ask_complaint": {
      // Store BOTH raw speech and English translation
      call.temp.rawComplaint = rawSpeech;
      call.temp.englishComplaint = translateComplaintToEnglish(rawSpeech);

      console.log("📝 Complaint captured:");
      console.log("   Raw:", call.temp.rawComplaint);
      console.log("   English:", call.temp.englishComplaint);

      const intent = detectComplaintIntent(speech);

      if (!intent) {
        call.temp.retries = (call.temp.retries || 0) + 1;

        if (call.temp.retries >= 2) {
          call.temp.retries = 0;
          ask(
            twiml,
            "Kripya bolein: engine, tyre, AC, hydraulic ya electrical.",
            call,
          );
          break;
        }

        ask(
          twiml,
          "Kripya engine, hydraulic, AC, electrical ya tyre ka problem batayein.",
          call,
        );
        break;
      }

      call.temp.retries = 0;
      call.temp.detectedIntentPrimary = intent.primary;
      call.temp.detectedIntentConfidence = intent.confidence;

      console.log("🎯 Detected intent:", intent.primary, "Confidence:", intent.confidence);

      if (intent.confidence >= 0.9) {
        call.temp.complaintTitle = intent.primary;

        if (followUpQuestions[intent.primary]) {
          call.step = "ask_sub_complaint";
          call.temp.subRetries = 0;
          ask(twiml, followUpQuestions[intent.primary].question, call);
        } else {
          call.temp.complaintSubTitle = "Other";
          await saveComplaint(twiml, call, CallSid);
        }
      } else {
        call.step = "confirm_complaint";
        ask(
          twiml,
          `Aap keh rahe hain ${intent.primary} ka issue hai, sahi? Haan ya nahi bolein.`,
          call,
        );
      }
      break;
    }

    case "confirm_complaint": {
      const isYes =
        speech.includes("haan") ||
        speech.includes("हां") ||
        speech.includes("yes") ||
        speech.includes("ji") ||
        speech.includes("sahi");

      const isNo =
        speech.includes("nahi") ||
        speech.includes("नहीं") ||
        speech.includes("no");

      if (isYes) {
        const title = call.temp.detectedIntentPrimary;
        call.temp.complaintTitle = title;

        if (followUpQuestions[title]) {
          call.step = "ask_sub_complaint";
          call.temp.subRetries = 0;
          ask(twiml, followUpQuestions[title].question, call);
        } else {
          call.temp.complaintSubTitle = "Other";
          await saveComplaint(twiml, call, CallSid);
        }
        break;
      }

      if (isNo) {
        call.step = "ask_complaint";
        call.temp.retries = 0;
        ask(twiml, "Theek hai, kripay complaint dobara batayein.", call);
        break;
      }

      ask(twiml, "Kripya haan ya nahi bolein.", call);
      break;
    }

    case "ask_sub_complaint": {
      const title = call.temp.complaintTitle;
      const followUp = followUpQuestions[title];

      if (!followUp) {
        call.temp.complaintSubTitle = "Other";
        await saveComplaint(twiml, call, CallSid);
        break;
      }

      call.temp.subRetries = call.temp.subRetries || 0;

      let detectedSub = null;
      
      // Check both normalized speech AND raw speech for better matching
      const combinedSpeech = speech + " " + rawSpeech;
      
      for (const [keyword, subTitle] of Object.entries(followUp.options)) {
        if (combinedSpeech.includes(keyword)) {
          detectedSub = subTitle;
          console.log("✅ Matched sub-complaint:", keyword, "->", subTitle);
          break;
        }
      }

      if (!detectedSub) {
        call.temp.subRetries += 1;

        if (call.temp.subRetries >= 2) {
          call.temp.complaintSubTitle = "Other";
          console.log("⚠️  Sub-complaint detection failed, using 'Other'");
          await saveComplaint(twiml, call, CallSid);
          break;
        }

        ask(twiml, followUp.question + " Kripya thoda clear bolein.", call);
        break;
      }

      call.temp.complaintSubTitle = detectedSub;
      await saveComplaint(twiml, call, CallSid);
      break;
    }
  }

  await call.save();
  res.type("text/xml").send(twiml.toString());
});

export default router;