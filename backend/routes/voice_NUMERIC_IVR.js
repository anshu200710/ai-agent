import express from "express";
import twilio from "twilio";
import axios from "axios";
import Complaint from "../models/Complaint.js";
import {
  extractPhoneNumberV2,
  extractChassisNumberV2,
  extractNameV2,
  extractPincodeV2,
  extractLocationAddressV2,
  extractTimeV2,
  isValidPhone,
  isValidChassis,
  isValidName,
  isValidAddress,
  isValidPincode
} from '../utils/improved_extraction.js';

const router = express.Router();
const VoiceResponse = twilio.twiml.VoiceResponse;

const activeCalls = new Map();

/* ======================= EXTERNAL API CONFIG ======================= */
const EXTERNAL_API_BASE = "http://192.168.0.90/jcbServiceEnginerAPIv7";
const COMPLAINT_API_URL = "http://192.168.0.90/jcbServiceEnginerAPIv7/ai_call_complaint.php";
const API_TIMEOUT = 20000;
const API_HEADERS = { JCBSERVICEAPI: "MakeInJcb" };

/* ======================= AFFIRMATIVE KEYWORDS ======================= */
const affirmativeKeywords = [
  'हान', 'हां', 'हाँ', 'हम', 'जी', 'सही', 'ठीक', 'बिल्कुल', 'ठीक है', 'सही है',
  'जी हां', 'जी हाँ', 'हां जी', 'हाँ जी', 'बिल्कुल सही', 'जी सर', 'जी मैडम',
  'अच्छा', 'ओके', 'करो', 'कीजिए', 'ठीक रहेगा', 'चलेगा', 'हो गया',
  'yes', 'yep', 'yeah', 'yup', 'sure', 'correct', 'right', 'ok', 'okay',
  'fine', 'good', 'ji', 'sahi', 'theek', 'thik', 'bilkul', 'haan', 'han',
  'absolutely', 'definitely', 'affirmative'
];

/* ======================= NEGATIVE KEYWORDS ======================= */
const negativeKeywords = [
  'नहीं', 'नही', 'ना', 'नाह', 'न', 'नाय', 'गलत', 'गलत है', 'ऐसी नहीं',
  'ये नहीं', 'यह नहीं', 'नकार', 'मत', 'मत करो', 'रहने दो', 'जरूरत नहीं',
  'ठीक नहीं', 'सही नहीं', 'बिल्कुल नहीं',
  'no', 'nope', 'nah', 'na', 'not', 'dont', "don't", 'never', 'negative',
  'wrong', 'incorrect', 'galat', 'nai', 'nei'
];

/* ======================= UNCERTAINTY KEYWORDS ======================= */
const uncertaintyKeywords = [
  'पता नहीं', 'पता नही', 'पता न', 'मुझे पता नहीं', 'मुझे नहीं पता',
  'पता नईं', 'पता नई', 'मालूम नहीं', 'मालूम नही', 'नहीं मालूम',
  'मालूम नईं', 'जानकारी नहीं',
  'याद नहीं', 'याद नही', 'नहीं याद', 'याद न', 'याद नईं',
  'भूल गया', 'भूल गयी', 'भूल गए', 'भूल गई', 'याद नहीं आ रहा',
  'समझ नहीं', 'समझ नही', 'नहीं समझ आ रहा', 'समझ नहीं आया',
  'समझ नईं आया', 'समझ में नहीं आया',
  'जानता नहीं', 'जानता नही', 'जानती नहीं', 'मैं नहीं जानता',
  'मैं नहीं जानती', 'हमें नहीं पता', 'कोई विचार नहीं', 'कोई आइडिया नहीं',
  'अंदाजा नहीं', 'क्लू नहीं',
  'dont know', 'do not know', "don't know", 'dunno', 'no idea', 'no clue',
  'not sure', 'uncertain', 'forget', 'forgot', 'forgotten', "can't remember",
  'cant remember', 'not certain', 'confused'
];

/* ======================= CONTROL KEYWORDS ======================= */
const repeatKeywords = [
  'repeat', 'dobara', 'fir se', 'phir se', 'kya', 'kya kaha',
  'dubara', 'again', 'once more', 'samjha nahi'
];

const pauseKeywords = [
  'ruko', 'ruk', 'ek minute', 'ek min', 'i mean', 'matlab',
  'ruk jao', 'hold', 'thoda ruk'
];

function isRepeatRequest(text) {
  if (!text) return false;
  const lower = text.toLowerCase();
  return repeatKeywords.some(k => lower.includes(k));
}

function isPauseRequest(text) {
  if (!text) return false;
  const lower = text.toLowerCase();
  return pauseKeywords.some(k => lower.includes(k));
}

/* ======================= MACHINE TYPE KEYWORDS ======================= */
const machineTypeKeywords = {
  'Warranty': [
    'वारंटी', 'warranty', 'वारेंटी', 'वॉरंटी', 'गारंटी', 'guarantee',
    'free', 'फ्री', 'मुफ्त', 'warranty mein', 'warranty में'
  ],
  'JCB Care': [
    'जीसीबी केयर', 'jcb care', 'केयर', 'care', 'jcb केयर', 'जेसीबी केयर',
    'annual', 'yearly', 'साल', 'वार्षिक'
  ],
  'Engine Care': [
    'इंजन केयर', 'engine care', 'इंजीन केयर', 'engine का केयर',
    'engine protection', 'इंजन प्रोटेक्शन'
  ],
  'Demo': [
    'डेमो', 'demo', 'डेमो मशीन', 'demonstration', 'test machine',
    'टेस्ट', 'परीक्षण'
  ],
  'BHL': [
    'बीएचएल', 'bhl', 'backhoe', 'बैकहो', 'back hoe', 'backhoe loader'
  ]
};

/* ======================= MACHINE STATUS KEYWORDS ======================= */
const machineStatusKeywords = {
  'Breakdown': [
    'ब्रेकडाउन', 'breakdown', 'break down', 'ब्रेक डाउन', 'ब्रेक-डाउन',
    'बिल्कुल बंद', 'पूरी तरह बंद', 'completely down', 'totally down',
    'बंद है', 'बंद हो गया', 'बंद हो गई', 'बंद पड़ा', 'बंद पड़ी',
    'पूरा बंद', 'डाउन है', 'down है', 'पूरी तरह डाउन',
    'बिल्कुल काम नहीं', 'bilkul kaam nahi', 'काम ही नहीं कर रहा',
    'बिल्कुल चल नहीं', 'bilkul chal nahi', 'चल ही नहीं रहा',
    'शुरू नहीं हो रहा', 'स्टार्ट नहीं हो रहा', 'चालू नहीं हो रहा',
    'start nahi ho raha', 'chalu nahi ho raha',
    'खराब हो गया', 'खराब हो गई', 'ठप्प है', 'ठप्प हो गया',
    'मर गया', 'डेड', 'dead', 'stopped completely',
    'काम नहीं करता', 'काम नहीं करती', 'work nahi karta'
  ],
  'Running With Problem': [
    'चल रहा है लेकिन', 'चल रही है लेकिन', 'chal raha hai lekin',
    'चल रहा है पर', 'चल रही है पर', 'चल तो रहा है',
    'काम कर रहा है लेकिन', 'काम तो कर रहा है',
    'समस्या के साथ चल', 'problem के साथ चल', 'दिक्कत के साथ चल',
    'running with problem', 'working with issue', 'working but',
    'आंशिक रूप से', 'partially working', 'थोड़ा काम कर',
    'कम से कम काम कर', 'ठीक से काम नहीं लेकिन चल',
    'प्रॉब्लम है पर चल', 'issue है but running', 'दिक्कत है लेकिन on'
  ]
};

/* ======================= JOB LOCATION KEYWORDS ======================= */
const jobLocationKeywords = {
  'Workshop': [
    'वर्कशॉप', 'workshop', 'वर्कशाप', 'work shop', 'वर्क शॉप',
    'शॉप', 'shop', 'दुकान', 'गैरेज', 'garage', 'गराज',
    'वर्कशॉप में', 'workshop में', 'workshop mein', 'shop में',
    'शॉप में', 'गैरेज में', 'गराज में',
    'घर पर', 'घर', 'घर में', 'home', 'होम', 'अंदर', 'indoor',
    'गोदाम', 'शेड', 'shed', 'warehouse',
    'service center', 'सर्विस सेंटर', 'repair shop',
    'रिपेयर शॉप', 'मरम्मत की दुकान'
  ],
  'Onsite': [
    'साइट', 'site', 'साइट पर', 'साईट', 'साईट पर', 'site पर',
    'खेत', 'खेत में', 'field', 'फील्ड', 'मैदान',
    'जगह', 'जगह पर', 'बाहर', 'outdoor',
    'काम की जगह', 'work site', 'वर्क साइट', 'location', 'लोकेशन',
    'जहां काम हो रहा', 'construction', 'कंस्ट्रक्शन',
    'निर्माण', 'project', 'प्रोजेक्ट',
    'road', 'रोड', 'सड़क', 'highway', 'हाईवे'
  ]
};

/* ======================= COMPREHENSIVE COMPLAINT MAP ======================= */
const complaintMap = {
  "AC System": {
    keywords: [
      "ac", "a.c", "a c", "air conditioner", "air conditioning", "cooling",
      "cooler", "climate", "temperature control",
      "एसी", "ऐसी", "एकसी", "ए सी", "ए.सी", "एयर कंडीशनर",
      "ठंडा", "ठंडी", "कूलिंग", "कूल", "ठंड", "एयर कंडीशनिंग"
    ],
    priority: 10,
    subTitles: {
      "AC not Working": [
        "नहीं चल", "नई चल", "band", "बंद", "काम नहीं", "work नहीं",
        "चालू नहीं", "start नहीं", "on नहीं", "नहीं हो रहा",
        "not working", "stopped", "dead", "खराब", "not turning on",
        "AC बंद", "AC काम नहीं", "AC खराब"
      ],
      "AC not Cooling": [
        "cooling", "ठंडा नहीं", "ठंडी नहीं", "कूलिंग नहीं", "cool नहीं",
        "गरम", "गर्म", "heat", "hot", "ठंड नहीं", "thanda nahi",
        "चालू है लेकिन", "on hai lekin", "chal rahi lekin",
        "ठंडा नहीं कर रहा", "cooling नहीं दे रहा", "हवा गरम",
        "not cooling", "warm air", "no cooling", "गरम हवा",
        "ठंडक नहीं", "AC चल रहा है पर ठंडा नहीं"
      ]
    }
  },

  "Brake": {
    keywords: [
      "brake", "ब्रेक", "braking", "stop", "रोक", "रुकना",
      "brake fail", "brake problem", "brake issue", "ब्रेक समस्या"
    ],
    priority: 9,
    subTitles: {
      "Brake Not Working": [
        "brake नहीं लग रहा", "brake काम नहीं कर रहा", "brake fail",
        "ब्रेक नहीं लग", "ब्रेक फेल", "brake failure", "brake dead",
        "नहीं रुक रहा", "रुक नहीं रहा", "stop नहीं"
      ],
      "Weak Braking": [
        "brake कमजोर", "weak braking", "brake soft", "brake loose",
        "ब्रेक कमजोर", "brake pressure कम", "pressure down"
      ]
    }
  },

  "Engine": {
    keywords: [
      "engine", "motor", "smoke", "overheat", "heat", "power",
      "starting", "noise", "sound", "chal nahi", "चल नहीं", "चलना",
      "start", "स्टार्ट", "शुरू", "start problem", "starting problem",
      "chalu nahi", "चालू नहीं", "bilkul band", "बिल्कुल बंद", "काम नहीं",
      "एक्सीलेंट नहीं", "acccelerator", "performance", "power",
      "इंजन", "इंडियन", "मोटर", "धुआ", "धुंआ", "गरम", "गर्म",
      "पावर", "शक्ति", "ताकत", "आवाज", "शोर",
      "kaam nahi kar raha", "काम नहीं कर रहा", "काम ही नहीं",
      "par chal raha par problem", "problem ke saath chal",
      "कम से कम ताकत", "कमजोर हो गया", "रफ्तार कम"
    ],
    priority: 9,
    subTitles: {
      "Starting trouble": [
        "start", "स्टार्ट", "शुरू", "chalu nahi", "चालू नहीं",
        "self", "सेल्फ", "starter", "स्टार्टर", "kick",
        "start problem", "start नहीं", "शुरू नहीं", "starting",
        "स्टार्टिंग", "dikkat", "दिक्कत", "hone mein", "होने में",
        "shuru hone", "नहीं हो रहा", "not starting", "won't start",
        "starting issue", "start नहीं हो रहा", "engine start नहीं",
        "chal nahi raha shuru mein", "चल नहीं रहा शुरू में",
        "start on nahi aa raha", "स्टार्ट ऑन नहीं आ रहा",
        "kick नहीं दे रहा", "hand crank नहीं", "electric start नहीं",
        "motor nahi on ho raha", "मोटर नहीं ऑन हो रहा"
      ],
      "Engine Over heating": [
        "overheat", "over heat", "गरम", "गर्म", "heat", "गर्मी",
        "hot", "गरमी", "तापमान", "temperature", "hit", "हिट",
        "गर्म हो", "garam ho", "overheat ho", "ज्यादा गरम",
        "बहुत गरम", "overheating", "heating problem", "engine गर्म",
        "ज्यादा गर्म हो जाता", "steam निकल रहा", "coolant issue"
      ],
      "Smoke problem": [
        "smoke", "धुआ", "धुंआ", "dhuan", "काला धुआ", "black smoke",
        "white smoke", "सफेद धुआ", "blue smoke", "नीला धुआ",
        "smoke आ रहा", "smoke निकल रहा", "smoke ज्यादा",
        "धुआ ज्यादा निकल रहा", "oil smoke", "तेल का धुआ",
        "exhaust smoke", "एग्जॉस्ट से धुआ"
      ],
      "Abnormal Noise": [
        "noise", "sound", "आवाज", "शोर", "awaaz", "खड़खड़",
        "आवाज आ", "sound aa", "strange sound", "weird noise",
        "असामान्य आवाज", "खटखट", "घर्र", "घरघर",
        "strange awaaz", "engine noise", "weird engine sound",
        "thump-thump", "clinking", "knocking sound"
      ],
      "Engine Performance Low": [
        "power कम", "performance कम", "slow", "धीमा", "weak",
        "कमजोर", "sluggish", "no power", "उठ नहीं रहा",
        "उतार नहीं", "acceleration नहीं", "खींचने वाली नहीं",
        "रफ्तार कम है", "ताकत कम हो गई", "acceleration problem",
        "engine को ताकत नहीं है", "engine कमजोर हो गया"
      ]
    }
  },

  "Hydraulic": {
    keywords: [
      "hydraulic", "pressure", "pump", "oil", "flow", "valve",
      "cylinder", "slow", "weak",
      "हाइड्रोलिक", "प्रेशर", "दबाव", "पंप", "तेल", "धीमा",
      "कमजोर", "स्लो"
    ],
    priority: 8,
    subTitles: {
      "Pressure down": [
        "pressure", "प्रेशर", "कम", "low pressure", "दबाव कम",
        "pressure down", "प्रेशर डाउन", "pressure नहीं",
        "प्रेशर कम", "pressure fall", "दबाव कम हो गया"
      ],
      "Slow working": [
        "slow", "धीरे", "धीमा", "कम speed", "power kam", "पावर कम",
        "performance low", "weak", "कमजोर", "sluggish", "स्लो वर्किंग",
        "काम धीमा", "speed कम", "काम धीरे चल रहा"
      ],
      "Hydraulic pump leak": [
        "pump leak", "पंप लीक", "pump से leak", "hydraulic leak",
        "तेल लीक", "oil leak", "हाइड्रोलिक लीकेज"
      ]
    }
  },

  "Electrical Complaint": {
    keywords: [
      "electrical", "electric", "battery", "light", "wiring", "wire",
      "starter", "alternator", "fuse", "relay", "switch",
      "बिजली", "बैटरी", "लाइट", "वायरिंग", "तार", "self", "सेल्फ",
      "स्टार्टर", "इलेक्ट्रिकल", "बत्ती"
    ],
    priority: 8,
    subTitles: {
      "Starting trouble": [
        "start problem", "start नहीं हो रही", "स्टार्ट दिक्कत",
        "स्टार्ट नहीं हो रही", "स्टार्ट ट्रबल", "स्टार्ट",
        "self problem", "सेल्फ प्रॉब्लम", "सेल्फ नहीं",
        "chalu nahi ho rahi", "starting issue", "starting trouble",
        "शुरू नहीं", "शुरू नहीं हो रहा", "start नहीं", "नहीं चालू हो रहा",
        "not starting", "won't start", "starting problem"
      ],
      "Battery problem": [
        "battery", "बैटरी", "dead", "खत्म", "discharge", "डिस्चार्ज",
        "charge nahi", "चार्ज नहीं", "battery down", "battery low",
        "बैटरी खराब", "बैटरी डाउन", "बैटरी कम"
      ],
      "Light not working": [
        "light", "लाइट", "light problem", "बत्ती", "light not on",
        "light नहीं जल रही", "लाइट नहीं जल रही"
      ]
    }
  },

  "Tyre/Battery": {
    keywords: [
      "tyre", "tire", "battery", "puncture", "टायर", "बैटरी",
      "पंक्चर", "wheel", "पहिया"
    ],
    priority: 7,
    subTitles: {
      "Battery problem": [
        "battery", "बैटरी", "dead battery", "बैटरी खराब",
        "बैटरी डाउन", "battery issue"
      ],
      "Tube puncture": [
        "tube puncture", "ट्यूब पंक्चर", "tube फूटा", "puncture",
        "पंक्चर", "puncture दे दिया"
      ],
      "Tyre cut": [
        "tyre cut", "tire cut", "टायर कटा", "tyre damage",
        "टायर खराब", "tyre टूटा"
      ]
    }
  },

  "Transmission/Axle components": {
    keywords: [
      "transmission", "gear", "brake", "axle", "ट्रांसमिशन",
      "गियर", "ब्रेक", "clutch", "क्लच"
    ],
    priority: 7,
    subTitles: {
      "Abnormal sound": [
        "sound", "noise", "आवाज", "शोर", "transmission noise",
        "gear noise", "transmission आवाज"
      ],
      "Brake problem": [
        "brake", "ब्रेक", "braking", "ब्रेक नहीं", "brake issue",
        "brake नहीं लग रहा"
      ],
      "Gear problem": [
        "gear", "गियर", "gear problem", "gear issue", "गियर समस्या",
        "gear hard", "gear सख्त"
      ]
    }
  },

  "Cabin": {
    keywords: [
      "cabin", "cab", "door", "glass", "seat", "केबिन", "सीट",
      "दरवाजा", "शीशा", "window"
    ],
    priority: 5,
    subTitles: {
      "Cab Door Fault": [
        "door", "दरवाजा", "door problem", "door issue",
        "door खराब", "door नहीं खुल रहा"
      ],
      "Cabin glass cracked": [
        "glass crack", "शीशा टूटा", "glass broken", "window crack",
        "शीशा टूटा"
      ],
      "Operator Seat problems": [
        "seat", "सीट", "seat problem", "sitting", "सीट खराब"
      ]
    }
  },

  "Fabrication part": {
    keywords: [
      "fabrication", "crack", "boom", "bucket", "chassis",
      "फैब्रिकेशन", "क्रैक", "crack", "broken", "टूटा", "फटा"
    ],
    priority: 5,
    subTitles: {
      "Boom cracked": [
        "boom crack", "boom फटी", "boom broken", "boom टूटा",
        "boom में क्रैक"
      ],
      "Bucket cracked": [
        "bucket crack", "bucket फटी", "bucket broken",
        "bucket टूटा"
      ],
      "Chassis cracked": [
        "chassis crack", "chassis फटी", "chassis broken"
      ]
    }
  },

  "Service": {
    keywords: [
      "service", "servicing", "maintenance", "सर्विस", "सर्विसिंग",
      "मेंटेनेंस", "checking", "चेकिंग"
    ],
    priority: 3,
    subTitles: {
      "Regular Service": [
        "regular service", "normal service", "general service"
      ],
      "Maintenance": ["maintenance", "मेंटेनेंस"]
    }
  },

  "General Problem": {
    keywords: ["problem", "issue", "problem", "समस्या", "दिक्कत"],
    priority: 1,
    subTitles: {
      "Other": ["other", "कुछ और", "something else"]
    }
  }
};

/* ======================= BRANCH, OUTLET & CITY CODE MAPPING ======================= */
const cityToBranchMap = {
  'ajmer': { branch: "AJMER", outlet: "AJMER", cityCode: "1" },
  'अजमेर': { branch: "AJMER", outlet: "AJMER", cityCode: "1" },
  'kekri': { branch: "AJMER", outlet: "KEKRI", cityCode: "1" },
  'केकड़ी': { branch: "AJMER", outlet: "KEKRI", cityCode: "1" },

  'alwar': { branch: "ALWAR", outlet: "ALWAR", cityCode: "2" },
  'अलवर': { branch: "ALWAR", outlet: "ALWAR", cityCode: "2" },
  'bharatpur': { branch: "ALWAR", outlet: "BHARATPUR", cityCode: "2" },
  'भरतपुर': { branch: "ALWAR", outlet: "BHARATPUR", cityCode: "2" },
  'bhiwadi': { branch: "ALWAR", outlet: "BHIWADI", cityCode: "2" },
  'भिवाड़ी': { branch: "ALWAR", outlet: "BHIWADI", cityCode: "2" },

  'bhilwara': { branch: "BHILWARA", outlet: "BHILWARA", cityCode: "3" },
  'भीलवाड़ा': { branch: "BHILWARA", outlet: "BHILWARA", cityCode: "3" },
  'nimbahera': { branch: "BHILWARA", outlet: "NIMBAHERA", cityCode: "3" },
  'निम्बाहेड़ा': { branch: "BHILWARA", outlet: "NIMBAHERA", cityCode: "3" },

  'jaipur': { branch: "JAIPUR", outlet: "JAIPUR", cityCode: "4" },
  'जयपुर': { branch: "JAIPUR", outlet: "JAIPUR", cityCode: "4" },
  'dausa': { branch: "JAIPUR", outlet: "DAUSA", cityCode: "4" },
  'दौसा': { branch: "JAIPUR", outlet: "DAUSA", cityCode: "4" },
  'karauli': { branch: "JAIPUR", outlet: "KARAULI", cityCode: "4" },
  'करौली': { branch: "JAIPUR", outlet: "KARAULI", cityCode: "4" },
  'tonk': { branch: "JAIPUR", outlet: "TONK", cityCode: "4" },
  'टोंक': { branch: "JAIPUR", outlet: "TONK", cityCode: "4" },

  'kota': { branch: "KOTA", outlet: "KOTA", cityCode: "5" },
  'कोटा': { branch: "KOTA", outlet: "KOTA", cityCode: "5" },
  'jhalawar': { branch: "KOTA", outlet: "JHALAWAR", cityCode: "5" },
  'झालावाड़': { branch: "KOTA", outlet: "JHALAWAR", cityCode: "5" },

  'sikar': { branch: "SIKAR", outlet: "SIKAR", cityCode: "6" },
  'सीकर': { branch: "SIKAR", outlet: "SIKAR", cityCode: "6" },
  'sujangarh': { branch: "SIKAR", outlet: "SUJANGARH", cityCode: "6" },
  'सुजानगढ़': { branch: "SIKAR", outlet: "SUJANGARH", cityCode: "6" },
  'jhunjhunu': { branch: "SIKAR", outlet: "JHUNJHUNU", cityCode: "6" },
  'झुंझुनू': { branch: "SIKAR", outlet: "JHUNJHUNU", cityCode: "6" },

  'udaipur': { branch: "UDAIPUR", outlet: "UDAIPUR", cityCode: "7" },
  'उदयपुर': { branch: "UDAIPUR", outlet: "UDAIPUR", cityCode: "7" },
  'banswara': { branch: "UDAIPUR", outlet: "BANSWARA", cityCode: "7" },
  'बांसवाड़ा': { branch: "UDAIPUR", outlet: "BANSWARA", cityCode: "7" },
  'dungarpur': { branch: "UDAIPUR", outlet: "DUNGARPUR", cityCode: "7" },
  'डूंगरपुर': { branch: "UDAIPUR", outlet: "DUNGARPUR", cityCode: "7" },
};

/* ======================= HELPER: Convert phone to spoken digits ======================= */
function phoneToSpokenDigits(phone) {
  if (!phone) return "";
  
  const digitMap = {
    '0': 'zero', '1': 'ek', '2': 'do', '3': 'teen', '4': 'char',
    '5': 'paanch', '6': 'chhe', '7': 'saat', '8': 'aath', '9': 'nau'
  };
  
  return phone.split('').map(d => digitMap[d] || d).join(', ');
}

/* ===========================
   VALIDATION FUNCTIONS
=========================== */

function rejectInvalid(text) {
  if (!text) return true;
  if (text.trim().length < 2) return true;
  if (isUncertain(text)) return true;
  if (isRepeatRequest(text)) return true;
  if (isPauseRequest(text)) return true;
  return false;
}

function isUncertain(text) {
  if (!text) return false;
  const textLower = text.toLowerCase();
  return uncertaintyKeywords.some(keyword =>
    new RegExp(`\\b${keyword}\\b`, 'i').test(textLower)
  );
}

function isAffirmative(text) {
  if (!text) return false;
  const textLower = text.toLowerCase().trim();

  const simpleChecks = ['हां', 'हाँ', 'हान', 'सही', 'ठीक', 'जी', 'yes', 'ok', 'बिल्कुल'];
  for (const check of simpleChecks) {
    if (textLower.includes(check)) {
      console.log(`✅ Affirmative detected: "${check}"`);
      return true;
    }
  }

  const found = affirmativeKeywords.some(keyword => {
    const keywordLower = keyword.toLowerCase();
    return textLower.includes(keywordLower);
  });

  if (found) {
    console.log(`✅ Affirmative detected`);
  }

  return found;
}

function isNegative(text) {
  if (!text) return false;
  const textLower = text.toLowerCase().trim();

  const simpleChecks = ['नहीं', 'नही', 'ना', 'गलत', 'no', 'नाह'];
  for (const check of simpleChecks) {
    if (textLower.includes(check)) {
      console.log(`❌ Negative detected: "${check}"`);
      return true;
    }
  }

  const found = negativeKeywords.some(keyword => {
    const keywordLower = keyword.toLowerCase();
    return textLower.includes(keywordLower);
  });

  if (found) {
    console.log(`❌ Negative detected`);
  }

  return found;
}

function getSubComplaintQuestion(complaintType) {
  const questions = {
    "AC System": "AC mein exactly kya problem hai? Bilkul chal nahi raha hai, ya chal raha hai lekin thanda nahi kar raha?",
    "Engine": "Engine mein kya dikkat hai? Start nahi ho raha, ya overheat ho raha hai, ya dhuan aa raha hai, ya noise aa rahi hai?",
    "Brake": "Brake mein kya problem hai? Bilkul nahi lag raha, ya weak hai?",
    "Electrical Complaint": "Electrical mein kya problem hai? Start nahi ho raha, ya battery ki problem hai, ya light ki dikkat?",
    "Hydraulic": "Hydraulic mein kya problem hai? Pressure kam hai, ya slow kaam kar rahi hai, ya leak ho raha?",
    "Tyre/Battery": "Tyre ya battery mein kya problem hai? Battery dead hai, ya tyre puncture hai, ya tyre cut hai?",
    "Transmission/Axle components": "Transmission mein kya problem hai? Sound aa rahi hai, ya gear problem hai, ya brake issue?",
    "General Problem": "Machine mein aur detail mein kya problem hai?"
  };

  return questions[complaintType] || "Aur detail mein batayein ki exact kya problem hai?";
}

/* ======================= DETECTION FUNCTIONS ======================= */

function detectMachineType(text) {
  if (!text) return 'Warranty';
  const textLower = text.toLowerCase();

  for (const [type, keywords] of Object.entries(machineTypeKeywords)) {
    for (const keyword of keywords) {
      if (new RegExp(`\\b${keyword}\\b`, 'i').test(textLower)) {
        return type;
      }
    }
  }
  return 'Warranty';
}

function getMachineTypeByNumber(digit) {
  const machineTypeMap = {
    '1': 'Warranty',
    '2': 'JCB Care',
    '3': 'Engine Care',
    '4': 'Demo',
    '5': 'BHL'
  };
  return machineTypeMap[digit] || 'Warranty';
}

function getMachineStatusByNumber(digit) {
  const statusMap = {
    '1': 'Breakdown',
    '2': 'Running With Problem'
  };
  return statusMap[digit] || 'Running With Problem';
}

function detectMachineStatus(text) {
  if (!text) return 'Running With Problem';
  const textLower = text.toLowerCase();

  const breakdownKeywords = machineStatusKeywords['Breakdown'];
  for (const keyword of breakdownKeywords) {
    const escapedKeyword = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (new RegExp(`(^|\\s)${escapedKeyword}(\\s|$)`, 'i').test(textLower)) {
      console.log(`✓ Machine Status: Breakdown (matched: "${keyword}")`);
      return 'Breakdown';
    }
  }

  const runningKeywords = machineStatusKeywords['Running With Problem'];
  for (const keyword of runningKeywords) {
    if (textLower.includes(keyword.toLowerCase())) {
      console.log(`✓ Machine Status: Running With Problem (matched: "${keyword}")`);
      return 'Running With Problem';
    }
  }

  console.log(`⚠️ Machine Status not clearly detected, using default: Running With Problem`);
  return 'Running With Problem';
}

function detectJobLocation(text) {
  if (!text) return 'Onsite';
  const textLower = text.toLowerCase();

  const workshopKeywords = jobLocationKeywords['Workshop'];
  for (const keyword of workshopKeywords) {
    const escapedKeyword = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (new RegExp(`(^|\\s)${escapedKeyword}`, 'i').test(textLower)) {
      console.log(`✓ Job Location: Workshop (matched: "${keyword}")`);
      return 'Workshop';
    }
  }

  const onsiteKeywords = jobLocationKeywords['Onsite'];
  for (const keyword of onsiteKeywords) {
    if (textLower.includes(keyword.toLowerCase())) {
      console.log(`✓ Job Location: Onsite (matched: "${keyword}")`);
      return 'Onsite';
    }
  }

  console.log(`⚠️ Job Location not clearly detected, using default: Onsite`);
  return 'Onsite';
}

function detectComplaint(text) {
  if (!text) return null;
  const textLower = text.toLowerCase();

  let bestMatch = null;
  let highestScore = 0;

  const sortedComplaints = Object.entries(complaintMap).sort(
    (a, b) => (b[1].priority || 0) - (a[1].priority || 0)
  );

  for (const [category, config] of sortedComplaints) {
    let score = 0;

    for (const keyword of config.keywords) {
      const keywordLower = keyword.toLowerCase();
      if (textLower.includes(keywordLower)) {
        if (new RegExp(`\\b${keywordLower}\\b`, 'i').test(textLower)) {
          score += keyword.length * 2;
        } else {
          score += keyword.length;
        }
      }
    }

    if (score > highestScore) {
      highestScore = score;
      bestMatch = category;
    }
  }

  return {
    complaint: bestMatch,
    score: highestScore
  };
}

function detectSubComplaint(mainComplaint, text) {
  if (!mainComplaint || !complaintMap[mainComplaint]) {
    return { subTitle: "Other", confidence: 0.5 };
  }

  const subTitles = complaintMap[mainComplaint].subTitles;
  if (!subTitles || Object.keys(subTitles).length === 0) {
    return { subTitle: "Other", confidence: 1.0 };
  }

  const textLower = text.toLowerCase();
  let bestMatch = null;
  let highestScore = 0;

  for (const [subTitle, keywords] of Object.entries(subTitles)) {
    let score = 0;

    for (const keyword of keywords) {
      const keywordLower = keyword.toLowerCase();
      if (textLower.includes(keywordLower)) {
        if (new RegExp(`\\b${keywordLower}\\b`, 'i').test(textLower)) {
          score += keyword.length * 2;
        } else {
          score += keyword.length;
        }
      }
    }

    if (score > highestScore) {
      highestScore = score;
      bestMatch = subTitle;
    }
  }

  return {
    subTitle: bestMatch || "Other",
    confidence: highestScore > 0 ? Math.min(highestScore / 15, 1) : 0.5
  };
}

/* ======================= TEXT PROCESSING ======================= */

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
  return text.replace(/[^\w\s-]/g, '').trim() || "Unknown";
}

function detectBranchAndOutlet(city) {
  if (!city) return { branch: "NA", outlet: "NA", cityCode: "NA" };

  const normalized = city.toLowerCase().trim();
  return cityToBranchMap[normalized] || { branch: "NA", outlet: "NA", cityCode: "NA" };
}

function formatDateForExternal(date) {
  if (!date || date === "NA") return null;

  if (typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return date;
  }

  const d = new Date(date);
  if (isNaN(d.getTime())) return null;

  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");

  return `${yyyy}-${mm}-${dd}`;
}

function askDTMF(twiml, text, numDigits = 1) {
  const gather = twiml.gather({
    input: "dtmf",
    numDigits: numDigits,
    timeout: 5,
    actionOnEmptyResult: true,
    action: "/voice/process",
    method: "POST",
  });

  gather.say({ voice: "Polly.Aditi", language: "hi-IN" }, text);
}

function ask(twiml, text) {
  const gather = twiml.gather({
    input: "speech dtmf",
    language: "hi-IN",
    speechTimeout: "auto",
    timeout: 8,
    actionOnEmptyResult: true,
    action: "/voice/process",
    method: "POST",
  });

  gather.say({ voice: "Polly.Aditi", language: "hi-IN" }, text);
}

function extractServiceDate(text) {
  if (!text) return null;

  const cleaned = text.toLowerCase();
  const today = new Date();

  if (/\baaj\b|\btoday\b|\bआज\b/i.test(cleaned)) {
    return today;
  }

  if (/\bkal\b|\btomorrow\b|\bकल\b/i.test(cleaned)) {
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow;
  }

  if (/\bparso\b|\bपरसों\b|\bपरसो\b/i.test(cleaned)) {
    const dayAfter = new Date(today);
    dayAfter.setDate(dayAfter.getDate() + 2);
    return dayAfter;
  }

  return null;
}

/* ======================= EXTERNAL API CALLS ======================= */

async function fetchCustomerFromExternal({ phone, chassisNo }) {
  try {
    let apiUrl = null;

    if (phone && isValidPhone(phone)) {
      apiUrl = `${EXTERNAL_API_BASE}/get_machine_by_phone_no.php?phone_no=${phone}`;
    } else if (chassisNo && isValidChassis(chassisNo)) {
      apiUrl = `${EXTERNAL_API_BASE}/get_machine_by_machine_no.php?machine_no=${chassisNo}`;
    }

    if (!apiUrl) {
      console.log("⚠️ No valid identifier for external API");
      return null;
    }

    console.log(`🌐 Fetching from API: ${apiUrl}`);

    const response = await axios.get(apiUrl, {
      timeout: API_TIMEOUT,
      headers: API_HEADERS,
      validateStatus: (status) => status < 500,
    });

    if (
      response.status !== 200 ||
      !response.data ||
      response.data.status !== 1 ||
      !response.data.data
    ) {
      console.log("⚠️ API returned invalid response");
      return null;
    }

    const customerData = response.data.data;

    const normalized = {
      chassisNo: customerData.machine_no || chassisNo || "Unknown",
      phone: customerData.customer_phone_no || phone || "Unknown",
      name: customerData.customer_name || "Unknown",
      city: customerData.city || "Unknown",
      model: customerData.machine_model || "Unknown",
      subModel: customerData.sub_model || "NA",
      machineType: customerData.machine_type || "Unknown",
      businessPartnerCode: customerData.business_partner_code || "NA",
      purchaseDate: customerData.purchase_date || "NA",
      installationDate: customerData.installation_date || "NA",
    };

    console.log("✅ Customer data fetched successfully");
    return normalized;

  } catch (error) {
    console.error("❌ API Fetch Error:", error.message);
    return null;
  }
}

/* ======================= HINDI TO ENGLISH TRANSLATION - COMPREHENSIVE ======================= */
async function translateHindiToEnglish(text) {
  if (!text || typeof text !== 'string') return text;
  
  // Check if text contains Hindi characters
  const hindiRegex = /[\u0900-\u097F]/;
  if (!hindiRegex.test(text)) {
    return text; // Already in English or no Hindi detected
  }

  try {
    console.log(`🔤 Translating to English: "${text.substring(0, 50)}..."`);
    
    // Comprehensive Hindi-to-English dictionary
    const hindiToEnglishDict = {
      // Common words
      'नमस्ते': 'Hello',
      'धन्यवाद': 'Thank You',
      'कृपया': 'Please',
      'मेरा': 'My',
      'मेरी': 'My',
      'नाम': 'Name',
      'मशीन': 'Machine',
      'खराब': 'Broken',
      'समस्या': 'Problem',
      'काम': 'Work',
      'नहीं': 'No',
      'हाँ': 'Yes',
      'हां': 'Yes',
      'घर': 'Home',
      'दुकान': 'Shop',
      'गैरेज': 'Garage',
      'सेवा': 'Service',
      'मरम्मत': 'Repair',
      'गांव': 'Village',
      'शहर': 'City',
      'सड़क': 'Road',
      'इंजन': 'Engine',
      'ब्रेक': 'Brake',
      'टायर': 'Tire',
      'बैटरी': 'Battery',
      'खुल्ली': 'Open',
      'बंद': 'Closed',
      'पानी': 'Water',
      'तेल': 'Oil',
      'रिसाव': 'Leakage',
      'तेज़': 'Fast',
      'धीमा': 'Slow',
      'शोर': 'Noise',
      'कंपन': 'Vibration',
      'धुआँ': 'Smoke',
      'चल': 'Running',
      'बंद': 'Stop',
      'स्टार्ट': 'Start',
      'स्कूل': 'School',
      'कॉलेज': 'College',
      'फैक्ट्री': 'Factory',
      'खेत': 'Field',
      'मेरे': 'My',
      'आपका': 'Your',
      'उसका': 'His',
      'उसकी': 'Her',
      'हमारा': 'Our',
      'उनका': 'Their',
      'जो': 'Which',
      'क्या': 'What',
      'कब': 'When',
      'कहाँ': 'Where',
      'कैसे': 'How',
      'क्यों': 'Why',
      'कितना': 'How much',
      'दिन': 'Day',
      'रात': 'Night',
      'सुबह': 'Morning',
      'दोपहर': 'Afternoon',
      'शाम': 'Evening',
      'महीना': 'Month',
      'साल': 'Year',
      'सप्ताह': 'Week',
      'ईंधन': 'Fuel',
      'सर्विस': 'Service',
      'वारंटी': 'Warranty',
      'नुकसान': 'Damage',
      'खतरा': 'Danger',
      'ठीक': 'Fine',
      'सही': 'Correct',
      'गलत': 'Wrong',
      'पूरा': 'Full',
      'आधा': 'Half',
      'पहला': 'First',
      'दूसरा': 'Second',
      'तीसरा': 'Third',
      'एक': 'One',
      'दो': 'Two',
      'तीन': 'Three',
      'चार': 'Four',
      'पाँच': 'Five',
      'छः': 'Six',
      'सात': 'Seven',
      'आठ': 'Eight',
      'नौ': 'Nine',
      'दस': 'Ten',
      // Locations
      'अजमेर': 'Ajmer',
      'भरतपुर': 'Bharatpur',
      'दिल्ली': 'Delhi',
      'इलाहाबाद': 'Allahabad',
      'कानपुर': 'Kanpur',
      'लखनऊ': 'Lucknow',
      'आगरा': 'Agra',
      'वाराणसी': 'Varanasi',
      'मुंबई': 'Mumbai',
      'पुणे': 'Pune',
      'चेन्नई': 'Chennai',
      'कोलकाता': 'Kolkata',
      'बेंगलुरु': 'Bangalore',
      'हैदराबाद': 'Hyderabad',
      'जयपुर': 'Jaipur',
      'लुधियाना': 'Ludhiana',
      'चंडीगढ़': 'Chandigarh',
      'नई दिल्ली': 'New Delhi',
      'गुड़गांव': 'Gurgaon',
      'नोएडा': 'Noida',
      'ग्रेटर नोएडा': 'Greater Noida',
      'बस अड्डा': 'Bus Stand',
      'स्टेशन': 'Station',
      'अस्पताल': 'Hospital',
      'पुलिस': 'Police',
      'बाजार': 'Market',
      'पार्क': 'Park',
      'मंदिर': 'Temple',
      'मस्जिद': 'Mosque',
      'चर्च': 'Church',
      'गुरुद्वारा': 'Gurudwara',
      'नज़दीक': 'Near',
      'पास': 'Near',
      'सामने': 'Opposite',
      'पीछे': 'Behind',
      'ऊपर': 'Above',
      'नीचे': 'Below',
      'बाईं': 'Left',
      'दाईं': 'Right',
    };

    let translatedText = text;
    
    // Apply dictionary translations (longest words first to avoid partial matches)
    const sortedEntries = Object.entries(hindiToEnglishDict).sort((a, b) => b[0].length - a[0].length);
    
    for (const [hindi, english] of sortedEntries) {
      const regex = new RegExp(`\\b${hindi}\\b`, 'gi');
      translatedText = translatedText.replace(regex, english);
    }

    // Devanagari to Latin transliteration for remaining Hindi characters
    const devanagariToLatin = {
      'अ': 'A', 'आ': 'AA', 'इ': 'I', 'ई': 'II', 'उ': 'U', 'ऊ': 'UU', 'ऋ': 'RI', 'ए': 'E', 'ऐ': 'AI', 'ओ': 'O', 'औ': 'AU',
      'क': 'K', 'ख': 'KH', 'ग': 'G', 'घ': 'GH', 'ङ': 'N', 'च': 'CH', 'छ': 'CHH', 'ज': 'J', 'झ': 'JH', 'ञ': 'NY', 
      'ट': 'T', 'ठ': 'TH', 'ड': 'D', 'ढ': 'DH', 'ण': 'N', 'त': 'T', 'थ': 'TH', 'द': 'D', 'ध': 'DH', 'न': 'N', 
      'प': 'P', 'फ': 'PH', 'ब': 'B', 'भ': 'BH', 'म': 'M', 'य': 'Y', 'र': 'R', 'ल': 'L', 'व': 'V', 
      'श': 'SH', 'ष': 'SH', 'स': 'S', 'ह': 'H',
      'ा': 'A', 'ि': 'I', 'ी': 'II', 'ु': 'U', 'ू': 'UU', 'ृ': 'RI', 'े': 'E', 'ै': 'AI', 'ो': 'O', 'ौ': 'AU',
      'ः': 'H', 'ँ': 'N', 'ं': 'N',
      '०': '0', '१': '1', '२': '2', '३': '3', '४': '4', '५': '5', '६': '6', '७': '7', '८': '8', '९': '9'
    };

    // Apply transliteration for any remaining Devanagari characters
    for (const [devanagari, latin] of Object.entries(devanagariToLatin)) {
      const regex = new RegExp(devanagari, 'g');
      translatedText = translatedText.replace(regex, latin);
    }

    // Clean up: remove extra spaces and special characters
    translatedText = translatedText.replace(/\s+/g, ' ').trim();
    translatedText = translatedText.replace(/[^a-zA-Z0-9\s\-\.]/g, ''); // Remove non-ASCII except space, dash, dot

    if (translatedText && translatedText !== text) {
      console.log(`✅ Translated: "${translatedText.substring(0, 50)}..."`);
      return translatedText;
    }

    console.log(`⚠️ Could not fully translate: "${text.substring(0, 50)}..."`);
    return translatedText || text;

  } catch (error) {
    console.error("❌ Translation Error:", error.message);
    return text;
  }
}
function mergeLocationAndPincode(address, pincode) {
  if (!address && !pincode) return "Not Provided";
  if (!address) return pincode;
  if (!pincode) return address;
  
  // Merge with comma separator
  return `${address}, ${pincode}`;
}

/* ======================= FORMAT TIME TO 12-HOUR WITH AM/PM ======================= */
function formatTimeToTwelveHour(timeString) {
  if (!timeString) return "";
  
  // If already in HH:MM AM/PM format, return as-is
  if (/\d{1,2}:\d{2}\s*(AM|PM)/.test(timeString)) {
    return timeString;
  }
  
  // Extract time from different formats
  const match = timeString.match(/(\d{1,2}):?(\d{2})?/);
  if (!match) return timeString;
  
  let hour = parseInt(match[1]);
  const minute = match[2] || '00';
  
  // Ensure PM times are in 24-hour format first if needed
  const isPM = hour > 12 || /pm|evening|shaam|duphare/.test(timeString.toLowerCase());
  
  if (isPM && hour <= 12) {
    hour = hour === 12 ? 12 : hour + 12;
  }
  
  // Convert back to 12-hour format
  const displayHour = hour > 12 ? hour - 12 : (hour === 0 ? 12 : hour);
  const period = hour >= 12 ? 'PM' : 'AM';
  
  return `${String(displayHour).padStart(2, '0')}:${minute} ${period}`;
}

async function submitComplaintToExternal(complaintData) {
  try {
    console.log("\n" + "=".repeat(120));
    console.log("🌐 SUBMITTING COMPLAINT TO EXTERNAL API");
    console.log("=".repeat(120));
    console.log("📤 REQUEST DATA:");
    console.log(JSON.stringify(complaintData, null, 2));
    console.log("=".repeat(120));

    const response = await axios.post(COMPLAINT_API_URL, complaintData, {
      timeout: API_TIMEOUT,
      headers: {
        "Content-Type": "application/json",
        ...API_HEADERS
      },
      validateStatus: (status) => status < 500,
    });

    console.log("\n" + "=".repeat(120));
    console.log("📥 API RESPONSE:");
    console.log("=".repeat(120));
    console.log(`Status Code: ${response.status}`);
    console.log(`Response Data: ${JSON.stringify(response.data, null, 2)}`);
    console.log("=".repeat(120) + "\n");

    if (
      response.status !== 200 ||
      !response.data ||
      response.data.status !== 1
    ) {
      console.log("⚠️ API Rejected:", response.data?.message || "Unknown error");
      return {
        success: false,
        error: response.data?.message || "API rejected"
      };
    }

    const sapId = response.data.data?.complaint_sap_id ||
                  response.data.data?.sap_id ||
                  null;

    console.log("✅ Complaint submitted successfully. SAP ID:", sapId);

    return {
      success: true,
      data: response.data,
      sapId
    };

  } catch (error) {
    console.error("❌ Submit Error:", error.message);
    console.error("Error Details:", error.response?.data || error);
    return {
      success: false,
      error: error.message
    };
  }
}

/* ======================= SAVE COMPLAINT ======================= */

async function saveComplaint(twiml, callData) {
  try {
    const customerData = callData.customerData;
    const branchOutlet = detectBranchAndOutlet(customerData.city);

    const installationDate = customerData.installationDate &&
                            customerData.installationDate !== "NA"
      ? formatDateForExternal(customerData.installationDate)
      : null;

    // Translate Hindi fields to English before creating complaint data
    const translatedCallerName = await translateHindiToEnglish(callData.callerName || "Not Provided");
    const translatedComplaintDetails = await translateHindiToEnglish(callData.rawComplaint || "Not provided");
    const translatedAddress = await translateHindiToEnglish(callData.address || "Not Provided");
    const translatedJobLocation = await translateHindiToEnglish(callData.jobLocation || "Onsite");
    const translatedMachineStatus = await translateHindiToEnglish(callData.machineStatus || "Running With Problem");
    const translatedMachineType = await translateHindiToEnglish(callData.machineType || "Warranty");
    const translatedComplaintTitle = await translateHindiToEnglish(callData.complaintTitle || "General Problem");
    const translatedComplaintSubTitle = await translateHindiToEnglish(callData.complaintSubTitle || "Other");

    // Merge address and pincode into single machine_location field
    const mergedLocation = mergeLocationAndPincode(translatedAddress, callData.pincode || "");
    
    // Format times to 12-hour with PM
    const formattedFromTime = formatTimeToTwelveHour(callData.fromTime || "");
    const formattedToTime = formatTimeToTwelveHour(callData.toTime || "");

    const complaintApiData = {
      machine_no: callData.chassis || "Unknown",
      customer_name: safeAscii(customerData.name),
      caller_name: translatedCallerName,
      caller_no: callData.callerPhone || customerData.phone,
      contact_person: translatedCallerName,
      contact_person_number: callData.callerPhone || customerData.phone,
      machine_model: customerData.machineType || "Unknown",
      sub_model: customerData.model || "NA",
      installation_date: installationDate || "2025-01-01",
      machine_type: translatedMachineType,
      city_id: branchOutlet.cityCode,
      complain_by: "Customer",
      machine_status: translatedMachineStatus,
      job_location: translatedJobLocation,
      branch: branchOutlet.branch,
      outlet: branchOutlet.outlet,
      complaint_details: translatedComplaintDetails,
      complaint_title: translatedComplaintTitle,
      sub_title: translatedComplaintSubTitle,
      business_partner_code: customerData.businessPartnerCode || "NA",
      complaint_sap_id: "NA",
      machine_location: mergedLocation,
      service_date: callData.serviceDate
        ? formatDateForExternal(callData.serviceDate)
        : "",
      from_time: formattedFromTime,
      to_time: formattedToTime,
      job_close_lat: "0.000000",
      job_close_lng: "0.000000",
      job_open_lat: "0.000000",
      job_open_lng: "0.000000",
    };

    // ===== LOG API DATA IN ENGLISH BEFORE SENDING =====
    console.log("\n" + "=".repeat(120));
    console.log("📤 SENDING TO EXTERNAL API - ALL DATA IN ENGLISH");
    console.log("=".repeat(120));
    console.log(`📱 Caller Name: ${translatedCallerName}`);
    console.log(`☎️  Contact Person: ${translatedCallerName}`);
    console.log(`📍 Machine Location: ${mergedLocation}`);
    console.log(`🔴 Machine Status: ${translatedMachineStatus}`);
    console.log(`🏢 Service Plan: ${translatedMachineType}`);
    console.log(`🎯 Complaint: ${translatedComplaintTitle}`);
    console.log(`📝 Sub-Complaint: ${translatedComplaintSubTitle}`);
    console.log(`💬 Description: ${translatedComplaintDetails.substring(0, 80)}...`);
    console.log(`📅 Date: ${complaintApiData.service_date}`);
    console.log(`⏰ Time: ${formattedFromTime} - ${formattedToTime}`);
    console.log("=".repeat(120) + "\n");

    // Submit to external API
    const externalResult = await submitComplaintToExternal(complaintApiData);
    let sapId = null;

    if (externalResult.success) {
      sapId = externalResult.sapId;
      console.log("✅ Data successfully posted to external API");
    } else {
      console.log("⚠️ External API submission failed:", externalResult.error);
    }

    const complaintDbData = {
      machineNo: callData.chassis || "Unknown",
      chassisNo: callData.chassis || "Unknown",
      customerName: safeAscii(customerData.name),
      registeredPhone: customerData.phone || "Unknown",
      machineModel: customerData.model || "Unknown",
      machineType: translatedMachineType,
      machineStatus: translatedMachineStatus,
      jobLocation: translatedJobLocation,
      complaintGivenByName: translatedCallerName,
      complaintGivenByPhone: callData.callerPhone || "Unknown",
      machineInstallationDate: installationDate ? new Date(installationDate) : null,
      description_raw: translatedComplaintDetails,
      complaintTitle: translatedComplaintTitle,
      complaintSubTitle: translatedComplaintSubTitle,
      complaintSapId: sapId || null,
      branch: branchOutlet.branch,
      outlet: branchOutlet.outlet,
      source: "IVR_VOICE_BOT",
      machineLocationAddress: translatedAddress,
      machineLocationPincode: callData.pincode || "",
      serviceDate: callData.serviceDate || null,
      fromTime: callData.fromTime || "",
      toTime: callData.toTime || "",
    };

    // ===== LOG DATABASE DATA IN ENGLISH BEFORE SAVING =====
    console.log("\n" + "=".repeat(120));
    console.log("💾 SAVING TO DATABASE - COMPLAINT DATA IN ENGLISH");
    console.log("=".repeat(120));
    console.log(`🔧 Machine Number: ${complaintDbData.machineNo}`);
    console.log(`👤 Caller Name (English): ${complaintDbData.complaintGivenByName}`);
    console.log(`📍 Location (English): ${complaintDbData.machineLocationAddress}`);
    console.log(`📮 Pincode: ${complaintDbData.machineLocationPincode}`);
    console.log(`🎯 Complaint (English): ${complaintDbData.complaintTitle} → ${complaintDbData.complaintSubTitle}`);
    console.log(`💬 Description (English): ${complaintDbData.description_raw.substring(0, 80)}...`);
    console.log(`📅 Service Date: ${complaintDbData.serviceDate}`);
    console.log("=".repeat(120) + "\n");

    // Save to MongoDB
    console.log("\n" + "=".repeat(120));
    console.log("💾 SAVING COMPLAINT TO DATABASE");
    console.log("=".repeat(120));
    console.log("📝 DATABASE PAYLOAD:");
    console.log(JSON.stringify(complaintDbData, null, 2));
    console.log("=".repeat(120));

    const savedComplaint = await Complaint.create(complaintDbData);
    
    console.log("\n" + "=".repeat(120));
    console.log("✅ COMPLAINT SUCCESSFULLY SAVED TO DATABASE");
    console.log("=".repeat(120));
    console.log(`Database ID: ${savedComplaint._id}`);
    console.log(`SAP ID: ${sapId}`);
    console.log(`Machine: ${callData.chassis}`);
    console.log(`Customer: ${customerData.name}`);
    console.log(`Type: ${callData.machineType}`);
    console.log(`Status: ${callData.machineStatus}`);
    console.log("=".repeat(120) + "\n");

    return { success: true, sapId };

  } catch (error) {
    console.error("\n" + "❌".repeat(60));
    console.error("DATABASE ERROR:", error.message);
    console.error("❌".repeat(60) + "\n");
    return { success: false, error: error.message };
  }
}

/* ======================= INCOMING CALL HANDLER ======================= */

router.post("/", async (req, res) => {
  const { CallSid, From } = req.body;
  const twiml = new VoiceResponse();

  activeCalls.set(CallSid, {
    callSid: CallSid,
    from: From,
    step: "ivr_menu",
    retries: 0,
  });

  const gather = twiml.gather({
    input: "dtmf",
    numDigits: 1,
    timeout: 5,
    action: "/voice/process",
    method: "POST",
  });

  gather.say(
    { voice: "Polly.Aditi", language: "hi-IN" },
    "Namaste! Rajesh JCB Motors mein aapka swagat hai. Complaint register karne ke liye ek dabayein. Agar aap kisi agent se baat karna chahte hain to do dabayien."
  );

  res.type("text/xml").send(twiml.toString());
});

/* ======================= MAIN PROCESSING HANDLER ======================= */

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
      };
      activeCalls.set(CallSid, callData);
    }

    if (!SpeechResult && !Digits) {
      const lastQ = callData.lastQuestion || "Kripya apna jawab bolein.";
      ask(twiml, lastQ);
      activeCalls.set(CallSid, callData);
      return res.type("text/xml").send(twiml.toString());
    }

    // ===== IVR MENU =====
    if (callData.step === "ivr_menu") {
      if (Digits === "2") {
        twiml.say(
          { voice: "Polly.Aditi", language: "hi-IN" },
          "Theek hai. Aapko agent se connect kiya ja raha hai."
        );
        twiml.dial(process.env.HUMAN_AGENT_NUMBER);
        activeCalls.delete(CallSid);
        return res.type("text/xml").send(twiml.toString());
      }

      if (Digits === "1") {
        callData.step = "ask_identifier";
        callData.retries = 0;
        callData.lastQuestion = "Machine number type karke hash (#) key dabayein.";
        const gather = twiml.gather({
          input: "dtmf",
          finishOnKey: "#",
          timeout: 20,
          actionOnEmptyResult: true,
          action: "/voice/process",
          method: "POST",
        });
        gather.say({ voice: "Polly.Aditi", language: "hi-IN" }, callData.lastQuestion);
        activeCalls.set(CallSid, callData);
        return res.type("text/xml").send(twiml.toString());
      }

      askDTMF(twiml, "Kripya ek ya do dabayien.", 1);
      activeCalls.set(CallSid, callData);
      return res.type("text/xml").send(twiml.toString());
    }

    const rawSpeech = cleanSpeech(SpeechResult || "");

    console.log("\n" + "=".repeat(120));
    console.log(`📞 CALL: ${CallSid} | STEP: ${callData.step}`);
    console.log(`🎤 CUSTOMER: "${SpeechResult}" || 🔢 DIGITS: "${Digits}"`);
    console.log(`🧹 CLEANED: "${rawSpeech}"`);
    console.log("=".repeat(120));

    // ===== ASK IDENTIFIER FOR NON-REGISTERED =====
    if (callData.step === "ask_identifier") {
      // Handle STAR (*) key to repeat last question
      if (Digits === "*") {
        console.log("🔄 User pressed * - Repeating last question");
        const gather = twiml.gather({
          input: "dtmf",
          finishOnKey: "#",
          timeout: 20,
          actionOnEmptyResult: true,
          action: "/voice/process",
          method: "POST",
        });
        gather.say({ voice: "Polly.Aditi", language: "hi-IN" }, callData.lastQuestion || "Machine number type karke hash (#) key dabayein.");
        activeCalls.set(CallSid, callData);
        return res.type("text/xml").send(twiml.toString());
      }

      // Check if user provided DTMF digits (chassis/phone number)
      let inputToProcess = rawSpeech;
      
      if (Digits && Digits.trim().length > 0) {
        console.log(`🔢 Processing DTMF input: "${Digits}"`);
        // Strip leading # if present (from #number# format)
        let cleanedDigits = Digits.trim();
        if (cleanedDigits.startsWith('#')) {
          cleanedDigits = cleanedDigits.substring(1);
        }
        // Strip trailing # if present
        if (cleanedDigits.endsWith('#')) {
          cleanedDigits = cleanedDigits.substring(0, cleanedDigits.length - 1);
        }
        inputToProcess = cleanedDigits;
        console.log(`🔧 Cleaned DTMF: "${inputToProcess}"`);
      }

      // If no input at all
      if (!inputToProcess || inputToProcess.trim().length === 0) {
        callData.retries = (callData.retries || 0) + 1;
        console.log(`⚠️ No input received - Retry ${callData.retries}/3`);

        if (callData.retries >= 3) {
          console.log("❌ No input received after 3 retries - Escalating");
          twiml.say(
            { voice: "Polly.Aditi", language: "hi-IN" },
            "Samajh nahi paye. Aapko agent se connect kar rahe hain."
          );
          twiml.dial(process.env.HUMAN_AGENT_NUMBER);
          activeCalls.delete(CallSid);
          return res.type("text/xml").send(twiml.toString());
        }

        callData.lastQuestion = `Retry ${callData.retries}/3: Machine number type karke hash (#) key dabayein.`;
        const gather = twiml.gather({
          input: "dtmf",
          finishOnKey: "#",
          timeout: 20,
          actionOnEmptyResult: true,
          action: "/voice/process",
          method: "POST",
        });
        gather.say({ voice: "Polly.Aditi", language: "hi-IN" }, callData.lastQuestion);
        activeCalls.set(CallSid, callData);
        return res.type("text/xml").send(twiml.toString());
      }

      // Try to extract identifier from input (speech or DTMF)
      let chassis = null;
      let phone = null;

      // If it looks like DTMF digits only, try both extraction methods
      if (/^\d+$/.test(inputToProcess)) {
        console.log(`📌 Numeric input detected: "${inputToProcess}"`);
        chassis = extractChassisNumberV2(inputToProcess);
        phone = extractPhoneNumberV2(inputToProcess);
      } else {
        // Mixed speech input
        chassis = extractChassisNumberV2(inputToProcess);
        phone = extractPhoneNumberV2(inputToProcess);
      }

      console.log(`✓ Extracted - Chassis: ${chassis || "N/A"} | Phone: ${phone || "N/A"}`);

      let identifier = null;
      if (chassis && isValidChassis(chassis)) {
        identifier = chassis;
        console.log(`✅ Using Chassis: ${identifier}`);
      } else if (phone && isValidPhone(phone)) {
        identifier = phone;
        console.log(`✅ Using Phone: ${identifier}`);
      }

      if (!identifier) {
        callData.retries = (callData.retries || 0) + 1;
        console.log(`⚠️ Invalid identifier extracted - Retry ${callData.retries}/3`);

        if (callData.retries >= 3) {
          console.log("❌ No valid identifier found after 3 retries - Fetching from API with raw input");
          
          // Try direct API fetch with the raw input
          let apiUrl = null;
          if (/^\d{10}$/.test(inputToProcess)) {
            apiUrl = `${EXTERNAL_API_BASE}/get_machine_by_phone_no.php?phone_no=${inputToProcess}`;
            console.log(`🌐 Trying Phone API: ${apiUrl}`);
          } else if (inputToProcess.length >= 7) {
            apiUrl = `${EXTERNAL_API_BASE}/get_machine_by_machine_no.php?machine_no=${inputToProcess}`;
            console.log(`🌐 Trying Chassis API: ${apiUrl}`);
          }

          if (apiUrl) {
            try {
              const response = await axios.get(apiUrl, {
                timeout: API_TIMEOUT,
                headers: API_HEADERS,
                validateStatus: (status) => status < 500,
              });

              if (response.status === 200 && response.data?.status === 1 && response.data?.data) {
                console.log("✅ Found in API with raw input!");
                identifier = inputToProcess;
              } else {
                console.log("❌ API returned no data - Escalating");
                twiml.say(
                  { voice: "Polly.Aditi", language: "hi-IN" },
                  "Hum aapka machine record nahi khoj paye. Aapko agent se connect kar rahe hain."
                );
                twiml.dial(process.env.HUMAN_AGENT_NUMBER);
                activeCalls.delete(CallSid);
                return res.type("text/xml").send(twiml.toString());
              }
            } catch (error) {
              console.error("❌ API Error:", error.message);
              twiml.say(
                { voice: "Polly.Aditi", language: "hi-IN" },
                "API mein error hai. Aapko agent se connect kar rahe hain."
              );
              twiml.dial(process.env.HUMAN_AGENT_NUMBER);
              activeCalls.delete(CallSid);
              return res.type("text/xml").send(twiml.toString());
            }
          } else {
            twiml.say(
              { voice: "Polly.Aditi", language: "hi-IN" },
              "Hum aapka identifier samajh nahi paye. Aapko agent se connect kar rahe hain."
            );
            twiml.dial(process.env.HUMAN_AGENT_NUMBER);
            activeCalls.delete(CallSid);
            return res.type("text/xml").send(twiml.toString());
          }
        }

        if (!identifier) {
          callData.lastQuestion = `Retry ${callData.retries}/3: Machine number type karke hash (#) key dabayein.`;
          const gather = twiml.gather({
            input: "dtmf",
            finishOnKey: "#",
            timeout: 20,
            actionOnEmptyResult: true,
            action: "/voice/process",
            method: "POST",
          });
          gather.say({ voice: "Polly.Aditi", language: "hi-IN" }, callData.lastQuestion);
          activeCalls.set(CallSid, callData);
          return res.type("text/xml").send(twiml.toString());
        }
      }

      // ===== FETCH MACHINE DATA FROM API =====
      console.log("\n" + "=".repeat(120));
      console.log(`🌐 FETCHING MACHINE DATA FROM API FOR IDENTIFIER: ${identifier}`);
      console.log("=".repeat(120));

      const customerData = await fetchCustomerFromExternal({ 
        phone: /^\d{10}$/.test(identifier) ? identifier : null,
        chassisNo: !/^\d{10}$/.test(identifier) ? identifier : null
      });

      if (!customerData) {
        console.log("❌ Machine not found in API database");
        twiml.say(
          { voice: "Polly.Aditi", language: "hi-IN" },
          "Hum aapka machine API mein nahi khoj paye. Aapko agent se connect kar rahe hain."
        );
        twiml.dial(process.env.HUMAN_AGENT_NUMBER);
        activeCalls.delete(CallSid);
        return res.type("text/xml").send(twiml.toString());
      }

      console.log("✅ Machine found in API!");
      console.log(`📍 City: ${customerData.city}`);
      console.log(`👤 Name: ${customerData.name}`);
      console.log("=".repeat(120) + "\n");

      // ===== CONFIRM CUSTOMER CITY AND NAME =====
      callData.chassis = identifier;
      callData.customerData = customerData;
      callData.isRegistered = false;
      callData.step = "confirm_customer_details";
      callData.retries = 0;
      
      const confirmQuestion = `Aapka city hai ${customerData.city} aur naam hai ${customerData.name}. Kya yeh theek hai? Haan to 1 dabayein, nahi to 2 dabayein.`;
      callData.lastQuestion = confirmQuestion;
      
      console.log(`🔊 Asking for confirmation: "${confirmQuestion}"`);
      askDTMF(twiml, confirmQuestion, 1);
      activeCalls.set(CallSid, callData);
      return res.type("text/xml").send(twiml.toString());
    }

    // ===== CONFIRM CUSTOMER DETAILS =====
    if (callData.step === "confirm_customer_details") {
      if (Digits === "*") {
        console.log("🔄 User pressed * - Repeating confirmation question");
        askDTMF(twiml, callData.lastQuestion || "Kya details theek hain? 1 ya 2 dabayein.", 1);
        activeCalls.set(CallSid, callData);
        return res.type("text/xml").send(twiml.toString());
      }

      if (Digits === "1") {
        // Customer confirmed - Continue
        console.log("✅ Customer confirmed details - Moving to next step");
        callData.step = "ask_caller_name";
        callData.retries = 0;
        callData.lastQuestion = "Bahut accha! Ab mujhe batayein, Aapka Pura naam Kya hain?";
        ask(twiml, callData.lastQuestion);
        activeCalls.set(CallSid, callData);
        return res.type("text/xml").send(twiml.toString());
      } else if (Digits === "2") {
        // Customer denied - Restart
        console.log("❌ Customer rejected details - Restarting identifier collection");
        callData.step = "ask_identifier";
        callData.retries = 0;
        callData.lastQuestion = "Theek hai. Dobara: Machine number type karke hash (#) key dabayein.";
        const gather = twiml.gather({
          input: "dtmf",
          finishOnKey: "#",
          timeout: 20,
          actionOnEmptyResult: true,
          action: "/voice/process",
          method: "POST",
        });
        gather.say({ voice: "Polly.Aditi", language: "hi-IN" }, callData.lastQuestion);
        activeCalls.set(CallSid, callData);
        return res.type("text/xml").send(twiml.toString());
      } else {
        callData.retries = (callData.retries || 0) + 1;
        if (callData.retries >= 2) {
          console.log("❌ Invalid confirmation after retries - Escalating");
          twiml.say(
            { voice: "Polly.Aditi", language: "hi-IN" },
            "Samajh nahi paye. Aapko agent se connect kar rahe hain."
          );
          twiml.dial(process.env.HUMAN_AGENT_NUMBER);
          activeCalls.delete(CallSid);
          return res.type("text/xml").send(twiml.toString());
        }
        askDTMF(twiml, "Kripya 1 ya 2 dabayien.", 1);
        activeCalls.set(CallSid, callData);
        return res.type("text/xml").send(twiml.toString());
      }
    }

    // ===== ASK CHASSIS (FOR REGISTERED CUSTOMERS) =====
    if (callData.step === "ask_chassis") {
      const chassis = extractChassisNumberV2(rawSpeech);
      console.log(`✓ Chassis: ${chassis || "N/A"}`);

      if (!chassis || !isValidChassis(chassis)) {
        callData.retries = (callData.retries || 0) + 1;

        if (callData.retries >= 2) {
          console.log(`❌ Invalid chassis after ${callData.retries} attempts - Escalating`);
          twiml.say(
            { voice: "Polly.Aditi", language: "hi-IN" },
            "Hum aapka chassis number samajh nahi paye. Aapko agent se connect kar rahe hain."
          );
          twiml.dial(process.env.HUMAN_AGENT_NUMBER);
          activeCalls.delete(CallSid);
          return res.type("text/xml").send(twiml.toString());
        }

        const hints = callData.retries === 1
          ? "Koi baat nahi. Chassis number ek ek digit ke saath dhire dhire boliye. Jaise: teen, teen, zero, paanch, char, char, saat."
          : "Apni machine ke documents mein dekh kar chassis number boliye. Ek ek number clear boliye.";

        callData.lastQuestion = hints;
        ask(twiml, hints);
        activeCalls.set(CallSid, callData);
        return res.type("text/xml").send(twiml.toString());
      }

      const customerData = await fetchCustomerFromExternal({ chassisNo: chassis });

      if (!customerData) {
        callData.retries = (callData.retries || 0) + 1;

        if (callData.retries >= 2) {
          console.log("❌ Customer not found - Escalating");
          twiml.say(
            { voice: "Polly.Aditi", language: "hi-IN" },
            "Machine ka record nahi mila. Aapko agent se connect kar rahe hain."
          );
          twiml.dial(process.env.HUMAN_AGENT_NUMBER);
          activeCalls.delete(CallSid);
          return res.type("text/xml").send(twiml.toString());
        }

        callData.lastQuestion = "Record nahi mila. Phir se chassis number boliye.";
        ask(twiml, callData.lastQuestion);
        activeCalls.set(CallSid, callData);
        return res.type("text/xml").send(twiml.toString());
      }

      console.log(`✅ Customer found: ${customerData.name}`);
      callData.chassis = chassis;
      callData.customerData = customerData;
      callData.isRegistered = true;
      callData.step = "ask_caller_name";
      callData.retries = 0;
      callData.lastQuestion = "Theek hai! Machine ka record mil gaya. Ab apna pura naam batayein, kripya.";
      ask(twiml, callData.lastQuestion);
      activeCalls.set(CallSid, callData);
      return res.type("text/xml").send(twiml.toString());
    }

    // ===== ASK CALLER NAME =====
    if (callData.step === "ask_caller_name") {
      // Handle STAR (*) key to repeat last question
      if (Digits === "*") {
        console.log("🔄 User pressed * - Repeating caller name question");
        ask(twiml, callData.lastQuestion || "Aapka pura naam batayein.");
        activeCalls.set(CallSid, callData);
        return res.type("text/xml").send(twiml.toString());
      }

      if (rejectInvalid(rawSpeech)) {
        callData.retries = (callData.retries || 0) + 1;

        if (callData.retries >= 2) {
          twiml.say(
            { voice: "Polly.Aditi", language: "hi-IN" },
            "Naam samajh nahi aaya. Aapko ek agent se connect kar dete hain."
          );
          twiml.dial(process.env.HUMAN_AGENT_NUMBER);
          activeCalls.delete(CallSid);
          return res.type("text/xml").send(twiml.toString());
        }

        console.log(`⚠️ Invalid name input - Retry ${callData.retries}/3`);
        callData.lastQuestion = "Naam clear samajh nahi aaya. Apna pura naam dobara boliye, thoda slow karke.";
        ask(twiml, callData.lastQuestion);
        activeCalls.set(CallSid, callData);
        return res.type("text/xml").send(twiml.toString());
      }

      const name = extractNameV2(rawSpeech);
      console.log(`✓ Caller Name Extracted: ${name || "N/A"}`);

      if (!name || !isValidName(name)) {
        callData.retries = (callData.retries || 0) + 1;

        if (callData.retries >= 2) {
          twiml.say(
            { voice: "Polly.Aditi", language: "hi-IN" },
            "Samajh nahi aa raha. Agent ko connect karte hain."
          );
          twiml.dial(process.env.HUMAN_AGENT_NUMBER);
          activeCalls.delete(CallSid);
          return res.type("text/xml").send(twiml.toString());
        }

        console.log(`⚠️ Name validation failed - Retry ${callData.retries}/3`);
        callData.lastQuestion = "Apna pura naam saaf saaf boliye, thoda slow boliye na.";
        ask(twiml, callData.lastQuestion);
        activeCalls.set(CallSid, callData);
        return res.type("text/xml").send(twiml.toString());
      }

      callData.callerName = name;
      callData.retries = 0;
      callData.step = "ask_caller_phone";
      callData.lastQuestion = "Shukriya! Ab apna 10 digit mobile number boliye ya type karein, phir # key dabayein. Jaise: nau aath aath do tiin char...";
      const gather = twiml.gather({
        input: "speech dtmf",
        language: "hi-IN",
        speechTimeout: "auto",
        timeout: 15,
        finishOnKey: "#",
        numDigits: 10,
        actionOnEmptyResult: true,
        action: "/voice/process",
        method: "POST",
      });
      gather.say({ voice: "Polly.Aditi", language: "hi-IN" }, callData.lastQuestion);
      activeCalls.set(CallSid, callData);
      return res.type("text/xml").send(twiml.toString());
    }

    // ===== ASK CALLER PHONE =====
    if (callData.step === "ask_caller_phone") {
      // Handle STAR (*) key to repeat last question
      if (Digits === "*") {
        console.log("🔄 User pressed * - Repeating phone entry question");
        const gather = twiml.gather({
          input: "speech dtmf",
          language: "hi-IN",
          speechTimeout: "auto",
          timeout: 15,
          finishOnKey: "#",
          numDigits: 10,
          actionOnEmptyResult: true,
          action: "/voice/process",
          method: "POST",
        });
        gather.say({ voice: "Polly.Aditi", language: "hi-IN" }, "Aapka 10 digit mobile number kahiye ya type karein, phir # key dabayein.");
        activeCalls.set(CallSid, callData);
        return res.type("text/xml").send(twiml.toString());
      }

      // Extract phone from either speech or DTMF
      let phoneInput = null;
      
      // First try DTMF digits
      if (Digits && Digits.trim().length > 0) {
        phoneInput = Digits.replace(/[^0-9]/g, ''); // Clean to digits only
        console.log(`📱 DTMF Phone Input: "${phoneInput}" (Length: ${phoneInput.length})`);
      }
      
      // Fallback to speech extraction
      if (!phoneInput || phoneInput.length < 10) {
        if (rawSpeech && rawSpeech.length > 0) {
          const extracted = extractPhoneNumberV2(rawSpeech);
          if (extracted && isValidPhone(extracted)) {
            phoneInput = extracted;
            console.log(`📱 Speech Phone Extracted: "${phoneInput}"`);
          }
        }
      }

      if (phoneInput && isValidPhone(phoneInput) && phoneInput.length === 10) {
        // Valid phone number entered
        callData.callerPhone = phoneInput;
        callData.step = "confirm_phone";
        callData.retries = 0;
        const spokenDigits = phoneToSpokenDigits(phoneInput);
        callData.lastQuestion = `Aapka phone number: ${spokenDigits}. Kya ye number sahi hai? Press 1 agar haan, Press 2 agar nahi.`;
        askDTMF(twiml, callData.lastQuestion, 1);
        activeCalls.set(CallSid, callData);
        return res.type("text/xml").send(twiml.toString());
      } else {
        // Invalid or incomplete phone
        callData.retries = (callData.retries || 0) + 1;

        if (phoneInput) {
          console.log(`⚠️ Invalid phone format "${phoneInput}" (${phoneInput.length} digits) - Retry ${callData.retries}/4`);
        } else {
          console.log(`⚠️ No phone input - Retry ${callData.retries}/4`);
        }

        if (callData.retries >= 4) {
          console.log("❌ Invalid phone after 4 retries - Transferring to agent");
          twiml.say(
            { voice: "Polly.Aditi", language: "hi-IN" },
            "Hum aapka phone number samajh nahi paye. Aapko agent se connect kar rahe hain."
          );
          twiml.dial(process.env.HUMAN_AGENT_NUMBER);
          activeCalls.delete(CallSid);
          return res.type("text/xml").send(twiml.toString());
        }

        callData.lastQuestion = `Retry ${callData.retries}/4: Aapka 10 digit mobile number boliye. Jaise: nau aath aath do tiin char...`;
        const gather = twiml.gather({
          input: "speech dtmf",
          language: "hi-IN",
          speechTimeout: "auto",
          timeout: 15,
          finishOnKey: "#",
          numDigits: 10,
          actionOnEmptyResult: true,
          action: "/voice/process",
          method: "POST",
        });
        gather.say({ voice: "Polly.Aditi", language: "hi-IN" }, callData.lastQuestion);
        activeCalls.set(CallSid, callData);
        return res.type("text/xml").send(twiml.toString());
      }
    }

    // ===== CONFIRM PHONE =====
    if (callData.step === "confirm_phone") {
      if (Digits === "*") {
        console.log("🔄 User pressed * - Repeating phone confirmation question");
        askDTMF(twiml, callData.lastQuestion || "Press 1 for Yes, 2 for No.", 1);
        activeCalls.set(CallSid, callData);
        return res.type("text/xml").send(twiml.toString());
      }

      if (Digits === "1") {
        console.log(`✓ Phone confirmed: ${callData.callerPhone}`);
        callData.step = "ask_machine_type_numeric";
        callData.retries = 0;
        callData.lastQuestion = "Shukriya. Ab aapke machine ka service plan batayein. Press 1 for Warranty, Press 2 for JCB Care, Press 3 for Engine Care, Press 4 for Demo, Press 5 for BHL.";
        askDTMF(twiml, callData.lastQuestion, 1);
        activeCalls.set(CallSid, callData);
        return res.type("text/xml").send(twiml.toString());
      }

      if (Digits === "2") {
        console.log(`❌ Phone not confirmed - Re-asking`);
        callData.step = "ask_caller_phone";
        callData.retries = 0;
        callData.lastQuestion = "Theek hai. Dobara: 10 digit mobile number boliye ya type karein, phir # key dabayein.";
        const gather = twiml.gather({
          input: "speech dtmf",
          language: "hi-IN",
          speechTimeout: "auto",
          timeout: 15,
          finishOnKey: "#",
          numDigits: 10,
          actionOnEmptyResult: true,
          action: "/voice/process",
          method: "POST",
        });
        gather.say({ voice: "Polly.Aditi", language: "hi-IN" }, callData.lastQuestion);
        activeCalls.set(CallSid, callData);
        return res.type("text/xml").send(twiml.toString());
      }

      // If user speaks unexpected input or no digit pressed, repeat question
      if (!Digits || Digits.trim().length === 0) {
        callData.retries = (callData.retries || 0) + 1;
        console.log(`⚠️ No/invalid digit pressed - Retry ${callData.retries}/2 for phone confirmation`);

        if (callData.retries >= 2) {
          callData.step = "ask_machine_type_numeric";
          callData.retries = 0;
          callData.lastQuestion = "Theek hai. Ab machine type select karein. Press 1 for Warranty, 2 for JCB Care, 3 for Engine Care, 4 for Demo, 5 for BHL.";
          askDTMF(twiml, callData.lastQuestion, 1);
          activeCalls.set(CallSid, callData);
          return res.type("text/xml").send(twiml.toString());
        }

        console.log("⚠️ Repeating: Press 1 for Yes, 2 for No");
        askDTMF(twiml, "Press 1 for Yes, 2 for No.", 1);
        activeCalls.set(CallSid, callData);
        return res.type("text/xml").send(twiml.toString());
      }
    }

    // ===== ASK MACHINE TYPE - NUMERIC IVR =====
    if (callData.step === "ask_machine_type_numeric") {
      // Handle STAR (*) key to repeat last question
      if (Digits === "*") {
        console.log("🔄 User pressed * - Repeating machine type question");
        askDTMF(twiml, callData.lastQuestion || "Press 1 for Warranty, 2 for JCB Care, 3 for Engine Care, 4 for Demo, 5 for BHL.", 1);
        activeCalls.set(CallSid, callData);
        return res.type("text/xml").send(twiml.toString());
      }

      const machineType = getMachineTypeByNumber(Digits);

      if (Digits && ['1', '2', '3', '4', '5'].includes(Digits)) {
        console.log(`✓ Machine Type Selected: ${machineType} (Digit: ${Digits})`);
        callData.machineType = machineType;
        // SKIP CONFIRMATION - DIRECTLY GO TO MACHINE STATUS
        callData.step = "ask_machine_status_numeric";
        callData.retries = 0;
        callData.lastQuestion = "Theek hai. Ab batayein - aapkai machine ka status kya hai? Press 1 agar bilkul band ho gayi hai, ya Press 2 agar chal rahi hai par problem aa rahi hai.";
        askDTMF(twiml, callData.lastQuestion, 1);
        activeCalls.set(CallSid, callData);
        return res.type("text/xml").send(twiml.toString());
      } else {
        callData.retries = (callData.retries || 0) + 1;

        if (callData.retries >= 2) {
          console.log("❌ Invalid machine type - Using default");
          callData.machineType = "Warranty";
          callData.step = "ask_machine_status_numeric";
          callData.retries = 0;
          callData.lastQuestion = "Theek hai. Ab machine ka status - band hai ya chal rahi hai? Press 1 ya Press 2.";
          askDTMF(twiml, callData.lastQuestion, 1);
          activeCalls.set(CallSid, callData);
          return res.type("text/xml").send(twiml.toString());
        }

        callData.lastQuestion = "Galat input. Kripya 1 se 5 ke beech number dabayein.";
        askDTMF(twiml, callData.lastQuestion, 1);
        activeCalls.set(CallSid, callData);
        return res.type("text/xml").send(twiml.toString());
      }
    }

    // ===== ASK MACHINE STATUS - NUMERIC IVR =====
    if (callData.step === "ask_machine_status_numeric") {
      // Handle STAR (*) key to repeat last question
      if (Digits === "*") {
        console.log("🔄 User pressed * - Repeating machine status question");
        askDTMF(twiml, callData.lastQuestion || "1 ya 2 dabayien.", 1);
        activeCalls.set(CallSid, callData);
        return res.type("text/xml").send(twiml.toString());
      }

      const status = getMachineStatusByNumber(Digits);

      if (Digits && ['1', '2'].includes(Digits)) {
        console.log(`✓ Machine Status Selected: ${status} (Digit: ${Digits})`);
        callData.machineStatus = status;
        // SKIP CONFIRMATION - DIRECTLY GO TO LOCATION
        callData.step = "ask_machine_location_numeric";
        callData.retries = 0;
        callData.lastQuestion = "Acha. Ab batayein aapka machine kahan hai? Press 1 agar Site par hai, Press 2 agar Workshop mein hai.";
        askDTMF(twiml, callData.lastQuestion, 1);
        activeCalls.set(CallSid, callData);
        return res.type("text/xml").send(twiml.toString());
      } else {
        callData.retries = (callData.retries || 0) + 1;

        if (callData.retries >= 2) {
          console.log("❌ Invalid machine status - Using default");
          callData.machineStatus = "Running With Problem";
          callData.step = "ask_machine_location_numeric";
          callData.retries = 0;
          callData.lastQuestion = "Machine kahan hai? Press 1 for Site, Press 2 for Workshop.";
          askDTMF(twiml, callData.lastQuestion, 1);
          activeCalls.set(CallSid, callData);
          return res.type("text/xml").send(twiml.toString());
        }

        callData.lastQuestion = "Galat input. Press 1 agar band hai, Press 2 agar problem ke saath chal raha hai.";
        askDTMF(twiml, callData.lastQuestion, 1);
        activeCalls.set(CallSid, callData);
        return res.type("text/xml").send(twiml.toString());
      }
    }

    // ===== ASK MACHINE LOCATION - NUMERIC IVR =====
    if (callData.step === "ask_machine_location_numeric") {
      // Handle STAR (*) key to repeat last question
      if (Digits === "*") {
        console.log("🔄 User pressed * - Repeating machine location question");
        askDTMF(twiml, "Location: Press 1 for Site, Press 2 for Workshop.", 1);
        activeCalls.set(CallSid, callData);
        return res.type("text/xml").send(twiml.toString());
      }

      if (Digits && ['1', '2'].includes(Digits)) {
        const locationNames = {
          '1': 'Site',
          '2': 'Workshop'
        };
        callData.jobLocation = locationNames[Digits];
        console.log(`✓ Machine Location Selected: ${callData.jobLocation}`);
        
        callData.step = "ask_address";
        callData.retries = 0;
        callData.lastQuestion = "Bilkul theek hai. Ab machine ka full address batayein - city ka naam, area, aur paas mein koi famous shop ya landmark.";
        ask(twiml, callData.lastQuestion);
        activeCalls.set(CallSid, callData);
        return res.type("text/xml").send(twiml.toString());
      } else {
        callData.retries = (callData.retries || 0) + 1;

        if (callData.retries >= 2) {
          console.log("❌ Invalid location - Using default");
          callData.jobLocation = "Site";
          callData.step = "ask_complaint";
          callData.retries = 0;
          callData.lastQuestion = "Theek hai. Ab complaint batayein - machine mein kya problem aa rahi hai?";
          ask(twiml, callData.lastQuestion);
          activeCalls.set(CallSid, callData);
          return res.type("text/xml").send(twiml.toString());
        }

        callData.lastQuestion = "Galat input. Press 1 for Site, Press 2 for Workshop.";
        askDTMF(twiml, callData.lastQuestion, 1);
        activeCalls.set(CallSid, callData);
        return res.type("text/xml").send(twiml.toString());
      }
    }

    // ===== ASK ADDRESS =====

    // ===== ASK ADDRESS =====
    if (callData.step === "ask_address") {
      // Handle STAR (*) key to repeat last question
      if (Digits === "*") {
        console.log("🔄 User pressed * - Repeating address question");
        callData.lastQuestion = "Machine ka address dobara boliye. City aur area name zaroori hai.";
        ask(twiml, callData.lastQuestion);
        activeCalls.set(CallSid, callData);
        return res.type("text/xml").send(twiml.toString());
      }

      if (rejectInvalid(rawSpeech)) {
        callData.retries = (callData.retries || 0) + 1;

        if (callData.retries >= 2) {
          callData.address = "Not Provided";
          callData.step = "ask_pincode";
          callData.retries = 0;
          callData.lastQuestion = "Theek hai. Ab apna 6 digit pincode batayein.";
          ask(twiml, callData.lastQuestion);
          activeCalls.set(CallSid, callData);
          return res.type("text/xml").send(twiml.toString());
        }

        console.log(`⚠️ Invalid address input - Retry ${callData.retries}/3`);
        ask(twiml, callData.lastQuestion);
        activeCalls.set(CallSid, callData);
        return res.type("text/xml").send(twiml.toString());
      }

      const address = extractLocationAddressV2(rawSpeech);
      console.log(`✓ Address: ${address || "N/A"}`);

      if (!address || !isValidAddress(address)) {
        callData.retries = (callData.retries || 0) + 1;

        if (callData.retries >= 2) {
          callData.address = "Not Provided";
          callData.step = "ask_pincode";
          callData.retries = 0;
          callData.lastQuestion = "Theek hai. Ab apna 6 digit pincode batayein.";
          ask(twiml, callData.lastQuestion);
          activeCalls.set(CallSid, callData);
          return res.type("text/xml").send(twiml.toString());
        }

        console.log(`⚠️ Invalid address format - Retry ${callData.retries}/3`);
        callData.lastQuestion = "Address clear samajh nahi aaya. City aur area naam dobara boliye, saaf saaf.";
        ask(twiml, callData.lastQuestion);
        activeCalls.set(CallSid, callData);
        return res.type("text/xml").send(twiml.toString());
      }

      callData.address = address;
      callData.step = "ask_pincode";
      callData.retries = 0;
      callData.lastQuestion = "Bahut accha! Ab apna 6 digit ka pincode batayein.";
      ask(twiml, callData.lastQuestion);
      activeCalls.set(CallSid, callData);
      return res.type("text/xml").send(twiml.toString());
    }

    // ===== ASK PINCODE =====
    if (callData.step === "ask_pincode") {
      // Handle STAR (*) key to repeat last question
      if (Digits === "*") {
        console.log("🔄 User pressed * - Repeating pincode question");
        callData.lastQuestion = "Pincode boliye na, thoda clear karke. 6 digit.";
        ask(twiml, callData.lastQuestion);
        activeCalls.set(CallSid, callData);
        return res.type("text/xml").send(twiml.toString());
      }

      if (rejectInvalid(rawSpeech)) {
        callData.retries = (callData.retries || 0) + 1;

        if (callData.retries >= 2) {
          callData.pincode = "000000";
          callData.step = "ask_complaint";
          callData.retries = 0;
          callData.lastQuestion = "Theek hai. Ab machine mein kya problem hai?";
          ask(twiml, callData.lastQuestion);
          activeCalls.set(CallSid, callData);
          return res.type("text/xml").send(twiml.toString());
        }

        console.log(`⚠️ Invalid pincode input - Retry ${callData.retries}/3`);
        ask(twiml, callData.lastQuestion);
        activeCalls.set(CallSid, callData);
        return res.type("text/xml").send(twiml.toString());
      }

      const pincode = extractPincodeV2(rawSpeech);

      if (!pincode || !isValidPincode(pincode)) {
        callData.retries = (callData.retries || 0) + 1;

        if (callData.retries >= 2) {
          callData.pincode = "000000";
          callData.step = "ask_complaint";
          callData.retries = 0;
          callData.lastQuestion = "Theek hai. Ab machine mein kya problem hai?";
          ask(twiml, callData.lastQuestion);
          activeCalls.set(CallSid, callData);
          return res.type("text/xml").send(twiml.toString());
        }

        console.log(`⚠️ Invalid pincode format - Retry ${callData.retries}/3`);
        callData.lastQuestion = "Kripya apna sahi 6 digit pincode boliye.";
        ask(twiml, callData.lastQuestion);
        activeCalls.set(CallSid, callData);
        return res.type("text/xml").send(twiml.toString());
      }

      callData.pincode = pincode;
      callData.retries = 0;
      callData.step = "ask_complaint";
      callData.lastQuestion = "Bilkul theek hai. Ab mujhe batayein, machine mein kya problem hai?";
      ask(twiml, callData.lastQuestion);
      activeCalls.set(CallSid, callData);
      return res.type("text/xml").send(twiml.toString());
    }

    // ===== ASK COMPLAINT =====
    if (callData.step === "ask_complaint") {
      // Handle STAR (*) key to repeat last question
      if (Digits === "*") {
        console.log("🔄 User pressed * - Repeating complaint question");
        callData.lastQuestion = "Machine mein kya problem hai? Boliye na, thoda detail mein.";
        ask(twiml, callData.lastQuestion);
        activeCalls.set(CallSid, callData);
        return res.type("text/xml").send(twiml.toString());
      }

      if (rejectInvalid(rawSpeech)) {
        callData.retries = (callData.retries || 0) + 1;

        if (callData.retries >= 2) {
          console.log("❌ No complaint info after 2 retries - Transferring to agent");
          twiml.say(
            { voice: "Polly.Aditi", language: "hi-IN" },
            "Samajh nahi aa raha. Aapko ek agent se connect kar dete hain."
          );
          twiml.dial(process.env.HUMAN_AGENT_NUMBER);
          activeCalls.delete(CallSid);
          return res.type("text/xml").send(twiml.toString());
        }

        console.log(`⚠️ Invalid complaint input - Retry ${callData.retries}/3`);
        ask(twiml, callData.lastQuestion);
        activeCalls.set(CallSid, callData);
        return res.type("text/xml").send(twiml.toString());
      }

      callData.rawComplaint = rawSpeech;
      const detected = detectComplaint(rawSpeech);
      const complainText = rawSpeech.toLowerCase();

      // Check for Engine or AC mentions - add clarification
      const isEngineKeyword = /engine|motor|chal|चल|start|स्टार्ट|शुरू|chalu|चालू|कार्य|काम|smoke|धुआ|power|पावर/.test(complainText);
      const isAcKeyword = /ac|ऐसी|एसी|cooling|कूलिंग|thandi|ठंडी|cool|कूल/.test(complainText);

      if (!detected || detected.score < 5) {
        // Ask follow-up questions to clarify the complaint
        callData.step = "ask_complaint_detail";
        
        let followUpQuestion = "Machine mein exactly kya problem hai? Thoda detail mein batayein.";
        
        if (isEngineKeyword) {
          followUpQuestion = "Bilkul - Engine ke liye: Kya engine shuru nahi ho raha? Ya chalu hai lekin oil leak, dhuan, ya abnormal noise? Ya engine start to ho raha lekin power kam? Boliye na.";
        } else if (isAcKeyword) {
          followUpQuestion = "AC ke liye: Kya AC bilkul band hai ya chalti hai lekin thandi nahi kar rahi? Boliye.";
        }
        
        callData.lastQuestion = followUpQuestion;
        ask(twiml, followUpQuestion);
        activeCalls.set(CallSid, callData);
        return res.type("text/xml").send(twiml.toString());
      }

      if (!detected || !detected.complaint || detected.score < 3) {
        callData.retries = (callData.retries || 0) + 1;

        if (callData.retries >= 2) {
          console.log("❌ Complaint not clear after 2 retries - Transferring to agent");
          twiml.say(
            { voice: "Polly.Aditi", language: "hi-IN" },
            "Samajh nahi aa raha. Aapko agent se connect kar dete hain."
          );
          twiml.dial(process.env.HUMAN_AGENT_NUMBER);
          activeCalls.delete(CallSid);
          return res.type("text/xml").send(twiml.toString());
        }

        console.log(`⚠️ Complaint unclear - Retry ${callData.retries}/3`);
        callData.lastQuestion = "Problem clear samajh nahi aaya. Dobara thoda detail mein batayein.";
        ask(twiml, callData.lastQuestion);
        activeCalls.set(CallSid, callData);
        return res.type("text/xml").send(twiml.toString());
      }

      console.log(`✓ Complaint detected: ${detected.complaint} (Score: ${detected.score})`);
      callData.complaintTitle = detected.complaint;

      const hasSubComplaints = complaintMap[detected.complaint]?.subTitles &&
                              Object.keys(complaintMap[detected.complaint].subTitles).length > 0;

      if (hasSubComplaints) {
        const subResult = detectSubComplaint(detected.complaint, rawSpeech);

        if (subResult && subResult.subTitle !== "Other" && subResult.confidence > 0.6) {
          callData.complaintSubTitle = subResult.subTitle;
          console.log(`✓ Sub-complaint auto-detected: ${subResult.subTitle}`);
          
          callData.step = "confirm_complaint";
          callData.lastQuestion = `Theek hai, samajh gaya. Toh aapka complaint hai: ${callData.complaintTitle} - ${callData.complaintSubTitle}. Sahi hai? Press 1 for Yes, Press 2 for No.`;
          askDTMF(twiml, callData.lastQuestion, 1);
          activeCalls.set(CallSid, callData);
          return res.type("text/xml").send(twiml.toString());
        } else {
          callData.step = "ask_sub_complaint";
          callData.retries = 0;
          const subQuestion = getSubComplaintQuestion(detected.complaint);
          callData.lastQuestion = subQuestion;
          ask(twiml, subQuestion);
          activeCalls.set(CallSid, callData);
          return res.type("text/xml").send(twiml.toString());
        }
      } else {
        callData.complaintSubTitle = "Other";
        callData.step = "confirm_complaint";
        callData.lastQuestion = `Theek hai. Toh aapka complaint hai: ${callData.complaintTitle}. Kya ye sahi hai? Press 1 for Yes, Press 2 for No.`;
        askDTMF(twiml, callData.lastQuestion, 1);
        activeCalls.set(CallSid, callData);
        return res.type("text/xml").send(twiml.toString());
      }
    }

    // ===== ASK COMPLAINT DETAIL =====
    if (callData.step === "ask_complaint_detail") {
      // Handle STAR (*) key to repeat last question
      if (Digits === "*") {
        console.log("🔄 User pressed * - Repeating complaint detail question");
        callData.lastQuestion = "Machine mein bilkul kya problem hai? Thoda aur detail boliye na.";
        ask(twiml, callData.lastQuestion);
        activeCalls.set(CallSid, callData);
        return res.type("text/xml").send(twiml.toString());
      }

      callData.rawComplaint = rawSpeech;
      const detected = detectComplaint(rawSpeech);

      if (!detected || !detected.complaint) {
        callData.complaintTitle = "General Problem";
        callData.complaintSubTitle = "Other";
      } else {
        callData.complaintTitle = detected.complaint;
        const subResult = detectSubComplaint(detected.complaint, rawSpeech);
        callData.complaintSubTitle = subResult.subTitle || "Other";
      }

      callData.step = "confirm_complaint";
      callData.lastQuestion = `Theek hai. Toh aapka complaint hai: ${callData.complaintTitle} - ${callData.complaintSubTitle}. Kya sahi hai?`;
      ask(twiml, callData.lastQuestion);
      activeCalls.set(CallSid, callData);
      return res.type("text/xml").send(twiml.toString());
    }

    // ===== ASK SUB-COMPLAINT =====
    if (callData.step === "ask_sub_complaint") {
      // Handle STAR (*) key to repeat last question
      if (Digits === "*") {
        console.log("🔄 User pressed * - Repeating sub-complaint question");
        const subQuestion = getSubComplaintQuestion(callData.complaintTitle);
        callData.lastQuestion = subQuestion;
        console.log(`📋 Asking about ${callData.complaintTitle} sub-types`);
        ask(twiml, callData.lastQuestion);
        activeCalls.set(CallSid, callData);
        return res.type("text/xml").send(twiml.toString());
      }

      const subResult = detectSubComplaint(callData.complaintTitle, rawSpeech);

      console.log(`✓ Sub-complaint: ${subResult.subTitle} (Confidence: ${subResult.confidence})`);

      if (subResult && subResult.subTitle !== "Other" && subResult.confidence > 0.3) {
        callData.complaintSubTitle = subResult.subTitle;
        callData.step = "confirm_complaint";
        callData.lastQuestion = `Theek hai. Toh aapka complaint hai: ${callData.complaintTitle} - ${callData.complaintSubTitle}. Kya ye sahi hai? Press 1 for Yes, Press 2 for No.`;
        askDTMF(twiml, callData.lastQuestion, 1);
        activeCalls.set(CallSid, callData);
        return res.type("text/xml").send(twiml.toString());
      }

      callData.retries = (callData.retries || 0) + 1;

      if (callData.retries >= 2) {
        console.log("❌ Sub-complaint not clear - Using Other");
        callData.complaintSubTitle = "Other";
        callData.step = "confirm_complaint";
        callData.lastQuestion = `Theek hai. Toh aapka complaint hai: ${callData.complaintTitle}. Kya ye sahi hai? Press 1 for Yes, Press 2 for No.`;
        askDTMF(twiml, callData.lastQuestion, 1);
        activeCalls.set(CallSid, callData);
        return res.type("text/xml").send(twiml.toString());
      }

      const subQuestion = getSubComplaintQuestion(callData.complaintTitle);
      callData.lastQuestion = "Clear samajh nahi aaya. " + subQuestion;
      ask(twiml, callData.lastQuestion);
      activeCalls.set(CallSid, callData);
      return res.type("text/xml").send(twiml.toString());
    }

    // ===== CONFIRM COMPLAINT =====
    if (callData.step === "confirm_complaint") {
      if (Digits === "*") {
        console.log("🔄 User pressed * - Repeating complaint confirmation");
        const confirmMsg = `Toh aapka complaint: ${callData.complaintTitle}. Kya sahi hai? Press 1 for Yes, Press 2 for No.`;
        callData.lastQuestion = confirmMsg;
        askDTMF(twiml, confirmMsg, 1);
        activeCalls.set(CallSid, callData);
        return res.type("text/xml").send(twiml.toString());
      }

      if (Digits === "1") {
        console.log(`✓ Complaint confirmed`);
        callData.step = "ask_service_date";
        callData.retries = 0;
        callData.lastQuestion = "Bahut accha. Ab batayein, engineer ko kab bulana hai? Aaj, kal, ya parso?";
        ask(twiml, callData.lastQuestion);
        activeCalls.set(CallSid, callData);
        return res.type("text/xml").send(twiml.toString());
      }

      if (Digits === "2") {
        console.log(`❌ Complaint not confirmed - Re-asking`);
        callData.step = "ask_complaint";
        callData.retries = 0;
        callData.lastQuestion = "Theek hai. Phir se batayein, machine mein kya problem hai?";
        ask(twiml, callData.lastQuestion);
        activeCalls.set(CallSid, callData);
        return res.type("text/xml").send(twiml.toString());
      }

      // If user speaks or no input, repeat question
      callData.retries = (callData.retries || 0) + 1;
      console.log(`⚠️ No/invalid digit for complaint confirmation - Retry ${callData.retries}/3`);
      
      if (callData.retries >= 2) {
        console.log("❌ No clear confirmation after 2 retries - Transferring to agent");
        twiml.say(
          { voice: "Polly.Aditi", language: "hi-IN" },
          "Samajh nahi aa raha complaint kaun si hai. Aapko agent se connect kar dete hain."
        );
        twiml.dial(process.env.HUMAN_AGENT_NUMBER);
        activeCalls.delete(CallSid);
        return res.type("text/xml").send(twiml.toString());
      }

      const confirmMsg = `Toh aapka complaint: ${callData.complaintTitle}. Sahi hai? Press 1 for Yes, Press 2 for No.`;
      callData.lastQuestion = confirmMsg;
      askDTMF(twiml, confirmMsg, 1);
      activeCalls.set(CallSid, callData);
      return res.type("text/xml").send(twiml.toString());
    }

    // ===== ASK SERVICE DATE =====
    if (callData.step === "ask_service_date") {
      // Handle STAR (*) key to repeat last question
      if (Digits === "*") {
        console.log("🔄 User pressed * - Repeating service date question");
        callData.lastQuestion = "Engineer kab aaye? Aaj, kal, parso? Boliye na.";
        ask(twiml, callData.lastQuestion);
        activeCalls.set(CallSid, callData);
        return res.type("text/xml").send(twiml.toString());
      }

      const date = extractServiceDate(rawSpeech);

      if (!date) {
        callData.retries = (callData.retries || 0) + 1;

        if (callData.retries >= 2) {
          const tomorrow = new Date();
          tomorrow.setDate(tomorrow.getDate() + 1);
          callData.serviceDate = tomorrow;
          callData.step = "ask_service_time_from";
          callData.retries = 0;
          callData.lastQuestion = "Kitne baje se engineer aa sakta hai?";
          ask(twiml, callData.lastQuestion);
          activeCalls.set(CallSid, callData);
          return res.type("text/xml").send(twiml.toString());
        }

        callData.lastQuestion = "Aaj, kal, parso, ya koi aur tarikh batayein.";
        ask(twiml, callData.lastQuestion);
        activeCalls.set(CallSid, callData);
        return res.type("text/xml").send(twiml.toString());
      }

      console.log(`✓ Service Date: ${date.toDateString()}`);
      callData.serviceDate = date;
      callData.step = "ask_service_time_from";
      callData.lastQuestion = "Bilkul theek hai. Ab batayein, engineer kitne baje aaye? Subah, dopahar ya shaam, koi bhi time bata dijiye.";
      ask(twiml, callData.lastQuestion);
      activeCalls.set(CallSid, callData);
      return res.type("text/xml").send(twiml.toString());
    }

    // ===== ASK FROM TIME =====
    if (callData.step === "ask_service_time_from") {
      // Handle STAR (*) key to repeat last question
      if (Digits === "*") {
        console.log("🔄 User pressed * - Repeating from time question");
        callData.lastQuestion = "Engineer kitne baje se aaye? Start time boliye na.";
        ask(twiml, callData.lastQuestion);
        activeCalls.set(CallSid, callData);
        return res.type("text/xml").send(twiml.toString());
      }

      const fromTime = extractTimeV2(rawSpeech);

      if (!fromTime) {
        callData.retries = (callData.retries || 0) + 1;

        if (callData.retries >= 2) {
          callData.fromTime = "9:00 AM";
          callData.step = "ask_service_time_to";
          callData.retries = 0;
          callData.lastQuestion = "Kitne baje tak engineer ruk sakta hai?";
          ask(twiml, callData.lastQuestion);
          activeCalls.set(CallSid, callData);
          return res.type("text/xml").send(twiml.toString());
        }

        callData.lastQuestion = "Time clear boliye. Jaise: subah nau baje, dopahar do baje, shaam paanch baje.";
        ask(twiml, callData.lastQuestion);
        activeCalls.set(CallSid, callData);
        return res.type("text/xml").send(twiml.toString());
      }

      console.log(`✓ From Time: ${fromTime}`);
      callData.fromTime = fromTime;
      callData.step = "ask_service_time_to";
      callData.lastQuestion = "Bilkul. Ab batayein, kitne baje tak engineer wahan ruk sakta hai? End time boliye.";
      ask(twiml, callData.lastQuestion);
      activeCalls.set(CallSid, callData);
      return res.type("text/xml").send(twiml.toString());
    }

    // ===== ASK TO TIME & SAVE =====
    if (callData.step === "ask_service_time_to") {
      // Handle STAR (*) key to repeat last question
      if (Digits === "*") {
        console.log("🔄 User pressed * - Repeating to time question");
        callData.lastQuestion = "Kitne baje tak engineer kaam kar sakta hai? End time boliye.";
        ask(twiml, callData.lastQuestion);
        activeCalls.set(CallSid, callData);
        return res.type("text/xml").send(twiml.toString());
      }

      const toTime = extractTimeV2(rawSpeech);

      if (!toTime) {
        callData.retries = (callData.retries || 0) + 1;

        if (callData.retries >= 2) {
          callData.toTime = "5:00 PM";

          console.log("\n" + "=".repeat(120));
          console.log("✅ ALL DATA COLLECTED - SAVING COMPLAINT");
          console.log("=".repeat(120));
          console.log(`🔧 Chassis: ${callData.chassis}`);
          console.log(`📱 Caller: ${callData.callerName} (${callData.callerPhone})`);
          console.log(`🏢 Machine Type: ${callData.machineType}`);
          console.log(`🔴 Status: ${callData.machineStatus}`);
          console.log(`📍 Location: ${callData.jobLocation}`);
          console.log(`🏠 Address: ${callData.address}`);
          console.log(`📮 Pincode: ${callData.pincode}`);
          console.log(`🎯 Complaint: ${callData.complaintTitle} → ${callData.complaintSubTitle}`);
          console.log(`📅 Service: ${callData.serviceDate?.toDateString()}`);
          console.log(`⏰ Time: ${callData.fromTime} - ${callData.toTime}`);
          console.log("=".repeat(120) + "\n");

          if (callData.customerData) {
            const result = await saveComplaint(twiml, callData);

            if (result.success) {
              twiml.say(
                { voice: "Polly.Aditi", language: "hi-IN" },
                `Bahut bahut dhanyavaad! Aapki complaint successfully register ho gayi hai${result.sapId ? '. Complaint number: ' + result.sapId : ''}. Hamara engineer jald hi aapse contact karega!`
              );
            } else {
              twiml.say(
                { voice: "Polly.Aditi", language: "hi-IN" },
                "Dhanyavaad! Aapki complaint register ho gayi hai. Hamari team aapko contact karega!"
              );
            }
          } else {
            twiml.say(
              { voice: "Polly.Aditi", language: "hi-IN" },
              "Dhanyavaad! Aapki complaint register ho gayi hai. Hamari team aapko contact karega!"
            );
          }

          twiml.hangup();
          activeCalls.delete(CallSid);
          return res.type("text/xml").send(twiml.toString());
        }

        callData.lastQuestion = "End time boliye na. Jaise: paanch baje, saat baje.";
        ask(twiml, callData.lastQuestion);
        activeCalls.set(CallSid, callData);
        return res.type("text/xml").send(twiml.toString());
      }

      console.log(`✓ To Time: ${toTime}`);
      callData.toTime = toTime;

      console.log("\n" + "=".repeat(120));
      console.log("✅ ALL DATA COLLECTED - SAVING COMPLAINT");
      console.log("=".repeat(120));
      console.log(`🔧 Chassis: ${callData.chassis}`);
      console.log(`📱 Caller: ${callData.callerName} (${callData.callerPhone})`);
      console.log(`🏢 Machine Type: ${callData.machineType}`);
      console.log(`🔴 Status: ${callData.machineStatus}`);
      console.log(`📍 Location: ${callData.jobLocation}`);
      console.log(`🏠 Address: ${callData.address}`);
      console.log(`📮 Pincode: ${callData.pincode}`);
      console.log(`🎯 Complaint: ${callData.complaintTitle} → ${callData.complaintSubTitle}`);
      console.log(`📅 Service: ${callData.serviceDate?.toDateString()}`);
      console.log(`⏰ Time: ${callData.fromTime} - ${toTime}`);
      console.log("=".repeat(120) + "\n");

      if (callData.customerData) {
        const result = await saveComplaint(twiml, callData);

        if (result.success) {
          twiml.say(
            { voice: "Polly.Aditi", language: "hi-IN" },
            `Bahut bahut dhanyavaad! Aapki complaint successfully register ho gayi hai${result.sapId ? '. Complaint number: ' + result.sapId : ''}. Hamara engineer jald hi aapse contact karega!`
          );
        } else {
          twiml.say(
            { voice: "Polly.Aditi", language: "hi-IN" },
            "Dhanyavaad! Aapki complaint register ho gayi hai. Hamari team aapko contact karega!"
          );
        }
      } else {
        twiml.say(
          { voice: "Polly.Aditi", language: "hi-IN" },
          "Dhanyavaad! Aapki complaint register ho gayi hai. Hamari team aapko contact karega!"
        );
      }

      twiml.hangup();
      activeCalls.delete(CallSid);
      return res.type("text/xml").send(twiml.toString());
    }

    activeCalls.set(CallSid, callData);
    res.type("text/xml").send(twiml.toString());
  } catch (error) {
    console.error("❌ Call Processing Error:", error);
    const twiml = new VoiceResponse();
    twiml.say(
      { voice: "Polly.Aditi", language: "hi-IN" },
      "Kshama karein, kuch technical problem hai. Kripya agent se baat karne ke liye do dabayein."
    );
    twiml.dial(process.env.HUMAN_AGENT_NUMBER);
    return res.type("text/xml").send(twiml.toString());
  }
});

export default router;
