import jwt from 'jsonwebtoken';
import User from '../models/userModel.js';
import asyncHandler from '../middlewares/asyncHandler.js';
import { HTTP_STATUS } from '../utils/httpStatus.js';

const authenticate = asyncHandler(async (req, res, next) => {
    const token = req.cookies.jwt;

    if (!token) {
        return res.status(HTTP_STATUS.UNAUTHORIZED).json({ message: 'Not authorized, No token found.' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = await User.findById(decoded.userId).select('-password');

        if (!req.user) {
            return res.status(HTTP_STATUS.UNAUTHORIZED).json({ message: 'User not found, authentication failed.' });
        }

        next();
    } catch (error) {
        return res.status(HTTP_STATUS.UNAUTHORIZED).json({ message: 'Invalid token, authentication failed.' });
    }
});

const authorizeAdmin = (req, res, next) => {
    if (req.user && req.user.isAdmin) {
        next();
    } else {
        return res.status(HTTP_STATUS.FORBIDDEN).json({ message: 'Not authorized as an admin.' });
    }
};

export { authenticate, authorizeAdmin };
