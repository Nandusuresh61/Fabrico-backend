import asyncHandler from '../middlewares/asyncHandler.js';
import Order from '../models/orderModel.js';
import User from '../models/userModel.js';
import Payment from '../models/paymentModel.js';
import PDFDocument from 'pdfkit';
import Wallet from '../models/walletModel.js';
import Address from '../models/addressModel.js';
import { HTTP_STATUS } from '../utils/httpStatus.js';
import Product from '../models/productModel.js';
import Variant from '../models/varientModel.js';


const generateOrderId = async () => {
    
    const latestOrder = await Order.findOne().sort('-createdAt');
    
    let nextNumber = 1;
    if (latestOrder && latestOrder.orderId) {
        
        const lastNumber = parseInt(latestOrder.orderId.split('-')[1]);
        nextNumber = lastNumber + 1;
    }
    
    
    const formattedNumber = String(nextNumber).padStart(5, '0');
    return `ORD-${formattedNumber}`;
};

export const createOrder = asyncHandler(async (req, res) => {
    const {
        items,
        shippingAddress,
        paymentMethod,
        totalAmount,
        couponDiscount,
        productDiscount
    } = req.body;

    if (!items || items.length === 0) {
        res.status(HTTP_STATUS.BAD_REQUEST);
        throw new Error('No order items');
    }
    for (const item of items) {
        const product = await Product.findById(item.product);
        if (!product || product.status === 'blocked') {
            res.status(HTTP_STATUS.BAD_REQUEST);
            throw new Error('One or more products are unavailable');
        }

        const variant = await Variant.findById(item.variant);
        if (!variant || variant.isBlocked) {
            res.status(HTTP_STATUS.BAD_REQUEST);
            throw new Error('One or more product variants are unavailable');
        }

        // Verify stock availability
        if (variant.stock < item.quantity) {
            res.status(HTTP_STATUS.BAD_REQUEST);
            throw new Error(`Insufficient stock for product variant`);
        }
    }


    let addressDetails;
    
    // Check if shippingAddress is an ID or an object with address details
    if (typeof shippingAddress === 'string') {
        // If it's an ID, fetch the address from the database
        const address = await Address.findById(shippingAddress);
        if (!address) {
            res.status(HTTP_STATUS.BAD_REQUEST);
            throw new Error('Shipping address not found');
        }
        addressDetails = {
            name: address.name,
            street: address.street,
            city: address.city,
            state: address.state,
            pincode: address.pincode,
            phone: address.phone
        };
    } else if (typeof shippingAddress === 'object') {
        // If it's an object, validate the required fields
        if (!shippingAddress.name || !shippingAddress.street || 
            !shippingAddress.city || !shippingAddress.state || 
            !shippingAddress.pincode || !shippingAddress.phone) {
            res.status(HTTP_STATUS.BAD_REQUEST);
            throw new Error('Invalid shipping address: Missing required fields');
        }
        addressDetails = shippingAddress;
    } else {
        res.status(HTTP_STATUS.BAD_REQUEST);
        throw new Error('Invalid shipping address format');
    }
    
    const orderId = await generateOrderId();

    const order = await Order.create({
        orderId,
        user: req.user._id,
        items,
        shippingAddress: addressDetails,
        paymentMethod,
        totalAmount,
        couponDiscount: couponDiscount || 0,
        productDiscount: productDiscount || 0
    });

    if (order) {
        res.status(HTTP_STATUS.CREATED).json(order);
    } else {
        res.status(HTTP_STATUS.BAD_REQUEST);
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

    
    const query = {};

   
    if (search) {
        query.$or = [
            { orderId: { $regex: search, $options: 'i' } },
            
        ];
    }
    if (search) {
        const users = await User.find({
            $or: [
                { username: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } }
            ]
        });
        
        // Add user IDs to the query
        if (users.length > 0) {
            query.$or = query.$or || [];
            query.$or.push({ user: { $in: users.map(user => user._id) } });
        }
    }

 
    if (status && status !== 'all') {
        query.status = status;
    }

    
    const total = await Order.countDocuments(query);

  
    const orders = await Order.find(query)
        .populate('user', 'username email')
        .populate({
            path: 'items.product',
            select: 'name price',
            populate: [
                { path: 'brand', select: 'name' },
                { path: 'category', select: 'name' }
            ]
        })
        .populate('items.variant', 'name sku mainImage subImages color size')
        .sort({ [sortBy]: sortOrder })
        .skip((page - 1) * limit)
        .limit(limit);

    
    // console.log('Fetched orders with items:', JSON.stringify(orders, null, 2));

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
        .populate({
            path: 'items.product',
            select: 'name price',
            populate: [
                { path: 'brand', select: 'name' },
                { path: 'category', select: 'name' }
            ]
        })
        .populate('items.variant', 'name sku mainImage subImages color size');

    if (order && (order.user._id.toString() === req.user._id.toString() || req.user.isAdmin)) {
        res.json(order);
    } else {
        res.status(HTTP_STATUS.NOT_FOUND);
        throw new Error('Order not found');
    }
});

export const updateOrderStatus = asyncHandler(async (req, res) => {
    const { status } = req.body;
    let order = await Order.findById(req.params.id);

    if (order) {
        order.status = status;
        
        // If order status is delivered, update payment status to completed
        if (status === 'delivered') {
            order.paymentStatus = 'completed';
            
            // Find and update the associated payment
            const payment = await Payment.findOne({ order: order._id });
            if (payment) {
                payment.paymentStatus = 'completed';
                await payment.save();
            }
        }
        
        order = await order.save();
        
        order = await Order.findById(order._id)
            .populate({
                path: 'user',
                select: 'username email'  
            })
            .populate('items.product', 'name price brand category')
            .populate('items.variant', 'name sku mainImage subImages color size')
            .populate('shippingAddress');
        res.json(order);
    } else {
        res.status(HTTP_STATUS.NOT_FOUND);
        throw new Error('Order not found');
    }
});

export const cancelOrder = asyncHandler(async (req, res) => {
    const { reason } = req.body;
    const order = await Order.findById(req.params.id)
        .populate('items.product')
        .populate('items.variant');

    if (!order) {
        res.status(HTTP_STATUS.NOT_FOUND);
        throw new Error('Order not found');
    }

    if (order.user.toString() !== req.user._id.toString() && !req.user.isAdmin) {
        res.status(HTTP_STATUS.UNAUTHORIZED);
        throw new Error('Not authorized');
    }

    if (order.status !== 'pending' && order.status !== 'processing') {
        res.status(HTTP_STATUS.BAD_REQUEST);
        throw new Error('Order cannot be cancelled at this stage');
    }

    // Handle refund for online payment
    if (order.paymentMethod === 'online' && order.paymentStatus === 'completed') {
        try {
            // Find or create user's wallet
            let wallet = await Wallet.findOne({ userId: order.user });
            if (!wallet) {
                wallet = new Wallet({
                    userId: order.user,
                    balance: 0,
                    currency: 'INR'
                });
            }

            // Add refund amount to wallet
            await wallet.addTransaction({
                id: `REF-${Date.now()}-${order._id}`,
                type: 'credit',
                amount: order.totalAmount,
                description: 'Refund for cancelled order',
                orderId: order.orderId,
                status: 'completed'
            });

            // Update payment status
            const payment = await Payment.findOne({ order: order._id });
            if (payment) {
                payment.paymentStatus = 'refunded';
                await payment.save();
            }
        } catch (error) {
            console.error('Error processing refund:', error);
            res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR);
            throw new Error('Failed to process refund');
        }
    }

    // Update product quantities
    for (const item of order.items) {
        const variant = item.variant;
        variant.quantity += item.quantity;
        await variant.save();
    }

    // Update order status
    order.status = 'cancelled';
    order.cancellationReason = reason;
    order.cancelledAt = Date.now();
    
    const updatedOrder = await order.save();

    res.json(updatedOrder);
});


export const verifyReturnRequest = asyncHandler(async (req, res) => {
    const { status } = req.body;
    let order = await Order.findById(req.params.id);

    if (!order) {
        res.status(HTTP_STATUS.NOT_FOUND);
        throw new Error('Order not found');
    }

    const item = order.items.find(item => item._id.toString() === req.params.itemId);

    if (!item) {
        res.status(HTTP_STATUS.NOT_FOUND);
        throw new Error('Order item not found');
    }

    if (!item.returnRequest || item.returnRequest.status !== 'requested') {
        res.status(HTTP_STATUS.BAD_REQUEST);
        throw new Error('No active return request found for this item');
    }

    item.returnRequest.status = status;
    item.returnRequest.processedAt = Date.now();

    if (status === 'approved') {
        const user = await User.findById(order.user);
        if (!user) {
            res.status(HTTP_STATUS.NOT_FOUND);
            throw new Error('User not found');
        }

        // Calculate refund amount
        const refundAmount = item.price * item.quantity;

        // Find or create user's wallet
        let wallet = await Wallet.findOne({ userId: user._id });
        if (!wallet) {
            wallet = await Wallet.create({
                userId: user._id,
                balance: 0,
                currency: 'INR'
            });
        }

        // Add transaction to wallet
        const transaction = {
            id: `TRX-${Date.now()}`,
            type: 'credit',
            amount: refundAmount,
            description: `Refund for Order ${order.orderId}`,
            orderId: order.orderId,
            status: 'completed'
        };

        await wallet.addTransaction(transaction);
    }

    order = await order.save();
    
    order = await Order.findById(order._id)
        .populate('user', 'name email')
        .populate('items.product', 'name price brand category')
        .populate('items.variant', 'name sku mainImage subImages color size')
        .populate('shippingAddress');
    res.json(order);
});

export const getUserOrders = asyncHandler(async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search || '';
    const status = req.query.status || '';
    const sortBy = req.query.sortBy || 'createdAt';
    const sortOrder = req.query.sortOrder || 'desc';

    const query = { user: req.user._id };

    // Add search functionality
    if (search) {
        query.$or = [
            { orderId: { $regex: search, $options: 'i' } },
            { 'shippingAddress.name': { $regex: search, $options: 'i' } },
            { 'shippingAddress.phone': { $regex: search, $options: 'i' } }
        ];
    }

    // Add status filter
    if (status) {
        query.status = status;
    }

    const total = await Order.countDocuments(query);

    const orders = await Order.find(query)
        .populate('items.product', 'name price brand category mainImage')
        .populate('items.variant', 'name sku mainImage subImages color size')
        .populate('shippingAddress')
        .sort({ [sortBy]: sortOrder === 'asc' ? 1 : -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean();

    res.json({
        orders,
        page,
        pages: Math.ceil(total / limit),
        total
    });
});

export const cancelOrderForUser = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { reason } = req.body;

    const order = await Order.findById(id)
        .populate('items.variant')
        .populate('user');

    if (!order) {
        res.status(HTTP_STATUS.NOT_FOUND);
        throw new Error('Order not found');
    }

    if (order.user._id.toString() !== req.user._id.toString()) {
        res.status(HTTP_STATUS.FORBIDDEN);
        throw new Error('Not authorized to cancel this order');
    }

    if (order.status !== 'pending' && order.status !== 'processing') {
        res.status(HTTP_STATUS.BAD_REQUEST);
        throw new Error('Order cannot be cancelled at this stage');
    }

    // Handle refund for online payment
    if ((order.paymentMethod === 'online' || order.paymentMethod === 'wallet') && order.paymentStatus === 'completed') {
        try {
            // Find or create user's wallet
            let wallet = await Wallet.findOne({ userId: order.user._id });
            if (!wallet) {
                wallet = await Wallet.create({
                    userId: order.user._id,
                    balance: 0,
                    currency: 'INR'
                });
            }

            // Add refund amount to wallet
            await wallet.addTransaction({
                id: `REF-${Date.now()}-${order._id}`,
                type: 'credit',
                amount: order.totalAmount,
                description: 'Refund for cancelled order',
                orderId: order.orderId,
                status: 'completed'
            });

            // Update payment status
            const payment = await Payment.findOne({ order: order._id });
            if (payment) {
                payment.paymentStatus = 'refunded';
                await payment.save();
            }
        } catch (error) {
            console.error('Error processing refund:', error);
            res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR);
            throw new Error('Failed to process refund');
        }
    }

    // Update product quantities
    for (const item of order.items) {
        const variant = item.variant;
        if (variant) {
            variant.quantity += item.quantity; // Changed from stock to quantity
            await variant.save();
        }
    }

    // Update order status
    order.status = 'cancelled';
    order.cancellationReason = reason;
    order.cancelledAt = Date.now();
    await order.save();

    const updatedOrder = await Order.findById(order._id)
        .populate('user', 'name email')
        .populate('items.product', 'name price brand category')
        .populate('items.variant', 'name sku mainImage subImages color size')
        .populate('shippingAddress');

    res.json(updatedOrder);
});

export const generateInvoice = asyncHandler(async (req, res) => {
    const order = await Order.findById(req.params.id)
        .populate('user', 'username email')
        .populate({
            path: 'items.product',
            select: 'name price brand category'
        })
        .populate('items.variant', 'color price');

    if (!order) {
        res.status(HTTP_STATUS.NOT_FOUND);
        throw new Error('Order not found');
    }

    const doc = new PDFDocument({
        size: 'A4',
        margin: 50
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=invoice-${order.orderId}.pdf`);
    doc.pipe(res);

    // Define colors and styling
    const colors = {
        primary: '#2563eb',
        secondary: '#64748b',
        accent: '#f1f5f9',
        border: '#e2e8f0'
    };

    // Add logo and company name
    doc.fontSize(24)
        .fillColor(colors.primary)
        .text('FABRICO', { align: 'center' });
    
    // Add decorative line
    doc.lineWidth(2)
        .moveTo(50, doc.y + 10)
        .lineTo(545, doc.y + 10)
        .stroke(colors.primary);

    doc.moveDown();
    
    // Company details with styled box
    doc.rect(50, doc.y, 495, 80)
        .fillColor(colors.accent)
        .fill();
    
    doc.fillColor(colors.secondary)
        .fontSize(12)
        .text('123 Fashion Street', { align: 'center' })
        .text('Kannur, Kerala 670702', { align: 'center' })
        .text('Phone: +91 9645760466', { align: 'center' })
        .text('Email: support@fabrico.com', { align: 'center' });

    doc.moveDown(2);

    // Invoice header with background
    doc.rect(50, doc.y, 495, 40)
        .fillColor(colors.primary)
        .fill();
    
    doc.fillColor('#FFFFFF')
        .fontSize(16)
        .text('INVOICE', 270, doc.y - 30);

    doc.moveDown(2);

    // Invoice details in a styled box
    doc.rect(50, doc.y, 495, 50)
        .fillColor(colors.accent)
        .fill();

    doc.fillColor(colors.secondary)
        .fontSize(12)
        .text(`Invoice Number: ${order.orderId}`, 60, doc.y - 40)
        .text(`Date: ${new Date(order.createdAt).toLocaleDateString()}`, 350, doc.y - 40);

    doc.moveDown(3);

    // Customer and shipping info in two columns
    const customerStartY = doc.y;
    
    // Customer details column
    doc.fontSize(14)
        .fillColor(colors.primary)
        .text('Customer Details', 50, customerStartY);
    
    doc.fontSize(12)
        .fillColor(colors.secondary)
        .text(`Name: ${order.user.username}`, 50, customerStartY + 25)
        .text(`Email: ${order.user.email}`, 50, customerStartY + 45)
        .text(`Phone: ${order.shippingAddress.phone}`, 50, customerStartY + 65);

    // Shipping details column
    doc.fontSize(14)
        .fillColor(colors.primary)
        .text('Shipping Address', 300, customerStartY);
    
    doc.fontSize(12)
        .fillColor(colors.secondary)
        .text(order.shippingAddress.name, 300, customerStartY + 25)
        .text(order.shippingAddress.street, 300, customerStartY + 45)
        .text(`${order.shippingAddress.city}, ${order.shippingAddress.state} ${order.shippingAddress.pincode}`, 300, customerStartY + 65);

    doc.moveDown(5);

    // Order items table with styled header
    const tableTop = doc.y;
    doc.rect(50, tableTop, 495, 30)
        .fillColor(colors.primary)
        .fill();

    // Table headers
    doc.fillColor('#FFFFFF')
        .fontSize(11)
        .text('Item', 60, tableTop + 10, { width: 180 })
        .text('Quantity', 250, tableTop + 10, { width: 60, align: 'center' })
        .text('Price', 350, tableTop + 10, { width: 80, align: 'right' })
        .text('Total', 450, tableTop + 10, { width: 80, align: 'right' });

    // Table rows with alternating background
    let currentY = tableTop + 40;
    order.items.forEach((item, index) => {
        if (index % 2 === 0) {
            doc.rect(50, currentY - 10, 495, 30)
                .fillColor(colors.accent)
                .fill();
        }

        doc.fillColor(colors.secondary)
            .fontSize(10)
            // Product name with proper width constraint
            .text(`${item.product.name} ${item.variant ? `(${item.variant.color})` : ''}`, 
                60, currentY, { width: 180, ellipsis: true })
            // Centered quantity
            .text(item.quantity.toString(), 
                250, currentY, { width: 60, align: 'center' })
            // Right-aligned price
            .text(`RS : ${item.price.toFixed(2)}`, 
                350, currentY, { width: 80, align: 'right' })
            // Right-aligned total
            .text(`RS : ${(item.price * item.quantity).toFixed(2)}`, 
                450, currentY, { width: 80, align: 'right' });

        currentY += 30;
    });

    // Summary section with styled box
    doc.rect(300, currentY + 20, 245, 120)
        .fillColor(colors.accent)
        .fill();

    currentY += 30;
    doc.fillColor(colors.secondary)
        .text('Subtotal:', 310, currentY)
        .text(`RS : ${(order.totalAmount - (order.shippingCost || 0) - (order.tax || 0)).toFixed(2)}`, 450, currentY);

    if (order.shippingCost) {
        currentY += 20;
        doc.text('Shipping:', 310, currentY)
            .text(`RS : ${order.shippingCost.toFixed(2)}`, 450, currentY);
    }

    if (order.tax) {
        currentY += 20;
        doc.text('Tax:', 310, currentY)
            .text(`RS : ${order.tax.toFixed(2)}`, 450, currentY);
    }

    currentY += 20;
    doc.fontSize(14)
        .fillColor(colors.primary)
        .text('Total:', 310, currentY)
        .text(`RS : ${order.totalAmount.toFixed(2)}`, 450, currentY);

    // Payment details section
    doc.moveDown(2);
    const paymentDetailsY = doc.y;
    
    // Create a styled box for payment details
    doc.rect(50, paymentDetailsY, 495, 120)
        .fillColor(colors.accent)
        .fill();

    // Payment Details Header
    doc.fontSize(14)
        .fillColor(colors.primary)
        .text('Payment Details', 60, paymentDetailsY + 10);

    // Payment information with better alignment
    doc.fontSize(12)
        .fillColor(colors.secondary);

    const detailsStartX = 60;
    const valueStartX = 200;
    let detailsY = paymentDetailsY + 40;

    // Helper function for aligned payment details
    const addPaymentDetail = (label, value) => {
        doc.text(label, detailsStartX, detailsY);
        doc.text(value, valueStartX, detailsY);
        detailsY += 20;
    };

    // Add payment details with consistent spacing
    addPaymentDetail('Payment Method:', order.paymentMethod.toUpperCase());
    addPaymentDetail('Payment Status:', order.paymentStatus.toUpperCase());
    addPaymentDetail('Order Status:', order.status.toUpperCase());

    // Footer with styled box
    const footerY = doc.page.height - 100;
    doc.rect(50, footerY, 495, 60)
        .fillColor(colors.accent)
        .fill();

    doc.fillColor(colors.secondary)
        .fontSize(10)
        .text('Thank you for shopping with Fabrico!', 50, footerY + 15, { align: 'center' })
        .text('This is a computer-generated invoice and does not require a signature.', 50, footerY + 35, { align: 'center' });

    doc.end();
});

export const submitReturnRequest = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { itemId } = req.params;
    const { reason } = req.body;

    const order = await Order.findById(id);

    if (!order) {
        res.status(HTTP_STATUS.NOT_FOUND);
        throw new Error('Order not found');
    }

    // Check if user owns the order
    if (order.user.toString() !== req.user._id.toString()) {
        res.status(HTTP_STATUS.FORBIDDEN);
        throw new Error('Not authorized to submit return request for this order');
    }

    // Check if order is delivered
    if (order.status !== 'delivered') {
        res.status(HTTP_STATUS.BAD_REQUEST);
        throw new Error('Return requests can only be submitted for delivered orders');
    }

    // Find the item in the order
    const item = order.items.find(item => item._id.toString() === itemId);

    if (!item) {
        res.status(404);
        throw new Error('Order item not found');
    }

    // Check if item already has a return request
    if (item.returnRequest && item.returnRequest.status !== 'none') {
        res.status(HTTP_STATUS.BAD_REQUEST);
        throw new Error('Return request already exists for this item');
    }

    // Create return request
    item.returnRequest = {
        status: 'requested',
        reason: reason,
        requestedAt: Date.now()
    };

    await order.save();

    // Populate the order with necessary data
    const updatedOrder = await Order.findById(order._id)
        .populate('user', 'name email')
        .populate('items.product', 'name price brand category')
        .populate('items.variant', 'name sku mainImage subImages color size')
        .populate('shippingAddress');

    res.json(updatedOrder);
});
