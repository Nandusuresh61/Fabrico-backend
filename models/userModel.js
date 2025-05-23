import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, trim: true, lowercase: true },
    password: { type: String, required: true },
    profileImage: { type: String, default: null },
    phone:{ type: Number },
    status: { type: String, enum: ['active', 'blocked'], default: 'active' },
    isAdmin: { type: Boolean, default: false },
    otp: { type: String},
    isVerified: { type: Boolean,default: false},
    otpExpiry: { type: Date},
    createdAt: {
      type: Date,
      default: Date.now,
    },
    resetPasswordOtp: { type: String },
    resetPasswordOtpExpiry: { type: Date },
    emailUpdateOtp: { type: String },
    emailUpdateOtpExpiry: { type: Date },
    newEmailPending: { type: String },
    // Referral code fields
    referralCode: { type: String, unique: true },
    referredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    referralBonusReceived: { type: Boolean, default: false }
  },
  { timestamps: true }
);

// Create index for referral code
// userSchema.index({ referralCode: 1 });

const User = mongoose.model('User', userSchema);

export default User;
