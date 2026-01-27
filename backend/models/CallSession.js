// import mongoose from 'mongoose';

// const CallSessionSchema = new mongoose.Schema({
//   callSid: { type: String, required: true, index: true },
//   from: String,

//   step: {
//     type: String,
//     enum: [
//       'ask_chassis',
//       'repeat_chassis',
//       "unregistered_options", 
//       'ask_name',
//       'ask_phone',
//       'confirm_customer',
//       'ask_city',
//       'ask_complaint',
//       'ask_issue_detail',
//       'done'
//     ],
//     default: 'ask_chassis'
//   },

//   temp: {
//     chassisNo: String,
//     name: String,
//     phone: String,
//     city: String,
//     complaintType: String,
//     complaintDetail: String,
//     customerId: mongoose.Schema.Types.ObjectId
//   }
// }, { timestamps: true });

// export default mongoose.model('CallSession', CallSessionSchema);
import mongoose from "mongoose";

const CallSessionSchema = new mongoose.Schema(
  {
    callSid: {
      type: String,
      required: true,
      index: true,
    },

    from: String,

    step: {
      type: String,
      enum: [
        "ask_identifier",   // chassis OR phone
        "ask_complaint",
        "done"
      ],
      default: "ask_identifier",
    },

    temp: {
      retries: {
        type: Number,
        default: 0,
      },

      lastQuestion: String,

      customerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Customer",
      },

      // optional (for debugging / logs)
      identifierSpoken: String,
    },
  },
  { timestamps: true }
);

export default mongoose.model("CallSession", CallSessionSchema);
