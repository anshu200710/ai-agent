import express from 'express';
import twilio from 'twilio';

const router = express.Router();

/**
 * Create Twilio client lazily
 * (env vars are guaranteed to be loaded)
 */
const getTwilioClient = () => {
  if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
    throw new Error('Twilio credentials are missing in environment variables');
  }

  return twilio(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_AUTH_TOKEN
  );
};

// Debug once at startup
console.log('TWILIO_ACCOUNT_SID:', process.env.TWILIO_ACCOUNT_SID);
console.log('TWILIO_PHONE_NUMBER:', process.env.TWILIO_PHONE_NUMBER);

router.post('/call', async (req, res) => {
  const { to } = req.body;

  if (!to) {
    return res.status(400).json({ error: '`to` phone number is required' });
  }

  if (!process.env.TWILIO_PHONE_NUMBER) {
    return res.status(500).json({ error: 'TWILIO_PHONE_NUMBER not configured' });
  }

  try {
    const client = getTwilioClient();

    const call = await client.calls.create({
      to,
      from: process.env.TWILIO_PHONE_NUMBER,
      url: `${process.env.PUBLIC_URL}/voice`,
      method: 'POST'
    });

    return res.json({
      success: true,
      callSid: call.sid
    });
  } catch (err) {
    console.error('Twilio outbound call error:', err.message);

    return res.status(500).json({
      error: err.message
    });
  }
});

export default router;
