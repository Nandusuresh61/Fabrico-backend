import asyncHandler from '../middlewares/asyncHandler.js';
import Order from '../models/orderModel.js';

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

// @desc    Create new order
// @route   POST /api/orders
// @access  Private
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

// @desc    Get logged in user orders
// @route   GET /api/orders
// @access  Private
export const getOrders = asyncHandler(async (req, res) => {
    const orders = await Order.find({ user: req.user._id })
        .populate('items.product')
        .populate('items.variant')
        .populate('shippingAddress')
        .sort('-createdAt');
    res.json(orders);
});

// @desc    Get order by ID
// @route   GET /api/orders/:id
// @access  Private
export const getOrderById = asyncHandler(async (req, res) => {
    const order = await Order.findById(req.params.id)
        .populate('items.product')
        .populate('items.variant')
        .populate('shippingAddress');

    if (order && (order.user.toString() === req.user._id.toString())) {
        res.json(order);
    } else {
        res.status(404);
        throw new Error('Order not found');
    }
});

// @desc    Update order status
// @route   PUT /api/orders/:id/status
// @access  Private
export const updateOrderStatus = asyncHandler(async (req, res) => {
    const { status } = req.body;
    const order = await Order.findById(req.params.id);

    if (order && (order.user.toString() === req.user._id.toString())) {
        order.status = status;
        const updatedOrder = await order.save();
        res.json(updatedOrder);
    } else {
        res.status(404);
        throw new Error('Order not found');
    }
});

// @desc    Cancel order
// @route   PUT /api/orders/:id/cancel
// @access  Private
export const cancelOrder = asyncHandler(async (req, res) => {
    const order = await Order.findById(req.params.id);

    if (order && (order.user.toString() === req.user._id.toString())) {
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
