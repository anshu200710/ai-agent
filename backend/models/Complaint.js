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
      required: true,
    },

    chassisNo: {
      type: String,
      required: true,
    },

    phone: {
      type: String,
      required: true,
    },

    name: {
      type: String,
      required: true,
    },

    city: {
      type: String,
      required: true,
    },

    machineModel: {
      type: String,
    },

    warrantyStatus: {
      type: String,
    },

    description: {
      type: String,
      required: true,
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
  },
  { timestamps: true }
);

export default mongoose.model("Complaint", ComplaintSchema);
