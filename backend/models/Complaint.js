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
      enum: [
        "AGRIMAX",
        "ENGINE",
        "GENARATOR",
        "GENERATOR",
        "HL",
        "HL/BHL",
        "MH",
        "R/B, BHL",
        "R/B, HL",
        "Recon",
        "Robot",
        "Scissor",
        "Seccisor",
        "TH",
        "BHL",
        "Unknown"
      ],
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
      enum: [
        "Warranty",
        "2nd Year Warranty",
        "JCB Care + 3rd Year",
        "JCB Care+ Power Train",
        "Engine Care",
        "ASC",
        "Beyond Warranty",
        "Demo",
        "NA"
      ],
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
      enum: [
        "Customer",
        "Coordinator",
        "For Claim",
        "Outlet",
        "Service Engineer",
        "Care Link",
        "Live Link Alert"
      ],
      default: "Customer",
    },

    // ========== MACHINE STATUS & LOCATION ==========
    machineStatus: {
      type: String,
      enum: [
        "Break Down",
        "Running With Problem",
        "Running OK"
      ],
      required: true,
    },

    jobLocation: {
      type: String,
      enum: ["Work Shop", "Onsite"],
      default: "Onsite",
    },

    machineLocation: {
      type: String,
      default: "Unknown",
    },

    // ========== BRANCH & OUTLET ==========
    branch: {
      type: String,
      enum: [
        "AJMER",
        "ALWAR",
        "BHILWARA",
        "JAIPUR",
        "KOTA",
        "SIKAR",
        "UDAIPUR",
        "NA"
      ],
      required: true,
      index: true,
    },

    outlet: {
      type: String,
      enum: [
        // AJMER
        "AJMER",
        "KEKRI",
        // ALWAR
        "ALWAR",
        "BHARATPUR",
        "BHIWADI",
        "DHOLPUR",
        // BHILWARA
        "BHILWARA",
        "NIMBAHERA",
        "PRATAPGARH",
        // JAIPUR
        "DAUSA",
        "GONER ROAD",
        "JAIPUR",
        "KARAULI",
        "KOTPUTLI",
        "NEEM KA THANA",
        "TONK",
        "VKIA",
        // KOTA
        "JHALAWAR",
        "KOTA",
        "RAMGANJMANDI",
        // SIKAR
        "JHUNJHUNU",
        "SIKAR",
        "SUJANGARH",
        // UDAIPUR
        "BANSWARA",
        "DUNGARPUR",
        "RAJSAMAND",
        "UDAIPUR",
        "NA"
      ],
      required: true,
    },

    // ========== TIMING ==========
    fromTime: {
      type: Date,
    },

    toTime: {
      type: Date,
    },

    // ========== COMPLAINT CLASSIFICATION ==========
    // detailsOfComplaint: {
    //   type: String,
    //   alias: "description_raw",
    //   default: "Not provided by caller",
    // },

    description_raw: {
      type: String,
      default: "Not provided by caller",
    },

    complaintTitle: {
      type: String,
      enum: [
        "Attachment",
        "Body Work",
        "Cabin",
        "Electrical Complaint",
        "Engine",
        "Fabrication part",
        "Transmission/Axle components",
        "Hose",
        "Hydraulic",
        "Ram/Cylinder",
        "Service",
        "Tyre/Battery",
        "Under Carriage",
        "PDI",
        "Installation",
        "General Visit",
        "Livelink",
        "ECU problem",
        "Campaign",
        "NA",
        "AC System"
      ],
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
      enum: ["IVR_VOICE_BOT", "MANUAL", "WEB", "MOBILE_APP"],
      default: "IVR_VOICE_BOT",
    },

    complainReceiveBy: {
      type: String,
      default: "IVR System",
    },

    // ========== STATUS & ASSIGNMENT ==========
    status: {
      type: String,
      enum: ["open", "assigned", "in_progress", "resolved", "closed"],
      default: "open",
      index: true,
    },

    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    priority: {
      type: String,
      enum: ["low", "medium", "high", "critical"],
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

export default mongoose.model("Complaint", ComplaintSchema);