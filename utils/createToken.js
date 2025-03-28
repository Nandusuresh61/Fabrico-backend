import jwt from 'jsonwebtoken';

const generateToken = (res, userId, role) => {
    const token = jwt.sign({ userId }, process.env.JWT_SECRET, {
        expiresIn: '30d',
    });

    const cookieName = role === 'admin' ? 'admin_jwt' : 'user_jwt';

    res.cookie(cookieName, token, {
        httpOnly: true,
        secure: process.env.NODE_ENV !== 'development',
        sameSite: 'strict',
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
        path: role === 'admin' ? '/api/admin' : '/api/users'  // Set path based on role
    });
};

export default generateToken;
