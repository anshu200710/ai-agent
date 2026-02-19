// import dotenv from 'dotenv';
// dotenv.config();


import 'dotenv/config'; // 👈 MUST be first, no function call

import express from 'express';
import bodyParser from 'body-parser';

//import connectDB from './config/db.js';
import voiceRoutes from './routes/voice.js';
import outboundRoutes from './routes/outbound.js';
import customerRoutes from "./routes/customer.js";
import simpleVoice from './routes/voice_simple.js'



// connectDB();

const app = express();

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// THIS LINE IS MUST FOR TWILIO
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

app.use('/voice', simpleVoice);
//app.use('/voice', voiceRoutes);
app.use('/outbound', outboundRoutes);
app.use("/api/customers", customerRoutes);
app.use("/audio", express.static("public/audio"));




const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
