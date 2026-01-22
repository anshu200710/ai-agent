import mongoose from 'mongoose';

const ComplaintSchema = new mongoose.Schema(
  {
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Customer',
      required: true
    },

    chassisNo: {
      type: String,
      required: true
    },

    phone: {
      type: String,
      required: true
    },

    description: {
      type: String,
      required: true
    },

    callSid: {
      type: String,
      index: true
    },

    status: {
      type: String,
      enum: ['open', 'assigned', 'resolved'],
      default: 'open'
    }
  },
  { timestamps: true }
);

export default mongoose.model('Complaint', ComplaintSchema);
