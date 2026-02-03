import mongoose from "mongoose";

const CallSessionSchema = new mongoose.Schema(
  {
    callSid: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    from: String,

    step: {
      type: String,
      enum: [
        "ivr_menu",
        "ask_identifier",
        "ask_complaint_given_by_name",
        "ask_complaint_given_by_phone",
        "ask_machine_type",
        "ask_machine_status",
        "ask_job_location",
        "ask_complaint",
        "confirm_complaint",
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

      // Customer identification
      customerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Customer",
      },

      identifierRaw: String,

      // New required fields
      complaintGivenByName: String,
      complaintGivenByPhone: String,
      machineType: String,
      machineStatus: String,
      jobLocation: String,

      // Location & contact (legacy - keeping for compatibility)
      machineLocation: String,
      contactName: String,

      // Complaint details
      rawComplaint: String,
      detectedIntentPrimary: String,
      detectedIntentConfidence: Number,
      complaintTitle: String,
      complaintSubTitle: String,
    },
  },
  { timestamps: true }
);

export default mongoose.model("CallSession", CallSessionSchema);