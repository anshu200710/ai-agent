// import mongoose from 'mongoose';

// const ComplaintSchema = new mongoose.Schema(
//   {
//     customerId: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: 'Customer',
//       required: true
//     },

//     chassisNo: {
//       type: String,
//       required: true
//     },

//     phone: {
//       type: String,
//       required: true
//     },

//     description: {
//       type: String,
//       required: true
//     },

//     callSid: {
//       type: String,
//       index: true
//     },

//     status: {
//       type: String,
//       enum: ['open', 'assigned', 'resolved'],
//       default: 'open'
//     }
//   },
//   { timestamps: true }
// );

// export default mongoose.model('Complaint', ComplaintSchema);

import mongoose from "mongoose";

const ComplaintSchema = new mongoose.Schema(
  {
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      default: null,
    },

    chassisNo: {
      type: String,
      default: "Unknown",
    },

    phone: {
      type: String,
      required: true,
    },

    customerName: {
      type: String,
      default: "Unknown",
    },

    contactPersonName: {
      type: String,
      default: "Unknown",
    },

    machineLocation: {
      type: String,
      default: "Unknown",
    },

    description_raw: {
      type: String,
      default: "Not provided by caller",
    },

    callSid: {
      type: String,
      index: true,
    },

    status: {
      type: String,
      enum: ["open", "assigned", "resolved"],
      default: "open",
    },

    source: {
      type: String,
      default: "IVR_VOICE_BOT",
    },
  },
  { timestamps: true }
);

export default mongoose.model("Complaint", ComplaintSchema);
