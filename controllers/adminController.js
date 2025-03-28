import User from "../models/userModel.js";
import asyncHandler from "../middlewares/asyncHandler.js";
import generateToken from '../utils/createToken.js';
import bcrypt from 'bcryptjs';


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

    generateToken(res, user._id, 'admin');

    res.status(200).json({
        _id: user._id,
        username: user.username,
        email: user.email,
        isAdmin: user.isAdmin,
    });
});


const logoutAdmin = asyncHandler(async (req, res) => {
    res.cookie('admin_jwt', '', { 
        httpOnly: true, 
        expires: new Date(0),
        path: '/api/admin'  // Specify the path
    });
    res.status(200).json({ message: 'Logged out successfully' });
});


const getAllUsers = asyncHandler(async (req, res) => {
    const { 
        page = 1, 
        limit = 5, 
        search = '', 
        status = 'all',
        sortField = '_id',
        sortOrder = 'desc'
    } = req.query;

    // Build filter conditions
    const filterConditions = {};
    if (status.toLowerCase() !== 'all') {
        filterConditions.status = status;
    }
    
    if (search) {
        filterConditions.$or = [
            { username: { $regex: search, $options: 'i' } },
            { email: { $regex: search, $options: 'i' } }
        ];
    }

    // Calculate total documents and pages
    const totalDocs = await User.countDocuments(filterConditions);
    const totalPages = Math.ceil(totalDocs / limit);

    // Get paginated and sorted results
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const users = await User.find(filterConditions)
        .select('-password')
        .sort({ [sortField]: sortOrder })
        .limit(parseInt(limit))
        .skip(skip);

    res.status(200).json({
        users,
        pagination: {
            page: parseInt(page),
            totalPages,
            totalDocs,
            hasNextPage: page < totalPages,
            hasPrevPage: page > 1
        }
    });
});




const toggleUserStatus = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const user = await User.findById(id);

    if (!user) {
        return res.status(404).json({ message: 'User not found' });
    }

    user.status = user.status === 'active' ? 'blocked' : 'active';
    await user.save();

    res.status(200).json({ message: `User ${user.status === 'active' ? 'unblocked' : 'blocked'} successfully.`,status: user.status });
});


const deleteUserById = asyncHandler(async(req,res)=>{
    const user = await User.findById(req.params.id)

    if(user){
        if(user.isAdmin){
            res.status(400)
            throw new Error('cannot delete admin user')
        }
        await User.deleteOne({_id: user._id})
        res.json({message: "User removed"})
    }else{
        res.status(404)
        throw new Error("User not found")
    }
})

const getUserById = asyncHandler(async(req,res)=>{
    const user = await User.findById(req.params.id).select('-password')

    if(user){
        res.json(user)
    }else{
        res.status(404)
        throw new Error('User not found')
    }
})

const updateUserById = asyncHandler(async(req,res)=>{
    const user = await User.findById(req.params.id);
    if(user){
    user.username = req.body.username || user.username;
    user.email = req.body.email || user.email;
    user.isAdmin = Boolean(req.body.isAdmin);

    const updatedUser = await user.save();

    res.json({
        _id: updatedUser._id,
        username: updatedUser.username,
        email: updatedUser.email,
        isAdmin: updatedUser.isAdmin
    })
    }else{
        res.status(404)
        throw new Error('User not found')
    }
    
})





export {
    loginAdmin,
    logoutAdmin,
    toggleUserStatus,
    getAllUsers,
    deleteUserById,
    updateUserById,
    getUserById,

}