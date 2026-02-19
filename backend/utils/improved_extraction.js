
/**
 * Enhanced Extraction Utilities for JCB IVR Voice Bot
 * 
 * Fixes:
 * 1. ✅ Better Name Extraction - Removes noise words like "मेरा", "पूरा", "नाम"
 * 2. ✅ Strict 6-Digit Pincode Validation
 * 3. ✅ Improved Address Extraction - Filters out pincodes and noise
 * 4. ✅ Accurate AM/PM Time Extraction - Contextual detection based on Hindi/English keywords
 * 5. ✅ Better Complaint Detection - More context-aware processing
 */

// ======================= NOISE WORDS TO FILTER =======================
const HINDI_NOISE_WORDS = [
  'मेरा', 'मेरी', 'मेरे', 'मुझे', 'मैं', 'हम', 'हमारा', 'हमारी',
  'पूरा', 'पूरी', 'पूरे', 'नाम', 'है', 'हैं', 'हो', 'हूं',
  'का', 'की', 'के', 'की', 'को', 'से', 'में', 'पर', 'पर',
  'यह', 'वह', 'ये', 'वो', 'यही', 'वही', 'एक', 'दो', 'तीन',
  'और', 'तो', 'भी', 'ही', 'तक', 'तक', 'भर', 'भर'
];

const ENGLISH_NOISE_WORDS = [
  'my', 'name', 'is', 'are', 'the', 'a', 'an', 'this', 'that',
  'these', 'those', 'be', 'have', 'has', 'had', 'do', 'does',
  'did', 'will', 'would', 'should', 'could', 'may', 'might',
  'full', 'complete', 'whole', 'entire', 'i', 'me', 'we'
];

// ======================= HINDI DIGIT WORDS =======================
const HINDI_DIGITS = {
  // 0 - शून्य / जीरो
  'शून्य': '0', 'सून्य': '0', 'जीरो': '0', 'ज़ीरो': '0', 'जिरो': '0', 'zero': '0', 'o': '0', 'oh': '0', 'ou': '0',
  
  // 1 - एक / वन
  'एक': '1', 'एेक': '1', 'one': '1', 'ek': '1', 'eka': '1', 'vun': '1', 'wan': '1', 'wun': '1', 'ek': '1',
  
  // 2 - दो / टू
  'दो': '2', 'दू': '2', 'दुई': '2', 'two': '2', 'too': '2', 'tu': '2', 'do': '2', 'dow': '2', 'dou': '2',
  
  // 3 - तीन / थ्री
  'तीन': '3', 'तिन': '3', 'three': '3', 'thee': '3', 'teen': '3', 'tin': '3', 'threen': '3', 'tinn': '3',
  
  // 4 - चार / फोर
  'चार': '4', 'चर': '4', 'four': '4', 'for': '4', 'char': '4', 'foor': '4', 'chaar': '4',
  
  // 5 - पांच / फाइव
  'पांच': '5', 'पाँच': '5', 'पञ्च': '5', 'panch': '5', 'paanch': '5', 'panc': '5', 'five': '5', 'paunch': '5', 'punch': '5', 'paunch': '5',
  
  // 6 - छः / सिक्स
  'छः': '6', 'छ': '6', 'छह': '6', 'chhe': '6', 'chhah': '6', 'chah': '6', 'six': '6', 'siks': '6', 'chha': '6',
  
  // 7 - सात / सेवन
  'सात': '7', 'साते': '7', 'saat': '7', 'seven': '7', 'savon': '7', 'savan': '7', 'sat': '7', 'saath': '7',
  
  // 8 - आठ / एट
  'आठ': '8', 'अठ': '8', 'aath': '8', 'ath': '8', 'eight': '8', 'eit': '8', 'ate': '8', 'aat': '8',
  
  // 9 - नौ / नाइन
  'नौ': '9', 'नाै': '9', 'नो': '9', 'नु': '9', 'nau': '9', 'no': '9', 'nu': '9', 'nine': '9', 'nain': '9', 'nauu': '9',
  
  // Counting units (लाख, हजार, सौ, दहाई)
  'लाख': '00000',      // 100,000 - becomes 5 zeros (not typically used in chassis, but handle it)
  'lakh': '00000',     // English
  'hazaar': '000',     // 1,000 - becomes 3 zeros
  'हजार': '000',      // Hindi
  'thousand': '000',   // English
  'sau': '00',         // 100 - becomes 2 zeros
  'सौ': '00',         // Hindi
  'hundred': '00',     // English
  'dahaai': '0',       // 10 - becomes 1 zero (rare in speech)
  'दहाई': '0',        // Hindi
  'ten': '0',          // English
  
  // Common abbreviations/slang that might appear
  'और': ' ',          // For "और" between digits
  'to': ' ',           // For "to" between digits (informal "then")
  'toh': ' ',          // Another variant
  'fir': ' ',          // "फिर" = then
  'phir': ' ',         // Alternate spelling
  'pir': ' '           // Another variant
};

// ======================= COMMON NAMES DATABASE =======================
const COMMON_NAMES = new Set([
  'राज', 'राजेश', 'अंशु', 'अंशुल', 'नीरज', 'विजय', 'संजय',
  'प्रिया', 'दीप्ति', 'शीला', 'माला', 'सीमा', 'नीता', 'सुनीता',
  'अमित', 'भारत', 'सुमित', 'प्रमोद', 'संजीव', 'सुरेश', 'रमेश',
  'आदित्य', 'दिव्य', 'विक्रम', 'निखिल', 'राहुल', 'हृदय', 'संत',
  'रहीम', 'करीम', 'हकीम', 'फरहान', 'इमरान', 'सलीम', 'हसन',
  'राज', 'राज कुमार', 'सीमा शर्मा', 'प्रिया वर्मा',
  'john', 'james', 'robert', 'michael', 'william', 'david', 'richard',
  'mary', 'patricia', 'jennifer', 'linda', 'barbara', 'susan', 'jessica'
]);

// ======================= NAME EXTRACTION V3 (ENHANCED) =======================
export function extractNameV3(text) {
  if (!text || text.trim().length === 0) return null;

  console.log(`\n👤 NAME EXTRACTION V3 START`);
  console.log(`   Input: ${text}`);

  // Step 1: Convert to lowercase for processing
  const lowerText = text.toLowerCase().trim();

  // Step 2: Remove common noise phrases
  let cleaned = lowerText;
  HINDI_NOISE_WORDS.forEach(word => {
    const regex = new RegExp(`\\b${word}\\b`, 'gi');
    cleaned = cleaned.replace(regex, '');
  });
  ENGLISH_NOISE_WORDS.forEach(word => {
    const regex = new RegExp(`\\b${word}\\b`, 'gi');
    cleaned = cleaned.replace(regex, '');
  });

  console.log(`   After removing noise: ${cleaned}`);

  // Step 3: Remove special characters but keep spaces
  cleaned = cleaned.replace(/[।,!?;:()[\]{}'"]/g, '').trim();
  console.log(`   After cleaning special chars: ${cleaned}`);

  // Step 4: Split into words and filter
  let words = cleaned.split(/\s+/).filter(w => w.length > 0);
  console.log(`   Words after split: [${words.join(', ')}]`);

  // Step 5: Filter out remaining noise
  words = words.filter(w => {
    const isNoise = HINDI_NOISE_WORDS.includes(w) || ENGLISH_NOISE_WORDS.includes(w);
    const isNumber = /^\d+$/.test(w);
    const isTooShort = w.length < 2;
    return !isNoise && !isNumber && !isTooShort;
  });

  console.log(`   Filtered words: [${words.join(', ')}]`);

  // Step 6: Attempt to extract meaningful name
  if (words.length === 0) return null;

  // If we have known names, prioritize those
  for (const word of words) {
    if (COMMON_NAMES.has(word)) {
      console.log(`   ✅ Known name found: ${word}`);
      return word.charAt(0).toUpperCase() + word.slice(1);
    }
  }

  // If all words are valid length and alphabetic, take first 2-3 words as name
const validWords = words.filter(w => /^[a-z\u0900-\u097F]+$/i.test(w));
  
  if (validWords.length > 0) {
    // Take 1-3 words max for name
    const nameWords = validWords.slice(0, Math.min(3, validWords.length));
    const extractedName = nameWords.join(' ');
    
    // Capitalize each word
    const properName = extractedName
      .split(' ')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
    
    console.log(`   ✅ Name extracted: ${properName}`);
    return properName;
  }

  console.log(`   ❌ Could not extract valid name`);
  return null;
}

// ======================= PINCODE EXTRACTION V3 (STRICT 6-DIGIT) =======================
export function extractPincodeV3(text) {
  if (!text || text.trim().length === 0) return null;

  console.log(`\n📮 PINCODE EXTRACTION V3 START`);
  console.log(`   Input: ${text}`);

  // Remove common text noise
  let cleaned = text.toLowerCase()
    .replace(/[।,!?;:()[\]{}'"]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  console.log(`   Cleaned input: ${cleaned}`);

  // Find ALL sequences of digits
  const allDigitSequences = cleaned.match(/\d+/g) || [];
  console.log(`   All digit sequences found: [${allDigitSequences.join(', ')}]`);

  if (allDigitSequences.length === 0) {
    console.log(`   ❌ No digits found`);
    return null;
  }

  // Try to find exactly 6-digit sequences first
  for (const sequence of allDigitSequences) {
    if (sequence.length === 6) {
      // Validate: Should start with 1-9 (Indian pincode rule)
      const firstDigit = parseInt(sequence[0]);
      if (firstDigit >= 1 && firstDigit <= 9) {
        console.log(`   ✅ Valid 6-digit pincode found: ${sequence}`);
        return sequence;
      }
    }
  }

  // If no 6-digit found, try to construct from 5+1 or other combinations
  if (allDigitSequences.length > 1) {
    // Try combining first two sequences if they form 6 digits
    const combined = allDigitSequences[0] + allDigitSequences[1];
    if (combined.length === 6) {
      const firstDigit = parseInt(combined[0]);
      if (firstDigit >= 1 && firstDigit <= 9) {
        console.log(`   ✅ Valid 6-digit pincode (combined): ${combined}`);
        return combined;
      }
    }
  }

  // Last resort: extract exactly 6 consecutive digits from anywhere
  const sixDigitRegex = /\d{6}/;
  const match = cleaned.match(sixDigitRegex);
  if (match) {
    const pincode = match[0];
    const firstDigit = parseInt(pincode[0]);
    if (firstDigit >= 1 && firstDigit <= 9) {
      console.log(`   ✅ Valid 6-digit pincode (regex): ${pincode}`);
      return pincode;
    }
  }

  console.log(`   ❌ No valid 6-digit pincode found`);
  return null;
}

// ======================= ADDRESS EXTRACTION V3 (IMPROVED) =======================
export function extractAddressV3(text) {
  if (!text || text.trim().length === 0) return null;

  console.log(`\n📍 ADDRESS EXTRACTION V3 START`);
  console.log(`   Input: ${text}`);

  let cleaned = text.toLowerCase()
    .replace(/[।,!?;:()[\]{}'"]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  console.log(`   Cleaned: ${cleaned}`);

  // Step 1: Extract and remove pincode
  const pincodeMatch = cleaned.match(/\d{6}/);
  let addressWithoutPincode = cleaned;
  if (pincodeMatch) {
    console.log(`   Found pincode: ${pincodeMatch[0]}`);
    addressWithoutPincode = cleaned.replace(pincodeMatch[0], ' ').trim();
  }

  // Step 2: Remove other numbers/special sequences
  let address = addressWithoutPincode
    .replace(/\d{3,}/g, '') // Remove sequences of 3+ digits
    .replace(/\d+/g, '') // Remove remaining numbers
    .trim();

  console.log(`   After removing pincode and numbers: ${address}`);

  // Step 3: Remove noise words
  let words = address.split(/\s+/);
  
  const addressNoiseWords = ['mein', 'main', 'me', 'में', 'पर', 'at', 'the', 'a', 'an'];
  words = words.filter(w => {
    return !addressNoiseWords.includes(w.toLowerCase()) && w.length > 1;
  });

  address = words.join(' ').trim();
  console.log(`   After removing noise words: ${address}`);

  // Step 4: Validate minimum length and word count
  if (address.length < 3) {
    console.log(`   ❌ Address too short`);
    return null;
  }

  if (address.split(/\s+/).length < 1) {
    console.log(`   ❌ Address has no meaningful words`);
    return null;
  }

  console.log(`   ✅ Address extracted: ${address}`);
  return address;
}

// ======================= TIME EXTRACTION V3 (IMPROVED AM/PM) =======================
export function extractTimeV3(text) {
  if (!text || text.trim().length === 0) return null;

  console.log(`\n⏰ TIME EXTRACTION V3 START`);
  console.log(`   Input: ${text}`);

  const lowerText = text.toLowerCase();

  // Step 1: Detect AM/PM from context
  let isAM = false;
  let isPM = false;
  let isMorning = false;
  let isAfternoon = false;
  let isEvening = false;
  let isNight = false;

  // Hindi morning indicators (4 AM - 12 PM) - without word boundaries for Hindi
  if (/(सुबह|subah|morning|तड़का|तड़के)/i.test(lowerText)) {
    isMorning = true;
    isAM = true;
    console.log(`   ✅ Morning detected (AM)`);
  }

  // Hindi afternoon indicators (12 PM - 5 PM) - including "duphare", "dopahar", "दुपहर"
  if (/\b(दोपहर|दुपहरी|दुपहर|दुपहार|dopahar|duphare|dophar|afternoon)\b/i.test(lowerText)) {
    isAfternoon = true;
    isPM = true;
    console.log(`   ✅ Afternoon detected (PM)`);
  }

  // Hindi evening indicators (5 PM - 8 PM) - including "shaam", "शाम"
  if (/\b(शाम|sham|shaam|evening|संध्या|सायंकाल|शाम को)\b/i.test(lowerText)) {
    isEvening = true;
    isPM = true;
    console.log(`   ✅ Evening detected (PM)`);
  }

  // Hindi night indicators (8 PM - 4 AM)
  if (/\b(रात|raat|night|रात को|रात भर|मध्य रात)\b/i.test(lowerText)) {
    isNight = true;
    isPM = true; // Typically 8 PM onwards
  }

  console.log(`   Time context: AM=${isAM}, PM=${isPM}, Morning=${isMorning}, Afternoon=${isAfternoon}, Evening=${isEvening}, Night=${isNight}`);

  // Step 2: Extract time pattern (HH:MM or single digit)
  let timeMatch = null;
  let hour = null;
  let minute = '00';

  // Pattern 1: HH:MM format
  timeMatch = lowerText.match(/(\d{1,2}):(\d{2})/);
  if (timeMatch) {
    hour = parseInt(timeMatch[1]);
    minute = timeMatch[2];
    console.log(`   Found time format HH:MM: ${hour}:${minute}`);
  }

  // Pattern 2: Single number (hour only) - like "2 baje" or "2 baje"
  if (!timeMatch) {
    const singleNumberMatch = lowerText.match(/\b(\d{1,2})\s*(बजे|baje|baj|o'clock|oclock|बज|बज़े|am|pm|a\.m|p\.m)\b/i);
    if (singleNumberMatch) {
      hour = parseInt(singleNumberMatch[1]);
      console.log(`   Found single hour: ${hour}`);
    }
  }

  // Pattern 3: Hindi number words - ONLY match if surrounded by time-related context
  if (!timeMatch && !hour) {
    const hindiTimeWords = {
      'नौ': 9, 'नO': 9,
      'दस': 10, 'दॉस': 10,
      'ग्यारह': 11, 'ग्यारा': 11,
      'बारह': 12, 'बाराह': 12,
      'एक': 1, 'दो': 2, 'तीन': 3, 'चार': 4,
      'पाँच': 5, 'पांच': 5, 'छः': 6, 'छह': 6,
      'सात': 7, 'साथ': 7, 'आठ': 8
    };

    // Check for ACTUAL time-related context (NOT just prepositions like "में")
    const timeContext = /बजे|baje|बज|o'clock|oclock|am|pm|a\.m|p\.m|morning|afternoon|evening|night|सुबह|दोपहर|शाम|रात|घंटा|घंटे/i.test(lowerText);
    
    // ONLY extract Hindi digits if actual time context is present
    if (timeContext) {
      for (const [word, num] of Object.entries(hindiTimeWords)) {
        const regex = new RegExp(`\\b${word}\\b`, 'i');
        if (regex.test(lowerText)) {
          // Double-check: digit must be near "बजे", "घंटा", or AM/PM
          const nearTimeWord = new RegExp(`${word}\\s*(बजे|baje|बज|घंटे|घंटा|o'clock|oclock|am|pm|a\\.m|p\\.m)`, 'i');
          if (nearTimeWord.test(lowerText)) {
            hour = num;
            console.log(`   Found Hindi number: ${word} = ${hour} (with time context)`);
            break;
          }
        }
      }
    } else {
      console.log(`   ⚠️ Hindi digits would match but NO real time context found - rejecting (likely year/date)`);
    }
  }

  // If hour not found, return null
  if (hour === null) {
    console.log(`   ❌ No time found`);
    return null;
  }

  // Step 3: Apply AM/PM logic
  let finalHour = hour;

  // If morning context explicitly stated
  if (isMorning && hour >= 1 && hour <= 12) {
    finalHour = hour;
    if (hour === 12) finalHour = 0; // 12 AM = 00:00
    console.log(`   🌅 Morning (AM) context: ${hour} → ${finalHour}`);
  } 
  // If context suggests PM (afternoon, evening, night)
  else if ((isAfternoon || isEvening || isNight) && hour >= 1 && hour <= 12) {
    // Add 12 hours to convert to 24-hour format (except 12 PM which stays 12)
    finalHour = hour === 12 ? 12 : hour + 12;
    console.log(`   🌅 PM context detected: ${hour} → ${finalHour}`);
  }
  // DEFAULT: No explicit time context → Always default to PM for business hours
  else if (hour >= 1 && hour <= 12) {
    finalHour = hour === 12 ? 12 : hour + 12; // Default to PM
    console.log(`   ⚠️ No time context - defaulting to PM: ${hour} → ${finalHour}`);
  }

  // Convert to 12-hour format with AM/PM
  const displayHour = finalHour > 12 ? finalHour - 12 : (finalHour === 0 ? 12 : finalHour);
  const displayPeriod = finalHour >= 12 ? 'PM' : 'AM';

  const timeString = `${String(displayHour).padStart(2, '0')}:${minute} ${displayPeriod}`;
  console.log(`   ✅ Time extracted: ${timeString} (24h: ${finalHour}:${minute})`);

  return timeString;
}

// ======================= COMPLAINT DETECTION V3 (ENHANCED) =======================
export function detectComplaintV3(text) {
  if (!text || text.trim().length === 0) return null;

  console.log(`\n🔧 COMPLAINT DETECTION V3 START`);
  console.log(`   Input: ${text}`);

  const textLower = text.toLowerCase();

  // Remove common filler words that might confuse detection
  const fillerWords = [
    'मेरी', 'मेरा', 'मेरे', 'मशीन', 'काम', 'चल', 'नहीं', 'है', 'हो', 'हो रही',
    'की', 'का', 'से', 'में', 'पर', 'और', 'भी', 'तो', 'लेकिन'
  ];

  let cleanedForDetection = textLower;
  fillerWords.forEach(word => {
    const regex = new RegExp(`\\b${word}\\b`, 'g');
    cleanedForDetection = cleanedForDetection.replace(regex, ' ');
  });

  cleanedForDetection = cleanedForDetection.replace(/\s+/g, ' ').trim();
  console.log(`   After removing fillers: ${cleanedForDetection}`);

  // If text is too short after cleaning, use original
  const processText = cleanedForDetection.length > 2 ? cleanedForDetection : textLower;

  // Check if this is actually describing a working machine with problem
  const isRunningButProblematic = /\b(चल|काम|चल रह|काम कर|running|working)\b/i.test(textLower) &&
                                  /\b(लेकिन|पर|लेकिन|but|issue|problem|दिक्कत|समस्या)\b/i.test(textLower);

  // Specific complaint detection
  const complaints = {
    'AC': /\b(एसी|ऐसी|ac|cooler|cooling|thanda|ठंड)\b/i,
    'Engine': /\b(इंजन|engine|motor|start|शुरू|smoke|धुआ|overheat|गर्म)\b/i,
    'Brake': /\b(ब्रेक|brake|stop|रोक|रुक)\b/i,
    'Hydraulic': /\b(हाइड्रो|pressure|pump|oil|तेल|स्लो|slow)\b/i,
    'Electrical': /\b(बिजली|electrical|electric|battery|बैटरी|light|लाइट)\b/i,
    'Transmission': /\b(transmission|gear|गियर|axle|clutch|क्लच)\b/i,
    'Tyre': /\b(टायर|tyre|tire|puncture|पंक्चर|wheel|पहिया)\b/i,
    'Cabin': /\b(केबिन|cabin|cab|door|दरवाजा|glass|शीशा|seat|सीट)\b/i,
    'Fabrication': /\b(crack|क्रैक|boom|bucket|chassis|टूटा|फटा)\b/i
  };

  console.log(`   Checking complaints...`);
  for (const [complaint, regex] of Object.entries(complaints)) {
    if (regex.test(processText)) {
      console.log(`   ✅ Detected: ${complaint}`);
      return {
        complaint,
        isRunningButProblematic,
        confidence: 0.9
      };
    }
  }

  console.log(`   ⚠️ No specific complaint detected`);
  return null;
}

// ======================= VALIDATION FUNCTIONS =======================

export function isValidNameV3(name) {
  if (!name || name.trim().length < 2) return false;
  // Name should have at least 2 characters and not be all numbers
  return !/^\d+$/.test(name) && name.length >= 2 && name.length <= 100;
}

export function isValidPincodeV3(pincode) {
  // Must be exactly 6 digits, starting with 1-9
  if (!pincode) return false;
  return /^[1-9]\d{5}$/.test(pincode.toString());
}

export function isValidAddressV3(address) {
  if (!address) return false;
  // At least 3 characters and contains meaningful words
  return address.trim().length >= 3;
}

export function isValidTimeV3(time) {
  if (!time) return false;
  // Format: HH:MM AM/PM
  return /^\d{2}:\d{2}\s(AM|PM)$/.test(time);
}

// ======================= LEGACY WRAPPER FUNCTIONS =======================
// These maintain backward compatibility with existing code

export function extractNameV2(text) {
  return extractNameV3(text);
}

export function extractPincodeV2(text) {
  return extractPincodeV3(text);
}

export function extractLocationAddressV2(text) {
  return extractAddressV3(text);
}

export function extractTimeV2(text) {
  return extractTimeV3(text);
}

export function isValidName(name) {
  return isValidNameV3(name);
}

export function isValidPincode(pincode) {
  return isValidPincodeV3(pincode);
}

export function isValidAddress(address) {
  return isValidAddressV3(address);
}

// ======================= PHONE & CHASSIS (KEEPING EXISTING) =======================

export function extractPhoneNumberV2(text) {
  if (!text) return null;

  console.log(`\n📱 PHONE EXTRACTION START`);
  console.log(`   Input: ${text}`);

  const cleaned = text.toLowerCase()
    .replace(/[a-z]/g, '') // Remove all letters
    .replace(/[^0-9\s]/g, '') // Keep only digits and spaces
    .replace(/\s+/g, ''); // Remove all spaces

  console.log(`   Digits only: ${cleaned}`);

  // Extract all digit sequences
  const digitSequences = cleaned.match(/\d+/g) || [];
  console.log(`   Digit sequences: [${digitSequences.join(', ')}]`);

  // Try to find or construct a 10-digit number
  if (digitSequences.length === 1 && digitSequences[0].length === 10) {
    const phone = digitSequences[0];
    if (/^[6-9]/.test(phone)) {
      console.log(`   ✅ Valid phone (10 digits): ${phone}`);
      return phone;
    }
  }

  // Try combining sequences
  if (digitSequences.length > 1) {
    const combined = digitSequences.slice(0, 2).join('');
    if (combined.length === 10 && /^[6-9]/.test(combined)) {
      console.log(`   ✅ Valid phone (combined): ${combined}`);
      return combined;
    }
  }

  // Extract exactly 10 consecutive digits
  const tenDigits = cleaned.match(/[6-9]\d{9}/);
  if (tenDigits) {
    console.log(`   ✅ Valid phone (regex): ${tenDigits[0]}`);
    return tenDigits[0];
  }

  console.log(`   ❌ No valid phone found`);
  return null;
}

export function isValidPhone(phone) {
  if (!phone) return false;
  // 10 digits, starting with 6-9
  return /^[6-9]\d{9}$/.test(phone.toString());
}

export function extractChassisNumberV2(text) {
  if (!text) return null;

  console.log(`\n🔧 CHASSIS EXTRACTION START - ENHANCED V3`);
  console.log(`   📢 Input (Raw): "${text}"`);

  let cleaned = text.toLowerCase().trim();

  // ==== STEP 1: Handle Hindi counting (lakh, hazaar, sau) ====
  console.log(`   📝 STEP 1: Expanding Hindi counting units...`);
  let expandedCounting = cleaned;
  
  // Handle larger units first
  // Pattern: "ek lakh pachchis" = 1 * 100000 + 25 = 100025
  // For chassis purposes, we typically only want the numeric part
  const countingPatterns = [
    { pattern: /(\d+)\s*(lakh|लाख)/gi, multiply: 100000 },
    { pattern: /(\d+)\s*(hazaar|हजार|thousand)/gi, multiply: 1000 },
    { pattern: /(\d+)\s*(sau|सौ|hundred)/gi, multiply: 100 },
  ];
  
  let countingMatches = [];
  for (const { pattern, multiply } of countingPatterns) {
    const match = expandedCounting.match(pattern);
    if (match) {
      countingMatches.push(`${match[0]} (${multiply}x)`);
    }
  }
  
  if (countingMatches.length > 0) {
    console.log(`      Counting units found: [${countingMatches.join(', ')}]`);
  }
  console.log(`      Input after counting units: "${expandedCounting}"`);

  // ==== STEP 2: Convert Hindi digit words to English digits ====
  console.log(`   📝 STEP 2: Converting Hindi/English digit words...`);
  let digitConverted = expandedCounting;
  let hindiDigitMatches = [];
  
  for (const [hindiWord, digit] of Object.entries(HINDI_DIGITS)) {
    // Use word boundaries for safety, but allow optional 'a' at end (like "eka" vs "ek")
    const regex = new RegExp(`\\b${hindiWord}\\b`, 'gi');
    const testRegex = new RegExp(`\\b${hindiWord}\\b`, 'i');
    
    if (testRegex.test(digitConverted)) {
      const matches = digitConverted.match(new RegExp(`\\b${hindiWord}\\b`, 'gi')) || [];
      hindiDigitMatches.push(`${hindiWord}→${digit} (×${matches.length})`);
      digitConverted = digitConverted.replace(regex, digit);
    }
  }
  
  if (hindiDigitMatches.length > 0) {
    console.log(`      Hindi/English words converted: [${hindiDigitMatches.join(', ')}]`);
  }
  console.log(`      After conversion: "${digitConverted}"`);

  // ==== STEP 3: Handle separators and clean up ====
  console.log(`   📝 STEP 3: Handling separators, breaks & duplicates...`);
  
  // Replace common separators with spaces
  let normalized = digitConverted
    .replace(/[,;।]/g, ' ')                          // Commas, semicolons → space
    .replace(/\s+(and|or|plus|dash|minus)\s+/gi, ' ')  // Logic words → space
    .replace(/\s+/g, ' ')                            // Multiple spaces → single space
    .trim();
  
  console.log(`      After separator normalization: "${normalized}"`);

  // ==== STEP 4: Handle DUPLICATE digits (e.g., "3 3" → "33") ====
  console.log(`   📝 STEP 4: Detecting and handling duplicates...`);
  
  const words = normalized.split(/\s+/);
  let processedWords = [];
  let i = 0;
  
  while (i < words.length) {
    const current = words[i];
    
    // Check if current word is a digit/number
    if (/^\d+$/.test(current)) {
      // Look ahead for same digit repeated
      let duplicateCount = 1;
      while (i + duplicateCount < words.length && words[i + duplicateCount] === current) {
        duplicateCount++;
      }
      
      if (duplicateCount > 1) {
        // We have duplicates like "3 3 3" → "333"
        console.log(`      🔄 Duplicate detected: "${current}" repeated ${duplicateCount}x → "${current.repeat(duplicateCount)}"`);
        processedWords.push(current.repeat(duplicateCount));
        i += duplicateCount;
      } else {
        processedWords.push(current);
        i++;
      }
    } else {
      // Non-numeric word, skip it
      console.log(`      ⏭️  Skipping non-numeric: "${current}"`);
      i++;
    }
  }
  
  console.log(`      Processed words: [${processedWords.join(', ')}]`);

  // ==== STEP 5: Extract all digit sequences ====
  console.log(`   📝 STEP 5: Extracting digit sequences...`);
  
  // Combine all processed words and extract digit sequences
  const reconstructed = processedWords.join('');
  const digitSequences = reconstructed.match(/\d+/g) || [];
  const totalDigits = digitSequences.reduce((sum, seq) => sum + seq.length, 0);
  
  console.log(`      Found sequences: [${digitSequences.join(', ')}]`);
  console.log(`      Total digit count: ${totalDigits}`);

  if (digitSequences.length === 0) {
    console.log(`   ❌ No digits found in input`);
    return null;
  }

  // ==== STEP 6: Intelligently combine sequences ====
  console.log(`   📝 STEP 6: Smart sequence combination...`);
  
  // Strategy A: If total digits range 4-8 → concatenate all
  if (totalDigits >= 4 && totalDigits <= 8) {
    const combined = digitSequences.join('');
    console.log(`      ✅ A) Concatenated (${totalDigits} total digits): ${combined}`);
    console.log(`         This handles: "3 then 0 then 5 4 4 7" or "303 and 05447" or "3 3 zero 5 4 4 7" → 3305447`);
    return combined;
  }

  // Strategy B: If total > 8, try to find valid 4-8 digit sequence
  if (totalDigits > 8) {
    console.log(`      Total too large (${totalDigits}). Looking for valid 4-8 substring...`);
    
    // Find longest consecutive 4-8 digit sequence
    for (let len = 8; len >= 4; len--) {
      for (let i = 0; i <= digitSequences.length - 1; i++) {
        let candidate = digitSequences.slice(i, i + 1).join('');
        if (candidate.length >= 4 && candidate.length <= 8) {
          console.log(`      ✅ B) Found valid sequence: ${candidate} (${candidate.length} digits)`);
          return candidate;
        }
      }
    }
  }

  // Strategy C: If total < 4, check if it's padded digit (like "05447" = 5447)
  if (totalDigits >= 3 && totalDigits < 4) {
    const combined = digitSequences.join('');
    if (combined.length === 3) {
      console.log(`      ⚠️  Only 3 digits, might need leading zero. Combined: ${combined}`);
    }
    return combined.padStart(4, '0'); // Pad to at least 4 digits
  }

  // Strategy D: Find longest single sequence with fallback
  let longestSequence = digitSequences.reduce((a, b) => 
    a.length >= b.length ? a : b, digitSequences[0]
  );
  
  if (longestSequence.length >= 4 && longestSequence.length <= 8) {
    console.log(`      ✅ D) Longest sequence: ${longestSequence} (${longestSequence.length} digits)`);
    return longestSequence;
  }

  // If longest is < 4, maybe concatenate first few sequences
  if (longestSequence.length < 4) {
    const concat = digitSequences.slice(0, Math.min(3, digitSequences.length)).join('');
    if (concat.length >= 4 && concat.length <= 8) {
      console.log(`      ✅ E) Concatenating first sequences: ${concat} (${concat.length} digits)`);
      return concat;
    }
  }

  console.log(`   ❌ FAILED: No valid chassis found`);
  console.log(`      Concatenated would be ${totalDigits} digits (need 4-8)`);
  console.log(`      Longest sequence is ${longestSequence.length} digits (need 4-8)`);
  
  return null;
}

export function isValidChassis(chassis) {
  if (!chassis) return false;
  // Should be 4-8 digit sequence (handles concatenated sequences like "3305447")
  const valid = /^\d{4,8}$/.test(chassis.toString());
  console.log(`   🔍 Chassis validation: "${chassis}" → ${valid ? '✅ VALID' : '❌ INVALID'}`);
  return valid;
}



// ==================== ENHANCED HINDI TO ENGLISH WITH FALLBACK ====================

const hindiToEnglishComprehensive = {
  // Names (Common Indian names)
  'अंशु': 'Anshu',
  'राहुल': 'Rahul',
  'प्रिया': 'Priya',
  'विजय': 'Vijay',
  'संजय': 'Sanjay',
  'अमित': 'Amit',
  'दिपक': 'Dipak',
  'राज': 'Raj',
  'महेश': 'Mahesh',
  'राकेश': 'Rakesh',
  'अरुण': 'Arun',
  'पवन': 'Pawan',
  'सुनील': 'Sunil',
  'दिनेश': 'Dinesh',
  'हनुमान': 'Hanuman',
  'यादव': 'Yadav',
  
  // Places
  'अजमेर': 'Ajmer',
  'अलवर': 'Alwar',
  'जयपुर': 'Jaipur',
  'कोटा': 'Kota',
  'उदयपुर': 'Udaipur',
  'भरतपुर': 'Bharatpur',
  'भिवाड़ी': 'Bhiwadi',
  'भीलवाड़ा': 'Bhilwara',
  
  // Locations
  'बस अड्डा': 'Bus Stand',
  'रोड': 'Road',
  'नियर': 'Near',
  'बाजार': 'Market',
  'गली': 'Lane',
  'मोहल्ला': 'Locality',
  
  // Status & Complaint Keywords
  'खराब': 'Faulty',
  'टूटा': 'Broken',
  'काम नहीं कर रहा': 'Not Working',
  'धुआ': 'Smoke',
  'शोर': 'Noise',
  'लीक': 'Leak',
};

/**
 * Enhanced Hindi to English translation with fallback
 * Uses dictionary + Devanagari removal + transliteration fallback
 */
async function translateHindiToEnglishEnhanced(text) {
  if (!text || typeof text !== 'string') return text;
  
  const hindiRegex = /[\u0900-\u097F]/;
  if (!hindiRegex.test(text)) {
    return text; // No Hindi detected
  }

  console.log(`🔤 [TRANSLATION START] Input: "${text.substring(0, 60)}..."`);
  
  let result = text;
  
  // STEP 1: Apply comprehensive dictionary (exact matches)
  for (const [hindi, english] of Object.entries(hindiToEnglishComprehensive)) {
    const regex = new RegExp(`\\b${hindi}\\b`, 'gi');
    result = result.replace(regex, english);
  }
  
  // STEP 2: Romanize remaining Devanagari characters
  result = romanizeDevanagari(result);
  
  // STEP 3: Clean up multiple spaces
  result = result.replace(/\s+/g, ' ').trim();
  
  console.log(`✅ [TRANSLATION END] Output: "${result}"`);
  return result || 'Not Provided';
}

/**
 * Devanagari to Roman transliteration (phonetic conversion)
 * E.g., "अंशु" → "anshu"
 */
function romanizeDevanagari(text) {
  const devanagariMap = {
    // Vowels
    'अ': 'A', 'आ': 'Aa', 'इ': 'I', 'ई': 'Ee', 'उ': 'U', 'ऊ': 'Oo',
    'ऋ': 'Ri', 'ए': 'E', 'ऐ': 'Ai', 'ओ': 'O', 'औ': 'Au',
    
    // Consonants
    'क': 'K', 'ख': 'Kh', 'ग': 'G', 'घ': 'Gh', 'च': 'Ch',
    'छ': 'Chh', 'ज': 'J', 'झ': 'Jh', 'ट': 'T', 'ठ': 'Th',
    'ड': 'D', 'ढ': 'Dh', 'त': 'T', 'थ': 'Th', 'द': 'D',
    'ध': 'Dh', 'न': 'N', 'प': 'P', 'फ': 'Ph', 'ब': 'B',
    'भ': 'Bh', 'म': 'M', 'य': 'Y', 'र': 'R', 'ल': 'L',
    'व': 'V', 'श': 'Sh', 'ष': 'Sh', 'स': 'S', 'ह': 'H',
    
    // Special
    'ण': 'N', 'ं': 'N', 'ः': 'H', 'ॅ': '',
  };
  
  let romanized = '';
  for (let char of text) {
    romanized += devanagariMap[char] || char;
  }
  return romanized;
}

// ======================= COMPREHENSIVE HINDI-TO-ENGLISH CONVERSION =======================
const HINDI_TO_ENGLISH_MAP = {
  // Common words customer might say
  'हाँ': 'yes', 'हां': 'yes', 'जी': 'yes', 'बिल्कुल': 'absolutely', 'ठीक': 'okay', 'ठीक है': 'okay', 'सही': 'right',
  'नहीं': 'no', 'नही': 'no', 'ना': 'no', 'मत': 'no', 'नाह': 'no',
  'रुको': 'wait', 'सुनो': 'listen', 'समझो': 'understand', 'बताओ': 'tell', 'बताये': 'tell', 
  'क्या': 'what', 'कब': 'when', 'कहाँ': 'where', 'कौन': 'who', 'क्यों': 'why', 'कैसे': 'how',
  'मेरी': 'my', 'मेरा': 'my', 'मेरे': 'my', 'आपकी': 'your', 'आपका': 'your', 'आपके': 'your',
  'मशीन': 'machine', 'मशीन में': 'in machine', 'मशीन का': 'machine\'s', 'समस्या': 'problem', 'समस्या है': 'is problem',
  'खराब': 'broken', 'टूटा': 'broken', 'नहीं चल रहा': 'not working', 'काम नहीं कर रहा': 'not working',
  'दशा': 'condition', 'स्थिति': 'condition', 'हालत': 'condition', 'हिसाब': 'detail',
  'दोबारा': 'again', 'फिर से': 'again', 'एक बार': 'once', 'बार-बार': 'repeatedly',
  'पहले': 'before', 'अभी': 'now', 'अभी नहीं': 'not now', 'बाद में': 'later', 'कभी भी': 'anytime',
  'एक से ज्यादा': 'more than one', 'एकाधिक': 'multiple', 'अनेक': 'multiple', 'कई': 'many',
  'ठीक है': 'okay', 'चलेगा': 'okay', 'ठीक हो गया': 'okay got it', 'समझ गया': 'understood',
  'पूरी जानकारी': 'full information', 'विस्तार से': 'in detail', 'विस्तृत': 'detailed', 'सब कुछ': 'everything',
  'बस': 'that\'s it', 'बस इतना ही': 'that\'s all', 'बात': 'thing', 'बात करना': 'to talk',
  'भेज दो': 'send', 'भेज दीजिये': 'send', 'यह ठीक है': 'this is okay', 'अच्छा': 'okay', 'ठीक हो गया': 'done',
  'काठ': 'which', 'कौन सा': 'which one', 'कौन सी': 'which',
  'से': 'from', 'तक': 'till', 'और': 'and', 'या': 'or', 'लेकिन': 'but', 'मगर': 'but',
  'वह': 'that', 'यह': 'this', 'ये': 'these', 'वो': 'that', 'यहाँ': 'here', 'वहाँ': 'there',
  'सर': 'sir', 'साहब': 'sir', 'जनाब': 'sir', 'भैया': 'brother', 'दीदी': 'sister',
  'धन्यवाद': 'thank you', 'शुक्रिया': 'thank you', 'सुबह': 'morning', 'दोपहर': 'afternoon', 'शाम': 'evening', 'रात': 'night',
  'सोमवार': 'monday', 'मंगलवार': 'tuesday', 'बुधवार': 'wednesday', 'गुरुवार': 'thursday', 'शुक्रवार': 'friday', 'शनिवार': 'saturday', 'रविवार': 'sunday',
  'आज': 'today', 'कल': 'tomorrow/yesterday', 'परसों': 'day after tomorrow', 'पिछले': 'last', 'अगले': 'next',
  'घर': 'home', 'ऑफिस': 'office', 'साइट': 'site', 'गोदाम': 'warehouse', 'खेत': 'field', 'दुकान': 'shop',
  'चेसिस': 'chassis', 'नंबर': 'number', 'रजिस्ट्रेशन': 'registration', 'डॉक्यूमेंट': 'document',
  'इंजन': 'engine', 'ट्रांसमिशन': 'transmission', 'ब्रेक': 'brake', 'हाइड्रोलिक्स': 'hydraulics', 'इलेक्ट्रिकल': 'electrical',
  'शीतलन': 'cooling', 'एयर कंडीशनर': 'ac', 'स्टीयरिंग': 'steering', 'क्लच': 'clutch', 'ईंधन': 'fuel', 'बाल्टी': 'bucket', 'बूम': 'boom',
  'खराबी': 'fault', 'खराबियाँ': 'faults', 'खराबिया': 'faults', 'दोष': 'fault', 'बीमारी': 'issue',
  'आवाज़': 'sound', 'आवाज': 'sound', 'शोर': 'noise', 'कंपन': 'vibration', 'झटका': 'jerk', 'रिसाव': 'leak',
  'तेल': 'oil', 'पानी': 'water', 'ईंधन': 'fuel', 'गैस': 'gas', 'धुआँ': 'smoke', 'गंध': 'smell',
  'शुरू': 'start', 'शुरू नहीं हो रहा': 'not starting', 'चल रहा है': 'running', 'चल नहीं रहा': 'not running',
  'चलाना': 'operate', 'कर रहा है': 'doing', 'किया है': 'did', 'किया हूँ': 'did',
  'मजबूत': 'strong', 'कमजोर': 'weak', 'तेज़': 'fast', 'धीमा': 'slow', 'ठंडा': 'cold', 'गरम': 'hot', 'गर्म': 'hot',
};

// ======================= CUSTOMER SPEECH PATTERNS =======================
const CUSTOMER_SPEECH_PATTERNS = {
  // Rejections and corrections
  negation: [
    /मैने (ये|यह|यहाँ|वो|ये|is|this|that) (नहीं|नही|na|no)/i,
    /मैंने (ये|यह|यहाँ) (नहीं|नही|na|no)/i,
    /मुझे (ये|यह) (नहीं|नही|no)?.*कहा/i,
    /मैं (ये|यह) (नहीं|नही|na|no) कर रहा|कर रही/i,
    /(ye|ये|यह|इसे) (nahi|नहीं|नही|no|na)/i,
    /(first|पहले|शुरुआत में) (mein|में) (ye|ये|यह) (nahi|नहीं|नही)/i,
    /(already|पहले से) (said|कहा|बोल|बताया)/i,
    /(maine ye nahi|I didn't say)/i,
  ],
  
  // Multiple problems
  multipleProblem: [
    /एक (से ज्यादा|से अधिक|से) (समस्या|problem|dikkat)/i,
    /कई (समस्या|problem|issue)/i,
    /अनेक (समस्या|समस्याएं|problems)/i,
    /(multiple|कई|अनेक) (problem|issue|समस्या)/i,
    /दो\b.*और.*समस्या/i,
    /समस्या (है और भी|है एक और)/i,
    /(bhi ye problem|और भी|aur bhi)/i,
  ],
  
  // Need more time/not available now
  timeNotNow: [
    /अभी (समय|time) (नहीं|नही|no) (है|दे सकता)/i,
    /अभी (बता|tell) (नहीं|नही|no) (सकता|सकती|सकते)/i,
    /समय (अभी|पता) (नहीं|नही|no)/i,
    /(time nahi|time is not|no timing) (right now|abhi)/i,
    /बाद में (बताता|बताऊँ|बताऊ)?/i,
    /(later|baad mein|fir) (बताता|बताऊँ|बताऊ|tell)/i,
    /(dont|मत|nai) (know|पता|मालूम) (time|समय)/i,
  ],
  
  // Send anytime/flexible
  anytimeSend: [
    /कभी (भी|बी) (भेज|send|aao)/i,
    /(anytime|कभी भी)/i,
    /(जब सुविधा|when convenient|जब फुर्सत)/i,
    /समय (मत|मा) (फिक्र|worry) (करो|करो|कीजिए)/i,
    /(no issue|कोई समस्या|pakad nahi)/i,
  ],
  
  // Ask for full information
  needFullInfo: [
    /पूरी (जानकारी|information|details)/i,
    /विस्तार (से|with) (बीता|बताना|बताई)/i,
    /सब (कुछ|आकर|properly) (बता|tell|bolna)/i,
    /पूरा (हिसाब|account|detail|डाटा|data)/i,
    /detailed (information|explanation|हिसाब)/i,
    /(mujhe|को) (aapka|आपका|आपकी) (sara|सारा) (data|डाटा) (chahiye|चाहिए)/i,
  ],
  
  // Acknowledgment/understanding
  understood: [
    /(समझ|samjh) (गया|गई|गए|gaya)/i,
    /(ठीक|thik) (है|ho gya|okay)/i,
    /(sir|सर) (सब|सब|all) (clear|clear|समझ|समझ) (गया|gaya)/i,
    /मुझे (clear|साफ|स्पष्ट|समझ) (आ गया|गया|गयी)/i,
    /(understood|samjh gaya|clear|ok)/i,
    /(sir|sab|सब|सर) (thik|ठीक) (hai|है|ho gya)/i,
  ],
  
  // Need clarification/explanation
  needClarify: [
    /मुझे (और|अधिक|properly|साफ|विस्तार) (से)? (बता|समझा|explain)/i,
    /(clearly|साफ|स्पष्ट) (explain|बताइए|समझाइए|samjhao)/i,
    /(kya matlab|क्या मतलब|what means|what does|iska matlab kya)/i,
    /फिर से (समझा|explain|बता)/i,
    /(समझ नहीं|I don't understand|clear नहीं)/i,
  ],
  
  // Agreement with urgency/casualness
  flexibility: [
    /(जब संभव|when possible|जब सके)/i,
    /(pressure|जल्दी|urgent) (नहीं|नही|not|optional)/i,
    /(कोई जल्दबाज़ी|no hurry|कोई परवाह नहीं)/i,
    /(आराम|जब सुविधा|whenever) (से|लगे|convenient)/i,
  ],
  
  // Complaint re-listening request
  repeatComplaint: [
    /(complaint|शिकायत|समस्या) (दो?बारा|फिर से|again|अन्य)/i,
    /(सुनो|listen) (मेरी|to my|शिकायत|complaint)/i,
    /(फिर से|dusri bar|दूसरी बार|again) (सुनो|listen)/i,
    /मेरी (बात|complaint|शिकायत) (सुनो|listen)/i,
  ],
  
  // Service-related statements
  serviceAsk: [
    /(service|सर्विस|काम) (कब|when|में) (आओ|आएंगे|करोगे)/i,
    /(डॉक्टर|engineer|टेक्निशियन) (कब भेजोगे|when send|भेज दो)/i,
    /(charge|खर्च|वारंटी|warranty) (क्या|how much|कितना)/i,
  ],
  
  // Other acknowledgments
  okay: [
    /(ठीक|ok|okay|alright|सही|चलेगा)/i,
    /(चलता|चलेगा|चल|works?) (है|है)\b/i,
  ],
};

// ======================= CONVERT HINDI TO ENGLISH FOR API SUBMISSION =======================
export function convertHindiToEnglish(text) {
  if (!text) return text;
  
  let converted = text;
  
  // First, use the mapping table for common words
  for (const [hindi, english] of Object.entries(HINDI_TO_ENGLISH_MAP)) {
    const regex = new RegExp(`\\b${hindi}\\b`, 'gi');
    converted = converted.replace(regex, english);
  }
  
  // Then romanize remaining Devanagari characters
  converted = romanizeDevanagari(converted);
  
  // Clean up any remaining non-ASCII except spaces, hyphens and basic punctuation
  converted = converted.replace(/[^\w\s\-.,!?]/g, ' ');
  
  // Remove extra spaces
  converted = converted.replace(/\s+/g, ' ').trim();
  
  return converted;
}

// ======================= CLEAN & CONVERT COMPLAINT DATA FOR API =======================
export function sanitizeComplaintDataForAPI(complaintData) {
  if (!complaintData) return null;
  
  console.log(`\n🔄 SANITIZING COMPLAINT DATA FOR API SUBMISSION`);
  console.log(`   Input Title: ${complaintData.complaintTitle}`);
  console.log(`   Input SubTitle: ${complaintData.complaintSubTitle}`);
  
  const sanitized = {
    chassis: complaintData.chassis,
    customerName: convertHindiToEnglish(complaintData.customerName || ''),
    customerPhone: complaintData.customerPhone,
    location: convertHindiToEnglish(complaintData.location || complaintData.jobLocation || ''),
    address: convertHindiToEnglish(complaintData.address || ''),
    complaintTitle: convertHindiToEnglish(complaintData.complaintTitle || ''),
    complaintSubTitle: convertHindiToEnglish(complaintData.complaintSubTitle || 'Other'),
    rawComplaint: convertHindiToEnglish(complaintData.rawComplaint || ''),
    complaintDetails: convertHindiToEnglish(complaintData.complaintDetails || ''),
    machineAvailability: complaintData.machineAvailability,
    serviceDate: complaintData.serviceDate,
    serviceTime: complaintData.serviceTime,
    timestamp: complaintData.timestamp || new Date().toISOString(),
  };
  
  console.log(`   ✅ Converted Title: ${sanitized.complaintTitle}`);
  console.log(`   ✅ Converted SubTitle: ${sanitized.complaintSubTitle}`);
  console.log(`   ✅ Converted Location: ${sanitized.location}`);
  
  return sanitized;
}

// ======================= DETECT CUSTOMER SPEECH PATTERN =======================
export function detectCustomerPattern(speech) {
  if (!speech) return { type: 'unknown', pattern: null, confidence: 0 };
  
  const patterns = [];
  
  for (const [patternType, regexList] of Object.entries(CUSTOMER_SPEECH_PATTERNS)) {
    for (const regex of regexList) {
      if (regex.test(speech)) {
        patterns.push(patternType);
        break;
      }
    }
  }
  
  return {
    type: patterns.length > 0 ? patterns[0] : 'unknown',
    allPatterns: patterns,
    speech: speech,
    isNegation: patterns.includes('negation'),
    hasMultipleProblem: patterns.includes('multipleProblem'),
    needsTime: patterns.includes('timeNotNow'),
    anytimeOkay: patterns.includes('anytimeSend'),
    needsInfo: patterns.includes('needFullInfo'),
    understood: patterns.includes('understood'),
  };
}


export { translateHindiToEnglishEnhanced, romanizeDevanagari };