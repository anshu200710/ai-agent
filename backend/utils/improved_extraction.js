
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
  'शून्य': '0', 'जीरो': '0', 'zero': '0',
  'एक': '1', 'एक': '1', 'one': '1', 'ek': '1',
  'दो': '2', 'दुई': '2', 'two': '2', 'do': '2',
  'तीन': '3', 'three': '3', 'teen': '3',
  'चार': '4', 'four': '4', 'char': '4',
  'पांच': '5', 'paanch': '5', 'panch': '5', 'five': '5',
  'छः': '6', 'छह': '6', 'chhe': '6', 'six': '6',
  'सात': '7', 'saat': '7', 'seven': '7',
  'आठ': '8', 'aath': '8', 'eight': '8',
  'नौ': '9', 'nau': '9', 'nine': '9'
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

  console.log(`\n🔧 CHASSIS EXTRACTION START`);
  console.log(`   Input: ${text}`);

  // Remove noise words
  let cleaned = text.toLowerCase()
    .replace(/[।,!?;:'"-]/g, ' ') // Remove punctuation
    .replace(/\b(मेरी|मेरा|मेरे|मशीन|नंबर|संख्या|है|हैं|का|की|चेसिस|chassis|number|no)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  console.log(`   After removing noise: ${cleaned}`);

  // Extract longest digit sequence (usually chassis)
  const digitSequences = cleaned.match(/\d+/g) || [];
  console.log(`   Digit sequences: [${digitSequences.join(', ')}]`);

  if (digitSequences.length === 0) return null;

  // Find longest sequence
  let chassis = digitSequences.reduce((a, b) => a.length >= b.length ? a : b);
  
  // Chassis should be 4-7 digits
  if (chassis.length >= 4 && chassis.length <= 7) {
    console.log(`   ✅ Chassis extracted: ${chassis}`);
    return chassis;
  }

  console.log(`   ❌ No valid chassis found`);
  return null;
}

export function isValidChassis(chassis) {
  if (!chassis) return false;
  // Should be 4-7 digit sequence
  return /^\d{4,7}$/.test(chassis.toString());
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

export { translateHindiToEnglishEnhanced, romanizeDevanagari };