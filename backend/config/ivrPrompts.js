// ==================== CONVERSATIONAL HINDI/HINGLISH PROMPTS FOR URBAN USERS ====================

export const ivrPrompts = {
  // Initial Menu
  welcomeMessage: "नमस्ते! आपका Rajesh JCB Motors में स्वागत है। Complaint register करने के लिए 1 दबाएं, या किसी agent से बात करने के लिए 2 दबाएं।",

  // Identifier Collection
  askMachineIdentifier: "कृपया अपना machine number या 10-digit phone number बताएं। Machine number के बाद hash (#) key दबाएं।",
  repeatIdentifier: "एक बार फिर से बताइए न - machine number या फोन नंबर। फिर # दबाएं।",

  // Customer Confirmation
  confirmCustomer: (city, name) => 
    `आपका city है ${city} और नाम है ${name}। क्या ये ठीक है? हाँ के लिए 1, नहीं के लिए 2 दबाएं।`,

  // Name Collection
  askCallerName: "अब मुझे बताइए, आपका नाम क्या है? पूरा नाम बताएं।",
  askCallerNameRetry: "नाम clear नहीं समझा। कृपया अपना पूरा नाम फिर से बताइए, धीरे-धीरे।",

  // Phone Collection
  askCallerPhone: "अब अपना 10-digit mobile number enter करिए, फिर # key दबाइए।",
  confirmPhone: (spokenNumber) => 
    `आपका number है: ${spokenNumber}। क्या सही है? हाँ के लिए 1, नहीं के लिए 2।`,

  // Machine Type Selection
  askMachineType: "बताइए, आपकी machine किस scheme में है? 1 - Warranty, 2 - JCB Care, 3 - Engine Care, 4 - Demo, 5 - BHL।",
  confirmMachineType: (type) => 
    `आपने ${type} select किया। क्या सही है? 1 - हाँ, 2 - नहीं।`,

  // Machine Status Selection
  askMachineStatus: "अब बताइए - आपकी machine की condition कैसी है? 1 - बिल्कुल खराब/बंद है, 2 - चल रही है लेकिन problem है।",
  confirmMachineStatus: (status) => 
    `आपने select किया: ${status}। सही है? 1 - हाँ, 2 - नहीं।`,

  // Location Collection
  askJobLocation: "अब बताइए - machine कहाँ है? Workshop में है या Site पर है?",
  
  askAddress: "अब machine का पूरा address बताइए। City, area name ज़रूरी है।",
  askAddressRetry: "Address clear नहीं समझा। City और area का नाम दोबारा बताइए।",

  askPincode: "अब अपना 6-digit pincode बताइए। जैसे: 3-0-2-0-1-7।",
  askPincodeRetry: "Pincode clear नहीं समझा। 6 अंक धीरे-धीरे बताइए।",

  // Complaint Collection
  askComplaint: "ठीक है। अब machine में क्या problem है? विस्तार से बताइए।",
  askComplaintDetail: "Machine में exactly क्या problem है? और भी detail दीजिए न।",
  
  confirmComplaint: (complaint) => 
    `तो आपकी complaint है: ${complaint}। क्या ये सही है? 1 - हाँ, 2 - नहीं।`,

  // Service Date & Time
  askServiceDate: "बहुत अच्छा। अब बताइए - engineer को कब बुलाऊँ? आज, कल, या परसों?",
  askFromTime: "ठीक है। Engineer morning से आ सकता है या afternoon से? कोई भी समय बताइए।",
  askToTime: "और बताइए - engineer कितनी देर रुक सकता है? End time बताइए।",

  // Success Messages
  successMessage: (sapId) => 
    `बहुत बहुत धन्यवाद! आपकी complaint successfully register हो गई है${sapId ? '. Complaint number: ' + sapId : ''}। हमारा engineer जल्दी ही आपसे contact करेगा!`,

  // Error Messages
  escalateToAgent: "क्षमा करें, कुछ technical problem है। कृपया agent से बात करने के लिए 2 दबाएं।",
  unknownInput: "समझ नहीं आया। कृपया फिर से कहिए।",
  maxRetriesExceeded: "बहुत बार कोशिश हो गई। अब agent से बात कर देते हैं।"
};