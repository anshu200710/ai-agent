/**
 * conversational_intelligence.js
 * ================================
 * Drop-in module for JCB Voice Call Agent
 * Handles ALL alternative customer speech patterns:
 *   - Confusion / didn't hear
 *   - Requests to repeat
 *   - Hold / wait requests
 *   - Interruptions
 *   - Step-specific smart prompts
 *
 * USAGE in voice.js:
 *   import {
 *     detectConversationalIntent,
 *     getRepeatResponse,
 *     getWaitResponse,
 *     getSmartPrompt,
 *     INTENT
 *   } from './conversational_intelligence.js';
 *
 * Then in each step, BEFORE your normal logic, add:
 *   const intent = detectConversationalIntent(rawSpeech);
 *   if (intent === INTENT.REPEAT)  { ask(twiml, getRepeatResponse(callData)); return ... }
 *   if (intent === INTENT.WAIT)    { ask(twiml, getWaitResponse(callData));   return ... }
 *   if (intent === INTENT.CONFUSED){ ask(twiml, getConfusedResponse(callData)); return ... }
 */

/* =====================================================================
   INTENT ENUM
   ===================================================================== */
export const INTENT = {
  REPEAT:       'REPEAT',       // "dobara boliye", "kya kaha", "suna nahi"
  WAIT:         'WAIT',         // "ruko", "ek minute", "machine dekke btata hu"
  CONFUSED:     'CONFUSED',     // "kya", "samajh nahi", "matlab"
  CHECKING:     'CHECKING',     // "check kar raha hu", "machine dekh raha hu"
  SPELLING_OUT: 'SPELLING_OUT', // customer slowly spelling letters/numbers
  GREETING:     'GREETING',     // "haan", "hello", "ji" as first word
  HELP:         'HELP',         // "help", "kya karna hai", "guide karo"
  COMPLAINT_DONE:'COMPLAINT_DONE', // "bas itna hi", "aur kuch nahi", "yahi problem hai"
  NORMAL:       'NORMAL',       // no special handling needed
};

/* =====================================================================
   REPEAT KEYWORDS — Customer didn't hear / wants it again
   ===================================================================== */
const REPEAT_PATTERNS = [
  // Hindi
  'dobara boliye', 'dobara bolo', 'dobara bol', 'phir se boliye',
  'phir se bolo', 'phir bolo', 'fir se bolo', 'fir boliye',
  'ek baar aur', 'ek baar aur boliye', 'ek baar dobara',
  'kya kaha', 'kya kaha aapne', 'kya bola', 'kya bole',
  'kya bol rahe ho', 'kya bol rahe hain', 'kya bol rahi ho',
  'suna nahi', 'suna nahi aapka', 'sunai nahi diya', 'sunai nahi',
  'awaz nahi aayi', 'awaz nahi', 'awaz kam hai', 'awaaz nahi',
  'samjha nahi', 'samjhi nahi', 'samajh nahi aaya', 'samajh nahi',
  'nahi samjha', 'nahi samjhi', 'nahi samjhe',
  'kuch nahi suna', 'kuch suna nahi', 'kuch samjha nahi',
  'door se bol rahe', 'door laga', 'thoda door laga',
  'network problem', 'network kharab', 'call cut ho gayi',
  'baar baar bol', 'mujhe nahi pata kya kaha',
  'kya boliye', 'kya bolein', 'kya kehna tha',
  'dheere boliye', 'dheere bolo', 'thoda dheere',
  'jaldi mat boliye', 'thoda dheere', 'thoda slowly',
  'clear nahi tha', 'clear nahi', 'clear nahi suna',
  'thoda loud boliye', 'aur loud', 'thoda tez boliye',
  'repeat karo', 'repeat karein', 'repeat please',
  'kya tha number', 'number kya tha', 'address kya tha',
  'mujhe nahi suna', 'yeh kya tha',
  'line kharab hai', 'connection kharab', 'aawaz nahin aa rahi',
  'ek baar aur kaha de', 'phir se kah de',
  // English / Hinglish
  'repeat', 'say again', 'come again', 'excuse me',
  'pardon', 'what', 'huh', 'what did you say',
  'could not hear', 'did not hear', 'cant hear',
  'please repeat', 'can you repeat', 'please say again',
  'speak slowly', 'slow down', 'too fast',
  'what was that', 'what number', 'what address',
  // Hindi (Devanagari script)
  'दोबारा', 'दोबारा बोलो', 'दोबारा बोलिए', 'फिर से बोलो', 'फिर से बोलिए',
  'एक बार और', 'एक बार और बोलिए', 'फिर बोलो',
  'क्या कहा', 'क्या बोले', 'क्या बोल रहे हो', 'क्या कहा आपने',
  'नहीं सुना', 'आवाज नहीं आई', 'आवाज नहीं', 'सुनाई नहीं',
  'समझ नहीं', 'समझ नहीं आया', 'नहीं समझा', 'कुछ नहीं सुना',
  'दूर लगा', 'नेटवर्क खराब', 'कॉल कट', 'कॉल बंद',
  'धीरे बोलिए', 'धीरे बोलो', 'साफ बोलिए', 'साफ़ बोल',
  'क्या संख्या', 'पता नहीं क्या कहा', 'दोबारा बोल', 'एक बार और बोल',
];

/* =====================================================================
   WAIT / HOLD KEYWORDS — Customer needs time
   ===================================================================== */
const WAIT_PATTERNS = [
  // Hindi — short holds
  'ruko', 'ruk jao', 'ruk jaiye', 'ruko zara', 'zara ruko',
  'ek minute', 'ek min', 'ek second', 'ek sec',
  'ek pal', 'ek pal ruko', 'thodi der', 'thoda der',
  'thodi der ruko', 'thoda ruko', 'bas ek minute',
  'ruko yaar', 'bhai ruko', 'didi ruko', 'sir ruko',
  'wait karo', 'wait kar', 'thoda wait kar',
  // Hindi — checking machine/document
  'machine dekh raha hu', 'machine dekh rahi hu',
  'machine dekh raha hoon', 'machine dekh ke batata',
  'machine dekke bolunga', 'machine dekta hoon',
  'number dekhta hu', 'number dekh raha hu',
  'number dhundh raha hu', 'number dhundh rahi hu',
  'chassis dhundh raha hu', 'chassis dhoondh raha',
  'kagaz dhundh raha hu', 'kagaz dekh raha hu',
  'document dekh raha hu', 'document nikal raha hu',
  'bahar jaata hu', 'machine ke paas jaata hu',
  'machine ke paas jao', 'machine ke paas chala jata',
  'site par dekh raha hu', 'site par jaata hu',
  // Hindi — other hold reasons
  'call hold kar', 'hold karo', 'hold karein',
  'abhi aata hu', 'abhi aati hu', 'abhi aate hain',
  'kisi ko puchna hai', 'kisi se puchta hu',
  'driver se puchta hu', 'operator se puchta hu',
  'gaadi par hai', 'gaadi mein hai', 'site par hai',
  'operator bata raha hai', 'bata raha hai',
  'yad kar raha hu', 'yaad karne do',
  'soochne do', 'sochne do', 'sooch raha hu',
  'plate dekh raha hu', 'bill dekh raha hu',
  'registration paper dekh raha', 'manual dekh raha',
  'ek minute dekh leta hu', 'thodi der mein batata hu',
  'thodi der mein pata chalega', 'operator se pata kar raha hu',
  // Hindi (Devanagari script)
  'रुको', 'रुक जाओ', 'रुक जाइए', 'एक मिनट', 'एक सेकंड',
  'एक पल', 'थोड़ी देर', 'थोड़ी देर रुको', 'बस एक मिनट',
  'रुको यार', 'भाई रुको', 'सर रुको',
  'मशीन देख रहा हू', 'मशीन देख रहा हूँ', 'नंबर देख रहा हू',
  'नंबर ढूंढ रहा हू', 'चेसिस ढूंढ रहा हू',
  'कागज ढूंढ रहा हू', 'कागज देख रहा हू',
  'दस्तावेज देख रहा हू', 'दस्तावेज निकाल रहा हू',
  'बाहर जा रहा हू', 'साइट पर जा रहा हू',
  'अभी आता हू', 'अभी आएंगे',
  'किसी से पूछ रहा हू', 'ड्राइवर से पूछ रहा हू',
  'ऑपरेटर से पूछ रहा हू', 'गाड़ी पर है', 'साइट पर है',
  'बता रहा है', 'याद कर रहा हू', 'सोच रहा हू',
];

/* =====================================================================
   CONFUSION / DIDN'T UNDERSTAND KEYWORDS
   ===================================================================== */
const CONFUSED_PATTERNS = [
  // Hindi
  'kya', 'kya matlab', 'kya matlab hai', 'kya bol rahe ho',
  'matlab kya hai', 'matlab kya', 'matlab batao',
  'kya pooch rahe ho', 'kya pooch rahi ho', 'kya poochh raha hai',
  'kya chahiye', 'kya karna hai', 'kya bolunga', 'kya bolu',
  'kya bolun', 'kya kahu', 'kya kahen',
  'nahi samjha', 'nahi samjhi', 'samajh nahi',
  'samajh nahi aaya', 'samajh nahi ayi',
  'thoda explain karo', 'thoda explain karein',
  'kya bolun main', 'kya likhna hai', 'kya puchh raha',
  'kya hua', 'kya baat hai', 'kya problem hai',
  'guide karo', 'bata do', 'batao',
  'pehle se kuch nahi pata', 'naya customer hu',
  'pahli baar call kar raha', 'pehli baar call',
  'yeh kya number hai', 'yeh kya pooch raha',
  'mujhe nahi pata', 'pata nahi', 'pata nahi bhai',
  // English / Hinglish
  'what do you mean', 'what does that mean', 'i dont understand',
  'i do not understand', 'confused', 'not clear',
  'please explain', 'can you explain', 'what is this',
  'what number', 'which number', 'what kind of',
  'dont know what to say', 'not sure', 'unsure',
  'help me', 'please help', 'guide me',
  'what should i say', 'how to answer', 'what answer',
  // Hindi (Devanagari script)
  'क्या', 'क्या मतलब', 'क्या मतलब है', 'क्या बोल रहे हो',
  'मतलब क्या है', 'मतलब क्या', 'मतलब बताओ',
  'क्या पूछ रहे हो', 'क्या चाहिए', 'क्या करना है',
  'नहीं समझा', 'नहीं समझी', 'समझ नहीं', 'समझ नहीं आया',
  'नहीं समझा', 'कुछ नहीं समझ आया',
  'थोड़ा समझाओ', 'समझाओ', 'बताओ',
  'पहले से कुछ नहीं पता', 'नया कस्टमर हूँ',
  'पहली बार कॉल कर रहा हू', 'यह क्या नंबर है',
  'मुझे नहीं पता', 'पता नहीं', 'समझ में नहीं आया',
  'गाइड करो', 'समझा दो', 'साफ़ करके बोलो',
  'मुझे गाइड करो', 'गाइड कर दे', 'बता दे',
];

/* =====================================================================
   CHECKING / MACHINE INSPECTION KEYWORDS
   ===================================================================== */
const CHECKING_PATTERNS = [
  'machine dekh raha', 'machine check kar raha',
  'number note kar raha', 'number likh raha',
  'chassis plate dekh raha', 'plate dekh raha',
  'manual dekh raha', 'book dekh raha',
  'abhi dhundh raha', 'abhi dekhta hu',
  'thodi der mein bata', 'thodi der mein pata chalega',
  'operator se pata kar', 'driver se pata kar',
  'site par confirm kar', 'puchh ke aata hu',
  'check karta hu', 'note karta hu',
  // Hindi (Devanagari script)
  'मशीन देख रहा हू', 'मशीन देख रहा हूँ', 'मशीन देख रहे हो',
  'नंबर देख रहा हू', 'नंबर देख रहा हूँ', 'नंबर देख रहे हो',
  'नंबर ढूंढ रहा हू', 'नंबर ढूंढ रहा हूँ',
  'प्लेट देख रहा हू', 'प्लेट देख रहा हूँ',
  'दस्तावेज़ देख रहा हू', 'दस्तावेज़ निकाल रहा हू',
  'कागज देख रहा हू', 'कागज ढूंढ रहा हू',
  'चेसिस नंबर ढूंढ रहा', 'मशीन का नंबर देख रहा',
  'डॉक्यूमेंट निकाल रहा', 'कागज़ ढूंढ रहा हू',
];

/* =====================================================================
   COMPLAINT DONE KEYWORDS — "That's all" signals
   ===================================================================== */
const COMPLAINT_DONE_PATTERNS = [
  // Hindi
  'bas', 'bas itna', 'bas itna hi', 'bas yahi',
  'yahi problem hai', 'yahi hai', 'yahi baat hai',
  'aur kuch nahi', 'aur koi problem nahi',
  'sirf yahi', 'sirf yeh ek', 'ek hi problem',
  'yeh hi sab', 'yahi sab hai', 'sab kuch yahi hai',
  'theek hai aur kuch nahi', 'ok bas itna hi',
  'register karo', 'darz karo', 'likh lo',
  'haan register', 'kar do register',
  'complaint darz', 'complaint register',
  'ho gaya', 'itna hi batana tha', 'itna hi tha',
  'sirf itna hi problem hai', 'itna hi complaint hai',
  'kaam khatam', 'to ho gaya', 'theek hai to likha do',
  'ab likha de complaint', 'ab submit kar de',
  'bas ab bas', 'ab aur kuch nahi', 'thik se likh lo',
  'yeh problem hai bas', 'aur koi taklif nahi',
  'saari taklif bata di', 'sara complaint bata diya',
  'ek ek problem bol diya', 'sab problems bata di',
  'ab enter kar de', 'register kar de bhai',
  // English / Hinglish
  'that is all', 'thats all', 'nothing else',
  'only this', 'just this', 'register this', 'please register',
  'save this', 'done', 'finished', 'complete', 'all done',
  // Hindi (Devanagari script)
  'बस', 'बस इतना', 'बस इतना ही', 'बस यही',
  'यही समस्या है', 'यही है', 'यही बात है',
  'और कुछ नहीं', 'और कोई समस्या नहीं',
  'सिर्फ यही', 'सिर्फ यह एक', 'एक ही समस्या',
  'यह ही सब', 'यही सब है', 'सब कुछ यही है',
  'ठीक है और कुछ नहीं', 'ओके बस इतना ही',
  'रजिस्टर करो', 'दर्ज करो', 'लिख लो',
  'हाँ रजिस्टर', 'कर दो रजिस्टर',
  'कंप्लेंट दर्ज', 'कंप्लेंट रजिस्टर',
  'हो गया', 'इतना ही बताना था', 'इतना ही था',
  'सिर्फ इतना ही समस्या है', 'इतना ही कंप्लेंट है',
  'काम खत्म', 'तो हो गया', 'ठीक है तो लिख दो',
  'अब लिख दे कंप्लेंट', 'अब सबमिट कर दे',
  'बस अब बस', 'अब और कुछ नहीं', 'ठीक से लिख लो',
];

/* =====================================================================
   HELP / GUIDE KEYWORDS
   ===================================================================== */
const HELP_PATTERNS = [
  'help', 'help karo', 'help chahiye', 'help kijiye',
  'help de zara', 'madad kar', 'madad chahiye',
  'guide karo', 'guide karein', 'samjhao',
  'kya karna hai mujhe', 'kya bolna chahiye',
  'kaise bolun', 'kaise batau', 'kaise bolunga',
  'process kya hai', 'kya process hai',
  'agent se baat', 'agent chahiye', 'insaan chahiye',
  'real person', 'aadmi se baat kar', 'manushya se baat', 'human se baat',
  'mujhe samjhao', 'guide kar de', 'batao na', 'procedure',
  // Hindi (Devanagari script)
  'मदद', 'मदद करो', 'मदद करें', 'मदद कर दो',
  'मदद दे', 'मदद की जरूरत है', 'मदद चाहिए',
  'गाइड करो', 'गाइड कर दे', 'समझा दो', 'समझाओ',
  'क्या करना है', 'क्या बोलना चाहिए', 'कैसे बोलूँ',
  'कैसे बताऊँ', 'कैसे बोलूँगा', 'क्या पूछूँ',
  'प्रक्रिया क्या है', 'प्रक्रिया कैसे होती है',
  'एजेंट से बात करना है', 'एजेंट चाहिए', 'इंसान चाहिए',
  'असली इंसान', 'आदमी से बात करना', 'मानव से बात', 'असली व्यक्ति',
  'मुझे समझा दो', 'गाइड कर दे भाई', 'प्रक्रिया बताओ', 'यह क्या है',
  'कोई समझा दे', 'समझ नहीं आ रहा', 'मुझे पता नहीं है',
];

/* =====================================================================
   CORE INTENT DETECTOR
   Call this FIRST in every step handler
   ===================================================================== */
export function detectConversationalIntent(rawSpeech) {
  if (!rawSpeech || rawSpeech.trim().length === 0) return INTENT.NORMAL;
  const t = rawSpeech.toLowerCase().trim();

  // Priority order: CHECKING > WAIT > REPEAT > CONFUSED > HELP > COMPLAINT_DONE
  if (CHECKING_PATTERNS.some(p => t.includes(p)))       return INTENT.CHECKING;
  if (WAIT_PATTERNS.some(p => t.includes(p)))           return INTENT.WAIT;
  if (REPEAT_PATTERNS.some(p => t.includes(p)))         return INTENT.REPEAT;
  if (CONFUSED_PATTERNS.some(p => t.includes(p)))       return INTENT.CONFUSED;
  if (HELP_PATTERNS.some(p => t.includes(p)))           return INTENT.HELP;
  if (COMPLAINT_DONE_PATTERNS.some(p => t.includes(p))) return INTENT.COMPLAINT_DONE;

  return INTENT.NORMAL;
}

/* =====================================================================
   RESPONSE BUILDERS — Returns the right message for each intent
   ===================================================================== */

/**
 * getRepeatResponse
 * Returns a re-ask of the last question with a polite acknowledgment
 */
export function getRepeatResponse(callData) {
  const lastQ = callData.lastQuestion || "Kripya apna jawab bolein.";
  const acks = [
    "Bilkul, main dobara bol raha hoon.",
    "Zaroor, ek baar aur.",
    "Theek hai, phir se bolte hain.",
    "Koi baat nahi, sun lijiye.",
  ];
  const ack = acks[Math.floor(Math.random() * acks.length)];
  return `${ack} ${lastQ}`;
}

/**
 * getWaitResponse
 * Acknowledges the hold and re-asks the same question after waiting
 */
export function getWaitResponse(callData) {
  const lastQ = callData.lastQuestion || "Kripya apna jawab bolein.";
  const msgs = [
    `Theek hai, main wait kar raha hoon. Jab ready ho jayen, tab bolein — ${lastQ}`,
    `Koi baat nahi, time le lijiye. Tayaar hone par bolein — ${lastQ}`,
    `Zaroor dekh lijiye, main hold par hoon. Tayaar hon to bolein — ${lastQ}`,
    `Bilkul, main yahan hoon. Machine dekh ke batayein — ${lastQ}`,
  ];
  return msgs[Math.floor(Math.random() * msgs.length)];
}

/**
 * getConfusedResponse
 * Gives a clear simple explanation based on current step
 */
export function getConfusedResponse(callData) {
  const step = callData.step || '';
  const hints = {
    ask_machine_no: [
      "Main aapki JCB machine ka number maang raha hoon. " +
      "Machine par ek 4 se 8 digit ka number hota hai. " +
      "Woh number ek ek karke boliye. Jaise: 3, 3, 0, 5, 4, 4, 7.",
      "Machine ke upar ya side mein ek plate hoti hai jisme number likha hota hai. " +
      "Woh number boliye — sirf digits, ek ek karke.",
    ],
    confirm_customer: [
      `Humhare system mein ${callData.customerData?.name || 'ek naam'} aur ` +
      `${callData.customerData?.city || 'ek city'} record mein hai. ` +
      "Kya yeh aapka hi record hai? Bas 'haan' ya 'nahi' boliye.",
    ],
    ask_city: [
      "Abhi aapki machine kaunse shahar mein khadi hai? " +
      "Jaise: Jaipur, Kota, Ajmer, Alwar, Sikar, Udaipur, Bhilwara. " +
      "Bas city ka naam boliye.",
    ],
    ask_engineer_location: [
      "Engineer ya mechanic kahan aaye? " +
      "Workshop ka naam ya address boliye. " +
      "Jaise: 'Jaipur workshop', ya 'Tonk road gaon', ya 'site par'.",
    ],
    ask_phone: [
      "Aapka 10 digit mobile number chahiye. " +
      "Ek ek digit boliye. Jaise: 9, 8, 7, 6, 5, 4, 3, 2, 1, 0.",
    ],
    ask_complaint: [
      "Machine mein kya kharaabi hai woh batayein. " +
      "Jaise: engine start nahi ho raha, ya gear nahi lag raha, " +
      "ya hydraulic slow hai, ya brake problem hai. " +
      "Jo bhi problem ho, bata dijiye.",
    ],
  };

  const stepHints = hints[step];
  if (stepHints) {
    return stepHints[Math.floor(Math.random() * stepHints.length)];
  }
  return "Koi baat nahi. Main aapki madad karta hoon. " +
         (callData.lastQuestion || "Apna jawab clearly boliye.");
}

/**
 * getCheckingResponse
 * Customer is physically checking the machine — hold with patience
 */
export function getCheckingResponse(callData) {
  const msgs = [
    "Theek hai, machine dekh lijiye. Main wait kar raha hoon.",
    "Zaroor, plate dekh lijiye. Tayaar hon to number boliye.",
    "Bilkul, document dekh lijiye. Koi jaldi nahi.",
    "Haan, dhundh lijiye. Main yahan hoon, aap ready hote hi boliye.",
  ];
  return msgs[Math.floor(Math.random() * msgs.length)];
}

/**
 * getHelpResponse
 * Customer is lost or wants agent
 */
export function getHelpResponse(callData) {
  const step = callData.step || '';
  if (step === 'ask_complaint') {
    return "Main complaint register karne mein help kar raha hoon. " +
           "Bas machine ki problem batayein — engine, gear, brake, hydraulic, AC — " +
           "jo bhi kharaabi ho. Agent se baat karni ho to do dabayein.";
  }
  return "Main aapki madad ke liye hoon. " +
         "Agar agent se baat karni ho to phone pe do dabayein. " +
         "Warna " + (callData.lastQuestion || "apna jawab boliye.");
}

/* =====================================================================
   STEP-SMART PROMPTS — Varied, natural re-ask messages per step
   Avoids robotic repetition of the exact same sentence
   ===================================================================== */
export const SMART_PROMPTS = {

  ask_machine_no: [
    "Theek hai. Apna machine number boliye — ek ek digit clearly. Jaise: 3 3 0 5 4 4 7.",
    "Machine par likha number boliye. Plate mein hota hai — 4 se 8 digit ka.",
    "Ek ek digit boliye — dhire dhire. Jaise: teen, teen, shunya, paanch, chaar, chaar, saat.",
    "JCB ka registration number chahiye. Machine ke side mein plate par hota hai.",
    "Sirf digits boliye — aur kuch mat boliye. Number ka pehla digit se shuru karein.",
  ],

  confirm_customer: (name, city) => [
    `${name} ji, kya yeh aapki machine hai? Sirf haan ya nahi boliye.`,
    `Humhare records mein naam ${name} aur city ${city} hai. Sahi hai kya?`,
    `Kya aap ${name} hain aur machine ${city} mein hai? Haan ya nahi?`,
  ],

  ask_city: [
    "Abhi machine kahan hai — kaunsa shahar? Bas city naam boliye.",
    "Machine kaunse city mein khadi hai? Jaise: Jaipur, Kota, Udaipur.",
    "Kaunsa shehar? Ajmer, Alwar, Bhilwara, Sikar, Kota, Jaipur, Udaipur mein se koi?",
    "City batayein — jahan machine hai abhi.",
    "Machine ka location — kaunsa town ya city?",
  ],

  ask_engineer_location: [
    "Engineer kahan aaye? Workshop naam ya address boliye.",
    "Service center ya workshop ka naam batayein — ya koi jagah.",
    "Machine kahan rakhhi hai abhi? Workshop, site, ya aur kahan?",
    "Address batayein — city, area, ya landmark. Jaise: Jaipur workshop ya Tonk road.",
    "Engineer ki location chahiye — nearest service point ka naam batayein.",
  ],

  ask_phone: [
    "Phone number boliye — sirf 10 digits, ek ek karke.",
    "Apna mobile number chahiye. Pehle digit se shuru karein.",
    "Contact number ek ek digit boliye — 10 digits total.",
    "Mobile number boliye clearly. Jaise: 9, 8, 7, 6 — ek ek digit.",
    "10 digit ka number chahiye — dhire dhire boliye.",
  ],

  ask_complaint: [
    "Machine mein kya problem hai? Engine, gear, brake, hydraulic, AC — kuch bhi batayein.",
    "Kya kharaabi hai machine mein? Detail mein batayein.",
    "Kya ho raha hai machine ke saath? Start nahi ho rahi? Ya koi aur problem?",
    "Problem kya hai? Jo bhi kharaabi ho — engine se leke gear tak — sab bata sakte hain.",
    "Complaint register ke liye problem batayein. Sab ek saath bata sakte hain.",
    "Machine mein kaun sa hissa kharab hai? Kya problem aa rahi hai?",
  ],

  confirm_phone: (phone) => [
    `Phone number ${phone} hai. Sahi hai?`,
    `${phone} — kya yeh aapka number hai? Haan ya nahi?`,
    `Confirm karein — ${phone} sahi hai?`,
  ],

  final_confirmation: [
    "Sab details sahi hain? Haan boliye to complaint register ho jaayegi.",
    "Main complaint submit kar dun? Haan boliye.",
    "Kya sab information correct hai? Haan ya nahi?",
  ],
};

/**
 * getSmartPrompt — Returns a rotated smart prompt for the current step
 * Avoids always using the same sentence (uses retryCount to cycle)
 */
export function getSmartPrompt(step, retryCount = 0, extraData = {}) {
  const prompts = SMART_PROMPTS[step];
  if (!prompts) return null;

  let list;
  if (typeof prompts === 'function') {
    list = prompts(extraData.name || '', extraData.city || '', extraData.phone || '');
  } else {
    list = prompts;
  }

  return list[retryCount % list.length];
}

/* =====================================================================
   INTEGRATION HELPER — Wraps your existing step handlers
   Call this at the TOP of each step before any other logic.
   Returns: { handled: true, response: string } | { handled: false }

   Example usage in voice.js:
   ─────────────────────────────
   if (callData.step === "ask_machine_no") {
     const ci = handleConversationalIntent(rawSpeech, callData);
     if (ci.handled) {
       ask(twiml, ci.response);
       activeCalls.set(CallSid, callData);
       return res.type("text/xml").send(twiml.toString());
     }
     // ... your normal step logic below
   }
   ─────────────────────────────
   ===================================================================== */
export function handleConversationalIntent(rawSpeech, callData) {
  const intent = detectConversationalIntent(rawSpeech);

  switch (intent) {
    case INTENT.REPEAT:
      return {
        handled: true,
        intent,
        response: getRepeatResponse(callData),
      };

    case INTENT.WAIT:
    case INTENT.CHECKING:
      return {
        handled: true,
        intent,
        response: intent === INTENT.CHECKING
          ? getCheckingResponse(callData)
          : getWaitResponse(callData),
      };

    case INTENT.CONFUSED:
      return {
        handled: true,
        intent,
        response: getConfusedResponse(callData),
      };

    case INTENT.HELP:
      return {
        handled: true,
        intent,
        response: getHelpResponse(callData),
      };

    case INTENT.COMPLAINT_DONE:
      // Only relevant in ask_complaint step — signal caller to proceed
      if (callData.step === 'ask_complaint') {
        return {
          handled: false,  // Let the normal handler process it as complaint finalization
          intent,
          isComplaintDone: true,
        };
      }
      return { handled: false, intent };

    default:
      return { handled: false, intent: INTENT.NORMAL };
  }
}

/* =====================================================================
   CONVENIENCE: Enhanced silence/empty handler
   Smarter than just repeating the last question — rotates prompts
   ===================================================================== */
export function handleSilenceOrEmpty(callData) {
  const step = callData.step || '';
  const retries = callData.retries || 0;

  // Step-specific silence hints
  const silenceHints = {
    ask_machine_no: [
      "Kuch suna nahi. Machine number boliye — plate par likha hota hai.",
      "Awaz nahi aayi. Number ek ek digit mein boliye.",
      "Kya aap machine ke paas hain? Number dekhke boliye.",
    ],
    ask_city: [
      "City ka naam nahi suna. Kaunsa shehar hai?",
      "Kahan hai machine — Jaipur, Kota, ya koi aur city?",
    ],
    ask_engineer_location: [
      "Kuch nahi suna. Workshop ya jagah ka naam boliye.",
      "Engineer kahan aaye? Address ya area batayein.",
    ],
    ask_phone: [
      "Phone number nahi suna. 10 digit number ek ek karke boliye.",
      "Mobile number chahiye — clearly boliye.",
    ],
    ask_complaint: [
      "Problem nahi suni. Machine mein kya kharaabi hai?",
      "Kya baat hai — engine, brake, gear, ya koi aur problem?",
    ],
  };

  const hints = silenceHints[step];
  if (hints) {
    return hints[retries % hints.length];
  }
  return callData.lastQuestion || "Kripya clearly boliye.";
}

/* =====================================================================
   EXPORT SUMMARY
   ===================================================================== */
export default {
  INTENT,
  detectConversationalIntent,
  handleConversationalIntent,
  handleSilenceOrEmpty,
  getRepeatResponse,
  getWaitResponse,
  getCheckingResponse,
  getConfusedResponse,
  getHelpResponse,
  getSmartPrompt,
  SMART_PROMPTS,
};