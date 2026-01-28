/* =======================
Ai Agent add to work properly
======================= */

import express from "express";
import twilio from "twilio";

import CallSession from "../models/CallSession.js";
import Customer from "../models/Customer.js";
import Complaint from "../models/Complaint.js";

const router = express.Router();
const VoiceResponse = twilio.twiml.VoiceResponse;


/* =======================
   CLEAN SPEECH
======================= */
function cleanSpeech(text) {
  if (!text) return "";
  return text.replace(/[।.,!?]/g, "").trim().toLowerCase();
}

/* =======================
   CONSTANTS
======================= */
const TRANSFER_KEYWORDS = ["agent", "human", "representative"];
const CONFUSION_WORDS = [
  "kya",
  "repeat",
  "dobara",
  "samajh",
  "samajh nahi",
  "clear nahi",
  "pardon",
];

/* =======================
   ASK + LISTEN
======================= */
function ask(twiml, text, call) {
  call.temp.lastQuestion = text;

  const gather = twiml.gather({
    input: "speech",
    language: "hi-IN",
    speechTimeout: "auto",
    timeout: 6,
    action: "/voice/process",
    method: "POST",
  });

  gather.say({ voice: "Polly.Aditi", language: "hi-IN" }, text);
}

/* =======================
   INCOMING CALL
======================= */
router.post("/", async (req, res) => {
  const { CallSid, From } = req.body;
  const twiml = new VoiceResponse();

  await CallSession.findOneAndUpdate(
    { callSid: CallSid },
    {
      callSid: CallSid,
      from: From,
      step: "ask_identifier",
      temp: { retries: 0 },
    },
    { upsert: true, new: true }
  );

  const call = await CallSession.findOne({ callSid: CallSid });

  ask(
    twiml,
    "Welcome to Rajesh JCB Motors. Apni problem register karne ke liye kripya apna registered mobile number ya apna chassis number boliye.",
    call
  );

  res.type("text/xml").send(twiml.toString());
});

/* =======================
   PROCESS CALL
======================= */
router.post("/process", async (req, res) => {
  const twiml = new VoiceResponse();
  const { CallSid, SpeechResult } = req.body;

  const speech = cleanSpeech(SpeechResult || "");
  const call = await CallSession.findOne({ callSid: CallSid });

  if (!call) {
  twiml.say("Technical error. Call disconnect ho raha hai.");
  twiml.hangup();
  return res.type("text/xml").send(twiml.toString());
}

if (!speech) {
  call.temp.retries += 1;

  if (call.temp.retries >= 2) {
    twiml.say("Awaaz clear nahi aa rahi. Hum aapko agent se jod rahe hain.");
    twiml.dial(process.env.HUMAN_AGENT_NUMBER);
    await call.save();
    return res.type("text/xml").send(twiml.toString());
  }

  ask(
  twiml,
  "Hume aapka record nahi mila. Shayad number clear nahi tha. Kripya dheere aur saaf boliye. Aap registered mobile number ya chassis number bata sakte hain.",
  call
);

  await call.save();
  return res.type("text/xml").send(twiml.toString());
}


  /* 🔁 MANUAL TRANSFER */
  if (TRANSFER_KEYWORDS.some((w) => speech.includes(w))) {
    twiml.say("Aapko agent se connect kiya ja raha hai.");
    twiml.dial(process.env.HUMAN_AGENT_NUMBER);
    return res.type("text/xml").send(twiml.toString());
  }

  /* 🤔 CONFUSION HANDLING */
  if (CONFUSION_WORDS.some((w) => speech.includes(w))) {
    call.temp.retries += 1;

    if (call.temp.retries > 2) {
      twiml.say("Aapko agent se connect kiya ja raha hai.");
      twiml.dial(process.env.HUMAN_AGENT_NUMBER);
      return res.type("text/xml").send(twiml.toString());
    }

    ask(twiml, call.temp.lastQuestion, call);
    await call.save();
    return res.type("text/xml").send(twiml.toString());
  }

  call.temp.retries = 0;

  /* =======================
     STATE MACHINE
  ======================= */
  switch (call.step) {
    /* ---------- IDENTIFIER ---------- */
    case "ask_identifier": {
      const digits = speech.replace(/\D/g, "");
      let customer = null;

      if (digits.length === 10) {
        customer = await Customer.findOne({ phone: digits });
      }

      if (!customer) {
        customer = await Customer.findOne({ chassisNo: speech });
      }

      if (!customer) {
        call.temp.retries += 1;

        if (call.temp.retries > 2) {
          twiml.say("Record nahi mila. Aapko agent se connect kiya ja raha hai.");
          twiml.dial(process.env.HUMAN_AGENT_NUMBER);
          return res.type("text/xml").send(twiml.toString());
        }

        ask(
          twiml,
          "Record nahi mila. Kripya chassis number ya registered mobile number dobara boliye.",
          call
        );
        break;
      }

      call.temp.customerId = customer._id;
      call.step = "ask_complaint";

      ask(
        twiml,
        `Aapka record mil gaya hai. Aap ${customer.city} se ${customer.name} baat kar rahe hain. Kripya apni Machine Ki Problem batayein.`,
        call
      );
      break;
    }

    /* ---------- COMPLAINT ---------- */
    case "ask_complaint": {
      const customer = await Customer.findById(call.temp.customerId);

      await Complaint.create({
        customerId: customer._id,
        chassisNo: customer.chassisNo,
        phone: customer.phone,
        name: customer.name,
        city: customer.city,
        machineModel: customer.machineModel,
        warrantyStatus: customer.warrantyStatus,
        description: speech,
        callSid: CallSid,
      });

      twiml.say(
        "Dhanyavaad. Aapki complaint register ho chuki hai. Hamari service team jald hi aapse sampark karegi."
      );
      twiml.hangup();
      break;
    }
  }

  await call.save();
  res.type("text/xml").send(twiml.toString());
});

export default router;





























/* =======================
 Db configure properly voice call agent
======================= */

// import express from "express";
// import twilio from "twilio";

// import CallSession from "../models/CallSession.js";
// import Customer from "../models/Customer.js";
// import Complaint from "../models/Complaint.js";

// const router = express.Router();
// const VoiceResponse = twilio.twiml.VoiceResponse;

// /* =======================
//    CLEAN SPEECH
// ======================= */
// function cleanSpeech(text) {
//   if (!text) return "";
//   return text.replace(/[।.,!?]/g, "").trim().toLowerCase();
// }

// /* =======================
//    CONSTANTS
// ======================= */
// const TRANSFER_KEYWORDS = ["agent", "human", "representative"];
// const CONFUSION_WORDS = [
//   "kya",
//   "repeat",
//   "dobara",
//   "samajh",
//   "samajh nahi",
//   "clear nahi",
//   "pardon",
// ];

// /* =======================
//    ASK + LISTEN
// ======================= */
// function ask(twiml, text, call) {
//   call.temp.lastQuestion = text;

//   const gather = twiml.gather({
//     input: "speech",
//     language: "hi-IN",
//     speechTimeout: "auto",
//     timeout: 6,
//     action: "/voice/process",
//     method: "POST",
//   });

//   gather.say({ voice: "Polly.Aditi", language: "hi-IN" }, text);
// }

// /* =======================
//    INCOMING CALL
// ======================= */
// router.post("/", async (req, res) => {
//   const { CallSid, From } = req.body;
//   const twiml = new VoiceResponse();

//   await CallSession.findOneAndUpdate(
//     { callSid: CallSid },
//     {
//       callSid: CallSid,
//       from: From,
//       step: "ask_identifier",
//       temp: { retries: 0 },
//     },
//     { upsert: true, new: true }
//   );

//   const call = await CallSession.findOne({ callSid: CallSid });

//   ask(
//     twiml,
//     "Namaskar. Kripya apni machine ka chassis number ya apna registered mobile number boliye.",
//     call
//   );

//   res.type("text/xml").send(twiml.toString());
// });

// /* =======================
//    PROCESS CALL
// ======================= */
// router.post("/process", async (req, res) => {
//   const twiml = new VoiceResponse();
//   const { CallSid, SpeechResult } = req.body;

//   const speech = cleanSpeech(SpeechResult || "");
//   const call = await CallSession.findOne({ callSid: CallSid });

//   if (!call || !speech) {
//     ask(twiml, "Awaaz clear nahi aayi. Kripya dobara boliye.", call);
//     return res.type("text/xml").send(twiml.toString());
//   }

//   /* 🔁 MANUAL TRANSFER */
//   if (TRANSFER_KEYWORDS.some((w) => speech.includes(w))) {
//     twiml.say("Aapko agent se connect kiya ja raha hai.");
//     twiml.dial(process.env.HUMAN_AGENT_NUMBER);
//     return res.type("text/xml").send(twiml.toString());
//   }

//   /* 🤔 CONFUSION HANDLING */
//   if (CONFUSION_WORDS.some((w) => speech.includes(w))) {
//     call.temp.retries += 1;

//     if (call.temp.retries > 2) {
//       twiml.say("Aapko agent se connect kiya ja raha hai.");
//       twiml.dial(process.env.HUMAN_AGENT_NUMBER);
//       return res.type("text/xml").send(twiml.toString());
//     }

//     ask(twiml, call.temp.lastQuestion, call);
//     await call.save();
//     return res.type("text/xml").send(twiml.toString());
//   }

//   call.temp.retries = 0;

//   /* =======================
//      STATE MACHINE
//   ======================= */
//   switch (call.step) {
//     /* ---------- IDENTIFIER ---------- */
//     case "ask_identifier": {
//       const digits = speech.replace(/\D/g, "");
//       let customer = null;

//       if (digits.length === 10) {
//         customer = await Customer.findOne({ phone: digits });
//       }

//       if (!customer) {
//         customer = await Customer.findOne({ chassisNo: speech });
//       }

//       if (!customer) {
//         call.temp.retries += 1;

//         if (call.temp.retries > 2) {
//           twiml.say("Record nahi mila. Aapko agent se connect kiya ja raha hai.");
//           twiml.dial(process.env.HUMAN_AGENT_NUMBER);
//           return res.type("text/xml").send(twiml.toString());
//         }

//         ask(
//           twiml,
//           "Record nahi mila. Kripya chassis number ya registered mobile number dobara boliye.",
//           call
//         );
//         break;
//       }

//       call.temp.customerId = customer._id;
//       call.step = "ask_complaint";

//       ask(
//         twiml,
//         `Aapka record mil gaya hai. Aap ${customer.city} se ${customer.name} baat kar rahe hain. Kripya apni problem batayein.`,
//         call
//       );
//       break;
//     }

//     /* ---------- COMPLAINT ---------- */
//     case "ask_complaint": {
//       const customer = await Customer.findById(call.temp.customerId);

//       await Complaint.create({
//         customerId: customer._id,
//         chassisNo: customer.chassisNo,
//         phone: customer.phone,
//         name: customer.name,
//         city: customer.city,
//         machineModel: customer.machineModel,
//         warrantyStatus: customer.warrantyStatus,
//         description: speech,
//         callSid: CallSid,
//       });

//       twiml.say(
//         "Dhanyavaad. Aapki complaint register ho chuki hai. Hamari service team jald hi aapse sampark karegi."
//       );
//       twiml.hangup();
//       break;
//     }
//   }

//   await call.save();
//   res.type("text/xml").send(twiml.toString());
// });

// export default router;
















