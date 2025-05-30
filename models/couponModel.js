import mongoose from "mongoose";

const couponSchema = new mongoose.Schema(
  {
    couponCode: {
      type: String,
      required: true,
      unique: true,
    },
    code: {
      type: String,
      required: true,
      unique: true,
    },
    description: {
      type: String,
      required: true,
    },
    discountType: {
      type: String,
      required: true,
    }, // 'percentage' or 'fixed'
    discountValue: {
      type: Number,
      required: true,
    },
    startDate: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
      required: true,
    },
    minOrderAmount: {
      type: Number,
      required: true,
    },
    maxOrderAmount: {
      type: Number,
      required: true,
    },
    usedBy: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    isExpired: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

couponSchema.pre('save', function(next) {
  if (this.couponCode && !this.code) {
    this.code = this.couponCode;
  } else if (this.code && !this.couponCode) {
    this.couponCode = this.code;
  }
  next();
});

const Coupon = mongoose.model("Coupon", couponSchema);

export default Coupon;
