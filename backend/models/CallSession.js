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
        "ivr_menu",
        "ask_identifier",
        "ask_machine_location",
        "ask_contact_name",
        "ask_complaint",
        "confirm_complaint",       // ← was missing — caused the crash
        "ask_sub_complaint",
        "save_complaint",
        "done",
      ],
      default: "ivr_menu",
    },

    temp: {
      retries: {
        type: Number,
        default: 0,
      },
      subRetries: {
        type: Number,
        default: 0,
      },

      lastQuestion: String,

      customerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Customer",
      },

      identifierRaw: String,
      machineLocation: String,
      contactName: String,
      rawComplaint: String,

      // intent detection — stored as flat fields so Mongoose doesn't reject unknown nested keys
      detectedIntentPrimary: String,
      detectedIntentConfidence: Number,

      complaintTitle: String,
      complaintSubTitle: String,
    },
  },
  { timestamps: true }
);

export default mongoose.model("CallSession", CallSessionSchema);