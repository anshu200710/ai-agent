// i want some changes in this first ask their chassis number then ask kya problem aa rahi hai get full information about problem come in machine and add all possible complaint to what customer can say then ask service engineer ko kab bhejna hai, kitne baje aa sakta hai then take machine onsite or workshop get full address fist city landmark and area and then pincode then get data all what comes from api , customer caller phone no which number this perform this call complaint description full and corrected find perfect complaint title and sub title and then save in database next give me full and corrcted code of this file and add more and all possible complaint add to get perfect title and sub title

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
  extractTimeV3,
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
const EXTERNAL_API_BASE = "http://gprs.rajeshmotors.com/jcbServiceEnginerAPIv7";
const COMPLAINT_API_URL = "http://gprs.rajeshmotors.com/jcbServiceEnginerAPIv7/ai_call_complaint.php";
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
  'मालूम नहीं', 'मालूम नही', 'नहीं मालूम', 'जानकारी नहीं',
  'याद नहीं', 'याद नही', 'नहीं याद', 'याद न',
  'भूल गया', 'भूल गयी', 'भूल गए', 'भूल गई', 'याद नहीं आ रहा',
  'समझ नहीं', 'समझ नही', 'नहीं समझ आ रहा', 'समझ नहीं आया',
  'जानता नहीं', 'जानता नही', 'जानती नहीं', 'मैं नहीं जानता',
  'मैं नहीं जानती', 'हमें नहीं पता', 'कोई विचार नहीं', 'कोई आइडिया नहीं',
  'अंदाजा नहीं', 'क्लू नहीं',
  'dont know', 'do not know', "don't know", 'dunno', 'no idea', 'no clue',
  'not sure', 'uncertain', 'forget', 'forgot', 'forgotten', "can't remember"
];

/* ======================= COMPREHENSIVE ENHANCED COMPLAINT MAP ======================= */
const complaintMap = {
  "Engine": {
    keywords: [
      "engine", "motor", "इंजन", "इंजीन", "मोटर", "इंडियन", "स्टार्ट नहीं", 
      "start nahi", "chalu nahi", "चालू नहीं", "धुआ", "smoke", "dhuan", "गर्मी", 
      "overheat", "आवाज", "noise", "sound", "शोर", "खड़खड़", "तेल लीक", "oil leak",
      "power loss", "turbo", "carburettor", "कार्बोरेटर", "fuel injection",
      "spark plug", "स्पार्क प्लग", "valve", "वाल्व", "piston", "पिस्टन",
      "cylinder head", "सिलेंडर हेड", "gasket", "गैस्केट",
      "चल नहीं", "चलता नहीं", "काम नहीं", "चली नहीं", "ले नहीं", "बढ़ नहीं",
      "नहीं चल", "नहीं काम", "नहीं आगे", "नहीं बढ़"
    ],
    priority: 10,
    subTitles: {
      "Engine Won't Start": ["start", "शुरू", "स्टार्ट", "चालू", "chalu", "crank", "चल नहीं", "काम नहीं"],
      "Engine Smoking": ["smoke", "धुआ", "dhuan", "black smoke", "काला धुआ", "white smoke", "सफेद धुआ"],
      "Engine Overheating": ["overheat", "गर्म", "गरम", "hot", "ताप", "temperature"],
      "Abnormal Engine Noise": ["noise", "आवाज", "sound", "खड़खड़", "khad khad", "knocking"],
      "Engine Power Loss": ["power loss", "slow", "धीमा", "weak", "कमजोर", "laggy"],
      "Oil Leakage from Engine": ["oil leak", "तेल लीक", "लीकेज", "leakage", "leak"],
      "Fuel Consumption High": ["fuel consumption", "पेट्रोल ज्यादा", "mileage", "consumption"],
      "Coolant Leakage": ["coolant", "कूलेंट", "radiator", "रेडिएटर"],
      "Engine Seal Leak": ["seal leak", "सील", "seal problem"],
      "Starting Trouble": ["starting", "start trouble", "trouble start"],
      "Other Engine Issue": ["other", "अन्य"]
    }
  },

  "AC System": {
    keywords: [
      "ac", "a.c", "air conditioner", "एसी", "ए सी", "एयर कंडीशनर", "कूलिंग",
      "cooling", "ठंडा", "cold", "ठंड", "chilling", "clutter", "compressor",
      "कंप्रेसर", "refrigerant", "रेफ्रिजरेंट", "evaporator", "condenser", "कंडेनसर",
      "blower motor", "ब्लोअर", "fan not", "पंखा", "temp", "temperature", "thermostat"
    ],
    priority: 10,
    subTitles: {
      "AC Not Cooling": ["not cool", "ठंडा नहीं", "no cooling", "कूलिंग नहीं", "weak cool", "कमजोर"],
      "AC Not Working At All": ["not working", "बिल्कुल काम नहीं", "totally dead", "completely off"],
      "AC Blower Not Working": ["blower", "ब्लोअर", "fan", "पंखा", "no air"],
      "AC Leaking Water": ["leak", "water leak", "पानी टपकना", "dripping"],
      "AC Making Noise": ["noise", "sound", "आवाज", "grinding", "squealing"],
      "AC Compressor Issue": ["compressor", "कंप्रेसर", "compressor not"],
      "Refrigerant Low": ["refrigerant", "gas", "गैस"],
      "Other AC Issue": ["other", "अन्य"]
    }
  },

  "Electrical System": {
    keywords: [
      "electrical", "electric", "बिजली", "लाइट", "light", "battery", "बैटरी",
      "alternator", "आल्टरनेटर", "starter", "स्टार्टर", "switch", "स्विच",
      "relay", "रिले", "wiring", "तार", "wire", "error code", "एरर कोड",
      "फ्यूल गेज", "fuel gauge", "घंटा मीटर", "hour meter", "वाइपर", "wiper",
      "dashboard", "डैशबोर्ड", "indicator", "इंडिकेटर", "fuse", "फ्यूज"
    ],
    priority: 8,
    subTitles: {
      "Battery Dead": ["battery dead", "बैटरी डेड", "battery low", "चार्ज नहीं"],
      "Alternator Not Working": ["alternator", "आल्टरनेटर", "no charging"],
      "Starter Motor Problem": ["starter", "स्टार्टर", "starter not working"],
      "Light Issues": ["light", "लाइट", "लाईट", "headlight", "हेडलाइट"],
      "Wiper Not Working": ["wiper", "वाइपर", "wiper motor"],
      "Error Code in Display": ["error code", "एरर कोड", "error"],
      "Switch Fault": ["switch", "स्विच", "switch problem"],
      "Wiring Problem": ["wiring", "तार", "wire problem", "short circuit"],
      "Fuel Gauge Not Showing": ["gauge", "गेज", "fuel gauge"],
      "Hour Meter Not Working": ["hour meter", "आवर मीटर"],
      "Relay Fault": ["relay", "रिले"],
      "Other Electrical Issue": ["other", "अन्य"]
    }
  },

  "Hydraulic System": {
    keywords: [
      "hydraulic", "हाइड्रोलिक", "pressure", "दबाव", "प्रेशर", "pump", "पंप",
      "valve", "वाल्व", "seal leak", "सील", "performance", "oil cooler", "कूलर",
      "motion cable", "hose", "होज़", "cylinder", "सिलिंडर", "ram", "रैम",
      "swing", "स्विंग", "bucket", "बकेट", "boom", "बूम", "slow", "धीमा",
      "weak pressure", "कम दबाव"
    ],
    priority: 8,
    subTitles: {
      "Low Hydraulic Pressure": ["low pressure", "कम दबाव", "weak pressure", "दबाव कम"],
      "Hydraulic Pump Leak": ["pump leak", "पंप लीक", "pump leakage"],
      "Hydraulic Hose Leak": ["hose leak", "होज़ लीक", "hose leakage"],
      "Control Valve Leakage": ["valve leak", "वाल्व लीक", "valve leakage"],
      "Cylinder Seal Leak": ["cylinder leak", "सिलिंडर लीक", "ram leak", "रैम लीक"],
      "Machine Performance Low": ["performance low", "slow", "धीमा", "weak performance"],
      "Oil Cooler Leak": ["oil cooler", "कूलर लीक", "cooler leak"],
      "Swing Motor Issue": ["swing motor", "स्विंग मोटर", "swing problem"],
      "Abnormal Hydraulic Noise": ["noise", "आवाज", "sound"],
      "Other Hydraulic Issue": ["other", "अन्य"]
    }
  },

  "Transmission & Axle": {
    keywords: [
      "transmission", "ट्रांसमिशन", "ट्रान्समिशन", "gear", "गियर", "गीयर",
      "axle", "एक्सल", "brake", "ब्रेक", "oil leak", "तेल लीक", "overheat",
      "gear box", "गियरबॉक्स", "reverse", "रिवर्स", "forward", "फॉरवर्ड",
      "clutch", "क्लच", "diff", "डिफरेंशियल", "differential", "neutral", "न्यूट्रल"
    ],
    priority: 7,
    subTitles: {
      "Transmission Oil Leak": ["oil leak", "तेल लीक", "leakage", "लीकेज"],
      "Gear Hard to Shift": ["gear hard", "गियर सख्त", "hard shift", "shift problem"],
      "Brake Problem": ["brake", "ब्रेक", "brake not working", "ब्रेक काम नहीं"],
      "Transmission Noise": ["noise", "आवाज", "sound", "grinding"],
      "Reverse Not Working": ["reverse", "रिवर्स", "reverse problem"],
      "Forward Not Working": ["forward", "फॉरवर्ड", "forward problem"],
      "Transmission Overheating": ["overheat", "गर्मी", "hot", "ताप"],
      "Clutch Issue": ["clutch", "क्लच", "clutch problem"],
      "Other Transmission Issue": ["other", "अन्य"]
    }
  },

  "Body & Cabin": {
    keywords: [
      "body", "बॉडी", "बाडी", "cabin", "कैबिन", "कैबीन", "cab", "door",
      "दरवाजा", "glass", "शीशा", "ग्लास", "window", "खिड़की", "seat", "सीट",
      "roof", "छत", "bonnet", "बोनेट", "panel", "पैनल", "paint", "पेंट",
      "rust", "जंग", "crack", "क्रैक", "dent", "dor", "दोर", "fan", "पंखा"
    ],
    priority: 5,
    subTitles: {
      "Cabin Door Problem": ["door", "दरवाजा", "door not closing", "door lock"],
      "Window/Glass Cracked": ["glass", "शीशा", "ग्लास", "window", "खिड़की", "crack"],
      "Cabin Seat Problem": ["seat", "सीट", "seat damage", "seat broken"],
      "Roof Cracked": ["roof", "छत", "roof damage"],
      "Bonnet Problem": ["bonnet", "बोनेट", "bonnet crack"],
      "Body Panel Damage": ["panel", "पैनल", "damage", "dent", "dor"],
      "Paint Issues": ["paint", "पेंट", "color", "colour", "रंग"],
      "Rust/Corrosion": ["rust", "जंग", "corrosion", "oxidation"],
      "Cabin Fan Not Working": ["fan", "पंखा", "blower", "ब्लोअर"],
      "Water Leakage": ["leak", "लीक", "leakage", "water"],
      "Other Body Issue": ["other", "अन्य"]
    }
  },

  "Undercarriage & Tracks": {
    keywords: [
      "under carriage", "अंडर कैरिएज", "idler", "आइडलर", "roller", "रोलर",
      "sprocket", "स्प्रोकेट", "track", "ट्रैक", "shoe", "शू", "gear", "गियर",
      "ring gear", "रिंग गियर", "bent", "मुड़ा", "wear", "खिसकना", "track motor"
    ],
    priority: 5,
    subTitles: {
      "Track Shoe Bent": ["track shoe", "ट्रैक शू", "shoe bent", "शू मुड़ा"],
      "Idler Wheel Leaking": ["idler leak", "आइडलर लीक", "idler leakage"],
      "Idler Wheel Noise": ["idler noise", "आइडलर आवाज", "idler sound"],
      "Roller Bent": ["roller bent", "रोलर मुड़ा", "roller damage"],
      "Roller Leakage": ["roller leak", "रोलर लीक", "roller leakage"],
      "Ring Gear Cracked": ["ring gear", "रिंग गियर", "ring gear crack"],
      "Sprocket Wear": ["sprocket", "स्प्रोकेट", "sprocket wear", "tooth"],
      "Track Motor Leak": ["track motor", "ट्रैक मोटर", "motor leak"],
      "Other Undercarriage Issue": ["other", "अन्य"]
    }
  },

  "Fabrication Parts": {
    keywords: [
      "fabrication", "फैब्रिकेशन", "फैबिकेशन", "boom", "बूम", "bucket", "बकेट",
      "chassis", "चेसिस", "चेसी", "dipper", "डिपर", "डिप्पर", "crack", "क्रैक",
      "leak", "लीक", "लीकेज", "fuel tank", "फ्यूल टैंक", "hydraulic tank", "हाइड्रोलिक टैंक",
      "king post", "किंग पोस्ट", "loader arm", "लोडर आर्म", "pin", "पिन",
      "teeth", "दांत", "टूथ", "weld", "वेल्ड", "break", "टूट"
    ],
    priority: 6,
    subTitles: {
      "Boom Cracked": ["boom crack", "बूम क्रैक", "boom problem"],
      "Bucket Cracked": ["bucket crack", "बकेट क्रैक", "bucket damage"],
      "Bucket Teeth Broken": ["teeth broken", "दांत टूट", "tooth damage"],
      "Chassis Cracked": ["chassis crack", "चेसिस क्रैक", "chassis damage"],
      "Dipper Cracked": ["dipper crack", "डिपर क्रैक"],
      "Fuel Tank Leakage": ["fuel tank leak", "फ्यूल टैंक लीक", "tank leak"],
      "Hydraulic Tank Leakage": ["hydraulic tank leak", "हाइड्रोलिक टैंक लीक"],
      "King Post Problem": ["king post", "किंग पोस्ट", "post problem"],
      "Loader Arm Problem": ["loader arm", "लोडर आर्म", "arm problem"],
      "Pin Broken": ["pin broken", "पिन टूट", "pin issue"],
      "Welding Issue": ["weld", "वेल्ड", "welding"],
      "Other Fabrication Issue": ["other", "अन्य"]
    }
  },

  "Hose & Pipes": {
    keywords: [
      "hose", "होज़", "होज", "पाइप", "pipe", "ट्यूब", "tube", "o ring",
      "ओ रिंग", "coupling", "कपलिंग", "connector", "कनेक्टर", "leak", "लीक",
      "लीकेज", "cut", "कटा", "burst", "फूला", "pinhole", "पिन होल"
    ],
    priority: 4,
    subTitles: {
      "Hose Leakage": ["hose leak", "होज़ लीक", "hose leakage", "लीकेज"],
      "Hose Cut": ["hose cut", "होज़ कटा", "cut hose"],
      "O Ring Cut": ["o ring", "ओ रिंग", "o ring cut", "ring problem"],
      "Pipe Burst": ["burst", "फूला", "pipe burst"],
      "Coupling Leak": ["coupling", "कपलिंग", "coupling leak"],
      "Connector Problem": ["connector", "कनेक्टर", "connection"],
      "Pinhole Leak": ["pinhole", "पिन होल", "small leak"],
      "Other Hose Issue": ["other", "अन्य"]
    }
  },

  "Tyre & Battery": {
    keywords: [
      "tyre", "tire", "टायर", "battery", "बैटरी", "बैट्री", "tube", "ट्यूब",
      "puncture", "पंक्चर", "पंचर", "burst", "फूला", "cut", "कटा", "flat",
      "पंचर", "deflate", "charge", "चार्ज", "discharge", "टर्मिनल", "terminal"
    ],
    priority: 7,
    subTitles: {
      "Tyre Puncture": ["puncture", "पंक्चर", "पंचर"],
      "Tyre Cut": ["cut", "कटा", "cut tyre", "टायर कटा"],
      "Tyre Burst": ["burst", "फूला", "tyre burst", "tyre pressure"],
      "Tube Joint Opened": ["tube", "ट्यूब", "tube joint", "जोड़"],
      "Tyre Rubber Breaking": ["rubber", "रबर", "rubber broken", "wear"],
      "Battery Dead": ["battery dead", "बैटरी डेड", "battery low"],
      "Battery Not Charging": ["not charging", "चार्ज नहीं", "charging issue"],
      "Terminal Corrosion": ["terminal", "टर्मिनल", "corrosion", "जंग"],
      "Other Tyre/Battery Issue": ["other", "अन्य"]
    }
  },

  "Ram & Cylinder": {
    keywords: [
      "ram", "रैम", "cylinder", "सिलिंडर", "सिलेंडर", "सिलिन्डर", "seal leak",
      "सील", "rod", "रॉड", "रॉड्स", "weld", "वेल्ड", "bend", "मुड़ा",
      "broke", "टूट", "dent", "dor", "खरोंच", "piston", "पिस्टन"
    ],
    priority: 6,
    subTitles: {
      "Boom Ram Seal Leak": ["boom ram", "बूम रैम", "boom seal"],
      "Bucket Ram Seal Leak": ["bucket ram", "बकेट रैम", "bucket seal"],
      "Dipper Ram Seal Leak": ["dipper ram", "डिपर रैम", "dipper seal"],
      "Slew Ram Seal Leak": ["slew ram", "स्लू रैम", "slew seal"],
      "Ram Leak": ["ram leak", "रैम लीक", "ram leakage"],
      "Rod Bent": ["rod bent", "रॉड मुड़ा", "bent rod"],
      "Rod Broken": ["rod broken", "रॉड टूट", "broken rod"],
      "Cylinder Welding Leak": ["cylinder weld", "सिलिंडर वेल्ड", "weld leak"],
      "Piston Problem": ["piston", "पिस्टन", "piston issue"],
      "Other Ram/Cylinder Issue": ["other", "अन्य"]
    }
  },

  "Service & Maintenance": {
    keywords: [
      "service", "सर्विस", "servicing", "सर्विसिंग", "maintenance", "मेंटेनेंस",
      "रखरखाव", "मेंटेनेन्स", "checkup", "चेकअप", "visit", "विजिट",
      "inspection", "इंस्पेक्शन", "pdi", "पीडीआई", "pre delivery"
    ],
    priority: 3,
    subTitles: {
      "Routine Service": ["service", "सर्विस", "routine", "regular"],
      "Maintenance Visit": ["maintenance", "मेंटेनेंस", "checkup", "चेकअप"],
      "PDI": ["pdi", "पीडीआई", "pre delivery"],
      "Installation": ["installation", "इंस्टॉलेशन", "install"],
      "Other Service": ["other", "अन्य"]
    }
  },

  "ECU & Sensors": {
    keywords: [
      "ecu", "ईसीयू", "ई सी यू", "sensor", "सेंसर", "error code", "एरर कोड",
      "diagnostic", "डायग्नॉस्टिक", "scanner", "स्कैनर", "malfunction",
      "problem code", "कोड", "signal", "सिग्नल"
    ],
    priority: 6,
    subTitles: {
      "ECU Problem": ["ecu", "ईसीयू", "ecu issue"],
      "Sensor Malfunction": ["sensor", "सेंसर", "sensor problem"],
      "Error Code": ["error code", "एरर कोड", "error", "कोड"],
      "Diagnostic Issue": ["diagnostic", "डायग्नॉस्टिक"],
      "Other ECU/Sensor Issue": ["other", "अन्य"]
    }
  },

  "Attachment Parts": {
    keywords: [
      "attachment", "अटैचमेंट", "quick coupler", "क्विक कपलर", "cutting edge",
      "कटिंग एज", "ripper", "रिपर", "grapple", "ग्रैपल", "magnet", "मैग्नेट",
      "fork", "फोर्क", "breaker", "ब्रेकर", "hammer", "हैमर", "bucket teeth"
    ],
    priority: 8,
    subTitles: {
      "Quick Coupler Leak": ["quick coupler", "क्विक कपलर", "coupler leak"],
      "Cutting Edge Worn": ["cutting edge", "कटिंग एज", "edge wear"],
      "Ripper Tip Broken": ["ripper", "रिपर", "ripper tip", "tip broken"],
      "Grapple Jaw Broken": ["grapple", "ग्रैपल", "grapple jaw", "jaw broken"],
      "Magnet Not Working": ["magnet", "मैग्नेट", "magnet problem"],
      "Fork Bent": ["fork", "फोर्क", "fork bent"],
      "Breaker Pin Loose": ["breaker", "ब्रेकर", "breaker pin"],
      "Hammer Problem": ["hammer", "हैमर", "hammer issue"],
      "Other Attachment Issue": ["other", "अन्य"]
    }
  },

  "General Visit": {
    keywords: [
      "visit", "विजिट", "check", "चेक", "inspection", "इंस्पेक्शन", "look",
      "देख", "लुक", "visit site", "site visit", "साइट विजिट", "general",
      "सामान्य", "follow up", "फॉलो अप", "customer visit"
    ],
    priority: 2,
    subTitles: {
      "Site Inspection": ["inspection", "इंस्पेक्शन", "site check"],
      "Follow-up Visit": ["follow up", "फॉलो अप", "follow-up"],
      "Preventive Check": ["preventive", "प्रिवेंटिव", "check"],
      "Warranty Check": ["warranty", "वारंटी", "warranty check"],
      "Other Visit": ["other", "अन्य"]
    }
  },

  "Campaign & Recall": {
    keywords: [
      "campaign", "कैंपेन", "कैम्पेन", "recall", "रिकॉल", "service bulletin",
      "सर्विस बुलेटिन", "update", "अपडेट", "software", "सॉफ्टवेयर",
      "modification", "मॉडिफिकेशन", "rework", "रीवर्क", "improvement"
    ],
    priority: 5,
    subTitles: {
      "Recall Campaign": ["recall", "रिकॉल", "campaign recall"],
      "Service Bulletin": ["service bulletin", "सर्विस बुलेटिन"],
      "Software Update": ["software", "सॉफ्टवेयर", "update", "अपडेट"],
      "Part Modification": ["modification", "मॉडिफिकेशन", "modify"],
      "Rework Campaign": ["rework", "रीवर्क", "rework campaign"],
      "Other Campaign": ["other", "अन्य"]
    }
  },

  "Livelink Update": {
    keywords: [
      "livelink", "लाइवलिंक", "update", "अपडेट", "communication", "कम्युनिकेशन",
      "notification", "नोटिफिकेशन", "message", "मैसेज", "information", "जानकारी",
      "alert", "अलर्ट", "status", "स्टेटस"
    ],
    priority: 2,
    subTitles: {
      "System Update": ["update", "अपडेट", "system update"],
      "Status Notification": ["status", "स्टेटस", "notification"],
      "Information Request": ["information", "जानकारी", "request"],
      "Alert Communication": ["alert", "अलर्ट", "alert communication"],
      "Other Livelink": ["other", "अन्य"]
    }
  },

  "General Problem": {
    keywords: [
      "problem", "समस्या", "issue", "समस्या", "something", "कुछ", "aur",
      "अन्य", "other", "कोई और", "fault", "खराबी", "defect", "दोष",
      "na", "एन ए", "not available", "न्यू", "unknown", "अनजान"
    ],
    priority: 1,
    subTitles: {
      "General Issue": ["general", "समस्या"],
      "Not Applicable": ["na", "एन ए", "not applicable", "n/a"],
      "Unknown Problem": ["unknown", "अनजान", "not sure"],
      "Other": ["other", "अन्य"]
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
  'karoli': { branch: "JAIPUR", outlet: "KARAULI", cityCode: "4" },
  'करोली': { branch: "JAIPUR", outlet: "KARAULI", cityCode: "4" },
  'KAROLI': { branch: "JAIPUR", outlet: "KARAULI", cityCode: "4" },
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

/* ======================= HELPER FUNCTIONS ======================= */

function phoneToSpokenDigits(phone) {
  if (!phone) return "";
  const digitMap = {
    '0': 'zero', '1': 'ek', '2': 'do', '3': 'teen', '4': 'char',
    '5': 'paanch', '6': 'chhe', '7': 'saat', '8': 'aath', '9': 'nau'
  };
  return phone.split('').map(d => digitMap[d] || d).join(', ');
}

function digitsToHindi(digits) {
  const hindiDigits = {
    '0': 'शून्य', '1': 'एक', '2': 'दो', '3': 'तीन', '4': 'चार',
    '5': 'पाँच', '6': 'छह', '7': 'सात', '8': 'आठ', '9': 'नौ'
  };
  return digits.split('').map(d => hindiDigits[d] || d).join(' ');
}

function cleanSpeech(text) {
  if (!text) return "";
  return text.toLowerCase().replace(/[।.,!?]/g, "").replace(/\s+/g, " ").trim();
}

function safeAscii(text) {
  if (!text) return "Unknown";
  return text.replace(/[^\w\s-]/g, '').trim() || "Unknown";
}

function validateVoiceInput(text, expectedType = 'general') {
  return {
    isValid: !rejectInvalid(text, expectedType),
    reason: getInvalidityReason(text, expectedType)
  };
}

function getInvalidityReason(text, expectedType) {
  if (!text) return 'empty';
  if (text.trim().length < 2) return 'too_short';
  if (isUncertain(text)) return 'uncertain';
  if (isNoise(text)) return 'noise';
  if (isRepeatRequest(text)) return 'repeat_request';
  if (isPauseRequest(text)) return 'pause_request';
  return null;
}

function rejectInvalid(text, expectedType = 'general') {
  if (!text) return true;
  if (text.trim().length < 2) return true;
  if (isUncertain(text)) return true;
  if (isNoise(text)) return true;
  if (isRepeatRequest(text)) return true;
  if (isPauseRequest(text)) return true;
  return false;
}

function isNoise(text) {
  if (!text) return false;
  const noisePatterns = [
    /^(hmmm|hmm|uh|um|ah|eh|oh|uh huh|hmph|shh|shhh|tsk|grunt|cough|laugh)$/i,
    /^(background|noise|echo|static|pause|silence)$/i,
    /^[aeiouअईउएओ]+$/i,
    /^\s+$/
  ];
  return noisePatterns.some(pattern => pattern.test(text.trim()));
}

function isRepeatRequest(text) {
  if (!text) return false;
  const repeatKeywords = ['repeat', 'dobara', 'दोबारा', 'फिर से', 'फिर', 'दुबारा', 'again', 'kya kaha', 'क्या कहा'];
  return repeatKeywords.some(keyword => text.toLowerCase().includes(keyword.toLowerCase()));
}

function isPauseRequest(text) {
  if (!text) return false;
  const pauseKeywords = ['ruko', 'रुको', 'रुक', 'wait', 'thoda', 'minute', 'hold', 'i mean', 'मतलब', 'means'];
  return pauseKeywords.some(keyword => text.toLowerCase().includes(keyword.toLowerCase()));
}

function getRetryMessage(reason, step) {
  const messages = {
    empty: "माफ करिए, कुछ सुना नहीं। कृपया स्पष्ट आवाज में उत्तर दीजिए।",
    too_short: "कृपया थोड़ा विस्तार से बोलिए। पूरा उत्तर दीजिए।",
    uncertain: "आप निश्चित नहीं लग रहे। कृपया स्पष्ट जवाब दीजिए।",
    noise: "बैकग्राउंड में शोर है। कृपया शांत जगह से दोबारा बोलिए।",
    repeat_request: "सवाल दोबारा सुनने के लिए तारे को दबाइए।",
    pause_request: "जी, मैं यहीं हूँ। कृपया अपना उत्तर दीजिए।"
  };
  return messages[reason] || "कृपया दोबारा उत्तर दीजिए।";
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
  return affirmativeKeywords.some(keyword =>
    textLower.includes(keyword.toLowerCase())
  );
}

function isNegative(text) {
  if (!text) return false;
  const textLower = text.toLowerCase().trim();
  return negativeKeywords.some(keyword =>
    textLower.includes(keyword.toLowerCase())
  );
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

function formatTimeToTwelveHour(timeString) {
  if (!timeString) return "";
  if (/\d{1,2}:\d{2}\s*(AM|PM)/.test(timeString)) return timeString;
  const match = timeString.match(/(\d{1,2}):?(\d{2})?/);
  if (!match) return timeString;
  let hour = parseInt(match[1]);
  const minute = match[2] || '00';
  const isPM = hour > 12 || /pm|evening|shaam|duphare/.test(timeString.toLowerCase());
  if (isPM && hour <= 12) hour = hour === 12 ? 12 : hour + 12;
  const displayHour = hour > 12 ? hour - 12 : (hour === 0 ? 12 : hour);
  const period = hour >= 12 ? 'PM' : 'AM';
  return `${String(displayHour).padStart(2, '0')}:${minute} ${period}`;
}

function isValidDayOfMonth(day, month, year) {
  const daysInMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const isLeapYear = (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
  if (isLeapYear && month === 2) return day >= 1 && day <= 29;
  return day >= 1 && day <= daysInMonth[month - 1];
}

function extractServiceDate(text) {
  if (!text) return null;
  const cleaned = text.toLowerCase();
  const today = new Date();
  // Normalize today to start of day (midnight) for proper comparison
  const todayAtMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  if (/\baaj\b|\btoday\b|\bआज\b/i.test(cleaned)) return todayAtMidnight;

  if (/\bkal\b|\btomorrow\b|\bकल\b/i.test(cleaned)) {
    const tomorrow = new Date(todayAtMidnight);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow;
  }

  if (/\bparso\b|\bपरसों\b|\bपरसो\b/i.test(cleaned)) {
    const dayAfter = new Date(todayAtMidnight);
    dayAfter.setDate(dayAfter.getDate() + 2);
    return dayAfter;
  }

  const months = {
    'january': 1, 'jan': 1, 'जनवरी': 1,
    'february': 2, 'feb': 2, 'फरवरी': 2,
    'march': 3, 'mar': 3, 'मार्च': 3,
    'april': 4, 'apr': 4, 'अप्रैल': 4,
    'may': 5, 'मई': 5,
    'june': 6, 'jun': 6, 'जून': 6,
    'july': 7, 'jul': 7, 'जुलाई': 7,
    'august': 8, 'aug': 8, 'अगस्त': 8,
    'september': 9, 'sep': 9, 'सितंबर': 9,
    'october': 10, 'oct': 10, 'अक्टूबर': 10,
    'november': 11, 'nov': 11, 'नवंबर': 11,
    'december': 12, 'dec': 12, 'दिसंबर': 12
  };

  const dateMatch1 = cleaned.match(/(\d{1,2})[\/\-](\d{1,2})/);
  if (dateMatch1) {
    const day = parseInt(dateMatch1[1]);
    const month = parseInt(dateMatch1[2]);
    if (month >= 1 && month <= 12 && isValidDayOfMonth(day, month, today.getFullYear())) {
      const date = new Date(today.getFullYear(), month - 1, day);
      if (date >= todayAtMidnight) return date;
      date.setFullYear(today.getFullYear() + 1);
      return date;
    }
  }

  const dateMatch2 = cleaned.match(/(\d{1,2})\s+(january|jan|february|feb|march|mar|april|apr|may|june|jun|july|jul|august|aug|september|sep|october|oct|november|nov|december|dec|जनवरी|फरवरी|मार्च|अप्रैल|मई|जून|जुलाई|अगस्त|सितंबर|अक्टूबर|नवंबर|दिसंबर)/i);
  if (dateMatch2) {
    const day = parseInt(dateMatch2[1]);
    const monthName = dateMatch2[2].toLowerCase();
    const month = months[monthName];
    if (month && isValidDayOfMonth(day, month, today.getFullYear())) {
      const date = new Date(today.getFullYear(), month - 1, day);
      if (date >= todayAtMidnight) return date;
      date.setFullYear(today.getFullYear() + 1);
      return date;
    }
  }

  return null;
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

  return { complaint: bestMatch, score: highestScore };
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

/**
 * Get smart follow-up questions based on problem description
 * Asks about specific symptoms to better understand the issue
 */
/**
 * CATEGORY-SPECIFIC DIAGNOSTIC QUESTIONS
 * Each complaint category has progressive questions to narrow down the exact issue
 */
const categoryDiagnostics = {
  "Engine": {
    q1: "क्या मशीन बिल्कुल चल नहीं रही है या चलती तो है लेकिन आगे नहीं बढ़ रही?",
    q2_no_start: "क्या स्टार्टर घूमता है? या आवाज़ ही नहीं आती?",
    q2_low_power: "क्या पावर कम है या धीरे-धीरे काम कर रहा है? और धुआ आ रहा है?",
    q3_starter: "क्या बैटरी तो ठीक है? और क्लिक-क्लिक आवाज़ आती है?",
    q3_power: "क्या यह समस्या ठंड में या गर्मी में ज़्यादा होती है?",
    subComplaintMap: {
      "no_start_no_crank": "Engine Won't Start",
      "no_start_some_crank": "Starting Trouble",
      "low_power": "Engine Power Loss",
      "smoking": "Engine Smoking",
      "overheating": "Engine Overheating",
      "noise": "Abnormal Engine Noise",
      "oil_leak": "Oil Leakage from Engine"
    }
  },
  
  "AC System": {
    q1: "क्या एसी बिल्कुल ठंडा नहीं कर रहा है? या कमजोर ठंडा कर रहा है?",
    q2_no_cooling: "एसी काम तो कर रहा है? या एसी चल ही नहीं रहा?",
    q2_weak_cooling: "क्या पहले अच्छा ठंडा करता था? और अब धीरे-धीरे कमजोर हो गया?",
    q3_blower: "क्या ब्लोअर तो चल रहा है? या हवा ही नहीं आ रही?",
    q3_leak: "क्या एसी से पानी टपक रहा है?",
    subComplaintMap: {
      "not_cool_works": "AC Not Cooling",
      "not_working": "AC Not Working At All",
      "weak_cool": "AC Not Cooling",
      "compressor_issue": "AC Compressor Issue",
      "blower_issue": "AC Blower Not Working",
      "leak": "AC Leaking Water",
      "noise": "AC Making Noise"
    }
  },
  
  "Electrical System": {
    q1: "क्या लाइट काम नहीं कर रही? बैटरी समस्या है? या और कोई इलेक्ट्रिकल समस्या?",
    q2_battery: "क्या बैटरी में पावर ही नहीं है? या चार्ज नहीं हो रहा?",
    q2_starter: "क्या स्टार्टर बिल्कुल नहीं घूमता? या घूमता है लेकिन मशीन नहीं चलती?",
    q2_light: "क्या सब लाइट बंद हैं? या सिर्फ कुछ लाइट काम नहीं कर रही?",
    q3_charging: "क्या अल्टरनेटर से चार्ज प्राप्त हो रहा है? या बैटरी टर्मिनल खराब है?",
    q3_error: "क्या डैशबोर्ड पर कोई एरर कोड दिखा?",
    subComplaintMap: {
      "battery_dead": "Battery Dead",
      "battery_not_charging": "Battery Not Charging",
      "alternator_fail": "Alternator Not Working",
      "starter_problem": "Starter Motor Problem",
      "light_fail": "Light Issues",
      "error_code": "Error Code in Display",
      "wiper_fail": "Wiper Not Working"
    }
  },
  
  "Hydraulic System": {
    q1: "क्या हाइड्रोलिक सिस्टम से दबाव नहीं आ रहा? लीक हो रहा है? या मशीन धीमा काम कर रहा?",
    q2_pressure: "क्या पंप से पावर नहीं आ रहा? या वाल्व में समस्या है?",
    q2_leak: "क्या होज़ से लीक हो रहा है? या सिलिंडर/रैम से?",
    q2_performance: "क्या बूम नहीं उठ रहा? बकेट नहीं हिल रहा? या पूरी मशीन धीमी है?",
    q3_location: "लीक कहाँ कहाँ से हो रहा है? इंजन के पास? हाइड्रोलिक टैंक के पास?",
    q3_volume: "लीक कितना है - बस बूंदें? या लगातार तेल बह रहा है?",
    subComplaintMap: {
      "low_pressure": "Low Hydraulic Pressure",
      "pump_leak": "Hydraulic Pump Leak",
      "hose_leak": "Hydraulic Hose Leak",
      "valve_leak": "Control Valve Leakage",
      "cylinder_leak": "Cylinder Seal Leak",
      "performance_low": "Machine Performance Low",
      "oil_cooler_leak": "Oil Cooler Leak"
    }
  },
  
  "Transmission & Axle": {
    q1: "क्या तेल लीक हो रहा है? ब्रेक काम नहीं कर रहा? या गियर शिफ्ट नहीं हो रहा है?",
    q2_leak: "किस जगह से लीक हो रहा है? ट्रांसमिशन के नीचे? या ब्रेक ड्रम के पास?",
    q2_brake: "क्या ब्रेक बिल्कुल काम नहीं कर रहा? या धीमा काम कर रहा है?",
    q2_gear: "कौन सा गियर समस्या दे रहा है? रिवर्स? फॉरवर्ड? या सभी?",
    q3: "क्या यह समस्या मशीन चलते समय होती है? या बंद होने पर भी दिखता है?",
    subComplaintMap: {
      "oil_leak": "Transmission Oil Leak",
      "gear_hard": "Gear Hard to Shift",
      "brake_problem": "Brake Problem",
      "noise": "Transmission Noise",
      "reverse_fail": "Reverse Not Working",
      "forward_fail": "Forward Not Working",
      "overheat": "Transmission Overheating"
    }
  },
  
  "Body & Cabin": {
    q1: "क्या दरवाजा ठीक से बंद नहीं हो रहा? शीशा टूट गया? सीट खराब है? या छत में नुक्सान है?",
    q2: "नुक्सान कितना बड़ा है? क्या सिर्फ पेंट खराब है? या पैनल ही टूट गया?",
    q3: "क्या अंदर पानी आ रहा है? या सिर्फ बाहरी नुक्सान है?",
    subComplaintMap: {
      "door_problem": "Cabin Door Problem",
      "glass_crack": "Window/Glass Cracked",
      "seat_problem": "Cabin Seat Problem",
      "roof_crack": "Roof Cracked",
      "panel_damage": "Body Panel Damage",
      "paint_issue": "Paint Issues",
      "rust": "Rust/Corrosion",
      "water_leak": "Water Leakage"
    }
  },
  
  "Tyre & Battery": {
    q1: "क्या टायर पंक्चर हुआ है? फूल गया है? या बैटरी की समस्या है?",
    q2_tyre: "कितने टायर खराब हैं? एक? दो? या सब?",
    q2_battery: "क्या बैटरी बिल्कुल डेड है? या कुछ पावर बाकी है?",
    q3_tyre: "क्या टायर को मरम्मत किया जा सकता है? या बदलना पड़ेगा?",
    q3_battery: "क्या बैटरी चार्ज करने से काम आएगा? या बदलनी पड़ेगी?",
    subComplaintMap: {
      "puncture": "Tyre Puncture",
      "cut": "Tyre Cut",
      "burst": "Tyre Burst",
      "tube_joint": "Tube Joint Opened",
      "battery_dead": "Battery Dead",
      "battery_low": "Battery Not Charging",
      "terminal_corrosion": "Terminal Corrosion"
    }
  },
  
  "General Problem": {
    q1: "मशीन में ठीक-ठीक क्या समस्या है? विस्तार से बताइए।",
    q2: "यह समस्या कब से है? कितनी गंभीर है?",
    q3: "क्या पहले भी यह समस्या आई है?",
    subComplaintMap: {
      "general": "General Issue"
    }
  }
};

function getFollowUpQuestion(problemDescription, questionNumber = 1, complaintCategory = null) {
  const text = problemDescription.toLowerCase();
  
  // Try to detect category if not provided
  if (!complaintCategory) {
    const detected = detectComplaint(problemDescription);
    complaintCategory = detected.complaint || "General Problem";
  }
  
  const categoryQuestions = categoryDiagnostics[complaintCategory];
  
  if (!categoryQuestions) {
    return `क्या यह समस्या अभी भी है? आगे बढ़ते हैं।`;
  }
  
  // Serve questions based on question number
  if (questionNumber === 1) {
    return categoryQuestions.q1;
  } else if (questionNumber === 2) {
    // Determine which Q2 to ask based on previous answer
    if (text.includes('नहीं') || text.includes('नही') || text.includes('नहीं चल') || text.includes('काम नहीं')) {
      return categoryQuestions.q2_no_start || categoryQuestions.q2_no_cooling || categoryQuestions.q2_leak || categoryQuestions.q2 || "और विस्तार से बताइए।";
    } else if (text.includes('धीमा') || text.includes('कमजोर') || text.includes('कम')) {
      return categoryQuestions.q2_low_power || categoryQuestions.q2_weak_cooling || categoryQuestions.q2_performance || categoryQuestions.q2 || "और विस्तार से बताइए।";
    }
    return categoryQuestions.q2 || categoryQuestions.q1;
  } else if (questionNumber === 3) {
    return categoryQuestions.q3 || categoryQuestions.q3_charging || categoryQuestions.q3_blower || categoryQuestions.q3_location || "अन्य कोई जानकारी?";
  }
  
  return "कृपया और विस्तार से बताइए।";
}

// ===== OLD FUNCTION (kept for backward compatibility) =====
function getFollowUpQuestion_Legacy(problemDescription, questionNumber = 1) {
  const text = problemDescription.toLowerCase();
  
  // Question 1: Identify the TYPE of problem (operational, performance, leak, noise, etc.)
  if (questionNumber === 1) {
    // Check for specific keywords first
    if (/start|स्टार्ट|शुरू|चालू|chalu|चल नहीं|नहीं चल|start nahi|काम नहीं|work nahi/.test(text)) {
      return `मशीन चलती ही नहीं है? या फिर चलती तो है लेकिन आगे नहीं बढ़ रही है? साफ बताइए।`;
    }
    
    if (/smoke|धुआ|dhuan|तंबाकू|काला|सफेद|whitesmoke|black smoke/.test(text)) {
      return `इंजन से धुआ आ रहा है या पूरी मशीन से? और धुआ किस रंग का है - काला, सफेद, या नीला?`;
    }
    
    if (/noise|आवाज|sound|आवाज़|खड़खड़|khad|grinding|tapping|thud/.test(text)) {
      return `आवाज कहाँ से आ रही है? इंजन से, हाइड्रोलिक से, या ट्रांसमिशन से? और यह क्रैंक की तरह है या कोई और आवाज है?`;
    }
    
    if (/leak|लीक|लीकेज|बह|बहना|drip|dripping|oozing/.test(text)) {
      return `क्या तेल निकल रहा है? पानी? या कोई और तरल पदार्थ? और किस जगह से निकल रहा है - इंजन के नीचे, हाइड्रोलिक से, या कहीं और?`;
    }
    
    if (/slow|धीमा|weakpower|कम शक्ति|performance|कमजोर|laggy|crawl/.test(text)) {
      return `मशीन धीरे-धीरे काम कर रही है? या बिल्कुल काम नहीं कर रही? और यह हमेशा ऐसा है या कभी-कभी ठीक हो जाती है?`;
    }
    
    if (/heat|गर्म|overheat|तपना|गर्मी|बहुत गरम|burning/.test(text)) {
      return `मशीन बहुत गर्म हो रही है? या कहीं जल रहा है? और गर्मी कहाँ से आ रही है - इंजन से या कहीं और?`;
    }
    
    if (/brake|ब्रेक|backward|रिवर्स|आगे|forward|gear|गियर|clutch|क्लच/.test(text)) {
      return `ब्रेक काम नहीं कर रहा? रिवर्स नहीं जा रहा? या फिर गियर चेंज करने में समस्या है? कौन सी समस्या है?`;
    }
    
    // Default: Ask a general diagnostic question
    return `ठीक है। अब बताइए - मशीन बिल्कुल काम नहीं कर रही है? या काम तो कर रही है लेकिन कुछ गलत है उसमें?`;
  }
  
  // Question 2: Get more specific details about the problem 
  if (questionNumber === 2) {
    if (/नहीं|निकल|leaking|trickle/.test(text)) {
      return `लीक कितना है - बस कुछ बूंदें? या लगातार बह रहा है? और मशीन चल रही है या बंद है?`;
    }
    
    if (/start|स्टार्ट|cranking|क्रैंक/.test(text)) {
      return `क्या स्टार्टर घूमता है? या आवाज़ तक नहीं आती? और बैटरी तो ठीक है न?`;
    }
    
    if (/smoke|धुआ/.test(text)) {
      return `धुआ हमेशा आता है? या सिर्फ शुरुआत में? और खर्राटे की तरह आवाज़ भी आती है?`;
    }
    
    if (/आवाज|noise/.test(text)) {
      return `आवाज़ तेज़ है? या हल्की-फुल्की है? और गति के साथ ज़्यादा होती है या कम होती है?`;
    }
    
    if (/धीमा|slow|performance/.test(text)) {
      return `जब आप पूरी पावर देते हो तब भी धीमा है? और ईंधन तो सही है न?`;
    }
    
    if (/गर्म|heat/.test(text)) {
      return `तापमान गेज कितना दिखा रहा है? और कूलर से पानी निकल रहा है?`;
    }
    
    // Default for any other problem
    return `यह समस्या कितने समय से है? कुछ दिन? हफ़्ते? या महीने?`;
  }
  
  // Question 3: Ask when the problem occurs
  if (questionNumber === 3) {
    return `क्या यह समस्या तुरंत होती है? या कुछ देर चलाने के बाद? और गर्मी के मौसम में ज़्यादा होती है?`;
  }
  
  // Default fallback
  return `और कोई और समस्या भी है मशीन में? अगर हां तो बताइए।`;
}

// ===== UTILITY FUNCTION: Better diagnosis for vague complaints =====
function diagnoseVagueProblem(problemText) {
  const text = problemText.toLowerCase();
  
  // Safety filters - prevent false matches from single characters
  const patterns = [
    { keywords: ['start', 'स्टार्ट', 'शुरू', 'चालू', 'start nahi', 'chalu nahi'], category: 'Starting Issue', confidence: 8 },
    { keywords: ['smoke', 'धुआ', 'black', 'white', 'smoking'], category: 'Smoking/Burning', confidence: 8 },
    { keywords: ['noise', 'आवाज', 'sound', 'grinding', 'खड़खड़'], category: 'Abnormal Noise', confidence: 8 },
    { keywords: ['leak', 'लीक', 'लीकेज', 'drip', 'ooze'], category: 'Leakage', confidence: 8 },
    { keywords: ['slow', 'धीमा', 'weak', 'कमजोर', 'performance'], category: 'Low Performance', confidence: 8 },
    { keywords: ['heat', 'गर्म', 'overheat', 'burning'], category: 'Overheating', confidence: 8 },
    { keywords: ['brake', 'ब्रेक', 'reverse', 'रिवर्स', 'gear', 'गियर'], category: 'Transmission/Brake', confidence: 8 }
  ];
  
  for (const pattern of patterns) {
    for (const keyword of pattern.keywords) {
      if (new RegExp(`\\b${keyword}\\b`, 'i').test(text)) {
        return { category: pattern.category, confidence: pattern.confidence };
      }
    }
  }
  
  return { category: null, confidence: 0 };
}

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

    if (response.status !== 200 || !response.data || response.data.status !== 1 || !response.data.data) {
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

async function submitComplaintToExternal(complaintData) {
  const MAX_RETRIES = 3;
  const RETRY_DELAY = 2000;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      console.log("\n" + "=".repeat(120));
      console.log(`🌐 SUBMITTING COMPLAINT TO EXTERNAL API (Attempt ${attempt}/${MAX_RETRIES})`);
      console.log("=".repeat(120));
      console.log(JSON.stringify(complaintData, null, 2));
      console.log("=".repeat(120));

      const response = await axios.post(COMPLAINT_API_URL, complaintData, {
        timeout: API_TIMEOUT,
        headers: {
          "Content-Type": "application/json",
          "JCBSERVICEAPI": "MakeInJcb",
        },
        validateStatus: (status) => status < 500,
        maxRedirects: 5,
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
      });

      console.log("\n" + "=".repeat(120));
      console.log("📥 API RESPONSE:");
      console.log("=".repeat(120));
      console.log(`Status Code: ${response.status}`);
      console.log(`Response Data: ${JSON.stringify(response.data, null, 2)}`);
      console.log("=".repeat(120) + "\n");

      if (response.status !== 200 || !response.data || response.data.status !== 1) {
        console.log("⚠️ API Rejected:", response.data?.message || "Unknown error");
        return { success: false, error: response.data?.message || "API rejected" };
      }

      const sapId = response.data.data?.complaint_sap_id || response.data.data?.sap_id || null;
      console.log("✅ Complaint submitted successfully. SAP ID:", sapId);

      return { success: true, data: response.data, sapId };

    } catch (error) {
      const isRetryableError = error.code === 'ECONNRESET' || error.code === 'ENOTFOUND' || 
                               error.code === 'ETIMEDOUT' || error.code === 'EHOSTUNREACH' || 
                               error.code === 'ECONNREFUSED';

      console.error(`❌ ATTEMPT ${attempt}/${MAX_RETRIES} FAILED`);
      console.error(`Error: ${error.message}`);

      if (isRetryableError && attempt < MAX_RETRIES) {
        console.error(`⏳ Retrying in ${RETRY_DELAY}ms...`);
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
        continue;
      }

      return { success: false, error: error.message, code: error.code, attempts: attempt };
    }
  }
}

function mergeLocationAndPincode(address, pincode) {
  if (!address && !pincode) return "Not Provided";
  if (!address) return pincode;
  if (!pincode) return address;
  return `${address}, ${pincode}`;
}

async function translateHindiToEnglish(text) {
  if (!text || typeof text !== 'string') return text;
  const hindiRegex = /[\u0900-\u097F]/;
  if (!hindiRegex.test(text)) return text;

  try {
    const hindiToEnglishDict = {
      'नमस्ते': 'Hello', 'धन्यवाद': 'Thank You', 'कृपया': 'Please', 'मेरा': 'My',
      'नाम': 'Name', 'मशीन': 'Machine', 'खराब': 'Broken', 'समस्या': 'Problem',
      'काम': 'Work', 'नहीं': 'Not', 'हाँ': 'Yes', 'हां': 'Yes', 'घर': 'Home',
      'दुकान': 'Shop', 'गैरेज': 'Garage', 'सेवा': 'Service', 'मरम्मत': 'Repair',
      'इंजन': 'Engine', 'ब्रेक': 'Brake', 'टायर': 'Tire', 'बैटरी': 'Battery',
      'चल': 'Run', 'चल रही': 'Running', 'चल नहीं': 'Not Running', 'चलता': 'Operates',
      'नहीं चल': 'Not Running', 'लीक': 'Leak', 'तेल': 'Oil', 'पानी': 'Water',
      'हाइड्रोलिक': 'Hydraulic', 'पंप': 'Pump', 'वाल्व': 'Valve', 'सील': 'Seal',
      'आवाज': 'Noise', 'शोर': 'Sound', 'धुआ': 'Smoke', 'गर्मी': 'Heat', 'गर्म': 'Hot',
      'ठंडा': 'Cold', 'एसी': 'AC', 'ब्लोअर': 'Blower', 'पंखा': 'Fan',
      'स्टार्ट': 'Start', 'स्टार्टर': 'Starter', 'बैटरी': 'Battery', 'चार्ज': 'Charge',
      'दबाव': 'Pressure', 'कम': 'Low', 'कमजोर': 'Weak', 'धीमा': 'Slow',
      'रिवर्स': 'Reverse', 'फॉरवर्ड': 'Forward', 'गियर': 'Gear', 'क्लच': 'Clutch',
      'दरवाजा': 'Door', 'शीशा': 'Glass', 'सीट': 'Seat', 'छत': 'Roof',
      'रंग': 'Paint', 'जंग': 'Rust', 'दांत': 'Teeth', 'हिस्सा': 'Part',
      'टूट': 'Broken', 'मुड़ा': 'Bent', 'क्रैक': 'Crack', 'पंक्चर': 'Puncture',
      'फूला': 'Burst', 'खिंचाव': 'Pull', 'दबाव': 'Pressure', 'बहुत': 'Very',
      'अधिक': 'More', 'कभी': 'Sometimes', 'बार': 'Time', 'हमेशा': 'Always',
      'अचानक': 'Suddenly', 'धीरे': 'Slowly', 'तेजी': 'Fast', 'साथ': 'With'
    };

    let translatedText = text;
    const sortedEntries = Object.entries(hindiToEnglishDict).sort((a, b) => b[0].length - a[0].length);
    
    for (const [hindi, english] of sortedEntries) {
      const regex = new RegExp(`\\b${hindi}\\b`, 'gi');
      translatedText = translatedText.replace(regex, english);
    }

    return translatedText.replace(/\s+/g, ' ').trim();
  } catch (error) {
    console.error("❌ Translation Error:", error.message);
    return text;
  }
}

async function saveComplaint(twiml, callData) {
  try {
    const customerData = callData.customerData;
    const branchOutlet = detectBranchAndOutlet(customerData.city);

    const installationDate = customerData.installationDate && customerData.installationDate !== "NA"
      ? formatDateForExternal(customerData.installationDate)
      : null;

    const translatedCallerName = await translateHindiToEnglish(callData.callerName || "Not Provided");
    const translatedComplaintDetails = await translateHindiToEnglish(callData.rawComplaint || "Not provided");
    const translatedAddress = await translateHindiToEnglish(callData.address || "Not Provided");
    const translatedJobLocation = await translateHindiToEnglish(callData.jobLocation || "Onsite");

    const mergedLocation = mergeLocationAndPincode(translatedAddress, callData.pincode || "");
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
      machine_type: callData.machineType || "Warranty",
      city_id: branchOutlet.cityCode,
      complain_by: "Customer",
      machine_status: callData.machineStatus || "Running With Problem",
      job_location: translatedJobLocation,
      branch: branchOutlet.branch,
      outlet: branchOutlet.outlet,
      complaint_details: translatedComplaintDetails,
      complaint_title: callData.complaintTitle || "General Problem",
      sub_title: callData.complaintSubTitle || "Other",
      business_partner_code: customerData.businessPartnerCode || "NA",
      complaint_sap_id: "NA",
      machine_location: mergedLocation,
      service_date: callData.serviceDate ? formatDateForExternal(callData.serviceDate) : "",
      from_time: formattedFromTime,
      to_time: formattedToTime,
      job_close_lat: "",
      job_close_lng: "",
      job_open_lat: "",
      job_open_lng: "",
      job_close_address: "",
      job_open_address: "",
      job_close_city: "",
      job_open_city: "",
    };

    console.log("\n" + "=".repeat(120));
    console.log("📤 SENDING TO EXTERNAL API - ALL DATA IN ENGLISH");
    console.log("=".repeat(120));
    console.log(`📱 Caller: ${translatedCallerName} (${callData.callerPhone})`);
    console.log(`🔧 Machine: ${callData.chassis}`);
    console.log(`📍 Location: ${mergedLocation}`);
    console.log(`🎯 Complaint: ${callData.complaintTitle} → ${callData.complaintSubTitle}`);
    console.log(`📅 Service Date: ${complaintApiData.service_date}`);
    console.log(`⏰ Time: ${formattedFromTime} - ${formattedToTime}`);
    console.log("=".repeat(120) + "\n");

    const externalResult = await submitComplaintToExternal(complaintApiData);

    if (externalResult.success) {
      console.log("✅ Data successfully posted to external API");
      return { success: true, sapId: externalResult.sapId };
    } else {
      console.log("⚠️ External API submission failed:", externalResult.error);
      return { success: false, error: externalResult.error };
    }

  } catch (error) {
    console.error("❌ DATABASE ERROR:", error.message);
    return { success: false, error: error.message };
  }
}

function ask(twiml, text, showRepeatInstruction = true, callData = null) {
  // Store last question for repeat functionality
  if (callData) {
    callData.lastQuestion = text;
  }
  
  const gather = twiml.gather({
    input: "speech dtmf",
    language: "hi-IN",
    speechTimeout: "auto",
    timeout: 8,
    actionOnEmptyResult: true,
    action: "/voice/process",
    method: "POST",
  });
  
  // Add instruction only on first question
  let instructionText = text;
  if (showRepeatInstruction) {
    instructionText = text + ". या तारे को दबाएँ सवाल दोबारा सुनने के लिए।";
  }
  
  gather.say({ voice: "Polly.Aditi", language: "hi-IN" }, instructionText);
}

function askDTMF(twiml, text, numDigits = 1, showRepeatInstruction = true, callData = null, useFinishKey = false) {
  // Store last question for repeat functionality
  if (callData) {
    callData.lastQuestion = text;
    callData.lastQuestionType = 'dtmf';
    callData.lastQuestionNumDigits = numDigits;
    callData.lastQuestionUseFinishKey = useFinishKey;
  }
  
  const gatherConfig = {
    input: "dtmf",
    timeout: useFinishKey ? 20 : 5,
    actionOnEmptyResult: true,
    action: "/voice/process",
    method: "POST",
  };
  
  if (useFinishKey) {
    gatherConfig.finishOnKey = "#";
  } else {
    gatherConfig.numDigits = numDigits;
  }
  
  const gather = twiml.gather(gatherConfig);
  
  // Add instruction only on first question
  let instructionText = text;
  if (showRepeatInstruction) {
    instructionText = text + ". या तारे को दबाएँ सवाल दोबारा सुनने के लिए।";
  }
  
  gather.say({ voice: "Polly.Aditi", language: "hi-IN" }, instructionText);
}

/* ======================= MISSING UTILITY FUNCTIONS ======================= */

function extractTimeFromSpeech(text) {
  if (!text) return null;
  
  // Use extractTimeV3 from improved_extraction.js
  const extractedTime = extractTimeV3(text);
  
  if (extractedTime) {
    return extractedTime;
  }
  
  // Fallback: use extractTimeV2 if V3 doesn't work
  try {
    const fallbackTime = extractTimeV2(text);
    if (fallbackTime) {
      return formatTimeToTwelveHour(fallbackTime);
    }
  } catch (e) {
    console.log("Fallback extractTimeV2 failed:", e.message);
  }
  
  // Last resort: try manual extraction
  const timeMatch = text.match(/(\d{1,2})\s*(बजे|baje|am|pm|a\.m|p\.m)/i);
  if (timeMatch) {
    const hour = parseInt(timeMatch[1]);
    const period = text.toLowerCase().includes('pm') || text.toLowerCase().includes('p\.m') ? 'PM' : 'AM';
    return `${String(hour).padStart(2, '0')}:00 ${period}`;
  }
  
  return null;
}

async function saveComplaintToDatabase(callData) {
  try {
    console.log("📥 Saving complaint to database and external API...");
    
    // Call the existing saveComplaint function
    const result = await saveComplaint(null, callData);
    
    return result;
  } catch (error) {
    console.error("❌ Error saving complaint:", error.message);
    return { success: false, error: error.message };
  }
}

/* ======================= MAIN VOICE ROUTE HANDLERS ======================= */

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
    "नमस्ते! राजेश JCB मोटर्स में आपका स्वागत है। Complaint register करने के लिए एक दबाएं। अगर आप किसी agent से बात करना चाहते हैं तो दो दबाएं।"
  );

  res.type("text/xml").send(twiml.toString());
});


router.post("/process", async (req, res) => {
  try {
    const twiml = new VoiceResponse();
    const { CallSid, Digits, SpeechResult, From } = req.body;

    let callData = activeCalls.get(CallSid);

    if (!callData) {
      callData = { callSid: CallSid, step: "ivr_menu", retries: 0, from: From };
      activeCalls.set(CallSid, callData);
    }

    const speechInput = cleanSpeech(SpeechResult || "");

    console.log(`\n${"=".repeat(120)}`);
    console.log(`📞 STEP: ${callData.step} | DIGITS: ${Digits || "N/A"} | SPEECH: "${speechInput}"`);
    console.log("=".repeat(120));

    // ===== HANDLE REPEAT (*) REQUEST =====
    if (Digits === "*" && callData.lastQuestion) {
      console.log(`🔁 User pressed * to repeat last question: "${callData.lastQuestion}"`);
      
      // Repeat the last question WITHOUT showing the instruction
      if (callData.lastQuestionType === 'dtmf') {
        // Use stored DTMF parameters
        askDTMF(twiml, callData.lastQuestion, callData.lastQuestionNumDigits || 1, false, callData, callData.lastQuestionUseFinishKey || false);
      } else {
        // Speech/DTMF questions - use ask() without instruction
        ask(twiml, callData.lastQuestion, false, callData);
      }
      
      activeCalls.set(CallSid, callData);
      return res.type("text/xml").send(twiml.toString());
    }

    // ===== IVR MENU =====
    if (callData.step === "ivr_menu") {
      if (Digits === "1") {
        callData.step = "ask_chassis";
        callData.retries = 0;
        const gather = twiml.gather({
          input: "dtmf",
          finishOnKey: "#",
          timeout: 20,
          actionOnEmptyResult: true,
          action: "/voice/process",
          method: "POST",
        });
        gather.say({ voice: "Polly.Aditi", language: "hi-IN" }, "कृपया अपना मशीन नंबर (चेसिस) दर्ज करें, फिर हैश (#) दबाएं। उदाहरण: 12345#");
        activeCalls.set(CallSid, callData);
        return res.type("text/xml").send(twiml.toString());
      } else if (Digits === "2") {
        twiml.say({ voice: "Polly.Aditi", language: "hi-IN" }, "आप एजेंट से जुड़ दिए जा रहे हैं। कृपया प्रतीक्षा करें।");
        twiml.dial(process.env.HUMAN_AGENT_NUMBER || "+919999999999");
        activeCalls.delete(CallSid);
        return res.type("text/xml").send(twiml.toString());
      } else {
        const gather = twiml.gather({
          input: "dtmf",
          numDigits: 1,
          timeout: 5,
          actionOnEmptyResult: true,
          action: "/voice/process",
          method: "POST",
        });
        gather.say({ voice: "Polly.Aditi", language: "hi-IN" }, "कृपया 1 या 2 दबाइए।");
        activeCalls.set(CallSid, callData);
        return res.type("text/xml").send(twiml.toString());
      }
    }

    // ===== ASK CHASSIS NUMBER =====
    if (callData.step === "ask_chassis") {
      const chassisInput = Digits ? Digits.replace(/[^0-9]/g, '') : null;

      if (!chassisInput || chassisInput.length === 0) {
        callData.retries = (callData.retries || 0) + 1;
        if (callData.retries >= 3) {
          twiml.say({ voice: "Polly.Aditi", language: "hi-IN" }, "मशीन नंबर समझ नहीं पाया। एजेंट से जोड़ा जा रहा है।");
          twiml.dial(process.env.HUMAN_AGENT_NUMBER);
          activeCalls.delete(CallSid);
          return res.type("text/xml").send(twiml.toString());
        }
        const gather = twiml.gather({
          input: "dtmf",
          finishOnKey: "#",
          timeout: 20,
          actionOnEmptyResult: true,
          action: "/voice/process",
          method: "POST",
        });
        gather.say({ voice: "Polly.Aditi", language: "hi-IN" }, `दोबारा प्रयास करें। मशीन नंबर दर्ज करके # दबाएं। (प्रयास ${callData.retries}/3)`);
        activeCalls.set(CallSid, callData);
        return res.type("text/xml").send(twiml.toString());
      }

      if (chassisInput.length < 4 || chassisInput.length > 7) {
        callData.retries = (callData.retries || 0) + 1;
        if (callData.retries >= 3) {
          twiml.say({ voice: "Polly.Aditi", language: "hi-IN" }, "नंबर गलत है। एजेंट से जोड़ा जा रहा है।");
          twiml.dial(process.env.HUMAN_AGENT_NUMBER);
          activeCalls.delete(CallSid);
          return res.type("text/xml").send(twiml.toString());
        }
        const gather = twiml.gather({
          input: "dtmf",
          finishOnKey: "#",
          timeout: 20,
          actionOnEmptyResult: true,
          action: "/voice/process",
          method: "POST",
        });
        gather.say({ voice: "Polly.Aditi", language: "hi-IN" }, `नंबर 4 से 7 अंकों का होना चाहिए। दोबारा दर्ज करें, # दबाएं। (प्रयास ${callData.retries}/3)`);
        activeCalls.set(CallSid, callData);
        return res.type("text/xml").send(twiml.toString());
      }

      console.log(`✅ Chassis Valid: ${chassisInput}`);
      callData.chassis = chassisInput;
      callData.callerPhone = From;
      callData.retries = 0;
      callData.step = "fetch_customer_data";

      // Fetch customer data
      const customerData = await fetchCustomerFromExternal({
        chassisNo: chassisInput
      });

      if (!customerData) {
        twiml.say({ voice: "Polly.Aditi", language: "hi-IN" }, "मशीन सिस्टम में नहीं मिली। कृपया सही नंबर दर्ज करें।");
        callData.step = "ask_chassis";
        callData.retries = 0;
        const gather = twiml.gather({
          input: "dtmf",
          finishOnKey: "#",
          timeout: 20,
          actionOnEmptyResult: true,
          action: "/voice/process",
          method: "POST",
        });
        gather.say({ voice: "Polly.Aditi", language: "hi-IN" }, "मशीन सिस्टम में नहीं मिली। कृपया सही नंबर दर्ज करें, फिर # दबाएं।");
        activeCalls.set(CallSid, callData);
        return res.type("text/xml").send(twiml.toString());
      }

      callData.customerData = customerData;
      callData.callerName = customerData.name || "Unknown";
      callData.step = "ask_problem_description";
      callData.retries = 0;

      ask(twiml, `मशीन मिल गई। अब बताइए - मशीन में क्या समस्या आ रही है? विस्तार से बताइए।`, true, callData);
      activeCalls.set(CallSid, callData);
      return res.type("text/xml").send(twiml.toString());
    }

    // ===== ASK PROBLEM DESCRIPTION =====
    if (callData.step === "ask_problem_description") {
      if (!speechInput || speechInput.length < 3) {
        callData.retries = (callData.retries || 0) + 1;
        if (callData.retries >= 3) {
          callData.rawComplaint = "Not clearly specified";
          callData.complaintTitle = "General Problem";
          callData.complaintSubTitle = "Other";
          callData.step = "ask_machine_status";
          ask(twiml, "ठीक है। मशीन की स्थिति क्या है? चल रही है या बंद है? 1 दबाइए बंद है, 2 दबाइए चल रही है।", false, callData);
          activeCalls.set(CallSid, callData);
          return res.type("text/xml").send(twiml.toString());
        }
        ask(twiml, "विस्तार से बताइए। उदाहरण: इंजन नहीं चल रहा, एसी ठंडा नहीं कर रहा, या कोई लीक है।", false, callData);
        activeCalls.set(CallSid, callData);
        return res.type("text/xml").send(twiml.toString());
      }

      callData.rawComplaint = speechInput;
      const detected = detectComplaint(speechInput);
      console.log(`🔍 Detected Complaint: ${detected.complaint} (Score: ${detected.score})`);

      // Store detected category for follow-up questions
      callData.detectedCategory = detected.complaint || "General Problem";

      // If complaint not detected or low confidence, ask follow-up questions
      if (!detected.complaint || detected.score < 5) {
        console.log(`⚠️  Low confidence complaint detection. Asking follow-up questions...`);
        callData.step = "ask_followup_questions";
        callData.retries = 0;
        callData.rawComplaint = speechInput;
        
        const followUpQ = getFollowUpQuestion(speechInput, 1, callData.detectedCategory);
        ask(twiml, followUpQ, false, callData);
        activeCalls.set(CallSid, callData);
        return res.type("text/xml").send(twiml.toString());
      }

      // High confidence - ask for sub-complaint directly
      callData.complaintTitle = detected.complaint;
      callData.retries = 0;
      callData.step = "ask_sub_complaint";
      console.log(`✅ Complaint detected with high confidence: ${detected.complaint}`);

      ask(twiml, `${detected.complaint} समस्या समझी गई। अब बताइए - बिल्कुल क्या समस्या है? विस्तार से।`, false, callData);
      activeCalls.set(CallSid, callData);
      return res.type("text/xml").send(twiml.toString());
    }

    // ===== ASK FOLLOW-UP QUESTIONS =====
    if (callData.step === "ask_followup_questions") {
      if (!speechInput || speechInput.length < 2) {
        callData.retries = (callData.retries || 0) + 1;
        if (callData.retries >= 2) {
          // Fall back to sub-complaint without specific detection
          callData.complaintTitle = callData.detectedCategory || "General Problem";
          callData.step = "ask_sub_complaint";
          ask(twiml, `ठीक है। बताइए - बिल्कुल मशीन में क्या समस्या है?`, false, callData);
          activeCalls.set(CallSid, callData);
          return res.type("text/xml").send(twiml.toString());
        }
        const followUpQ = getFollowUpQuestion(callData.rawComplaint, callData.retries + 1, callData.detectedCategory);
        ask(twiml, followUpQ, false, callData);
        activeCalls.set(CallSid, callData);
        return res.type("text/xml").send(twiml.toString());
      }

      // Combine with initial complaint and detect again
      const combinedDescription = `${callData.rawComplaint}. ${speechInput}`;
      const detected = detectComplaint(combinedDescription);
      console.log(`🔍 Re-detected Complaint: ${detected.complaint} (Score: ${detected.score})`);

      // Update detected category based on combined description
      callData.detectedCategory = detected.complaint || callData.detectedCategory || "General Problem";
      callData.complaintTitle = detected.complaint || "General Problem";
      callData.step = "ask_sub_complaint";
      callData.retries = 0;

      ask(twiml, `${callData.complaintTitle} समझी गई। अब बताइए - बिल्कुल क्या समस्या है?`, false, callData);
      activeCalls.set(CallSid, callData);
      return res.type("text/xml").send(twiml.toString());
    }

    // ===== ASK SUB-COMPLAINT =====
    if (callData.step === "ask_sub_complaint") {
      if (!speechInput || speechInput.length < 2) {
        callData.retries = (callData.retries || 0) + 1;
        if (callData.retries >= 2) {
          callData.complaintSubTitle = "Other";
          callData.step = "ask_machine_status";
          askDTMF(twiml, "ठीक है। मशीन चल रही है या बंद है? 1 बंद, 2 चल रही है।", 1, false, callData);
          activeCalls.set(CallSid, callData);
          return res.type("text/xml").send(twiml.toString());
        }
        ask(twiml, "कृपया साफ बताइए।", false, callData);
        activeCalls.set(CallSid, callData);
        return res.type("text/xml").send(twiml.toString());
      }

      const subResult = detectSubComplaint(callData.complaintTitle, speechInput);
      console.log(`✓ Sub-Complaint: ${subResult.subTitle}`);

      callData.complaintSubTitle = subResult.subTitle || "Other";
      callData.retries = 0;
      callData.step = "ask_machine_status";

      askDTMF(twiml, `ठीक! अब मशीन की स्थिति - 1 दबाइए बिल्कुल बंद है, 2 दबाइए चल रही है।`, 1, false, callData);
      activeCalls.set(CallSid, callData);
      return res.type("text/xml").send(twiml.toString());
    }

    // ===== ASK MACHINE STATUS =====
    if (callData.step === "ask_machine_status") {
      if (Digits === "1") {
        callData.machineStatus = "Breakdown";
      } else if (Digits === "2") {
        callData.machineStatus = "Running With Problem";
      } else {
        askDTMF(twiml, "1 या 2 दबाइए।", 1, false, callData);
        activeCalls.set(CallSid, callData);
        return res.type("text/xml").send(twiml.toString());
      }

      callData.step = "ask_service_date";
      ask(twiml, "ठीक! अब इंजीनियर को कब बुलाना है? आज, कल, या कोई और तारीख?", false, callData);
      activeCalls.set(CallSid, callData);
      return res.type("text/xml").send(twiml.toString());
    }

    // ===== ASK SERVICE DATE =====
    if (callData.step === "ask_service_date") {
      const date = extractServiceDate(speechInput);

      if (!date) {
        callData.retries = (callData.retries || 0) + 1;
        if (callData.retries >= 2) {
          const tomorrow = new Date();
          tomorrow.setDate(tomorrow.getDate() + 1);
          callData.serviceDate = tomorrow;
          callData.step = "ask_from_time";
          ask(twiml, "ठीक है। अब समय - कितने बजे आ सकता है इंजीनियर?", false, callData);
          activeCalls.set(CallSid, callData);
          return res.type("text/xml").send(twiml.toString());
        }
        ask(twiml, "तारीख स्पष्ट बोलिए। जैसे: आज, कल, या 15 फरवरी।", false, callData);
        activeCalls.set(CallSid, callData);
        return res.type("text/xml").send(twiml.toString());
      }

      callData.serviceDate = date;
      callData.step = "ask_from_time";
      ask(twiml, `ठीक! ${date.toLocaleDateString('hi-IN')} को। अब समय - कितने बजे से आ सकता है?`, false, callData);
      activeCalls.set(CallSid, callData);
      return res.type("text/xml").send(twiml.toString());
    }

    // ===== ASK FROM TIME =====
    if (callData.step === "ask_from_time") {
      const time = extractTimeFromSpeech(speechInput);

      if (!time) {
        callData.retries = (callData.retries || 0) + 1;
        if (callData.retries >= 2) {
          callData.fromTime = "9:00 AM";
          callData.step = "ask_to_time";
          ask(twiml, "कितने बजे तक रह सकता है?", false, callData);
          activeCalls.set(CallSid, callData);
          return res.type("text/xml").send(twiml.toString());
        }
        ask(twiml, "समय बताइए। जैसे: 9 बजे, 2 बजे, 5 बजे।", false, callData);
        activeCalls.set(CallSid, callData);
        return res.type("text/xml").send(twiml.toString());
      }

      callData.fromTime = time;
      callData.step = "ask_to_time";
      ask(twiml, "अच्छा। कितने बजे तक रह सकता है?", false, callData);
      activeCalls.set(CallSid, callData);
      return res.type("text/xml").send(twiml.toString());
    }

    // ===== ASK TO TIME =====
    if (callData.step === "ask_to_time") {
      const time = extractTimeFromSpeech(speechInput);

      if (!time) {
        callData.retries = (callData.retries || 0) + 1;
        if (callData.retries >= 2) {
          callData.toTime = "5:00 PM";
          callData.step = "ask_job_location";
          askDTMF(twiml, "अब - मशीन कहाँ है? 1 Site पर, 2 Workshop में।", 1, false, callData);
          activeCalls.set(CallSid, callData);
          return res.type("text/xml").send(twiml.toString());
        }
        ask(twiml, "समय बताइए।", false, callData);
        activeCalls.set(CallSid, callData);
        return res.type("text/xml").send(twiml.toString());
      }

      callData.toTime = time;
      callData.step = "ask_job_location";
      askDTMF(twiml, "ठीक! अब मशीन कहाँ है? 1 Site पर, 2 Workshop में।", 1, false, callData);
      activeCalls.set(CallSid, callData);
      return res.type("text/xml").send(twiml.toString());
    }

    // ===== ASK JOB LOCATION =====
    if (callData.step === "ask_job_location") {
      if (Digits === "1") {
        callData.jobLocation = "Onsite";
      } else if (Digits === "2") {
        callData.jobLocation = "Workshop";
      } else {
        askDTMF(twiml, "1 या 2 दबाइए।", 1, false, callData);
        activeCalls.set(CallSid, callData);
        return res.type("text/xml").send(twiml.toString());
      }

      callData.step = "ask_city";
      ask(twiml, "अब पता - शहर का नाम बताइए।", false, callData);
      activeCalls.set(CallSid, callData);
      return res.type("text/xml").send(twiml.toString());
    }

    // ===== ASK CITY =====
    if (callData.step === "ask_city") {
      if (!speechInput || speechInput.length < 2) {
        callData.retries = (callData.retries || 0) + 1;
        if (callData.retries >= 2) {
          callData.city = "Not Provided";
          callData.step = "ask_landmark";
          ask(twiml, "ठीक है। इलाका या लैंडमार्क बताइए।", false, callData);
          activeCalls.set(CallSid, callData);
          return res.type("text/xml").send(twiml.toString());
        }
        ask(twiml, "शहर का नाम स्पष्ट बोलिए।", false, callData);
        activeCalls.set(CallSid, callData);
        return res.type("text/xml").send(twiml.toString());
      }

      callData.city = speechInput;
      callData.step = "ask_landmark";
      ask(twiml, `${speechInput} ठीक है। अब इलाका - सेक्टर, शॉपिंग मॉल के पास, या किसी स्कूल के पास?`, false, callData);
      activeCalls.set(CallSid, callData);
      return res.type("text/xml").send(twiml.toString());
    }

    // ===== ASK LANDMARK =====
    if (callData.step === "ask_landmark") {
      if (!speechInput || speechInput.length < 2) {
        callData.retries = (callData.retries || 0) + 1;
        if (callData.retries >= 2) {
          callData.landmark = "Not Provided";
          callData.step = "ask_pincode";
          ask(twiml, "ठीक है। अब 6 अंकों का पिनकोड बताइए।", false, callData);
          activeCalls.set(CallSid, callData);
          return res.type("text/xml").send(twiml.toString());
        }
        ask(twiml, "इलाका बताइए।", false, callData);
        activeCalls.set(CallSid, callData);
        return res.type("text/xml").send(twiml.toString());
      }

      callData.landmark = speechInput;
      callData.step = "ask_pincode";
      ask(twiml, "अच्छा! अब 6 अंकों का पिनकोड बताइए।", false, callData);
      activeCalls.set(CallSid, callData);
      return res.type("text/xml").send(twiml.toString());
    }

    // ===== ASK PINCODE =====
    if (callData.step === "ask_pincode") {
      let pincode = null;
      
      // Try DTMF first (user pressed keypad)
      if (Digits) {
        pincode = Digits.replace(/[^0-9]/g, '');
      }
      
      // If no DTMF, try speech extraction
      if (!pincode && speechInput) {
        // Extract digits from speech using pincode extraction function
        const extractedFromSpeech = extractPincodeV2(speechInput);
        if (extractedFromSpeech) {
          pincode = extractedFromSpeech;
          console.log(`📍 Pincode extracted from speech: ${pincode}`);
        }
      }

      if (!pincode || pincode.length !== 6) {
        callData.retries = (callData.retries || 0) + 1;
        if (callData.retries >= 2) {
          callData.pincode = "000000";
          callData.address = `${callData.city || "Not Provided"}, ${callData.landmark || "Not Provided"}`;

          // SAVE COMPLAINT
          const saveResult = await saveComplaintToDatabase(callData);

          if (saveResult.success) {
            twiml.say(
              { voice: "Polly.Aditi", language: "hi-IN" },
              `बहुत बहुत धन्यवाद! आपकी शिकायत दर्ज हो गई है। शिकायत संख्या: ${saveResult.sapId || 'अभी उपलब्ध है'}। हमारा इंजीनियर ${callData.serviceDate?.toLocaleDateString('hi-IN')} को ${callData.fromTime} बजे आपके पास पहुंचेगा!`
            );
          } else {
            twiml.say(
              { voice: "Polly.Aditi", language: "hi-IN" },
              "धन्यवाद! आपकी शिकायत दर्ज हो गई है। हमारी टीम आपसे संपर्क करेगी।"
            );
          }

          twiml.hangup();
          activeCalls.delete(CallSid);
          return res.type("text/xml").send(twiml.toString());
        }

        askDTMF(twiml, `पिनकोड 6 अंकों का होना चाहिए। दोबारा दर्ज करें, फिर # दबाएं। (प्रयास ${callData.retries}/2)`, 6, false, callData, true);
        activeCalls.set(CallSid, callData);
        return res.type("text/xml").send(twiml.toString());
      }

      callData.pincode = pincode;
      callData.address = `${callData.city || "Not Provided"}, ${callData.landmark || "Not Provided"}`;

      console.log("\n" + "=".repeat(120));
      console.log("✅ ALL DATA COLLECTED - FINAL SUMMARY");
      console.log("=".repeat(120));
      console.log(`🔧 Chassis: ${callData.chassis}`);
      console.log(`👤 Caller: ${callData.callerName}`);
      console.log(`📍 Address: ${callData.address}, ${callData.pincode}`);
      console.log(`🎯 Complaint: ${callData.complaintTitle} → ${callData.complaintSubTitle}`);
      console.log(`📅 Service: ${callData.serviceDate?.toLocaleDateString('hi-IN')}`);
      console.log(`⏰ Time: ${callData.fromTime} - ${callData.toTime}`);
      console.log("=".repeat(120));

      // SAVE COMPLAINT
      const saveResult = await saveComplaintToDatabase(callData);

      if (saveResult.success) {
        twiml.say(
          { voice: "Polly.Aditi", language: "hi-IN" },
          `बहुत बहुत धन्यवाद! आपकी शिकायत सफलतापूर्वक दर्ज हो गई है। शिकायत संख्या: ${saveResult.sapId || 'संसाधित'}। इंजीनियर ${callData.serviceDate?.toLocaleDateString('hi-IN')} को ${callData.fromTime} बजे आपके पास पहुंचेगा!`
        );
      } else {
        twiml.say(
          { voice: "Polly.Aditi", language: "hi-IN" },
          "धन्यवाद! आपकी शिकायत दर्ज हो गई है। हमारी टीम आपसे संपर्क करेगी।"
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
      "क्षमा करें, कुछ तकनीकी समस्या है। एजेंट से जोड़ा जा रहा है।"
    );
    twiml.dial(process.env.HUMAN_AGENT_NUMBER || "+919999999999");
    return res.type("text/xml").send(twiml.toString());
  }
});

export default router;