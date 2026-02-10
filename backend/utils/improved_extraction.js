/* =======================
   IMPROVED EXTRACTION FUNCTIONS V2
   - Filters out Hindi/English filler words FIRST
   - Focuses on extracting only relevant data
   - Better accuracy for phone, chassis, name, pincode, address, time
======================= */

/**
 * IMPROVED: Extract phone number by filtering noise words first
 */
function extractPhoneNumberV2(text) {
  if (!text) return null;
  
  console.log("📱 PHONE EXTRACTION START");
  console.log("   Input:", text);
  
  // List of Hindi & English noise/filler words to remove
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
    'to', 'तो', 'is', 'है', 'are', 'हैं'
  ];
  
  // Remove noise words while preserving numbers
  let cleaned = text.toLowerCase();
  
  for (const noiseWord of noiseWords) {
    const regex = new RegExp(`\\b${noiseWord}\\b`, 'gi');
    cleaned = cleaned.replace(regex, ' ');
  }
  
  console.log("   After removing noise words:", cleaned);
  
  // Remove all non-digit characters
  const digitsOnly = cleaned.replace(/\D/g, '');
  
  console.log("   Digits only:", digitsOnly);
  
  // Try to find 10-digit phone number
  if (digitsOnly.length === 10 && /^[6-9]\d{9}$/.test(digitsOnly)) {
    console.log("   ✅ Valid 10-digit phone found:", digitsOnly);
    return digitsOnly;
  }
  
  // Try 11-digit with country code (91)
  if (digitsOnly.length === 11 && digitsOnly.startsWith('91')) {
    const phone = digitsOnly.substring(1);
    if (/^[6-9]\d{9}$/.test(phone)) {
      console.log("   ✅ Valid phone found (with country code):", phone);
      return phone;
    }
  }
  
  // Try 12-digit with +91
  if (digitsOnly.length === 12 && digitsOnly.startsWith('91')) {
    const phone = digitsOnly.substring(2);
    if (/^[6-9]\d{9}$/.test(phone)) {
      console.log("   ✅ Valid phone found (with +91):", phone);
      return phone;
    }
  }
  
  // Try word-to-digit conversion for Hindi numbers
  const hindiDigits = {
    'शून्य': '0', 'zero': '0', 'shunya': '0',
    'एक': '1', 'ek': '1', 'one': '1',
    'दो': '2', 'do': '2', 'two': '2',
    'तीन': '3', 'teen': '3', 'three': '3',
    'चार': '4', 'char': '4', 'four': '4',
    'पांच': '5', 'paanch': '5', 'five': '5',
    'छह': '6', 'chhe': '6', 'six': '6',
    'सात': '7', 'saat': '7', 'seven': '7',
    'आठ': '8', 'aath': '8', 'eight': '8',
    'नौ': '9', 'nau': '9', 'nine': '9',
  };
  
  const words = text.toLowerCase().split(/\s+/);
  let convertedDigits = '';
  
  for (const word of words) {
    if (hindiDigits[word]) {
      convertedDigits += hindiDigits[word];
    } else if (/^\d$/.test(word)) {
      convertedDigits += word;
    }
  }
  
  if (convertedDigits.length === 10 && /^[6-9]\d{9}$/.test(convertedDigits)) {
    console.log("   ✅ Phone extracted from word-to-digit conversion:", convertedDigits);
    return convertedDigits;
  }
  
  console.log("   ❌ No valid phone number found");
  return null;
}

/**
 * IMPROVED: Extract chassis number by filtering noise words first
 */
function extractChassisNumberV2(text) {
  if (!text) return null;
  
  console.log("🔧 CHASSIS EXTRACTION START");
  console.log("   Input:", text);
  
  // Noise words to remove
  const noiseWords = [
    'chassis', 'चेसिस', 'number', 'नंबर', 'mera', 'मेरा', 'hai', 'है',
    'machine', 'मशीन', 'enjin', 'इंजन', 'engine', 'naam', 'नाम',
    'batao', 'बताओ', 'batayein', 'बताएं', 'bolo', 'बोलो', 'se', 'से',
    'mein', 'में', 'par', 'पर', 'aap', 'आप', 'apna', 'अपना',
    'kripya', 'कृपया', 'please', 'pls', 'to', 'तो', 'aapka', 'आपका',
    'hoon', 'हूं', 'ho', 'हो', 'rahe', 'रहे', 'raha', 'रहा',
    'mere', 'मेरे', 'pas', 'पास', 'bata', 'बता'
  ];
  
  let cleaned = text.toLowerCase();
  
  // Remove noise words
  for (const noiseWord of noiseWords) {
    const regex = new RegExp(`\\b${noiseWord}\\b`, 'gi');
    cleaned = cleaned.replace(regex, ' ');
  }
  
  console.log("   After removing noise:", cleaned);
  
  // Remove special characters and extra spaces
  cleaned = cleaned.replace(/[।.,!?:;-]/g, ' ').replace(/\s+/g, ' ').trim();
  
  console.log("   After cleaning special chars:", cleaned);
  
  // Get remaining words
  const words = cleaned.split(/\s+/).filter(w => w.length > 0);
  
  console.log("   Remaining words:", words);
  
  // Chassis numbers are typically alphanumeric and longer
  // Common patterns: starts with letter, contains digits
  for (const word of words) {
    // Must contain at least 4 characters and have both letters and numbers
    if (word.length >= 4 && /[a-zA-Z]/.test(word) && /[0-9]/.test(word)) {
        const chassis = extractChassisNumberV2(rawSpeech);
      console.log("   ✅ Chassis extracted:", chassis);
      return chassis;
    }
  }
  
  // If no mixed alphanumeric found, try longest alphanumeric sequence
  const allAlphaNumeric = cleaned.replace(/[^a-zA-Z0-9]/g, '');
  if (allAlphaNumeric.length >= 4) {
    console.log("   ✅ Chassis extracted (from combined):", allAlphaNumeric.toUpperCase());
    return allAlphaNumeric.toUpperCase();
  }
  
  console.log("   ❌ No valid chassis found");
  return null;
}

/**
 * IMPROVED: Extract name by filtering out numbers and noise words
 */
function extractNameV2(text) {
  if (!text) return null;
  
  console.log("👤 NAME EXTRACTION START");
  console.log("   Input:", text);
  
  // Noise words
  const noiseWords = [
    'mera', 'मेरा', 'naam', 'नाम', 'hai', 'है', 'hoon', 'हूं',
    'main', 'मैं', 'mein', 'में', 'my', 'name', 'is', 'am', 'i',
    'kya', 'क्या', 'kaun', 'कौन', 'bolo', 'बोलो', 'batao', 'बताओ',
    'aaj', 'आज', 'kal', 'कल', 'sir', 'सर', 'madam', 'मैडम',
    'ji', 'जी', 'haan', 'हां', 'phone', 'फोन', 'number', 'नंबर',
    'se', 'से', 'par', 'पर', 'to', 'तो', 'aap', 'आप', 'apna', 'अपना',
    'kripya', 'कृपया', 'please', 'pls', 'batayein', 'बताएं',
    'mere', 'मेरे', 'aapka', 'आपका', 'mere', 'मेरे'
  ];
  
  let cleaned = text.toLowerCase();
  
  // Remove noise words
  for (const noiseWord of noiseWords) {
    const regex = new RegExp(`\\b${noiseWord}\\b`, 'gi');
    cleaned = cleaned.replace(regex, ' ');
  }
  
  console.log("   After removing noise:", cleaned);
  
  // Remove special characters and numbers
  cleaned = cleaned.replace(/[0-9।.,!?:;-]/g, ' ').replace(/\s+/g, ' ').trim();
  
  console.log("   After removing numbers and special chars:", cleaned);
  
  // Split into words
  const words = cleaned.split(/\s+/).filter(word => {
    // Word must be at least 2 characters
    if (word.length < 2) return false;
    
    // Must contain letters (not just special chars)
    if (!/[a-zA-Z\u0900-\u097F]/.test(word)) return false;
    
    return true;
  });
  
  console.log("   Valid words:", words);
  
  if (words.length === 0) {
    console.log("   ❌ No valid name found");
    return null;
  }
  
  // Join first 2 words max (first name + last name)
  const extractedName = words.slice(0, 2).join(' ');
  
  console.log("   ✅ Name extracted:", extractedName);
  return extractedName;
}

/**
 * IMPROVED: Extract pincode by filtering noise
 */
function extractPincodeV2(text) {
  if (!text) return null;
  
  console.log("📍 PINCODE EXTRACTION START");
  console.log("   Input:", text);
  
  // Noise words to remove
  const noiseWords = [
    'pincode', 'पिनकोड', 'zip', 'code', 'कोड', 'address', 'पता',
    'location', 'जगह', 'area', 'इलाका', 'sector', 'सेक्टर',
    'mera', 'मेरा', 'machine', 'मशीन', 'par', 'पर', 'hai', 'है',
    'se', 'से', 'mein', 'में'
  ];
  
  let cleaned = text.toLowerCase();
  
  // Remove noise words
  for (const noiseWord of noiseWords) {
    const regex = new RegExp(`\\b${noiseWord}\\b`, 'gi');
    cleaned = cleaned.replace(regex, ' ');
  }
  
  console.log("   After removing noise:", cleaned);
  
  // Remove non-digits
  const digitsOnly = cleaned.replace(/\D/g, '');
  
  console.log("   Digits only:", digitsOnly);
  
  // Look for 6-digit or 5-digit pincode
  if (digitsOnly.length >= 5) {
    // Try 6-digit first
    const last6 = digitsOnly.slice(-6);
    if (last6.length === 6 && /^\d{6}$/.test(last6)) {
      console.log("   ✅ 6-digit pincode found:", last6);
      return last6;
    }
    
    // Try 5-digit
    const last5 = digitsOnly.slice(-5);
    if (last5.length === 5 && /^\d{5}$/.test(last5)) {
      console.log("   ✅ 5-digit pincode found:", last5);
      return last5;
    }
  }
  
  console.log("   ❌ No valid pincode found");
  return null;
}

/**
 * IMPROVED: Extract location address by removing numbers and noise
 */
function extractLocationAddressV2(text) {
  if (!text) return { address: "Unknown", pincode: "" };
  
  console.log("📍 LOCATION EXTRACTION START");
  console.log("   Input:", text);
  
  // First extract pincode
  const pincode = extractPincodeV2(text);
  
  // Noise words
  const noiseWords = [
    'meri', 'मेरी', 'machine', 'मशीन', 'hai', 'है', 'par', 'पर',
    'pincode', 'पिनकोड', 'location', 'जगह', 'address', 'पता',
    'kripya', 'कृपया', 'batayein', 'बताएं', 'se', 'से', 'mein', 'में',
    'aapki', 'आपकी', 'aap', 'आप', 'apna', 'अपना', 'mere', 'मेरे'
  ];
  
  let cleaned = text.toLowerCase();
  
  // Remove noise words
  for (const noiseWord of noiseWords) {
    const regex = new RegExp(`\\b${noiseWord}\\b`, 'gi');
    cleaned = cleaned.replace(regex, ' ');
  }
  
  // Remove phone numbers and extra numbers
  cleaned = cleaned.replace(/\d{10}/, ''); // Remove 10-digit numbers
  cleaned = cleaned.replace(/\d{6}/, '');  // Remove 6-digit pincode
  cleaned = cleaned.replace(/\s+\d+\s+/g, ' '); // Remove standalone numbers
  
  // Remove special chars
  cleaned = cleaned.replace(/[।.,!?:;-]/g, ' ').replace(/\s+/g, ' ').trim();
  
  console.log("   Cleaned address:", cleaned);
  
  // If empty after cleaning, return default
  if (!cleaned || cleaned.length < 3) {
    console.log("   ❌ No valid address extracted");
    return { address: "Unknown", pincode: pincode || "" };
  }
  
  console.log("   ✅ Address extracted:", cleaned);
  return {
    address: cleaned,
    pincode: pincode || ""
  };
}

/**
 * IMPROVED: Extract time by removing noise words first
 */
function extractTimeV2(text) {
  if (!text) return null;
  
  console.log("⏰ TIME EXTRACTION START");
  console.log("   Input:", text);
  
  // Time-related noise words
  const noiseWords = [
    'se', 'से', 'tak', 'तक', 'engineer', 'इंजीनियर', 'aa', 'आ',
    'sakta', 'सकता', 'sakte', 'सकते', 'ruk', 'रुक', 'ho', 'हो'
  ];
  
  let cleaned = text.toLowerCase();
  
  // Remove noise but keep time context words
  for (const noiseWord of noiseWords) {
    const regex = new RegExp(`\\b${noiseWord}\\b`, 'gi');
    cleaned = cleaned.replace(regex, ' ');
  }
  
  console.log("   After removing noise:", cleaned);
  
  // Pattern for "X baje" or "X bajay"
  const bajeMatch = cleaned.match(/(\d{1,2}):?(\d{2})?\s*(baje|bajay|बजे)/i);
  if (bajeMatch) {
    const hour = parseInt(bajeMatch[1]);
    const minute = bajeMatch[2] || "00";
    
    // Determine AM/PM from context
    let period = 'AM';
    const isPM = /sham|evening|शाम|dopahar|दोपहर|afternoon|raat|रात|night|top|टॉप/gi.test(cleaned);
    const isMorning = /subah|morning|सुबह|ek|एक/gi.test(cleaned);
    
    if (isPM && hour <= 12) {
      period = 'PM';
    } else if (isMorning && hour <= 12) {
      period = 'AM';
    } else if (hour > 12) {
      // 24-hour format
      const convertedHour = hour - 12;
      console.log(`   ✅ Time extracted: ${convertedHour}:${minute} PM`);
      return `${convertedHour}:${minute} PM`;
    }
    
    console.log(`   ✅ Time extracted: ${hour}:${minute} ${period}`);
    return `${hour}:${minute} ${period}`;
  }
  
  // Pattern for morning
  if (/subah|morning|सुबह/gi.test(cleaned)) {
    const hourMatch = cleaned.match(/(\d{1,2})/);
    if (hourMatch) {
      const hour = parseInt(hourMatch[1]);
      if (hour >= 1 && hour <= 12) {
        console.log(`   ✅ Time extracted (Morning): ${hour}:00 AM`);
        return `${hour}:00 AM`;
      }
    }
    console.log("   ✅ Time extracted (Morning default): 9:00 AM");
    return "9:00 AM";
  }
  
  // Pattern for afternoon
  if (/dopahar|afternoon|दोपहर/gi.test(cleaned)) {
    const hourMatch = cleaned.match(/(\d{1,2})/);
    if (hourMatch) {
      const hour = parseInt(hourMatch[1]);
      if (hour >= 1 && hour <= 12) {
        console.log(`   ✅ Time extracted (Afternoon): ${hour}:00 PM`);
        return `${hour}:00 PM`;
      }
    }
    console.log("   ✅ Time extracted (Afternoon default): 2:00 PM");
    return "2:00 PM";
  }
  
  // Pattern for evening
  if (/sham|evening|शाम/gi.test(cleaned)) {
    const hourMatch = cleaned.match(/(\d{1,2})/);
    if (hourMatch) {
      const hour = parseInt(hourMatch[1]);
      if (hour >= 1 && hour <= 12) {
        console.log(`   ✅ Time extracted (Evening): ${hour}:00 PM`);
        return `${hour}:00 PM`;
      }
    }
    console.log("   ✅ Time extracted (Evening default): 5:00 PM");
    return "5:00 PM";
  }
  
  console.log("   ❌ No valid time found");
  return null;
}

export {
  extractPhoneNumberV2,
  extractChassisNumberV2,
  extractNameV2,
  extractPincodeV2,
  extractLocationAddressV2,
  extractTimeV2
};