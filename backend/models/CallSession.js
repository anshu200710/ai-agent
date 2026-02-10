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
        "ask_machine_location_address", // NEW: Ask for machine's physical location
        "ask_complaint",
        "confirm_complaint",
        "ask_sub_complaint",
        "ask_service_date",              // NEW: Ask for service date
        "ask_service_time_from",         // NEW: Ask from time
        "ask_service_time_to",           // NEW: Ask to time
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

      // Required fields
      complaintGivenByName: String,
      complaintGivenByPhone: String,
      machineType: String,
      machineStatus: String,
      jobLocation: String,

      // NEW: Machine location with address
      machineLocationAddress: String,    // Full address with pincode
      machineLocationPincode: String,    // Extracted pincode

      // NEW: Service timing
      serviceDate: Date,                 // Date for engineer visit
      serviceTimeFrom: String,           // From time (e.g., "9:00 AM")
      serviceTimeTo: String,             // To time (e.g., "5:00 PM")

      // Legacy fields
      machineLocation: String,
      contactName: String,

      // Complaint details
      rawComplaint: String,
      englishComplaint: String,
      detectedIntentPrimary: String,
      detectedIntentConfidence: Number,
      complaintTitle: String,
      complaintSubTitle: String,

      // Customer data cache
      customerData: mongoose.Schema.Types.Mixed,
    },
  },
  { timestamps: true }
);

export default mongoose.model("CallSession", CallSessionSchema);