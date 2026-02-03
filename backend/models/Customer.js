import mongoose from "mongoose";

const CustomerSchema = new mongoose.Schema(
  {
    // Machine Identification
    chassisNo: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    // Contact Information
    phone: {
      type: String,
      required: true,
      index: true,
    },

    name: {
      type: String,
      default: "Unknown",
    },

    // Machine Details
    model: {
      type: String,
      default: "Unknown",
    },

    machineType: {
      type: String, // BHL, HL, etc from API
      default: "Unknown",
    },

    // Location
    city: {
      type: String,
      default: "Unknown",
    },

    address: {
      type: String,
    },

    // Business Details
    businessPartnerCode: {
      type: String,
      default: "",
    },

    // Purchase Information
    purchaseDate: {
      type: Date,
    },

    // Additional API Fields
    phone1: String,
    phone2: String,

    dealerBranchCode: String,
    branchName: String,
    outlet: String,

    machineRmNumber: String,

    // Geolocation
    machineLatitude: String,
    machineLongitude: String,

    // Source tracking
    source: {
      type: String,
      enum: ["MANUAL", "EXTERNAL_API"],
      default: "MANUAL",
    },

    // Status
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

export default mongoose.model("Customer", CustomerSchema);