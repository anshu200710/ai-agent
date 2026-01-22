import mongoose from "mongoose";

const customerSchema = new mongoose.Schema(
  {
    chassisNo: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
    },

    phone: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },

    city: {
      type: String,
      required: true,
      trim: true,
    },

    machineModel: {
      type: String,
      trim: true,
    },

    purchaseDate: {
      type: Date,
    },

    warrantyStatus: {
      type: String,
      enum: ["active", "expired"],
      default: "active",
    },

    notes: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model("Customer", customerSchema);
