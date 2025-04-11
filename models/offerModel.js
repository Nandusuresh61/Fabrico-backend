import mongoose from "mongoose";

const OfferSchema = new mongoose.Schema({
  offerName: {
    type: String,
    required: true,
    trim: true,
  },
  offerType: {
    type: String,
    enum: ["product", "category"],
    required: true,
  },
  discountPercentage: {
    type: Number,
    required: true,
    min: 1,
    max: 100,
  },
  startDate: {
    type: Date,
    required: true,
  },
  endDate: {
    type: Date,
    required: true,
  },
  items: [
    {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
  ],
  isActive: {
    type: Boolean,
    default: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const Offer = mongoose.model("Offer", OfferSchema);

export default Offer;