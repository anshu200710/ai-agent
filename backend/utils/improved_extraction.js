// /* =======================
//    IMPROVED EXTRACTION FUNCTIONS V2
//    - Filters out Hindi/English filler words FIRST
//    - Focuses on extracting only relevant data
//    - Better accuracy for phone, chassis, name, pincode, address, time
// ======================= */

// /**
//  * IMPROVED: Extract phone number by filtering noise words first
//  */
// function extractPhoneNumberV2(text) {
//   if (!text) return null;
  
//   console.log("📱 PHONE EXTRACTION START");
//   console.log("   Input:", text);
  
//   // List of Hindi & English noise/filler words to remove
//   const noiseWords = [
//     'mera', 'mere', 'meri', 'मेरा', 'मेरे', 'मेरी',
//     'phone', 'फोन', 'number', 'नंबर', 'mobile', 'मोबाइल',
//     'contact', 'संपर्क', 'contact', 'नंबर',
//     'naam', 'नाम', 'se', 'से', 'hai', 'है', 'hoon', 'हूं',
//     'main', 'मैं', 'mein', 'में', 'ka', 'का', 'ki', 'की',
//     'par', 'पर', 'jo', 'जो', 'yeh', 'ये', 'ye', 'ये',
//     'bata', 'बता', 'bol', 'बोल', 'batayein', 'बताएं',
//     'kripya', 'कृपया', 'please', 'pls',
//     'machine', 'मशीन', 'enjin', 'इंजन', 'engine',
//     'chassis', 'चेसिस', 'number', 'नंबर',
//     'aap', 'आप', 'aapka', 'आपका', 'apna', 'अपना',
//     'to', 'तो', 'is', 'है', 'are', 'हैं'
//   ];
  
//   // Remove noise words while preserving numbers
//   let cleaned = text.toLowerCase();
  
//   for (const noiseWord of noiseWords) {
//     const regex = new RegExp(`\\b${noiseWord}\\b`, 'gi');
//     cleaned = cleaned.replace(regex, ' ');
//   }
  
//   console.log("   After removing noise words:", cleaned);
  
//   // Remove all non-digit characters
//   const digitsOnly = cleaned.replace(/\D/g, '');
  
//   console.log("   Digits only:", digitsOnly);
  
//   // Try to find 10-digit phone number
//   if (digitsOnly.length === 10 && /^[6-9]\d{9}$/.test(digitsOnly)) {
//     console.log("   ✅ Valid 10-digit phone found:", digitsOnly);
//     return digitsOnly;
//   }
  
//   // Try 11-digit with country code (91)
//   if (digitsOnly.length === 11 && digitsOnly.startsWith('91')) {
//     const phone = digitsOnly.substring(1);
//     if (/^[6-9]\d{9}$/.test(phone)) {
//       console.log("   ✅ Valid phone found (with country code):", phone);
//       return phone;
//     }
//   }
  
//   // Try 12-digit with +91
//   if (digitsOnly.length === 12 && digitsOnly.startsWith('91')) {
//     const phone = digitsOnly.substring(2);
//     if (/^[6-9]\d{9}$/.test(phone)) {
//       console.log("   ✅ Valid phone found (with +91):", phone);
//       return phone;
//     }
//   }
  
//   // Try word-to-digit conversion for Hindi numbers
//   const hindiDigits = {
//     'शून्य': '0', 'zero': '0', 'shunya': '0',
//     'एक': '1', 'ek': '1', 'one': '1',
//     'दो': '2', 'do': '2', 'two': '2',
//     'तीन': '3', 'teen': '3', 'three': '3',
//     'चार': '4', 'char': '4', 'four': '4',
//     'पांच': '5', 'paanch': '5', 'five': '5',
//     'छह': '6', 'chhe': '6', 'six': '6',
//     'सात': '7', 'saat': '7', 'seven': '7',
//     'आठ': '8', 'aath': '8', 'eight': '8',
//     'नौ': '9', 'nau': '9', 'nine': '9',
//   };
  
//   const words = text.toLowerCase().split(/\s+/);
//   let convertedDigits = '';
  
//   for (const word of words) {
//     if (hindiDigits[word]) {
//       convertedDigits += hindiDigits[word];
//     } else if (/^\d$/.test(word)) {
//       convertedDigits += word;
//     }
//   }
  
//   if (convertedDigits.length === 10 && /^[6-9]\d{9}$/.test(convertedDigits)) {
//     console.log("   ✅ Phone extracted from word-to-digit conversion:", convertedDigits);
//     return convertedDigits;
//   }
  
//   console.log("   ❌ No valid phone number found");
//   return null;
// }

// /**
//  * IMPROVED: Extract chassis number by filtering noise words first
//  */
// function extractChassisNumberV2(text) {
//   if (!text) return null;
  
//   console.log("🔧 CHASSIS EXTRACTION START");
//   console.log("   Input:", text);
  
//   // Noise words to remove
//   const noiseWords = [
//     'chassis', 'चेसिस', 'number', 'नंबर', 'mera', 'मेरा', 'hai', 'है',
//     'machine', 'मशीन', 'enjin', 'इंजन', 'engine', 'naam', 'नाम',
//     'batao', 'बताओ', 'batayein', 'बताएं', 'bolo', 'बोलो', 'se', 'से',
//     'mein', 'में', 'par', 'पर', 'aap', 'आप', 'apna', 'अपना',
//     'kripya', 'कृपया', 'please', 'pls', 'to', 'तो', 'aapka', 'आपका',
//     'hoon', 'हूं', 'ho', 'हो', 'rahe', 'रहे', 'raha', 'रहा',
//     'mere', 'मेरे', 'pas', 'पास', 'bata', 'बता'
//   ];
  
//   let cleaned = text.toLowerCase();
  
//   // Remove noise words
//   for (const noiseWord of noiseWords) {
//     const regex = new RegExp(`\\b${noiseWord}\\b`, 'gi');
//     cleaned = cleaned.replace(regex, ' ');
//   }
  
//   console.log("   After removing noise:", cleaned);
  
//   // Remove special characters and extra spaces
//   cleaned = cleaned.replace(/[।.,!?:;-]/g, ' ').replace(/\s+/g, ' ').trim();
  
//   console.log("   After cleaning special chars:", cleaned);
  
//   // Get remaining words
//   const words = cleaned.split(/\s+/).filter(w => w.length > 0);
  
//   console.log("   Remaining words:", words);
  
//   // Chassis numbers are typically alphanumeric and longer
//   // Common patterns: starts with letter, contains digits
//   for (const word of words) {
//     // Must contain at least 4 characters and have both letters and numbers
//     if (word.length >= 4 && /[a-zA-Z]/.test(word) && /[0-9]/.test(word)) {
//         const chassis = extractChassisNumberV2(rawSpeech);
//       console.log("   ✅ Chassis extracted:", chassis);
//       return chassis;
//     }
//   }
  
//   // If no mixed alphanumeric found, try longest alphanumeric sequence
//   const allAlphaNumeric = cleaned.replace(/[^a-zA-Z0-9]/g, '');
//   if (allAlphaNumeric.length >= 4) {
//     console.log("   ✅ Chassis extracted (from combined):", allAlphaNumeric.toUpperCase());
//     return allAlphaNumeric.toUpperCase();
//   }
  
//   console.log("   ❌ No valid chassis found");
//   return null;
// }

// /**
//  * IMPROVED: Extract name by filtering out numbers and noise words
//  */
// function extractNameV2(text) {
//   if (!text) return null;
  
//   console.log("👤 NAME EXTRACTION START");
//   console.log("   Input:", text);
  
//   // Noise words
//   const noiseWords = [
//     'mera', 'मेरा', 'naam', 'नाम', 'hai', 'है', 'hoon', 'हूं',
//     'main', 'मैं', 'mein', 'में', 'my', 'name', 'is', 'am', 'i',
//     'kya', 'क्या', 'kaun', 'कौन', 'bolo', 'बोलो', 'batao', 'बताओ',
//     'aaj', 'आज', 'kal', 'कल', 'sir', 'सर', 'madam', 'मैडम',
//     'ji', 'जी', 'haan', 'हां', 'phone', 'फोन', 'number', 'नंबर',
//     'se', 'से', 'par', 'पर', 'to', 'तो', 'aap', 'आप', 'apna', 'अपना',
//     'kripya', 'कृपया', 'please', 'pls', 'batayein', 'बताएं',
//     'mere', 'मेरे', 'aapka', 'आपका', 'mere', 'मेरे'
//   ];
  
//   let cleaned = text.toLowerCase();
  
//   // Remove noise words
//   for (const noiseWord of noiseWords) {
//     const regex = new RegExp(`\\b${noiseWord}\\b`, 'gi');
//     cleaned = cleaned.replace(regex, ' ');
//   }
  
//   console.log("   After removing noise:", cleaned);
  
//   // Remove special characters and numbers
//   cleaned = cleaned.replace(/[0-9।.,!?:;-]/g, ' ').replace(/\s+/g, ' ').trim();
  
//   console.log("   After removing numbers and special chars:", cleaned);
  
//   // Split into words
//   const words = cleaned.split(/\s+/).filter(word => {
//     // Word must be at least 2 characters
//     if (word.length < 2) return false;
    
//     // Must contain letters (not just special chars)
//     if (!/[a-zA-Z\u0900-\u097F]/.test(word)) return false;
    
//     return true;
//   });
  
//   console.log("   Valid words:", words);
  
//   if (words.length === 0) {
//     console.log("   ❌ No valid name found");
//     return null;
//   }
  
//   // Join first 2 words max (first name + last name)
//   const extractedName = words.slice(0, 2).join(' ');
  
//   console.log("   ✅ Name extracted:", extractedName);
//   return extractedName;
// }

// /**
//  * IMPROVED: Extract pincode by filtering noise
//  */
// function extractPincodeV2(text) {
//   if (!text) return null;
  
//   console.log("📍 PINCODE EXTRACTION START");
//   console.log("   Input:", text);
  
//   // Noise words to remove
//   const noiseWords = [
//     'pincode', 'पिनकोड', 'zip', 'code', 'कोड', 'address', 'पता',
//     'location', 'जगह', 'area', 'इलाका', 'sector', 'सेक्टर',
//     'mera', 'मेरा', 'machine', 'मशीन', 'par', 'पर', 'hai', 'है',
//     'se', 'से', 'mein', 'में'
//   ];
  
//   let cleaned = text.toLowerCase();
  
//   // Remove noise words
//   for (const noiseWord of noiseWords) {
//     const regex = new RegExp(`\\b${noiseWord}\\b`, 'gi');
//     cleaned = cleaned.replace(regex, ' ');
//   }
  
//   console.log("   After removing noise:", cleaned);
  
//   // Remove non-digits
//   const digitsOnly = cleaned.replace(/\D/g, '');
  
//   console.log("   Digits only:", digitsOnly);
  
//   // Look for 6-digit or 5-digit pincode
//   if (digitsOnly.length >= 5) {
//     // Try 6-digit first
//     const last6 = digitsOnly.slice(-6);
//     if (last6.length === 6 && /^\d{6}$/.test(last6)) {
//       console.log("   ✅ 6-digit pincode found:", last6);
//       return last6;
//     }
    
//     // Try 5-digit
//     const last5 = digitsOnly.slice(-5);
//     if (last5.length === 5 && /^\d{5}$/.test(last5)) {
//       console.log("   ✅ 5-digit pincode found:", last5);
//       return last5;
//     }
//   }
  
//   console.log("   ❌ No valid pincode found");
//   return null;
// }

// /**
//  * IMPROVED: Extract location address by removing numbers and noise
//  */
// function extractLocationAddressV2(text) {
//   if (!text) return { address: "Unknown", pincode: "" };
  
//   console.log("📍 LOCATION EXTRACTION START");
//   console.log("   Input:", text);
  
//   // First extract pincode
//   const pincode = extractPincodeV2(text);
  
//   // Noise words
//   const noiseWords = [
//     'meri', 'मेरी', 'machine', 'मशीन', 'hai', 'है', 'par', 'पर',
//     'pincode', 'पिनकोड', 'location', 'जगह', 'address', 'पता',
//     'kripya', 'कृपया', 'batayein', 'बताएं', 'se', 'से', 'mein', 'में',
//     'aapki', 'आपकी', 'aap', 'आप', 'apna', 'अपना', 'mere', 'मेरे'
//   ];
  
//   let cleaned = text.toLowerCase();
  
//   // Remove noise words
//   for (const noiseWord of noiseWords) {
//     const regex = new RegExp(`\\b${noiseWord}\\b`, 'gi');
//     cleaned = cleaned.replace(regex, ' ');
//   }
  
//   // Remove phone numbers and extra numbers
//   cleaned = cleaned.replace(/\d{10}/, ''); // Remove 10-digit numbers
//   cleaned = cleaned.replace(/\d{6}/, '');  // Remove 6-digit pincode
//   cleaned = cleaned.replace(/\s+\d+\s+/g, ' '); // Remove standalone numbers
  
//   // Remove special chars
//   cleaned = cleaned.replace(/[।.,!?:;-]/g, ' ').replace(/\s+/g, ' ').trim();
  
//   console.log("   Cleaned address:", cleaned);
  
//   // If empty after cleaning, return default
//   if (!cleaned || cleaned.length < 3) {
//     console.log("   ❌ No valid address extracted");
//     return { address: "Unknown", pincode: pincode || "" };
//   }
  
//   console.log("   ✅ Address extracted:", cleaned);
//   return {
//     address: cleaned,
//     pincode: pincode || ""
//   };
// }

// /**
//  * IMPROVED: Extract time by removing noise words first
//  */
// function extractTimeV2(text) {
//   if (!text) return null;
  
//   console.log("⏰ TIME EXTRACTION START");
//   console.log("   Input:", text);
  
//   // Time-related noise words
//   const noiseWords = [
//     'se', 'से', 'tak', 'तक', 'engineer', 'इंजीनियर', 'aa', 'आ',
//     'sakta', 'सकता', 'sakte', 'सकते', 'ruk', 'रुक', 'ho', 'हो'
//   ];
  
//   let cleaned = text.toLowerCase();
  
//   // Remove noise but keep time context words
//   for (const noiseWord of noiseWords) {
//     const regex = new RegExp(`\\b${noiseWord}\\b`, 'gi');
//     cleaned = cleaned.replace(regex, ' ');
//   }
  
//   console.log("   After removing noise:", cleaned);
  
//   // Pattern for "X baje" or "X bajay"
//   const bajeMatch = cleaned.match(/(\d{1,2}):?(\d{2})?\s*(baje|bajay|बजे)/i);
//   if (bajeMatch) {
//     const hour = parseInt(bajeMatch[1]);
//     const minute = bajeMatch[2] || "00";
    
//     // Determine AM/PM from context
//     let period = 'AM';
//     const isPM = /sham|evening|शाम|dopahar|दोपहर|afternoon|raat|रात|night|top|टॉप/gi.test(cleaned);
//     const isMorning = /subah|morning|सुबह|ek|एक/gi.test(cleaned);
    
//     if (isPM && hour <= 12) {
//       period = 'PM';
//     } else if (isMorning && hour <= 12) {
//       period = 'AM';
//     } else if (hour > 12) {
//       // 24-hour format
//       const convertedHour = hour - 12;
//       console.log(`   ✅ Time extracted: ${convertedHour}:${minute} PM`);
//       return `${convertedHour}:${minute} PM`;
//     }
    
//     console.log(`   ✅ Time extracted: ${hour}:${minute} ${period}`);
//     return `${hour}:${minute} ${period}`;
//   }
  
//   // Pattern for morning
//   if (/subah|morning|सुबह/gi.test(cleaned)) {
//     const hourMatch = cleaned.match(/(\d{1,2})/);
//     if (hourMatch) {
//       const hour = parseInt(hourMatch[1]);
//       if (hour >= 1 && hour <= 12) {
//         console.log(`   ✅ Time extracted (Morning): ${hour}:00 AM`);
//         return `${hour}:00 AM`;
//       }
//     }
//     console.log("   ✅ Time extracted (Morning default): 9:00 AM");
//     return "9:00 AM";
//   }
  
//   // Pattern for afternoon
//   if (/dopahar|afternoon|दोपहर/gi.test(cleaned)) {
//     const hourMatch = cleaned.match(/(\d{1,2})/);
//     if (hourMatch) {
//       const hour = parseInt(hourMatch[1]);
//       if (hour >= 1 && hour <= 12) {
//         console.log(`   ✅ Time extracted (Afternoon): ${hour}:00 PM`);
//         return `${hour}:00 PM`;
//       }
//     }
//     console.log("   ✅ Time extracted (Afternoon default): 2:00 PM");
//     return "2:00 PM";
//   }
  
//   // Pattern for evening
//   if (/sham|evening|शाम/gi.test(cleaned)) {
//     const hourMatch = cleaned.match(/(\d{1,2})/);
//     if (hourMatch) {
//       const hour = parseInt(hourMatch[1]);
//       if (hour >= 1 && hour <= 12) {
//         console.log(`   ✅ Time extracted (Evening): ${hour}:00 PM`);
//         return `${hour}:00 PM`;
//       }
//     }
//     console.log("   ✅ Time extracted (Evening default): 5:00 PM");
//     return "5:00 PM";
//   }
  
//   console.log("   ❌ No valid time found");
//   return null;
// }

// export {
//   extractPhoneNumberV2,
//   extractChassisNumberV2,
//   extractNameV2,
//   extractPincodeV2,
//   extractLocationAddressV2,
//   extractTimeV2
// };

/* =======================
   ENHANCED EXTRACTION UTILITIES - CLEARER WORD CATCHING
======================= */

// ===== PHONE NUMBER EXTRACTION (10 DIGITS) =====
export function extractPhoneNumberV2(text) {
  if (!text) return null;

  console.log(`\n📱 PHONE EXTRACTION START`);
  console.log(`   Input: ${text}`);

  const cleaned = text.toLowerCase();

  // Remove noise words first
  const noiseWords = [
    'mera', 'mere', 'meri', 'मेरा', 'मेरे', 'मेरी',
    'phone', 'फोन', 'number', 'नंबर', 'mobile', 'मोबाइल',
    'contact', 'संपर्क', 'contact', 'नंबर',
    'naam', 'नाम', 'se', 'से', 'hai', 'है', 'hoon', 'हूं',
    'main', 'मैं', 'mein', 'में', 'ka', 'का', 'ki', 'की',
    'par', 'पर', 'jo', 'जो', 'yeh', 'ये', 'ye', 'ये',
    'bata', 'बता', 'bol', 'बोल', 'batayein', 'बताएं',
    'kripya', 'कृपया', 'please', 'pls',
    'machine', 'मशीन', 'enjin', 'इंजन', 'engine',
    'chassis', 'चेसिस', 'number', 'नंबर',
    'aap', 'आप', 'aapka', 'आपका', 'apna', 'अपना',
    'to', 'तो', 'is', 'है', 'are', 'हैं',
    'मेरा', 'पूरा', 'नाम', 'है', 'का', 'की', 'के', 'my', 'name', 'is'
  ];
  let textWithoutNoise = cleaned;
  for (const word of noiseWords) {
    textWithoutNoise = textWithoutNoise.replace(new RegExp(`\\b${word}\\b`, 'gi'), ' ');
  }

  console.log(`   After removing noise words: ${textWithoutNoise}`);

  // Extract ALL continuous digit sequences
  const allDigitSequences = textWithoutNoise.match(/\d+/g) || [];
  console.log(`   All digit sequences found: [${allDigitSequences.join(', ')}]`);

  // Try concatenating digits in different ways
  if (allDigitSequences.length > 0) {
    // Try concatenating all digits
    const allDigitsConcat = allDigitSequences.join('');
    console.log(`   All digits concatenated: ${allDigitsConcat}`);

    // If we have exactly 10 digits, use them
    if (allDigitsConcat.length === 10 && /^[6-9]\d{9}$/.test(allDigitsConcat)) {
      console.log(`   ✅ Valid phone (10 digits starting with 6-9): ${allDigitsConcat}`);
      return allDigitsConcat;
    }

    // If we have more than 10, try to extract last 10
    if (allDigitsConcat.length > 10) {
      const lastTen = allDigitsConcat.slice(-10);
      if (/^[6-9]\d{9}$/.test(lastTen)) {
        console.log(`   ✅ Valid phone (last 10 digits): ${lastTen}`);
        return lastTen;
      }

      // Try to extract first valid 10-digit sequence
      for (let i = 0; i <= allDigitsConcat.length - 10; i++) {
        const substring = allDigitsConcat.substring(i, i + 10);
        if (/^[6-9]\d{9}$/.test(substring)) {
          console.log(`   ✅ Valid phone (found at position ${i}): ${substring}`);
          return substring;
        }
      }
    }

    // Try taking largest digit sequence if it's 10 digits
    const largestSequence = allDigitSequences.reduce((a, b) => a.length > b.length ? a : b);
    if (largestSequence.length === 10 && /^[6-9]\d{9}$/.test(largestSequence)) {
      console.log(`   ✅ Valid phone (largest sequence): ${largestSequence}`);
      return largestSequence;
    }
  }

  console.log(`   ❌ No valid phone number found`);
  return null;
}

// ===== CHASSIS NUMBER EXTRACTION (4+ ALPHANUMERIC) =====
export function extractChassisNumberV2(text) {
  if (!text) return null;

  console.log(`\n🔧 CHASSIS EXTRACTION START`);
  console.log(`   Input: ${text}`);

  const cleaned = text.toLowerCase();

  // Remove noise words
  const noiseWords = [
    'chassis', 'चेसिस', 'चेसिस', 'number', 'नंबर', 'machine', 'मशीन',
    'mera', 'मेरा', 'hai', 'है', 'ka', 'का', 'ke', 'के', 'ek', 'एक',
    'mint', 'मिनट', 'ruko', 'रुको', 'boliye', 'बोलिए', 'bataiye', 'बताइए'
  ];

  let withoutNoise = cleaned;
  for (const word of noiseWords) {
    withoutNoise = withoutNoise.replace(new RegExp(`\\b${word}\\b`, 'gi'), ' ');
  }

  console.log(`   After removing noise: ${withoutNoise}`);

  // Remove special characters and extra spaces
  const cleanedSpecial = withoutNoise.replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
  console.log(`   After cleaning special chars: ${cleanedSpecial}`);

  // Split into words
  const words = cleanedSpecial.split(/\s+/);
  console.log(`   Remaining words: [${words.map(w => `'${w}'`).join(', ')}]`);

  // Find alphanumeric sequences of 4+ characters
  const alphanumericSequences = words.filter(word => {
    return /^[a-z0-9]{4,}$/.test(word) && !/^\d{1,3}$/.test(word); // Not just short numbers
  });

  console.log(`   Alphanumeric 4+ char sequences: [${alphanumericSequences.join(', ')}]`);

  if (alphanumericSequences.length > 0) {
    const chassis = alphanumericSequences[0].toUpperCase();
    console.log(`   ✅ Chassis extracted (from word): ${chassis}`);
    return chassis;
  }

  // If no word match, try extracting digits + letters combined
  const allDigits = withoutNoise.match(/\d+/g) || [];
  const allLetters = withoutNoise.match(/[a-z]+/g) || [];

  if (allDigits.length > 0 || allLetters.length > 0) {
    const combined = (allDigits.join('') + allLetters.join('')).toUpperCase();
    if (combined.length >= 4) {
      console.log(`   ✅ Chassis extracted (from combined): ${combined}`);
      return combined;
    }
  }

  console.log(`   ❌ No valid chassis found`);
  return null;
}

// ===== NAME EXTRACTION (PROPER HINDI/ENGLISH NAMES) =====
export function extractNameV2(text) {
  if (!text) return null;

  console.log(`\n👤 NAME EXTRACTION START`);
  console.log(`   Input: ${text}`);

  const cleaned = text.toLowerCase();

  // Remove noise words - but KEEP actual names
  const noiseWords = [
    'mera', 'मेरा', 'naam', 'नाम', 'pura', 'पूरा', 'full', 'name',
    'hai', 'है', 'hain', 'ka', 'का', 'boliye', 'बोलिए', 'bataiye', 'बताइए',
    'batao', 'बताओ', 'batiye', 'बतिये'
  ];

  let withoutNoise = cleaned;
  for (const word of noiseWords) {
    withoutNoise = withoutNoise.replace(new RegExp(`\\b${word}\\b`, 'gi'), ' ');
  }

  console.log(`   After removing noise: ${withoutNoise}`);

  // Remove numbers and special chars
  const cleanedChars = withoutNoise.replace(/[^a-z\u0900-\u097F\s]/g, ' ').replace(/\s+/g, ' ').trim();
  console.log(`   After removing numbers and special chars: ${cleanedChars}`);

  if (!cleanedChars) {
    console.log(`   ❌ No text remaining after cleaning`);
    return null;
  }

  // Split into words
  const words = cleanedChars.split(/\s+/).filter(w => w.length > 0);
  console.log(`   Valid words: [${words.map(w => `'${w}'`).join(', ')}]`);

  if (words.length === 0) {
    console.log(`   ❌ No valid name found`);
    return null;
  }

  // Take up to 3 words (first name, middle, last name)
  const nameWords = words.slice(0, 3);
  const name = nameWords.join(' ').trim();

  if (name.length >= 2) {
    // Capitalize properly
    const capitalized = name.split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
    console.log(`   ✅ Name extracted: ${capitalized}`);
    return capitalized;
  }

  console.log(`   ❌ Name too short`);
  return null;
}

// ===== PINCODE EXTRACTION (5-6 DIGITS) =====
export function extractPincodeV2(text) {
  if (!text) return null;

  console.log(`\n📮 PINCODE EXTRACTION START`);
  console.log(`   Input: ${text}`);

  const cleaned = text.toLowerCase();

  // Extract ALL digit sequences
  const digitSequences = cleaned.match(/\d+/g) || [];
  console.log(`   Digit sequences found: [${digitSequences.join(', ')}]`);

  // Look for 5-6 digit sequences (pincodes)
  for (const seq of digitSequences) {
    if (/^\d{5,6}$/.test(seq)) {
      console.log(`   ✅ Valid pincode found: ${seq}`);
      return seq;
    }
  }

  console.log(`   ❌ No valid pincode found`);
  return null;
}

// ===== LOCATION/ADDRESS EXTRACTION =====
export function extractLocationAddressV2(text) {
  if (!text) return { address: null, pincode: null };

  console.log(`\n📍 LOCATION EXTRACTION START`);
  console.log(`   Input: ${text}`);

  const cleaned = text.toLowerCase();

  // Extract pincode first
  const pincodeMatch = cleaned.match(/\b\d{5,6}\b/);
  let pincode = null;
  let addressText = cleaned;

  if (pincodeMatch) {
    pincode = pincodeMatch[0];
    console.log(`   Found pincode: ${pincode}`);
    // Remove pincode from address
    addressText = addressText.replace(pincodeMatch[0], ' ').replace(/\s+/g, ' ').trim();
  }

  // Remove common noise words but keep location names
  const noiseWords = [
    'machine', 'मशीन', 'address', 'एड्रेस', 'location', 'लोकेशन', 'batayein', 'बताएं',
    'full', 'पूरा', 'boliye', 'बोलिए', 'hai', 'है', 'mein', 'में', 'par', 'पर',
    'at', 'aur', 'और', 'ka', 'का', 'ke', 'के', 'se', 'से'
  ];

  let cleanAddress = addressText;
  for (const word of noiseWords) {
    cleanAddress = cleanAddress.replace(new RegExp(`\\b${word}\\b`, 'gi'), ' ');
  }

  // Remove numbers that aren't part of address
  const addressClean = cleanAddress
    .replace(/[^a-z\u0900-\u097F\s\-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  console.log(`   Cleaned address: ${addressClean}`);

  if (!addressClean || addressClean.length < 3) {
    console.log(`   ❌ Address too short or empty`);
    return { address: null, pincode };
  }

  // Capitalize address
  const capitalizedAddress = addressClean.split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

  console.log(`   ✅ Address extracted: ${capitalizedAddress}`);
  return { address: capitalizedAddress, pincode };
}

// ===== TIME EXTRACTION (WITH AM/PM DETECTION) =====
export function extractTimeV2(text) {
  if (!text) return null;

  console.log(`\n⏰ TIME EXTRACTION START`);
  console.log(`   Input: ${text}`);

  const cleaned = text.toLowerCase();

  // Look for time patterns: "7:00", "9 baje", "2 pm", etc.
  
  // Pattern 1: HH:MM format
  const timePattern = /(\d{1,2}):(\d{2})/;
  const timeMatch = cleaned.match(timePattern);
  
  if (timeMatch) {
    let hour = parseInt(timeMatch[1]);
    const minute = timeMatch[2];
    
    // Determine AM/PM
    let ampm = 'AM';
    
    // Check for explicit AM/PM markers
    if (/\b(pm|sham|शाम|evening|raat|रात)\b/i.test(cleaned)) {
      if (hour < 12) hour += 12;
      ampm = 'PM';
    } else if (/\b(am|subah|सुबह|morning)\b/i.test(cleaned)) {
      if (hour >= 12) hour -= 12;
      ampm = 'AM';
    } else {
      // Default logic
      if (hour >= 6 && hour < 12) {
        ampm = 'AM';
      } else if (hour >= 12 && hour < 18) {
        ampm = 'PM';
      } else if (hour >= 18 || hour < 6) {
        ampm = 'PM';
      }
    }
    
    const formattedHour = String(hour % 12 || 12).padStart(2, '0');
    const time = `${formattedHour}:${minute} ${ampm}`;
    console.log(`   ✅ Time extracted (from HH:MM): ${time}`);
    return time;
  }

  // Pattern 2: Digit + "baje" (Indian style)
  const bajePattern = /(\d{1,2})\s*(?:baje|बजे|o'clock|घंटे)/i;
  const bajeMatch = cleaned.match(bajePattern);
  
  if (bajeMatch) {
    let hour = parseInt(bajeMatch[1]);
    
    // Check for AM/PM context
    let ampm = 'AM';
    if (/\b(pm|sham|शाम|dopahar|दोपहर|evening|raat|रात)\b/i.test(cleaned)) {
      if (hour < 12) hour += 12;
      ampm = 'PM';
    } else if (/\b(subah|सुबह|morning|dawn)\b/i.test(cleaned)) {
      ampm = 'AM';
    }
    
    const formattedHour = String(hour % 12 || 12).padStart(2, '0');
    const time = `${formattedHour}:00 ${ampm}`;
    console.log(`   ✅ Time extracted (from baje pattern): ${time}`);
    return time;
  }

  // Pattern 3: Text-based time
  const textTimeMap = {
    'midnight|madhaRaat': '12:00 AM',
    'dawn|fajar|subah|सुबह': '6:00 AM',
    'morning|सुबह': '9:00 AM',
    'noon|dopahar|दोपहर': '12:00 PM',
    'afternoon|दोपहर': '2:00 PM',
    'evening|sham|शाम': '6:00 PM',
    'night|raat|रात': '9:00 PM',
  };

  for (const [pattern, time] of Object.entries(textTimeMap)) {
    if (new RegExp(`\\b(${pattern})\\b`, 'i').test(cleaned)) {
      console.log(`   ✅ Time extracted (from text): ${time}`);
      return time;
    }
  }

  console.log(`   ❌ No time pattern found`);
  return null;
}

// ===== HELPER: TRANSLITERATE HINDI TO ENGLISH =====
const hindiTranslitMap = {
  /* =======================
     AC Related
  ======================= */
  'ऐसी': 'AC',
  'एसी': 'AC',
  'ए.सी.': 'AC',
  'ए सी': 'AC',
  'AC': 'AC',
  'एयर कंडीशन': 'AC',
  'एयर कंडीशनर': 'AC',
  'ठंडा नहीं': 'AC_not_cooling',
  'ठंडी हवा नहीं': 'AC_not_cooling',
  'कूलिंग नहीं': 'AC_not_cooling',
  'ठंडा नहीं कर रहा': 'AC_not_cooling',
  'गर्मी': 'AC_issue',

  /* =======================
     Engine Related
  ======================= */
  'इंजन': 'engine',
  'मोटर': 'engine',
  'इंजन बंद': 'engine_off',
  'इंजन स्टार्ट नहीं': 'engine_not_start',
  'स्टार्ट नहीं हो रहा': 'engine_not_start',
  'स्टार्ट नहीं': 'engine_not_start',
  'गाड़ी स्टार्ट नहीं': 'engine_not_start',
  'आवाज़': 'engine_noise',
  'आवाज': 'engine_noise',
  'धुआं': 'engine_smoke',
  'धुआँ': 'engine_smoke',
  'मिसफायर': 'engine_misfire',
  'ओवरहीट': 'engine_overheat',
  'गरम': 'engine_overheat',
  'ज्यादा गरम': 'engine_overheat',

  /* =======================
     Brake Related
  ======================= */
  'ब्रेक': 'brake',
  'ब्रेक नहीं लग रहा': 'brake_failure',
  'ब्रेक फेल': 'brake_failure',
  'ब्रेक जाम': 'brake_jam',
  'ब्रेक ढीला': 'brake_loose',
  'ब्रेक आवाज': 'brake_noise',
  'ब्रेक की समस्या': 'brake_issue',

  /* =======================
     Tire Related
  ======================= */
  'टायर': 'tire',
  'टायर पंक्चर': 'tire_puncture',
  'पंक्चर': 'tire_puncture',
  'टायर खराब': 'tire_damaged',
  'हवा कम': 'low_air',
  'हवा नहीं': 'no_air',
  'व्हील': 'wheel',
  'रिम': 'rim',

  /* =======================
     Battery Related
  ======================= */
  'बैटरी': 'battery',
  'बैटरी डाउन': 'battery_low',
  'बैटरी खत्म': 'battery_dead',
  'बैटरी खराब': 'battery_damaged',
  'करंट नहीं': 'battery_issue',
  'चार्ज नहीं': 'battery_not_charging',
  'सेल्फ नहीं': 'battery_issue',

  /* =======================
     Hydraulic Related
  ======================= */
  'हाइड्रोलिक': 'hydraulic',
  'हाइड्रोलिक लीकेज': 'hydraulic_leak',
  'तेल लीकेज': 'oil_leak',
  'ऑयल लीक': 'oil_leak',
  'तेल गिर रहा': 'oil_leak',

  /* =======================
     General Problem Words
  ======================= */
  'नहीं': 'not',
  'काम नहीं': 'not_working',
  'काम नहीं कर रहा': 'not_working',
  'खराब': 'damaged',
  'दिक्कत': 'issue',
  'समस्या': 'issue',
  'प्रॉब्लम': 'issue',
  'मुद्दा': 'issue',
  'बंद': 'off',
  'चालू': 'on',
  'शुरू': 'start',
  'रुक गया': 'stopped',
  'अटक': 'stuck',
  'फंस गया': 'stuck',
  'आवाज़ आ रही': 'noise_issue',
  'लाइट जल रही': 'warning_light',
  'चेक इंजन': 'check_engine_light',

  /* =======================
     Vehicle Words
  ======================= */
  'गाड़ी': 'vehicle',
  'कार': 'car',
  'ट्रक': 'truck',
  'बस': 'bus',
  'ट्रैक्टर': 'tractor',
  'वाहन': 'vehicle',
  'स्कूटर': 'scooter',
  'बाइक': 'bike',
  'मोटरसाइकिल': 'bike',

  /* =======================
     Locations
  ======================= */
  'अजमेर': 'ajmer',
  'जयपुर': 'jaipur',
  'दिल्ली': 'delhi',
  'उदयपुर': 'udaipur',
  'कोटा': 'kota',
  'जोधपुर': 'jodhpur',
  'बीकानेर': 'bikaner',
  'अलवर': 'alwar',
  'भारत': 'india',

  /* =======================
     Emergency / Service
  ======================= */
  'मदद': 'help',
  'सर्विस': 'service',
  'सर्विस चाहिए': 'service_request',
  'मिस्त्री': 'mechanic',
  'मेकैनिक': 'mechanic',
  'वर्कशॉप': 'workshop',
  'टोइंग': 'towing',
  'टो': 'towing',
  'रोडसाइड': 'roadside_assistance',
  'जल्दी': 'urgent',
  'इमरजेंसी': 'emergency'
};


export function transliterateHindiToEnglish(text) {
  if (!text) return text;
  let result = text;
  for (const [hindi, english] of Object.entries(hindiTranslitMap)) {
    const regex = new RegExp(hindi, 'gi');
    result = result.replace(regex, english);
  }
  return result.trim();
}

// ===== VALIDATION HELPERS =====
export function isValidPhone(phone) {
  if (!phone) return false;
  if (phone.length !== 10) return false;
  return /^[6-9]\d{9}$/.test(phone);
}

export function isValidChassis(chassis) {
  if (!chassis) return false;
  if (chassis.length < 4) return false;
  return /^[a-zA-Z0-9]{4,}$/.test(chassis);
}

export function isValidPincode(pincode) {
  if (!pincode) return false;
  return /^\d{5,6}$/.test(pincode);
}

export function isValidName(name) {
  if (!name) return false;
  if (name.length < 2) return false;
  return /[a-zA-Z\u0900-\u097F]{2,}/.test(name);
}

export function isValidAddress(address) {
  if (!address) return false;
  return address.length >= 5;
}