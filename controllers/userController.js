import User from '../models/userModel.js';
import asyncHandler from '../middlewares/asyncHandler.js';
import generateToken from '../utils/createToken.js';
import bcrypt from 'bcryptjs';
import nodemailer from 'nodemailer';
import { oauth2Client } from "../utils/googleConfig.js";
import axios from "axios";
import { HTTP_STATUS } from '../utils/httpStatus.js';
import Wallet from '../models/walletModel.js';
import crypto from 'crypto';


const generateReferralCode = async (username) => {
  
  const baseCode = username.substring(0, 3).toUpperCase();
  const randomString = crypto.randomBytes(3).toString('hex').toUpperCase();
  const referralCode = `${baseCode}${randomString}`;
  
  
  const existingUser = await User.findOne({ referralCode });
  if (existingUser) {
    
    return generateReferralCode(username);
  }
  
  return referralCode;
};


const createUser = asyncHandler(async (req, res) => {
    const { username, email, phone, password, profileImage, referralCode } = req.body;

    if (!username || !email || !password || !phone) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({ message: 'Please fill all required fields.' });
    }

    const userExists = await User.findOne({ email });
    if (userExists && userExists.isVerified) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({ message: 'User already exists.' });
    }

    
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    console.log("OTP : ",otp)
    const otpExpiry = new Date();
    otpExpiry.setMinutes(otpExpiry.getMinutes() + 10); 

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    
    if (userExists && !userExists.isVerified) {
        await User.findByIdAndDelete(userExists._id);
    }

    
    const userReferralCode = await generateReferralCode(username);
    
    
    let referredBy = null;
    if (referralCode) {
        const referrer = await User.findOne({ referralCode });
        if (referrer) {
            referredBy = referrer._id;
        }
    }

    
    const newUser = new User({
        username,
        email,
        phone,
        password: hashedPassword,
        profileImage,
        isVerified: false,
        otp,
        otpExpiry,
        referralCode: userReferralCode,
        referredBy
    });
    
    await newUser.save();

    
    await sendOtpEmail(email, otp);

    res.status(HTTP_STATUS.OK).json({
        message: 'User registered successfully. Please verify your email.',
        _id: newUser._id,
        username: newUser.username,
        email: newUser.email,
        phone: newUser.phone,
        isAdmin: newUser.isAdmin,
        profileImage: newUser.profileImage,
        referralCode: newUser.referralCode
    });
});


const sendOtpEmail = async (email, otp, subject = 'Your Verification Code for FABRICO') => {
    try {
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_APP_PASSWORD 
            }
        });

        
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

        
        await transporter.sendMail(mailOptions);
        console.log("OTP email sent successfully");
    } catch (error) {
        console.error("Error sending OTP email:", error);
        throw new Error("Failed to send verification email");
    }
};


const verifyOtp = asyncHandler(async (req, res) => {
    const { email, otp } = req.body;
    console.log(email, otp)

    if (!email || !otp) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({ message: 'Email and OTP are required.' });
    }

    const user = await User.findOne({ email });
    if (!user) {
        return res.status(HTTP_STATUS.NOT_FOUND).json({ message: 'User not found.' });
    }


    if (user.otp !== otp) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({ message: 'Invalid OTP.' });
    }

    if (new Date() > user.otpExpiry) {
        return res.status(HTTP_STATUS.NOT_FOUND).json({ message: 'OTP has expired.' });
    }

    user.isVerified = true;
    user.otp = undefined;
    user.otpExpiry = undefined;
    await user.save();

    if (user.referredBy && !user.referralBonusReceived) {
        try {

            let newUserWallet = await Wallet.findOne({ userId: user._id });
            if (!newUserWallet) {
                newUserWallet = new Wallet({
                    userId: user._id,
                    balance: 0,
                    currency: 'INR'
                });
            }

           await newUserWallet.addTransaction({
                id: `REF-${Date.now()}-${user._id}`,
                type: 'credit',
                amount: 200,
                description: 'Referral bonus for signing up',
                status: 'completed'
            });
            
            await newUserWallet.save();
            

            
           
            let referrerWallet = await Wallet.findOne({ userId: user.referredBy });
            if (!referrerWallet) {
                referrerWallet = new Wallet({
                    userId: user.referredBy,
                    balance: 0,
                    currency: 'INR'
                });
            }
            await referrerWallet.save();
           
            await referrerWallet.addTransaction({
                id: `REF-${Date.now()}-${user.referredBy}`,
                type: 'credit',
                amount: 200,
                description: 'Referral bonus for referring a friend',
                status: 'completed'
            });

            await referrerWallet.save();
            

            user.referralBonusReceived = true;
            await user.save();
        } catch (error) {
            console.error('Error processing referral bonus:', error);
           
        }
    }


    generateToken(res, user._id);

    res.status(HTTP_STATUS.OK).json({ 
        message: 'Email verified successfully.',
        _id: user._id,
        username: user.username,
        email: user.email,
        isAdmin: user.isAdmin,
        profileImage: user.profileImage,
        phone: user.phone,
        referralCode: user.referralCode
    });
});

// Resend OTP
const resendOtp = asyncHandler(async (req, res) => {
    const { email } = req.body;

    if (!email) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({ message: 'Email is required.' });
    }

    const user = await User.findOne({ email });
    if (!user) {
        return res.status(HTTP_STATUS.NOT_FOUND).json({ message: 'User not found.' });
    }

    if (user.isVerified) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({ message: 'Email is already verified.' });
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

    res.status(HTTP_STATUS.OK).json({ message: 'OTP resent successfully.' });
});

// User Login - Updated to check verification status
const loginUser = asyncHandler(async (req, res) => {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
        return res.status(HTTP_STATUS.UNAUTHORIZED).json({ message: 'Invalid email or password.' });
    }

    // Check if user is blocked
    if (user.status === 'blocked') {
        return res.status(HTTP_STATUS.FORBIDDEN).json({ 
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
        return res.status(HTTP_STATUS.UNAUTHORIZED).json({ message: 'Invalid email or password.' });
    }

    generateToken(res, user._id);

    res.status(HTTP_STATUS.OK).json({
        _id: user._id,
        username: user.username,
        email: user.email,
        isAdmin: user.isAdmin,
        profileImage: user.profileImage,
        phone: user.phone,
        referralCode: user.referralCode
    });
});

// Logout User
const logoutUser = asyncHandler(async (req, res) => {
    res.cookie('jwt', '', { httpOnly: true, expires: new Date(0) });
    res.status(HTTP_STATUS.OK).json({ message: 'Logged out successfully' });
});

// Send forgot password OTP
const forgotPassword = asyncHandler(async (req, res) => {
    const { email } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
        return res.status(HTTP_STATUS.NOT_FOUND).json({ message: 'User not found with this email.' });
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

    res.status(HTTP_STATUS.OK).json({ message: 'Password reset OTP sent successfully.' });
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
        return res.status(HTTP_STATUS.BAD_REQUEST).json({ message: 'Invalid or expired OTP.' });
    }

    // Clear OTP fields
    user.resetPasswordOtp = undefined;
    user.resetPasswordOtpExpiry = undefined;
    await user.save();

    res.status(HTTP_STATUS.OK).json({ message: 'OTP verified successfully.' });
});

// Resend forgot password OTP
const resendForgotOtp = asyncHandler(async (req, res) => {
    const { email } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
        return res.status(HTTP_STATUS.NOT_FOUND).json({ message: 'User not found.' });
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

    res.status(HTTP_STATUS.OK).json({ message: 'OTP resent successfully.' });
});

// Reset password
const resetPassword = asyncHandler(async (req, res) => {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
        return res.status(HTTP_STATUS.NOT_FOUND).json({ message: 'User not found.' });
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Update password
    user.password = hashedPassword;
    await user.save();

    res.status(HTTP_STATUS.OK).json({ message: 'Password reset successful.' });
});

// Change password
const changePassword = asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user._id;

    const user = await User.findById(userId);
    if (!user) {
        return res.status(HTTP_STATUS.NOT_FOUND).json({ message: 'User not found.' });
    }

    // Verify current password
    const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
    if (!isPasswordValid) {
        return res.status(HTTP_STATUS.UNAUTHORIZED).json({ message: 'Current password is incorrect.' });
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    // Update password
    user.password = hashedPassword;
    await user.save();

    res.status(HTTP_STATUS.OK).json({ message: 'Password changed successfully.' });
});

export const googleAuthController = asyncHandler(async (req, res) => {
    const { code } = req.query;
    
    if (!code) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
            message: 'Authorization code is required'
        });
    }
    
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
        
        if (!email) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                message: 'Email not provided by Google'
            });
        }
        
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
            return res.status(HTTP_STATUS.FORBIDDEN).json({
                message: "You're blocked. Contact Support team",
                isBlocked: true
            });
        }

        generateToken(res, user._id);

        res.status(HTTP_STATUS.OK).json({
            _id: user._id,
            username: user.username,
            email: user.email,
        });
    } catch (error) {
        console.error('Google Auth Error:', error);
        
        if (error.message === 'Request timeout') {
            return res.status(HTTP_STATUS.REQUEST_TIMEOUT).json({
                message: 'Authentication request timed out. Please try again.'
            });
        }
        
        if (error.response && error.response.status === 400) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                message: 'Invalid authorization code. Please try again.'
            });
        }
        
        res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
            message: 'Failed to authenticate with Google',
            details: error.code === 'ETIMEDOUT' ? 'Connection timed out. Please try again.' : undefined
        });
    }
});

// Send OTP for email update verification
const sendEmailUpdateOtp = asyncHandler(async (req, res) => {
    const { newEmail } = req.body;
    const userId = req.user._id;

    // Check if email already exists
    const emailExists = await User.findOne({ email: newEmail });
    if (emailExists) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({ message: 'Email already exists.' });
    }

    // Generate OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiry = new Date();
    otpExpiry.setMinutes(otpExpiry.getMinutes() + 10);

    // Save OTP to user
    const user = await User.findById(userId);
    user.emailUpdateOtp = otp;
    user.emailUpdateOtpExpiry = otpExpiry;
    user.newEmailPending = newEmail;
    await user.save();

    // Send OTP via email
    await sendOtpEmail(newEmail, otp, 'Email Update Verification');

    res.status(HTTP_STATUS.OK).json({ message: 'Verification code sent to new email.' });
});

// Verify email update OTP
const verifyEmailUpdateOtp = asyncHandler(async (req, res) => {
    const { otp } = req.body;
    const userId = req.user._id;

    const user = await User.findOne({ 
        _id: userId,
        emailUpdateOtp: otp,
        emailUpdateOtpExpiry: { $gt: new Date() }
    });

    if (!user) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({ message: 'Invalid or expired verification code.' });
    }

    // Update email
    user.email = user.newEmailPending;
    user.emailUpdateOtp = undefined;
    user.emailUpdateOtpExpiry = undefined;
    user.newEmailPending = undefined;
    await user.save();

    res.status(HTTP_STATUS.OK).json({ 
        message: 'Email updated successfully.',
        email: user.email 
    });
});

// Update user profile
const updateUserProfile = asyncHandler(async (req, res) => {
    const { username, phone, profileImage } = req.body;
    const userId = req.user._id;

    const user = await User.findById(userId);
    if (!user) {
        return res.status(HTTP_STATUS.NOT_FOUND).json({ message: 'User not found.' });
    }

    if (username) user.username = username;
    if (phone) user.phone = phone;
    if (profileImage) user.profileImage = profileImage;

    await user.save();

    res.status(HTTP_STATUS.OK).json({
        message: 'Profile updated successfully',
        user: {
            _id: user._id,
            username: user.username,
            email: user.email,
            phone: user.phone,
            profileImage: user.profileImage,
            referralCode: user.referralCode
        }
    });
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
    resetPassword,
    sendEmailUpdateOtp,
    verifyEmailUpdateOtp,
    updateUserProfile,
    changePassword
}