import asyncHandler from '../middlewares/asyncHandler.js';
import Order from '../models/orderModel.js';
import Payment from '../models/paymentModel.js';
import Razorpay from 'razorpay';
import crypto from 'crypto';
import { HTTP_STATUS } from '../utils/httpStatus.js';

// Initialize Razorpay
const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
});

// Generate unique payment ID
const generatePaymentId = async () => {
    const latestPayment = await Payment.findOne().sort('-createdAt');
    let nextNumber = 1;
    if (latestPayment && latestPayment.paymentId) {
        const lastNumber = parseInt(latestPayment.paymentId.split('-')[1]);
        nextNumber = lastNumber + 1;
    }
    return `PAY-${String(nextNumber).padStart(5, '0')}`;
};

// Create Razorpay order
export const createRazorpayOrder = asyncHandler(async (req, res) => {
    const { orderId } = req.body;

    // Fetch order details
    const order = await Order.findOne({ orderId });
    if (!order) {
        res.status(HTTP_STATUS.NOT_FOUND);
        throw new Error('Order not found');
    }

    // Create Razorpay order
    const razorpayOrder = await razorpay.orders.create({
        amount: Math.round(order.totalAmount * 100), // Convert to smallest currency unit (paise)
        currency: 'INR',
        receipt: orderId,
    });

    // Create payment record
    const paymentId = await generatePaymentId();
    const payment = await Payment.create({
        paymentId,
        order: order._id,
        user: req.user._id,
        amount: order.totalAmount,
        currency: 'INR',
        paymentMethod: 'online',
        paymentDetails: {
            paymentGateway: 'razorpay',
            transactionId: razorpayOrder.id
        }
    });

    res.status(HTTP_STATUS.CREATED).json({
        success: true,
        razorpayOrderId: razorpayOrder.id,
        amount: order.totalAmount,
        currency: 'INR',
        orderId: order.orderId,
        customerName: req.user.name,
        customerEmail: req.user.email,
        customerPhone: order.shippingAddress.phone
    });
});

// Verify Razorpay payment
export const verifyPayment = asyncHandler(async (req, res) => {
    const {
        razorpayPaymentId,
        razorpayOrderId,
        razorpaySignature,
        orderId
    } = req.body;

    // Verify signature
    const body = razorpayOrderId + '|' + razorpayPaymentId;
    const expectedSignature = crypto
        .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
        .update(body.toString())
        .digest('hex');

    const isAuthentic = expectedSignature === razorpaySignature;

    if (!isAuthentic) {
        res.status(HTTP_STATUS.BAD_REQUEST);
        throw new Error('Invalid payment signature');
    }

    // Update order and payment status
    const order = await Order.findOne({ orderId });
    if (!order) {
        res.status(HTTP_STATUS.NOT_FOUND);
        throw new Error('Order not found');
    }

    const payment = await Payment.findOne({
        'paymentDetails.transactionId': razorpayOrderId
    });

    if (!payment) {
        res.status(HTTP_STATUS.NOT_FOUND);
        throw new Error('Payment not found');
    }

    // Update payment status
    payment.paymentStatus = 'completed';
    payment.paymentDetails.transactionId = razorpayPaymentId;
    await payment.save();

    // Update order status
    order.paymentStatus = 'completed';
    await order.save();

    res.status(HTTP_STATUS.OK).json({
        success: true,
        message: 'Payment verified successfully'
    });
});