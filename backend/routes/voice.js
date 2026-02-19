import express from "express";
import twilio from "twilio";
import axios from "axios";
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
  isValidPincode,
  convertHindiToEnglish,
  sanitizeComplaintDataForAPI,
  detectCustomerPattern
} from '../utils/improved_extraction.js';

const router = express.Router();
const VoiceResponse = twilio.twiml.VoiceResponse;

const activeCalls = new Map();

/* ======================= EXTERNAL API CONFIG ======================= */
const EXTERNAL_API_BASE = "http://gprs.rajeshmotors.com/jcbServiceEnginerAPIv7";
const COMPLAINT_API_URL = "http://gprs.rajeshmotors.com/jcbServiceEnginerAPIv7/ai_call_complaint.php";
const API_TIMEOUT = 20000;
const API_HEADERS = { JCBSERVICEAPI: "MakeInJcb" };

/* ======================= KEYWORDS - EXPANDED ======================= */
const affirmativeKeywords = [
  'हान', 'हां', 'हाँ', 'जी', 'सही', 'ठीक', 'बिल्कुल', 'ठीक है', 'सही है',
  'जी हां', 'जी हाँ', 'हां जी', 'हाँ जी', 'बिल्कुल सही', 'जी सर', 'जी मैडम',
  'अच्छा', 'ओके', 'ठीक रहेगा', 'चलेगा', 'हो गया', 'माना', 'दिया',
  'yes', 'yep', 'yeah', 'yup', 'sure', 'correct', 'right', 'ok', 'okay',
  'fine', 'good', 'ji', 'sahi', 'theek', 'thik', 'bilkul', 'haan', 'han',
  'absolutely', 'definitely', 'affirmative', 'confirmed', 'agreed'
];

const negativeKeywords = [
  'नहीं', 'नही', 'ना', 'नाह', 'न', 'गलत', 'गलत है', 'ऐसी नहीं',
  'ये नहीं', 'यह नहीं', 'मत', 'मत करो', 'रहने दो', 'जरूरत नहीं',
  'ठीक नहीं', 'सही नहीं', 'बिल्कुल नहीं', 'नहीं भाई',
  'no', 'nope', 'nah', 'na', 'not', 'dont', "don't", 'never', 'negative',
  'wrong', 'incorrect', 'galat', 'nai', 'nei', 'disagree', 'neither'
];

const uncertaintyKeywords = [
  'पता नहीं', 'पता नही', 'पता न', 'मुझे पता नहीं', 'मुझे नहीं पता',
  'मालूम नहीं', 'मालूम नही', 'नहीं मालूम', 'जानकारी नहीं',
  'याद नहीं', 'याद नही', 'नहीं याद', 'भूल गया', 'भूल गयी',
  'समझ नहीं', 'समझ नही', 'नहीं समझ आ रहा', 'समझ नहीं आया',
  'जानता नहीं', 'जानता नही', 'जानती नहीं', 'मैं नहीं जानता',
  'हमें नहीं पता', 'कोई विचार नहीं', 'अंदाजा नहीं', 'अभी तारीख', 'अभी समय',
  'dont know', 'do not know', "don't know", 'dunno', 'no idea', 'no clue',
  'not sure', 'uncertain', 'forget', 'forgot', 'forgotten', "can't remember"
];

const repeatKeywords = ['repeat', 'dobara', 'fir se', 'phir se', 'kya', 'dubara', 'again', 'once more', 'samjha nahi', 'क्या', 'क्या यह', 'क्या है', 'क्या बोला'];
const pauseKeywords = ['रुको', 'रुक', 'रुकिए', 'ek minute', 'ek min', 'i mean', 'matlab', 'ruk jao', 'hold', 'एक मिनट', 'एक पल', 'सुनिए'];

/* ======================= MACHINE TYPES, STATUS, LOCATIONS ======================= */
const machineTypeKeywords = {
  'Warranty': ['वारंटी', 'warranty', 'गारंटी', 'guarantee', 'free', 'फ्री', 'मुफ्त'],
  'JCB Care': ['जीसीबी केयर', 'jcb care', 'केयर', 'care', 'annual', 'yearly'],
  'Engine Care': ['इंजन केयर', 'engine care', 'engine protection'],
  'Demo': ['डेमो', 'demo', 'demonstration', 'test machine'],
  'BHL': ['बीएचएल', 'bhl', 'backhoe', 'back hoe']
};

const machineStatusKeywords = {
  'Breakdown': [
    'ब्रेकडाउन', 'breakdown', 'break down', 'बिल्कुल बंद', 'बंद है', 'बंद हो गया',
    'पूरा बंद', 'डाउन है', 'बिल्कुल काम नहीं', 'काम ही नहीं कर रहा',
    'शुरू नहीं हो रहा', 'स्टार्ट नहीं हो रहा', 'खराब हो गया', 'मर गया',
    'start nahi ho raha', 'chalu nahi ho raha', 'dead', 'stopped completely'
  ],
  'Running With Problem': [
    'चल रहा है लेकिन', 'चल रही है लेकिन', 'chal raha hai lekin', 'चल तो रहा है',
    'काम कर रहा है लेकिन', 'काम तो कर रहा है', 'समस्या के साथ चल',
    'running with problem', 'working with issue', 'working but', 'partially working'
  ]
};

const jobLocationKeywords = {
  'Workshop': [
    'वर्कशॉप', 'workshop', 'शॉप', 'shop', 'गैरेज', 'garage', 'घर पर', 'घर',
    'घर में', 'home', 'होम', 'गोदाम', 'शेड', 'shed', 'service center'
  ],
  'Onsite': [
    'साइट', 'site', 'साइट पर', 'खेत', 'खेत में', 'field', 'फील्ड', 'जगह',
    'बाहर', 'outdoor', 'काम की जगह', 'construction', 'project', 'road', 'हाईवे'
  ]
};

/* ======================= COMPREHENSIVE COMPLAINT MAP - ALL POSSIBLE PROBLEMS ======================= */
const complaintMap = {
  "Engine": {
    keywords: ["engine", "motor", "इंजन", "मोटर", "इंजन की", "engine में", "चालू नहीं", "शुरू नहीं", "मशीन चालू नहीं", "मशीन स्टार्ट नहीं", "मोटर खराब", "इंजन खराब", "पेट्रोल", "डीजल", "ईंधन", "इंजिन", "start नहीं", "chalu नहीं", "शुरुआत नहीं", "चालू नहीं हो", "run नहीं", "झटके", "थरथार"],
    priority: 10,
    subTitles: {
      "Start Problem": ["start", "स्टार्ट नहीं", "शुरू नहीं", "chalu nahi", "चालू नहीं", "starter", "cranking", "turn over", "हो नहीं", "नहीं खुलता", "पकड़ नहीं आता", "शुरुआत नहीं", "जलता नहीं", "बंद है", "मर गया", "डेड", "निर्जीव"],
      "Overheating": ["overheat", "गर्म", "गरम", "heat", "temperature", "गर्मी", "बहुत गर्म", "high temperature", "तेज गर्मी", "आग लग रही", "साँस लेना मुश्किल", "भाप निकल रहा", "उबलता", "ताप बढ़ना"],
      "Black Smoke": ["smoke", "धुआ", "काला धुआ", "black smoke", "smoking", "fumes", "dhaua", "काली धूल", "प्रदूषण", "गैस", "खतरा", "धुंध"],
      "Loss of Power": ["power कम", "weak", "कमजोर", "no power", "slow", "sluggish", "acceleration", "तेजी नहीं", "गति नहीं", "त्वरण नहीं", "बल नहीं", "ताकत नहीं"],
      "Knocking Noise": ["knock", "knocking", "टकटक", "टुटनुटा", "chattering", "clipping", "खटाखट", "खड़खड़", "टक्कर"],
      "Diesel Leak": ["leak", "लीक", "fuel leak", "पेट्रोल लीक", "diesel बह रहा", "ईंधन लीक", "तेल निकल रहा", "चिसड़ना"],
      "Abnormal Noise": ["noise", "आवाज", "sound", "शोर", "grinding", "whining", "whistling", "हल्की आवाज", "अलग ध्वनि"],
      "Fuel Consumption": ["fuel", "petrol", "diesel", "खर्च", "consumption", "mileage", "ईंधन खपत", "महंगा चल रहा"],
      "Misfire": ["misfire", "coughing", "jerking", "stumbling", "hesitation", "कंपन", "झटका", "थरथराना"]
    }
  },
  "Starting Trouble": {
    keywords: ["starting", "स्टार्टिंग", "शुरु", "शुरुआत", "start करना", "चलना", "खिसकना", "पकड़ आना", "निर्गमन", "प्रारंभ", "संचालन", "cold start", "hard start", "slow start", "starting problem"],
    priority: 9,
    subTitles: {
      "Cold Starting Issue": ["cold start", "सर्द", "ठंड में", "morning", "रात के बाद", "ठंडे मौसम में"],
      "Hard Starting": ["hard start", "कठिन", "मुश्किल से", "कई बार", "कोशिश", "attempt"],
      "Slow Starting": ["slow start", "धीमा", "समय लगता", "धीरे-धीरे", "late"],
      "Cranking Weak": ["cranking", "weak crank", "कमजोर", "rpm", "turnover कम"],
      "No Start Condition": ["no start", "बिल्कुल नहीं", "शुरू ही नहीं", "dead", "complete fail"]
    }
  },
  "Transmission": {
    keywords: ["transmission", "gear", "shift", "गियर", "ट्रांसमिशन", "gear box", "shift difficulty", "ट्रांसमिशन खराब", "गियर समस्या", "शिफ्ट", "गति परिवर्तन", "gear change", "speed change", "shifting", "नहीं लग रहा", "गियर नहीं लग"],
    priority: 9,
    subTitles: {
      "Gear Shifting Hard": ["shift hard", "shift difficult", "gear नहीं लग रहा", "गियर नहीं लग", "grinding", "stuck", "jam", "कध्ठिन", "मुश्किल", "कड़ा", "रुक गया", "जाम हो गया"],
      "Slipping": ["slipping", "rpm बढ़ रहा", "गति नहीं बढ़ रही", "power loss", "acceleration नहीं", "slip करना", "खिसकना", "पर्ची", "लड़खड़ाना"],
      "Neutral Problem": ["neutral", "neutral में फंस", "न्यूट्रल", "difficulty in neutral", "trouble neutral", "न्यूट्रल लागू नहीं"],
      "Gear Grinding": ["grind", "grinding", "grinding noise", "gear किकिया", "scraping", "अपघर्षण", "चरमरा", "खरखराहट"]
    }
  },
  "Hydraulic System": {
    keywords: ["hydraulic", "pressure", "pump", "हाइड्रोलिक", "पंप", "दबाव", "प्रेशर", "pressure कम", "दबाव कम", "प्रेशर कम", "hydraulic oil", "हाइड्रोलिक तेल", "हाइड्रोलिक खराब", "loader", "bucket", "boom", "arm", "hydraulic fluid"],
    priority: 9,
    subTitles: {
      "Low Pressure": ["pressure कम", "प्रेशर कम", "प्रेशर", "दबाव कम", "दबाव", "कम", "low", "weak", "slow", "तेजी नहीं", "स्पीड कम", "गति धीमी", "शक्ति कम", "बल दो", "दबाव बढ़ाओ"],
      "Bucket Not Lifting": ["bucket नहीं उठ", "lift नहीं", "boom slow", "arm नहीं उठ", "bucket refuse", "उठता नहीं", "बाल्टी नहीं", "उत्थान नहीं", "ऊपर नहीं", "लिफ्ट नहीं"],
      "Hydraulic Leak": ["leak", "लीक", "oil leak", "seeping", "बह रहा", "dripping", "flowing", "तेल गिरना", "छिद्र", "टपकना"],
      "Pump Failure": ["pump fail", "pump नहीं", "pump problem", "पंप", "पंप खराब", "पंप मर गया", "पंप बंद"],
      "Cylinder Problem": ["cylinder", "cylinder leak", "rod", "seal", "सिलेंडर", "सिलेंडर लीक", "रॉड", "सील"],
      "Hose Pressure": ["hose", "hose leak", "pipe burst", "नली", "नली लीक", "पाइप", "पाइप टूटा"]
    }
  },
  "Braking System": {
    keywords: ["brake", "ब्रेक", "braking", "stop", "रोक", "पैडल", "brake pedal", "ब्रेकिंग", "ब्रेक खराब", "रुकना मुश्किल", "disc brake", "band brake", "brake fluid", "brake pads"],
    priority: 10,
    subTitles: {
      "Brake Not Working": ["brake काम नहीं", "no braking", "brake fail", "नहीं रुक रहा", "brake गायब", "ब्रेक नहीं", "रोकना नहीं", "पकड़ नहीं आ रहा"],
      "Weak Braking": ["brake कमजोर", "weak", "slow stop", "need pressure", "soft pedal", "दुर्बल", "हल्का", "कम दबाव", "पूर्ण नहीं"],
      "Brake Pads Worn": ["pads", "pad worn", "thickness कम", "pads निकल गए", "पैड", "पैड पहना", "पैड टूटा", "घिसाव"],
      "Brake Fluid Leak": ["fluid leak", "brake leak", "पेडल दबता नहीं", "spongy pedal", "तरल लीक", "द्रव लीक", "पेडल नरम"],
      "Brake Noise": ["noise", "squealing", "grinding", "creaking", "screeching", "शोर", "चीख", "किरकिरा", "खरखराहट"]
    }
  },
  "Electrical System": {
    keywords: ["electrical", "battery", "light", "बिजली", "बैटरी", "स्टार्टर", "अल्टरनेटर", "wiring", "spark", "ignition", "electrical fault"],
    priority: 8,
    subTitles: {
      "Battery Problem": ["battery", "dead", "weak", "बैटरी नहीं चार्ज", "charge नहीं हो रहा"],
      "Starter Motor": ["starter", "स्टार्टर", "cranking weak", "starter खराब", "no crank"],
      "Alternator Problem": ["alternator", "charge नहीं", "alternator खराब", "बिजली नहीं"],
      "Wiring Issue": ["wiring", "wire", "short", "spark", "electrical short"],
      "Light Problem": ["light", "लाइट", "headlight", "taillight", "बत्ती नहीं जल रही"]
    }
  },
  "Cooling System": {
    keywords: ["cooling", "coolant", "radiator", "fan", "पंखा", "ठंडा करना", "coolant", "water pump", "thermostat", "temperature", "water system"],
    priority: 8,
    subTitles: {
      "Radiator Leak": ["radiator leak", "radiator खराब", "पानी निकल रहा", "water leak"],
      "Fan Problem": ["fan", "पंखा", "fan काम नहीं", "fan slow", "fan noise"],
      "Thermostat": ["thermostat", "temperature control", "temp problem"],
      "Water Pump": ["pump", "पंप", "water nहीं घूम रहा", "pump leak"]
    }
  },
  "AC/Cabin": {
    keywords: ["ac", "a.c", "air conditioner", "cooling", "एसी", "ऐसी", "थंडा", "cabin cool", "compressor", "condenser", "blower", "ac filter"],
    priority: 7,
    subTitles: {
      "AC Not Cooling": ["cooling नहीं", "ठंडा नहीं", "थंडी नहीं", "ac weak", "temperature high"],
      "AC Not Working": ["ac काम नहीं", "ac band", "ac off", "compressor fail"],
      "Blower Noise": ["noise", "sound", "squealing", "grinding"],
      "Filter Problem": ["filter", "filter चोक", "filter खराब", "air flow कम"]
    }
  },
  "Steering": {
    keywords: ["steering", "steerin", "पहिया", "wheel", "turn", "स्टीयरिंग", "पावर स्टीयरिंग", "power steering", "turning", "direction control"],
    priority: 8,
    subTitles: {
      "Hard Steering": ["hard", "heavy", "कड़ा", "difficult turn", "मुश्किल से मुड़ता"],
      "Power Steering Fail": ["power steering", "पावर खो गया", "power loss", "steering काम नहीं"],
      "Steering Noise": ["noise", "whining", "groaning", "creaking"],
      "Vibration": ["vibration", "shake", "कंपन", "road feel"]
    }
  },
  "Clutch": {
    keywords: ["clutch", "क्लच", "clutch pedal", "disengagement", "engagement", "क्लच पैडल", "क्लच समस्या", "क्लच खराब", "clutch plate", "friction", "clutch release"],
    priority: 7,
    subTitles: {
      "Clutch Slip": ["slip", "slipping", "गति नहीं बढ़ रही", "rpm बढ़ता है", "क्लच फिसल", "पर्ची", "फिसलना"],
      "Hard Petal": ["hard", "tight", "कड़ा", "difficult depress", "पेडल कड़ा", "दबाना मुश्किल"],
      "Clutch Noise": ["noise", "squeak", "groaning", "whistling", "शोर", "चीख", "कराहना", "सीती"],
      "Clutch Wear": ["wear", "worn", "friction कम", "response slow", "घिसाव", "पहना हुआ", "घर्षण"]
    }
  },
  "Fuel System": {
    keywords: ["fuel", "petrol", "diesel", "फ्यूल", "सिस्टम", "tank", "injector", "fuel pump", "fuel filter", "fuel supply", "fuel consumption"],
    priority: 8,
    subTitles: {
      "Fuel Pump": ["pump", "pump fail", "no fuel supply", "fuel नहीं आ रहा"],
      "Fuel Filter": ["filter", "choke", "filter खराब", "fuel flow कम"],
      "Injector Problem": ["injector", "injector block", "spray problem", "injection खराब"],
      "Fuel Leak": ["leak", "leaking", "fuel बह रहा", "tank leak"]
    }
  },
  "Bucket/Boom": {
    keywords: ["bucket", "boom", "bucket arm", "loader arm", "loader", "dipper", "arm", "bucket lift", "boom not rising", "bucket not opening"],
    priority: 8,
    subTitles: {
      "Bucket Not Working": ["bucket नहीं", "bucket खराब", "bucket ठीक नहीं", "bucket stuck"],
      "Boom Slow": ["boom slow", "boom power कम", "lifting slow", "लिफ्टिंग कमजोर"],
      "Bucket Weld Crack": ["crack", "टूटा", "weld break", "टूटन"],
      "Arm Bent": ["bent", "टेढ़ा", "damage", "misalignment"]
    }
  },
  "Front Axle": {
    keywords: ["front axle", "front", "axle", "फ्रंट एक्सल", "suspension"],
    priority: 7,
    subTitles: {
      "Axle Noise": ["noise", "clicking", "clunking", "टुटुन"],
      "Bearing Damage": ["bearing", "bearing खराब", "wheel wobble"],
      "Stud Break": ["stud", "wheel stud", "lug nut"]
    }
  },
  "Rear Axle": {
    keywords: ["rear axle", "rear", "rear end", "पिछला एक्सल", "final drive"],
    priority: 7,
    subTitles: {
      "Axle Noise": ["noise", "whining", "grinding", "gear noise"],
      "Differential": ["differential", "diff problem", "traction"],
      "Bearing Problem": ["bearing", "bearing fail", "wheel wobble"]
    }
  },
  "Tyres/Wheels": {
    keywords: ["tyre", "tire", "wheel", "टायर", "अंतर्नियम", "puncture", "flat"],
    priority: 7,
    subTitles: {
      "Puncture": ["puncture", "flat", "फटा", "hole", "air निकल गया"],
      "Tyre Wear": ["wear", "worn", "bald", "tread कम"],
      "Wheel Alignment": ["alignment", "wobble", "imbalance", "shake"],
      "Rim Damage": ["rim damage", "bent", "cracked", "दरार"]
    }
  },
  "Drive Belt": {
    keywords: ["belt", "pulley", "drive", "पेल्टी", "चेन"],
    priority: 6,
    subTitles: {
      "Belt Slipping": ["slip", "slipping", "squeal", "noise"],
      "Belt Wear": ["wear", "worn", "cracked", "फटा"],
      "Pulley Problem": ["pulley", "pulley worn", "alignment"]
    }
  },
  "Oil Leak": {
    keywords: ["oil leak", "leak", "oil", "तेल", "तेल बह रहा", "leaking"],
    priority: 7,
    subTitles: {
      "Engine Oil Leak": ["engine", "engine leak", "तेल टपक रहा"],
      "Transmission Leak": ["transmission", "gear oil leak"],
      "Hydraulic Leak": ["hydraulic", "hydraulic fluid leak"],
      "Seal Problem": ["seal", "gasket", "seal खराब"]
    }
  },
  "Cooling Leak": {
    keywords: ["water leak", "coolant leak", "radiator", "पानी", "coolant"],
    priority: 7,
    subTitles: {
      "Radiator Leak": ["radiator", "radiator leak"],
      "Hose Leak": ["hose", "hose leak", "pipe leak"],
      "Water Pump Leak": ["pump", "pump leak", "seeping"]
    }
  },
  "Vibration": {
    keywords: ["vibration", "shake", "vibrate", "कंपन", "shaking", "tremor"],
    priority: 6,
    subTitles: {
      "Engine Vibration": ["engine", "engine shake", "unbalance"],
      "Driveline Vibration": ["drive", "drivetrain", "transmission"],
      "Wheel Vibration": ["wheel", "tyre", "balancing"]
    }
  },
  "Noise": {
    keywords: ["noise", "sound", "आवाज", "shoor", "creaking", "grinding", "clunking", "शोर", "ध्वनि", "खरखराहट", "कर्ण"],
    priority: 5,
    subTitles: {
      "Engine Knocking": ["knock", "knocking", "ping", "clinking", "खटाखट", "टकटक", "किलकिलाहट", "टंकण"],
      "Grinding": ["grinding", "grinding noise", "metal sound", "अपघर्षण", "अपघर्षण शोर", "धातु ध्वनि"],
      "Squealing": ["squeal", "squealing", "high pitch", "चीख", "चीखना", "उच्च पिच"],
      "Clunking": ["clunk", "clanking", "metallic", "थाप", "धातु की आवाज", "धड़ाम"]
    }
  },
  "General Problem": {
    keywords: ["problem", "issue", "समस्या", "दिक्कत", "खराब", "trouble", "परेशानी", "बुराई", "व़्याधि"],
    priority: 1,
    subTitles: {
      "Service Needed": ["service", "maintenance", "check", "inspection", "सेवा", "रखरखाव", "जांच", "निरीक्षण"],
      "Other": ["other", "general", "कुछ खराब", "और", "अन्य", "कोई समस्या"]
    }
  }
};

/* ======================= CITY MAPPING ======================= */
const cityToBranchMap = {
  'ajmer': { branch: "AJMER", outlet: "AJMER", cityCode: "1" },
  'अजमेर': { branch: "AJMER", outlet: "AJMER", cityCode: "1" },
  'kekri': { branch: "AJMER", outlet: "KEKRI", cityCode: "1" },
  'alwar': { branch: "ALWAR", outlet: "ALWAR", cityCode: "2" },
  'अलवर': { branch: "ALWAR", outlet: "ALWAR", cityCode: "2" },
  'bharatpur': { branch: "ALWAR", outlet: "BHARATPUR", cityCode: "2" },
  'bhilwara': { branch: "BHILWARA", outlet: "BHILWARA", cityCode: "3" },
  'भीलवाड़ा': { branch: "BHILWARA", outlet: "BHILWARA", cityCode: "3" },
  'jaipur': { branch: "JAIPUR", outlet: "JAIPUR", cityCode: "4" },
  'जयपुर': { branch: "JAIPUR", outlet: "JAIPUR", cityCode: "4" },
  'kota': { branch: "KOTA", outlet: "KOTA", cityCode: "5" },
  'कोटा': { branch: "KOTA", outlet: "KOTA", cityCode: "5" },
  'sikar': { branch: "SIKAR", outlet: "SIKAR", cityCode: "6" },
  'सीकर': { branch: "SIKAR", outlet: "SIKAR", cityCode: "6" },
  'udaipur': { branch: "UDAIPUR", outlet: "UDAIPUR", cityCode: "7" },
  'उदयपुर': { branch: "UDAIPUR", outlet: "UDAIPUR", cityCode: "7" }
};

/* ======================= SMART SPEECH ANALYZER ======================= */
function analyzeCustomerSpeech(text) {
  if (!text) return { problem: null, location: null, address: null, rejection: false, confidence: 0 };
  
  const textLower = text.toLowerCase();
  const analysis = {
    problem: null,
    location: null,
    address: null,
    rejection: false,
    confidence: 0,
    rawText: text,
    details: []
  };

  // Check for rejection/negation - ENHANCED PATTERNS
  const rejectionPatterns = [
    /(मैने|maine|मैंने) (ये|यह|यह|ये|ye|is|ye|this|that) (नहीं|नही|na|na|no) (कहा|said|kha)/i,  // I didn't say X
    /(मैने|maine|मैंने) (ये|यह|ye|this) (नहीं|नही|no|na)/i,                                      // I didn't say this
    /(ye|ये|यह) (नहीं|नही|no|nahi|nai)/i,                                                        // Not this / Not that
    /(वो|बो|वह|wo|yeh) (नहीं|नही|no|na|nai|nahin)/i,                                             // Not that
    /(गलत|galat|wrong)/i,                                                                        // Wrong
    /(नहीं|नही|no|not)/i,                                                                        // No
    /(अलग|alag|doosra|different|other|problem)/i.test(textLower) && /(समस्या|problem|dikkat)/i.test(textLower),  // Different problem
    /(ऐसा|aisa|aise|नहीं|nahi|no)/i                                                               // Not like that
  ];
  
  let hasRejection = false;
  for (let i = 0; i < rejectionPatterns.length; i++) {
    if (rejectionPatterns[i] && rejectionPatterns[i].test(textLower)) {
      hasRejection = true;
      analysis.rejection = true;
      console.log(`🚫 REJECTION DETECTED (Pattern ${i + 1}): Customer rejecting`);
      break;
    }
  }
  
  if (hasRejection) {
    analysis.rejection = true;
  }

  // Extract location from speech
  for (const [location, keywords] of Object.entries(jobLocationKeywords)) {
    for (const keyword of keywords) {
      if (textLower.includes(keyword.toLowerCase())) {
        analysis.location = location;
        analysis.details.push(`Location: ${location}`);
        console.log(`📍 Location extracted: ${location} (Keyword: "${keyword}")`);
        break;
      }
    }
    if (analysis.location) break;
  }

  // Extract address/context clues
  const addressPatterns = [
    /मेरे (घर|home|office|site|साइट|workshop|वर्कशॉप|खेत|field|गोदाम|shed)/i,
    /machine (घर|home|office|site|workshop|खेत|field)/i,
    /(घर|home|office|site|workshop|खेत|field).*पर.*है/i,
    /^(घर|home|office|site|workshop|खेत|field)/i
  ];

  for (const pattern of addressPatterns) {
    const match = textLower.match(pattern);
    if (match) {
      analysis.address = match[0];
      analysis.details.push(`Address context: ${match[0]}`);
      console.log(`🏠 Address context: ${match[0]}`);
      break;
    }
  }

  // Detect complaint problem embedded in sentence
  const detected = detectComplaint(text);
  if (detected && detected.complaint) {
    analysis.problem = detected.complaint;
    analysis.confidence = detected.score;
    analysis.details.push(`Problem: ${detected.complaint} (Score: ${detected.score})`);
  }

  console.log(`📊 SPEECH ANALYSIS: ${analysis.details.length > 0 ? analysis.details.join(' | ') : 'General statement'}`);
  
  return analysis;
}
function rejectInvalid(text) {
  if (!text) return true;
  if (text.trim().length < 2) return true;
  const textLower = text.toLowerCase();
  
  // Check for actual content vs just noise
  const hasContent = !/^(मुझे|मेरे|मेरा|है|हैं|का|की|को|के|में|से|पर|को)/.test(textLower);
  if (!hasContent && textLower.length < 10) return true;
  
  if (isUncertain(text)) return true;
  if (repeatKeywords.some(k => textLower.includes(k))) return true;
  if (pauseKeywords.some(k => textLower.includes(k))) return true;
  return false;
}

function isUncertain(text) {
  if (!text) return false;
  const textLower = text.toLowerCase();
  return uncertaintyKeywords.some(keyword => textLower.includes(keyword.toLowerCase()));
}

function isAffirmative(text) {
  if (!text) return false;
  const textLower = text.toLowerCase().trim();
  const simpleChecks = ['हां', 'हाँ', 'हान', 'सही', 'ठीक', 'जी', 'yes', 'ok', 'बिल्कुल', 'thik', 'sahi'];
  for (const check of simpleChecks) {
    if (textLower.includes(check)) {
      console.log(`✅ Affirmative detected: "${check}"`);
      return true;
    }
  }
  return affirmativeKeywords.some(keyword => textLower.includes(keyword.toLowerCase()));
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
  return negativeKeywords.some(keyword => textLower.includes(keyword.toLowerCase()));
}

// ===== COMPREHENSIVE COMPLAINT DETECTION LOGGING =====
function logComplaintDetection(callSid, step, customerSpeech, analysis, detectedProblem, detectionScore, action) {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    callSid,
    step,
    customerSpeech,
    analysis: {
      rejection: analysis?.rejection || false,
      location: analysis?.location || null,
      address: analysis?.address || null,
      problemDetected: analysis?.problem || null
    },
    detection: {
      problem: detectedProblem,
      score: detectionScore,
      confidence: detectionScore >= 7 ? 'HIGH' : detectionScore >= 5 ? 'MEDIUM' : 'LOW'
    },
    systemAction: action,
    nextStep: step
  };
  
  console.log(`\n${'='.repeat(80)}`);
  console.log(`📋 COMPLAINT DETECTION LOG - ${step}`);
  console.log(`${'='.repeat(80)}`);
  console.log(`⏰ Timestamp: ${timestamp}`);
  console.log(`📞 Call SID: ${callSid}`);
  console.log(`🎤 Customer Said: "${customerSpeech}"`);
  console.log(`📊 Analysis:`);
  console.log(`   - Rejection Detected: ${logEntry.analysis.rejection}`);
  console.log(`   - Location: ${logEntry.analysis.location || 'N/A'}`);
  console.log(`   - Address: ${logEntry.analysis.address || 'N/A'}`);
  console.log(`🔍 Detection Result:`);
  console.log(`   - Problem: ${detectedProblem || 'NONE'}`);
  console.log(`   - Score: ${detectionScore}/10`);
  console.log(`   - Confidence: ${logEntry.detection.confidence}`);
  console.log(`⚙️ System Action: ${action}`);
  console.log(`${'='.repeat(80)}\n`);
  
  return logEntry;
}


/* ======================= DETECTION FUNCTIONS ======================= */
function detectMachineType(text) {
  if (!text) return 'Warranty';
  const textLower = text.toLowerCase();
  for (const [type, keywords] of Object.entries(machineTypeKeywords)) {
    if (keywords.some(k => textLower.includes(k.toLowerCase()))) return type;
  }
  return 'Warranty';
}

function detectMachineStatus(text) {
  if (!text) return 'Running With Problem';
  const textLower = text.toLowerCase();
  if (machineStatusKeywords['Breakdown'].some(k => textLower.includes(k.toLowerCase()))) {
    console.log(`✓ Machine Status: Breakdown`);
    return 'Breakdown';
  }
  console.log(`✓ Machine Status: Running With Problem`);
  return 'Running With Problem';
}

function detectJobLocation(text) {
  if (!text) return 'Onsite';
  const textLower = text.toLowerCase();
  if (jobLocationKeywords['Workshop'].some(k => textLower.includes(k.toLowerCase()))) {
    console.log(`✓ Job Location: Workshop`);
    return 'Workshop';
  }
  console.log(`✓ Job Location: Onsite`);
  return 'Onsite';
}

function detectComplaint(text) {
  if (!text) return null;
  const textLower = text.toLowerCase();
  let bestMatch = null;
  let highestScore = 0;
  let matchedKeywords = [];

  const sortedComplaints = Object.entries(complaintMap).sort(
    (a, b) => (b[1].priority || 0) - (a[1].priority || 0)
  );

  for (const [category, config] of sortedComplaints) {
    let score = 0;
    let categoryMatches = [];
    
    for (const keyword of config.keywords) {
      if (textLower.includes(keyword.toLowerCase())) {
        score += keyword.length;
        categoryMatches.push(keyword);
      }
    }
    
    if (score > highestScore) {
      highestScore = score;
      bestMatch = category;
      matchedKeywords = categoryMatches;
    }
  }

  console.log(`🔍 SMART DETECTION: "${text}"`);
  if (bestMatch) {
    console.log(`   ✅ Matched: ${bestMatch} (Score: ${highestScore}, Keywords: [${matchedKeywords.join(', ')}])`);
  } else {
    console.log(`   ⚠️ No specific match - suggests: ${Object.keys(complaintMap)[0]}`);
  }

  return { complaint: bestMatch, score: highestScore };
}

function detectSubComplaint(mainComplaint, text) {
  if (!mainComplaint || !complaintMap[mainComplaint]) return { subTitle: "Other", confidence: 0.5 };
  const subTitles = complaintMap[mainComplaint].subTitles;
  if (!subTitles || Object.keys(subTitles).length === 0) return { subTitle: "Other", confidence: 1.0 };

  const textLower = text.toLowerCase();
  let bestMatch = null;
  let highestScore = 0;
  let matchedKeywords = [];

  for (const [subTitle, keywords] of Object.entries(subTitles)) {
    let score = 0;
    let subMatches = [];
    
    for (const keyword of keywords) {
      if (textLower.includes(keyword.toLowerCase())) {
        score += keyword.length;
        subMatches.push(keyword);
      }
    }
    
    if (score > highestScore) {
      highestScore = score;
      bestMatch = subTitle;
      matchedKeywords = subMatches;
    }
  }

  const confidence = highestScore > 0 ? Math.min(highestScore / 15, 1) : 0.5;
  console.log(`   📊 Sub-Detection: ${mainComplaint}`);
  if (bestMatch && matchedKeywords.length > 0) {
    console.log(`      ✅ ${bestMatch} (Confidence: ${(confidence * 100).toFixed(0)}%, Keywords: [${matchedKeywords.join(', ')}])`);
  } else {
    console.log(`      ℹ️ Other (Fallback)`);
  }

  return { subTitle: bestMatch || "Other", confidence };
}

function getSubComplaintQuestion(complaintType) {
  const questions = {
    "Engine": "Engine mein exactly kya problem hai? Starting issue, overheating, smoke, noise, ya power ka problem?",
    "Transmission": "Transmission mein kya dikkat hai? Gear shift difficult, slipping, grinding, ya neutral problem?",
    "Hydraulic System": "Hydraulic mein kya problem hai? Pressure kam, bucket nahi lift ho rahi, leak, ya pump?",
    "Braking System": "Brake mein kya problem hai? Brake काम नहीं कर रहा, कमजोर है, pads worn, या leak?",
    "Electrical System": "Electrical mein kya issue hai? Battery problem, starter, alternator, wiring, या light?",
    "Cooling System": "Cooling system mein kya problem h? Radiator leak, fan issue, thermostat, या water pump?",
    "AC/Cabin": "AC mein kya problem hai? Cooling nahi hो रही, काम ही नहीं कर रहा, noise, या filter issue?",
    "Steering": "Steering mein kya problem hai? Hard to turn, power loss, noise, या vibration?",
    "Clutch": "Clutch mein kya problem है? Slip रहा है, pedal hard है, noise आ रही है, या wear हो गया?",
    "Fuel System": "Fuel system मein क्या problem है? Pump fail, fuel filter choke, injector issue, या leak?",
    "Bucket/Boom": "Bucket ya boom mein kya problem है? काम नहीं कर रहा, slow है, bent, या weld cracked?",
    "Oil Leak": "Oil leak कहाँ से हो रहा है? Engine से, transmission से, hydraulic से, या seal खराब?",
    "Vibration": "Vibration कहाँ से है? Engine से, drivetrain से, या wheels से?",
    "Noise": "कौन सी noise आ रही है? Knocking, grinding, squealing, या clunking?",
    "General Problem": "Machine mein aur kya dikkat hai? Service, maintenance, check, ya कुछ और?"
  };
  return questions[complaintType] || "Machine mein aur detail mein kya problem hai?";
}

/* ======================= TEXT PROCESSING ======================= */
function cleanSpeech(text) {
  if (!text) return "";
  return text.toLowerCase().replace(/[।.,!?]/g, "").replace(/\s+/g, " ").trim();
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
  if (typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date)) return date;
  const d = new Date(date);
  if (isNaN(d.getTime())) return null;
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/* ======================= SPEECH ANALYSIS FUNCTIONS ======================= */
function countWords(text) {
  if (!text) return 0;
  return text.trim().split(/\s+/).filter(word => word.length > 0).length;
}

function mergeSpokenNumbers(numberSequence) {
  const digitWords = {
    // Hindi
    'शून्य': '0', 'सून्य': '0',
    'एक': '1',
    'दो': '2',
    'तीन': '3', 'तिन': '3', 'टीन': '3', 'तीन': '3',
    'चार': '4', 'चार्स': '4',
    'पाँच': '5', 'पांच': '5', 'पाच': '5',
    'छह': '6', 'छः': '6', 'छ': '6',
    'सात': '7',
    'आठ': '8',
    'नौ': '9', 'नो': '9',
    'दस': '0', // sometimes used for zero
    // English
    'zero': '0', 'o': '0',
    'one': '1',
    'two': '2',
    'three': '3',
    'four': '4',
    'five': '5',
    'six': '6',
    'seven': '7',
    'eight': '8',
    'nine': '9',
  };

  let merged = '';
  const words = numberSequence.toLowerCase().split(/[\s\-\/,।;\|]+/).filter(w => w);
  
  for (const word of words) {
    const digit = digitWords[word];
    if (digit !== undefined) {
      merged += digit;
    }
  }
  
  return merged;
}

async function validateChassisNumberViaAPI(chassisNo) {
  try {
    console.log(`\n🔍 VALIDATING CHASSIS NUMBER VIA API: ${chassisNo}`);
    
    if (!isValidChassis(chassisNo)) {
      console.log(`   ❌ Invalid format: ${chassisNo}`);
      return { valid: false, reason: "Invalid format" };
    }

    const apiUrl = `${EXTERNAL_API_BASE}/get_machine_by_machine_no.php?machine_no=${chassisNo}`;
    const response = await axios.get(apiUrl, {
      timeout: API_TIMEOUT,
      headers: API_HEADERS,
      validateStatus: (status) => status < 500,
    });

    if (response.status === 200 && response.data?.status === 1 && response.data?.data) {
      console.log(`   ✅ VALID - FOUND IN DATABASE`);
      return {
        valid: true,
        data: {
          name: response.data.data.customer_name || "Unknown",
          city: response.data.data.city || "Unknown",
          model: response.data.data.machine_model || "Unknown",
          machineNo: response.data.data.machine_no || chassisNo
        }
      };
    } else {
      console.log(`   ⚠️ NOT FOUND IN DATABASE`);
      return { valid: false, reason: "Not found in database", data: null };
    }
  } catch (error) {
    console.error(`   ❌ API VALIDATION ERROR: ${error.message}`);
    return { valid: false, reason: "API error", error: error.message };
  }
}

function askWithListening(twiml, text, options = {}) {
  const {
    maxSpeechTime = 60,      // 1 minute default
    timeout = 8,             // timeout between speech attempts
    speechTimeout = "auto"
  } = options;

  const gather = twiml.gather({
    input: "speech dtmf",
    language: "hi-IN",
    speechTimeout: speechTimeout,
    timeout: timeout,
    maxSpeechTime: maxSpeechTime,
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
    speechTimeout: "auto"
  });
}

function extractServiceDate(text) {
  if (!text) return null;
  const cleaned = text.toLowerCase();
  const today = new Date();
  
  // "आज" - today
  if (/\b(आज|aaj|today|aap)\b/i.test(cleaned)) return today;
  
  // "कल" - tomorrow
  if (/\b(कल|kal|tomorrow|kal ko)\b/i.test(cleaned)) {
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow;
  }
  
  // "परसों" - day after tomorrow
  if (/\b(परसों|parso|parson)\b/i.test(cleaned)) {
    const dayAfter = new Date(today);
    dayAfter.setDate(dayAfter.getDate() + 2);
    return dayAfter;
  }
  
  // Extract date numbers like "20 तारीख को", "30 को"
  const dateMatch = cleaned.match(/\b(\d{1,2})\s*(तारीख)?\s*(को)?\b/i);
  if (dateMatch) {
    const dateNum = parseInt(dateMatch[1]);
    if (dateNum >= 1 && dateNum <= 31) {
      const resultDate = new Date(today);
      resultDate.setDate(dateNum);
      // If date is in past, use next month
      if (resultDate < today) {
        resultDate.setMonth(resultDate.getMonth() + 1);
      }
      console.log(`   📅 Date extracted: ${dateNum} → ${resultDate.toDateString()}`);
      return resultDate;
    }
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
    if (!apiUrl) return null;

    console.log(`🌐 Fetching from API: ${apiUrl}`);
    const response = await axios.get(apiUrl, {
      timeout: API_TIMEOUT,
      headers: API_HEADERS,
      validateStatus: (status) => status < 500,
    });

    if (response.status !== 200 || !response.data || response.data.status !== 1 || !response.data.data) return null;

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

async function submitComplaintToExternal(complaintData) {
  try {
    console.log("\n" + "=".repeat(120));
    console.log("🌐 PREPARING & SANITIZING COMPLAINT DATA FOR API");
    console.log("=".repeat(120));
    
    // Convert Hindi text to English for API submission
    const sanitized = {
      ...complaintData,
      customer_name: convertHindiToEnglish(complaintData.customer_name),
      caller_name: convertHindiToEnglish(complaintData.caller_name),
      contact_person: convertHindiToEnglish(complaintData.contact_person),
      complaint_details: convertHindiToEnglish(complaintData.complaint_details),
      complaint_title: convertHindiToEnglish(complaintData.complaint_title),
      sub_title: convertHindiToEnglish(complaintData.sub_title),
      machine_location_address: convertHindiToEnglish(complaintData.machine_location_address),
      job_location: convertHindiToEnglish(complaintData.job_location),
    };
    
    console.log("📋 Original complaint_title:", complaintData.complaint_title);
    console.log("📋 Converted complaint_title:", sanitized.complaint_title);
    console.log("📋 Original sub_title:", complaintData.sub_title);
    console.log("📋 Converted sub_title:", sanitized.sub_title);
    console.log("📋 Original job_location:", complaintData.job_location);
    console.log("📋 Converted job_location:", sanitized.job_location);
    
    console.log("\n📤 SUBMITTING COMPLAINT TO EXTERNAL API:");
    console.log("=".repeat(120));
    console.log(JSON.stringify(sanitized, null, 2));
    console.log("=".repeat(120) + "\n");

    const response = await axios.post(COMPLAINT_API_URL, sanitized, {
      timeout: API_TIMEOUT,
      headers: { "Content-Type": "application/json", ...API_HEADERS },
      validateStatus: (status) => status < 500,
    });

    if (response.status !== 200 || !response.data || response.data.status !== 1) {
      console.log("⚠️ API Rejected:", response.data?.message || "Unknown error");
      return { success: false, error: response.data?.message || "API rejected" };
    }

    const sapId = response.data.data?.complaint_sap_id || response.data.data?.sap_id || null;
    console.log("✅ Complaint submitted successfully. SAP ID:", sapId);
    return { success: true, data: response.data, sapId };
  } catch (error) {
    console.error("❌ Submit Error:", error.message);
    return { success: false, error: error.message };
  }
}

/* ======================= SAVE COMPLAINT - API ONLY ======================= */
async function saveComplaint(twiml, callData) {
  try {
    const customerData = callData.customerData;
    const branchOutlet = detectBranchAndOutlet(callData.city || customerData.city);
    const installationDate = customerData.installationDate && customerData.installationDate !== "NA"
      ? formatDateForExternal(customerData.installationDate)
      : null;

    const complaintApiData = {
      machine_no: callData.chassis || "Unknown",
      customer_name: safeAscii(customerData.name),
      caller_name: customerData.name || "Not Provided",
      caller_no: customerData.phone || "Unknown",
      contact_person: customerData.name || "Customer",
      contact_person_number: customerData.phone || "Unknown",
      machine_model: customerData.machineType || "Unknown",
      sub_model: customerData.model || "NA",
      installation_date: installationDate || "2025-01-01",
      machine_type: callData.machineType || "Warranty",
      city_id: branchOutlet.cityCode,
      complain_by: "Customer",
      machine_status: callData.machineStatus || "Running With Problem",
      job_location: callData.jobLocation || "Onsite",
      branch: branchOutlet.branch,
      outlet: branchOutlet.outlet,
      complaint_details: callData.rawComplaint || "Not provided",
      complaint_title: callData.complaintTitle || "General Problem",
      sub_title: callData.complaintSubTitle || "Other",
      business_partner_code: customerData.businessPartnerCode || "NA",
      complaint_sap_id: "NA",
      machine_location_address: callData.address || "Not Provided",
      pincode: callData.pincode || "0",
      service_date: callData.serviceDate ? formatDateForExternal(callData.serviceDate) : "",
      from_time: callData.fromTime || "",
      to_time: callData.toTime || "",
      job_close_lat: 0,
      job_close_lng: 0,
      job_open_lat: 0,
      job_open_lng: 0,
    };

    const externalResult = await submitComplaintToExternal(complaintApiData);
    let sapId = null;
    if (externalResult.success) sapId = externalResult.sapId;

    console.log(`✅ Complaint submitted to API${sapId ? '. SAP ID: ' + sapId : ''}`);
    return { success: externalResult.success, sapId };
  } catch (error) {
    console.error("❌ Complaint submission error:", error.message);
    return { success: false, error: error.message };
  }
}

/* ======================= ROUTES ======================= */
router.post("/", async (req, res) => {
  const { CallSid, From } = req.body;
  const twiml = new VoiceResponse();

  activeCalls.set(CallSid, { callSid: CallSid, from: From, step: "ivr_menu", retries: 0 });

  const gather = twiml.gather({
    input: "dtmf",
    numDigits: 1,
    timeout: 5,
    action: "/voice/process",
    method: "POST",
  });

  gather.say(
    { voice: "Polly.Aditi", language: "hi-IN" },
    "Namaste! Rajesh JCB Motors mein aapka swagat hai. Agar aap koi complaint register karna chahte hain to ek dabayein. Agar aap kisi agent se baat karna chahte hain to do dabayien."
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
      callData = { callSid: CallSid, step: "ivr_menu", retries: 0 };
      activeCalls.set(CallSid, callData);
    }

    if (!SpeechResult && !Digits) {
      const lastQ = callData.lastQuestion || "Kripya apna jawab bolein.";
      ask(twiml, lastQ);
      activeCalls.set(CallSid, callData);
      return res.type("text/xml").send(twiml.toString());
    }

    // ===== NUMERIC IVR MENU =====
    if (callData.step === "ivr_menu") {
      if (!Digits) {
        ask(twiml, "Kripya ek ya do number dabayien. Ek complaint ke liye, do agent ke liye.");
        activeCalls.set(CallSid, callData);
        return res.type("text/xml").send(twiml.toString());
      }

      if (Digits === "2") {
        twiml.say({ voice: "Polly.Aditi", language: "hi-IN" }, "Theek hai. Aapko ek human agent se connect kiya ja raha hai. Kripya ek moment ruke.");
        twiml.dial(process.env.HUMAN_AGENT_NUMBER || "+919876543210");
        activeCalls.delete(CallSid);
        return res.type("text/xml").send(twiml.toString());
      }

      if (Digits === "1") {
        callData.step = "ask_chassis";
        callData.retries = 0;
        callData.lastQuestion = "Machine ka number boliye. jaise ki, 4, 2, 0, 1, 5. ";
        // Use extended listening (2 minutes) for chassis input
        askWithListening(twiml, callData.lastQuestion, {
          maxSpeechTime: 120,  // 2 minutes
          timeout: 20,         // 20 second gaps between groups allowed
          speechTimeout: "auto"
        });
        activeCalls.set(CallSid, callData);
        return res.type("text/xml").send(twiml.toString());
      }

      ask(twiml, "Galat input. Ek complaint ke liye, do agent ke liye.");
      activeCalls.set(CallSid, callData);
      return res.type("text/xml").send(twiml.toString());
    }

    const rawSpeech = cleanSpeech(SpeechResult || "");
    console.log("\n" + "=".repeat(120));
    console.log(`📞 CALL SESSION: ${CallSid.substring(0, 12)}... | STEP: ${callData.step} | RETRY: ${callData.retries}`);
    console.log("=".repeat(120));
    console.log(`🎤 VOICE INPUT: "${SpeechResult}"`);
    console.log(`🧹 CLEANED: "${rawSpeech}"`);
    console.log(`📊 ANALYSIS:`);
    console.log(`   Length: ${rawSpeech.length} chars | Confidence: ${isUncertain(rawSpeech) ? 'Low (Uncertain)' : 'High'}`);
    console.log("=".repeat(120));

    // ===== ASK CHASSIS (WITH INTELLIGENT LISTENING & MERGING) =====
    if (callData.step === "ask_chassis") {
      console.log(`\n🔧 CHASSIS EXTRACTION START`);
      console.log(`   📢 Customer said: "${SpeechResult}"`);
      
      // Track word count
      const wordCount = countWords(rawSpeech);
      console.log(`   📊 Word count: ${wordCount} words`);
      
      // Check if customer is just announcing they'll give the number (not actual digits)
      const isAnnouncement = /^(मेरी|मेरे|मेरा|आपका|आपके|मशीन|नंबर|है|number|chassis|ha|meri|mere|mera|machine)\s*(नंबर|number|मशीन|chassis)?\s*(है|ha)?$/i.test(rawSpeech);
      
      if (isAnnouncement) {
        console.log(`   📣 CUSTOMER ANNOUNCING - Not actual digits, waiting for number...`);
        callData.step = "ask_chassis";  // Stay on same step
        callData.retries = 0;
        // Ask with extended listening time
        askWithListening(twiml, "Haan, ab number boliye.", {
          maxSpeechTime: 120,  // 2 minutes listening
          timeout: 20,         // 20 second timeout between groups
          speechTimeout: "auto"
        });
        activeCalls.set(CallSid, callData);
        return res.type("text/xml").send(twiml.toString());
      }
      
      // First try direct extraction
      const chassis = extractChassisNumberV2(rawSpeech);
      console.log(`   ✓ Extracted Chassis: ${chassis || "NOT FOUND"}`);
      
      let finalChassis = chassis;
      
      // If no direct extraction, try to merge spoken numbers
      if (!chassis) {
        console.log(`   🔄 ATTEMPTING NUMBER MERGE...`);
        const mergedNumber = mergeSpokenNumbers(rawSpeech);
        console.log(`   📞 Merged number: ${mergedNumber}`);
        
        // Also try accumulating with previously captured partial numbers
        if (!mergedNumber && callData.partialChassis) {
          console.log(`   📋 ACCUMULATING - Previous partial: ${callData.partialChassis}`);
          const accumulated = callData.partialChassis + mergedNumber;
          console.log(`   📋 Combined: ${accumulated}`);
          if (accumulated.length >= 4 && accumulated.length <= 8) {
            finalChassis = accumulated;
            callData.partialChassis = null;  // Clear accumulated
          }
        } else if (mergedNumber && mergedNumber.length >= 4 && mergedNumber.length <= 8) {
          console.log(`   ✅ Valid merged format: ${mergedNumber}`);
          finalChassis = mergedNumber;
        } else if (mergedNumber && mergedNumber.length > 0 && mergedNumber.length < 4) {
          // Store partial and ask for more
          console.log(`   📋 PARTIAL NUMBER (${mergedNumber.length} digits) - waiting for more...`);
          callData.partialChassis = mergedNumber;
          callData.step = "ask_chassis";
          callData.retries = 0;
          
          askWithListening(twiml, `${mergedNumber} theek hai. Ab baaki numbers boliye.`, {
            maxSpeechTime: 120,
            timeout: 20,
            speechTimeout: "auto"
          });
          activeCalls.set(CallSid, callData);
          return res.type("text/xml").send(twiml.toString());
        }
      }
      
      // Validate chassis number format and via API
      if (!finalChassis || !isValidChassis(finalChassis)) {
        callData.retries = (callData.retries || 0) + 1;
        console.log(`   ⚠️  RETRY ${callData.retries}/4 - Invalid or no chassis detected`);

        if (callData.retries >= 4) {
          console.log(`   ❌ GIVING UP AFTER 4 RETRIES - CONNECTING TO AGENT`);
          twiml.say({ voice: "Polly.Aditi", language: "hi-IN" }, "Number samajh nahi aaya. Agent se connect kar rahe hain.");
          twiml.dial(process.env.HUMAN_AGENT_NUMBER || "+919876543210");
          activeCalls.delete(CallSid);
          return res.type("text/xml").send(twiml.toString());
        }

        const hints = [
          "Documents se number boliye. Fast, slow, normal - koi bhi speed chalega. Clear boliye.",
          "Number 4 se 8 digit hota hai. Jaise: 3305447. Dobara boliye. Apni speed mein boliye.",
          "Bas numbers boliye. Hindi ya English dono chalega. Speed matter nahi - bas clear boliye."
        ];

        callData.lastQuestion = hints[Math.min(callData.retries - 1, 2)];
        console.log(`   📞 Asking again (Hint ${callData.retries}): ${callData.lastQuestion}`);
        
        // Use extended listening for retries
        askWithListening(twiml, callData.lastQuestion, {
          maxSpeechTime: 120,  // 2 minutes for retry
          timeout: 20,
          speechTimeout: "auto"
        });
        activeCalls.set(CallSid, callData);
        return res.type("text/xml").send(twiml.toString());
      }

      console.log(`   ✅ VALID CHASSIS EXTRACTED: ${finalChassis}`);
      
      // Validate via API
      const validationResult = await validateChassisNumberViaAPI(finalChassis);
      
      if (!validationResult.valid) {
        callData.retries = (callData.retries || 0) + 1;
        console.log(`   ⚠️  VALIDATION FAILED - RETRY ${callData.retries}/4`);
        console.log(`      Reason: ${validationResult.reason}`);

        if (callData.retries >= 4) {
          console.log(`   ❌ VALIDATION FAILED AFTER 3 ATTEMPTS - CONNECTING TO AGENT`);
          twiml.say({ voice: "Polly.Aditi", language: "hi-IN" }, "Machine ka record nahi mila. Agent se baatein karwa rahe hain.");
          twiml.dial(process.env.HUMAN_AGENT_NUMBER || "+919876543210");
          activeCalls.delete(CallSid);
          return res.type("text/xml").send(twiml.toString());
        }

        callData.lastQuestion = "Number sahi nahi. Dobara boliye, shai number.";
        console.log(`   📞 Record not found, asking again`);
        
        askWithListening(twiml, callData.lastQuestion, {
          maxSpeechTime: 120,
          timeout: 20,
          speechTimeout: "auto"
        });
        activeCalls.set(CallSid, callData);
        return res.type("text/xml").send(twiml.toString());
      }

      console.log(`   ✅ VALIDATION PASSED - CUSTOMER FOUND`);
      const customerData = validationResult.data;
      
      callData.chassis = finalChassis;
      callData.partialChassis = null;  // Clear partial number
      callData.customerData = {
        chassisNo: customerData.machineNo,
        phone: "Unknown",
        name: customerData.name,
        city: customerData.city,
        model: customerData.model,
        subModel: "NA",
        machineType: "Unknown",
        businessPartnerCode: "NA",
        purchaseDate: "NA",
        installationDate: "NA",
      };
      
      callData.step = "confirm_machine";
      callData.retries = 0;
      callData.lastQuestion = `Bahut badhiya! Machine mil gayi. Aapke naam: ${customerData.name}, city: ${customerData.city}. Kya ye sahi hai?`;
      ask(twiml, callData.lastQuestion);
      activeCalls.set(CallSid, callData);
      return res.type("text/xml").send(twiml.toString());
    }

    // ===== CONFIRM MACHINE =====
    if (callData.step === "confirm_machine") {
      const isAffirm = isAffirmative(rawSpeech);
      const isNeg = isNegative(rawSpeech);

      if (isAffirm) {
        callData.step = "ask_problem";
        callData.retries = 0;
        callData.lastQuestion = "Shukriya! Ab mujhe apni machine ki samasyaa batayein. Bilkul detail mein - kya problem ho rahi hai? Engine, AC, brake, hydraulic, electrical, ya kuch aur?";
        ask(twiml, callData.lastQuestion);
        activeCalls.set(CallSid, callData);
        return res.type("text/xml").send(twiml.toString());
      }

      if (isNeg) {
        callData.step = "ask_chassis";
        callData.retries = 0;
        callData.lastQuestion = "Theek hai. Phir se chassis number boliye.";
        ask(twiml, callData.lastQuestion);
        activeCalls.set(CallSid, callData);
        return res.type("text/xml").send(twiml.toString());
      }

      callData.retries = (callData.retries || 0) + 1;
      if (callData.retries >= 3) {
        callData.step = "ask_problem";
        callData.retries = 0;
        callData.lastQuestion = "Theek hai. Samasyaa batayein.";
        ask(twiml, callData.lastQuestion);
        activeCalls.set(CallSid, callData);
        return res.type("text/xml").send(twiml.toString());
      }

      ask(twiml, "Haan ya nahi boliye.");
      activeCalls.set(CallSid, callData);
      return res.type("text/xml").send(twiml.toString());
    }

    // ===== ASK PROBLEM DESCRIPTION (WITH CUSTOMER PATTERN DETECTION & WORD COUNTING) =====
    if (callData.step === "ask_problem") {
      console.log(`\n🎙️ CUSTOMER VOICE INPUT: "${SpeechResult}"`);
      console.log(`🧹 CLEANED TEXT: "${rawSpeech}"`);
      
      // Count words in customer's speech
      const wordCount = countWords(rawSpeech);
      console.log(`   📊 Word count: ${wordCount} words`);
      
      // If customer spoke 6-7 words (complete thought), track this
      if (wordCount >= 6 && wordCount <= 7) {
        console.log(`   ✅ ADEQUATE RESPONSE (6-7 words) - Customer gave initial problem description`);
        callData.initialProblemSpoken = true;
        callData.initialProblemWordCount = wordCount;
      } else if (wordCount > 7) {
        console.log(`   ✅ DETAILED RESPONSE (${wordCount} words) - Customer providing good detail`);
        callData.initialProblemSpoken = true;
        callData.initialProblemWordCount = wordCount;
      }
      
      // DETECT CUSTOMER SPEECH PATTERNS
      const patternAnalysis = detectCustomerPattern(rawSpeech);
      console.log(`📊 CUSTOMER PATTERN ANALYSIS:`);
      console.log(`   Primary Pattern: ${patternAnalysis.type}`);
      console.log(`   All Patterns: ${patternAnalysis.allPatterns.join(', ') || 'NONE'}`);
      console.log(`   Is Negation: ${patternAnalysis.isNegation}`);
      console.log(`   Has Multiple Problem: ${patternAnalysis.hasMultipleProblem}`);
      console.log(`   Needs Time Info: ${patternAnalysis.needsTime}`);
      console.log(`   Anytime OK: ${patternAnalysis.anytimeOkay}`);
      
      if (rejectInvalid(rawSpeech)) {
        callData.retries = (callData.retries || 0) + 1;
        console.log(`⚠️ RETRY ${callData.retries}/5: Invalid input - asking again`);
        
        if (callData.retries >= 5) {
          console.log(`❌ PROBLEM DETECTION: Failed after 5 attempts - connecting to agent`);
          twiml.say({ voice: "Polly.Aditi", language: "hi-IN" }, "Samajh nahi aaya. Agent se connect kar rahe hain.");
          twiml.dial(process.env.HUMAN_AGENT_NUMBER || "+919876543210");
          activeCalls.delete(CallSid);
          return res.type("text/xml").send(twiml.toString());
        }
        
        // Use extended listening for problem description - allow customer more time
        askWithListening(twiml, "Samasyaa clear boliye. Engine, transmission, hydraulic, brake, koi bhi problem?", {
          maxSpeechTime: 60,  // Allow up to 60 seconds of continuous speech
          timeout: 8,
          speechTimeout: "auto"
        });
        activeCalls.set(CallSid, callData);
        return res.type("text/xml").send(twiml.toString());
      }

      // Handle multiple problems
      if (patternAnalysis.hasMultipleProblem) {
        console.log(`⚠️ MULTIPLE PROBLEMS DETECTED`);
        callData.multipleProblems = true;
        callData.step = "ask_problem_detail";
        callData.retries = 0;
        callData.lastQuestion = "Samjha. Aapko ek se zyada problem hai. Theek hai, mujhe sab problems ka detail batayein. Ek ek kar ke boliye.";
        ask(twiml, callData.lastQuestion);
        activeCalls.set(CallSid, callData);
        return res.type("text/xml").send(twiml.toString());
      }

      // Handle time-not-available scenarios
      if (patternAnalysis.needsTime) {
        console.log(`⏰ TIME NOT AVAILABLE - ASKING LATER`);
        callData.timeNotAvailable = true;
        callData.step = "ask_machine_availability";
        callData.retries = 0;
        callData.lastQuestion = "Koi baat nahi. Aap baad mein batayena. Phir se ek baat puchta hoon - machine available kab hai service ke liye?";
        ask(twiml, callData.lastQuestion);
        activeCalls.set(CallSid, callData);
        return res.type("text/xml").send(twiml.toString());
      }

      // Handle if customer already understood
      if (patternAnalysis.understood) {
        console.log(`✅ CUSTOMER ALREADY UNDERSTOOD - SKIP CONFIRMATION`);
        callData.step = "ask_machine_availability";
        callData.retries = 0;
        callData.lastQuestion = "Bilkul! Machine available kab hai? Aaj, kal, parso?";
        ask(twiml, callData.lastQuestion);
        activeCalls.set(CallSid, callData);
        return res.type("text/xml").send(twiml.toString());
      }

      // SMART ANALYSIS
      const analysis = analyzeCustomerSpeech(rawSpeech);
      callData.rawComplaint = rawSpeech;

      // Check if customer is REJECTING a previous suggestion
      if (patternAnalysis.isNegation) {
        console.log(`🚫 REJECTION/NEGATION DETECTED: Customer saying they didn't say that`);
        callData.retries = 0;
        callData.lastQuestion = "Theek. Samjh gaya. Aap dobara clearly batayein - aapko exactly kaunsi problem hai?";
        ask(twiml, callData.lastQuestion);
        activeCalls.set(CallSid, callData);
        return res.type("text/xml").send(twiml.toString());
      }

      // Capture location/address if mentioned
      if (analysis.location) {
        callData.jobLocation = analysis.location;
        console.log(`✅ Location captured: ${analysis.location}`);
      }
      if (analysis.address) {
        callData.address = analysis.address;
        console.log(`✅ Address context captured: ${analysis.address}`);
      }

      const detected = analysis.problem || detectComplaint(rawSpeech);
      console.log(`🔍 FIRST DETECTION ATTEMPT:`);
      console.log(`   Detected Problem: ${detected && detected.complaint ? detected.complaint : 'NONE'}`);
      console.log(`   Confidence Score: ${detected && detected.score ? detected.score : '0'}`);
      console.log(`   Raw Speech: "${rawSpeech}"`);

      if (!detected || (detected.score && detected.score < 5)) {
        console.log(`📋 LOW CONFIDENCE - Need more details`);
        callData.step = "ask_problem_detail";
        callData.retries = 0;
        callData.lastQuestion = "Theek, aur bhi detail mein batayein - exact kya problem hai? Machine kaunsa part kharab hai ya kaunsi avaz aa rahi hai?";
        ask(twiml, callData.lastQuestion);
        activeCalls.set(CallSid, callData);
        return res.type("text/xml").send(twiml.toString());
      }

      console.log(`✅ DETECTION CONFIDENT: ${detected.complaint || detected}`);
      callData.complaintTitle = detected.complaint || detected;
      callData.step = "confirm_problem";
      callData.retries = 0;
      callData.lastQuestion = `Bilkul! Aapne kaha ${callData.complaintTitle} mein problem hai. Ye sahi hai na?`;
      ask(twiml, callData.lastQuestion);
      activeCalls.set(CallSid, callData);
      return res.type("text/xml").send(twiml.toString());
    }

    // ===== CONFIRM PROBLEM BEFORE SUB-COMPLAINT =====
    if (callData.step === "confirm_problem") {
      console.log(`\n🎙️ CONFIRMATION INPUT: "${SpeechResult}"`);
      console.log(`   Current Problem: ${callData.complaintTitle}`);
      
      const isAffirm = isAffirmative(rawSpeech);
      const isNeg = isNegative(rawSpeech);
      
      // Check if negative is just clarification (at start) vs actual rejection
      const isInitialNegation = /^(नहीं|नही|ना|no|nahi)\s*[,।]?\s*(मैंने|maine|i said|maine kaha)/i.test(rawSpeech);
      const hasComplaintKeywords = /समस्या|problem|खराब|काम|चल|start|शुरू|engine|transmission|hydraulic|brake|steering/i.test(rawSpeech);

      console.log(`📊 CONFIRMATION ANALYSIS:`);
      console.log(`   Affirmative: ${isAffirm}`);
      console.log(`   Negative: ${isNeg}`);
      console.log(`   Initial Negation (Clarification): ${isInitialNegation}`);
      console.log(`   Has Complaint Keywords: ${hasComplaintKeywords}`);

      // If customer is clarifying ("No, I meant..."), treat as continuation
      if (isInitialNegation && hasComplaintKeywords) {
        console.log(`✅ CLARIFICATION DETECTED - Customer is explaining further`);
        // Continue to next step (sub-questions or confirmation)
      } else if (isNeg && !isAffirm && !isInitialNegation) {
        callData.retries = (callData.retries || 0) + 1;
        console.log(`🚫 REJECTION DETECTED - RETRY ${callData.retries}/5`);
        
        if (callData.retries >= 5) {
          console.log(`❌ Cannot find correct problem after 5 confirmations`);
          callData.step = "ask_problem";
          callData.retries = 0;
          callData.lastQuestion = "Accha. Phir se samasyaa clear batayein - Maine samjh gaya?";
          ask(twiml, callData.lastQuestion);
          activeCalls.set(CallSid, callData);
          return res.type("text/xml").send(twiml.toString());
        }
        
        callData.step = "ask_problem";
        callData.retries = (callData.retries - 1);
        callData.lastQuestion = "Theek! Tabhi aap dobara clear batayein - aapko exactly kya issue hai?";
        ask(twiml, callData.lastQuestion);
        activeCalls.set(CallSid, callData);
        return res.type("text/xml").send(twiml.toString());
      }

      if (isAffirm) {
        console.log(`✅ PROBLEM CONFIRMED: ${callData.complaintTitle}`);
        console.log(`📋 SIMPLIFIED FLOW - SKIPPING SUB-COMPLAINT ASKING`);
        console.log(`   Customer can mention multiple issues in single description`);
        callData.complaintSubTitle = "Multiple Issues";
        callData.step = "ask_machine_availability";
        callData.retries = 0;
        callData.lastQuestion = "Bilkul samjha! Ek baat batayein - machine service ke liye kab available hai? Aaj, kal, parso?";
        ask(twiml, callData.lastQuestion);
        activeCalls.set(CallSid, callData);
        return res.type("text/xml").send(twiml.toString());
      }

      // Uncertain response
      ask(twiml, "Haan ya nahi boliye.");
      activeCalls.set(CallSid, callData);
      return res.type("text/xml").send(twiml.toString());
    }

    // ===== ASK PROBLEM DETAIL (WITH 5 RETRIES) =====
    if (callData.step === "ask_problem_detail") {
      console.log(`\n🎙️ DETAIL SPEECH INPUT: "${SpeechResult}"`);
      console.log(`   Current Retry: ${(callData.retries || 0) + 1}/5`);

      const analysis = analyzeCustomerSpeech(rawSpeech);
      callData.rawComplaint = rawSpeech;

      // Check for negation of previously suggested problem
      const negationPatterns = /(maine ye nahi kha|maine yeh nahi|maine is nahi|yeh nahi|ye nahi|wo nahi|nahin|se nahi|aisa nahi)/i;
      if (negationPatterns.test(rawSpeech)) {
        console.log(`🚫 NEGATION DETECTED - Customer rejecting previous suggestion`);
        callData.retries = (callData.retries || 0) + 1;
        
        if (callData.retries >= 5) {
          console.log(`❌ STILL NO MATCH AFTER 5 ATTEMPTS - Using General Problem`);
          callData.complaintTitle = "General Problem";
          callData.complaintSubTitle = "Other";
          callData.step = "confirm_complaint";
          twiml.say({ voice: "Polly.Aditi", language: "hi-IN" }, `Theek. General Problem mark kar dete hain. Bilkul sahi?`);
          activeCalls.set(CallSid, callData);
          return res.type("text/xml").send(twiml.toString());
        }

        // Ask with different phrasing
        const clarifyQuestions = [
          "Theek. Aap clear boliye - machine mein exactly kya problem hai?",
          "Machine kya kar raha hai? Kya fail ho gaya?",
          "Sound aa rahi hai? Machine move ho raha hai?",
          "Engine start ho raha hai ya startup mein problem hai?",
          "Ek aur bar samjhayein - kya exact issue hai?"
        ];
        const nextQuestion = clarifyQuestions[callData.retries - 1] || "Detail mein samjhayein.";
        console.log(`📋 ASKING WITH CLARITY (Attempt ${callData.retries}): ${nextQuestion}`);
        ask(twiml, nextQuestion);
        activeCalls.set(CallSid, callData);
        return res.type("text/xml").send(twiml.toString());
      }

      // Capture extra details
      if (analysis.location && !callData.jobLocation) {
        callData.jobLocation = analysis.location;
        console.log(`✅ Location captured: ${analysis.location}`);
      }
      if (analysis.address && !callData.address) {
        callData.address = analysis.address;
        console.log(`✅ Address captured: ${analysis.address}`);
      }

      const detected = analysis.problem || detectComplaint(rawSpeech);

      console.log(`🔍 DETECTION ANALYSIS:`);
      console.log(`   Detected: ${detected?.complaint || 'NONE'}`);
      console.log(`   Score: ${detected?.score || 0}`);
      console.log(`   Raw: "${rawSpeech}"`);

      if (!detected || !detected.complaint) {
        callData.retries = (callData.retries || 0) + 1;
        console.log(`❌ NO MATCH - RETRY ${callData.retries}/5`);

        if (callData.retries >= 5) {
          console.log(`❌ FINAL ATTEMPT FAILED - Using General Problem`);
          callData.complaintTitle = "General Problem";
          callData.complaintSubTitle = "Other";
        } else {
          // Ask again with progressively specific guidance
          const retryQuestions = [
            "Accha. Machine mein kaun sa hissa problem de raha hai? Engine, gear, brake, kuch aur?",
            "Sound aa rahi hai ya vibration? Ya machine move nahi ho raha?",
            "Machine start ho raha hai na? Kya startup mein fail ho gaya?",
            "Theek. Machine kae kaunse part se sound aa rahi hai ya smoke?",
            "Ek aur bar - exact kya problem bol rahe ho?"
          ];
          const nextRetryQuestion = retryQuestions[callData.retries - 1] || "Samasyaa samjhayein.";
          console.log(`📋 RETRY QUESTION (Attempt ${callData.retries}): ${nextRetryQuestion}`);
          ask(twiml, nextRetryQuestion);
          activeCalls.set(CallSid, callData);
          return res.type("text/xml").send(twiml.toString());
        }
      } else {
        console.log(`✅ DETECTED ON DETAIL: ${detected.complaint}`);
        callData.complaintTitle = detected.complaint;
        const subResult = detectSubComplaint(detected.complaint, rawSpeech);
        callData.complaintSubTitle = subResult?.subTitle || "Other";
      }

      callData.step = "confirm_complaint";
      callData.retries = 0;
      callData.lastQuestion = `Theek samza! ${callData.complaintTitle} - ${callData.complaintSubTitle}. Confirm करते हैं?`;
      ask(twiml, callData.lastQuestion);
      activeCalls.set(CallSid, callData);
      return res.type("text/xml").send(twiml.toString());
    }

    // ===== ASK_FOLLOWUP DISABLED - SIMPLIFIED COMPLAINT FLOW =====
    // Sub-complaint questions removed - customers can express multiple problems in single description
    // Complaint now goes directly from confirm_problem to ask_machine_availability

    // ===== CONFIRM COMPLAINT CATEGORY (WITH MULTI-STEP LOGGING) =====
    if (callData.step === "confirm_complaint") {
      console.log(`\n🎙️ CONFIRMATION INPUT: "${SpeechResult}"`);
      
      const analysis = analyzeCustomerSpeech(rawSpeech);
      const isAffirm = isAffirmative(rawSpeech);
      const isNeg = isNegative(rawSpeech);

      console.log(`📋 FINAL COMPLAINT CONFIRMATION:`);
      console.log(`   Title: ${callData.complaintTitle}`);
      console.log(`   Sub-Title: ${callData.complaintSubTitle}`);
      console.log(`   Customer Response: "${rawSpeech}"`);
      console.log(`   Affirmative Match: ${isAffirm}`);
      console.log(`   Negative Match: ${isNeg}`);
      console.log(`   Rejection Flag: ${analysis.rejection || false}`);

      // Log complete complaint detection process
      console.log(`\n✅ COMPLETE COMPLAINT DETECTION LOG:`);
      console.log(`   Initial Speech: "${callData.rawComplaint}"`);
      console.log(`   Machine Chassis: ${callData.chassis}`);
      console.log(`   Final Title: ${callData.complaintTitle}`);
      console.log(`   Final SubTitle: ${callData.complaintSubTitle}`);
      if (callData.jobLocation) console.log(`   Location: ${callData.jobLocation}`);
      if (callData.address) console.log(`   Address: ${callData.address}`);
      console.log(`   Status: ${isAffirm ? '✅ CONFIRMED' : isNeg ? '❌ REJECTED' : '⏸️ UNCERTAIN'}`);

      // SMART: If customer says rejection or negation, go back to problem
      if (analysis.rejection || isNeg) {
        console.log(`🚫 REJECTION DETECTED - Re-asking problem question`);
        callData.step = "ask_problem";
        callData.retries = 0;
        callData.lastQuestion = "Theek. Phir se samasyaa batayein. Aapko kaunsi problem hai?";
        ask(twiml, callData.lastQuestion);
        activeCalls.set(CallSid, callData);
        return res.type("text/xml").send(twiml.toString());
      }

      if (isAffirm) {
        console.log(`✅ COMPLAINT CONFIRMED - Moving to next step`);
        callData.step = "ask_machine_availability";
        callData.retries = 0;
        callData.lastQuestion = "Bilkul! Ab batayein - machine available kab hai? Aaj, kal, parso?";
        ask(twiml, callData.lastQuestion);
        activeCalls.set(CallSid, callData);
        return res.type("text/xml").send(twiml.toString());
      }

      // Uncertain - ask for confirmation again
      callData.retries = (callData.retries || 0) + 1;
      console.log(`⏸️ UNCERTAIN RESPONSE - CONFIRMATION RETRY ${callData.retries}/3`);
      
      if (callData.retries >= 3) {
        console.log(`⚠️ PROCEEDING WITH CURRENT SELECTION`);
        callData.step = "ask_machine_availability";
        callData.retries = 0;
        callData.lastQuestion = "Theek. Machine available kab hai?";
        ask(twiml, callData.lastQuestion);
        activeCalls.set(CallSid, callData);
        return res.type("text/xml").send(twiml.toString());
      }

      ask(twiml, `Accha. ${callData.complaintTitle} - ${callData.complaintSubTitle} sahi hai na? Haan ya nahi?`);
      activeCalls.set(CallSid, callData);
      return res.type("text/xml").send(twiml.toString());
    }

    // ===== ASK MACHINE AVAILABILITY & SERVICE SCHEDULE =====
    if (callData.step === "ask_machine_availability") {
      if (rejectInvalid(rawSpeech)) {
        callData.retries = (callData.retries || 0) + 1;
        if (callData.retries >= 3) {
          // After 3 retries, use default and move forward
          console.log("⚠️ Machine availability unclear - setting default");
          callData.machineAvailability = "As soon as possible";
          callData.step = "ask_city_name";
          callData.retries = 0;
          callData.lastQuestion = "Theek. Machine kaunsa city mein hai?";
          ask(twiml, callData.lastQuestion);
          activeCalls.set(CallSid, callData);
          return res.type("text/xml").send(twiml.toString());
        }
        ask(twiml, "Machine service ke liye kab available hai? Aaj, kal, ya parso batayein.");
        activeCalls.set(CallSid, callData);
        return res.type("text/xml").send(twiml.toString());
      }

      const availability = rawSpeech;
      callData.machineAvailability = availability;
      
      // Try to extract date from availability response
      const dateInfo = extractServiceDate(rawSpeech);
      if (dateInfo) {
        callData.serviceDate = dateInfo;
        console.log(`📅 Service date extracted: ${dateInfo.toDateString()}`);
      }
      
      console.log(`✅ Machine availability recorded: ${availability}`);
      callData.step = "ask_city_name";
      callData.retries = 0;
      callData.lastQuestion = "Bilkul. Ab batayein - machine kaunsa city mein hai?";
      ask(twiml, callData.lastQuestion);
      activeCalls.set(CallSid, callData);
      return res.type("text/xml").send(twiml.toString());
    }

    // ===== ASK SERVICE AVAILABILITY & DATE - SIMPLIFIED =====
    if (callData.step === "ask_service_availability_OLD") {

      if (!date) {
        callData.retries = (callData.retries || 0) + 1;
        if (callData.retries >= 3) {
          // Default to tomorrow after 3 failed attempts
          const tomorrow = new Date();
          tomorrow.setDate(tomorrow.getDate() + 1);
          callData.serviceDate = tomorrow;
          callData.fromTime = "9:00 AM";
          callData.toTime = "5:00 PM";
          
          console.log("\n" + "=".repeat(120));
          console.log("✅ INCOMPLETE DATA - SAVING WITH DEFAULTS FOR CALLBACK");
          console.log("=".repeat(120));
          console.log(`Chassis: ${callData.chassis}`);
          console.log(`Customer: ${callData.customerData.name}`);
          console.log(`Complaint: ${callData.complaintTitle} - ${callData.complaintSubTitle}`);
          console.log(`Status: ${callData.machineStatus || "Breakdown"}`);
          console.log(`Service Date (Default): ${tomorrow.toDateString()}`);
          console.log(`Time Window (Default): 9:00 AM - 5:00 PM`);
          console.log(`Location: ${callData.jobLocation || "Onsite"}`);
          console.log(`Note: Customer will be called to confirm exact timing`);
          console.log("=".repeat(120) + "\n");

          const result = await saveComplaint(twiml, callData);
          if (result.success && result.sapId) {
            twiml.say({ voice: "Polly.Aditi", language: "hi-IN" }, `Shukriya! Aapki complaint ID: ${result.sapId}. Hamara engineer kal aapko call karega exact time confirm karne ke liye.`);
          } else {
            twiml.say({ voice: "Polly.Aditi", language: "hi-IN" }, "Shukriya! Aapki complaint register ho gayi. Hamara engineer aapko call karega confirm karne ke liye.");
          }
          twiml.hangup();
          activeCalls.delete(CallSid);
          return res.type("text/xml").send(twiml.toString());
        }
        ask(twiml, "Aaj, kal, ya parso? Kab sahi rahega?");
        activeCalls.set(CallSid, callData);
        return res.type("text/xml").send(twiml.toString());
      }

      console.log(`✓ Service Date: ${date.toDateString()}`);
      callData.serviceDate = date;
      callData.step = "ask_service_time_window";
      callData.retries = 0;
      callData.lastQuestion = `Theek hai. ${date.toDateString()} ko. Kya morning (9 AM - 1 PM), afternoon (1 PM - 5 PM), ya evening (3 PM - 7 PM) chalega?`;
      ask(twiml, callData.lastQuestion);
      activeCalls.set(CallSid, callData);
      return res.type("text/xml").send(twiml.toString());
    }

    // ===== ASK SERVICE TIME WINDOW =====
    if (callData.step === "ask_service_time_window") {
      const timeInput = rawSpeech.toLowerCase();
      let fromTime = "9:00 AM";
      let toTime = "5:00 PM";

      if (timeInput.includes('morning') || timeInput.includes('subah') || timeInput.includes('9') || timeInput.includes('10') || timeInput.includes('11')) {
        fromTime = "9:00 AM";
        toTime = "1:00 PM";
      } else if (timeInput.includes('afternoon') || timeInput.includes('dopahar') || timeInput.includes('1') || timeInput.includes('2') || timeInput.includes('3')) {
        fromTime = "1:00 PM";
        toTime = "5:00 PM";
      } else if (timeInput.includes('evening') || timeInput.includes('sham') || timeInput.includes('4') || timeInput.includes('5') || timeInput.includes('6') || timeInput.includes('7')) {
        fromTime = "3:00 PM";
        toTime = "7:00 PM";
      } else if (rejectInvalid(rawSpeech)) {
        callData.retries = (callData.retries || 0) + 1;
        if (callData.retries >= 3) {
          // Use default
          callData.fromTime = "9:00 AM";
          callData.toTime = "5:00 PM";
          callData.step = "ask_job_location";
          callData.retries = 0;
          callData.lastQuestion = "Theek. Machine kahan hai? Workshop ya site par?";
          ask(twiml, callData.lastQuestion);
          activeCalls.set(CallSid, callData);
          return res.type("text/xml").send(twiml.toString());
        }
        ask(twiml, "Morning (9-1), afternoon (1-5), ya evening (3-7)?");
        activeCalls.set(CallSid, callData);
        return res.type("text/xml").send(twiml.toString());
      }

      callData.fromTime = fromTime;
      callData.toTime = toTime;
      callData.step = "ask_job_location";
      callData.retries = 0;
      callData.lastQuestion = `Theek hai. ${fromTime} - ${toTime}. Machine kahan hai? Workshop ya site par?`;
      ask(twiml, callData.lastQuestion);
      activeCalls.set(CallSid, callData);
      return res.type("text/xml").send(twiml.toString());
    }

    // ===== ASK JOB LOCATION =====
    if (callData.step === "ask_job_location") {
      // Accept any location input (no rejection if speechResult is provided)
      // Try to detect known location, otherwise accept raw speech as location
      const location = detectJobLocation(rawSpeech) || rawSpeech.trim();
      
      if (!location || location.length < 2) {
        callData.retries = (callData.retries || 0) + 1;
        if (callData.retries >= 4) {
          // Use default location after 4 retries
          callData.jobLocation = "Onsite";
          callData.step = "ask_city_name";
          callData.retries = 0;
          callData.lastQuestion = "Theek hai. City name batayein. Jaipur, Kota, Ajmer, Alwar?";
          ask(twiml, callData.lastQuestion);
          activeCalls.set(CallSid, callData);
          return res.type("text/xml").send(twiml.toString());
        }
        ask(twiml, "Workshop ya site location batayein.");
        activeCalls.set(CallSid, callData);
        return res.type("text/xml").send(twiml.toString());
      }

      // Accept location and move forward
      callData.jobLocation = location;
      callData.step = "ask_city_name";
      callData.retries = 0;
      callData.lastQuestion = "Theek hai. City name batayein. Jaipur, Kota, Ajmer, Alwar?";
      ask(twiml, callData.lastQuestion);
      activeCalls.set(CallSid, callData);
      return res.type("text/xml").send(twiml.toString());
    }

    // ===== ASK CITY NAME =====
    if (callData.step === "ask_city_name") {
      if (rejectInvalid(rawSpeech)) {
        callData.retries = (callData.retries || 0) + 1;
        if (callData.retries >= 3) {
          callData.city = callData.customerData.city;
          callData.step = "ask_pincode";
          callData.retries = 0;
          callData.lastQuestion = "Theek. Pincode batayein. 6 digits.";
          ask(twiml, callData.lastQuestion);
          activeCalls.set(CallSid, callData);
          return res.type("text/xml").send(twiml.toString());
        }
        ask(twiml, "City clear boliye.");
        activeCalls.set(CallSid, callData);
        return res.type("text/xml").send(twiml.toString());
      }

      // Store city and move to address
      callData.city = rawSpeech.trim();
      callData.step = "ask_address";
      callData.retries = 0;
      callData.lastQuestion = "Shukriya! Machine ka address batayein. City, area, ya landmark?";
      ask(twiml, callData.lastQuestion);
      activeCalls.set(CallSid, callData);
      return res.type("text/xml").send(twiml.toString());
    }

    // ===== ASK ADDRESS (BEFORE PINCODE) =====
    if (callData.step === "ask_address") {
      // Check if customer says they already provided the address
      if (/अभी|already|bata(ya)?|de(ya)?|diya/i.test(rawSpeech)) {
        console.log(`ℹ️ CUSTOMER SAYS ADDRESS ALREADY PROVIDED`);
        callData.address = callData.address || "Not Provided";
        callData.step = "ask_pincode";
        callData.retries = 0;
        callData.lastQuestion = "Theek. 6 digit pincode batayein.";
        ask(twiml, callData.lastQuestion);
        activeCalls.set(CallSid, callData);
        return res.type("text/xml").send(twiml.toString());
      }

      if (rejectInvalid(rawSpeech)) {
        callData.retries = (callData.retries || 0) + 1;
        if (callData.retries >= 3) {
          callData.address = callData.address || "Not Provided";
          callData.step = "ask_pincode";
          callData.retries = 0;
          callData.lastQuestion = "Theek. 6 digit pincode batayein.";
          ask(twiml, callData.lastQuestion);
          activeCalls.set(CallSid, callData);
          return res.type("text/xml").send(twiml.toString());
        }
        ask(twiml, "Address clear boliye. City, locality, or landmark.");
        activeCalls.set(CallSid, callData);
        return res.type("text/xml").send(twiml.toString());
      }

      // SMART ANALYSIS for address
      const analysis = analyzeCustomerSpeech(rawSpeech);
      
      // Capture location if not already set
      if (analysis.location && !callData.jobLocation) {
        callData.jobLocation = analysis.location;
        console.log(`✅ Location from address: ${analysis.location}`);
      }

      // Store address
      callData.address = rawSpeech.trim();
      
      console.log(`📮 Address captured: "${callData.address}"`);

      // Move to pincode
      callData.step = "ask_pincode";
      callData.retries = 0;
      callData.lastQuestion = "Shukriya! Ab 6 digit pincode batayein.";
      ask(twiml, callData.lastQuestion);
      activeCalls.set(CallSid, callData);
      return res.type("text/xml").send(twiml.toString());
    }

    // ===== ASK PINCODE =====
    if (callData.step === "ask_pincode") {
      if (rejectInvalid(rawSpeech)) {
        callData.retries = (callData.retries || 0) + 1;
        if (callData.retries >= 3) {
          twiml.say({ voice: "Polly.Aditi", language: "hi-IN" }, "Pincode samajh nahi aaya. Agent se connect kar rahe hain.");
          twiml.dial(process.env.HUMAN_AGENT_NUMBER || "+919876543210");
          activeCalls.delete(CallSid);
          return res.type("text/xml").send(twiml.toString());
        }
        ask(twiml, "6 digit pincode clear boliye.");
        activeCalls.set(CallSid, callData);
        return res.type("text/xml").send(twiml.toString());
      }

      const pincode = extractPincodeV2(rawSpeech);

      if (!pincode || !isValidPincode(pincode)) {
        callData.retries = (callData.retries || 0) + 1;
        if (callData.retries >= 3) {
          twiml.say({ voice: "Polly.Aditi", language: "hi-IN" }, "Pincode match nahi hua. Agent se connect kar rahe hain.");
          twiml.dial(process.env.HUMAN_AGENT_NUMBER || "+919876543210");
          activeCalls.delete(CallSid);
          return res.type("text/xml").send(twiml.toString());
        }
        ask(twiml, "6 digit pincode ek ek digit clear boliye.");
        activeCalls.set(CallSid, callData);
        return res.type("text/xml").send(twiml.toString());
      }

      console.log(`✓ Pincode: ${pincode}`);
      callData.pincode = pincode;
      callData.step = "confirm_pincode";
      callData.retries = 0;
      callData.lastQuestion = `Pincode: ${pincode}. Sahi hai?`;
      ask(twiml, callData.lastQuestion);
      activeCalls.set(CallSid, callData);
      return res.type("text/xml").send(twiml.toString());
    }

    // ===== CONFIRM PINCODE =====
    if (callData.step === "confirm_pincode") {
      const isAffirm = isAffirmative(rawSpeech);
      const isNeg = isNegative(rawSpeech);

      if (isAffirm) {
        callData.step = "final_confirmation";
        callData.retries = 0;
        const summary = `${callData.complaintTitle} - ${callData.complaintSubTitle} | ${callData.serviceDate?.toDateString()} | ${callData.fromTime} - ${callData.toTime} | ${callData.jobLocation} | ${callData.address}`;
        callData.lastQuestion = `Perfect! Details: ${summary}. Sab bilkul theek hai?`;
        ask(twiml, callData.lastQuestion);
        activeCalls.set(CallSid, callData);
        return res.type("text/xml").send(twiml.toString());
      }

      if (isNeg) {
        callData.step = "ask_pincode";
        callData.retries = 0;
        callData.lastQuestion = "Theek. Pincode dobara.";
        ask(twiml, callData.lastQuestion);
        activeCalls.set(CallSid, callData);
        return res.type("text/xml").send(twiml.toString());
      }

      callData.retries = (callData.retries || 0) + 1;
      if (callData.retries >= 3) {
        callData.step = "final_confirmation";
        callData.retries = 0;
        callData.lastQuestion = "Theek. Aapke abhi details aage badhte hain.";
        ask(twiml, callData.lastQuestion);
        activeCalls.set(CallSid, callData);
        return res.type("text/xml").send(twiml.toString());
      }

      ask(twiml, "Haan ya nahi?");
      activeCalls.set(CallSid, callData);
      return res.type("text/xml").send(twiml.toString());
    }

    // ===== ASK ADDRESS =====
    // ===== FINAL CONFIRMATION & SUBMIT =====
    if (callData.step === "final_confirmation") {
      const isAffirm = isAffirmative(rawSpeech);

      if (!isAffirm) {
        callData.retries = (callData.retries || 0) + 1;
        if (callData.retries >= 3) {
          // Force save
          console.log("\n" + "=".repeat(120));
          console.log("✅ COMPLAINT DATA - SAVING TO API");
          console.log("=".repeat(120));
          console.log(`Chassis: ${callData.chassis}`);
          console.log(`Customer: ${callData.customerData.name}`);
          console.log(`Complaint: ${callData.complaintTitle} - ${callData.complaintSubTitle}`);
          console.log(`Status: ${callData.machineStatus}`);
          console.log(`Location: ${callData.jobLocation} | City: ${callData.city} | Pincode: ${callData.pincode}`);
          console.log(`Date: ${callData.serviceDate?.toDateString()} | Time: ${callData.fromTime} - ${callData.toTime}`);
          console.log("=".repeat(120) + "\n");

          const result = await saveComplaint(twiml, callData);
          if (result.success && result.sapId) {
            twiml.say({ voice: "Polly.Aditi", language: "hi-IN" }, `Bahut bahut shukriya! Complaint registered. SAP ID: ${result.sapId}. Engineer aapko contact karega.`);
          } else {
            twiml.say({ voice: "Polly.Aditi", language: "hi-IN" }, "Bahut bahut shukriya! Aapki complaint register ho gayi. Hamari team contact karega.");
          }
          twiml.hangup();
          activeCalls.delete(CallSid);
          return res.type("text/xml").send(twiml.toString());
        }

        ask(twiml, "Sab sahi hai? Haan boliye.");
        activeCalls.set(CallSid, callData);
        return res.type("text/xml").send(twiml.toString());
      }

      // Save to API
      console.log("\n" + "=".repeat(120));
      console.log("✅ COMPLAINT DATA - SAVING TO API");
      console.log("=".repeat(120));
      console.log(`Chassis: ${callData.chassis}`);
      console.log(`Customer: ${callData.customerData.name}`);
      console.log(`Complaint: ${callData.complaintTitle} - ${callData.complaintSubTitle}`);
      console.log(`Status: ${callData.machineStatus}`);
      console.log(`Location: ${callData.jobLocation} | City: ${callData.city} | Pincode: ${callData.pincode}`);
      console.log(`Date: ${callData.serviceDate?.toDateString()} | Time: ${callData.fromTime} - ${callData.toTime}`);
      console.log("=".repeat(120) + "\n");

      const result = await saveComplaint(twiml, callData);

      if (result.success && result.sapId) {
        twiml.say({ voice: "Polly.Aditi", language: "hi-IN" }, `Bilkul theek! Complaint registered successfully. SAP ID: ${result.sapId}. Hamara engineer aapko contact karega. Dhanyavaad!`);
      } else {
        twiml.say({ voice: "Polly.Aditi", language: "hi-IN" }, "Bilkul theek! Aapki complaint register ho gayi. Hamari team aapko contact karega. Dhanyavaad!");
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
    twiml.say({ voice: "Polly.Aditi", language: "hi-IN" }, "Kshama karein, technical problem. Agent se connect kar rahe hain.");
    twiml.dial(process.env.HUMAN_AGENT_NUMBER || "+919876543210");
    return res.type("text/xml").send(twiml.toString());
  }
});

export default router;
