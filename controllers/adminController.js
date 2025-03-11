import User from "../models/userModel.js";
import asyncHandler from "../middlewares/asyncHandler.js";
import generateToken from '../utils/createToken.js';
import bcrypt from 'bcryptjs';


// User Login
const loginAdmin = asyncHandler(async (req, res) => {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
        return res.status(401).json({ message: 'Invalid email or password.' });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
        return res.status(401).json({ message: 'Invalid email or password.' });
    }

    generateToken(res, user._id);

    res.status(200).json({
        _id: user._id,
        username: user.username,
        email: user.email,
        isAdmin: user.isAdmin,
    });
});

// Logout admin
const logoutAdmin = asyncHandler(async (req, res) => {
    res.cookie('jwt', '', { httpOnly: true, expires: new Date(0) });
    res.status(200).json({ message: 'Logged out successfully' });
});

// Get All Users (Admin)
const getAllUsers = asyncHandler(async (req, res) => {
    const users = await User.find({});
    res.json(users);
});

// Block/Unblock User (Admin)
const toggleUserStatus = asyncHandler(async (req, res) => {
    const { userId } = req.params;
    const user = await User.findById(userId);

    if (!user) {
        return res.status(404).json({ message: 'User not found' });
    }

    user.status = user.status === 'active' ? 'blocked' : 'active';
    await user.save();

    res.status(200).json({ message: `User ${user.status === 'active' ? 'unblocked' : 'blocked'} successfully.` });
});


export {
    loginAdmin,
    logoutAdmin,
    toggleUserStatus,
    getAllUsers,
}