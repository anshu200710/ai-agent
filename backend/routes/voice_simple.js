import express from "express";
import twilio from "twilio";
import axios from "axios";
import {
  extractPincodeV2,
  isValidPhone,
  isValidChassis,
  isValidPincode,
  convertHindiToEnglish,
  detectCustomerPattern
} from '../utils/improved_extraction.js';

const router = express.Router();
const VoiceResponse = twilio.twiml.VoiceResponse;

const activeCalls = new Map();

/* ======================= EXTERNAL API CONFIG ======================= */
const EXTERNAL_API_BASE = "http://192.168.1.92/jcbServiceEnginerAPIv7";
const COMPLAINT_API_URL = "http://192.168.1.92/jcbServiceEnginerAPIv7/ai_call_complaint.php";
const API_TIMEOUT = 20000;
const API_HEADERS = { JCBSERVICEAPI: "MakeInJcb" };

/* ======================= DIGIT WORD MAP (Hindi + English + Hinglish) ======================= */
const DIGIT_WORD_MAP = {
  // Hindi
  'शून्य': '0', 'सुन्य': '0', 'सून्य': '0', 'जीरो': '0', 'जीरों': '0',
  'एक': '1',  'इक': '1', 'एक्क': '1',
  'दो': '2',  'दो ': '2',
  'तीन': '3', 'तिन': '3', 'टीन': '3',
  'चार': '4', 'चार्स': '4',
  'पाँच': '5','पांच': '5','पाच': '5', 'पंच': '5',
  'छह': '6',  'छः': '6',  'छ': '6',  'छे': '6', 'छ्ह': '6',
  'सात': '7', 'साथ': '7',
  'आठ': '8',  'अठ': '8',
  'नौ': '9',  'नो': '9',  'नव': '9',
  // English
  'zero': '0','oh': '0','o': '0',
  'one': '1',
  'two': '2', 'to': '2',
  'three': '3',
  'four': '4','for': '4',
  'five': '5',
  'six': '6',
  'seven': '7',
  'eight': '8','ate': '8',
  'nine': '9',
  // Hinglish
  'ek': '1',
  'do': '2',
  'teen': '3','tin': '3',
  'char': '4','chaar': '4',
  'panch': '5','paanch': '5',
  'chhah': '6','chhe': '6','chheh': '6',
  'saat': '7','sat': '7',
  'aath': '8','ath': '8',
  'nau': '9', 'nao': '9',
};

/* ---- NOISE WORDS TO IGNORE when extracting digits ---- */
const IGNORE_WORDS = new Set([
  'mera','meri','mere','mera','hamara','hamaara',
  'number','no','num','n','nmbr',
  'machine','chassis','engine',
  'hai','hain','he','ha','h',
  'ka','ki','ke','ko','se','par','pe',
  'aapka','apna','mhara','mharo',
  'phone','mobile','contact','call',
  'batata','bata','bolunga','bolunga',
  'yeh','ye','yahi','vo','wo',
  'aur','bhi','sirf','bas',
  'the','a','an','is','and','or','my','your',
  'okay','ok','theek','thik','haan','ji','yes',
  'नंबर','नम्बर','मशीन','मेरा','मेरी','मेरे','आपका','आपकी',
  'फ़ोन','मोबाइल','है','हैं','का','की','के','को','से',
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
  if (!text) return '';
  const processed = text.toLowerCase().replace(/[।,!?;|]/g, ' ');

  // ── Strip verb-suffix phrases that contain "do/दो" or "lo/ले" ──
  // e.g. "kar do", "bata do", "de do", "kar lo", "le lo", "save kar do"
  const verbNoise = processed
    .replace(/\b(kar|karo|karke|karein|bata|bolo|dedo|de|save|sev|chalao|chalana|chalte|ruk|ruko|sun|suno|lelo|le)\s+(do|दो|lo|लो|dena|लेना|देना)\b/gi, ' ')
    .replace(/\b(do|दो)\s+(baar|bar|minute|min|second|sec)\b/gi, ' ');  // "do baar" = twice, not digit

  const tokens = verbNoise.split(/[\s\-\/]+/).filter(t => t.length > 0);
  let result = '';

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
  if (digits.length < 2) return '';
  return digits;
}

/* ======================= KEYWORDS ======================= */
const affirmativeKeywords = [
  // Hindi
  'हान','हां','हाँ','जी','सही','ठीक','बिल्कुल','ठीक है','सही है', 'हां जी',
  'जी हां','जी हाँ','हां जी','हाँ जी','बिल्कुल सही','जी सर','जी मैडम',
  'अच्छा','ओके','ठीक रहेगा','चलेगा','हो गया','माना','दिया','करो','कर दो',
  'सही है','ठीक है','बराबर है','दर्ज करो','दर्ज कर','रजिस्टर करो', 'आज मेरी है!', 'मेरी है!',
  // Hinglish / English
  'yes','yep','yeah','yup','sure','correct','right','ok','okay',
  'fine','good','ji','sahi','theek','thik','bilkul','haan','han',
  'absolutely','definitely','affirmative','confirmed','agreed',
  'kar do','save karo','register karo','darz karo','likh lo',
];

const negativeKeywords = [
  'नहीं','नही','ना','नाह','न','गलत','गलत है',
  'ये नहीं','यह नहीं','मत','मत करो','रहने दो','जरूरत नहीं',
  'ठीक नहीं','बिल्कुल नहीं','नहीं भाई',
  'no','nope','nah','na','not','dont',"don't",'never','negative',
  'wrong','incorrect','galat','nai','nei','disagree','neither'
];

// Phrases where "nahi" appears BUT the intent is actually to confirm/accept
// e.g. "नहीं अब सही है" = "no [nothing more], it's correct now"
const falseNegativePhrases = [
  'नहीं अब सही','nahi ab sahi','nahi sahi hai','नहीं बस सही','नहीं ठीक है',
  'नहीं बस इतना','nahi bas itna','nahi sab theek','नहीं सब ठीक','no sab sahi',
  'nahi ab theek','नहीं अब ठीक','bas sahi hai','बस सही है','बस ठीक है',
  'nahi aur kuch nahi','नहीं और कुछ नहीं','bas yahi','बस यही','इतना ही काफी',
];

/**
 * isFalseNegative — detects phrases that CONTAIN "nahi" but actually mean "done/confirmed"
 * e.g. "नहीं अब सही है सब कुछ" → customer saying "no [more issues], it's all correct"
 */
function isFalseNegative(text) {
  if (!text) return false;
  const t = text.toLowerCase();
  return falseNegativePhrases.some(p => t.includes(p.toLowerCase()));
}

const uncertaintyKeywords = [
  'पता नहीं','पता नही','पता न','मुझे पता नहीं','मुझे नहीं पता',
  'मालूम नहीं','मालूम नही','नहीं मालूम','जानकारी नहीं',
  'याद नहीं','याद नही','नहीं याद','भूल गया','भूल गयी',
  'समझ नहीं','समझ नही','नहीं समझ आ रहा','समझ नहीं आया',
  'dont know','do not know',"don't know",'dunno','no idea','no clue',
  'not sure','uncertain','forget','forgot','forgotten',"can't remember"
];

const repeatKeywords = ['repeat','dobara','fir se','phir se','dubara','again','once more','samjha nahi','क्या बोला'];
const pauseKeywords = ['रुको','रुक','रुकिए','ek minute','ek min','hold','एक मिनट','एक पल'];

/* ======================= MACHINE TYPES ======================= */
const machineTypeKeywords = {
  'Warranty': ['वारंटी','warranty','गारंटी','guarantee','free','फ्री','मुफ्त'],
  'JCB Care': ['जीसीबी केयर','jcb care','केयर','care','annual','yearly'],
  'Engine Care': ['इंजन केयर','engine care','engine protection'],
  'Demo': ['डेमो','demo','demonstration','test machine'],
  'BHL': ['बीएचएल','bhl','backhoe','back hoe']
};

const machineStatusKeywords = {
  'Breakdown': [
    'ब्रेकडाउन','breakdown','break down','बिल्कुल बंद','बंद है','बंद हो गया',
    'पूरा बंद','डाउन है','बिल्कुल काम नहीं','काम ही नहीं कर रहा',
    'शुरू नहीं हो रहा','स्टार्ट नहीं हो रहा','खराब हो गया','मर गया',
    'start nahi ho raha','chalu nahi ho raha','dead','stopped completely'
  ],
  'Running With Problem': [
    'चल रहा है लेकिन','chal raha hai lekin','चल तो रहा है',
    'running with problem','working with issue','working but','partially working'
  ]
};

const jobLocationKeywords = {
  'Workshop': [
    'वर्कशॉप','workshop','शॉप','shop','गैरेज','garage','घर पर','घर',
    'घर में','home','होम','गोदाम','शेड','shed','service center'
  ],
  'Onsite': [
    'साइट','site','साइट पर','खेत','खेत में','field','फील्ड','जगह',
    'बाहर','outdoor','काम की जगह','construction','project','road','हाईवे'
  ]
};

/* ======================= COMPREHENSIVE COMPLAINT MAP ======================= */
const complaintMap = {
  "Engine": {
    keywords: ["engine","motor","इंजन","मोटर","चालू नहीं","शुरू नहीं","मशीन चालू नहीं","मशीन स्टार्ट नहीं","मोटर खराब","इंजन खराब","इंजिन","start नहीं","chalu नहीं","शुरुआत नहीं","run नहीं","झटके","थरथार"],
    priority: 10,
    subTitles: {
      "Start Problem": ["start","स्टार्ट नहीं","शुरू नहीं","chalu nahi","चालू नहीं","starter","cranking","बंद है","मर गया","डेड"],
      "Overheating": ["overheat","गर्म","गरम","heat","temperature","गर्मी","बहुत गर्म","high temperature","आग"],
      "Black Smoke": ["smoke","धुआ","काला धुआ","black smoke","smoking","fumes","dhaua"],
      "Loss of Power": ["power कम","weak","कमजोर","no power","slow","sluggish","तेजी नहीं","गति नहीं"],
      "Knocking Noise": ["knock","knocking","टकटक","chattering","खटाखट","खड़खड़"],
      "Diesel Leak": ["leak","लीक","fuel leak","diesel बह रहा","ईंधन लीक","तेल निकल रहा"],
      "Abnormal Noise": ["noise","आवाज","sound","शोर","grinding","whining","whistling"],
      "Fuel Consumption": ["fuel","petrol","diesel","खर्च","consumption","mileage","ईंधन खपत"],
      "Misfire": ["misfire","coughing","jerking","stumbling","कंपन","झटका","थरथराना"]
    }
  },
  "Starting Trouble": {
    keywords: [
      // Hindi
      "स्टार्ट नहीं","चालू नहीं","शुरू नहीं","बंद है","चालू नहीं हो रहा",
      "स्टार्ट नहीं हो रहा","मशीन नहीं चली","इग्निशन नहीं","क्रैंक",
      "स्टार्टिंग","शुरु नहीं","शुरुआत नहीं","स्टार्ट नहीं होता",
      "स्टार्टर खराब","स्टार्टर समस्या","शुरुआत की समस्या","चालू करने में समस्या",
      "मशीन स्टार्ट नहीं हो रही","स्टार्ट करना मुश्किल","स्टार्ट नहीं हो पा रहा",
      // English/Hinglish
      "starting","start nahi","chalu nahi","band hai","start ho nahi raha",
      "start problem","starting problem","start nahi hota","start issue",
      "cold start","hard start","slow start","no start","wont start",
      "start nahi ho raha","start hi nahi","engine start","crank","ignition",
      "start karna","starting trouble","shuru nahi","starter","starter problem",
      "starting issue","won't start","doesn't start","fails to start"
    ],
    priority: 10,
    subTitles: {
      "No Start Condition":  ["no start","बिल्कुल नहीं","शुरू ही नहीं","dead","complete fail","wont start","start hi nahi","bilkul nahi","engine hi nahi"],
      "Hard Starting":       ["hard start","कठिन","मुश्किल से","कई बार","attempt","mushkil","baar baar"],
      "Cold Starting Issue": ["cold start","सर्द","ठंड में","morning","raat ke baad","subah","sardi"],
      "Slow Starting":       ["slow start","धीमा","samay lagta","late","dheere","der lagti"],
      "Cranking Weak":       ["cranking","weak crank","कमजोर क्रैंक","rpm","turnover","ghoomta nahi"],
      "Self Starter Fail":   ["self","self starter","self nahi","सेल्फ","सेल्फ नहीं","self problem"]
    }
  },
  "Transmission": {
    keywords: ["transmission","gear","shift","गियर","ट्रांसमिशन","gear box","ट्रांसमिशन खराब","गियर समस्या","शिफ्ट","gear change","shifting","नहीं लग रहा","गियर नहीं लग"],
    priority: 9,
    subTitles: {
      "Gear Shifting Hard": ["shift hard","shift difficult","gear नहीं लग रहा","grinding","stuck","jam","मुश्किल","जाम हो गया"],
      "Slipping": ["slipping","rpm बढ़ रहा","power loss","slip करना","खिसकना"],
      "Neutral Problem": ["neutral","neutral में फंस","न्यूट्रल"],
      "Gear Grinding": ["grind","grinding","grinding noise","scraping","चरमरा","खरखराहट"]
    }
  },
  "Hydraulic System": {
    keywords: ["hydraulic","pressure","pump","हाइड्रोलिक","पंप","दबाव","प्रेशर","pressure कम","दबाव कम","hydraulic oil","हाइड्रोलिक तेल","loader","bucket","boom","arm"],
    priority: 9,
    subTitles: {
      "Low Pressure": ["pressure कम","प्रेशर कम","दबाव कम","low","weak","slow","तेजी नहीं","स्पीड कम"],
      "Bucket Not Lifting": ["bucket नहीं उठ","lift नहीं","boom slow","arm नहीं उठ","उठता नहीं","बाल्टी नहीं"],
      "Hydraulic Leak": ["leak","लीक","oil leak","seeping","बह रहा","dripping","तेल गिरना"],
      "Pump Failure": ["pump fail","pump नहीं","pump problem","पंप खराब","पंप मर गया"],
      "Cylinder Problem": ["cylinder","cylinder leak","rod","seal","सिलेंडर"],
      "Hose Pressure": ["hose","hose leak","pipe burst","नली","पाइप"]
    }
  },
  "Braking System": {
    keywords: ["brake","ब्रेक","braking","stop","रोक","पैडल","brake pedal","ब्रेकिंग","ब्रेक खराब","रुकना मुश्किल","disc brake","band brake"],
    priority: 10,
    subTitles: {
      "Brake Not Working": ["brake काम नहीं","no braking","brake fail","नहीं रुक रहा","ब्रेक नहीं","रोकना नहीं"],
      "Weak Braking": ["brake कमजोर","weak","slow stop","soft pedal","दुर्बल","हल्का"],
      "Brake Pads Worn": ["pads","pad worn","पैड","पैड पहना","पैड टूटा","घिसाव"],
      "Brake Fluid Leak": ["fluid leak","brake leak","पेडल दबता नहीं","spongy pedal","तरल लीक"],
      "Brake Noise": ["noise","squealing","grinding","creaking","screeching","शोर","चीख"]
    }
  },
  "Electrical System": {
    keywords: ["electrical","battery","light","बिजली","बैटरी","स्टार्टर","अल्टरनेटर","wiring","spark","ignition"],
    priority: 8,
    subTitles: {
      "Battery Problem": ["battery","dead","weak","बैटरी नहीं चार्ज","charge नहीं हो रहा"],
      "Starter Motor": ["starter","स्टार्टर","cranking weak","starter खराब","no crank"],
      "Alternator Problem": ["alternator","charge नहीं","alternator खराब","बिजली नहीं"],
      "Wiring Issue": ["wiring","wire","short","spark","electrical short"],
      "Light Problem": ["light","लाइट","headlight","taillight","बत्ती नहीं जल रही"]
    }
  },
  "Cooling System": {
    keywords: ["cooling","coolant","radiator","fan","पंखा","ठंडा करना","water pump","thermostat","temperature","water system"],
    priority: 8,
    subTitles: {
      "Radiator Leak": ["radiator leak","radiator खराब","पानी निकल रहा","water leak"],
      "Fan Problem": ["fan","पंखा","fan काम नहीं","fan slow","fan noise"],
      "Thermostat": ["thermostat","temperature control","temp problem"],
      "Water Pump": ["pump","पंप","water नहीं घूम रहा","pump leak"]
    }
  },
  "AC/Cabin": {
    keywords: [
      // Hindi — the critical ones that were missing
      "ऐसी","एसी","ए.सी","ए सी","एअर कंडीशनर","एयर कंडीशनर",
      "ठंडा नहीं","ठंडक नहीं","गरम हवा","कैबिन गर्म","ठंडी नहीं",
      "ऐसी खराब","एसी खराब","ऐसी बंद","एसी बंद","ऐसी काम नहीं",
      "ब्लोअर","कंप्रेसर","कंडेंसर","फिल्टर","एसी की खराबी","एयर",
      "सी खराब","ठंडक नहीं दे रहा","हवा नहीं","ठंड नहीं आ रही",
      // English / Hinglish
      "ac","a.c","a/c","air conditioner","air conditioning",
      "esi","aisi","aesi","a c","ac nahi","ac band","ac kharab",
      "cabin cool","cooling nahi","thanda nahi","thandi nahi",
      "compressor","condenser","blower","ac filter","cabin hot",
      "ac chal nahi","ac chalta nahi","ac problem","cool nahi kar raha",
      "ac cooling","cooling band","cabin temperature","ac issue",
    ],
    priority: 8,
    subTitles: {
      "AC Not Cooling":  ["ठंडा नहीं","thanda nahi","thandi nahi","cooling नहीं","cool nahi","ac weak","temperature high","गरम हवा","hot air","ठंडक नहीं"],
      "AC Not Working":  ["ac काम नहीं","ac band","ac off","ac chalta nahi","compressor fail","कंप्रेसर","ac nahi chala","बिल्कुल बंद"],
      "Blower Problem":  ["blower","ब्लोअर","blower noise","blower kharab","hawa nahi aa rahi","हवा नहीं","fan nahi"],
      "Gas Leakage":     ["gas","gas leak","refrigerant","re-gas","gas khatam","गैस","रेफ्रिजरेंट"],
      "Filter Choked":   ["filter","filter chok","filter kharab","air flow कम","dust","jaam","जाम"]
    }
  },
  "Steering": {
    keywords: ["steering","पहिया","wheel","turn","स्टीयरिंग","पावर स्टीयरिंग","power steering","turning"],
    priority: 8,
    subTitles: {
      "Hard Steering": ["hard","heavy","कड़ा","difficult turn","मुश्किल से मुड़ता"],
      "Power Steering Fail": ["power steering","पावर खो गया","power loss","steering काम नहीं"],
      "Steering Noise": ["noise","whining","groaning","creaking"],
      "Vibration": ["vibration","shake","कंपन","road feel"]
    }
  },
  "Clutch": {
    keywords: ["clutch","क्लच","clutch pedal","disengagement","engagement","क्लच पैडल","क्लच खराब","clutch plate"],
    priority: 7,
    subTitles: {
      "Clutch Slip": ["slip","slipping","गति नहीं बढ़ रही","rpm बढ़ता है","क्लच फिसल"],
      "Hard Pedal": ["hard","tight","कड़ा","difficult depress","पेडल कड़ा","दबाना मुश्किल"],
      "Clutch Noise": ["noise","squeak","groaning","whistling","शोर","चीख"],
      "Clutch Wear": ["wear","worn","friction कम","response slow","घिसाव"]
    }
  },
  "Fuel System": {
    keywords: ["fuel","petrol","diesel","फ्यूल","tank","injector","fuel pump","fuel filter","fuel supply"],
    priority: 8,
    subTitles: {
      "Fuel Pump": ["pump","pump fail","no fuel supply","fuel नहीं आ रहा"],
      "Fuel Filter": ["filter","choke","filter खराब","fuel flow कम"],
      "Injector Problem": ["injector","injector block","spray problem"],
      "Fuel Leak": ["leak","leaking","fuel बह रहा","tank leak"]
    }
  },
  "Bucket/Boom": {
    keywords: ["bucket","boom","bucket arm","loader arm","loader","dipper","arm","bucket lift","boom not rising"],
    priority: 8,
    subTitles: {
      "Bucket Not Working": ["bucket नहीं","bucket खराब","bucket ठीक नहीं","bucket stuck"],
      "Boom Slow": ["boom slow","boom power कम","lifting slow","लिफ्टिंग कमजोर"],
      "Bucket Weld Crack": ["crack","टूटा","weld break","टूटन"],
      "Arm Bent": ["bent","टेढ़ा","damage","misalignment"]
    }
  },
  "Oil Leak": {
    keywords: ["oil leak","leak","oil","तेल","तेल बह रहा","leaking"],
    priority: 7,
    subTitles: {
      "Engine Oil Leak": ["engine","engine leak","तेल टपक रहा"],
      "Transmission Leak": ["transmission","gear oil leak"],
      "Hydraulic Leak": ["hydraulic","hydraulic fluid leak"],
      "Seal Problem": ["seal","gasket","seal खराब"]
    }
  },
  "Vibration": {
    keywords: ["vibration","shake","vibrate","कंपन","shaking","tremor"],
    priority: 6,
    subTitles: {
      "Engine Vibration": ["engine","engine shake","unbalance"],
      "Driveline Vibration": ["drive","drivetrain","transmission"],
      "Wheel Vibration": ["wheel","tyre","balancing"]
    }
  },
  "Noise": {
    keywords: ["noise","sound","आवाज","creaking","grinding","clunking","शोर","ध्वनि","खरखराहट"],
    priority: 5,
    subTitles: {
      "Engine Knocking": ["knock","knocking","ping","खटाखट","टकटक"],
      "Grinding": ["grinding","grinding noise","metal sound","अपघर्षण"],
      "Squealing": ["squeal","squealing","high pitch","चीख"],
      "Clunking": ["clunk","clanking","metallic","धड़ाम"]
    }
  },
  "General Problem": {
    keywords: ["problem","issue","समस्या","दिक्कत","खराब","trouble","परेशानी"],
    priority: 1,
    subTitles: {
      "Service Needed": ["service","maintenance","check","inspection","सेवा","रखरखाव"],
      "Other": ["other","general","कुछ खराब","और","अन्य"]
    }
  }
};

/* ======================= CITY MAPPING ======================= */
const cityToBranchMap = {
  'ajmer':    { branch: "AJMER",    outlet: "AJMER",    cityCode: "1" },
  'अजमेर':   { branch: "AJMER",    outlet: "AJMER",    cityCode: "1" },
  'kekri':    { branch: "AJMER",    outlet: "KEKRI",    cityCode: "1" },
  'alwar':    { branch: "ALWAR",    outlet: "ALWAR",    cityCode: "2" },
  'अलवर':    { branch: "ALWAR",    outlet: "ALWAR",    cityCode: "2" },
  'bharatpur':{ branch: "ALWAR",    outlet: "BHARATPUR",cityCode: "2" },
  'bhilwara': { branch: "BHILWARA", outlet: "BHILWARA", cityCode: "3" },
  'भीलवाड़ा': { branch: "BHILWARA", outlet: "BHILWARA", cityCode: "3" },
  'jaipur':   { branch: "JAIPUR",   outlet: "JAIPUR",   cityCode: "4" },
  'जयपुर':   { branch: "JAIPUR",   outlet: "JAIPUR",   cityCode: "4" },
  'kota':     { branch: "KOTA",     outlet: "KOTA",     cityCode: "5" },
  'कोटा':    { branch: "KOTA",     outlet: "KOTA",     cityCode: "5" },
  'sikar':    { branch: "SIKAR",    outlet: "SIKAR",    cityCode: "6" },
  'सीकर':    { branch: "SIKAR",    outlet: "SIKAR",    cityCode: "6" },
  'udaipur':  { branch: "UDAIPUR",  outlet: "UDAIPUR",  cityCode: "7" },
  'उदयपुर':  { branch: "UDAIPUR",  outlet: "UDAIPUR",  cityCode: "7" }
};

/* ======================= SPEECH HELPERS ======================= */
function cleanSpeech(text) {
  if (!text) return "";
  return text.toLowerCase().replace(/[।.,!?]/g, "").replace(/\s+/g, " ").trim();
}

function safeAscii(text) {
  if (!text) return "Unknown";
  return text.replace(/[^\w\s\-]/g, '').trim() || "Unknown";
}

function countWords(text) {
  if (!text) return 0;
  return text.trim().split(/\s+/).filter(w => w.length > 0).length;
}

function isUncertain(text) {
  if (!text) return false;
  const t = text.toLowerCase();
  return uncertaintyKeywords.some(k => t.includes(k.toLowerCase()));
}

function isAffirmative(text) {
  if (!text) return false;
  const t = text.toLowerCase().trim();
  return affirmativeKeywords.some(k => t.includes(k.toLowerCase()));
}

function isNegative(text) {
  if (!text) return false;
  const t = text.toLowerCase().trim();
  return negativeKeywords.some(k => t.includes(k.toLowerCase()));
}

function rejectInvalid(text) {
  if (!text || text.trim().length < 2) return true;
  if (isUncertain(text)) return true;
  const t = text.toLowerCase();
  if (repeatKeywords.some(k => t.includes(k))) return true;
  if (pauseKeywords.some(k => t.includes(k))) return true;
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
  'ghar','घर','yahan','यहां','yaha','wahan','वहां','waha',
  'yahaan','wahaan','same','wahi','wahin','yahi','usi','iske',
  'save','sev','kar','karo','karna','de','do','lo','le',
  'bata','bol','number','naam','address','pata','jagah',
]);

function isValidAddress(text) {
  if (!text || text.trim().length < 8) return false;
  const t = text.trim().toLowerCase();

  // Pure yes/no is not an address
  if (isAffirmative(t) || isNegative(t)) return false;

  // Sentence about saving/actions — not an address
  if (/\b(save|sev|store|record|likho|darz|register)\b/i.test(t)) return false;

  // Contains "number" alone is not an address
  if (/^\s*(phone|mobile|contact)?\s*(number|no|num)\s*$/i.test(t)) return false;

  const tokens = t.split(/\s+/).filter(w => w.length > 0);
  if (tokens.length < 2) return false;

  // Count tokens that are real address words (not noise, not generic-only, not pure digits)
  const meaningful = tokens.filter(w =>
    !IGNORE_WORDS.has(w) &&
    !GENERIC_ONLY_WORDS.has(w) &&
    w.length > 2 &&
    !/^\d{1,3}$/.test(w)   // standalone 1-3 digit numbers are not address words
  );

  // Need at least 2 real address words (e.g. "Gandhi Nagar", "Sikar road workshop")
  return meaningful.length >= 2;
}

/* ======================= DETECTION FUNCTIONS ======================= */
function detectMachineType(text) {
  if (!text) return 'Warranty';
  const t = text.toLowerCase();
  for (const [type, keywords] of Object.entries(machineTypeKeywords)) {
    if (keywords.some(k => t.includes(k.toLowerCase()))) return type;
  }
  return 'Warranty';
}

function detectMachineStatus(text) {
  if (!text) return 'Running With Problem';
  const t = text.toLowerCase();
  if (machineStatusKeywords['Breakdown'].some(k => t.includes(k.toLowerCase()))) return 'Breakdown';
  return 'Running With Problem';
}

function detectJobLocation(text) {
  if (!text) return null;
  const t = text.toLowerCase();
  if (jobLocationKeywords['Workshop'].some(k => t.includes(k.toLowerCase()))) return 'Workshop';
  if (jobLocationKeywords['Onsite'].some(k => t.includes(k.toLowerCase()))) return 'Onsite';
  return null;
}

function detectComplaint(text) {
  if (!text) return null;
  const t = text.toLowerCase();
  let bestMatch = null;
  let highestScore = 0;

  const sorted = Object.entries(complaintMap).sort((a, b) => (b[1].priority || 0) - (a[1].priority || 0));
  for (const [category, config] of sorted) {
    let score = 0;
    for (const kw of config.keywords) {
      if (t.includes(kw.toLowerCase())) score += kw.length;
    }
    if (score > highestScore) { highestScore = score; bestMatch = category; }
  }
  console.log(`🔍 Complaint Detection: "${text}" → ${bestMatch || 'NONE'} (Score: ${highestScore})`);
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

  const sorted = Object.entries(complaintMap).sort((a, b) => (b[1].priority || 0) - (a[1].priority || 0));
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
  const specific = results.filter(r => r.complaint !== "General Problem");
  const final    = specific.length > 0 ? specific : results;

  console.log(`🔍 ALL Complaints detected (${final.length}): ${final.map(r => `${r.complaint}[${r.score}]`).join(', ') || 'NONE'}`);
  return final;
}

function detectSubComplaint(mainComplaint, text) {
  if (!mainComplaint || !complaintMap[mainComplaint]) return { subTitle: "Other", confidence: 0.5 };
  const subTitles = complaintMap[mainComplaint].subTitles;
  if (!subTitles || Object.keys(subTitles).length === 0) return { subTitle: "Other", confidence: 1.0 };

  const t = text.toLowerCase();
  let bestMatch = null;
  let highestScore = 0;

  for (const [subTitle, keywords] of Object.entries(subTitles)) {
    let score = 0;
    for (const kw of keywords) {
      if (t.includes(kw.toLowerCase())) score += kw.length;
    }
    if (score > highestScore) { highestScore = score; bestMatch = subTitle; }
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
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function extractServiceDate(text) {
  if (!text) return null;
  const t = text.toLowerCase();
  const today = new Date();
  if (/\b(आज|aaj|today)\b/i.test(t)) return today;
  if (/\b(कल|kal|tomorrow)\b/i.test(t)) { const d = new Date(today); d.setDate(d.getDate()+1); return d; }
  if (/\b(परसों|parso|parson)\b/i.test(t)) { const d = new Date(today); d.setDate(d.getDate()+2); return d; }
  const m = t.match(/\b(\d{1,2})\s*(तारीख)?\s*(को)?\b/i);
  if (m) {
    const n = parseInt(m[1]);
    if (n >= 1 && n <= 31) {
      const d = new Date(today);
      d.setDate(n);
      if (d < today) d.setMonth(d.getMonth()+1);
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
  const {
    maxSpeechTime = 60,
    timeout = 8,
    speechTimeout = "auto"
  } = options;

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
  askWithListening(twiml, text, { maxSpeechTime: 60, timeout: 8, speechTimeout: "auto" });
}

/** ask_number — extended listening for digit input (handles gaps/pauses between digit groups) */
function askNumber(twiml, text) {
  askWithListening(twiml, text, {
    maxSpeechTime: 120,  // 2 min total
    timeout: 12,          // 12 sec silence = done speaking
    speechTimeout: "auto"
  });
}

/* ======================= CHASSIS NUMBER VALIDATION ======================= */
/**
 * isValidChassisFormat — machine numbers are 4–8 digit numeric strings
 */
function isValidChassisFormat(num) {
  if (!num) return false;
  const clean = num.replace(/\D/g, '');
  return /^\d{4,8}$/.test(clean);
}

async function validateChassisViaAPI(chassisNo) {
  try {
    console.log(`\n🔍 API VALIDATION: ${chassisNo}`);
    const apiUrl = `${EXTERNAL_API_BASE}/get_machine_by_machine_no.php?machine_no=${chassisNo}`;
    const response = await axios.get(apiUrl, {
      timeout: API_TIMEOUT,
      headers: API_HEADERS,
      validateStatus: s => s < 500,
    });
    if (response.status === 200 && response.data?.status === 1 && response.data?.data) {
      const d = response.data.data;
      console.log(`   ✅ VALID — Customer: ${d.customer_name}, City: ${d.city}`);
      return {
        valid: true,
        data: {
          name:                d.customer_name         || "Unknown",
          city:                d.city                  || "Unknown",
          model:               d.machine_model         || "Unknown",
          machineNo:           d.machine_no            || chassisNo,
          phone:               d.customer_phone_no     || "Unknown",
          subModel:            d.sub_model             || "NA",
          machineType:         d.machine_type          || "Warranty",
          businessPartnerCode: d.business_partner_code || "NA",
          purchaseDate:        d.purchase_date         || "NA",
          installationDate:    d.installation_date     || "NA",
        }
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
      customer_name:  safeAscii(complaintData.customer_name  || ""),
      caller_name:    safeAscii(complaintData.caller_name    || ""),
      contact_person: safeAscii(complaintData.contact_person || ""),
      // complaint_details, machine_location_address, job_location → keep as-is
    };

    console.log("\n📤 SUBMITTING COMPLAINT:");
    console.log(JSON.stringify(sanitized, null, 2));

    const response = await axios.post(COMPLAINT_API_URL, sanitized, {
      timeout: API_TIMEOUT,
      headers: { "Content-Type": "application/json", ...API_HEADERS },
      validateStatus: s => s < 500,
    });

    if (response.status !== 200 || !response.data || response.data.status !== 1) {
      console.log("⚠️ API Rejected:", response.data?.message || "Unknown error");
      return { success: false, error: response.data?.message || "API rejected" };
    }

    const sapId = response.data.data?.complaint_sap_id || response.data.data?.sap_id || null;
    console.log("✅ Submitted. SAP ID:", sapId);
    return { success: true, data: response.data, sapId };
  } catch (e) {
    console.error("❌ Submit Error:", e.message);
    return { success: false, error: e.message };
  }
}

async function saveComplaint(callData) {
  try {
    const customer      = callData.customerData;
    const branchOutlet  = detectBranchAndOutlet(callData.city || customer.city);
    const installDate   = customer.installationDate && customer.installationDate !== "NA"
      ? formatDateForExternal(customer.installationDate) : null;

    // ── Multi-complaint: join all titles & sub-titles for API ──
    const allComplaints = callData.allComplaints || [];
    const primaryComplaint = allComplaints[0] || { complaint: callData.complaintTitle || "General Problem", subTitle: callData.complaintSubTitle || "Other" };
    const allTitles    = allComplaints.length > 1
      ? allComplaints.map(c => c.complaint).join(" | ")
      : primaryComplaint.complaint;
    const allSubTitles = allComplaints.length > 1
      ? allComplaints.map(c => c.subTitle).join(" | ")
      : primaryComplaint.subTitle;

    console.log(`📋 Complaint title(s) for API: "${allTitles}"`);
    console.log(`📋 Sub-title(s) for API:       "${allSubTitles}"`);

    const payload = {
      machine_no:               callData.chassis          || "Unknown",
      customer_name:            safeAscii(customer.name),
      caller_name:              customer.name             || "Not Provided",
      caller_no:                callData.callerPhone      || customer.phone || "Unknown",
      contact_person:           customer.name             || "Customer",
      contact_person_number:    callData.callerPhone      || customer.phone || "Unknown",
      machine_model:            customer.machineType      || "Unknown",
      sub_model:                customer.model            || "NA",
      installation_date:        installDate               || "2025-01-01",
      machine_type:             callData.machineType      || "Warranty",
      city_id:                  branchOutlet.cityCode,
      complain_by:              "Customer",
      machine_status:           callData.machineStatus    || "Running With Problem",
      job_location:             callData.jobLocation      || "Onsite",
      branch:                   branchOutlet.branch,
      outlet:                   branchOutlet.outlet,
      complaint_details:        callData.rawComplaint     || "Not provided",
      complaint_title:          allTitles,
      sub_title:                allSubTitles,
      business_partner_code:    customer.businessPartnerCode || "NA",
      complaint_sap_id:         "NA",
      machine_location_address: callData.engineerAddress  || "Not Provided",
      pincode:                  callData.pincode          || "0",
      service_date:             callData.serviceDate ? formatDateForExternal(callData.serviceDate) : "",
      from_time:                callData.fromTime         || "",
      to_time:                  callData.toTime           || "",
      job_close_lat: 0, job_close_lng: 0, job_open_lat: 0, job_open_lng: 0,
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
    partialMachineNo: "",   // accumulates digit groups for machine number
    partialPhoneNo: "",     // accumulates digit groups for phone
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
    "Namaste! Rajesh Motors mein aapka swagat hai. " +
    "Complaint register karne ke liye ek dabayein. " +
    "Agent se baat karne ke liye do dabayein."
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
      callData = { callSid: CallSid, step: "ivr_menu", retries: 0, partialMachineNo: "", partialPhoneNo: "" };
      activeCalls.set(CallSid, callData);
    }

    // Silence / empty input — repeat last question
    if (!SpeechResult && !Digits) {
      const lastQ = callData.lastQuestion || "Kripya apna jawab bolein.";
      ask(twiml, lastQ);
      activeCalls.set(CallSid, callData);
      return res.type("text/xml").send(twiml.toString());
    }

    const rawSpeech = cleanSpeech(SpeechResult || "");

    console.log(`\n${'═'.repeat(70)}`);
    console.log(`📞 [${CallSid.substring(0, 10)}] STEP: ${callData.step} | RETRY: ${callData.retries}`);
    console.log(`🎤 Speech: "${SpeechResult}"`);
    console.log(`🧹 Cleaned: "${rawSpeech}"`);
    console.log(`${'═'.repeat(70)}`);

    /* ──────────────────────────────────────────────────────
       STEP 0: IVR MENU
    ────────────────────────────────────────────────────── */
    if (callData.step === "ivr_menu") {
      if (!Digits) {
        ask(twiml, "Complaint ke liye ek dabayein. Agent ke liye do.");
        activeCalls.set(CallSid, callData);
        return res.type("text/xml").send(twiml.toString());
      }
      if (Digits === "2") {
        twiml.say({ voice: "Polly.Aditi", language: "hi-IN" }, "Theek hai. Ek agent se connect kar rahe hain. Kripya ruke.");
        twiml.dial(process.env.HUMAN_AGENT_NUMBER || "+919876543210");
        activeCalls.delete(CallSid);
        return res.type("text/xml").send(twiml.toString());
      }
      if (Digits === "1") {
        callData.step = "ask_machine_no";
        callData.retries = 0;
        callData.partialMachineNo = "";
        callData.lastQuestion = "Theek hai. Apna machine number boliye. Aap dhire dhire ek ek karke bol sakte hain.";
        askNumber(twiml, callData.lastQuestion);
        activeCalls.set(CallSid, callData);
        return res.type("text/xml").send(twiml.toString());
      }
      ask(twiml, "Galat input. Complaint ke liye ek, agent ke liye do dabayein.");
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
      const newDigits = extractOnlyDigits(rawSpeech);
      console.log(`   🔢 New digits this turn: "${newDigits}"`);
      console.log(`   📦 Partial buffer: "${callData.partialMachineNo}" | FreshStart: ${!!callData.machineNoFreshStart}`);

      // ── After a failed validation, the NEXT turn always starts a clean buffer ──
      if (callData.machineNoFreshStart) {
        callData.partialMachineNo  = "";
        callData.machineNoFreshStart = false;
      }

      callData.partialMachineNo = (callData.partialMachineNo || "") + newDigits;
      const accumulated = callData.partialMachineNo;
      console.log(`   ➕ Total buffer: "${accumulated}" (${accumulated.length} digits)`);

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
        const add = (s) => { if (s && !seen.has(s) && /^\d{4,8}$/.test(s)) { seen.add(s); list.push(s); } };

        // Exact match first (only when 4–8 digits)
        if (buf.length >= 4 && buf.length <= 8) add(buf);

        // Sliding windows: rightmost preferred (last spoken = most recent attempt)
        for (let len = Math.min(8, buf.length); len >= 4; len--) {
          add(buf.slice(-len));           // from right
          add(buf.slice(0, len));         // from left
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
            twiml.say({ voice: "Polly.Aditi", language: "hi-IN" }, "Number samajh nahi aaya. Agent se connect kar rahe hain.");
            twiml.dial(process.env.HUMAN_AGENT_NUMBER || "+919876543210");
            activeCalls.delete(CallSid);
            return res.type("text/xml").send(twiml.toString());
          }
          const noDigitHints = [
            "Sirf numbers boliye. Jaise: teen teen shunya paanch chaar chaar saat.",
            "Machine par jo number likha hai, woh ek ek karke boliye.",
            "Hindi mein bhi bol sakte hain: ek, do, teen, chaar..."
          ];
          callData.lastQuestion = noDigitHints[Math.min(callData.retries - 1, 2)];
          askNumber(twiml, callData.lastQuestion);
          activeCalls.set(CallSid, callData);
          return res.type("text/xml").send(twiml.toString());
        }
        // Some digits received, not enough — ask for rest without resetting buffer
        console.log(`   ⏳ Only ${accumulated.length} digit(s) — waiting for more`);
        callData.lastQuestion = `${accumulated.split('').join(' ')} aaya. Ab baaki digits boliye.`;
        askNumber(twiml, callData.lastQuestion);
        activeCalls.set(CallSid, callData);
        return res.type("text/xml").send(twiml.toString());
      }

      // ── We have ≥ 4 digits — try all candidates ───────────────────────────
      const candidates = buildCandidates(accumulated);
      console.log(`   🔍 Trying ${candidates.length} candidate(s): [${candidates.slice(0,6).join(', ')}${candidates.length>6?'...':''}]`);

      let validResult = null;
      let matchedCandidate = null;
      for (const candidate of candidates) {
        const r = await tryCandidate(candidate);
        if (r) { validResult = r; matchedCandidate = candidate; break; }
      }

      if (validResult) {
        // ✅ FOUND
        console.log(`   ✅ MATCHED on candidate: "${matchedCandidate}"`);
        callData.chassis             = matchedCandidate;
        callData.partialMachineNo    = "";
        callData.machineNoFreshStart = false;
        callData.customerData        = validResult.data;
        callData.step                = "confirm_customer";
        callData.retries             = 0;
        const readable = matchedCandidate.split('').join(' ');
        callData.lastQuestion = `Bahut achha! Machine number ${readable} mila. ` +
          `Naam: ${validResult.data.name}, City: ${validResult.data.city}. ` +
          `Kya yeh aapki machine hai?`;
        ask(twiml, callData.lastQuestion);
        activeCalls.set(CallSid, callData);
        return res.type("text/xml").send(twiml.toString());
      }

      // ── None of the candidates matched ────────────────────────────────────
      callData.retries = (callData.retries || 0) + 1;
      console.log(`   ❌ No match in ${candidates.length} candidates — Retry ${callData.retries}/4`);

      if (callData.retries >= 4) {
        twiml.say({ voice: "Polly.Aditi", language: "hi-IN" }, "Machine ka record nahi mila. Agent se connect kar rahe hain.");
        twiml.dial(process.env.HUMAN_AGENT_NUMBER || "+919876543210");
        activeCalls.delete(CallSid);
        return res.type("text/xml").send(twiml.toString());
      }

      // Reset buffer; next turn will start fresh (flag set here, cleared at top of next turn)
      const triedDisplay = candidates[0] ? candidates[0].split('').join(' ') : accumulated.split('').join(' ');
      callData.partialMachineNo    = "";
      callData.machineNoFreshStart = true;   // ← key flag: don't blend next turn's digits with old buffer

      const retryMessages = [
        `${triedDisplay} — yeh number hamare system mein nahi mila. Kripya machine par likha number dobara ek ek digit karke boliye.`,
        `Abhi bhi match nahi mila. Documents dekh kar poora number ek sath boliye. Jaise: 3 3 0 5 4 4 7.`,
        `Ek aur baar try karein. Number dhire aur clearly boliye, bich mein ruk sakte hain.`
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
      const name    = callData.customerData?.name || "";
      const city    = callData.customerData?.city || "";

      if (isAffirmative(rawSpeech)) {
        callData.step    = "ask_city";
        callData.retries = 0;
        callData.lastQuestion = `Bahut achha ${name} ji! Aapki machine kaunse city mein khadi hai abhi? ` +
          `Jaipur, Kota, Ajmer, Alwar, Sikar, Udaipur, ya Bhilwara?`;
        ask(twiml, callData.lastQuestion);
        activeCalls.set(CallSid, callData);
        return res.type("text/xml").send(twiml.toString());
      }

      if (isNegative(rawSpeech)) {
        callData.step             = "ask_machine_no";
        callData.retries          = 0;
        callData.partialMachineNo = "";
        callData.machineNoFreshStart = true;
        callData.lastQuestion     = "Theek hai. Phir se machine number boliye — ek ek digit clearly.";
        askNumber(twiml, callData.lastQuestion);
        activeCalls.set(CallSid, callData);
        return res.type("text/xml").send(twiml.toString());
      }

      // Ambiguous (e.g. "आप मेरी मशीन है?" — question-form, not yes/no)
      callData.retries = (callData.retries || 0) + 1;
      if (callData.retries >= 2) {
        // Assume correct and move on — don't keep customer waiting
        callData.step    = "ask_city";
        callData.retries = 0;
        callData.lastQuestion = `Theek hai. Machine kaunse city mein hai abhi?`;
        ask(twiml, callData.lastQuestion);
        activeCalls.set(CallSid, callData);
        return res.type("text/xml").send(twiml.toString());
      }
      callData.lastQuestion = `${name} ji, kya yeh aapki machine hai? Haan ya nahi boliye.`;
      ask(twiml, callData.lastQuestion);
      activeCalls.set(CallSid, callData);
      return res.type("text/xml").send(twiml.toString());
    }

    /* ──────────────────────────────────────────────────────
       STEP 3: ASK CITY (machine location)
    ────────────────────────────────────────────────────── */
    if (callData.step === "ask_city") {
      if (rejectInvalid(rawSpeech)) {
        callData.retries = (callData.retries || 0) + 1;
        if (callData.retries >= 3) {
          callData.city    = callData.customerData?.city || "NA";
          callData.step    = "ask_engineer_location";
          callData.retries = 0;
          callData.lastQuestion = "Theek hai. Engineer kahan aaye? Aapka address batayein — area aur city.";
          ask(twiml, callData.lastQuestion);
          activeCalls.set(CallSid, callData);
          return res.type("text/xml").send(twiml.toString());
        }
        ask(twiml, "City ka naam batayein. Jaise Jaipur, Kota, Ajmer.");
        activeCalls.set(CallSid, callData);
        return res.type("text/xml").send(twiml.toString());
      }

      callData.city    = rawSpeech.trim();
      callData.step    = "ask_engineer_location";
      callData.retries = 0;
      callData.lastQuestion = `Shukriya! Ab engineer kahan se aayega? ` +
        `Machine kahan rakhhi hai — area, road, ya landmark batayein.`;
      ask(twiml, callData.lastQuestion);
      activeCalls.set(CallSid, callData);
      return res.type("text/xml").send(twiml.toString());
    }

    /* ──────────────────────────────────────────────────────
       STEP 4: ASK ENGINEER BASE / ADDRESS
       SIMPLE: Accept the FIRST answer the customer gives.
       Only re-ask if they literally said nothing / pure noise.
       Never validate strictness — customer knows their address.
    ────────────────────────────────────────────────────── */
    if (callData.step === "ask_engineer_location") {
      // Only reject pure silence, uncertainty, or 1-word noise
      const isEmpty = !rawSpeech || rawSpeech.trim().length < 3;
      const isPureNoise = isEmpty || isUncertain(rawSpeech) ||
        pauseKeywords.some(k => rawSpeech.toLowerCase().includes(k));

      if (isPureNoise) {
        callData.retries = (callData.retries || 0) + 1;
        if (callData.retries >= 3) {
          // Give up and skip — use city as fallback address
          callData.engineerAddress = callData.city || "Not Provided";
          callData.jobLocation     = "Onsite";
          callData.step            = "ask_phone";
          callData.retries         = 0;
          callData.lastQuestion    = _buildPhoneQuestion(callData);
          askNumber(twiml, callData.lastQuestion);
          activeCalls.set(CallSid, callData);
          return res.type("text/xml").send(twiml.toString());
        }
        ask(twiml, "Engineer kahan aaye? Gaon, area, ya road ka naam boliye.");
        activeCalls.set(CallSid, callData);
        return res.type("text/xml").send(twiml.toString());
      }

      // Accept ANYTHING the customer says — they know their address best ✅
      const detectedLoc        = detectJobLocation(rawSpeech);
      callData.jobLocation     = detectedLoc || "Onsite";
      callData.engineerAddress = rawSpeech.trim();
      callData.retries         = 0;
      console.log(`   ✅ Address accepted: "${callData.engineerAddress}" | Type: ${callData.jobLocation}`);

      callData.step         = "ask_phone";
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
      const knownPhone = callData.customerData?.phone || "";

      // Detect "save/wahi/sahi/use this" intent — treat as confirming existing number
      const isSaveIntent = /\b(save|sev|wahi|wahin|usi|same|sahi|theek|haan|use|rakh|rakho|yahi|isko)\b/i.test(rawSpeech) &&
                           !/^\d/.test(rawSpeech.trim());

      // If customer confirms existing number (affirmative OR save-intent)
      if ((isAffirmative(rawSpeech) || isSaveIntent) && knownPhone && knownPhone !== "Unknown" && callData.partialPhoneNo === "") {
        callData.callerPhone    = knownPhone;
        callData.partialPhoneNo = "";
        callData.step           = "ask_complaint";
        callData.retries        = 0;
        callData.lastQuestion   = "Bilkul! Ab batayein — machine mein kya problem ho rahi hai? " +
          "Sab problems ek saath bata sakte hain. Engine, hydraulic, brake, gear, AC — kuch bhi.";
        ask(twiml, callData.lastQuestion);
        activeCalls.set(CallSid, callData);
        return res.type("text/xml").send(twiml.toString());
      }

      // Customer rejects known phone with no digits — collect new number
      if (isNegative(rawSpeech) && callData.partialPhoneNo === "" && knownPhone && knownPhone !== "Unknown") {
        callData.partialPhoneNo = "";
        callData.lastQuestion   = "Theek hai. Apna sahi phone number boliye ek ek digit karke.";
        askNumber(twiml, callData.lastQuestion);
        activeCalls.set(CallSid, callData);
        return res.type("text/xml").send(twiml.toString());
      }

      // Extract phone digits (noise-filtered)
      const phoneDigits = extractPhoneDigits(rawSpeech);
      console.log(`   📱 Extracted phone digits: "${phoneDigits}" | Buffer: "${callData.partialPhoneNo}"`);

      callData.partialPhoneNo = (callData.partialPhoneNo || "") + phoneDigits;
      const accumulated = callData.partialPhoneNo;
      console.log(`   ➕ Total phone: "${accumulated}" (${accumulated.length} digits)`);

      if (accumulated.length >= 10) {
        const phone = accumulated.slice(0, 10);
        callData.callerPhone    = phone;
        callData.partialPhoneNo = "";
        callData.step           = "confirm_phone";
        callData.retries        = 0;
        const readable = phone.split('').join(' ');
        callData.lastQuestion   = `Phone number hai: ${readable}. Sahi hai?`;
        ask(twiml, callData.lastQuestion);
        activeCalls.set(CallSid, callData);
        return res.type("text/xml").send(twiml.toString());
      }

      if (accumulated.length > 0 && accumulated.length < 10) {
        const readable = accumulated.split('').join(' ');
        callData.lastQuestion = `${readable} — ab baaki digits boliye.`;
        askNumber(twiml, callData.lastQuestion);
        activeCalls.set(CallSid, callData);
        return res.type("text/xml").send(twiml.toString());
      }

      // No usable digits
      callData.retries = (callData.retries || 0) + 1;
      if (callData.retries >= 4) {
        callData.callerPhone    = knownPhone || "Unknown";
        callData.partialPhoneNo = "";
        callData.step           = "ask_complaint";
        callData.retries        = 0;
        callData.lastQuestion   = "Theek hai. Ab machine ki problem batayein.";
        ask(twiml, callData.lastQuestion);
        activeCalls.set(CallSid, callData);
        return res.type("text/xml").send(twiml.toString());
      }
      callData.lastQuestion = knownPhone && knownPhone !== "Unknown"
        ? `Kya ${knownPhone.split('').join(' ')} sahi number hai? Haan ya nahi?`
        : "Phone number ek ek digit boliye.";
      askNumber(twiml, callData.lastQuestion);
      activeCalls.set(CallSid, callData);
      return res.type("text/xml").send(twiml.toString());
    }

    /* ──────────────────────────────────────────────────────
       STEP 5b: CONFIRM PHONE
    ────────────────────────────────────────────────────── */
    if (callData.step === "confirm_phone") {
      if (isAffirmative(rawSpeech)) {
        callData.step    = "ask_complaint";
        callData.retries = 0;
        callData.lastQuestion = "Bilkul! Ab mujhe batayein — machine mein kya problem ho rahi hai? " +
          "Engine, hydraulic, brake, gear, AC — detail mein batayein.";
        ask(twiml, callData.lastQuestion);
        activeCalls.set(CallSid, callData);
        return res.type("text/xml").send(twiml.toString());
      }
      if (isNegative(rawSpeech)) {
        callData.partialPhoneNo = "";
        callData.step    = "ask_phone";
        callData.retries = 0;
        callData.lastQuestion   = "Theek hai. Dobara phone number boliye.";
        askNumber(twiml, callData.lastQuestion);
        activeCalls.set(CallSid, callData);
        return res.type("text/xml").send(twiml.toString());
      }
      callData.retries = (callData.retries || 0) + 1;
      if (callData.retries >= 3) {
        callData.step    = "ask_complaint";
        callData.retries = 0;
        callData.lastQuestion = "Theek hai. Ab problem batayein.";
        ask(twiml, callData.lastQuestion);
        activeCalls.set(CallSid, callData);
        return res.type("text/xml").send(twiml.toString());
      }
      ask(twiml, "Haan ya nahi boliye.");
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
      if (rejectInvalid(rawSpeech)) {
        callData.retries = (callData.retries || 0) + 1;
        if (callData.retries >= 5) {
          twiml.say({ voice: "Polly.Aditi", language: "hi-IN" }, "Samajh nahi aaya. Agent se connect kar rahe hain.");
          twiml.dial(process.env.HUMAN_AGENT_NUMBER || "+919876543210");
          activeCalls.delete(CallSid);
          return res.type("text/xml").send(twiml.toString());
        }
        const nudges = [
          "Machine mein kya problem ho rahi hai? Engine, brake, hydraulic, gear — kuch bhi batayein.",
          "Theek se boliye — machine kya kar rahi hai ya kya nahi kar rahi?",
          "Koi avaz aa rahi? Machine chalu nahi ho rahi? Ya kuch aur?",
          "Engine, gear, brake, hydraulic, AC — kahan problem hai? Sab ek saath bata sakte hain."
        ];
        ask(twiml, nudges[Math.min(callData.retries - 1, nudges.length - 1)]);
        activeCalls.set(CallSid, callData);
        return res.type("text/xml").send(twiml.toString());
      }

      // Save / append raw complaint text
      callData.rawComplaint  = (callData.rawComplaint ? callData.rawComplaint + " | " : "") + rawSpeech;
      callData.machineStatus = detectMachineStatus(callData.rawComplaint);
      callData.machineType   = detectMachineType(callData.rawComplaint);

      // Capture job location if mentioned
      const locInComplaint = detectJobLocation(rawSpeech);
      if (locInComplaint && !callData.jobLocation) callData.jobLocation = locInComplaint;

      // Detect ALL complaints in cumulative text
      const allDetected = detectAllComplaints(callData.rawComplaint);
      console.log(`   📋 Total complaints so far: ${allDetected.length}`);

      if (allDetected.length === 0) {
        callData.retries = (callData.retries || 0) + 1;
        if (callData.retries >= 4) {
          // Fallback: save as General
          callData.allComplaints     = [{ complaint: "General Problem", subTitle: "Other", score: 0 }];
          callData.complaintTitle    = "General Problem";
          callData.complaintSubTitle = "Other";
          callData.step              = "final_confirmation";
          callData.retries           = 0;
          callData.lastQuestion      = _buildSummary(callData);
          ask(twiml, callData.lastQuestion);
          activeCalls.set(CallSid, callData);
          return res.type("text/xml").send(twiml.toString());
        }
        callData.lastQuestion = "Aur thoda detail mein batayein. Machine ka kaunsa hissa kharab hai ya kaunsi avaz aa rahi hai?";
        ask(twiml, callData.lastQuestion);
        activeCalls.set(CallSid, callData);
        return res.type("text/xml").send(twiml.toString());
      }

      // Store all detected complaints
      callData.allComplaints     = allDetected;
      callData.complaintTitle    = allDetected[0].complaint;
      callData.complaintSubTitle = allDetected[0].subTitle;
      callData.retries           = 0;
      callData.step              = "final_confirmation";

      // Go directly to final confirmation and submit — skip re-confirmation
      console.log(`   ✅ Detected ${allDetected.length} complaint(s) — proceeding to submit`);
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
    twiml.say({ voice: "Polly.Aditi", language: "hi-IN" }, "Kshama karein, ek technical problem aayi. Agent se connect kar rahe hain.");
    twiml.dial(process.env.HUMAN_AGENT_NUMBER || "+919876543210");
    return res.type("text/xml").send(twiml.toString());
  }
});

/* ======================= HELPER: Build phone question ======================= */
function _buildPhoneQuestion(callData) {
  const knownPhone = callData.customerData?.phone;
  if (knownPhone && knownPhone !== "Unknown") {
    const readable = knownPhone.split('').join(' ');
    return `Aapka phone number jo humhare paas register hai woh hai: ${readable}. ` +
      `Kya yeh sahi hai? Agar haan to haan boliye, agar nahi to sahi number boliye.`;
  }
  return "Apna phone number boliye. Ek ek digit clearly boliye.";
}

/**
 * _buildComplaintReadback — human-friendly natural readback of all complaints
 * e.g. ["Engine", "Braking System"] → "Engine aur Braking System"
 *      ["Engine", "Hydraulic System", "Noise"] → "Engine, Hydraulic System, aur Noise"
 */
function _buildComplaintReadback(complaints) {
  if (!complaints || complaints.length === 0) return "General Problem";
  
  // Build list with sub-title context
  const parts = complaints.map(c => {
    if (c.subTitle && c.subTitle !== "Other") return `${c.complaint} (${c.subTitle})`;
    return c.complaint;
  });

  if (parts.length === 1) return parts[0];
  if (parts.length === 2) return `${parts[0]} aur ${parts[1]}`;
  return `${parts.slice(0, -1).join(', ')}, aur ${parts[parts.length - 1]}`;
}

/* ======================= HELPER: Build summary for final confirmation ======================= */
function _buildSummary(callData) {
  const name      = callData.customerData?.name || "Unknown";
  const chassis   = callData.chassis            || "N/A";
  const city      = callData.city               || callData.customerData?.city || "N/A";
  const location  = callData.engineerAddress    || "Not provided";
  const phone     = callData.callerPhone        || callData.customerData?.phone || "N/A";

  // Multi-complaint readback
  const complaints     = callData.allComplaints || [];
  const complaintText  = _buildComplaintReadback(
    complaints.length > 0 ? complaints : [{ complaint: callData.complaintTitle || "General Problem", subTitle: callData.complaintSubTitle || "Other" }]
  );

  const chassisReadable = (chassis !== "N/A") ? chassis.split('').join(' ') : chassis;
  const phoneReadable   = (phone   !== "N/A") ? phone.split('').join(' ')   : phone;

  return (
    `Theek hai! Ab main aapki details confirm karta hoon. ` +
    `Naam: ${name}. ` +
    `Machine number: ${chassisReadable}. ` +
    `City: ${city}. ` +
    `Engineer address: ${location}. ` +
    `Phone: ${phoneReadable}. ` +
    `Problems: ${complaintText}. ` +
    `Kya sab sahi hai? Haan boliye to complaint register kar deta hoon.`
  );
}

/* ======================= HELPER: Submit and close call ======================= */
async function _submitAndClose(twiml, callData, CallSid) {
  const allComplaints = callData.allComplaints || [];
  const complaintsLog = allComplaints.length > 0
    ? allComplaints.map(c => `${c.complaint} (${c.subTitle})`).join(' | ')
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
      `Bilkul sahi! Aapki complaint successfully register ho gayi. ` +
      `Aapka complaint number hai: ${result.sapId.toString().split('').join(' ')}. ` +
      `Hamara engineer jald aapko contact karega. ` +
      `Rajesh Motors mein call karne ke liye dhanyavaad. Namaste!`
    );
  } else {
    twiml.say(
      { voice: "Polly.Aditi", language: "hi-IN" },
      `Shukriya! Aapki complaint register ho gayi hai. ` +
      `Hamari team aapko jald contact karegi. ` +
      `Rajesh Motors mein call karne ke liye dhanyavaad. Namaste!`
    );
  }

  twiml.hangup();
  activeCalls.delete(CallSid);
}

export default router;