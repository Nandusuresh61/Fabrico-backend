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

// Get All Users (Admin) with Search, Pagination & Sorting
const searchUsers = asyncHandler(async (req, res) => {
    const search = req.query.search || '';
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 10;
    const sortBy = req.query.sortBy || 'createdAt';
    const order = req.query.order === 'asc' ? 1 : -1;

    const searchFilter = search
        ? {
              $or: [
                  { username: { $regex: search, $options: 'i' } },
                  { email: { $regex: search, $options: 'i' } },
                  { status: { $regex: search, $options: 'i' } },
              ],
          }
        : {};
 
    const totalUsers = await User.countDocuments(searchFilter);
    const users = await User.find(searchFilter)
        .sort({ [sortBy]: order })
        .skip((page - 1) * limit) 
        .limit(limit); 
    
    res.json({
        users,
        page,
        totalPages: Math.ceil(totalUsers / limit),
        totalUsers,
    });
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
    searchUsers,
}