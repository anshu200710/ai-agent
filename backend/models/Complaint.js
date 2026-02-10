import mongoose from "mongoose";

const ComplaintSchema = new mongoose.Schema(
  {
    // Customer Reference
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      default: null,
    },

    // ========== MACHINE DETAILS ==========
    machineNo: {
      type: String,
      required: true,
      index: true,
    },

    chassisNo: {
      type: String,
      required: true,
      index: true,
    },

    customerName: {
      type: String,
      default: "Unknown",
    },

    registeredPhone: {
      type: String,
      required: true,
    },

    machineModel: {
      type: String,
      default: "Unknown",
    },

    machineSubModel: {
      type: String,
      default: "",
    },

    machineInstallationDate: {
      type: Date,
    },

    machineType: {
      type: String,
      default: "NA",
    },

    purchaseDate: {
      type: Date,
    },

    businessPartnerCode: {
      type: String,
      default: "",
    },

    // ========== COMPLAINT DETAILS ==========
    complaintGivenByName: {
      type: String,
      required: true,
    },

    complaintGivenByPhone: {
      type: String,
      required: true,
    },

    contactPersonName: {
      type: String,
      default: "Unknown",
    },

    contactPersonNumber: {
      type: String,
    },

    complainBy: {
      type: String,
      default: "Customer",
    },

    // ========== MACHINE STATUS & LOCATION ==========
    machineStatus: {
      type: String,
      required: true,
    },

    jobLocation: {
      type: String,
      default: "Onsite",
    },

    machineLocation: {
      type: String,
      default: "Unknown",
    },

    // NEW: Machine location with address
    machineLocationAddress: {
      type: String,
      default: "Not Provided",
    },

    machineLocationPincode: {
      type: String,
      default: "",
    },

    // ========== BRANCH & OUTLET ==========
    branch: {
      type: String,
      required: true,
      index: true,
    },

    outlet: {
      type: String,
      required: true,
    },

    // ========== TIMING ==========
    // NEW: Enhanced timing fields
    serviceDate: {
      type: Date,
      default: null,
    },

    fromTime: {
      type: String,  // Changed to String for "9:00 AM" format
      default: "",
    },

    toTime: {
      type: String,  // Changed to String for "5:00 PM" format
      default: "",
    },

    // ========== COMPLAINT CLASSIFICATION ==========
    description_raw: {
      type: String,
      default: "Not provided by caller",
    },

    complaintTitle: {
      type: String,
      default: "NA",
      index: true,
    },

    complaintSubTitle: {
      type: String,
      default: "Other",
    },

    // ========== SAP INTEGRATION ==========
    complaintSapId: {
      type: String,
      default: "",
    },

    // ========== CALL METADATA ==========
    callSid: {
      type: String,
      index: true,
    },

    source: {
      type: String,
      default: "IVR_VOICE_BOT",
    },

    complainReceiveBy: {
      type: String,
      default: "IVR System",
    },

    // ========== STATUS & ASSIGNMENT ==========
    status: {
      type: String,
      default: "open",
      index: true,
    },

    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    priority: {
      type: String,
      default: "medium",
    },

    // ========== RESOLUTION ==========
    resolvedAt: {
      type: Date,
    },

    resolutionNotes: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for better query performance
ComplaintSchema.index({ createdAt: -1 });
ComplaintSchema.index({ status: 1, branch: 1 });
ComplaintSchema.index({ complaintTitle: 1, status: 1 });
ComplaintSchema.index({ machineLocationPincode: 1 });

export default mongoose.model("Complaint", ComplaintSchema);