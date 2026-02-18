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
  isValidPincode
} from '../utils/improved_extraction.js';

const router = express.Router();
const VoiceResponse = twilio.twiml.VoiceResponse;

const activeCalls = new Map();

/* ======================= EXTERNAL API CONFIG ======================= */
// const EXTERNAL_API_BASE = "http://gprs.rajeshmotors.com/jcbServiceEnginerAPIv7";
// const COMPLAINT_API_URL = "http://gprs.rajeshmotors.com/jcbServiceEnginerAPIv7/ai_call_complaint.php";
const EXTERNAL_API_BASE = "http://192.168.1.40/jcbServiceEnginerAPIv7";
const COMPLAINT_API_URL = "http://192.168.1.40/jcbServiceEnginerAPIv7/ai_call_complaint.php";
const API_TIMEOUT = 20000;
const API_HEADERS = { JCBSERVICEAPI: "MakeInJcb" };

/* ======================= COMPREHENSIVE MULTI-LEVEL COMPLAINT STRUCTURE ======================= */
const complaintCategories = {
  "1": {
    title: "Engine & Transmission",
    titleHindi: "इंजन और ट्रांसमिशन",
    subComplaints: {
      "1": { title: "Engine Over heating", titleHindi: "इंजन गर्म हो रहा है" },
      "2": { title: "Starting trouble", titleHindi: "शुरू करने में समस्या" },
      "3": { title: "Smoke problem", titleHindi: "धुआ आ रहा है" },
      "4": { title: "Oil leak", titleHindi: "तेल रिस रहा है" },
      "5": { title: "Gear box problem", titleHindi: "गियर बॉक्स में समस्या" },
      "6": { title: "Brake problem", titleHindi: "ब्रेक में समस्या" },
      "7": { title: "Engine knock/noise", titleHindi: "इंजन में थाप/आवाज़" },
      "8": { title: "Other Engine issues", titleHindi: "अन्य इंजन समस्याएं" }
    }
  },
  "2": {
    title: "Hydraulic System",
    titleHindi: "हाइड्रोलिक सिस्टम",
    subComplaints: {
      "1": { title: "Hydraulic pump broken", titleHindi: "हाइड्रोलिक पंप टूटा हुआ" },
      "2": { title: "Pressure down", titleHindi: "दबाव कम हो गया" },
      "3": { title: "Control Valve leakage", titleHindi: "नियंत्रण वाल्व रिस रहा है" },
      "4": { title: "Machine performance low", titleHindi: "मशीन की कार्यक्षमता कम" },
      "5": { title: "Cylinder leakage", titleHindi: "सिलिंडर रिसाव" },
      "6": { title: "Hose rupture", titleHindi: "होज़ फटना" },
      "7": { title: "Strange noise from pump", titleHindi: "पंप से अजीब आवाज़" },
      "8": { title: "Other Hydraulic issues", titleHindi: "अन्य हाइड्रोलिक समस्याएं" }
    }
  },
  "3": {
    title: "Cylinder & Seals",
    titleHindi: "सिलिंडर और सील",
    subComplaints: {
      "1": { title: "Cylinder seal leak", titleHindi: "सिलिंडर सील रिस रही है" },
      "2": { title: "Rod broken", titleHindi: "रॉड टूटा हुआ है" },
      "3": { title: "Piston damage", titleHindi: "पिस्टन को नुकसान" },
      "4": { title: "Cylinder rod bent", titleHindi: "सिलिंडर रॉड मुड़ा हुआ" },
      "5": { title: "Seal replacement needed", titleHindi: "सील बदलने की ज़रूरत है" },
      "6": { title: "Oil loss from cylinder", titleHindi: "सिलिंडर से तेल खो रहा है" },
      "7": { title: "Cylinder stroke issue", titleHindi: "सिलिंडर स्ट्रोक समस्या" },
      "8": { title: "Other Seal issues", titleHindi: "अन्य सील समस्याएं" }
    }
  },
  "4": {
    title: "Electrical & Battery",
    titleHindi: "बिजली और बैटरी",
    subComplaints: {
      "1": { title: "Battery dead", titleHindi: "बैटरी खत्म हो गई" },
      "2": { title: "Alternator not working", titleHindi: "अल्टरनेटर काम नहीं कर रहा" },
      "3": { title: "Starter motor problem", titleHindi: "स्टार्टर मोटर में समस्या" },
      "4": { title: "Wiring problem", titleHindi: "तारों में समस्या" },
      "5": { title: "Fuse blown", titleHindi: "फ्यूज़ जल गया है" },
      "6": { title: "Ignition coil failure", titleHindi: "इग्निशन कॉइल विफल" },
      "7": { title: "Lights not working", titleHindi: "लाइटें काम नहीं कर रहीं" },
      "8": { title: "Other Electrical issues", titleHindi: "अन्य विद्युत समस्याएं" }
    }
  },
  "5": {
    title: "Body & Structure",
    titleHindi: "शरीर और संरचना",
    subComplaints: {
      "1": { title: "Body crack", titleHindi: "बॉडी में दरार" },
      "2": { title: "Door problem", titleHindi: "दरवाजे में समस्या" },
      "3": { title: "Bushing work", titleHindi: "बुशिंग काम" },
      "4": { title: "Water leakage", titleHindi: "पानी का रिसाव" },
      "5": { title: "Frame damage", titleHindi: "फ्रेम को नुकसान" },
      "6": { title: "Paint damage", titleHindi: "पेंट को नुकसान" },
      "7": { title: "Welding failure", titleHindi: "वेल्डिंग विफलता" },
      "8": { title: "Other Body issues", titleHindi: "अन्य बॉडी समस्याएं" }
    }
  },
  "6": {
    title: "Tyres & Undercarriage",
    titleHindi: "टायर और अंडरकैरिज",
    subComplaints: {
      "1": { title: "Tyre puncture", titleHindi: "टायर में पंचर" },
      "2": { title: "Tyre wear", titleHindi: "टायर घिसा हुआ" },
      "3": { title: "Suspension problem", titleHindi: "सस्पेंशन में समस्या" },
      "4": { title: "Undercarriage damage", titleHindi: "अंडरकैरिज को नुकसान" },
      "5": { title: "Rim damage", titleHindi: "रिम को नुकसान" },
      "6": { title: "Spring breakage", titleHindi: "स्प्रिंग टूटना" },
      "7": { title: "Axle damage", titleHindi: "एक्सल को नुकसान" },
      "8": { title: "Other Tyre issues", titleHindi: "अन्य टायर समस्याएं" }
    }
  },
  "7": {
    title: "Service & Maintenance",
    titleHindi: "सेवा और रखरखाव",
    subComplaints: {
      "1": { title: "Oil change needed", titleHindi: "तेल बदलने की ज़रूरत है" },
      "2": { title: "Filter replacement", titleHindi: "फिल्टर बदलना" },
      "3": { title: "Fluid top-up", titleHindi: "द्रव भरने की ज़रूरत है" },
      "4": { title: "Greasing required", titleHindi: "स्नेहन की ज़रूरत है" },
      "5": { title: "Belt replacement", titleHindi: "बेल्ट बदलना" },
      "6": { title: "Coolant top-up", titleHindi: "शीतलक भरने की ज़रूरत है" },
      "7": { title: "Regular checkup", titleHindi: "सामान्य मरम्मत" },
      "8": { title: "Other Service", titleHindi: "अन्य सेवाएं" }
    }
  },
  "8": {
    title: "Other",
    titleHindi: "अन्य",
    subComplaints: {
      "1": { 
        title: "Cabin & Operator Comfort",
        titleHindi: "केबिन और ऑपरेटर सुविधा",
        options: {
          "1": { title: "Seat damage", titleHindi: "सीट को नुकसान" },
          "2": { title: "Dashboard issue", titleHindi: "डैशबोर्ड समस्या" },
          "3": { title: "Air conditioning problem", titleHindi: "एयर कंडीशनिंग समस्या" },
          "4": { title: "Interior light problem", titleHindi: "इंटीरियर लाइट समस्या" },
          "5": { title: "Door/Window issue", titleHindi: "दरवाजा/खिड़की समस्या" },
          "6": { title: "Operator control problem", titleHindi: "ऑपरेटर नियंत्रण समस्या" },
          "7": { title: "Cabin noise/vibration", titleHindi: "केबिन शोर/कंपन" }
        }
      },
      "2": { 
        title: "Cooling System Failures",
        titleHindi: "कूलिंग सिस्टम विफलता",
        options: {
          "1": { title: "Radiator problem", titleHindi: "रेडिएटर समस्या" },
          "2": { title: "Water pump failure", titleHindi: "जल पंप विफलता" },
          "3": { title: "Thermostat issue", titleHindi: "थर्मोस्टेट समस्या" },
          "4": { title: "Fan motor problem", titleHindi: "फैन मोटर समस्या" },
          "5": { title: "Coolant leak", titleHindi: "शीतलक रिसाव" },
          "6": { title: "Temperature sensor issue", titleHindi: "तापमान सेंसर समस्या" },
          "7": { title: "Intercooler problem", titleHindi: "इंटरकूलर समस्या" }
        }
      },
      "3": { 
        title: "Fuel System Problems",
        titleHindi: "ईंधन प्रणाली समस्याएं",
        options: {
          "1": { title: "Fuel pump failure", titleHindi: "ईंधन पंप विफलता" },
          "2": { title: "Fuel filter clogged", titleHindi: "ईंधन फिल्टर बंद" },
          "3": { title: "Fuel injector problem", titleHindi: "ईंधन इंजेक्टर समस्या" },
          "4": { title: "Fuel line leak", titleHindi: "ईंधन लाइन रिसाव" },
          "5": { title: "Fuel tank issue", titleHindi: "ईंधन टंकी समस्या" },
          "6": { title: "Fuel gauge problem", titleHindi: "ईंधन गेज समस्या" },
          "7": { title: "Fuel cap issue", titleHindi: "ईंधन कैप समस्या" }
        }
      },
      "4": { 
        title: "Hose & Pipe Damages",
        titleHindi: "होज़ और पाइप क्षति",
        options: {
          "1": { title: "Hydraulic hose leak", titleHindi: "हाइड्रोलिक होज़ रिसाव" },
          "2": { title: "Fuel hose damage", titleHindi: "ईंधन होज़ क्षति" },
          "3": { title: "Coolant hose leak", titleHindi: "शीतलक होज़ रिसाव" },
          "4": { title: "Air hose problem", titleHindi: "वायु होज़ समस्या" },
          "5": { title: "Brake hose issue", titleHindi: "ब्रेक होज़ समस्या" },
          "6": { title: "Intercooler pipes", titleHindi: "इंटरकूलर पाइप" },
          "7": { title: "General hose replacement", titleHindi: "सामान्य होज़ प्रतिस्थापन" }
        }
      },
      "5": { 
        title: "Attachment Issues",
        titleHindi: "अटैचमेंट समस्याएं",
        options: {
          "1": { title: "Bucket attachment problem", titleHindi: "बकेट अटैचमेंट समस्या" },
          "2": { title: "Boom attachment issue", titleHindi: "बूम अटैचमेंट समस्या" },
          "3": { title: "Dipper attachment fault", titleHindi: "डिपर अटैचमेंट विफलता" },
          "4": { title: "Quick coupler problem", titleHindi: "त्वरित कपलर समस्या" },
          "5": { title: "Pin damaged", titleHindi: "पिन क्षतिग्रस्त" },
          "6": { title: "Attachment seal leak", titleHindi: "अटैचमेंट सील रिसाव" },
          "7": { title: "Attachment movement issue", titleHindi: "अटैचमेंट आंदोलन समस्या" }
        }
      },
      "6": { 
        title: "Steering & Control Problems",
        titleHindi: "स्टीयरिंग और नियंत्रण समस्याएं",
        options: {
          "1": { title: "Steering wheel issue", titleHindi: "स्टीयरिंग व्हील समस्या" },
          "2": { title: "Hydraulic steering leak", titleHindi: "हाइड्रोलिक स्टीयरिंग रिसाव" },
          "3": { title: "Power steering failure", titleHindi: "पावर स्टीयरिंग विफलता" },
          "4": { title: "Control lever sticking", titleHindi: "नियंत्रण लीवर अटका" },
          "5": { title: "Steering response slow", titleHindi: "स्टीयरिंग प्रतिक्रिया धीमी" },
          "6": { title: "Control valve problem", titleHindi: "नियंत्रण वाल्व समस्या" },
          "7": { title: "Joint bearing issue", titleHindi: "जोड़ बीयरिंग समस्या" }
        }
      },
      "7": { 
        title: "Safety & Warning Systems",
        titleHindi: "सुरक्षा और चेतावनी प्रणाली",
        options: {
          "1": { title: "Alarm system fault", titleHindi: "अलर्ट सिस्टम खराबी" },
          "2": { title: "Light indicator problem", titleHindi: "प्रकाश संकेतक समस्या" },
          "3": { title: "Sound system issue", titleHindi: "साउंड सिस्टम समस्या" },
          "4": { title: "Safety switch problem", titleHindi: "सुरक्षा स्विच समस्या" },
          "5": { title: "Sensor malfunction", titleHindi: "सेंसर खराबी" },
          "6": { title: "Warning light problem", titleHindi: "चेतावनी प्रकाश समस्या" },
          "7": { title: "Backup alarm issue", titleHindi: "बैकअप अलर्ट समस्या" }
        }
      },
      "8": { 
        title: "Engine Management & Emission",
        titleHindi: "इंजन प्रबंधन और उत्सर्जन",
        options: {
          "1": { title: "Turbocharger problem", titleHindi: "टर्बोचार्जर समस्या" },
          "2": { title: "Exhaust system issue", titleHindi: "एक्सहॉस्ट सिस्टम समस्या" },
          "3": { title: "EGR valve failure", titleHindi: "EGR वाल्व विफलता" },
          "4": { title: "Particulate filter clogged", titleHindi: "पार्टिकुलेट फिल्टर बंद" },
          "5": { title: "Emission sensor fault", titleHindi: "उत्सर्जन सेंसर खराबी" },
          "6": { title: "Engine management light on", titleHindi: "इंजन प्रबंधन लाइट चालू" },
          "7": { title: "Catalytic converter issue", titleHindi: "कटालिटिक कन्वर्टर समस्या" }
        }
      }
    }
  }
};

/* ======================= OLDER COMPLAINT MAP (KEPT FOR REFERENCE) ======================= */
const complaintMap = {
  "Body Work": {
    keywords: ["body", "bodywork", "bushing", "leakage", "drum", "noise", "vibration", "water", "pipe", "color", "decal", "sticker", "पेटिंग", "शरीर", "बाडी", "बॉडी"],
    priority: 5,
    subTitles: {
      "Bushing Work": ["bushing", "बुशिंग"],
      "Leakage from Drum": ["leakage", "drum", "leak"],
      "Noise from Drum": ["noise", "drum"],
      "Vibration fault in Drum": ["vibration", "कंपन"],
      "Water Sprinkle Pipe fault": ["water", "pipe"],
      "Other": ["other", "अन्य"]
    }
  },
  "Cabin": {
    keywords: ["cabin", "cab", "door", "glass", "window", "bonnet", "seat", "roof", "fan", "केबिन", "सीट", "दरवाजा"],
    priority: 6,
    subTitles: {
      "bonnet crack": ["bonnet"],
      "Cab Door Fault": ["door"],
      "Cabin glass cracked": ["glass"],
      "Fan not working": ["fan"],
      "Operator Seat problems": ["seat"],
      "Roof cracked": ["roof"],
      "Other": ["other"]
    }
  },
  "Electrical Complaint": {
    keywords: ["electrical", "electric", "light", "battery", "alternator", "starter", "switch", "relay", "wiring", "error code", "बिजली", "लाइट", "बैटरी"],
    priority: 8,
    subTitles: {
      "Alternator not Working": ["alternator"],
      "Error Code in Machine display": ["error", "code"],
      "Light glowing problem": ["light"],
      "Self/Starter motor problem": ["self", "starter"],
      "Switch Fault": ["switch"],
      "Wiring problem": ["wiring"],
      "Other": ["other"]
    }
  },
  "Engine": {
    keywords: ["engine", "motor", "start", "smoke", "overheat", "noise", "power", "oil", "leakage", "seal leak", "fan belt", "इंजन", "मोटर", "शुरू", "धुआ"],
    priority: 10,
    subTitles: {
      "Abnormal Noise": ["noise", "आवाज"],
      "Engine Over heating": ["overheat", "गर्म"],
      "Engine seal leak": ["seal", "leak"],
      "Fan belt broken": ["fan", "belt"],
      "Fuel consumption high": ["fuel"],
      "Oil consumption high": ["oil"],
      "Smoke problem": ["smoke"],
      "Starting trouble": ["start"],
      "Other": ["other"]
    }
  },
  "Fabrication part": {
    keywords: ["fabrication", "boom", "bucket", "chassis", "dipper", "crack", "leak", "fuel tank", "बूम", "बकेट", "चेसिस"],
    priority: 6,
    subTitles: {
      "Boom cracked": ["boom"],
      "Bucket cracked": ["bucket"],
      "Chassis cracked": ["chassis"],
      "Dipper cracked": ["dipper"],
      "Fuel Tank Leakage": ["fuel tank"],
      "Other": ["other"]
    }
  },
  "Transmission/Axle": {
    keywords: ["transmission", "gear", "axle", "brake", "oil leak", "overheat", "ट्रांसमिशन", "गियर", "ब्रेक"],
    priority: 7,
    subTitles: {
      "Brake problem": ["brake"],
      "Gear box problem": ["gear"],
      "Oil leak from transmission": ["oil leak"],
      "Other": ["other"]
    }
  },
  "Hydraulic": {
    keywords: ["hydraulic", "pressure", "pump", "valve", "seal leak", "performance", "हाइड्रोलिक", "दबाव", "पंप"],
    priority: 8,
    subTitles: {
      "Control Valve leakage": ["valve"],
      "Hydraulic pump broken": ["pump broken"],
      "Hydraulic pump leak": ["pump leak"],
      "Machine performance low": ["performance low"],
      "Pressure down": ["pressure down"],
      "Other": ["other"]
    }
  },
  "Service": {
    keywords: ["service", "servicing", "maintenance", "checkup", "visit", "सर्विस", "मेंटेनेंस"],
    priority: 3,
    subTitles: {
      "Actual Service": ["service", "maintenance"],
      "Other": ["other"]
    }
  },
  "AC System": {
    keywords: ["ac", "air conditioner", "cooling", "ठंडा", "एसी", "एयर कंडीशनर"],
    priority: 10,
    subTitles: {
      "AC not Working": ["not working"],
      "AC not Cooling": ["not cooling"],
      "Other": ["other"]
    }
  }
};

/* ======================= UNCERTAINTY KEYWORDS ======================= */
const uncertaintyKeywords = [
  'पता नहीं', 'पता नही', 'मुझे नहीं पता', 'मालूम नहीं', 'याद नहीं', 'भूल गया',
  'समझ नहीं', 'जानता नहीं', "don't know", 'dunno', 'no idea', 'not sure'
];

/* ======================= HELPER FUNCTIONS ======================= */

function cleanSpeech(text) {
  if (!text) return "";
  return text.toLowerCase().replace(/[।.,!?]/g, "").replace(/\s+/g, " ").trim();
}

function convertHindiToEnglish(text) {
  if (!text || typeof text !== 'string') return "Unknown";
  
  // Hindi to English mapping for common locations and words
  const hindiToEnglishMap = {
    // Major Indian Cities
    'दिल्ली': 'Delhi',
    'मुंबई': 'Mumbai',
    'बेंगलुरु': 'Bangalore',
    'चेन्नई': 'Chennai',
    'कोलकाता': 'Kolkata',
    'हैदराबाद': 'Hyderabad',
    'पुणे': 'Pune',
    'अहमदाबाद': 'Ahmedabad',
    // Rajasthan Cities
    'अजमेर': 'Ajmer',
    'अलवर': 'Alwar',
    'जयपुर': 'Jaipur',
    'कोटा': 'Kota',
    'उदयपुर': 'Udaipur',
    'जोधपुर': 'Jodhpur',
    'बीकानेर': 'Bikaner',
    'भरतपुर': 'Bharatpur',
    // Delhi Areas
    'करोल बाग': 'Karol Bagh',
    'करोल': 'Karol',
    'बाग': 'Bagh',
    'गुड़गांव': 'Gurgaon',
    'नोएडा': 'Noida',
    'साकेत': 'Saket',
    'द्वारका': 'Dwarka',
    'गुलाब': 'Gulab',
    // Landmarks
    'बस अड्डा': 'Bus Station',
    'स्कूल': 'School',
    'अस्पताल': 'Hospital',
    'बैंक': 'Bank',
    'मोहल्ला': 'Locality',
    'मार्केट': 'Market',
    'गली': 'Lane',
    'प्लॉट': 'Plot',
    'नजदीक': 'Near',
    'पास': 'Near',
    // Common words
    'पता नहीं': 'Not Provided',
    'नहीं': 'No',
    'हाँ': 'Yes',
  };
  
  let converted = text;
  
  // Sort by length (longest first) to match longer phrases first
  const sortedMap = Object.entries(hindiToEnglishMap).sort((a, b) => b[0].length - a[0].length);
  
  for (const [hindi, english] of sortedMap) {
    const regex = new RegExp(`\\b${hindi}\\b`, 'gi');
    converted = converted.replace(regex, english);
  }
  
  return converted || "Unknown";
}

function safeAscii(text) {
  if (!text) return "Unknown";
  // Convert Hindi to English first
  const englishText = convertHindiToEnglish(text);
  // Then keep only ASCII-compatible characters
  const cleaned = englishText.replace(/[^\w\s-]/g, '').trim();
  return cleaned || "Unknown";
}

function isUncertain(text) {
  if (!text) return false;
  const textLower = text.toLowerCase();
  return uncertaintyKeywords.some(k => new RegExp(`\\b${k}\\b`, 'i').test(textLower));
}

function rejectInvalid(text) {
  if (!text) return true;
  if (text.trim().length < 2) return true;
  if (isUncertain(text)) return true;
  return false;
}

function digitsToHindi(digits) {
  const hindiDigits = {
    '0': 'शून्य', '1': 'एक', '2': 'दो', '3': 'तीन', '4': 'चार',
    '5': 'पाँच', '6': 'छह', '7': 'सात', '8': 'आठ', '9': 'नौ'
  };
  return digits.split('').map(d => hindiDigits[d] || d).join(' ');
}

/* ======================= NUMERIC MENU HELPER FUNCTIONS ======================= */

function getComplaintTitleFromSelection(categoryDigit, subCategoryDigit) {
  const category = complaintCategories[categoryDigit];
  if (!category) return { title: "General Problem", titleHindi: "सामान्य समस्या" };
  
  const subComplaint = category.subComplaints[subCategoryDigit];
  if (!subComplaint) return { title: "Other", titleHindi: "अन्य" };
  
  return {
    categoryTitle: category.title,
    complaintTitle: subComplaint.title,
    complaintTitleHindi: subComplaint.titleHindi
  };
}

function getSubComplaintMenu(categoryDigit) {
  const category = complaintCategories[categoryDigit];
  if (!category) return null;
  
  const options = Object.entries(category.subComplaints)
    .map(([digit, complaint]) => `${complaint.titleHindi} के लिए ${digit} दबाएँ।`)
    .join("\n");
  
  return options;
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

function extractServiceDate(text) {
  if (!text) return null;
  const cleaned = text.toLowerCase();
  const today = new Date();

  if (/\baaj\b|\btoday\b|\bआज\b/i.test(cleaned)) return today;
  if (/\bkal\b|\btomorrow\b|\bकल\b/i.test(cleaned)) {
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow;
  }
  if (/\bparso\b|\bपरसों\b/i.test(cleaned)) {
    const dayAfter = new Date(today);
    dayAfter.setDate(dayAfter.getDate() + 2);
    return dayAfter;
  }

  // Hindi month names
  const hindiMonths = {
    'जनवरी': 1, 'फरवरी': 2, 'मार्च': 3, 'अप्रैल': 4, 'मई': 5, 'जून': 6,
    'जुलाई': 7, 'अगस्त': 8, 'सितंबर': 9, 'अक्टूबर': 10, 'नवंबर': 11, 'दिसंबर': 12
  };

  // English month names
  const englishMonths = {
    'january': 1, 'jan': 1, 'february': 2, 'feb': 2, 'march': 3, 'mar': 3,
    'april': 4, 'apr': 4, 'may': 5, 'june': 6, 'jun': 6, 'july': 7, 'jul': 7,
    'august': 8, 'aug': 8, 'september': 9, 'sep': 9, 'october': 10, 'oct': 10,
    'november': 11, 'nov': 11, 'december': 12, 'dec': 12
  };

  // Try DD/MM or DD-MM format
  const dateMatch1 = cleaned.match(/(\d{1,2})[\/\-](\d{1,2})/);
  if (dateMatch1) {
    const day = parseInt(dateMatch1[1]);
    const month = parseInt(dateMatch1[2]);
    if (month >= 1 && month <= 12) {
      const date = new Date(today.getFullYear(), month - 1, day);
      if (date >= today) return date;
      date.setFullYear(today.getFullYear() + 1);
      return date;
    }
  }

  // Try Hindi format: "20 फरवरी" or "20 फरवरी को"
  for (const [hindiMonth, monthNum] of Object.entries(hindiMonths)) {
    const hindiDateRegex = new RegExp(`(\\d{1,2})\\s+${hindiMonth}`, 'i');
    const hindiMatch = cleaned.match(hindiDateRegex);
    if (hindiMatch) {
      const day = parseInt(hindiMatch[1]);
      const date = new Date(today.getFullYear(), monthNum - 1, day);
      if (date >= today) return date;
      date.setFullYear(today.getFullYear() + 1);
      return date;
    }
  }

  // Try English format: "20 February" or "20 Feb"
  for (const [englishMonth, monthNum] of Object.entries(englishMonths)) {
    const englishDateRegex = new RegExp(`(\\d{1,2})\\s+${englishMonth}`, 'i');
    const englishMatch = cleaned.match(englishDateRegex);
    if (englishMatch) {
      const day = parseInt(englishMatch[1]);
      const date = new Date(today.getFullYear(), monthNum - 1, day);
      if (date >= today) return date;
      date.setFullYear(today.getFullYear() + 1);
      return date;
    }
  }

  return null;
}

function formatDate(date) {
  if (!date) return "";
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function formatTimeToTwelveHour(timeString) {
  if (!timeString) return "";
  const match = timeString.match(/(\d{1,2}):?(\d{2})?/);
  if (!match) return timeString;
  
  let hour = parseInt(match[1]);
  const minute = match[2] || '00';
  
  const isPM = hour > 12 || /pm|evening|shaam|duphare/i.test(timeString);
  if (isPM && hour <= 12) hour = hour === 12 ? 12 : hour + 12;
  
  const displayHour = hour > 12 ? hour - 12 : (hour === 0 ? 12 : hour);
  const period = hour >= 12 ? 'PM' : 'AM';
  
  return `${String(displayHour).padStart(2, '0')}:${minute} ${period}`;
}

/* ======================= CITY TO BRANCH/OUTLET MAPPING ======================= */
const cityBranchOutletMap = {
  "SUJANGARH": { branch: "SUJANGARH", outlet: "MAIN" },
  "JAIPUR": { branch: "JAIPUR", outlet: "HQ" },
  "UDAIPUR": { branch: "UDAIPUR", outlet: "MAIN" },
  "JODHPUR": { branch: "JODHPUR", outlet: "MAIN" },
  "KOTA": { branch: "KOTA", outlet: "MAIN" },
  "AJMER": { branch: "AJMER", outlet: "MAIN" },
  "BIKANER": { branch: "BIKANER", outlet: "MAIN" },
  "DEFAULT": { branch: "CENTRAL", outlet: "SERVICE" }
};

function getBranchOutletByCity(city) {
  if (!city) return cityBranchOutletMap["DEFAULT"];
  const cityUpper = city.toUpperCase().trim();
  return cityBranchOutletMap[cityUpper] || cityBranchOutletMap["DEFAULT"];
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

/* ======================= API FUNCTIONS ======================= */

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

    console.log("📊 API Response Status:", response.status);
    console.log("📊 API Response Data:", JSON.stringify(response.data, null, 2));

    if (response.status !== 200) {
      console.log("⚠️ API Invalid Status Code:", response.status);
      return null;
    }

    if (!response.data) {
      console.log("⚠️ API returned no data");
      return null;
    }

    if (response.data.status !== 1) {
      console.log("⚠️ API Status is not 1, got:", response.data.status, "Message:", response.data.message);
      return null;
    }

    if (!response.data.data) {
      console.log("⚠️ API data field is empty");
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
      machine_latitude: customerData.machine_latitude || "0.000000",
      machine_longitude: customerData.machine_longitude || "0.000000",
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
      console.log(JSON.stringify(response.data, null, 2));
      console.log("=".repeat(120) + "\n");

      if (response.status !== 200 || !response.data || response.data.status !== 1) {
        console.log("⚠️ API Rejected:", response.data?.message || "Unknown error");
        return { success: false, error: response.data?.message || "API rejected" };
      }

      const sapId = response.data.data?.complaint_sap_id || response.data.data?.sap_id || null;
      console.log("✅ Complaint submitted successfully. SAP ID:", sapId);

      return { success: true, data: response.data, sapId };

    } catch (error) {
      const isRetryableError = ['ECONNRESET', 'ENOTFOUND', 'ETIMEDOUT', 'EHOSTUNREACH', 'ECONNREFUSED'].includes(error.code);
      
      console.error(`\n❌ ATTEMPT ${attempt}/${MAX_RETRIES} FAILED: ${error.message}`);
      
      if (isRetryableError && attempt < MAX_RETRIES) {
        console.error(`⏳ Retrying in ${RETRY_DELAY}ms...`);
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
        continue;
      }

      return { success: false, error: error.message, code: error.code, attempts: attempt };
    }
  }
}

/* ======================= ROUTES ======================= */

/* STEP 1: IVR MENU */
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
    "नमस्ते! राजेश JCB मोटर्स में आपका स्वागत है। शिकायत दर्ज करने के लिए एक दबाएं। एजेंट से बात करने के लिए दो दबाएं।"
  );

  res.type("text/xml").send(twiml.toString());
});

/* MAIN PROCESSING */
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
      const lastQ = callData.lastQuestion || "कृपया अपना जवाब बोलें।";
      ask(twiml, lastQ);
      activeCalls.set(CallSid, callData);
      return res.type("text/xml").send(twiml.toString());
    }

    const rawSpeech = cleanSpeech(SpeechResult || "");

    console.log("\n" + "=".repeat(120));
    console.log(`📞 CALL: ${CallSid} | STEP: ${callData.step} | INPUT: "${SpeechResult}" | DIGITS: "${Digits}"`);
    console.log("=".repeat(120));

    /* ===== STEP 1: IVR MENU ===== */
    if (callData.step === "ivr_menu") {
      if (Digits === "2") {
        twiml.say({ voice: "Polly.Aditi", language: "hi-IN" }, "ठीक है। आपको एजेंट से जोड़ा जा रहा है।");
        twiml.dial(process.env.HUMAN_AGENT_NUMBER);
        activeCalls.delete(CallSid);
        return res.type("text/xml").send(twiml.toString());
      }

      if (Digits === "1") {
        callData.step = "ask_chassis";
        callData.retries = 0;
        callData.lastQuestion = "कृपया अपना मशीन नंबर दर्ज करें और # दबाएँ।";
        const gather = twiml.gather({
          input: "dtmf",
          finishOnKey: "#",
          timeout: 25,
          actionOnEmptyResult: true,
          action: "/voice/process",
          method: "POST",
        });
        gather.say({ voice: "Polly.Aditi", language: "hi-IN" }, callData.lastQuestion);
        activeCalls.set(CallSid, callData);
        return res.type("text/xml").send(twiml.toString());
      }

      askDTMF(twiml, "कृपया एक या दो दबाइए।", 1);
      activeCalls.set(CallSid, callData);
      return res.type("text/xml").send(twiml.toString());
    }

    /* ===== STEP 2: ASK CHASSIS NUMBER ===== */
    if (callData.step === "ask_chassis") {
      if (Digits === "*") {
        const gather = twiml.gather({
          input: "dtmf",
          finishOnKey: "#",
          timeout: 25,
          actionOnEmptyResult: true,
          action: "/voice/process",
          method: "POST",
        });
        gather.say({ voice: "Polly.Aditi", language: "hi-IN" }, callData.lastQuestion);
        activeCalls.set(CallSid, callData);
        return res.type("text/xml").send(twiml.toString());
      }

      let inputToProcess = rawSpeech;

      if (Digits && Digits.trim().length > 0) {
        let cleanedDigits = Digits.trim();
        console.log(`📞 RAW DIGITS FROM TWILIO: "${Digits}" (Length: ${Digits.length})`);
        if (cleanedDigits.startsWith('#')) cleanedDigits = cleanedDigits.substring(1);
        if (cleanedDigits.endsWith('#')) cleanedDigits = cleanedDigits.substring(0, cleanedDigits.length - 1);
        console.log(`📞 CLEANED DIGITS: "${cleanedDigits}" (Length: ${cleanedDigits.length})`);
        console.log(`📞 DIGIT ARRAY: [${cleanedDigits.split('').join(', ')}]`);
        inputToProcess = cleanedDigits;
      }

      if (!inputToProcess || inputToProcess.trim().length === 0) {
        callData.retries = (callData.retries || 0) + 1;

        if (callData.retries >= 3) {
          twiml.say({ voice: "Polly.Aditi", language: "hi-IN" }, "कोई input नहीं मिला। आपको एजेंट से जोड़ा जा रहा है।");
          twiml.dial(process.env.HUMAN_AGENT_NUMBER);
          activeCalls.delete(CallSid);
          return res.type("text/xml").send(twiml.toString());
        }

        callData.lastQuestion = `दोबारा machine number धीरे धीरे नंबर दर्ज करें और # दबाएँ।`;
        const gather = twiml.gather({
          input: "dtmf",
          finishOnKey: "#",
          timeout: 25,
          actionOnEmptyResult: true,
          action: "/voice/process",
          method: "POST",
        });
        gather.say({ voice: "Polly.Aditi", language: "hi-IN" }, callData.lastQuestion);
        activeCalls.set(CallSid, callData);
        return res.type("text/xml").send(twiml.toString());
      }

      let chassis = extractChassisNumberV2(inputToProcess);
      let phone = extractPhoneNumberV2(inputToProcess);

      let identifier = null;
      if (chassis && isValidChassis(chassis)) {
        identifier = chassis;
      } else if (phone && isValidPhone(phone)) {
        identifier = phone;
      }

      if (!identifier) {
        callData.retries = (callData.retries || 0) + 1;

        if (callData.retries >= 3) {
          twiml.say({ voice: "Polly.Aditi", language: "hi-IN" }, "मशीन नंबर सही नहीं। आपको एजेंट से जोड़ा जा रहा है।");
          twiml.dial(process.env.HUMAN_AGENT_NUMBER);
          activeCalls.delete(CallSid);
          return res.type("text/xml").send(twiml.toString());
        }

        callData.lastQuestion = `दोबारा मशीन नंबर धीरे धीरे दर्ज करें और # दबाएँ।`;
        const gather = twiml.gather({
          input: "dtmf",
          finishOnKey: "#",
          timeout: 25,
          actionOnEmptyResult: true,
          action: "/voice/process",
          method: "POST",
        });
        gather.say({ voice: "Polly.Aditi", language: "hi-IN" }, callData.lastQuestion);
        activeCalls.set(CallSid, callData);
        return res.type("text/xml").send(twiml.toString());
      }

      /* ===== STEP 3: FETCH CUSTOMER DATA ===== */
      console.log(`🌐 Fetching customer for: ${identifier}`);

      const customerData = await fetchCustomerFromExternal({ 
        phone: /^\d{10}$/.test(identifier) ? identifier : null,
        chassisNo: !/^\d{10}$/.test(identifier) ? identifier : null
      });

      if (!customerData) {
        callData.retries = (callData.retries || 0) + 1;

        if (callData.retries >= 3) {
          twiml.say({ voice: "Polly.Aditi", language: "hi-IN" }, "मशीन रिकॉर्ड नहीं मिला। आपको एजेंट से जोड़ा जा रहा है।");
          twiml.dial(process.env.HUMAN_AGENT_NUMBER);
          activeCalls.delete(CallSid);
          return res.type("text/xml").send(twiml.toString());
        }

        callData.step = "ask_chassis";
        callData.lastQuestion = `दोबारा मशीन नंबर धीरे धीरे दर्ज करें और # दबाएँ`;
        const gather = twiml.gather({
          input: "dtmf",
          finishOnKey: "#",
          timeout: 25,
          actionOnEmptyResult: true,
          action: "/voice/process",
          method: "POST",
        });
        gather.say({ voice: "Polly.Aditi", language: "hi-IN" }, callData.lastQuestion);
        activeCalls.set(CallSid, callData);
        return res.type("text/xml").send(twiml.toString());
      }

      console.log("✅ Customer found!");
      callData.chassis = identifier;
      callData.customerData = customerData;
      callData.step = "ask_complaint_category";
      callData.retries = 0;
      callData.lastQuestion = `नमस्ते। आपकी मशीन का रिकॉर्ड मिल गया है।
सुविधा के लिए: किसी भी सवाल को फिर से सुनने के लिए star का बटन दबाएँ।

कृपया समस्या की श्रेणी चुनें।

इंजन या ट्रांसमिशन के लिए 1 दबाएँ।
हाइड्रोलिक सिस्टम के लिए 2 दबाएँ।
सिलिंडर या सील के लिए 3 दबाएँ।
बिजली या बैटरी के लिए 4 दबाएँ।
बॉडी या संरचना के लिए 5 दबाएँ।
टायर या अंडरकैरेज के लिए 6 दबाएँ।
सेवा या रखरखाव के लिए 7 दबाएँ।
अन्य समस्या के लिए 8 दबाएँ।`;
      callData.selectedCategory = null;
      askDTMF(twiml, callData.lastQuestion, 1);
      activeCalls.set(CallSid, callData);
      return res.type("text/xml").send(twiml.toString());
    }

    /* ===== STEP 4: ASK COMPLAINT CATEGORY (NUMERIC MENU) ===== */
    if (callData.step === "ask_complaint_category") {
      if (Digits === "*") {
        const categoryMenu = `कौन सी समस्या है? कृपया नंबर दबाइए:
इंजन और ट्रांसमिशन के लिए 1 दबाएँ।
हाइड्रोलिक सिस्टम के लिए 2 दबाएँ।
सिलिंडर और सील के लिए 3 दबाएँ।
बिजली और बैटरी के लिए 4 दबाएँ।
शरीर और संरचना के लिए 5 दबाएँ।
टायर और अंडरकैरिज के लिए 6 दबाएँ।
सेवा और रखरखाव के लिए 7 दबाएँ।
अन्य के लिए 8 दबाएँ।
पिछला सवाल के लिए 9 दबाएँ।`;
        askDTMF(twiml, categoryMenu, 1);
        activeCalls.set(CallSid, callData);
        return res.type("text/xml").send(twiml.toString());
      }

      if (Digits === "9") {
        // Go back to chassis number
        callData.step = "ask_chassis";
        callData.retries = 0;
        callData.lastQuestion = "नमस्ते! अपनी JCB मशीन का नंबर डालिए, फिर हैश दबाइए।";
        askDTMF(twiml, callData.lastQuestion, 7);
        activeCalls.set(CallSid, callData);
        return res.type("text/xml").send(twiml.toString());
      }

      const validCategories = ["1", "2", "3", "4", "5", "6", "7", "8"];
      
      if (!validCategories.includes(Digits)) {
        callData.retries = (callData.retries || 0) + 1;
        
        if (callData.retries >= 3) {
          callData.selectedCategory = "8";
          callData.step = "ask_sub_complaint_type";
          callData.retries = 0;
          const subMenu = getSubComplaintMenu("8") || "1 = सामान्य समस्या";
          callData.lastQuestion = `अन्य समस्या का प्रकार चुनिए: ${subMenu}`;
          askDTMF(twiml, callData.lastQuestion, 1);
          activeCalls.set(CallSid, callData);
          return res.type("text/xml").send(twiml.toString());
        }

        const categoryMenu = `कृपया 1 से 8 तक नंबर दबाइए, या 9 पिछला सवाल के लिए।`;
        askDTMF(twiml, categoryMenu, 1);
        activeCalls.set(CallSid, callData);
        return res.type("text/xml").send(twiml.toString());
      }

      callData.selectedCategory = Digits;
      callData.step = "confirm_category";
      callData.retries = 0;

      const category = complaintCategories[Digits];
      const categoryName = category.titleHindi;
      
      callData.lastQuestion = `आपने चुना: ${categoryName}। क्या यह सही है? हाँ के लिए 1 दबाएँ, नहीं के लिए 2 दबाएँ।`;
      askDTMF(twiml, callData.lastQuestion, 1);
      activeCalls.set(CallSid, callData);
      return res.type("text/xml").send(twiml.toString());
    }

    /* ===== CONFIRM CATEGORY ===== */
    if (callData.step === "confirm_category") {
      if (Digits === "*") {
        const category = complaintCategories[callData.selectedCategory];
        const categoryName = category.titleHindi;
        callData.lastQuestion = `आपने चुना: ${categoryName}। क्या यह सही है? हाँ के लिए 1 दबाएँ, नहीं के लिए 2 दबाएँ।`;
        askDTMF(twiml, callData.lastQuestion, 1);
        activeCalls.set(CallSid, callData);
        return res.type("text/xml").send(twiml.toString());
      }

      if (Digits === "1") {
        // User confirmed category - proceed to sub-complaint selection
        callData.step = "ask_sub_complaint_type";
        callData.retries = 0;

        // Check if category is "8 = Other" which has sub-categories
        if (callData.selectedCategory === "8") {
          const otherMenu = `अन्य समस्याओं में से कौन सी है? कृपया अपनी समस्या चुनें:
केबिन और ऑपरेटर सुविधा के लिए 1 दबाएँ।
कूलिंग सिस्टम विफलता के लिए 2 दबाएँ।
ईंधन प्रणाली समस्याएं के लिए 3 दबाएँ।
होज़ और पाइप क्षति के लिए 4 दबाएँ।
अटैचमेंट समस्याएं के लिए 5 दबाएँ।
स्टीयरिंग और नियंत्रण समस्याएं के लिए 6 दबाएँ।
सुरक्षा और चेतावनी प्रणाली के लिए 7 दबाएँ।
इंजन प्रबंधन और उत्सर्जन के लिए 8 दबाएँ।
पिछला सवाल के लिए 9 दबाएँ।`;
          callData.lastQuestion = otherMenu;
          askDTMF(twiml, otherMenu, 1);
          activeCalls.set(CallSid, callData);
          return res.type("text/xml").send(twiml.toString());
        }

        const category = complaintCategories[callData.selectedCategory];
        const categoryName = category.titleHindi;
        const subOptions = Object.entries(category.subComplaints)
          .map(([digit, complaint]) => `${complaint.titleHindi} के लिए ${digit} दबाएँ।`)
          .join("\n");
        
        callData.lastQuestion = `${categoryName} की कौन सी समस्या है? कृपया अपनी समस्या चुनें:\n${subOptions}`;
        askDTMF(twiml, callData.lastQuestion, 1);
        activeCalls.set(CallSid, callData);
        return res.type("text/xml").send(twiml.toString());
      } else if (Digits === "2") {
        // User rejected - go back to category selection
        callData.step = "ask_complaint_category";
        callData.retries = 0;
        callData.lastQuestion = `कृपया फिर से समस्या की श्रेणी चुनें:
इंजन या ट्रांसमिशन के लिए 1 दबाएँ।
हाइड्रोलिक सिस्टम के लिए 2 दबाएँ।
सिलिंडर या सील के लिए 3 दबाएँ।
बिजली या बैटरी के लिए 4 दबाएँ।
बॉडी या संरचना के लिए 5 दबाएँ।
टायर या अंडरकैरेज के लिए 6 दबाएँ।
सेवा या रखरखाव के लिए 7 दबाएँ।
अन्य समस्या के लिए 8 दबाएँ।`;
        askDTMF(twiml, callData.lastQuestion, 1);
        activeCalls.set(CallSid, callData);
        return res.type("text/xml").send(twiml.toString());
      } else {
        callData.retries = (callData.retries || 0) + 1;
        if (callData.retries >= 2) {
          // Default to "Yes" after 2 retries
          callData.step = "ask_sub_complaint_type";
          callData.retries = 0;

          if (callData.selectedCategory === "8") {
            const otherMenu = `अन्य समस्याओं में से कौन सी है? कृपया अपनी समस्या चुनें:
केबिन और ऑपरेटर सुविधा के लिए 1 दबाएँ।
कूलिंग सिस्टम विफलता के लिए 2 दबाएँ।
ईंधन प्रणाली समस्याएं के लिए 3 दबाएँ।
होज़ और पाइप क्षति के लिए 4 दबाएँ।
अटैचमेंट समस्याएं के लिए 5 दबाएँ।
स्टीयरिंग और नियंत्रण समस्याएं के लिए 6 दबाएँ।
सुरक्षा और चेतावनी प्रणाली के लिए 7 दबाएँ।
इंजन प्रबंधन और उत्सर्जन के लिए 8 दबाएँ।
पिछला सवाल के लिए 9 दबाएँ।`;
            callData.lastQuestion = otherMenu;
            askDTMF(twiml, otherMenu, 1);
            activeCalls.set(CallSid, callData);
            return res.type("text/xml").send(twiml.toString());
          }

          const category = complaintCategories[callData.selectedCategory];
          const categoryName = category.titleHindi;
          const subOptions = Object.entries(category.subComplaints)
            .map(([digit, complaint]) => `${complaint.titleHindi} के लिए ${digit} दबाएँ।`)
            .join("\n");
          
          callData.lastQuestion = `${categoryName} की कौन सी समस्या है? कृपया अपनी समस्या चुनें:\n${subOptions}`;
          askDTMF(twiml, callData.lastQuestion, 1);
          activeCalls.set(CallSid, callData);
          return res.type("text/xml").send(twiml.toString());
        } else {
          callData.lastQuestion = `कृपया 1 (हाँ) या 2 (नहीं) दबाएँ।`;
          askDTMF(twiml, callData.lastQuestion, 1);
          activeCalls.set(CallSid, callData);
          return res.type("text/xml").send(twiml.toString());
        }
      }
    }

    /* ===== STEP 5: ASK SUB-COMPLAINT TYPE (NUMERIC MENU) ===== */
    if (callData.step === "ask_sub_complaint_type") {
      if (Digits === "*") {
        const category = complaintCategories[callData.selectedCategory];
        const categoryName = category.titleHindi;
        const subMenu = getSubComplaintMenu(callData.selectedCategory);
        callData.lastQuestion = `${categoryName} की कौन सी समस्या है? कृपया अपनी समस्या चुनें:\n${subMenu}`;
        askDTMF(twiml, callData.lastQuestion, 1);
        activeCalls.set(CallSid, callData);
        return res.type("text/xml").send(twiml.toString());
      }

      if (Digits === "9") {
        // Go back to category menu
        callData.step = "ask_complaint_category";
        callData.retries = 0;
        const categoryMenu = `कौन सी समस्या है? कृपया नंबर दबाइए:
इंजन और ट्रांसमिशन के लिए 1 दबाएँ।
हाइड्रोलिक सिस्टम के लिए 2 दबाएँ।
सिलिंडर और सील के लिए 3 दबाएँ।
बिजली और बैटरी के लिए 4 दबाएँ।
शरीर और संरचना के लिए 5 दबाएँ।
टायर और अंडरकैरिज के लिए 6 दबाएँ।
सेवा और रखरखाव के लिए 7 दबाएँ।
अन्य के लिए 8 दबाएँ।
पिछला सवाल के लिए 9 दबाएँ।`;
        askDTMF(twiml, categoryMenu, 1);
        activeCalls.set(CallSid, callData);
        return res.type("text/xml").send(twiml.toString());
      }

      // If category is "8 = Other", check if this is a sub-category selection (1-7)
      if (callData.selectedCategory === "8") {
        const validOtherCategories = ["1", "2", "3", "4", "5", "6", "7"];
        
        if (!validOtherCategories.includes(Digits)) {
          callData.retries = (callData.retries || 0) + 1;
          
          if (callData.retries >= 3) {
            callData.selectedOtherCategory = "1";
          } else {
            const otherMenu = `कृपया 1 से 7 तक नंबर दबाइए, या 9 पिछला सवाल के लिए।`;
            askDTMF(twiml, otherMenu, 1);
            activeCalls.set(CallSid, callData);
            return res.type("text/xml").send(twiml.toString());
          }
        }

        callData.selectedOtherCategory = Digits;
        callData.step = "ask_other_sub_type";
        callData.retries = 0;

        const otherCategory = complaintCategories["8"].subComplaints[Digits];
        const otherCategoryName = otherCategory.titleHindi;
        const otherOptions = Object.entries(otherCategory.options)
          .map(([digit, option]) => `${option.titleHindi} के लिए ${digit} दबाएँ।`)
          .join("\n");
        
        callData.lastQuestion = `${otherCategoryName} में कौन सी विशिष्ट समस्या है? कृपया चुनें:\n${otherOptions}`;
        askDTMF(twiml, callData.lastQuestion, 1);
        activeCalls.set(CallSid, callData);
        return res.type("text/xml").send(twiml.toString());
      }

      // Normal flow for categories 1-7
      const category = complaintCategories[callData.selectedCategory];
      const maxOptions = Object.keys(category.subComplaints).length;
      const subDigitInt = parseInt(Digits);
      
      if (!Digits || subDigitInt < 1 || subDigitInt > maxOptions) {
        callData.retries = (callData.retries || 0) + 1;
        
        if (callData.retries >= 3) {
          const firstKey = Object.keys(category.subComplaints)[0];
          Digits = firstKey;
        } else {
          const categoryName = category.titleHindi;
          const subMenu = getSubComplaintMenu(callData.selectedCategory);
          callData.lastQuestion = `कृपया सही नंबर दबाइए: ${subMenu}`;
          askDTMF(twiml, callData.lastQuestion, 1);
          activeCalls.set(CallSid, callData);
          return res.type("text/xml").send(twiml.toString());
        }
      }

      // Get complaint title from selection
      const complaintInfo = getComplaintTitleFromSelection(callData.selectedCategory, Digits);
      callData.complaintTitle = complaintInfo.categoryTitle || "General Problem";
      callData.complaintSubTitle = complaintInfo.complaintTitle;
      callData.machineStatus = "Running With Problem";
      
      console.log(`✓ Selected Category: ${complaintCategories[callData.selectedCategory].title}`);
      console.log(`✓ Selected Sub-Complaint: ${complaintInfo.complaintTitle}`);

      /* ===== NEXT STEP: CONFIRM COMPLAINT ===== */
      callData.step = "confirm_complaint";
      callData.retries = 0;
      callData.lastQuestion = `आपकी समस्या: ${complaintInfo.complaintTitle}। क्या यह सही है? हाँ के लिए 1 दबाएँ, नहीं के लिए 2 दबाएँ।`;
      askDTMF(twiml, callData.lastQuestion, 1);
      activeCalls.set(CallSid, callData);
      return res.type("text/xml").send(twiml.toString());
    }

    /* ===== STEP 5B: ASK OTHER SUB-TYPE (FOR CATEGORY 8 ONLY) ===== */
    if (callData.step === "ask_other_sub_type") {
      if (Digits === "*") {
        const otherCategory = complaintCategories["8"].subComplaints[callData.selectedOtherCategory];
        const otherCategoryName = otherCategory.titleHindi;
        const otherOptions = Object.entries(otherCategory.options)
          .map(([digit, option]) => `${option.titleHindi} के लिए ${digit} दबाएँ।`)
          .join("\n");
        callData.lastQuestion = `${otherCategoryName} में कौन सी विशिष्ट समस्या है? कृपया चुनें:\n${otherOptions}`;
        askDTMF(twiml, callData.lastQuestion, 1);
        activeCalls.set(CallSid, callData);
        return res.type("text/xml").send(twiml.toString());
      }

      if (Digits === "9") {
        // Go back to Other category menu
        callData.step = "ask_sub_complaint_type";
        callData.retries = 0;
        const otherMenu = `अन्य समस्याओं में से कौन सी है? नंबर दबाइए:
केबिन और ऑपरेटर सुविधा के लिए 1 दबाएँ।
कूलिंग सिस्टम विफलता के लिए 2 दबाएँ।
ईंधन प्रणाली समस्याएं के लिए 3 दबाएँ।
होज़ और पाइप क्षति के लिए 4 दबाएँ।
अटैचमेंट समस्याएं के लिए 5 दबाएँ।
स्टीयरिंग और नियंत्रण समस्याएं के लिए 6 दबाएँ।
सुरक्षा और चेतावनी प्रणाली के लिए 7 दबाएँ।
इंजन प्रबंधन और उत्सर्जन के लिए 8 दबाएँ।
पिछला सवाल के लिए 9 दबाएँ।`;
        callData.lastQuestion = otherMenu;
        askDTMF(twiml, otherMenu, 1);
        activeCalls.set(CallSid, callData);
        return res.type("text/xml").send(twiml.toString());
      }

      const otherCategory = complaintCategories["8"].subComplaints[callData.selectedOtherCategory];
      const maxOptions = Object.keys(otherCategory.options).length;
      const subDigitInt = parseInt(Digits);
      
      if (!Digits || subDigitInt < 1 || subDigitInt > maxOptions) {
        callData.retries = (callData.retries || 0) + 1;
        
        if (callData.retries >= 3) {
          const firstKey = Object.keys(otherCategory.options)[0];
          Digits = firstKey;
        } else {
          const otherCategoryName = otherCategory.titleHindi;
          const otherOptions = Object.entries(otherCategory.options)
            .map(([digit, option]) => `${option.titleHindi} के लिए ${digit} दबाएँ।`)
            .join("\n");
          callData.lastQuestion = `कृपया सही विकल्प चुनें:\n${otherOptions}\n9 के लिए पिछला सवाल दबाएँ।`;
          askDTMF(twiml, callData.lastQuestion, 1);
          activeCalls.set(CallSid, callData);
          return res.type("text/xml").send(twiml.toString());
        }
      }

      // Get the final complaint from Other sub-type
      const selectedOption = otherCategory.options[Digits];
      callData.complaintTitle = otherCategory.title;
      callData.complaintSubTitle = selectedOption.title;
      callData.machineStatus = "Running With Problem";
      
      console.log(`✓ Selected Other Category: ${otherCategory.title}`);
      console.log(`✓ Selected Final Complaint: ${selectedOption.title}`);

      /* ===== NEXT STEP: CONFIRM COMPLAINT ===== */
      callData.step = "confirm_complaint";
      callData.retries = 0;
      callData.lastQuestion = `आपकी समस्या: ${selectedOption.title}। क्या यह सही है? हाँ के लिए 1 दबाएँ, नहीं के लिए 2 दबाएँ।`;
      askDTMF(twiml, callData.lastQuestion, 1);
      activeCalls.set(CallSid, callData);
      return res.type("text/xml").send(twiml.toString());
    }

    /* ===== CONFIRM COMPLAINT ===== */
    if (callData.step === "confirm_complaint") {
      if (Digits === "*") {
        askDTMF(twiml, callData.lastQuestion, 1);
        activeCalls.set(CallSid, callData);
        return res.type("text/xml").send(twiml.toString());
      }

      if (Digits === "1") {
        // User confirmed - proceed to service date
        callData.step = "ask_service_date";
        callData.retries = 0;
        callData.lastQuestion = `धन्यवाद! अब बताइए, इंजीनियर कब आ सकता है? तारीख बोलिए: जैसे 20 फरवरी।`;
        ask(twiml, callData.lastQuestion);
        activeCalls.set(CallSid, callData);
        return res.type("text/xml").send(twiml.toString());
      } else if (Digits === "2") {
        // User rejected - go back to sub-complaint selection
        if (callData.selectedCategory === "8") {
          // Go back to Other sub-type selection
          callData.step = "ask_other_sub_type";
          callData.retries = 0;
          const otherCategory = complaintCategories["8"].subComplaints[callData.selectedOtherCategory];
          const otherCategoryName = otherCategory.titleHindi;
          const otherOptions = Object.entries(otherCategory.options)
            .map(([digit, option]) => `${option.titleHindi} के लिए ${digit} दबाएँ।`)
            .join("\n");
          callData.lastQuestion = `${otherCategoryName} में कौन सी विशिष्ट समस्या है? कृपया चुनें:\n${otherOptions}`;
          askDTMF(twiml, callData.lastQuestion, 1);
          activeCalls.set(CallSid, callData);
          return res.type("text/xml").send(twiml.toString());
        } else {
          // Go back to regular sub-complaint selection
          callData.step = "ask_sub_complaint_type";
          callData.retries = 0;
          const categoryName = complaintCategories[callData.selectedCategory].titleHindi;
          const subMenu = getSubComplaintMenu(callData.selectedCategory);
          callData.lastQuestion = `कृपया फिर से चुनें: ${subMenu}`;
          askDTMF(twiml, callData.lastQuestion, 1);
          activeCalls.set(CallSid, callData);
          return res.type("text/xml").send(twiml.toString());
        }
      } else {
        callData.retries = (callData.retries || 0) + 1;
        if (callData.retries >= 2) {
          // Default to "Yes" after 2 retries
          callData.step = "ask_service_date";
          callData.retries = 0;
          callData.lastQuestion = `धन्यवाद! अब बताइए, इंजीनियर कब आ सकता है? तारीख बोलिए: आज, कल, परसों, या विशिष्ट तारीख जैसे 15 फरवरी।`;
          ask(twiml, callData.lastQuestion);
          activeCalls.set(CallSid, callData);
          return res.type("text/xml").send(twiml.toString());
        } else {
          callData.lastQuestion = `कृपया 1 (हाँ) या 2 (नहीं) दबाएँ।`;
          askDTMF(twiml, callData.lastQuestion, 1);
          activeCalls.set(CallSid, callData);
          return res.type("text/xml").send(twiml.toString());
        }
      }
    }

    if (callData.step === "ask_service_date") {
      if (Digits === "*") {
        ask(twiml, callData.lastQuestion);
        activeCalls.set(CallSid, callData);
        return res.type("text/xml").send(twiml.toString());
      }

      // Try to extract the date from speech
      const extractedDate = extractServiceDate(rawSpeech);

      if (!extractedDate) {
        callData.retries = (callData.retries || 0) + 1;

        if (callData.retries >= 2) {
          // Use default (next day) after 2 retries
          const tomorrow = new Date();
          tomorrow.setDate(tomorrow.getDate() + 1);
          callData.serviceDate = tomorrow;
          console.log(`✓ Service Date (Default after retries): ${tomorrow.toDateString()}`);
        } else {
          callData.lastQuestion = "कृपया service date फिर से बताइए। जैसे: आज, कल, परसों, या 20 फरवरी।";
          ask(twiml, callData.lastQuestion);
          activeCalls.set(CallSid, callData);
          return res.type("text/xml").send(twiml.toString());
        }
      } else {
        callData.serviceDate = extractedDate;
        console.log(`✓ Service Date Extracted: ${extractedDate.toDateString()}`);
      }

      // Move to confirmation step
      callData.step = "confirm_service_date";
      callData.retries = 0;
      const dateOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
      const formattedDate = callData.serviceDate.toLocaleDateString('hi-IN', dateOptions);
      callData.lastQuestion = `आपने date चुनी है: ${formattedDate}। क्या यह सही है? सही के लिए 1, गलत के लिए 2।`;
      ask(twiml, callData.lastQuestion);
      activeCalls.set(CallSid, callData);
      return res.type("text/xml").send(twiml.toString());
    }

    /* ===== CONFIRM SERVICE DATE ===== */
    if (callData.step === "confirm_service_date") {
      if (Digits === "*") {
        const dateOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        const formattedDate = callData.serviceDate.toLocaleDateString('hi-IN', dateOptions);
        const msg = `आपने date चुनी है: ${formattedDate}। क्या यह सही है? सही के लिए 1, गलत के लिए 2।`;
        ask(twiml, msg);
        activeCalls.set(CallSid, callData);
        return res.type("text/xml").send(twiml.toString());
      }

      if (Digits === "1") {
        // Confirmed - move to next step
        const dateOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        const formattedDate = callData.serviceDate.toLocaleDateString('hi-IN', dateOptions);
        console.log(`✓ Service Date Confirmed: ${formattedDate}`);
        
        callData.step = "ask_from_time";
        callData.retries = 0;
        callData.lastQuestion = "धन्यवाद! अब बताइए, इंजीनियर किस समय आ सकता है? समय बोलिए: सुबह 9 बजे, दोपहर 2 बजे, शाम 5 बजे, आदि।";
        ask(twiml, callData.lastQuestion);
        activeCalls.set(CallSid, callData);
        return res.type("text/xml").send(twiml.toString());
      } else if (Digits === "2") {
        // Not confirmed - ask again
        callData.step = "ask_service_date";
        callData.retries = 0;
        callData.lastQuestion = "कृपया दोबारा service date बताइए। जैसे: आज, कल, परसों, या 20 फरवरी।";
        ask(twiml, callData.lastQuestion);
        activeCalls.set(CallSid, callData);
        return res.type("text/xml").send(twiml.toString());
      }

      // Invalid input
      ask(twiml, `कृपया 1 (हाँ) या 2 (नहीं) दबाएँ।`);
      activeCalls.set(CallSid, callData);
      return res.type("text/xml").send(twiml.toString());
    }

    /* ===== ASK FROM TIME ===== */
    if (callData.step === "ask_from_time") {
      if (Digits === "*") {
        ask(twiml, callData.lastQuestion);
        activeCalls.set(CallSid, callData);
        return res.type("text/xml").send(twiml.toString());
      }

      const fromTime = extractTimeV2(rawSpeech);

      if (!fromTime) {
        callData.retries = (callData.retries || 0) + 1;

        if (callData.retries >= 3) {
          callData.fromTime = "09:00 AM";
          callData.step = "ask_to_time";
          callData.retries = 0;
          callData.lastQuestion = "ठीक है, सुबह 9 बजे से ठीक है। अब बताइए, कितने बजे तक इंजीनियर काम कर सकता है?";
          ask(twiml, callData.lastQuestion);
          activeCalls.set(CallSid, callData);
          return res.type("text/xml").send(twiml.toString());
        }

        callData.lastQuestion = "समय स्पष्ट नहीं। जैसे बोलिए: 9 बजे, 2 बजे, 5 बजे।";
        ask(twiml, callData.lastQuestion);
        activeCalls.set(CallSid, callData);
        return res.type("text/xml").send(twiml.toString());
      }

      console.log(`✓ From Time: ${fromTime}`);
      callData.fromTime = fromTime;
      callData.toTime = "05:00 PM"; // Default end time
      
      callData.step = "ask_job_location";
      callData.retries = 0;
      callData.lastQuestion = "धन्यवाद। अब बताइए - आपकी मशीन कहाँ है? 1 दबाइए साइट पर, 2 दबाइए वर्कशॉप में।";
      askDTMF(twiml, callData.lastQuestion, 1);
      activeCalls.set(CallSid, callData);
      return res.type("text/xml").send(twiml.toString());
    }

    /* ===== STEP 11: ASK JOB LOCATION ===== */
    if (callData.step === "ask_job_location") {
      if (Digits === "*") {
        askDTMF(twiml, callData.lastQuestion, 1);
        activeCalls.set(CallSid, callData);
        return res.type("text/xml").send(twiml.toString());
      }

      if (Digits === "1") {
        callData.jobLocation = "Onsite";
        console.log(`✓ Location: Onsite`);
      } else if (Digits === "2") {
        callData.jobLocation = "Workshop";
        console.log(`✓ Location: Workshop`);
      } else {
        callData.retries = (callData.retries || 0) + 1;
        if (callData.retries >= 3) {
          callData.jobLocation = "Onsite";
        } else {
          askDTMF(twiml, "एक या दो दबाइए।", 1);
          activeCalls.set(CallSid, callData);
          return res.type("text/xml").send(twiml.toString());
        }
      }

      // Skip caller name - use phone number from $callData.from
      callData.callerName = callData.from || "Unknown";
      console.log(`✓ Contact Person Phone: ${callData.from}`);
      
      callData.step = "ask_machine_address";
      callData.retries = 0;
      callData.lastQuestion = "धन्यवाद। अब बताइए, मशीन का सटीक पता / एड्रेस क्या है? जैसे: प्लॉट नंबर, गली, मोहल्ला, आदि।";
      ask(twiml, callData.lastQuestion);
      activeCalls.set(CallSid, callData);
      return res.type("text/xml").send(twiml.toString());
    }

    /* ===== ASK MACHINE ADDRESS ===== */
    if (callData.step === "ask_machine_address") {
      if (Digits === "*") {
        ask(twiml, callData.lastQuestion);
        activeCalls.set(CallSid, callData);
        return res.type("text/xml").send(twiml.toString());
      }

      if (rejectInvalid(rawSpeech)) {
        callData.retries = (callData.retries || 0) + 1;

        if (callData.retries >= 3) {
          callData.machineAddress = "Not Provided";
          callData.city = callData.customerData?.city || "Unknown";
          callData.step = "ask_pincode";
          callData.retries = 0;
          callData.lastQuestion = "धन्यवाद। अब अपना 6 अंकों का पिनकोड बताइए। जैसे: 3 0 3 1 5 4।";
          ask(twiml, callData.lastQuestion);
          activeCalls.set(CallSid, callData);
          return res.type("text/xml").send(twiml.toString());
        }

        callData.lastQuestion = "कृपया मशीन का पता बोलिए।";
        ask(twiml, callData.lastQuestion);
        activeCalls.set(CallSid, callData);
        return res.type("text/xml").send(twiml.toString());
      }

      const machineAddress = extractLocationAddressV2(rawSpeech);

      if (!machineAddress || !isValidAddress(machineAddress)) {
        callData.retries = (callData.retries || 0) + 1;

        if (callData.retries >= 3) {
          callData.machineAddress = "Not Provided";
          callData.city = callData.customerData?.city || "Unknown";
          callData.step = "ask_pincode";
          callData.retries = 0;
          callData.lastQuestion = "धन्यवाद। अब अपना 6 अंकों का पिनकोड बताइए। जैसे: 3 0 3 1 5 4।";
          ask(twiml, callData.lastQuestion);
          activeCalls.set(CallSid, callData);
          return res.type("text/xml").send(twiml.toString());
        }

        callData.lastQuestion = "कृपया सही पता बोलिए।";
        ask(twiml, callData.lastQuestion);
        activeCalls.set(CallSid, callData);
        return res.type("text/xml").send(twiml.toString());
      }

      // Convert address to English before storing
      const englishAddress = safeAscii(machineAddress);
      console.log(`✓ Machine Address (Hindi): ${machineAddress}`);
      console.log(`✓ Machine Address (English): ${englishAddress}`);
      callData.machineAddress = englishAddress;
      callData.city = callData.customerData?.city || "Unknown";
      
      callData.step = "ask_pincode";
      callData.retries = 0;
      callData.lastQuestion = "धन्यवाद। अब अपना 6 अंकों का पिनकोड बताइए। जैसे: 3 0 3 1 5 4।";
      ask(twiml, callData.lastQuestion);
      activeCalls.set(CallSid, callData);
      return res.type("text/xml").send(twiml.toString());
    }

    /* ===== ASK PINCODE ===== */
    if (callData.step === "ask_pincode") {
      if (Digits === "*") {
        ask(twiml, callData.lastQuestion);
        activeCalls.set(CallSid, callData);
        return res.type("text/xml").send(twiml.toString());
      }

      if (rejectInvalid(rawSpeech)) {
        callData.retries = (callData.retries || 0) + 1;

        if (callData.retries >= 3) {
          callData.pincode = "000000";
          callData.city = "Unknown";
          callData.step = "submit_complaint";
          callData.retries = 0;
          console.log(`✓ Pincode: Default (000000)`);
          // Directly submit
          return handleComplaintSubmission(CallSid, twiml, res, callData);
        }

        ask(twiml, callData.lastQuestion);
        activeCalls.set(CallSid, callData);
        return res.type("text/xml").send(twiml.toString());
      }

      const pincode = extractPincodeV2(rawSpeech);

      if (!pincode || !isValidPincode(pincode)) {
        callData.retries = (callData.retries || 0) + 1;

        if (callData.retries >= 3) {
          callData.pincode = "000000";
          callData.city = "Unknown";
          callData.step = "submit_complaint";
          callData.retries = 0;
          console.log(`✓ Pincode: Default (000000)`);
          // Directly submit
          return handleComplaintSubmission(CallSid, twiml, res, callData);
        }

        callData.lastQuestion = "कृपया सही 6 अंकों का पिनकोड बोलिए।";
        ask(twiml, callData.lastQuestion);
        activeCalls.set(CallSid, callData);
        return res.type("text/xml").send(twiml.toString());
      }

      console.log(`✓ Pincode: ${pincode}`);
      callData.pincode = pincode;
      callData.city = callData.city || "Unknown";
      
      // Merge address and pincode into location field
      callData.location = `${callData.machineAddress} - ${pincode}`;
      console.log(`✓ Location (merged): ${callData.location}`);

      /* ===== SUBMIT COMPLAINT ===== */
      callData.step = "submit_complaint";
      callData.retries = 0;
      return handleComplaintSubmission(CallSid, twiml, res, callData);
    }

    activeCalls.set(CallSid, callData);
    res.type("text/xml").send(twiml.toString());
  } catch (error) {
    console.error("❌ Call Processing Error:", error);
    const twiml = new VoiceResponse();
    twiml.say({ voice: "Polly.Aditi", language: "hi-IN" }, "तकनीकी समस्या है। आपको एजेंट से जोड़ा जा रहा है।");
    twiml.dial(process.env.HUMAN_AGENT_NUMBER);
    return res.type("text/xml").send(twiml.toString());
  }
});

/* ===== HELPER: SUBMIT COMPLAINT ===== */
async function handleComplaintSubmission(CallSid, twiml, res, callData) {
  try {
    // Get branch and outlet based on city
    const branchOutlet = getBranchOutletByCity(callData.city || "Unknown");

    const complaintData = {
      machine_no: callData.chassis || "Unknown",
      customer_name: safeAscii(callData.customerData?.name || "Unknown"),
      caller_name: safeAscii(callData.from || "Unknown"),
      caller_no: callData.from || callData.customerData?.phone || "Unknown",
      contact_person: safeAscii(callData.from || "Unknown"),
      contact_person_number: callData.from || callData.customerData?.phone || "Unknown",
      machine_model: callData.customerData?.machineType || "Unknown",
      sub_model: callData.customerData?.model || "NA",
      installation_date: "2025-01-01",
      machine_type: callData.complaintTitle || "Service",
      city_id: "1",
      complain_by: "Customer",
      machine_status: callData.machineStatus || "Running With Problem",
      job_location: callData.jobLocation || "Onsite",
      branch: branchOutlet.branch,
      outlet: branchOutlet.outlet,
      complaint_details: callData.rawComplaint || callData.complaintTitle || "Not provided",
      complaint_title: callData.complaintTitle || "General Problem",
      sub_title: callData.complaintSubTitle || "Other",
      business_partner_code: callData.customerData?.businessPartnerCode || "NA",
      complaint_sap_id: "NA",
      machine_location: callData.location || callData.pincode || "000000",
      service_date: formatDate(callData.serviceDate) || "",
      from_time: formatTimeToTwelveHour(callData.fromTime) || "",
      to_time: formatTimeToTwelveHour(callData.toTime) || "",
      job_close_lat: callData.customerData?.machine_latitude || "0.000000",
      job_close_lng: callData.customerData?.machine_longitude || "0.000000",
      job_open_lat: callData.customerData?.machine_latitude || "0.000000",
      job_open_lng: callData.customerData?.machine_longitude || "0.000000",
      job_close_address: safeAscii(callData.location || callData.machineAddress || ""),
      job_open_address: safeAscii(callData.location || callData.machineAddress || ""),
      job_close_city: callData.city || "Unknown",
      job_open_city: callData.city || "Unknown",
    };

    console.log("\n" + "=".repeat(120));
    console.log("📤 SUBMITTING COMPLAINT");
    console.log("=".repeat(120));
    console.log(`🔧 Chassis: ${callData.chassis}`);
    console.log(`👤 Contact Person Phone: ${callData.from}`);
    console.log(`🎯 Complaint: ${callData.complaintTitle} → ${callData.complaintSubTitle}`);
    console.log(`📅 Date: ${formatDate(callData.serviceDate)}`);
    console.log(`⏰ Time: ${callData.fromTime} - ${callData.toTime}`);
    console.log(`📍 Location: ${callData.jobLocation}`);
    console.log(`🏠 Address & Pincode: ${callData.location}`);
    console.log(`🏢 Branch: ${branchOutlet.branch}, Outlet: ${branchOutlet.outlet}`);
    console.log(`📌 City: ${callData.city}`);
    console.log("=".repeat(120) + "\n");

    const result = await submitComplaintToExternal(complaintData);

    if (result.success && result.sapId) {
      const sapDigits = result.sapId.toString().split('').join(' ');
      twiml.say(
        { voice: "Polly.Aditi", language: "hi-IN" },
        `धन्यवाद! आपकी complaint successfully register हो गई है। आपका complaint number है: ${sapDigits}। कृपया इसे नोट कर लें। हमारा engineer जल्दी ही आपसे contact करेगा। धन्यवाद!`
      );
    } else {
      twiml.say(
        { voice: "Polly.Aditi", language: "hi-IN" },
        "धन्यवाद! आपकी complaint register हो गई है। हमारी team आपको contact करेगी। धन्यवाद!"
      );
    }

    twiml.hangup();
    activeCalls.delete(CallSid);
    return res.type("text/xml").send(twiml.toString());
  } catch (error) {
    console.error("❌ Submission Error:", error);
    twiml.say({ voice: "Polly.Aditi", language: "hi-IN" }, "तकनीकी समस्या है। कृपया बाद में फिर से कोशिश करें.");
    twiml.hangup();
    activeCalls.delete(CallSid);
    return res.type("text/xml").send(twiml.toString());
  }
}

export default router;