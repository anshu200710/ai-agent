import mongoose from 'mongoose';

const MessageSchema = new mongoose.Schema({
  role: {
    type: String,
    enum: ['user', 'ai'],
    required: true
  },
  text: {
    type: String,
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
});

const ServiceDetailsSchema = new mongoose.Schema({
  chassisNumber: String,
  ownerName: String,
  mobileNumber: String,
  machineLocation: String,
  engineerBase: String,
  complaints: [String],
  machineHours: Number
});

// const CallSchema = new mongoose.Schema(
//   {
//     callSid: { type: String, required: true, index: true },
//     from: String,
//     to: String,

//     messages: [MessageSchema],

//     serviceDetails: ServiceDetailsSchema,

//     turns: {
//       type: Number,
//       default: 0
//     },

//     status: {
//       type: String,
//       enum: ['active', 'transferred', 'ended'],
//       default: 'active'
//     }
//   },
//   { timestamps: true }
// );


const CallSchema = new mongoose.Schema({
  callSid: { type: String, required: true, index: true },
  from: String,
  to: String,

  currentStep: {
    type: String,
    enum: [
      'chassis',
      'owner',
      'mobile',
      'location',
      'engineerBase',
      'complaint',
      'confirm',
      'done'
    ],
    default: 'chassis'
  },

  messages: [MessageSchema],
  serviceDetails: {
    type: ServiceDetailsSchema,
    default: () => ({ complaints: [] })
  },

  turns: { type: Number, default: 0 },
  status: {
    type: String,
    enum: ['active', 'transferred', 'ended'],
    default: 'active'
  }
},
  { timestamps: true }
);


export default mongoose.model('Call', CallSchema);
