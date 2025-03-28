import jwt from 'jsonwebtoken';
import User from '../models/userModel.js';
import asyncHandler from '../middlewares/asyncHandler.js';

const authenticate = asyncHandler(async (req, res, next) => {
    const userToken = req.cookies.user_jwt;
    const adminToken = req.cookies.admin_jwt;

    // Get the requested role from the route
    const requestedRole = req.baseUrl.includes('/admin') ? 'admin' : 'user';
    
    let token;
    if (requestedRole === 'admin' && adminToken) {
        token = adminToken;
    } else if (requestedRole === 'user' && userToken) {
        token = userToken;
    }

    if (!token) {
        return res.status(401).json({ message: 'Not authorized, No token found.' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = await User.findById(decoded.userId).select('-password');

        if (!req.user) {
            return res.status(401).json({ message: 'User not found, authentication failed.' });
        }

        // Set the role based on the token used
        req.role = requestedRole;

        next();
    } catch (error) {
        return res.status(401).json({ message: 'Invalid token, authentication failed.' });
    }
});

const authorizeAdmin = (req, res, next) => {
    if (req.user && req.user.isAdmin) {
        next();
    } else {
        return res.status(403).json({ message: 'Not authorized as an admin.' });
    }
};

export { authenticate, authorizeAdmin };
