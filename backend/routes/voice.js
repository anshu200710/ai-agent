import express from "express";
import twilio from "twilio";
import axios from "axios";

import CallSession from "../models/CallSession.js";
import Customer from "../models/Customer.js";
import Complaint from "../models/Complaint.js";

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

/* =======================
   COMPLETE COMPLAINT MAPPING WITH SUB-TITLES
======================= */
const complaintMap = {
  "Attachment": {
    keywords: ["attachment", "bucket", "breaker", "rock breaker", "als", "livelink", "अटैचमेंट", "बकेट"],
    subTitles: {
      "ALS problem": ["als", "एएलएस"],
      "Bucket Crack Issue": ["bucket crack", "bucket फटी", "bucket टूटी"],
      "Live link problem": ["livelink", "live link", "लाइवलिंक"],
      "Rock breaker problem": ["rock breaker", "breaker", "रॉक ब्रेकर", "ब्रेकर"]
    }
  },

  "Body Work": {
    keywords: ["body", "bushing", "drum", "noise", "vibration", "बॉडी", "ड्रम"],
    subTitles: {
      "Bushing Work": ["bushing", "बुशिंग"],
      "Leakage from Drum": ["drum leak", "ड्रम लीक"],
      "Noise from Drum": ["drum noise", "drum आवाज", "ड्रम शोर"],
      "Vibration fault in Drum": ["vibration", "कंपन"],
      "Water Sprinkle Pipe fault": ["water pipe", "sprinkle", "पानी पाइप"],
      "color fad problem": ["color", "paint", "रंग"],
      "Decal/Sticker Pesting": ["sticker", "decal", "स्टीकर"]
    }
  },

  "Cabin": {
    keywords: ["cabin", "cab", "door", "glass", "seat", "केबिन", "सीट", "दरवाजा"],
    subTitles: {
      "bonnet crack": ["bonnet crack", "bonnet फटी"],
      "Cab Door Fault": ["door", "दरवाजा"],
      "Cabin glass cracked": ["glass crack", "शीशा टूटा"],
      "Cabin Glass removed": ["glass remove", "शीशा हटा"],
      "Door/window lock inoperative": ["lock", "ताला"],
      "Fan not working": ["fan", "पंखा"],
      "mounting problem": ["mounting", "माउंटिंग"],
      "Operator Seat problems": ["seat", "सीट"],
      "Roof cracked": ["roof crack", "छत"]
    }
  },

  "Electrical Complaint": {
    keywords: ["electrical", "battery", "light", "wiring", "starter", "बिजली", "बैटरी", "लाइट", "वायरिंग"],
    subTitles: {
      "Alternator not Working": ["alternator", "अल्टरनेटर"],
      "Error Code in Machine display": ["error code", "display error"],
      "Fuel Gauge not show/in correct level show": ["fuel gauge", "फ्यूल गेज"],
      "Fuel Motor not Working": ["fuel motor"],
      "Hour meter not working": ["hour meter", "मीटर"],
      "Light glowing problem": ["light glow", "लाइट जल रही"],
      "Pump water motor": ["water pump motor"],
      "Relay fault": ["relay", "रिले"],
      "Reverse forward switch broken": ["reverse switch", "switch टूटा"],
      "Self/Starter motor problem": ["starter", "self", "सेल्फ", "स्टार्टर"],
      "speed/rpm meter not working": ["rpm", "speed meter", "आरपीएम"],
      "Starting trouble": ["start problem", "start नहीं हो रही", "स्टार्ट दिक्कत", "स्टार्ट नहीं हो रही", "स्टार्ट ट्रबल", "स्टार्ट "],
      "Switch Fault": ["switch", "स्विच"],
      "Warnings/Alarm": ["warning", "alarm", "चेतावनी"],
      "Wiper motor not working": ["wiper", "वाइपर"],
      "Wiring problem": ["wiring", "wire", "वायरिंग", "तार"],
      "Light not working": ["light", "लाइट"],
      "Rope wire broken": ["rope wire", "तार टूटा"],
      "Stop Cable fault": ["stop cable", "केबल"],
      "AC Problem": ["ac", "एसी", "ऐसी", "एकसी", "cooling", "ठंडा", "कूलिंग", "एक", "सी", "ए", "सी", "ऐ", "कूलिंग", "ऐसी"],
    }
  },

  "Engine": {
    keywords: ["engine", "इंजन", "smoke", "overheat", "noise", "धुआ", "गरम"],
    subTitles: {
      "Abnormal Noise": ["noise", "sound", "आवाज", "शोर"],
      "Air problem": ["air", "हवा"],
      "coolant leak": ["coolant leak", "पानी लीक"],
      "Engine accessories": ["accessories", "एक्सेसरीज"],
      "Engine Lugg down": ["lugg down", "power kam"],
      "Engine Over heating": ["overheat", "गरम", "heat", "गर्मी"],
      "Engine seal leak": ["seal leak", "सील लीक"],
      "Fan belt broken": ["fan belt", "belt", "बेल्ट"],
      "FIP issue": ["fip", "एफआईपी"],
      "Fuel consumption high": ["fuel ज्यादा", "diesel ज्यादा", "fuel consumption"],
      "Leakages engine": ["engine leak", "इंजन लीक"],
      "missing problem": ["missing", "मिसिंग"],
      "Oil consumption high": ["oil ज्यादा", "oil consumption"],
      "Radiator leak": ["radiator", "रेडिएटर"],
      "Smoke problem": ["smoke", "धुआ", "धुंआ"],
      "swing motor problem": ["swing motor", "स्विंग मोटर"],
      "Engine mounting problem": ["mounting", "माउंटिंग"],
      "Accelerator cable problem": ["accelerator", "cable", "केबल"]
    }
  },

  "Fabrication part": {
    keywords: ["fabrication", "crack", "boom", "bucket", "chassis", "फैब्रिकेशन", "क्रैक"],
    subTitles: {
      "Boom cracked": ["boom crack", "boom फटी"],
      "Bucket cracked": ["bucket crack", "bucket फटी"],
      "Bucket issue": ["bucket", "बकेट"],
      "Chassis cracked": ["chassis crack", "chassis फटी"],
      "Dipper cracked": ["dipper crack", "dipper फटी"],
      "Fuel Tank Leakage": ["fuel tank leak", "टैंक लीक"],
      "Hydraulic Tank leakage": ["hydraulic tank", "हाइड्रोलिक टैंक"],
      "Inner leg Cracked/Bend": ["inner leg", "leg crack"],
      "King post problem/cracked": ["king post", "पोस्ट"],
      "Loader arm bend": ["loader arm bend", "arm मुड़ा"],
      "Loader arm cracked": ["loader arm crack", "arm फटा"],
      "Pin broken": ["pin broken", "पिन टूटा"],
      "Teeth broken": ["teeth broken", "दांत टूटा"],
      "Tipping lever cracked": ["tipping lever"],
      "Tippnig link problem": ["tipping link"],
      "Tank leak/crack": ["tank", "टैंक"],
      "Stabilizer Pad problem": ["stabilizer", "स्टेबलाइजर"]
    }
  },

  "Transmission/Axle components": {
    keywords: ["transmission", "gear", "brake", "axle", "ट्रांसमिशन", "गियर", "ब्रेक"],
    subTitles: {
      "Abnormal sound Transmission/Axle": ["sound", "noise", "आवाज"],
      "Barring problem": ["barring", "बैरिंग"],
      "Brake problem": ["brake", "ब्रेक"],
      "Gear box problem": ["gear box", "gearbox", "गियर बॉक्स"],
      "Gear hard": ["gear hard", "gear sख्त"],
      "Oil leak from transmission": ["oil leak", "तेल लीक"],
      "Reverse forward issue": ["reverse", "forward", "रिवर्स"],
      "Transmission overheat": ["transmission गरम", "overheat"]
    }
  },

  "Hose": {
    keywords: ["hose", "pipe", "होस", "पाइप"],
    subTitles: {
      "Hose O ring Cut": ["o ring", "oring", "ओ रिंग"],
      "Hose cut": ["hose cut", "होस कटा"],
      "Hose leakages": ["hose leak", "होस लीक"]
    }
  },

  "Hydraulic": {
    keywords: ["hydraulic", "हाइड्रोलिक", "pressure", "pump", "प्रेशर", "पंप"],
    subTitles: {
      "Abnormal sound": ["sound", "noise", "आवाज"],
      "Control Valve leakage": ["control valve", "valve leak"],
      "EVB seal leak": ["evb", "ईवीबी"],
      "Hydra clamp issue": ["hydra clamp"],
      "Hydraulic gauge leakage": ["gauge leak"],
      "Hydraulic pump broken": ["pump broken", "pump टूटा"],
      "Hydraulic pump leak": ["pump leak", "पंप लीक"],
      "Hydraulic pump Noise": ["pump noise", "pump आवाज"],
      "Joy Stick Leakage": ["joystick", "joy stick"],
      "LVB seal leak": ["lvb"],
      "Machine performance low/Slow working": ["slow", "धीरे", "कम speed", "power kam"],
      "Oil cooler leak": ["oil cooler"],
      "Pressure down": ["pressure", "प्रेशर", "कम"],
      "Rotary Coupling leakage": ["rotary coupling"],
      "spool seal leak": ["spool"],
      "Swing Motor leakage": ["swing motor leak"],
      "Swing Motor not braking": ["swing motor brake"],
      "Travel Pedal leakage": ["travel pedal"]
    }
  },

  "Ram/Cylinder": {
    keywords: ["ram", "cylinder", "rod", "सिलेंडर", "रॉड"],
    subTitles: {
      "Boom ram seal leak": ["boom ram", "boom सील"],
      "bucket ram seal leak": ["bucket ram", "bucket सील"],
      "Cylinder welding leak": ["cylinder weld", "welding"],
      "Dipper ram seal leak": ["dipper ram", "dipper सील"],
      "Dozer Cylinder leak": ["dozer cylinder"],
      "Dozer ram seal leak": ["dozer ram"],
      "kpc/selw cylinder seal leak": ["kpc", "selw"],
      "Lift ram seal leak": ["lift ram"],
      "Ram leak": ["ram leak", "राम लीक"],
      "Rod bend": ["rod bend", "rod मुड़ा", "रॉड मुड़ा"],
      "Rod broken": ["rod broken", "rod टूटा", "रॉड टूटा"],
      "Rod scratch": ["rod scratch", "rod खरोंच"],
      "Slew ram seal leak": ["slew ram"],
      "Stabilizer ram seal leak": ["stabilizer ram"],
      "Steering ram seal leak": ["steering ram"]
    }
  },

  "Service": {
    keywords: ["service", "सर्विस", "servicing"],
    subTitles: {
      "Actual Service": ["actual service", "regular service"],
      "Service Visit": ["service visit", "visit"]
    }
  },

  "Tyre/Battery": {
    keywords: ["tyre", "tire", "battery", "puncture", "टायर", "बैटरी", "पंक्चर"],
    subTitles: {
      "Battery problem": ["battery", "बैटरी", "dead"],
      "Tube joint opened": ["tube joint", "tube खुला"],
      "Tube puncture": ["tube puncture", "ट्यूब पंक्चर"],
      "Tyre burst": ["burst", "फटा", "फूटा"],
      "Tyre cut": ["tyre cut", "tire cut", "टायर कटा"],
      "Tyre rubber breaking": ["rubber break", "rubber टूट रहा"]
    }
  },

  "Under Carriage": {
    keywords: ["under carriage", "track", "roller", "idler", "sprocket", "ट्रैक", "रोलर"],
    subTitles: {
      "Idler wheel leakage": ["idler leak", "आइडलर लीक"],
      "Idler wheel noise": ["idler noise", "idler आवाज"],
      "Ring gear Crack": ["ring gear", "गियर क्रैक"],
      "Roller Bent": ["roller bend", "रोलर मुड़ा"],
      "Roller leakage": ["roller leak", "रोलर लीक"],
      "Sprocket Wear": ["sprocket", "स्प्रॉकेट"],
      "Track gear Box noise": ["track gear noise"],
      "Track Motor leak": ["track motor", "ट्रैक मोटर"],
      "Track Shoe bend/Broken": ["track shoe", "shoe टूटा"],
      "Track tension yoke,spring broken": ["tension", "spring", "yoke"]
    }
  },

  "PDI": {
    keywords: ["pdi", "पीडीआई"],
    subTitles: {
      "PDI": ["pdi"]
    }
  },

  "Installation": {
    keywords: ["installation", "install", "इंस्टालेशन"],
    subTitles: {
      "Installation visit": ["installation", "install"]
    }
  },

  "General Visit": {
    keywords: ["visit", "general", "monthly", "विजिट"],
    subTitles: {
      "ASC Visit": ["asc"],
      "BW Visit": ["bw"],
      "General Visit": ["general visit", "visit"],
      "Monthly Visit": ["monthly", "महीने"],
      "Number plate fitment": ["number plate", "plate"],
      "Accidental": ["accident", "एक्सीडेंट"]
    }
  },

  "Livelink": {
    keywords: ["livelink", "live link", "लाइवलिंक"],
    subTitles: {
      "Livelink not working": ["livelink", "live link"],
      "Alert": ["alert", "अलर्ट"]
    }
  },

  "ECU problem": {
    keywords: ["ecu", "ईसीयू"],
    subTitles: {}
  },

  "Campaign": {
    keywords: ["campaign", "fsi", "कैम्पेन"],
    subTitles: {
      "Campaign Visit": ["campaign"],
      "FSI": ["fsi", "एफएसआई"]
    }
  },

  "AC System": {
    keywords: ["ac", "एसी", "ऐसी", "cooling", "ठंडा", "कूलिंग"],
    subTitles: {
      "AC not Working": ["ac नहीं चल रही", "ac band", "ac not working", "काम नहीं कर रही"],
      "AC not Cooling": ["cooling", "ठंडा नहीं", "ठंडी नहीं", "कूलिंग नहीं"]
    }
  }
};

/* =======================
   SMART FOLLOW-UP QUESTIONS (Enhanced)
======================= */
const smartFollowUpQuestions = {
  // When chassis number not known
  "chassis_unknown": [
    "Koi baat nahi. Aap machine kab se use kar rahe hain?",
    "Machine ka model batayein? JCB 3DX hai ya koi aur?",
    "Machine ki koi aur pehchan batayein jaise registration number?"
  ],
  
  // When problem not clear
  "problem_unclear": [
    "Machine kab se band hai?",
    "Kya machine bilkul band hai ya thodi bahut chal rahi hai?",
    "Pichli baar machine kab theek thi?",
    "Machine mein koi aawaz aa rahi hai?",
    "Kya koi smoke ya dhuan aa raha hai?",
    "Kya machine start ho rahi hai?"
  ],

  // Time-based questions
  "timeline": [
    "Yeh problem kab se hai?",
    "Kya yeh achanak hua ya dheere dheere?",
    "Pichli servicing kab hui thi?"
  ],

  // Severity questions
  "severity": [
    "Kya machine bilkul band hai ya kuch kaam kar rahi hai?",
    "Kya machine chalane mein khatraa hai?",
    "Kya machine se koi leak ho raha hai?"
  ]
};

/* =======================
   CONFUSION DETECTION & HANDLING
======================= */
function detectConfusion(text, context = {}) {
  if (!text) return { isConfused: true, reason: "empty_response" };

  const confusionPatterns = {
    repetition: /\b(\w+)\s+\1\b/gi,
    questioning: /(kya|kaun|kahan|kaise|kab|kyun)\s+(kya|kaun|kahan|kaise|kab|kyun)/gi,
    uncertainty: /(pata nahi|yaad nahi|maloom nahi|samajh nahi|nahi pata)/gi,
    filler: /^(haan|nahi|ji|hmm|uh|um|aa)\s*$/gi,
    repeat_request: /(dobara|fir se|repeat|phir|ek baar aur)/gi
  };

  const confusionIndicators = {
    isConfused: false,
    reason: null,
    confidence: 0
  };

  // Check each pattern
  for (const [key, pattern] of Object.entries(confusionPatterns)) {
    if (pattern.test(text)) {
      confusionIndicators.isConfused = true;
      confusionIndicators.reason = key;
      confusionIndicators.confidence = 0.8;
      break;
    }
  }

  // Check if response is too short and not a valid answer
  if (text.length < 3 && !['haan', 'nahi', 'ji', 'yes', 'no', 'हां', 'नहीं'].includes(text.toLowerCase())) {
    confusionIndicators.isConfused = true;
    confusionIndicators.reason = "too_short";
    confusionIndicators.confidence = 0.9;
  }

  return confusionIndicators;
}

function handleConfusion(confusionType, lastQuestion, call) {
  const clarifications = {
    repetition: "Main samajh nahi paaya. Kripya clearly bolein.",
    questioning: lastQuestion ? `${lastQuestion} - Sirf apna jawab bolein.` : "Kripya simple shabd mein jawab dein.",
    uncertainty: "Koi dikkat nahi. Jo bhi aapko yaad hai woh batayein.",
    filler: lastQuestion || "Kripya apna jawab bolein.",
    repeat_request: lastQuestion || "Main fir se pooch raha hoon:",
    too_short: "Thoda detail mein batayein.",
    empty_response: "Kripya apna jawab bolein."
  };

  return clarifications[confusionType] || lastQuestion || "Kripya dobara bolein.";
}

/* =======================
   ENHANCED COMPLAINT DETECTION
======================= */
function detectComplaintIntent(text, previousContext = {}) {
  if (!text) return null;

  const matches = [];
  const confidenceScores = {};

  // Check against all complaint categories
  for (const [title, data] of Object.entries(complaintMap)) {
    let matchScore = 0;
    let matchedKeywords = [];

    // Check main keywords
    for (const keyword of data.keywords) {
      if (text.includes(keyword)) {
        matchScore += 2;
        matchedKeywords.push(keyword);
      }
    }

    // Check sub-title keywords for better accuracy
    if (data.subTitles) {
      for (const [subTitle, subKeywords] of Object.entries(data.subTitles)) {
        for (const subKeyword of subKeywords) {
          if (text.includes(subKeyword)) {
            matchScore += 3; // Higher score for specific sub-keywords
            matchedKeywords.push(subKeyword);
          }
        }
      }
    }

    if (matchScore > 0) {
      matches.push(title);
      confidenceScores[title] = matchScore;
    }
  }

  if (matches.length === 0) return null;

  // Sort by confidence score
  matches.sort((a, b) => confidenceScores[b] - confidenceScores[a]);

  const topScore = confidenceScores[matches[0]];
  const confidence = topScore >= 5 ? 0.95 : topScore >= 3 ? 0.75 : 0.5;

  return {
    primary: matches[0],
    secondary: matches.slice(1, 3),
    confidence: confidence,
    matchedKeywords: matches.map(m => ({
      title: m,
      score: confidenceScores[m]
    }))
  };
}

function detectSubComplaint(mainComplaint, text) {
  if (!mainComplaint || !complaintMap[mainComplaint]) return null;

  const subTitles = complaintMap[mainComplaint].subTitles;
  if (!subTitles || Object.keys(subTitles).length === 0) {
    return { subTitle: "Other", confidence: 1.0 };
  }

  let bestMatch = null;
  let highestScore = 0;

  for (const [subTitle, keywords] of Object.entries(subTitles)) {
    let score = 0;
    for (const keyword of keywords) {
      if (text.includes(keyword)) {
        score += keyword.length; // Longer keywords = more specific = higher score
      }
    }

    if (score > highestScore) {
      highestScore = score;
      bestMatch = subTitle;
    }
  }

  if (bestMatch) {
    return {
      subTitle: bestMatch,
      confidence: highestScore >= 5 ? 0.9 : 0.7
    };
  }

  return { subTitle: "Other", confidence: 0.5 };
}

/* =======================
   SMART QUESTION SELECTOR
======================= */
function getSmartFollowUp(context) {
  const { step, attemptCount, lastIntent, customerData } = context;

  // If chassis number unknown
  if (step === 'ask_identifier' && attemptCount >= 2) {
    return smartFollowUpQuestions.chassis_unknown[attemptCount % smartFollowUpQuestions.chassis_unknown.length];
  }

  // If problem unclear
  if (step === 'ask_complaint' && attemptCount >= 1) {
    return smartFollowUpQuestions.problem_unclear[attemptCount % smartFollowUpQuestions.problem_unclear.length];
  }

  // Timeline questions for severity assessment
  if (lastIntent && attemptCount === 0) {
    return smartFollowUpQuestions.timeline[0];
  }

  return null;
}

/* =======================
   GENERATE SUBCOMPLAINT QUESTION
======================= */
function generateSubComplaintQuestion(mainComplaint) {
  const data = complaintMap[mainComplaint];
  if (!data || !data.subTitles || Object.keys(data.subTitles).length === 0) {
    return null;
  }

  const questions = {
    "AC System": "AC bilkul band hai ya sirf thanda nahi kar rahi?",
    "Engine": "Engine mein exactly kya problem hai? Overheating, smoke, noise ya start mein dikkat?",
    "Hydraulic": "Hydraulic mein kya issue hai? Pressure kam hai, leak hai ya machine slow chal rahi hai?",
    "Electrical Complaint": "Electrical mein kya problem hai? Battery, starter, light ya wiring?",
    "Tyre/Battery": "Tyre puncture hai, phatta hai ya battery ki problem hai?",
    "Transmission/Axle components": "Gear mein problem hai, brake mein ya reverse forward mein?",
    "Ram/Cylinder": "Ram ya cylinder mein leak hai, rod bend hai ya kuch aur?",
    "Hose": "Hose cut hai ya leak hai?",
    "Under Carriage": "Track, roller ya idler mein problem hai?",
    "Body Work": "Body mein kya problem hai? Crack, leak ya noise?",
    "Cabin": "Cabin mein door, glass, seat ya aur kuch?",
    "Fabrication part": "Kaunsa part crack hua hai? Boom, bucket, chassis ya aur kuch?",
    "Attachment": "Attachment mein kya problem hai?"
  };

  return questions[mainComplaint] || `${mainComplaint} mein exactly kya problem hai? Thoda detail mein batayein.`;
}

/* =======================
   [REST OF THE UTILITY FUNCTIONS FROM ORIGINAL CODE]
   Including: detectBranchAndOutlet, fetchCustomerFromExternal, 
   submitComplaintToExternal, translateComplaintToEnglish,
   cleanSpeech, normalizeText, safeAscii, getCallerName,
   formatDateForExternal, normalizePersonName, hindiToEnglishMap,
   normalizeHindiIntent, hindiNumberMap, wordsToDigits, etc.
======================= */

function detectBranchAndOutlet(city) {
  if (!city) return { branch: "NA", outlet: "NA", cityCode: "NA" };
  const normalized = city.toLowerCase().trim();
  const result = cityToBranchMap[normalized];
  return result || { branch: "NA", outlet: "NA", cityCode: "NA" };
}

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

function translateComplaintToEnglish(rawText) {
  if (!rawText) return "Not provided by caller";

  let text = rawText.toLowerCase();

  const hindiToEnglishMap = {
    "टायर नहीं": "tyre",
    टायर: "tyre",
    एसी: "ac",
    ऐसी: "ac",
    "ए.सी": "ac",
    "ए सी": "ac",
    इंजन: "engine",
    हाइड्रोलिक: "hydraulic",
    बिजली: "electrical",
    इलेक्ट्रिकल: "electrical",
    इंडियन: "engine",
    बैटरी: "battery",
    "काम नहीं": "not working",
    "कूलिंग नहीं": "cooling not working",
    ठंडा: "cooling",
    कूलिंग: "cooling",
    खराब: "breakdown",
    बंद: "breakdown",
    प्रॉब्लम: "problem",
    समस्या: "problem",
  };

  for (const [hindi, english] of Object.entries(hindiToEnglishMap)) {
    const regex = new RegExp(hindi, "gi");
    text = text.replace(regex, english);
  }

  text = text
    .replace(/\s+/g, " ")
    .replace(/[^\x00-\x7F]/g, "")
    .trim();

  return text || "Not provided by caller";
}

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
  
  const transliterationMap = {
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
  
  let transliterated = text;
  for (const [hindi, english] of Object.entries(transliterationMap)) {
    transliterated = transliterated.replace(new RegExp(hindi, 'g'), english);
  }
  
  const cleaned = transliterated
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x00-\x7F]/g, "")
    .trim();
  
  return cleaned || "Unknown";
}

function getCallerName(call, customerData) {
  const spokenName = normalizePersonName(call.temp.complaintGivenByName);
  if (spokenName) {
    const asciiName = safeAscii(spokenName);
    if (asciiName && asciiName !== "Unknown" && asciiName.length >= 2) {
      return asciiName;
    }
  }

  if (customerData?.name && customerData.name !== "Unknown") {
    return safeAscii(customerData.name);
  }

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

function normalizePersonName(text) {
  if (!text) return null;

  const cleaned = text
    .replace(/[0-9]/g, "")
    .replace(/(kya|kaun|hai|bolo|repeat|dobara|aaj|kal|baje|subah|sham|din|raat|ghante|minute)/gi, "")
    .replace(/[:]/g, "")
    .trim();

  if (cleaned.length >= 2 && /[a-zA-Z\u0900-\u097F]/.test(cleaned)) {
    return cleaned;
  }

  return null;
}

function normalizeHindiIntent(text) {
  if (!text) return "";
  const hindiMap = {
    "एसी": "ac",
    "इंजन": "engine",
    "हाइड्रोलिक": "hydraulic",
    "बिजली": "electrical",
    "टायर": "tyre",
    "बैटरी": "battery"
  };
  
  let normalized = text;
  for (const [hindi, english] of Object.entries(hindiMap)) {
    if (normalized.includes(hindi)) {
      normalized += " " + english;
    }
  }
  return normalized;
}

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
    text.includes("ब्रेकडाउन")
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
  
  const callerNameFinal = getCallerName(call, customerData);

  const callerPhoneFinal =
    call.temp.complaintGivenByPhone &&
    /^\d{10}$/.test(call.temp.complaintGivenByPhone)
      ? call.temp.complaintGivenByPhone
      : customerData.phone;

  const complaintDetailsEnglish = translateComplaintToEnglish(
    call.temp.rawComplaint || ""
  );

  const finalSubTitle = call.temp.complaintSubTitle && 
                        call.temp.complaintSubTitle !== "Other" 
                        ? call.temp.complaintSubTitle 
                        : "Other";

  console.log("🔍 Final processed data:");
  console.log("   Caller Name:", callerNameFinal);
  console.log("   Caller Phone:", callerPhoneFinal);
  console.log("   Complaint Title:", call.temp.complaintTitle);
  console.log("   Subtitle:", finalSubTitle);
  console.log("   Details:", complaintDetailsEnglish);

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
    complaint_details: call.temp.rawComplaint || "Not provided by caller",
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
      temp: { retries: 0, attemptCount: 0 },
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
   CALL PROCESSING HANDLER (ENHANCED)
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

  // Initialize attempt tracking
  if (!call.temp.attemptCount) {
    call.temp.attemptCount = 0;
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

  // ✨ Enhanced confusion detection
  const confusionCheck = detectConfusion(rawSpeech, {
    step: call.step,
    lastQuestion: call.temp.lastQuestion
  });

  if (confusionCheck.isConfused) {
    console.log("😕 Confusion detected:", confusionCheck.reason);
    
    const clarification = handleConfusion(
      confusionCheck.reason,
      call.temp.lastQuestion,
      call
    );
    
    call.temp.attemptCount += 1;
    
    // Use smart follow-up after 2 confusion attempts
    if (call.temp.attemptCount >= 2) {
      const smartQuestion = getSmartFollowUp({
        step: call.step,
        attemptCount: call.temp.attemptCount,
        lastIntent: call.temp.detectedIntentPrimary,
        customerData: call.temp.customerData
      });
      
      if (smartQuestion) {
        ask(twiml, smartQuestion, call);
        await call.save();
        return res.type("text/xml").send(twiml.toString());
      }
    }
    
    // After 3 total confusion attempts, transfer to agent
    if (call.temp.attemptCount >= 3) {
      twiml.say(
        { voice: "Polly.Aditi", language: "hi-IN" },
        "Main aapki baat theek se samajh nahi paa raha. Aapko agent se connect kar raha hoon."
      );
      twiml.dial(process.env.HUMAN_AGENT_NUMBER);
      await call.save();
      return res.type("text/xml").send(twiml.toString());
    }
    
    ask(twiml, clarification, call);
    await call.save();
    return res.type("text/xml").send(twiml.toString());
  }

  // Reset attempt count on successful response
  call.temp.attemptCount = 0;

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

        // Use smart follow-up for chassis number issues
        const smartQ = getSmartFollowUp({
          step: 'ask_identifier',
          attemptCount: call.temp.retries
        });
        
        ask(twiml, smartQ || "Record nahi mila. Kripya chassis number ya mobile number dobara boliye.", call);
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
        `Aapka record mil gaya. ${externalData.name} ji, Kripya apna pura naam btaiye?`,
        call,
      );
      break;
    }

    case "ask_complaint_given_by_name": {
      const cleanedName = normalizePersonName(rawSpeech);
      
      if (!cleanedName || cleanedName.length < 2) {
        call.temp.retries = (call.temp.retries || 0) + 1;
        
        if (call.temp.retries >= 2) {
          call.temp.complaintGivenByName = call.temp.customerData?.name || "Customer";
          call.temp.retries = 0;
          call.step = "ask_complaint_given_by_phone";
          ask(twiml, "apna 10 digit contact number btaiye", call);
          break;
        }
        
        ask(twiml, "Kripya apna poora naam btaiye.", call);
        break;
      }
      
      call.temp.complaintGivenByName = rawSpeech;
      call.temp.retries = 0;
      call.step = "ask_complaint_given_by_phone";
      ask(twiml, "apna 10 digit contact number btaiye.", call);
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
      call.temp.rawComplaint = rawSpeech;
      call.temp.englishComplaint = translateComplaintToEnglish(rawSpeech);

      console.log("📝 Complaint captured:");
      console.log("   Raw:", call.temp.rawComplaint);
      console.log("   English:", call.temp.englishComplaint);

      const intent = detectComplaintIntent(speech);

      if (!intent) {
        call.temp.retries = (call.temp.retries || 0) + 1;

        if (call.temp.retries >= 2) {
          // Use smart follow-up questions
          const smartQ = getSmartFollowUp({
            step: 'ask_complaint',
            attemptCount: call.temp.retries
          });
          
          ask(twiml, smartQ || "Kripya engine, tyre, AC, hydraulic ya electrical ka problem batayein.", call);
          break;
        }

        ask(
          twiml,
          "Kripya complaint clear batayein. Engine, hydraulic, AC, electrical ya tyre?",
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

        // Generate smart sub-complaint question
        const subQuestion = generateSubComplaintQuestion(intent.primary);
        
        if (subQuestion) {
          call.step = "ask_sub_complaint";
          call.temp.subRetries = 0;
          ask(twiml, subQuestion, call);
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

        const subQuestion = generateSubComplaintQuestion(title);
        
        if (subQuestion) {
          call.step = "ask_sub_complaint";
          call.temp.subRetries = 0;
          ask(twiml, subQuestion, call);
        } else {
          call.temp.complaintSubTitle = "Other";
          await saveComplaint(twiml, call, CallSid);
        }
        break;
      }

      if (isNo) {
        call.step = "ask_complaint";
        call.temp.retries = 0;
        ask(twiml, "Theek hai, kripya complaint dobara batayein.", call);
        break;
      }

      ask(twiml, "Kripya haan ya nahi bolein.", call);
      break;
    }

    case "ask_sub_complaint": {
      const title = call.temp.complaintTitle;
      
      if (!complaintMap[title] || !complaintMap[title].subTitles) {
        call.temp.complaintSubTitle = "Other";
        await saveComplaint(twiml, call, CallSid);
        break;
      }

      call.temp.subRetries = call.temp.subRetries || 0;

      // Enhanced sub-complaint detection
      const subResult = detectSubComplaint(title, speech + " " + rawSpeech);

      if (!subResult || subResult.confidence < 0.6) {
        call.temp.subRetries += 1;

        if (call.temp.subRetries >= 2) {
          call.temp.complaintSubTitle = "Other";
          console.log("⚠️  Sub-complaint detection failed, using 'Other'");
          await saveComplaint(twiml, call, CallSid);
          break;
        }

        const subQuestion = generateSubComplaintQuestion(title);
        ask(twiml, subQuestion + " Thoda aur clear batayein.", call);
        break;
      }

      call.temp.complaintSubTitle = subResult.subTitle;
      console.log("✅ Sub-complaint detected:", subResult.subTitle);
      await saveComplaint(twiml, call, CallSid);
      break;
    }
  }

  await call.save();
  res.type("text/xml").send(twiml.toString());
});

export default router;