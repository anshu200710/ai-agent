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
const API_TIMEOUT = 4000;
const API_HEADERS = {
  JCBSERVICEAPI: "MakeInJcb",
};

/* =======================
   BRANCH & OUTLET MAPPING
======================= */
const cityToBranchMap = {
  // AJMER Branch
  "ajmer": { branch: "AJMER", outlet: "AJMER" },
  "kekri": { branch: "AJMER", outlet: "KEKRI" },
  
  // ALWAR Branch
  "alwar": { branch: "ALWAR", outlet: "ALWAR" },
  "bharatpur": { branch: "ALWAR", outlet: "BHARATPUR" },
  "bhiwadi": { branch: "ALWAR", outlet: "BHIWADI" },
  "dholpur": { branch: "ALWAR", outlet: "DHOLPUR" },
  
  // BHILWARA Branch
  "bhilwara": { branch: "BHILWARA", outlet: "BHILWARA" },
  "nimbahera": { branch: "BHILWARA", outlet: "NIMBAHERA" },
  "pratapgarh": { branch: "BHILWARA", outlet: "PRATAPGARH" },
  
  // JAIPUR Branch
  "dausa": { branch: "JAIPUR", outlet: "DAUSA" },
  "goner road": { branch: "JAIPUR", outlet: "GONER ROAD" },
  "jaipur": { branch: "JAIPUR", outlet: "JAIPUR" },
  "karauli": { branch: "JAIPUR", outlet: "KARAULI" },
  "karoli": { branch: "JAIPUR", outlet: "KARAULI" }, // Alternative spelling
  "kotputli": { branch: "JAIPUR", outlet: "KOTPUTLI" },
  "neem ka thana": { branch: "JAIPUR", outlet: "NEEM KA THANA" },
  "tonk": { branch: "JAIPUR", outlet: "TONK" },
  "vkia": { branch: "JAIPUR", outlet: "VKIA" },
  
  // KOTA Branch
  "jhalawar": { branch: "KOTA", outlet: "JHALAWAR" },
  "kota": { branch: "KOTA", outlet: "KOTA" },
  "ramganjmandi": { branch: "KOTA", outlet: "RAMGANJMANDI" },
  
  // SIKAR Branch
  "jhunjhunu": { branch: "SIKAR", outlet: "JHUNJHUNU" },
  "sikar": { branch: "SIKAR", outlet: "SIKAR" },
  "sujangarh": { branch: "SIKAR", outlet: "SUJANGARH" },
  
  // UDAIPUR Branch
  "banswara": { branch: "UDAIPUR", outlet: "BANSWARA" },
  "dungarpur": { branch: "UDAIPUR", outlet: "DUNGARPUR" },
  "rajsamand": { branch: "UDAIPUR", outlet: "RAJSAMAND" },
  "udaipur": { branch: "UDAIPUR", outlet: "UDAIPUR" },
};

function detectBranchAndOutlet(city) {
  if (!city) return { branch: "NA", outlet: "NA" };
  const normalized = city.toLowerCase().trim();
  const result = cityToBranchMap[normalized];
  return result || { branch: "NA", outlet: "NA" };
}

/* =======================
   EXTERNAL API HELPER
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

    // Handle new API format with status and data wrapper
    if (!apiResponse || apiResponse.status !== 1 || !apiResponse.data) {
      console.log("⚠️  External API returned invalid response");
      return null;
    }

    const customerData = apiResponse.data;

    // Normalize fields from new API format
    const normalized = {
      chassisNo: customerData.machine_no || chassisNo || "Unknown",
      phone: customerData.customer_phone_no || phone || "Unknown",
      name: customerData.customer_name || "Unknown",
      city: customerData.city || "Unknown",
      model: customerData.machine_model || "Unknown",
      machineType: customerData.machine_type || "Unknown",
      businessPartnerCode: customerData.business_partner_code || "",
      purchaseDate: customerData.purchase_date || "",
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
   TEXT PROCESSING
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

/* =======================
   HINDI → ENGLISH NORMALISER
======================= */
const hindiToEnglishMap = {
  // Complaint categories
  "टायर नहीं": "tyre",
  "टायर": "tyre",
  "एसी": "ac",
  "ए.सी": "ac",
  "इंजन": "engine",
  "हाइड्रोलिक": "hydraulic",
  "बिजली": "electrical",
  "इलेक्ट्रिकल": "electrical",
  "बैटरी": "battery",

  // Generic intent words
  "नॉट वर्किंग": "not working",
  "वर्क नहीं": "not working",
  "काम नहीं कर रहा है": "not working",
  "काम नहीं कर रही है": "not working",
  "काम नहीं कर रहा": "not working",
  "काम नहीं कर रही": "not working",
  "काम नहीं": "not working",
  "ठंडा नहीं": "cooling",
  "ठंडी नहीं": "cooling",
  "ठंडा": "cooling",
  "ठंडी": "cooling",

  // Machine status
  "खराब": "breakdown",
  "बंद": "breakdown",
  "चल रहा": "running",
  "चालू": "running",
  "प्रॉब्लम": "problem",
  "दिक्कत": "problem",
  "समस्या": "problem",

  // Machine type
  "वारंटी": "warranty",
  "केयर": "care",
  "डेमो": "demo",

  // AC sub-complaint keywords
  "कूलिंग": "cooling",

  // Engine sub-complaint keywords
  "स्मोक": "smoke",
  "धुआ": "dhua",
  "ध्यूआ": "dhua",
  "नाइस": "noise",
  "नॉइज़": "noise",
  "नॉइज": "noise",
  "आवाज़": "awaz",
  "आवाज": "awaz",
  "गरम": "garam",
  "ओवरहीट": "overheat",
  "स्टार्ट नहीं": "start",
  "स्टार्ट": "start",
  "मिसिंग": "missing",
  "हीट": "heat",

  // Hydraulic sub-complaint keywords
  "प्रेशर": "pressure",
  "लीक": "leak",
  "लीकेज": "leak",
  "स्लो": "slow",
  "धीरे": "dheere",
  "कम": "kam",

  // Electrical sub-complaint keywords
  "स्टार्टर": "starter",
  "सेल्फ": "self",
  "वायरिंग": "wiring",
  "लाइट": "light",
  "आरपीएम": "rpm",
  "मीटर": "meter",

  // Tyre sub-complaint keywords
  "पंक्चर": "puncture",
  "फटा गया": "phatta",
  "फटे गए": "phatta",
  "फट गया": "phatta",
  "फटा": "phatta",
  "फटे": "phatta",
  "फट": "phatta",
  "कट गया": "cut",
  "कट": "cut",
  "डेड": "dead",

  // Transmission sub-complaint keywords
  "गियर": "gear",
  "गिय़ार": "gear",
  "ब्रेक": "brake",
  "रिवर्स": "reverse",

  // Ram/Cylinder sub-complaint keywords
  "रॉड": "rod",
  "रैम": "ram",
  "सील": "seal",
  "बेंड": "bend",
  "टूटा गया": "toot",
  "टूटा": "toot",
  "टूटे": "toot",

  // Hose sub-complaint keywords
  "होस": "hose",
  "पाइप": "pipe",
  "ओ रिंग": "o ring",

  // Under Carriage sub-complaint keywords
  "ट्रैक": "track",
  "रोलर": "roller",
  "आइडलर": "idler",
  "आइडलेर": "idler",
  "स्प्रॉकेट": "sprocket",
};

const sortedHindiKeys = Object.keys(hindiToEnglishMap).sort(
  (a, b) => b.length - a.length
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
      "nahi kar rahi": "AC not Cooling",
      band: "AC not Working",
      "not working": "AC not Working",
      kaam: "AC not Working",
    },
  },

  Engine: {
    question:
      "Engine mein kya dikkat hai? Overheating hai, smoke aa raha hai, noise hai ya start mein problem hai?",
    options: {
      overheat: "Engine Over heating",
      garam: "Engine Over heating",
      heat: "Engine Over heating",
      smoke: "Smoke problem",
      dhua: "Smoke problem",
      noise: "Abnormal Noise",
      awaz: "Abnormal Noise",
      start: "Missing problem",
      missing: "Missing problem",
    },
  },

  Hydraulic: {
    question:
      "Hydraulic mein kya problem hai? Pressure kam hai, leak hai ya machine slow chal rahi hai?",
    options: {
      pressure: "Pressure down",
      kam: "Pressure down",
      leak: "Hydraulic pump leak",
      slow: "Machine performance low/Slow working",
      dheere: "Machine performance low/Slow working",
    },
  },

  "Electrical Complaint": {
    question:
      "Electrical mein kya dikkat hai? Battery hai, self starter hai, wiring hai ya light mein problem hai?",
    options: {
      battery: "Battery problem",
      starter: "Self/Starter motor problem",
      self: "Self/Starter motor problem",
      wiring: "Wiring problem",
      light: "Light not working",
      rpm: "speed/rpm meter not working",
      meter: "speed/rpm meter not working",
    },
  },

  "Tyre/Battery": {
    question:
      "Tyre mein kya problem hai? Phatta gaya hai, puncture hai ya cut hai?",
    options: {
      puncture: "Tyre puncture",
      phatta: "Tyre puncture",
      burst: "Tyre puncture",
      cut: "Tyre cut",
      battery: "Battery problem",
      dead: "Battery problem",
    },
  },

  "Transmission/Axle components": {
    question:
      "Transmission mein kya problem hai? Gear hai, brake hai ya reverse mein dikkat hai?",
    options: {
      gear: "Gear box problem",
      gearbox: "Gear box problem",
      brake: "Brake problem",
      reverse: "Reverse forward issue",
    },
  },

  "Ram/Cylinder": {
    question:
      "Ram ya cylinder mein kya problem hai? Leak hai, rod bend hai ya rod toot gaya hai?",
    options: {
      leak: "Ram leak",
      bend: "Rod bend",
      toot: "Rod broken",
      broken: "Rod broken",
      seal: "Seal leak",
    },
  },

  Hose: {
    question:
      "Hose mein kya problem hai? Cut hai, leak hai ya O-ring mein dikkat hai?",
    options: {
      cut: "Hose cut",
      leak: "Hose leakages",
      "o ring": "Hose O ring Cut",
      oring: "Hose O ring Cut",
    },
  },

  "Under Carriage": {
    question:
      "Under carriage mein kya problem hai? Track hai, roller hai ya idler mein dikkat hai?",
    options: {
      track: "Track Motor leak",
      roller: "Roller leakage",
      idler: "Idler wheel noise",
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
   HELPER FUNCTIONS
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
          (w) =>
            w.length > 2 &&
            (keyword.includes(w) || w.includes(keyword))
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
  
  if (text.includes("breakdown") || text.includes("खराब") || text.includes("band")) {
    return "Break Down";
  }
  if (text.includes("running") || text.includes("चल रहा") || text.includes("चालू")) {
    if (text.includes("problem") || text.includes("dikkat") || text.includes("दिक्कत")) {
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
  const customer = await Customer.findById(call.temp.customerId);

  if (!customer) {
    twiml.say("Technical error. Aapko agent se connect kiya ja raha hai.");
    twiml.dial(process.env.HUMAN_AGENT_NUMBER);
    call.step = "done";
    return;
  }

  const branchOutlet = detectBranchAndOutlet(customer.city);

  await Complaint.create({
    customerId: customer._id,
    
    // Machine details
    machineNo: customer.chassisNo || "Unknown",
    chassisNo: customer.chassisNo || "Unknown",
    customerName: customer.name || "Unknown",
    registeredPhone: customer.phone || "Unknown",
    machineModel: customer.model || "Unknown",
    machineType: call.temp.machineType || "NA",
    purchaseDate: customer.purchaseDate || null,
    businessPartnerCode: customer.businessPartnerCode || "",
    
    // Complaint details
    complaintGivenByName: call.temp.complaintGivenByName || "Unknown",
    complaintGivenByPhone: call.temp.complaintGivenByPhone || "Unknown",
    machineStatus: call.temp.machineStatus || "Unknown",
    jobLocation: call.temp.jobLocation || "Onsite",
    
    // Branch and outlet
    branch: branchOutlet.branch,
    outlet: branchOutlet.outlet,
    
    // Complaint classification
    description_raw: call.temp.rawComplaint || "Not provided by caller",
    complaintTitle: call.temp.complaintTitle || "NA",
    complaintSubTitle: call.temp.complaintSubTitle || "Other",
    
    // Call metadata
    callSid: CallSid,
    source: "IVR_VOICE_BOT",
    complainBy: "Customer",
  });

  console.log("✅ Complaint saved —", call.temp.complaintTitle, "/", call.temp.complaintSubTitle);

  call.step = "done";
  twiml.say(
    { voice: "Polly.Aditi", language: "hi-IN" },
    "Dhanyavaad. Aapki complaint register ho gayi hai. Hamari team jaldi hi aapko contact karegi."
  );
  twiml.hangup();
}

/* =======================
   INCOMING CALL
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
    { upsert: true, new: true }
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
    "Complaint register karne ke liye ek dabayien. Human agent se baat karne ke liye do dabayien."
  );

  res.type("text/xml").send(twiml.toString());
});

/* =======================
   PROCESS CALL
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

  /* =======================
     IVR MENU
  ======================= */
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
        call
      );
      await call.save();
      return res.type("text/xml").send(twiml.toString());
    }

    ask(twiml, "Kripya ek ya do dabayien.", call);
    await call.save();
    return res.type("text/xml").send(twiml.toString());
  }

  /* =======================
     SPEECH PROCESSING
  ======================= */
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
        "Humein aawaz sunai nahi de rahi. Aapko agent se connect kiya ja raha hai."
      );
      twiml.dial(process.env.HUMAN_AGENT_NUMBER);
      return res.type("text/xml").send(twiml.toString());
    }

    ask(twiml, call.temp.lastQuestion || "Kripya apna jawab bolein.", call);
    await call.save();
    return res.type("text/xml").send(twiml.toString());
  }

  /* =======================
     STATE MACHINE
  ======================= */
  switch (call.step) {
    /* ─────────── IDENTIFIER ─────────── */
    case "ask_identifier": {
      let digits = speech.replace(/\D/g, "");

      if (digits.length < 10) {
        const wordDigits = wordsToDigits(speech);
        if (wordDigits.length >= 10) {
          digits = wordDigits;
        }
      }

      let customer = null;
      let chassis = speech.replace(/\s+/g, "").toUpperCase();
      const digitFromWords = wordsToDigits(speech);
      if (digitFromWords.length >= 4) {
        chassis = digitFromWords;
      }

      // Try MongoDB first
      if (digits.length === 10) {
        customer = await Customer.findOne({ phone: digits });
      }
      if (!customer) {
        customer = await Customer.findOne({ chassisNo: chassis });
      }

      // Try external API if not found
      if (!customer) {
        console.log("🔍 Customer not found in MongoDB, checking external API...");
        
        const externalData = await fetchCustomerFromExternal({
          phone: digits.length === 10 ? digits : null,
          chassisNo: chassis.length >= 4 ? chassis : null,
        });

        if (externalData) {
          try {
            customer = await Customer.create({
              chassisNo: externalData.chassisNo,
              phone: externalData.phone,
              name: externalData.name,
              city: externalData.city,
              model: externalData.model,
              machineType: externalData.machineType,
              businessPartnerCode: externalData.businessPartnerCode,
              purchaseDate: externalData.purchaseDate,
              source: externalData.source,
            });
            console.log("✅ External customer saved to MongoDB:", customer._id);
          } catch (saveError) {
            console.error("❌ Failed to save external customer:", saveError.message);
            customer = null;
          }
        }
      }

      // Handle not found
      if (!customer) {
        call.temp.retries = (call.temp.retries || 0) + 1;

        if (call.temp.retries >= 3) {
          twiml.say(
            { voice: "Polly.Aditi", language: "hi-IN" },
            "Humein details verify nahi ho pa rahi. Aapko agent se connect kiya ja raha hai."
          );
          twiml.dial(process.env.HUMAN_AGENT_NUMBER);
          await call.save();
          return res.type("text/xml").send(twiml.toString());
        }

        ask(
          twiml,
          "Record nahi mila. Kripya chassis number ya registered mobile number dobara boliye.",
          call
        );
        break;
      }

      // Customer found - continue to next step
      call.temp.customerId = customer._id.toString();
      call.temp.retries = 0;
      call.step = "ask_complaint_given_by_name";

      ask(
        twiml,
        `Aapka record mil gaya. ${customer.name} ji, complaint kis ke naam se register karni hai?`,
        call
      );
      break;
    }

    /* ─────────── COMPLAINT GIVEN BY NAME ─────────── */
    case "ask_complaint_given_by_name": {
      if (speech.length < 3) {
        ask(twiml, "Kripya poora naam batayein.", call);
        break;
      }
      call.temp.complaintGivenByName = speech;
      call.step = "ask_complaint_given_by_phone";
      ask(twiml, "Complaint dene wale ka phone number boliye.", call);
      break;
    }

    /* ─────────── COMPLAINT GIVEN BY PHONE ─────────── */
    case "ask_complaint_given_by_phone": {
      let digits = speech.replace(/\D/g, "");

      if (digits.length < 10) {
        const wordDigits = wordsToDigits(speech);
        if (wordDigits.length >= 10) {
          digits = wordDigits;
        }
      }

      if (digits.length !== 10) {
        ask(twiml, "Kripya 10 digit ka phone number boliye.", call);
        break;
      }

      call.temp.complaintGivenByPhone = digits;
      call.step = "ask_machine_type";
      ask(
        twiml,
        "Machine ka type batayein. Warranty hai, JCB Care hai, Engine Care hai ya demo machine hai?",
        call
      );
      break;
    }

    /* ─────────── MACHINE TYPE ─────────── */
    case "ask_machine_type": {
      const machineType = detectMachineType(speech);

      if (!machineType) {
        call.temp.retries = (call.temp.retries || 0) + 1;

        if (call.temp.retries >= 2) {
          call.temp.machineType = "Warranty"; // Default
          call.temp.retries = 0;
          call.step = "ask_machine_status";
          ask(
            twiml,
            "Machine break down hai ya problem ke saath chal rahi hai?",
            call
          );
          break;
        }

        ask(
          twiml,
          "Kripya boliye: warranty, JCB care, engine care ya demo.",
          call
        );
        break;
      }

      call.temp.machineType = machineType;
      call.temp.retries = 0;
      call.step = "ask_machine_status";
      ask(
        twiml,
        "Machine break down hai ya problem ke saath chal rahi hai?",
        call
      );
      break;
    }

    /* ─────────── MACHINE STATUS ─────────── */
    case "ask_machine_status": {
      const machineStatus = detectMachineStatus(speech);

      if (!machineStatus) {
        call.temp.retries = (call.temp.retries || 0) + 1;

        if (call.temp.retries >= 2) {
          call.temp.machineStatus = "Running With Problem"; // Default
          call.temp.retries = 0;
          call.step = "ask_job_location";
          ask(twiml, "Machine kahan hai? Site par hai ya workshop mein?", call);
          break;
        }

        ask(
          twiml,
          "Kripya boliye: break down hai ya problem ke saath chal rahi hai.",
          call
        );
        break;
      }

      call.temp.machineStatus = machineStatus;
      call.temp.retries = 0;
      call.step = "ask_job_location";
      ask(twiml, "Machine kahan hai? Site par hai ya workshop mein?", call);
      break;
    }

    /* ─────────── JOB LOCATION ─────────── */
    case "ask_job_location": {
      let jobLocation = "Onsite"; // Default

      if (speech.includes("workshop") || speech.includes("वर्कशॉप") || speech.includes("garage")) {
        jobLocation = "Work Shop";
      }

      call.temp.jobLocation = jobLocation;
      call.step = "ask_complaint";
      call.temp.retries = 0;
      ask(twiml, "Machine ki complaint batayein.", call);
      break;
    }

    /* ─────────── COMPLAINT DETECTION ─────────── */
    case "ask_complaint": {
      call.temp.rawComplaint = rawSpeech;

      const intent = detectComplaintIntent(speech);

      if (!intent) {
        call.temp.retries = (call.temp.retries || 0) + 1;

        if (call.temp.retries >= 2) {
          call.temp.retries = 0;
          ask(
            twiml,
            "Kripya bolein: engine, tyre, AC, hydraulic ya electrical.",
            call
          );
          break;
        }

        ask(
          twiml,
          "Kripya engine, hydraulic, AC, electrical ya tyre ka problem batayein.",
          call
        );
        break;
      }

      call.temp.retries = 0;
      call.temp.detectedIntentPrimary = intent.primary;
      call.temp.detectedIntentConfidence = intent.confidence;

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
          call
        );
      }
      break;
    }

    /* ─────────── CONFIRM COMPLAINT ─────────── */
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

    /* ─────────── SUB-COMPLAINT ─────────── */
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
      for (const [keyword, subTitle] of Object.entries(followUp.options)) {
        if (speech.includes(keyword)) {
          detectedSub = subTitle;
          break;
        }
      }

      if (!detectedSub) {
        call.temp.subRetries += 1;

        if (call.temp.subRetries >= 2) {
          call.temp.complaintSubTitle = "Other";
          await saveComplaint(twiml, call, CallSid);
          break;
        }

        ask(
          twiml,
          followUp.question + " Kripya thoda clear bolein.",
          call
        );
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