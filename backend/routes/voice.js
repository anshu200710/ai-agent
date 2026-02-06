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
   ADVANCED NLU - INTENT DETECTION
======================= */
const intentPatterns = {
  // User is correcting/disagreeing
  correction: {
    patterns: [
      /नहीं\s*नहीं/i,
      /maine\s*(ye\s*)?nahi\s*kaha/i,
      /maine.*nahi.*bola/i,
      /galat\s*hai/i,
      /ye\s*nahi/i,
      /nahi\s*ji/i,
      /bilkul\s*nahi/i,
      /aisa\s*nahi/i,
      /sahi\s*nahi/i,
      /theek\s*nahi/i,
    ],
    priority: 100,
  },
  
  // User wants to skip/go to agent
  escalation: {
    patterns: [
      /agent\s*se\s*baat/i,
      /kisi\s*se\s*baat/i,
      /insaan\s*se/i,
      /call\s*transfer/i,
      /forward\s*kar/i,
      /samajh\s*nahi\s*aa\s*raha/i,
    ],
    priority: 95,
  },
  
  // User is asking a different question
  different_question: {
    patterns: [
      /main\s*ye\s*nahi\s*pooch\s*raha/i,
      /doosra\s*sawaal/i,
      /kuch\s*aur\s*poochna/i,
      /pehle\s*ye\s*batao/i,
      /ek\s*minute/i,
      /ruko/i,
      /wait/i,
    ],
    priority: 90,
  },
  
  // User doesn't know/remember
  uncertainty: {
    patterns: [
      /pata\s*nahi/i,
      /yaad\s*nahi/i,
      /maloom\s*nahi/i,
      /samajh\s*nahi/i,
      /nahi\s*pata/i,
      /bhool\s*gaya/i,
      /nahi\s*yaad/i,
    ],
    priority: 85,
  },
  
  // Affirmative responses
  affirmative: {
    patterns: [
      /^(haan|ha|हाँ|हां|yes|ji|sahi|theek|correct|bilkul)\s*$/i,
      /^(haan|ha|हाँ|हां|yes|ji)\s+(hai|sahi|theek|bilkul)/i,
    ],
    priority: 80,
  },
  
  // Negative responses  
  negative: {
    patterns: [
      /^(nahi|नहीं|no|na)\s*$/i,
      /^(nahi|नहीं|no)\s+(ji|hai)/i,
    ],
    priority: 80,
  },
};

function detectIntent(text) {
  if (!text) return null;
  
  const textLower = text.toLowerCase().trim();
  let bestMatch = null;
  let highestPriority = 0;
  
  for (const [intent, config] of Object.entries(intentPatterns)) {
    for (const pattern of config.patterns) {
      if (pattern.test(text)) {
        if (config.priority > highestPriority) {
          highestPriority = config.priority;
          bestMatch = intent;
        }
        break;
      }
    }
  }
  
  return bestMatch;
}

/* =======================
   ADVANCED NAME EXTRACTION
======================= */
const nameExtractionPatterns = {
  // Common noise words to remove
  noiseWords: [
    'mera', 'naam', 'hai', 'hoon', 'main', 'ji', 'sir', 'madam',
    'my', 'name', 'is', 'am', 'i',
    'kya', 'kaun', 'bolo', 'batao', 'suniye', 'dekhiye',
    'aaj', 'kal', 'din', 'raat', 'subah', 'sham',
    'baje', 'ghante', 'minute', 'second',
    'मेरा', 'नाम', 'है', 'हूं', 'मैं', 'जी',
  ],
  
  // Common name patterns
  commonNames: [
    'ram', 'shyam', 'mohan', 'sohan', 'ravi', 'vijay', 'raj', 'kumar',
    'singh', 'sharma', 'verma', 'gupta', 'anshu', 'ankit', 'amit',
    'suresh', 'ramesh', 'dinesh', 'mahesh', 'rakesh', 'lokesh',
    'pradeep', 'sandeep', 'rajesh', 'naresh', 'mukesh',
    'राम', 'श्याम', 'मोहन', 'सोहन', 'रवि', 'विजय', 'राज',
  ],
  
  // Invalid name patterns
  invalidPatterns: [
    /^\d+$/,  // Only numbers
    /^[a-z]$/i,  // Single letter
    /complaint|problem|issue|dikkat/i,
    /machine|engine|hydraulic/i,
    /^(the|a|an|is|are|was|were)$/i,
  ],
};

function extractName(text) {
  if (!text) return null;
  
  const cleaned = text.toLowerCase()
    .replace(/[।.,!?:;]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  
  // Remove noise words
  let words = cleaned.split(' ').filter(word => {
    return !nameExtractionPatterns.noiseWords.includes(word);
  });
  
  // Filter out invalid words
  words = words.filter(word => {
    for (const pattern of nameExtractionPatterns.invalidPatterns) {
      if (pattern.test(word)) return false;
    }
    return word.length >= 2;
  });
  
  if (words.length === 0) return null;
  
  // Join remaining words as name
  const extractedName = words.join(' ');
  
  // Validate - must have at least 2 chars and some letters
  if (extractedName.length >= 2 && /[a-zA-Z\u0900-\u097F]/.test(extractedName)) {
    return extractedName;
  }
  
  return null;
}

/* =======================
   ADVANCED PHONE EXTRACTION
======================= */
const phoneExtractionPatterns = {
  hindiDigits: {
    'शून्य': '0', 'zero': '0', 'shunya': '0',
    'एक': '1', 'ek': '1', 'one': '1',
    'दो': '2', 'do': '2', 'two': '2',
    'तीन': '3', 'teen': '3', 'three': '3',
    'चार': '4', 'char': '4', 'chaar': '4', 'four': '4',
    'पांच': '5', 'paanch': '5', 'panch': '5', 'five': '5',
    'छह': '6', 'chhe': '6', 'che': '6', 'six': '6',
    'सात': '7', 'saat': '7', 'seven': '7',
    'आठ': '8', 'aath': '8', 'eight': '8',
    'नौ': '9', 'nau': '9', 'nine': '9',
    'दस': '10', 'das': '10', 'ten': '10',
  },
  
  // Patterns to clean
  noisePhrases: [
    'phone', 'number', 'contact', 'mobile',
    'फोन', 'नंबर', 'संपर्क', 'मोबाइल',
    'mera', 'hai', 'is', 'the',
  ],
};

function extractPhoneNumber(text) {
  if (!text) return null;
  
  let cleaned = text.toLowerCase()
    .replace(/[।.,!?:;-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  
  // Remove noise phrases
  for (const phrase of phoneExtractionPatterns.noisePhrases) {
    cleaned = cleaned.replace(new RegExp(phrase, 'gi'), ' ');
  }
  
  // Extract direct digits
  let digits = cleaned.replace(/\D/g, '');
  
  // If not enough digits, try word-to-digit conversion
  if (digits.length < 10) {
    const words = cleaned.split(/\s+/);
    let convertedDigits = '';
    
    for (const word of words) {
      if (phoneExtractionPatterns.hindiDigits[word]) {
        convertedDigits += phoneExtractionPatterns.hindiDigits[word];
      } else if (/^\d+$/.test(word)) {
        convertedDigits += word;
      }
    }
    
    if (convertedDigits.length >= 10) {
      digits = convertedDigits;
    }
  }
  
  // Validate 10-digit phone
  if (digits.length === 10 && /^[6-9]\d{9}$/.test(digits)) {
    return digits;
  }
  
  // Handle 11-digit with country code
  if (digits.length === 11 && digits.startsWith('91')) {
    const phone = digits.substring(1);
    if (/^[6-9]\d{9}$/.test(phone)) {
      return phone;
    }
  }
  
  // Try to find 10 consecutive digits
  const match = cleaned.match(/(\d{10})/);
  if (match && /^[6-9]\d{9}$/.test(match[1])) {
    return match[1];
  }
  
  return null;
}

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
   ENHANCED COMPLAINT MAPPING WITH IMPROVED PATTERNS
======================= */
const complaintMap = {
  "AC System": {
    keywords: [
      "ac", "एसी", "ऐसी", "एकसी", "ए सी", "ए.सी", 
      "cooling", "ठंडा", "कूलिंग", "ठंडी", "कूल", "ठंड"
    ],
    priority: 10,
    subTitles: {
      "AC not Working": [
        "नहीं चल", "band", "बंद", "काम नहीं", "work नहीं", 
        "चालू नहीं", "start नहीं", "on नहीं"
      ],
      "AC not Cooling": [
        "cooling", "ठंडा नहीं", "ठंडी नहीं", "कूलिंग नहीं", 
        "cool नहीं", "गरम", "heat", "ठंड नहीं", "thanda nahi",
        "चालू है लेकिन", "on hai lekin", "chal rahi lekin"
      ]
    }
  },

  "Attachment": {
    keywords: ["attachment", "bucket", "breaker", "rock breaker", "als", "livelink", "अटैचमेंट", "बकेट"],
    priority: 5,
    subTitles: {
      "ALS problem": ["als", "एएलएस"],
      "Bucket Crack Issue": ["bucket crack", "bucket फटी", "bucket टूटी"],
      "Live link problem": ["livelink", "live link", "लाइवलिंक"],
      "Rock breaker problem": ["rock breaker", "breaker", "रॉक ब्रेकर", "ब्रेकर"]
    }
  },

  "Body Work": {
    keywords: ["body", "bushing", "drum", "noise", "vibration", "बॉडी", "ड्रम"],
    priority: 4,
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
    priority: 4,
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
  keywords: [
    "electrical", "battery", "light", "wiring", "starter", 
    "बिजली", "बैटरी", "लाइट", "वायरिंग", "self", "सेल्फ"
  ],
  priority: 6,
  subTitles: {
    "Starting trouble": [
      "start problem", "start नहीं हो रही", "स्टार्ट दिक्कत", 
      "स्टार्ट नहीं हो रही", "स्टार्ट ट्रबल", "स्टार्ट",
      "self problem", "सेल्फ प्रॉब्लम", "chalu nahi ho rahi",
      "starting issue", "starting trouble", "शुरू नहीं"
    ],
    "Self/Starter motor problem": [
      "starter", "self", "सेल्फ", "स्टार्टर",
      "starter motor", "self motor"
    ],
    "Battery problem": [
      "battery", "बैटरी", "dead", "खत्म", "discharge",
      "charge nahi", "चार्ज नहीं"
    ],
    "Alternator not Working": ["alternator", "अल्टरनेटर"],
    "Error Code in Machine display": ["error code", "display error"],
    "Fuel Gauge not show/in correct level show": ["fuel gauge", "फ्यूल गेज"],
    "Fuel Motor not Working": ["fuel motor"],
    "Hour meter not working": ["hour meter", "मीटर"],
    "Light glowing problem": ["light glow", "लाइट जल रही"],
    "Pump water motor": ["water pump motor"],
    "Relay fault": ["relay", "रिले"],
    "Reverse forward switch broken": ["reverse switch", "switch टूटा"],
    "speed/rpm meter not working": ["rpm", "speed meter", "आरपीएम"],
    "Switch Fault": ["switch", "स्विच"],
    "Warnings/Alarm": ["warning", "alarm", "चेतावनी"],
    "Wiper motor not working": ["wiper", "वाइपर"],
    "Wiring problem": ["wiring", "wire", "वायरिंग", "तार"],
    "Light not working": ["light", "लाइट"],
    "Rope wire broken": ["rope wire", "तार टूटा"],
    "Stop Cable fault": ["stop cable", "केबल"]
  }
},

  "Engine": {
    keywords: ["engine", "इंजन", "smoke", "overheat", "धुआ", "गरम", 
    "इंडियन", "motor", "मोटर", "power", "पावर"],
    priority: 8,
    subTitles: {
    "Starting trouble": [
      "start", "स्टार्ट", "शुरू", "chalu nahi", "चालू नहीं",
      "self", "सेल्फ", "starter", "स्टार्टर", "kick",
      "start problem", "start नहीं", "शुरू नहीं",
      "starting", "स्टार्टिंग", "dikkat", "दिक्कत",
      "hone mein", "होने में", "shuru hone"
    ],
    "Engine Over heating": [
      "overheat", "गरम", "heat", "गर्मी", "hot",
      "गरमी", "तापमान", "temperature", "hit",
      "हिट", "गर्म हो", "garam ho", "overheat ho"
    ],
    "Smoke problem": [
      "smoke", "धुआ", "धुंआ", "dhuan", "काला धुआ",
      "black smoke", "white smoke", "सफेद धुआ"
    ],
    "Abnormal Noise": [
      "noise", "sound", "आवाज", "शोर", "awaaz",
      "खड़खड़", "आवाज आ", "sound aa"
    ],
    "Engine Lugg down": [
      "lugg down", "power kam", "पावर कम", "ताकत नहीं",
      "slow", "धीरे", "कमजोर", "weak"
    ],
    "Air problem": ["air", "हवा", "हवा की"],
    "coolant leak": ["coolant leak", "पानी लीक", "water leak"],
    "Engine seal leak": ["seal leak", "सील लीक"],
    "Fan belt broken": ["fan belt", "belt", "बेल्ट"],
    "FIP issue": ["fip", "एफआईपी"],
    "Fuel consumption high": [
      "fuel ज्यादा", "diesel ज्यादा", "fuel consumption",
      "खपत ज्यादा", "mileage kam"
    ],
    "Leakages engine": ["engine leak", "इंजन लीक", "oil leak"],
    "missing problem": ["missing", "मिसिंग"],
    "Oil consumption high": ["oil ज्यादा", "oil consumption"],
    "Radiator leak": ["radiator", "रेडिएटर"],
    "swing motor problem": ["swing motor", "स्विंग मोटर"],
    "Engine mounting problem": ["mounting", "माउंटिंग"],
    "Accelerator cable problem": ["accelerator", "cable", "केबल"]
  }
},

  "Fabrication part": {
    keywords: ["fabrication", "crack", "boom", "bucket", "chassis", "फैब्रिकेशन", "क्रैक"],
    priority: 5,
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
    priority: 6,
    subTitles: {
      "Abnormal sound Transmission/Axle": ["sound", "noise", "आवाज"],
      "Barring problem": ["barring", "बैरिंग"],
      "Brake problem": ["brake", "ब्रेक"],
      "Gear box problem": ["gear box", "gearbox", "गियर बॉक्स"],
      "Gear hard": ["gear hard", "gear सख्त"],
      "Oil leak from transmission": ["oil leak", "तेल लीक"],
      "Reverse forward issue": ["reverse", "forward", "रिवर्स"],
      "Transmission overheat": ["transmission गरम", "overheat"]
    }
  },

  "Hose": {
    keywords: ["hose", "pipe", "होस", "पाइप"],
    priority: 4,
    subTitles: {
      "Hose O ring Cut": ["o ring", "oring", "ओ रिंग"],
      "Hose cut": ["hose cut", "होस कटा"],
      "Hose leakages": ["hose leak", "होस लीक"]
    }
  },

  "Hydraulic": {
    keywords: ["hydraulic", "हाइड्रोलिक", "pressure", "pump", "प्रेशर", "पंप"],
    priority: 7,
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
    priority: 5,
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
    priority: 3,
    subTitles: {
      "Actual Service": ["actual service", "regular service"],
      "Service Visit": ["service visit", "visit"]
    }
  },

  "Tyre/Battery": {
    keywords: ["tyre", "tire", "battery", "puncture", "टायर", "बैटरी", "पंक्चर"],
    priority: 6,
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
    priority: 4,
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
    priority: 3,
    subTitles: {
      "PDI": ["pdi"]
    }
  },

  "Installation": {
    keywords: ["installation", "install", "इंस्टालेशन"],
    priority: 3,
    subTitles: {
      "Installation visit": ["installation", "install"]
    }
  },

  "General Visit": {
    keywords: ["visit", "general", "monthly", "विजिट"],
    priority: 2,
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
    priority: 3,
    subTitles: {
      "Livelink not working": ["livelink", "live link"],
      "Alert": ["alert", "अलर्ट"]
    }
  },

  "ECU problem": {
    keywords: ["ecu", "ईसीयू"],
    priority: 5,
    subTitles: {}
  },

  "Campaign": {
    keywords: ["campaign", "fsi", "कैम्पेन"],
    priority: 3,
    subTitles: {
      "Campaign Visit": ["campaign"],
      "FSI": ["fsi", "एफएसआई"]
    }
  }
};

/* =======================
   IMPROVED HINDI TO ENGLISH TRANSLITERATION
======================= */
const hindiToEnglishMap = {
  // Common words
  'ऐसी': 'AC',
  'एसी': 'AC',
  'ए सी': 'AC',
  'इंजन': 'engine',
  'नहीं': 'nahi',
  'चल': 'chal',
  'रही': 'rahi',
  'रहा': 'raha',
  'है': 'hai',
  'काम': 'kaam',
  'कर': 'kar',
  'करती': 'karti',
  'करता': 'karta',
  'करते': 'karte',
  'करनी': 'karni',
  'करना': 'karna',
  'हो': 'ho',
  'ठंडा': 'thanda',
  'ठंडी': 'thandi',
  'ठंड': 'thand',
  'कूलिंग': 'cooling',
  'बात': 'baat',
  'क्यों': 'kyu',
  'लेकिन': 'lekin',
  'चालू': 'chalu',
  'बंद': 'band',
  'गरम': 'garam',
  'ब्रेक': 'brake',
  'टायर': 'tyre',
  'बैटरी': 'battery',
  'हाइड्रोलिक': 'hydraulic',
  'मशीन': 'machine',
  'प्रॉब्लम': 'problem',
  'दिक्कत': 'dikkat',
  'खराब': 'kharab',
  'वारंटी': 'warranty',
  'सर्विस': 'service',
  
  // Names
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
  'गुप्ता': 'Gupta',
  'अंशु': 'Anshu',


  // Starting/Power Issues
  'स्टार्ट': 'start',
  'स्टार्टिंग': 'starting',
  'शुरू': 'shuru',
  'चालू': 'chalu',
  'पावर': 'power',
  'ताकत': 'power',
  
  // Heating/Temperature
  'हिट': 'heat',
  'गरम': 'garam',
  'गर्म': 'garam',
  'ओवरहीट': 'overheat',
  'तापमान': 'temperature',
  
  // Problems/Issues
  'दिक्कत': 'dikkat',
  'परेशानी': 'problem',
  'खराबी': 'kharab',
  'समस्या': 'problem',
  'इशू': 'issue',
  
  // Actions
  'रही': 'rahi',
  'रहा': 'raha',
  'होने': 'hone',
  'हो': 'ho',
  'आ': 'aa',
  'जा': 'ja',
  'पा': 'pa',
  
  // Common phrases
  'में': 'mein',
  'से': 'se',
  'को': 'ko',
  'का': 'ka',
  'की': 'ki',
  'के': 'ke',
};

function transliterateHindiToEnglish(text) {
  if (!text) return text;
  
  let result = text;
  
  // First pass: exact word replacements
  for (const [hindi, english] of Object.entries(hindiToEnglishMap)) {
    const regex = new RegExp(hindi, 'gi');
    result = result.replace(regex, english);
  }
  
  // Second pass: remove remaining Devanagari characters that couldn't be transliterated
  // but keep the ASCII parts
  result = result
    .split(' ')
    .map(word => {
      // If word has both Hindi and English, try to extract English
      if (/[a-zA-Z]/.test(word) && /[\u0900-\u097F]/.test(word)) {
        // Extract ASCII part
        return word.replace(/[\u0900-\u097F]/g, '').trim();
      }
      // If pure Hindi and not in map, keep as is (might be transliterated later)
      if (/[\u0900-\u097F]/.test(word)) {
        return word;
      }
      return word;
    })
    .filter(word => word.length > 0)
    .join(' ');
  
  return result.trim();
}

/* =======================
   SMART FOLLOW-UP QUESTIONS
======================= */
const smartFollowUpQuestions = {
  chassis_unknown: [
    "Koi baat nahi. Aap machine kab se use kar rahe hain?",
    "Machine ka model batayein? JCB 3DX hai ya koi aur?",
    "Machine ki koi aur pehchan batayein jaise registration number?"
  ],
  
  problem_unclear: [
    "Machine kab se band hai?",
    "Kya machine bilkul band hai ya thodi bahut chal rahi hai?",
    "Pichli baar machine kab theek thi?",
    "Machine mein koi aawaz aa rahi hai?",
    "Kya koi smoke ya dhuan aa raha hai?",
    "Kya machine start ho rahi hai?",
    "Engine, hydraulic, AC, electrical ya tyre mein se kya problem hai?"
  ],

  timeline: [
    "Yeh problem kab se hai?",
    "Kya yeh achanak hua ya dheere dheere?",
    "Pichli servicing kab hui thi?"
  ],

  severity: [
    "Kya machine bilkul band hai ya kuch kaam kar rahi hai?",
    "Kya machine chalane mein khatraa hai?",
    "Kya machine se koi leak ho raha hai?"
  ],

  ac_specific: [
    "AC bilkul nahi chal rahi ya sirf thanda nahi kar rahi?",
    "AC chalu hoti hai lekin thanda nahi karti?",
    "Kya AC on hone par koi awaaz aati hai?"
  ]
};

/* =======================
   ENHANCED COMPLAINT DETECTION WITH PRIORITY
======================= */
function detectComplaintIntent(text, previousContext = {}) {
  if (!text) return null;

  const textLower = text.toLowerCase();
  const matches = [];
  const confidenceScores = {};

  console.log("🔍 ANALYZING TEXT FOR COMPLAINT:", textLower);

  // Special AC detection - very high priority
  const acPatterns = [
    /\bac\b/gi,
    /\bएसी\b/gi,
    /\bऐसी\b/gi,
    /\bए\.सी\b/gi,
    /\bए\s+सी\b/gi,
    /\bcooling\b/gi,
    /\bकूलिंग\b/gi,
    /\bठंडा\b/gi,
    /\bठंडी\b/gi,
    /\bठंड\b/gi,
    /\bthanda\b/gi,
    /\bthand\b/gi
  ];

  let hasACMention = false;
  for (const pattern of acPatterns) {
    if (pattern.test(text)) {
      hasACMention = true;
      console.log("   ✅ AC pattern matched:", pattern);
      break;
    }
  }

  // If AC mentioned, give it top priority
  if (hasACMention) {
    console.log("🎯 AC DETECTED - High Priority Match!");
    matches.push("AC System");
    confidenceScores["AC System"] = 100;
  }

  // Check against all other complaint categories
  for (const [title, data] of Object.entries(complaintMap)) {
    if (title === "AC System" && hasACMention) continue;

    let matchScore = 0;
    let matchedKeywords = [];
    const priority = data.priority || 1;

    // Check main keywords
    for (const keyword of data.keywords) {
      const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
      if (regex.test(text)) {
        matchScore += (2 * priority);
        matchedKeywords.push(keyword);
      }
    }

    // Check sub-title keywords
    if (data.subTitles) {
      for (const [subTitle, subKeywords] of Object.entries(data.subTitles)) {
        for (const subKeyword of subKeywords) {
          const regex = new RegExp(`\\b${subKeyword}\\b`, 'gi');
          if (regex.test(text)) {
            matchScore += (3 * priority);
            matchedKeywords.push(subKeyword);
          }
        }
      }
    }

    if (matchScore > 0 && title !== "AC System") {
      matches.push(title);
      confidenceScores[title] = matchScore;
    }
  }

  if (matches.length === 0) {
    console.log("   ❌ No complaint categories matched");
    return null;
  }

  // Sort by confidence score
  matches.sort((a, b) => confidenceScores[b] - confidenceScores[a]);

  const topScore = confidenceScores[matches[0]];
  const confidence = topScore >= 100 ? 0.99 : 
                     topScore >= 50 ? 0.95 : 
                     topScore >= 20 ? 0.85 : 
                     topScore >= 10 ? 0.75 : 0.6;

  console.log("🔍 Complaint Detection Results:");
  console.log("   Matches:", matches);
  console.log("   Scores:", confidenceScores);
  console.log("   Top Match:", matches[0], "Score:", topScore, "Confidence:", confidence);

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

/* =======================
   ENHANCED SUB-COMPLAINT DETECTION
======================= */
function detectSubComplaint(mainComplaint, text) {
  if (!mainComplaint || !complaintMap[mainComplaint]) return null;

  const subTitles = complaintMap[mainComplaint].subTitles;
  if (!subTitles || Object.keys(subTitles).length === 0) {
    return { subTitle: "Other", confidence: 1.0 };
  }

  const textLower = text.toLowerCase();
  let bestMatch = null;
  let highestScore = 0;

  console.log(`🔍 Detecting sub-complaint for: ${mainComplaint}`);
  console.log(`   Text to analyze: "${textLower}"`);

  // ========== SPECIAL HANDLING FOR AC SYSTEM ==========
  if (mainComplaint === "AC System") {
    const notWorkingPatterns = [
      /नहीं\s+चल/gi, /band\b/gi, /बंद\b/gi, /काम\s+नहीं/gi,
      /work\s+नहीं/gi, /चालू\s+नहीं/gi, /start\s+नहीं/gi,
      /on\s+नहीं/gi, /kaam\s+nahi/gi, /chalu\s+nahi/gi
    ];

    const coolingPatterns = [
      /ठंडा\s+नहीं/gi, /ठंडी\s+नहीं/gi, /ठंड\s+नहीं/gi,
      /कूलिंग\s+नहीं/gi, /cool\s+नहीं/gi, /cooling\s+नहीं/gi,
      /thanda\s+nahi/gi, /thand\s+nahi/gi, /गरम\b/gi,
      /garam\b/gi, /heat\b/gi, /चालू\s+है\s+लेकिन/gi,
      /chalu\s+hai\s+lekin/gi, /on\s+hai\s+lekin/gi,
      /chal\s+rahi\s+lekin/gi, /चल\s+रही\s+लेकिन/gi
    ];

    let coolingScore = 0, notWorkingScore = 0;

    for (const pattern of coolingPatterns) {
      if (pattern.test(textLower)) {
        coolingScore += 10;
        console.log(`   ✅ Cooling pattern matched: ${pattern}`);
      }
    }

    for (const pattern of notWorkingPatterns) {
      if (pattern.test(textLower)) {
        notWorkingScore += 10;
        console.log(`   ✅ Not working pattern matched: ${pattern}`);
      }
    }

    console.log(`   Cooling Score: ${coolingScore}, Not Working Score: ${notWorkingScore}`);

    if (coolingScore > notWorkingScore) {
      console.log("   ✅ AC NOT COOLING detected");
      return { subTitle: "AC not Cooling", confidence: 0.95 };
    }
    
    if (notWorkingScore > 0) {
      console.log("   ✅ AC NOT WORKING detected");
      return { subTitle: "AC not Working", confidence: 0.95 };
    }

    console.log("   ⚠️ AC mentioned but no specific sub-complaint, defaulting to 'AC not Cooling'");
    return { subTitle: "AC not Cooling", confidence: 0.7 };
  }

  // ========== SPECIAL HANDLING FOR ENGINE ==========
  if (mainComplaint === "Engine") {
    const startingPatterns = [
      /\bstart\b/gi, /स्टार्ट/gi, /शुरू/gi, /\bchalu\s+nahi/gi,
      /चालू\s+नहीं/gi, /\bself\b/gi, /सेल्फ/gi, /\bstarter\b/gi,
      /स्टार्टर/gi, /\bdikkat\b/gi, /दिक्कत/gi, /होने\s+में/gi,
      /\bhone\s+mein/gi, /\bstarting\b/gi, /स्टार्टिंग/gi,
      /\bkick\b/gi, /start\s+problem/gi, /start\s+नहीं/gi
    ];

    const heatingPatterns = [
      /\bheat\b/gi, /\bhit\b/gi, /हिट/gi, /\bgaram\b/gi,
      /गरम/gi, /गर्म/gi, /\boverheat/gi, /ओवरहीट/gi,
      /तापमान/gi, /\bhot\b/gi, /गर्मी/gi, /गरमी/gi,
      /गर्म\s+हो/gi, /garam\s+ho/gi
    ];

    const smokePatterns = [
      /\bsmoke\b/gi, /धुआ/gi, /धुंआ/gi, /\bdhuan\b/gi,
      /काला\s+धुआ/gi, /black\s+smoke/gi, /white\s+smoke/gi,
      /सफेद\s+धुआ/gi
    ];

    const noisePatterns = [
      /\bnoise\b/gi, /\bsound\b/gi, /आवाज/gi, /शोर/gi,
      /\bawaaz\b/gi, /खड़खड़/gi, /आवाज\s+आ/gi, /sound\s+aa/gi
    ];

    let startingScore = 0, heatingScore = 0, smokeScore = 0, noiseScore = 0;

    for (const pattern of startingPatterns) {
      if (pattern.test(textLower)) {
        startingScore += 15;
        console.log(`   ✅ Starting pattern matched: ${pattern}`);
      }
    }

    for (const pattern of heatingPatterns) {
      if (pattern.test(textLower)) {
        heatingScore += 15;
        console.log(`   ✅ Heating pattern matched: ${pattern}`);
      }
    }

    for (const pattern of smokePatterns) {
      if (pattern.test(textLower)) {
        smokeScore += 15;
        console.log(`   ✅ Smoke pattern matched: ${pattern}`);
      }
    }

    for (const pattern of noisePatterns) {
      if (pattern.test(textLower)) {
        noiseScore += 12;
        console.log(`   ✅ Noise pattern matched: ${pattern}`);
      }
    }

    console.log(`   Starting: ${startingScore}, Heating: ${heatingScore}, Smoke: ${smokeScore}, Noise: ${noiseScore}`);

    if (startingScore >= 15) {
      console.log("   ✅ STARTING TROUBLE detected");
      return { subTitle: "Starting trouble", confidence: 0.95 };
    }
    if (heatingScore >= 15) {
      console.log("   ✅ ENGINE OVERHEATING detected");
      return { subTitle: "Engine Over heating", confidence: 0.95 };
    }
    if (smokeScore >= 15) {
      console.log("   ✅ SMOKE PROBLEM detected");
      return { subTitle: "Smoke problem", confidence: 0.95 };
    }
    if (noiseScore >= 12) {
      console.log("   ✅ ABNORMAL NOISE detected");
      return { subTitle: "Abnormal Noise", confidence: 0.90 };
    }
  }

  // ========== SPECIAL HANDLING FOR HYDRAULIC ==========
  if (mainComplaint === "Hydraulic") {
    const pressurePatterns = [
      /\bpressure\b/gi, /प्रेशर/gi, /\bकम\b/gi, /\blow\b/gi,
      /pressure\s+down/gi, /pressure\s+kam/gi, /कम\s+pressure/gi
    ];

    const leakPatterns = [
      /\bleak\b/gi, /लीक/gi, /\bleakage\b/gi, /oil\s+leak/gi,
      /तेल\s+लीक/gi, /pump\s+leak/gi, /पंप\s+लीक/gi
    ];

    const slowPatterns = [
      /\bslow\b/gi, /धीरे/gi, /धीमी/gi, /\bslowly\b/gi,
      /कम\s+speed/gi, /power\s+kam/gi, /ताकत\s+नहीं/gi,
      /performance\s+low/gi
    ];

    const noisePatterns = [
      /\bnoise\b/gi, /\bsound\b/gi, /आवाज/gi, /शोर/gi,
      /pump\s+noise/gi, /pump\s+आवाज/gi
    ];

    let pressureScore = 0, leakScore = 0, slowScore = 0, noiseScore = 0;

    for (const pattern of pressurePatterns) {
      if (pattern.test(textLower)) {
        pressureScore += 15;
        console.log(`   ✅ Pressure pattern matched: ${pattern}`);
      }
    }

    for (const pattern of leakPatterns) {
      if (pattern.test(textLower)) {
        leakScore += 15;
        console.log(`   ✅ Leak pattern matched: ${pattern}`);
      }
    }

    for (const pattern of slowPatterns) {
      if (pattern.test(textLower)) {
        slowScore += 15;
        console.log(`   ✅ Slow working pattern matched: ${pattern}`);
      }
    }

    for (const pattern of noisePatterns) {
      if (pattern.test(textLower)) {
        noiseScore += 12;
        console.log(`   ✅ Noise pattern matched: ${pattern}`);
      }
    }

    console.log(`   Pressure: ${pressureScore}, Leak: ${leakScore}, Slow: ${slowScore}, Noise: ${noiseScore}`);

    if (pressureScore >= 15) {
      console.log("   ✅ PRESSURE DOWN detected");
      return { subTitle: "Pressure down", confidence: 0.95 };
    }
    if (slowScore >= 15) {
      console.log("   ✅ SLOW WORKING detected");
      return { subTitle: "Machine performance low/Slow working", confidence: 0.95 };
    }
    if (leakScore >= 15) {
      // Check for specific leak types
      if (/pump/gi.test(textLower)) {
        console.log("   ✅ HYDRAULIC PUMP LEAK detected");
        return { subTitle: "Hydraulic pump leak", confidence: 0.95 };
      }
      console.log("   ✅ GENERAL LEAK detected");
      return { subTitle: "Hydraulic pump leak", confidence: 0.85 };
    }
    if (noiseScore >= 12) {
      if (/pump/gi.test(textLower)) {
        console.log("   ✅ PUMP NOISE detected");
        return { subTitle: "Hydraulic pump Noise", confidence: 0.95 };
      }
      console.log("   ✅ ABNORMAL SOUND detected");
      return { subTitle: "Abnormal sound", confidence: 0.90 };
    }
  }

  // ========== SPECIAL HANDLING FOR ELECTRICAL ==========
  if (mainComplaint === "Electrical Complaint") {
    const batteryPatterns = [
      /\bbattery\b/gi, /बैटरी/gi, /\bdead\b/gi, /खत्म/gi,
      /\bdischarge\b/gi, /charge\s+nahi/gi, /चार्ज\s+नहीं/gi,
      /battery\s+down/gi, /battery\s+खत्म/gi
    ];

    const startingPatterns = [
      /\bstart\b/gi, /स्टार्ट/gi, /\bself\b/gi, /सेल्फ/gi,
      /\bstarter\b/gi, /स्टार्टर/gi, /start\s+problem/gi,
      /start\s+नहीं/gi, /चालू\s+नहीं/gi
    ];

    const lightPatterns = [
      /\blight\b/gi, /लाइट/gi, /light\s+not\s+working/gi,
      /लाइट\s+नहीं/gi, /light\s+glow/gi, /लाइट\s+जल/gi
    ];

    const wiringPatterns = [
      /\bwiring\b/gi, /वायरिंग/gi, /\bwire\b/gi, /तार/gi,
      /wire\s+problem/gi, /wiring\s+issue/gi
    ];

    let batteryScore = 0, startingScore = 0, lightScore = 0, wiringScore = 0;

    for (const pattern of batteryPatterns) {
      if (pattern.test(textLower)) {
        batteryScore += 15;
        console.log(`   ✅ Battery pattern matched: ${pattern}`);
      }
    }

    for (const pattern of startingPatterns) {
      if (pattern.test(textLower)) {
        startingScore += 15;
        console.log(`   ✅ Starting pattern matched: ${pattern}`);
      }
    }

    for (const pattern of lightPatterns) {
      if (pattern.test(textLower)) {
        lightScore += 15;
        console.log(`   ✅ Light pattern matched: ${pattern}`);
      }
    }

    for (const pattern of wiringPatterns) {
      if (pattern.test(textLower)) {
        wiringScore += 12;
        console.log(`   ✅ Wiring pattern matched: ${pattern}`);
      }
    }

    console.log(`   Battery: ${batteryScore}, Starting: ${startingScore}, Light: ${lightScore}, Wiring: ${wiringScore}`);

    if (batteryScore >= 15) {
      console.log("   ✅ BATTERY PROBLEM detected");
      return { subTitle: "Battery problem", confidence: 0.95 };
    }
    if (startingScore >= 15) {
      console.log("   ✅ STARTING TROUBLE detected");
      return { subTitle: "Starting trouble", confidence: 0.95 };
    }
    if (lightScore >= 15) {
      if (/glow/gi.test(textLower)) {
        console.log("   ✅ LIGHT GLOWING PROBLEM detected");
        return { subTitle: "Light glowing problem", confidence: 0.95 };
      }
      console.log("   ✅ LIGHT NOT WORKING detected");
      return { subTitle: "Light not working", confidence: 0.95 };
    }
    if (wiringScore >= 12) {
      console.log("   ✅ WIRING PROBLEM detected");
      return { subTitle: "Wiring problem", confidence: 0.90 };
    }
  }

  // ========== SPECIAL HANDLING FOR TYRE/BATTERY ==========
  if (mainComplaint === "Tyre/Battery") {
    const puncturePatterns = [
      /\bpuncture\b/gi, /पंक्चर/gi, /tube\s+puncture/gi,
      /ट्यूब\s+पंक्चर/gi, /फूटा/gi, /फटा/gi
    ];

    const burstPatterns = [
      /\bburst\b/gi, /फटा/gi, /फूटा/gi, /tyre\s+burst/gi,
      /टायर\s+फटा/gi, /टायर\s+फूटा/gi
    ];

    const batteryPatterns = [
      /\bbattery\b/gi, /बैटरी/gi, /\bdead\b/gi, /खत्म/gi,
      /battery\s+problem/gi, /battery\s+down/gi
    ];

    const cutPatterns = [
      /\bcut\b/gi, /कटा/gi, /tyre\s+cut/gi, /टायर\s+कटा/gi
    ];

    let punctureScore = 0, burstScore = 0, batteryScore = 0, cutScore = 0;

    for (const pattern of puncturePatterns) {
      if (pattern.test(textLower)) {
        punctureScore += 15;
        console.log(`   ✅ Puncture pattern matched: ${pattern}`);
      }
    }

    for (const pattern of burstPatterns) {
      if (pattern.test(textLower)) {
        burstScore += 15;
        console.log(`   ✅ Burst pattern matched: ${pattern}`);
      }
    }

    for (const pattern of batteryPatterns) {
      if (pattern.test(textLower)) {
        batteryScore += 15;
        console.log(`   ✅ Battery pattern matched: ${pattern}`);
      }
    }

    for (const pattern of cutPatterns) {
      if (pattern.test(textLower)) {
        cutScore += 12;
        console.log(`   ✅ Cut pattern matched: ${pattern}`);
      }
    }

    console.log(`   Puncture: ${punctureScore}, Burst: ${burstScore}, Battery: ${batteryScore}, Cut: ${cutScore}`);

    if (batteryScore >= 15) {
      console.log("   ✅ BATTERY PROBLEM detected");
      return { subTitle: "Battery problem", confidence: 0.95 };
    }
    if (punctureScore >= 15) {
      console.log("   ✅ TUBE PUNCTURE detected");
      return { subTitle: "Tube puncture", confidence: 0.95 };
    }
    if (burstScore >= 15) {
      console.log("   ✅ TYRE BURST detected");
      return { subTitle: "Tyre burst", confidence: 0.95 };
    }
    if (cutScore >= 12) {
      console.log("   ✅ TYRE CUT detected");
      return { subTitle: "Tyre cut", confidence: 0.90 };
    }
  }

  // ========== SPECIAL HANDLING FOR TRANSMISSION/AXLE ==========
  if (mainComplaint === "Transmission/Axle components") {
    const brakePatterns = [
      /\bbrake\b/gi, /ब्रेक/gi, /brake\s+problem/gi,
      /ब्रेक\s+नहीं/gi, /brake\s+fail/gi
    ];

    const gearPatterns = [
      /\bgear\b/gi, /गियर/gi, /gear\s+problem/gi, /गियर\s+बॉक्स/gi,
      /gear\s+hard/gi, /gear\s+सख्त/gi, /gearbox/gi
    ];

    const reversePatterns = [
      /\breverse\b/gi, /रिवर्स/gi, /\bforward\b/gi,
      /reverse\s+forward/gi, /आगे\s+पीछे/gi
    ];

    const noisePatterns = [
      /\bnoise\b/gi, /\bsound\b/gi, /आवाज/gi, /शोर/gi
    ];

    let brakeScore = 0, gearScore = 0, reverseScore = 0, noiseScore = 0;

    for (const pattern of brakePatterns) {
      if (pattern.test(textLower)) {
        brakeScore += 15;
        console.log(`   ✅ Brake pattern matched: ${pattern}`);
      }
    }

    for (const pattern of gearPatterns) {
      if (pattern.test(textLower)) {
        gearScore += 15;
        console.log(`   ✅ Gear pattern matched: ${pattern}`);
      }
    }

    for (const pattern of reversePatterns) {
      if (pattern.test(textLower)) {
        reverseScore += 15;
        console.log(`   ✅ Reverse/Forward pattern matched: ${pattern}`);
      }
    }

    for (const pattern of noisePatterns) {
      if (pattern.test(textLower)) {
        noiseScore += 12;
        console.log(`   ✅ Noise pattern matched: ${pattern}`);
      }
    }

    console.log(`   Brake: ${brakeScore}, Gear: ${gearScore}, Reverse: ${reverseScore}, Noise: ${noiseScore}`);

    if (brakeScore >= 15) {
      console.log("   ✅ BRAKE PROBLEM detected");
      return { subTitle: "Brake problem", confidence: 0.95 };
    }
    if (gearScore >= 15) {
      if (/hard/gi.test(textLower) || /सख्त/gi.test(textLower)) {
        console.log("   ✅ GEAR HARD detected");
        return { subTitle: "Gear hard", confidence: 0.95 };
      }
      console.log("   ✅ GEAR BOX PROBLEM detected");
      return { subTitle: "Gear box problem", confidence: 0.95 };
    }
    if (reverseScore >= 15) {
      console.log("   ✅ REVERSE FORWARD ISSUE detected");
      return { subTitle: "Reverse forward issue", confidence: 0.95 };
    }
    if (noiseScore >= 12) {
      console.log("   ✅ ABNORMAL SOUND detected");
      return { subTitle: "Abnormal sound Transmission/Axle", confidence: 0.90 };
    }
  }

  // ========== SPECIAL HANDLING FOR RAM/CYLINDER ==========
  if (mainComplaint === "Ram/Cylinder") {
    const leakPatterns = [
      /\bleak\b/gi, /लीक/gi, /seal\s+leak/gi, /सील\s+लीक/gi,
      /ram\s+leak/gi, /राम\s+लीक/gi
    ];

    const bendPatterns = [
      /\bbend\b/gi, /मुड़ा/gi, /rod\s+bend/gi, /रॉड\s+मुड़ा/gi,
      /bent/gi
    ];

    const brokenPatterns = [
      /\bbroken\b/gi, /टूटा/gi, /rod\s+broken/gi, /रॉड\s+टूटा/gi,
      /टूट\s+गया/gi
    ];

    let leakScore = 0, bendScore = 0, brokenScore = 0;

    for (const pattern of leakPatterns) {
      if (pattern.test(textLower)) {
        leakScore += 15;
        console.log(`   ✅ Leak pattern matched: ${pattern}`);
      }
    }

    for (const pattern of bendPatterns) {
      if (pattern.test(textLower)) {
        bendScore += 15;
        console.log(`   ✅ Bend pattern matched: ${pattern}`);
      }
    }

    for (const pattern of brokenPatterns) {
      if (pattern.test(textLower)) {
        brokenScore += 15;
        console.log(`   ✅ Broken pattern matched: ${pattern}`);
      }
    }

    console.log(`   Leak: ${leakScore}, Bend: ${bendScore}, Broken: ${brokenScore}`);

    if (brokenScore >= 15) {
      console.log("   ✅ ROD BROKEN detected");
      return { subTitle: "Rod broken", confidence: 0.95 };
    }
    if (bendScore >= 15) {
      console.log("   ✅ ROD BEND detected");
      return { subTitle: "Rod bend", confidence: 0.95 };
    }
    if (leakScore >= 15) {
      // Check for specific ram types
      if (/boom/gi.test(textLower)) {
        console.log("   ✅ BOOM RAM SEAL LEAK detected");
        return { subTitle: "Boom ram seal leak", confidence: 0.95 };
      }
      if (/bucket/gi.test(textLower)) {
        console.log("   ✅ BUCKET RAM SEAL LEAK detected");
        return { subTitle: "bucket ram seal leak", confidence: 0.95 };
      }
      if (/dipper/gi.test(textLower)) {
        console.log("   ✅ DIPPER RAM SEAL LEAK detected");
        return { subTitle: "Dipper ram seal leak", confidence: 0.95 };
      }
      console.log("   ✅ RAM LEAK detected");
      return { subTitle: "Ram leak", confidence: 0.85 };
    }
  }

  // ========== REGULAR SUB-COMPLAINT DETECTION FOR ALL CATEGORIES ==========
  for (const [subTitle, keywords] of Object.entries(subTitles)) {
    let score = 0;
    let matchedCount = 0;

    for (const keyword of keywords) {
      const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
      if (regex.test(textLower)) {
        score += (keyword.length * 2);
        matchedCount++;
        console.log(`   ✅ Keyword matched for "${subTitle}": ${keyword}`);
      }
    }

    console.log(`   Sub-title: ${subTitle}, Score: ${score}, Matches: ${matchedCount}`);

    if (score > highestScore) {
      highestScore = score;
      bestMatch = subTitle;
    }
  }

  if (bestMatch) {
    const confidence = highestScore >= 20 ? 0.95 : 
                      highestScore >= 10 ? 0.85 : 0.7;
    console.log(`   ✅ Best match: ${bestMatch} (confidence: ${confidence})`);
    return { subTitle: bestMatch, confidence: confidence };
  }

  console.log("   ⚠️ No specific sub-complaint detected, using 'Other'");
  return { subTitle: "Other", confidence: 0.5 };
}

/* =======================
   SMART QUESTION SELECTOR
======================= */
function getSmartFollowUp(context) {
  const { step, attemptCount, lastIntent, customerData, confusionType } = context;

  if (step === 'ask_identifier' && attemptCount >= 2) {
    return smartFollowUpQuestions.chassis_unknown[attemptCount % smartFollowUpQuestions.chassis_unknown.length];
  }

  if (step === 'ask_complaint' && attemptCount >= 1) {
    return smartFollowUpQuestions.problem_unclear[attemptCount % smartFollowUpQuestions.problem_unclear.length];
  }

  if (lastIntent === 'AC System' && attemptCount === 0) {
    return smartFollowUpQuestions.ac_specific[0];
  }

  if (lastIntent && attemptCount === 0) {
    return smartFollowUpQuestions.timeline[0];
  }

  return null;
}

/* =======================
   GENERATE SUB-COMPLAINT QUESTION
======================= */
function generateSubComplaintQuestion(mainComplaint) {
  const data = complaintMap[mainComplaint];
  if (!data || !data.subTitles || Object.keys(data.subTitles).length === 0) {
    return null;
  }

  const questions = {
    "AC System": "AC mein exactly kya problem hai? AC bilkul nahi chal rahi hai ya AC chalu hai lekin thanda nahi kar rahi?",
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
   UTILITY FUNCTIONS
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
      job_close_lat: customerData.job_close_lat || "0.000000",
      job_close_lng: customerData.job_close_lng || "0.000000",
      job_open_lat: customerData.job_open_lat || "0.000000",
      job_open_lng: customerData.job_open_lng || "0.000000",
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
    const enhancedData = {
      ...complaintData,
      job_close_lat: complaintData.job_close_lat || "0.000000",
      job_close_lng: complaintData.job_close_lng || "0.000000",
      job_open_lat: complaintData.job_open_lat || "0.000000",
      job_open_lng: complaintData.job_open_lng || "0.000000",
      complaint_details: transliterateHindiToEnglish(complaintData.complaint_details || "")
    };

    console.log(
      `🌐 Submitting complaint to external API: ${COMPLAINT_API_URL}`,
    );
    console.log(
      "📦 Enhanced complaint payload:",
      JSON.stringify(enhancedData, null, 2),
    );

    const response = await axios.post(COMPLAINT_API_URL, enhancedData, {
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
  
  const transliterated = transliterateHindiToEnglish(text);
  
  const cleaned = transliterated
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x00-\x7F]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  
  return cleaned || "Unknown";
}

function getCallerName(call, customerData) {
  const spokenName = extractName(call.temp.complaintGivenByName);
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

function detectMachineType(text) {
  if (!text) return null;

  if (text.includes("warranty") || text.includes("वारंटी")) {
    return "Warranty";
  }
  if (text.includes("care") || text.includes("केयर") || text.includes("केरला")) {
    if (text.includes("engine") || text.includes("इंजन") || text.includes("इंडियन")) {
      return "Engine Care";
    }
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
    text.includes("चालू") ||
    text.includes("chal rahi")
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

  const complaintDetailsEnglish = safeAscii(
    call.temp.rawComplaint || call.temp.englishComplaint || ""
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
  console.log("   Details (English):", complaintDetailsEnglish);
  console.log("   Details (Raw):", call.temp.rawComplaint);

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
    // job_close_lat: customerData.job_close_lat || "0.000000",
    // job_close_lng: customerData.job_close_lng || "0.000000",
    // job_open_lat: customerData.job_open_lat || "0.000000",
    // job_open_lng: customerData.job_open_lng || "0.000000",
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
  
  if (sapId) {
    twiml.say(
      { voice: "Polly.Aditi", language: "hi-IN" },
      `Dhanyavaad. Aapki complaint successfully register ho gayi hai. Complaint number ${sapId} hai. Hamari team jaldi hi aapko contact karegi.`,
    );
  } else {
    twiml.say(
      { voice: "Polly.Aditi", language: "hi-IN" },
      "Dhanyavaad. Aapki complaint register ho gayi hai. Hamari team jaldi hi aapko contact karegi.",
    );
  }
  
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
      temp: { retries: 0, attemptCount: 0, confusionCount: 0 },
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
    "Rajesh JCB motors mein aapka swagat hai. Complaint register karne ke liye ek dabayien. Human agent se baat karne ke liye do dabayien.",
  );

  res.type("text/xml").send(twiml.toString());
});

/* =======================
   CALL PROCESSING HANDLER (ENHANCED WITH ADVANCED NLU)
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

  // Initialize tracking
  if (!call.temp.attemptCount) call.temp.attemptCount = 0;
  if (!call.temp.confusionCount) call.temp.confusionCount = 0;

  if (!SpeechResult && !Digits) {
    ask(twiml, call.temp.lastQuestion || "Kripya apna jawab bolein.", call);
    await call.save();
    return res.type("text/xml").send(twiml.toString());
  }

  if (call.step === "ivr_menu") {
    if (Digits === "2") {
      twiml.say(
        { voice: "Polly.Aditi", language: "hi-IN" },
        "Aapko agent se connect kiya ja raha hai. Kripya pratiksha karein."
      );
      twiml.dial(process.env.HUMAN_AGENT_NUMBER);
      return res.type("text/xml").send(twiml.toString());
    }

    if (Digits === "1") {
      call.step = "ask_identifier";
      ask(
        twiml,
        "Kripya apni machine ka chassis number ya registered mobile number boliye.",
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
  const transliteratedSpeech = transliterateHindiToEnglish(rawSpeech);
  const combinedSpeech = `${rawSpeech} ${transliteratedSpeech}`.toLowerCase();

  console.log("🎤 RAW SPEECH    :", SpeechResult);
  console.log("🧹 CLEANED      :", rawSpeech);
  console.log("🔤 TRANSLITERATED:", transliteratedSpeech);
  console.log("🔗 COMBINED     :", combinedSpeech);

  // ====== ADVANCED INTENT DETECTION ======
  const userIntent = detectIntent(rawSpeech);
  console.log("🎯 USER INTENT:", userIntent);

  // Handle correction intent
  if (userIntent === 'correction') {
    console.log("🔄 User is correcting their answer");
    
    if (call.step === 'confirm_complaint' || call.step === 'ask_sub_complaint') {
      call.step = 'ask_complaint';
      call.temp.retries = 0;
      call.temp.confusionCount = 0;
      ask(twiml, "Theek hai. Machine mein exactly kya problem hai? Kripya clearly batayein.", call);
      await call.save();
      return res.type("text/xml").send(twiml.toString());
    }
    
    if (call.step === 'ask_complaint_given_by_name') {
      ask(twiml, "Theek hai. Apna sahi naam batayein.", call);
      await call.save();
      return res.type("text/xml").send(twiml.toString());
    }
    
    if (call.step === 'ask_complaint_given_by_phone') {
      ask(twiml, "Theek hai. Apna sahi phone number batayein.", call);
      await call.save();
      return res.type("text/xml").send(twiml.toString());
    }
  }

  // Handle escalation intent
  if (userIntent === 'escalation') {
    console.log("📞 User wants to talk to agent");
    twiml.say(
      { voice: "Polly.Aditi", language: "hi-IN" },
      "Theek hai. Aapko agent se connect kar raha hoon."
    );
    twiml.dial(process.env.HUMAN_AGENT_NUMBER);
    await call.save();
    return res.type("text/xml").send(twiml.toString());
  }

  // Handle uncertainty
  if (userIntent === 'uncertainty') {
    console.log("❓ User doesn't know/remember");
    
    if (call.step === 'ask_identifier') {
      const smartQ = getSmartFollowUp({
        step: 'ask_identifier',
        attemptCount: call.temp.attemptCount || 0
      });
      ask(twiml, smartQ || "Koi baat nahi. Machine ka koi aur detail batayein jo yaad ho.", call);
      call.temp.attemptCount = (call.temp.attemptCount || 0) + 1;
      await call.save();
      return res.type("text/xml").send(twiml.toString());
    }
  }

  // Reset confusion on valid intent
  if (userIntent === 'affirmative' || userIntent === 'negative') {
    call.temp.confusionCount = 0;
  }

  switch (call.step) {
    case "ask_identifier": {
      // Enhanced phone extraction
      const phone = extractPhoneNumber(rawSpeech);
      
      // Enhanced chassis extraction
      let chassis = rawSpeech.replace(/\s+/g, "").toUpperCase();
      if (/[\u0900-\u097F]/.test(chassis)) {
        chassis = transliteratedSpeech.replace(/\s+/g, "").toUpperCase();
      }

      console.log("🔍 Identifier extraction:");
      console.log("   Phone:", phone || "N/A");
      console.log("   Chassis:", chassis.length >= 4 ? chassis : "N/A");

      const externalData = await fetchCustomerFromExternal({
        phone: phone,
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
        `Aapka record mil gaya. ${safeAscii(externalData.name)} ji, Kripya apna pura naam btaiye?`,
        call,
      );
      break;
    }

    case "ask_complaint_given_by_name": {
      // Use advanced name extraction
      const extractedName = extractName(rawSpeech);
      
      console.log("👤 Name extraction:");
      console.log("   Raw:", rawSpeech);
      console.log("   Extracted:", extractedName);
      
      if (!extractedName || extractedName.length < 2) {
        call.temp.retries = (call.temp.retries || 0) + 1;
        
        if (call.temp.retries >= 2) {
          call.temp.complaintGivenByName = call.temp.customerData?.name || "Customer";
          call.temp.retries = 0;
          call.step = "ask_complaint_given_by_phone";
          ask(twiml, "Apna 10 digit contact number btaiye.", call);
          break;
        }
        
        ask(twiml, "Kripya apna poora naam clearly btaiye. Sirf naam bolein.", call);
        break;
      }
      
      call.temp.complaintGivenByName = extractedName;
      call.temp.retries = 0;
      call.step = "ask_complaint_given_by_phone";
      ask(twiml, "Apna 10 digit contact number btaiye.", call);
      break;
    }

    case "ask_complaint_given_by_phone": {
      // Use advanced phone extraction
      const phone = extractPhoneNumber(rawSpeech);

      console.log("📞 Phone extraction:");
      console.log("   Raw:", rawSpeech);
      console.log("   Extracted:", phone);

      if (!phone) {
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
        
        ask(twiml, "Kripya 10 digit ka phone number clearly boliye. Ek ek number bolein.", call);
        break;
      }

      call.temp.complaintGivenByPhone = phone;
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
      const machineType = detectMachineType(combinedSpeech);

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
          "Kripya clearly boliye: warranty, JCB care, engine care ya demo.",
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
      const machineStatus = detectMachineStatus(combinedSpeech);

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
          "Kripya clearly boliye: break down hai ya problem ke saath chal rahi hai.",
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
        combinedSpeech.includes("workshop") ||
        combinedSpeech.includes("वर्कशॉप") ||
        combinedSpeech.includes("garage")
      ) {
        jobLocation = "Work Shop";
      }

      call.temp.jobLocation = jobLocation;
      call.step = "ask_complaint";
      call.temp.retries = 0;
      ask(twiml, "Machine ki complaint batayein. Kya problem hai?", call);
      break;
    }

    case "ask_complaint": {
      call.temp.rawComplaint = rawSpeech;
      call.temp.englishComplaint = transliteratedSpeech;

      console.log("📝 Complaint captured:");
      console.log("   Raw:", call.temp.rawComplaint);
      console.log("   Transliterated:", call.temp.englishComplaint);

      const intent = detectComplaintIntent(combinedSpeech);

      if (!intent) {
        call.temp.retries = (call.temp.retries || 0) + 1;

        if (call.temp.retries >= 2) {
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

      if (intent.confidence >= 0.95) {
        call.temp.complaintTitle = intent.primary;

        const subQuestion = generateSubComplaintQuestion(intent.primary);
        
        if (subQuestion) {
          call.step = "ask_sub_complaint";
          call.temp.subRetries = 0;
          ask(twiml, subQuestion, call);
        } else {
          call.temp.complaintSubTitle = "Other";
          await saveComplaint(twiml, call, CallSid);
        }
      } else if (intent.confidence >= 0.80) {
        call.step = "confirm_complaint";
        ask(
          twiml,
          `${intent.primary} ka issue hai, sahi? Haan ya nahi bolein.`,
          call,
        );
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
      const isYes = userIntent === 'affirmative' || 
        combinedSpeech.includes("haan") ||
        combinedSpeech.includes("हां") ||
        combinedSpeech.includes("हाँ") ||
        combinedSpeech.includes("yes") ||
        combinedSpeech.includes("ji") ||
        combinedSpeech.includes("sahi") ||
        combinedSpeech.includes("correct") ||
        combinedSpeech.includes("theek");

      const isNo = userIntent === 'negative' ||
        combinedSpeech.includes("nahi") ||
        combinedSpeech.includes("नहीं") ||
        combinedSpeech.includes("no") ||
        combinedSpeech.includes("galat") ||
        combinedSpeech.includes("wrong");

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
        ask(twiml, "Theek hai, kripya complaint dobara clearly batayein. Machine mein kya problem hai?", call);
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

      const subResult = detectSubComplaint(title, combinedSpeech);

      if (!subResult || subResult.confidence < 0.6) {
        call.temp.subRetries += 1;

        if (call.temp.subRetries >= 2) {
          call.temp.complaintSubTitle = "Other";
          console.log("⚠️  Sub-complaint detection failed after retries, using 'Other'");
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