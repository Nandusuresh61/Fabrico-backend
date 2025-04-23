import asyncHandler from '../middlewares/asyncHandler.js';
import Wallet from '../models/walletModel.js';
import { HTTP_STATUS } from '../utils/httpStatus.js';
import Order from '../models/orderModel.js';

export const getWallet = asyncHandler(async (req, res) => {
    const wallet = await Wallet.findOne({ userId: req.user._id });

    if (!wallet) {
        // Create a new wallet if it doesn't exist
        const newWallet = await Wallet.create({
            userId: req.user._id,
            balance: 0,
            currency: 'INR'
        });
        res.json(newWallet);
    } else {
        res.json(wallet);
    }
});

export const getWalletTransactions = asyncHandler(async (req, res) => {
    const wallet = await Wallet.findOne({ userId: req.user._id });

    if (!wallet) {
        res.json([]);
    } else {
        res.json(wallet.transactions);
    }
});


export const checkWalletBalance = asyncHandler(async (req, res) => {
    const { amount } = req.query;
    const wallet = await Wallet.findOne({ userId: req.user._id });

    if (!wallet) {
        return res.status(HTTP_STATUS.NOT_FOUND).json({
            success: false,
            message: 'Wallet not found'
        });
    }

    const hasEnoughBalance = wallet.balance >= parseFloat(amount);
    res.json({
        success: true,
        hasEnoughBalance,
        balance: wallet.balance
    });
});

export const processWalletPayment = asyncHandler(async (req, res) => {
    const { orderId } = req.body;
    
    const order = await Order.findOne({ orderId });
    if (!order) {
        return res.status(HTTP_STATUS.NOT_FOUND).json({
            success: false,
            message: 'Order not found'
        });
    }

    const wallet = await Wallet.findOne({ userId: req.user._id });
    if (!wallet) {
        return res.status(HTTP_STATUS.NOT_FOUND).json({
            success: false,
            message: 'Wallet not found'
        });
    }

    if (wallet.balance < order.totalAmount) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
            success: false,
            message: 'Insufficient wallet balance'
        });
    }

    // Create transaction ID
    const transactionId = `WAL-${Date.now()}-${order.orderId}`;

    // Add debit transaction to wallet
    await wallet.addTransaction({
        id: transactionId,
        type: 'debit',
        amount: order.totalAmount,
        description: `Payment for order ${order.orderId}`,
        orderId: order.orderId,
        status: 'completed'
    });

    // Update order payment status
    order.paymentStatus = 'completed';
    await order.save();

    res.json({
        success: true,
        message: 'Payment processed successfully',
        transactionId
    });
});