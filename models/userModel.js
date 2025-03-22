import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, trim: true, lowercase: true },
    password: { type: String, required: true },
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
  },
  { timestamps: true }
);

const User = mongoose.model('User', userSchema);

export default User;
