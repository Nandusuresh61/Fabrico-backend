import asyncHandler from '../middlewares/asyncHandler.js';
import Order from '../models/orderModel.js';
import User from '../models/userModel.js';

// Helper function to generate order ID
const generateOrderId = async () => {
    // Get the latest order to determine the next number
    const latestOrder = await Order.findOne().sort('-createdAt');
    
    let nextNumber = 1;
    if (latestOrder && latestOrder.orderId) {
        // Extract the number from the last order ID and increment
        const lastNumber = parseInt(latestOrder.orderId.split('-')[1]);
        nextNumber = lastNumber + 1;
    }
    
    // Format the number to 5 digits with leading zeros
    const formattedNumber = String(nextNumber).padStart(5, '0');
    return `ORD-${formattedNumber}`;
};

export const createOrder = asyncHandler(async (req, res) => {
    const {
        items,
        shippingAddress,
        paymentMethod,
        totalAmount,
    } = req.body;

    if (!items || items.length === 0) {
        res.status(400);
        throw new Error('No order items');
    }

    // Generate unique order ID
    const orderId = await generateOrderId();

    const order = await Order.create({
        orderId,
        user: req.user._id,
        items,
        shippingAddress,
        paymentMethod,
        totalAmount,
    });

    if (order) {
        res.status(201).json(order);
    } else {
        res.status(400);
        throw new Error('Invalid order data');
    }
});


export const getOrders = asyncHandler(async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search || '';
    const status = req.query.status || '';
    const sortBy = req.query.sortBy || 'createdAt';
    const sortOrder = req.query.sortOrder || 'desc';

    // Build query
    const query = {};

    // Search functionality
    if (search) {
        query.$or = [
            { orderId: { $regex: search, $options: 'i' } },
            { 'user.name': { $regex: search, $options: 'i' } },
            { 'user.email': { $regex: search, $options: 'i' } }
        ];
    }

    // Status filter
    if (status && status !== 'all') {
        query.status = status;
    }

    // Count total documents
    const total = await Order.countDocuments(query);

    // Execute query with pagination and sorting
    const orders = await Order.find(query)
        .populate('user', 'username email')
        .populate('items.product', 'name price')
        .populate('items.variant', 'name sku mainImage subImages')
        .populate('shippingAddress')
        .sort({ [sortBy]: sortOrder })
        .skip((page - 1) * limit)
        .limit(limit);

    res.json({
        orders,
        page,
        pages: Math.ceil(total / limit),
        total
    });
});

export const getOrderById = asyncHandler(async (req, res) => {
    const order = await Order.findById(req.params.id)
        .populate('user', 'name email')
        .populate('items.product', 'name price')
        .populate('items.variant', 'name sku mainImage subImages')
        .populate('shippingAddress');

    if (order && (order.user._id.toString() === req.user._id.toString() || req.user.isAdmin)) {
        res.json(order);
    } else {
        res.status(404);
        throw new Error('Order not found');
    }
});

export const updateOrderStatus = asyncHandler(async (req, res) => {
    const { status } = req.body;
    let order = await Order.findById(req.params.id);

    if (order) {
        order.status = status;
        order = await order.save();
        // Populate all necessary fields including username
        order = await Order.findById(order._id)
            .populate({
                path: 'user',
                select: 'username email'  // Make sure we select username
            })
            .populate('items.product', 'name price')
            .populate('items.variant', 'name sku mainImage subImages')
            .populate('shippingAddress');
        res.json(order);
    } else {
        res.status(404);
        throw new Error('Order not found');
    }
});

export const cancelOrder = asyncHandler(async (req, res) => {
    const order = await Order.findById(req.params.id);

    if (order && (order.user.toString() === req.user._id.toString() || req.user.isAdmin)) {
        if (order.status === 'pending' || order.status === 'processing') {
            order.status = 'cancelled';
            const updatedOrder = await order.save();
            res.json(updatedOrder);
        } else {
            res.status(400);
            throw new Error('Order cannot be cancelled');
        }
    } else {
        res.status(404);
        throw new Error('Order not found');
    }
});


export const verifyReturnRequest = asyncHandler(async (req, res) => {
    const { status } = req.body;
    let order = await Order.findById(req.params.id);

    if (!order) {
        res.status(404);
        throw new Error('Order not found');
    }

    // Find the specific item in the order
    const item = order.items.find(item => item._id.toString() === req.params.itemId);

    if (!item) {
        res.status(404);
        throw new Error('Order item not found');
    }

    if (!item.returnRequest || item.returnRequest.status !== 'requested') {
        res.status(400);
        throw new Error('No active return request found for this item');
    }

    // Update return request status
    item.returnRequest.status = status;
    item.returnRequest.processedAt = Date.now();

    // If return is approved, process refund to user's wallet
    if (status === 'approved') {
        const user = await User.findById(order.user);
        if (!user) {
            res.status(404);
            throw new Error('User not found');
        }

        // Calculate refund amount for the specific item
        const refundAmount = item.price * item.quantity;

        // Add refund to user's wallet
        user.walletBalance = (user.walletBalance || 0) + refundAmount;
        await user.save();
    }

    order = await order.save();
    // Populate the user and other necessary fields before sending response
    order = await Order.findById(order._id)
        .populate('user', 'name email')
        .populate('items.product', 'name price')
        .populate('items.variant', 'name sku mainImage subImages')
        .populate('shippingAddress');
    res.json(order);
});

export const getUserOrders = asyncHandler(async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const sortBy = req.query.sortBy || 'createdAt';
    const sortOrder = req.query.sortOrder || 'desc';

    // Build query for user's orders
    const query = { user: req.user._id };

    // Count total documents for this user
    const total = await Order.countDocuments(query);

    // Execute query with pagination and sorting
    const orders = await Order.find(query)
        .populate('items.product', 'name price mainImage')
        .populate('items.variant', 'name sku mainImage subImages')
        .populate('shippingAddress')  // Make sure we populate the shipping address
        .sort({ [sortBy]: sortOrder })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean();  // Convert to plain JavaScript objects

    // Add debug logging
    console.log('Fetched orders:', JSON.stringify(orders, null, 2));

    res.json({
        orders,
        page,
        pages: Math.ceil(total / limit),
        total
    });
});
