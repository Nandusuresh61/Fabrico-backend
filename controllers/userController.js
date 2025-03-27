import User from '../models/userModel.js';
import asyncHandler from '../middlewares/asyncHandler.js';
import generateToken from '../utils/createToken.js';
import bcrypt from 'bcryptjs';
import nodemailer from 'nodemailer';
import { oauth2Client } from "../utils/googleConfig.js";
import axios from "axios";

// Create a new user
const createUser = asyncHandler(async (req, res) => {
    const { username, email, phone, password, profileImage } = req.body;

    if (!username || !email || !password || !phone) {
        return res.status(400).json({ message: 'Please fill all required fields.' });
    }

    const userExists = await User.findOne({ email });
    if (userExists && userExists.isVerified) {
        return res.status(400).json({ message: 'User already exists.' });
    }

    // Generate OTP - 6 digit number
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiry = new Date();
    otpExpiry.setMinutes(otpExpiry.getMinutes() + 10); // OTP valid for 10 minutes

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Delete previous unverified account if exists
    if (userExists && !userExists.isVerified) {
        await User.findByIdAndDelete(userExists._id);
    }

    // Create new user with OTP details
    const newUser = new User({
        username,
        email,
        phone,
        password: hashedPassword,
        profileImage,
        isVerified: false,
        otp,
        otpExpiry
    });
    
    await newUser.save();

    // Send OTP via email
    await sendOtpEmail(email, otp);

    res.status(201).json({
        message: 'User registered successfully. Please verify your email.',
        _id: newUser._id,
        username: newUser.username,
        email: newUser.email,
        phone: newUser.phone,
        isAdmin: newUser.isAdmin,
        profileImage: newUser.profileImage
    });
});

// Send OTP via email
const sendOtpEmail = async (email, otp, subject = 'Your Verification Code for FABRICO') => {
    try {
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_APP_PASSWORD 
            }
        });

        // Email content
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: email,
            subject: subject,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2>Verify Your Email</h2>
                    <p>Thank you for registering with FABRICO. Please use the following verification code to complete your registration:</p>
                    <div style="font-size: 32px; font-weight: bold; padding: 20px; text-align: center; letter-spacing: 8px; background-color: #f5f5f5; border-radius: 8px; margin: 20px 0;">
                        ${otp}
                    </div>
                    <p>This code will expire in 10 minutes.</p>
                    <p>If you didn't request this code, please ignore this email.</p>
                </div>
            `
        };

        // Send email
        await transporter.sendMail(mailOptions);
        console.log("OTP email sent successfully");
    } catch (error) {
        console.error("Error sending OTP email:", error);
        throw new Error("Failed to send verification email");
    }
};

// Verify OTP
const verifyOtp = asyncHandler(async (req, res) => {
    const { email, otp } = req.body;
    console.log(email, otp)

    if (!email || !otp) {
        return res.status(400).json({ message: 'Email and OTP are required.' });
    }

    const user = await User.findOne({ email });
    if (!user) {
        return res.status(404).json({ message: 'User not found.' });
    }

    // Check if OTP is correct and not expired
    if (user.otp !== otp) {
        return res.status(400).json({ message: 'Invalid OTP.' });
    }

    if (new Date() > user.otpExpiry) {
        return res.status(400).json({ message: 'OTP has expired.' });
    }

    // Verify user and clear OTP fields
    user.isVerified = true;
    user.otp = undefined;
    user.otpExpiry = undefined;
    await user.save();

    res.status(200).json({ message: 'Email verified successfully.' });
});

// Resend OTP
const resendOtp = asyncHandler(async (req, res) => {
    const { email } = req.body;

    if (!email) {
        return res.status(400).json({ message: 'Email is required.' });
    }

    const user = await User.findOne({ email });
    if (!user) {
        return res.status(404).json({ message: 'User not found.' });
    }

    if (user.isVerified) {
        return res.status(400).json({ message: 'Email is already verified.' });
    }

    // Generate new OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiry = new Date();
    otpExpiry.setMinutes(otpExpiry.getMinutes() + 10); // OTP valid for 10 minutes

    // Update user with new OTP
    user.otp = otp;
    user.otpExpiry = otpExpiry;
    await user.save();

    // Send new OTP via email
    await sendOtpEmail(email, otp);

    res.status(200).json({ message: 'OTP resent successfully.' });
});

// User Login - Updated to check verification status
const loginUser = asyncHandler(async (req, res) => {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
        return res.status(401).json({ message: 'Invalid email or password.' });
    }

    // Check if user is blocked
    if (user.status === 'blocked') {
        return res.status(403).json({ 
            message: 'Your account has been blocked. Please contact support.',
            isBlocked: true
        });
    }

    // Check if user is verified
    if (!user.isVerified) {
        return res.status(401).json({ 
            message: 'Email not verified.',
            needsVerification: true,
            email: user.email
        });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
        return res.status(401).json({ message: 'Invalid email or password.' });
    }

    generateToken(res, user._id, 'user');

    res.status(200).json({
        _id: user._id,
        username: user.username,
        email: user.email,
        isAdmin: user.isAdmin,
        profileImage: user.profileImage,
        phone: user.phone
    });
});

// Logout User
const logoutUser = asyncHandler(async (req, res) => {
    res.cookie('user_jwt', '', { httpOnly: true, expires: new Date(0) });
    res.status(200).json({ message: 'Logged out successfully' });
});

// Send forgot password OTP
const forgotPassword = asyncHandler(async (req, res) => {
    const { email } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
        return res.status(404).json({ message: 'User not found with this email.' });
    }

    // Generate OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiry = new Date();
    otpExpiry.setMinutes(otpExpiry.getMinutes() + 10);

    // Save OTP to user
    user.resetPasswordOtp = otp;
    user.resetPasswordOtpExpiry = otpExpiry;
    await user.save();

    // Send OTP via email
    await sendOtpEmail(email, otp, 'Password Reset');

    res.status(200).json({ message: 'Password reset OTP sent successfully.' });
});

// Verify forgot password OTP
const verifyForgotOtp = asyncHandler(async (req, res) => {
    const { email, otp } = req.body;

    const user = await User.findOne({ 
        email,
        resetPasswordOtp: otp,
        resetPasswordOtpExpiry: { $gt: new Date() }
    });

    if (!user) {
        return res.status(400).json({ message: 'Invalid or expired OTP.' });
    }

    // Clear OTP fields
    user.resetPasswordOtp = undefined;
    user.resetPasswordOtpExpiry = undefined;
    await user.save();

    res.status(200).json({ message: 'OTP verified successfully.' });
});

// Resend forgot password OTP
const resendForgotOtp = asyncHandler(async (req, res) => {
    const { email } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
        return res.status(404).json({ message: 'User not found.' });
    }

    // Generate new OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiry = new Date();
    otpExpiry.setMinutes(otpExpiry.getMinutes() + 10);

    // Update user with new OTP
    user.resetPasswordOtp = otp;
    user.resetPasswordOtpExpiry = otpExpiry;
    await user.save();

    // Send new OTP via email
    await sendOtpEmail(email, otp, 'Password Reset');

    res.status(200).json({ message: 'OTP resent successfully.' });
});

// Reset password
const resetPassword = asyncHandler(async (req, res) => {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
        return res.status(404).json({ message: 'User not found.' });
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Update password
    user.password = hashedPassword;
    await user.save();

    res.status(200).json({ message: 'Password reset successful.' });
});

export const googleAuthController = asyncHandler(async (req, res) => {
    const { code } = req.query;
    
    try {
        const googleRes = await Promise.race([
            oauth2Client.getToken(code),
            new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Request timeout')), 15000)
            )
        ]);

        oauth2Client.setCredentials(googleRes.tokens);

        const userRes = await axios.get(
            `https://www.googleapis.com/oauth2/v3/userinfo?alt=json&access_token=${googleRes.tokens.access_token}`,
            {
                timeout: 10000, // 10 seconds timeout
            }
        );

        const { email, name } = userRes.data;
        let user = await User.findOne({ email });
        
        
        if (!user) {
            const randomPassword = Math.random().toString(36).substring(2, 15) +
                Math.random().toString(36).substring(2, 15);
            
            user = await User.create({
                username: name,
                email,
                password: randomPassword,
                isVerified: true // Since it's Google OAuth, we can trust the email is verified
            });
        }

        if(user.status=='blocked') {
            return res.status(403).json({
                message: "You're blocked. Contact Support team",
                isBlocked: true
            });
        }

        generateToken(res, user._id);

        res.status(200).json({
            _id: user._id,
            username: user.username,
            email: user.email,
        });
    } catch (error) {
        console.error('Google Auth Error:', error);
        res.status(500).json({
            message: error.message || 'Failed to authenticate with Google',
            details: error.code === 'ETIMEDOUT' ? 'Connection timed out. Please try again.' : undefined
        });
    }
});

export {
    createUser,
    loginUser,
    logoutUser,
    verifyOtp,
    resendOtp,
    forgotPassword,
    verifyForgotOtp,
    resendForgotOtp,
    resetPassword
}