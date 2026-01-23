import express from "express";
import twilio from "twilio";

import CallSession from "../models/CallSession.js";
import Customer from "../models/Customer.js";
import Complaint from "../models/Complaint.js";

const router = express.Router();
const VoiceResponse = twilio.twiml.VoiceResponse;

/* =======================
   FOR CLEAN PRONOUN SAVE
======================= */

function cleanSpeech(text) {
  if (!text) return "";

  return text
    .replace(/[।]/g, "") // remove Hindi full stop
    .replace(/[.,!?]/g, "") // remove English punctuation
    .trim()
    .toLowerCase();
}

/* =======================
   CONSTANTS
======================= */
const YES_WORDS = ["haan", "haanji", "yes", "ji", "bilkul", "sahi"];
const TRANSFER_KEYWORDS = ["agent", "human", "representative"];

const CONFUSION_WORDS = [
  "kya",
  "what",
  "repeat",
  "dobara",
  "samajh",
  "samajh nahi",
  "clear nahi",
  "pardon",
  "haan kya",
  "matlab",
];

/* =======================
   HELPER: ASK & LISTEN
======================= */
function ask(twiml, text, call) {
  if (call) {
    call.temp.lastQuestion = text;
  }

  const gather = twiml.gather({
    input: "speech",
    language: "hi-IN",
    speechTimeout: "auto",
    timeout: 6,
    action: "/voice/process",
    method: "POST",
  });

  // gather.say(text);

  gather.say(
    {
      voice: "Polly.Aditi",
      language: "hi-IN",
    },
    text,
  );
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
      step: "ask_chassis",
      temp: { retries: 0 },
    },
    { upsert: true, new: true },
  );

  const call = await CallSession.findOne({ callSid: CallSid });

  ask(
    twiml,
    "Namaskar. Main Rajesh Motors JCB se bol raha hoon. Kripya apni machine ka chassis number boliye.",
    call,
  );

  res.type("text/xml").send(twiml.toString());
});

/* =======================
   PROCESS CALL
======================= */
router.post("/process", async (req, res) => {
  const twiml = new VoiceResponse();
  const { CallSid, SpeechResult } = req.body;
  const rawSpeech = SpeechResult || "";
  const speech = cleanSpeech(rawSpeech);
  // const speech = (SpeechResult || "").trim().toLowerCase();

  const call = await CallSession.findOne({ callSid: CallSid });

  if (!call || !speech) {
    ask(twiml, "Awaaz clear nahi aayi. Kripya dobara boliye.", call);
    return res.type("text/xml").send(twiml.toString());
  }

  /* 🔁 Transfer to Human */
  if (TRANSFER_KEYWORDS.some((w) => speech.includes(w))) {
    twiml.say(
      "Theek hai. Aapko customer care agent se connect kiya ja raha hai.",
    );
    twiml.dial(process.env.HUMAN_AGENT_NUMBER);
    return res.type("text/xml").send(twiml.toString());
  }

  /* 🤔 Confusion Handling */
  if (
    CONFUSION_WORDS.some((w) => speech.includes(w)) &&
    call.temp?.lastQuestion
  ) {
    call.temp.retries += 1;

    if (call.temp.retries > 3) {
      twiml.say("Main aapko agent se connect kar raha hoon.");
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
    /* ---------- ASK CHASSIS ---------- */
    case "ask_chassis": {
      if (speech.length < 4) {
        ask(
          twiml,
          "Chassis number clear nahi mila. Kripya dheere aur saaf boliye.",
          call,
        );
        break;
      }

      call.temp.chassisNo = speech;
      const customer = await Customer.findOne({ chassisNo: speech });

      if (customer) {
        call.temp.customerId = customer._id;
        call.temp.name = customer.name;
        call.temp.phone = customer.phone;
        call.temp.city = customer.city;
        call.step = "ask_complaint";

        ask(
          twiml,
          `Dhanyavaad. Record mil gaya hai. Aap ${customer.name} ${customer.city} se bol rahe hain.
           Ab kripya apni problem batayein.`,
          call,
        );
      } else {
        call.step = "repeat_chassis";
        ask(
          twiml,
          `Dhanyavaad. Record mil gaya hai. 
   Aap ${customer.name} ${customer.city} se bol rahe hain.
   Ab kripya apni problem batayein.`,
          call,
        );
      }
      break;
    }

    /* ---------- REPEAT CHASSIS ---------- */
    case "repeat_chassis": {
      if (speech.length < 4) {
        ask(
          twiml,
          "Chassis number clear nahi mila. Kripya dobara boliye.",
          call,
        );
        break;
      }

      call.temp.chassisNo = speech;
      const customer = await Customer.findOne({ chassisNo: speech });

      if (customer) {
        call.temp.customerId = customer._id;
        call.temp.name = customer.name;
        call.temp.phone = customer.phone;
        call.temp.city = customer.city;
        call.step = "ask_complaint";

        ask(twiml, "Record mil gaya hai. Kripya apni problem batayein.", call);
      } else {
        call.step = "ask_name";
        ask(twiml, "Record nahi mila. Kripya apna poora naam boliye.", call);
      }
      break;
    }

    /* ---------- ASK NAME ---------- */
    case "ask_name":
      call.temp.name = speech;
      call.step = "ask_phone";
      ask(
        twiml,
        "Dhanyavaad. Ab kripya apna 10 digit mobile number boliye.",
        call,
      );
      break;

    /* ---------- ASK PHONE ---------- */
    case "ask_phone": {
      call.temp.phone = speech.replace(/\D/g, "");

      if (call.temp.phone.length !== 10) {
        ask(
          twiml,
          "Mobile number sahi nahi lag raha. Kripya sirf 10 digit number boliye.",
          call,
        );
        break;
      }

      const customer = await Customer.findOne({ phone: call.temp.phone });

      if (customer) {
        call.temp.customerId = customer._id;
        call.temp.city = customer.city;
        call.step = "confirm_customer";

        ask(
          twiml,
          `Aap ${customer.city} se bol rahe hain. Kya ye sahi hai? yes ya no boliye.`,
          call,
        );
      } else {
        call.step = "ask_city";
        ask(twiml, "Kripya apne sheher ka naam boliye.", call);
      }
      break;
    }

    /* ---------- CONFIRM CUSTOMER ---------- */
    case "confirm_customer":
      if (YES_WORDS.some((w) => speech.includes(w))) {
        call.step = "ask_complaint";
        ask(twiml, "Ab kripya apni machine ki problem batayein.", call);
      } else {
        call.step = "ask_city";
        ask(twiml, "Theek hai. Kripya apne sheher ka naam boliye.", call);
      }
      break;

    /* ---------- ASK CITY ---------- */
    case "ask_city":
      call.temp.city = speech;
      call.step = "ask_complaint";
      ask(twiml, "Dhanyavaad. Ab kripya apni problem batayein.", call);
      break;

    /* ---------- COMPLAINT ---------- */
    case "ask_complaint": {
      call.temp.complaint = speech;
      call.step = "done";

      const customer = call.temp.customerId
        ? await Customer.findById(call.temp.customerId)
        : await Customer.create({
            chassisNo: call.temp.chassisNo,
            name: call.temp.name,
            phone: call.temp.phone,
            city: call.temp.city,
          });

      await Complaint.create({
        customerId: customer._id,
        chassisNo: call.temp.chassisNo,
        phone: call.temp.phone,
        description: call.temp.complaint,
        callSid: CallSid,
        status: "open",
      });

      twiml.say(
        "Dhanyavaad. Aapki complaint register ho chuki hai. Hamari service team jald hi aapse sampark karegi.",
      );
      twiml.hangup();
      break;
    }
  }

  await call.save();
  res.type("text/xml").send(twiml.toString());
});

export default router;
