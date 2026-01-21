// import express from 'express';
// import twilio from 'twilio';

// import Call from '../models/Call.js';
// import { getAIResponse } from '../services/openaiService.js';

// const router = express.Router();
// const VoiceResponse = twilio.twiml.VoiceResponse;

// const TRANSFER_KEYWORDS = ['agent', 'human', 'representative'];


// // ============================
// // INCOMING CALL
// // ============================
// router.post('/', async (req, res) => {
//   const twiml = new VoiceResponse();
//   const { CallSid, From, To } = req.body;

//   await Call.findOneAndUpdate(
//     { callSid: CallSid },
//     {
//       callSid: CallSid,
//       from: From,
//       to: To,
//       status: 'active',
//       currentStep: 'chassis'
//     },
//     { upsert: true, new: true }
//   );

//   const gather = twiml.gather({
//     input: 'speech',
//     speechModel: 'phone_call',
//     language: 'en-IN',
//     enhanced: true,
//     timeout: 6,
//     speechTimeout: 'auto',
//     action: '/voice/process',
//     method: 'POST'
//   });

//   gather.say(
//     { voice: 'Polly.Aditi', language: 'en-IN' },
//     `
//     <speak>
//       Namaskar.
//       <break time="400ms"/>
//       Rajesh Motors JCB.
//       <break time="400ms"/>
//       Kripya chassis number batayein.
//     </speak>
//     `
//   );

//   res.type('text/xml');
//   res.send(twiml.toString());
// });


// // ============================
// // PROCESS SPEECH
// // ============================
// router.post('/process', async (req, res) => {
//   const twiml = new VoiceResponse();

//   const callSid = req.body.CallSid;
//   const userSpeech = (req.body.SpeechResult || '').trim();

//   const call = await Call.findOne({ callSid });

//   if (!call) {
//     twiml.say('System error. Goodbye.');
//     twiml.hangup();
//     return res.send(twiml.toString());
//   }

//   // 🔇 Silence handling
//   if (!userSpeech) {
//     const gather = twiml.gather({
//       input: 'speech',
//       language: 'en-IN',
//       action: '/voice/process',
//       method: 'POST'
//     });

//     gather.say(
//       { voice: 'Polly.Aditi', language: 'en-IN' },
//       'Awaaz clear nahi aayi. Kripya dobara batayein.'
//     );

//     return res.send(twiml.toString());
//   }

//   // Save user message
//   call.messages.push({ role: 'user', text: userSpeech });

//   const lowerSpeech = userSpeech.toLowerCase();

//   // 🔁 Transfer to human
//   if (TRANSFER_KEYWORDS.some(k => lowerSpeech.includes(k))) {
//     call.status = 'transferred';
//     await call.save();

//     twiml.say(
//       { voice: 'Polly.Aditi', language: 'en-IN' },
//       'Aapko human agent se joda ja raha hai.'
//     );
//     twiml.dial(process.env.HUMAN_AGENT_NUMBER);
//     return res.send(twiml.toString());
//   }

//   // ============================
//   // STEP HANDLING (CORE LOGIC)
//   // ============================
//   switch (call.currentStep) {
//     case 'chassis':
//       call.serviceDetails.chassisNumber = userSpeech;
//       call.currentStep = 'owner';
//       break;

//     case 'owner':
//       call.serviceDetails.ownerName = userSpeech;
//       call.currentStep = 'mobile';
//       break;

//     case 'mobile':
//       call.serviceDetails.mobileNumber = userSpeech;
//       call.currentStep = 'location';
//       break;

//     case 'location':
//       call.serviceDetails.machineLocation = userSpeech;
//       call.currentStep = 'engineerBase';
//       break;

//     case 'engineerBase':
//       call.serviceDetails.engineerBase = userSpeech;
//       call.currentStep = 'complaint';
//       break;

//     case 'complaint':
//       call.serviceDetails.complaints.push(userSpeech);
//       call.currentStep = 'confirm';
//       break;

//     case 'confirm':
//       call.currentStep = 'done';
//       break;
//   }

//   // ============================
//   // END CALL ONLY WHEN DONE
//   // ============================
//   if (call.currentStep === 'done') {
//     call.status = 'ended';
//     await call.save();

//     twiml.say(
//       { voice: 'Polly.Aditi', language: 'en-IN' },
//       'Dhanyavaad sir. Aapki service request register ho gayi hai. Namaskar.'
//     );
//     twiml.hangup();
//     return res.send(twiml.toString());
//   }

//   // ============================
//   // AI RESPONSE
//   // ============================
//   const aiReply = await getAIResponse(call.messages, call.currentStep);
//   call.messages.push({ role: 'ai', text: aiReply });

//   await call.save();

//   const gather = twiml.gather({
//     input: 'speech',
//     speechModel: 'phone_call',
//     language: 'en-IN',
//     enhanced: true,
//     timeout: 6,
//     speechTimeout: 'auto',
//     action: '/voice/process',
//     method: 'POST'
//   });

//   gather.say(
//     { voice: 'Polly.Aditi', language: 'en-IN' },
//     aiReply
//   );

//   // res.type('text/xml');
//   // res.send(twiml.toString());

//   res.type('text/xml').send(twiml.toString()); // immediately
//   processAIAsync(text);
// });

// export default router;

import express from 'express';
import twilio from 'twilio';
import Call from '../models/Call.js';

const router = express.Router();
const VoiceResponse = twilio.twiml.VoiceResponse;

const TRANSFER_KEYWORDS = ['agent', 'human', 'representative'];

// -----------------------------
// STEP → QUESTION MAP
// -----------------------------
const STEP_QUESTIONS = {
  chassis: 'Kripya chassis number batayein.',
  owner: 'Kripya malik ya company ka naam batayein.',
  mobile: 'Kripya mobile number batayein.',
  location: 'Kripya machine ka location batayein.',
  engineerBase: 'Kripya nearest engineer base batayein.',
  complaint: 'Kripya machine ki samasya batayein.',
  confirm: 'Kya yeh sab details sahi hain? Haan ya nahi boliye.'
};

// ============================
// INCOMING CALL
// ============================
router.post('/', async (req, res) => {
  const twiml = new VoiceResponse();
  const { CallSid, From, To } = req.body;

  await Call.findOneAndUpdate(
    { callSid: CallSid },
    {
      callSid: CallSid,
      from: From,
      to: To,
      status: 'active',
      currentStep: 'chassis'
    },
    { upsert: true, new: true }
  );

  const gather = twiml.gather({
    input: 'speech',
    language: 'en-IN',
    enhanced: true,
    timeout: 6,
    speechTimeout: 'auto',
    action: '/voice/process',
    method: 'POST'
  });

  gather.say(
    { voice: 'Polly.Aditi', language: 'en-IN' },
    'Namaskar. Rajesh Motors JCB. Kripya chassis number batayein.'
  );

  return res.type('text/xml').send(twiml.toString());
});

// ============================
// PROCESS SPEECH
// ============================
router.post('/process', async (req, res) => {
  try {
    const twiml = new VoiceResponse();
    const callSid = req.body.CallSid;
    const userSpeech = (req.body.SpeechResult || '').trim().toLowerCase();

    const call = await Call.findOne({ callSid });
    if (!call) {
      twiml.say('System error.');
      twiml.hangup();
      return res.type('text/xml').send(twiml.toString());
    }

    // -----------------------------
    // Silence retry
    // -----------------------------
    if (!userSpeech) {
      const gather = twiml.gather({
        input: 'speech',
        language: 'en-IN',
        action: '/voice/process',
        method: 'POST'
      });

      gather.say(
        { voice: 'Polly.Aditi', language: 'en-IN' },
        'Awaaz clear nahi aayi. Kripya dobara boliye.'
      );

      return res.type('text/xml').send(twiml.toString());
    }

    // -----------------------------
    // Save user message
    // -----------------------------
    call.messages.push({ role: 'user', text: userSpeech });

    // -----------------------------
    // Transfer to human
    // -----------------------------
    if (TRANSFER_KEYWORDS.some(k => userSpeech.includes(k))) {
      call.status = 'transferred';
      await call.save();

      twiml.say('Aapko human agent se joda ja raha hai.');
      twiml.dial(process.env.HUMAN_AGENT_NUMBER);

      return res.type('text/xml').send(twiml.toString());
    }

    // -----------------------------
    // Ensure serviceDetails exists
    // -----------------------------
    if (!call.serviceDetails) {
      call.serviceDetails = { complaints: [] };
    }
    if (!call.serviceDetails.complaints) {
      call.serviceDetails.complaints = [];
    }

    // -----------------------------
    // STEP HANDLING (STATE MACHINE)
    // -----------------------------
    switch (call.currentStep) {
      case 'chassis':
        call.serviceDetails.chassisNumber = userSpeech;
        call.currentStep = 'owner';
        break;

      case 'owner':
        call.serviceDetails.ownerName = userSpeech;
        call.currentStep = 'mobile';
        break;

      case 'mobile':
        call.serviceDetails.mobileNumber = userSpeech;
        call.currentStep = 'location';
        break;

      case 'location':
        call.serviceDetails.machineLocation = userSpeech;
        call.currentStep = 'engineerBase';
        break;

      case 'engineerBase':
        call.serviceDetails.engineerBase = userSpeech;
        call.currentStep = 'complaint';
        break;

      case 'complaint':
        call.serviceDetails.complaints.push(userSpeech);
        call.currentStep = 'confirm';
        break;

      case 'confirm':
        if (userSpeech.includes('haan') || userSpeech.includes('yes')) {
          call.currentStep = 'done';
        } else {
          call.currentStep = 'complaint';
        }
        break;
    }

    // -----------------------------
    // END CALL
    // -----------------------------
    if (call.currentStep === 'done') {
      call.status = 'ended';
      await call.save();

      twiml.say(
        { voice: 'Polly.Aditi', language: 'en-IN' },
        'Dhanyavaad. Aapki service request register ho gayi hai.'
      );
      twiml.hangup();

      return res.type('text/xml').send(twiml.toString());
    }

    // -----------------------------
    // ASK NEXT QUESTION
    // -----------------------------
    const question = STEP_QUESTIONS[call.currentStep];
    call.messages.push({ role: 'ai', text: question });

    await call.save();

    const gather = twiml.gather({
      input: 'speech',
      language: 'en-IN',
      enhanced: true,
      timeout: 6,
      speechTimeout: 'auto',
      action: '/voice/process',
      method: 'POST'
    });

    gather.say(
      { voice: 'Polly.Aditi', language: 'en-IN' },
      question
    );

    return res.type('text/xml').send(twiml.toString());

  } catch (error) {
    console.error('VOICE ERROR:', error);

    const twiml = new VoiceResponse();
    twiml.say('System error ho gaya.');
    twiml.hangup();

    return res.type('text/xml').send(twiml.toString());
  }
});

export default router;
