import asyncHandler from '../middlewares/asyncHandler.js';
import Order from '../models/orderModel.js';
import User from '../models/userModel.js';
import Payment from '../models/paymentModel.js';
import PDFDocument from 'pdfkit';
import Wallet from '../models/walletModel.js';
import Address from '../models/addressModel.js';
import { HTTP_STATUS } from '../utils/httpStatus.js';


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
    } = req.body;

    if (!items || items.length === 0) {
        res.status(HTTP_STATUS.BAD_REQUEST);
        throw new Error('No order items');
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
            description: `Refund for Order ${order.orderId} - ${item.product.name}`,
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
    if (order.paymentMethod === 'online' && order.paymentStatus === 'completed') {
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
        .populate('items.product', 'name price brand category')
        .populate('items.variant', 'name sku mainImage subImages color size')
        .populate('shippingAddress');

    if (!order) {
        res.status(HTTP_STATUS.NOT_FOUND);
        throw new Error('Order not found');
    }

   
    const doc = new PDFDocument();
    
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=invoice-${order.orderId}.pdf`);
    
    
    doc.pipe(res);

    
    doc.fontSize(20).text('FABRICO', { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).text('123 Fashion Street', { align: 'center' });
    doc.text('Kannur, Kerala 670702', { align: 'center' });
    doc.text('Phone: +91 9645760466', { align: 'center' });
    doc.text('Email: support@fabrico.com', { align: 'center' });
    doc.moveDown();

    // Add invoice details
    doc.fontSize(16).text('INVOICE', { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).text(`Invoice Number: ${order.orderId}`, { align: 'right' });
    doc.text(`Date: ${new Date(order.createdAt).toLocaleDateString()}`, { align: 'right' });
    doc.moveDown();

    // Add customer details
    doc.fontSize(14).text('Customer Details', { underline: true });
    doc.fontSize(12).text(`Name: ${order.user.username}`);
    doc.text(`Email: ${order.user.email}`);
    doc.text(`Phone: ${order.shippingAddress.phone}`);
    doc.moveDown();

    // Add shipping address
    doc.fontSize(14).text('Shipping Address', { underline: true });
    doc.fontSize(12).text(order.shippingAddress.name);
    doc.text(order.shippingAddress.street);
    doc.text(`${order.shippingAddress.city}, ${order.shippingAddress.state} ${order.shippingAddress.pincode}`);
    doc.moveDown();

    // Add order items
    doc.fontSize(14).text('Order Items', { underline: true });
    doc.moveDown();

    // Table header
    const startX = 50;
    let currentY = doc.y;
    doc.text('Item', startX, currentY);
    doc.text('Quantity', startX + 200, currentY);
    doc.text('Price', startX + 300, currentY);
    doc.text('Total', startX + 400, currentY);
    doc.moveDown();

    // Add items
    order.items.forEach(item => {
        currentY = doc.y;
        doc.text(item.product.name, startX, currentY);
        if (item.variant) {
            doc.fontSize(10).text(`Variant: ${item.variant.name}`, startX, currentY + 15);
        }
        doc.fontSize(12).text(item.quantity.toString(), startX + 200, currentY);
        doc.text(`₹${item.price.toFixed(2)}`, startX + 300, currentY);
        doc.text(`₹${(item.price * item.quantity).toFixed(2)}`, startX + 400, currentY);
        doc.moveDown();
    });

    // Add order summary
    doc.moveDown();
    currentY = doc.y;
    doc.text('Subtotal:', startX + 300, currentY);
    doc.text(`₹${(order.totalAmount - (order.shippingCost || 0) - (order.tax || 0)).toFixed(2)}`, startX + 400, currentY);
    
    if (order.shippingCost) {
        currentY = doc.y;
        doc.text('Shipping:', startX + 300, currentY);
        doc.text(`₹${order.shippingCost.toFixed(2)}`, startX + 400, currentY);
    }
    
    if (order.tax) {
        currentY = doc.y;
        doc.text('Tax:', startX + 300, currentY);
        doc.text(`₹${order.tax.toFixed(2)}`, startX + 400, currentY);
    }
    
    if (order.discount) {
        currentY = doc.y;
        doc.text('Discount:', startX + 300, currentY);
        doc.text(`-₹${order.discount.toFixed(2)}`, startX + 400, currentY);
    }
    
    currentY = doc.y;
    doc.fontSize(14).text('Total:', startX + 300, currentY);
    doc.text(`₹${order.totalAmount.toFixed(2)}`, startX + 400, currentY);

    // Add payment details
    doc.moveDown(2);
    doc.fontSize(14).text('Payment Details', { underline: true });
    doc.fontSize(12).text(`Payment Method: ${order.paymentMethod}`);
    doc.text(`Payment Status: ${order.paymentStatus}`);
    doc.text(`Order Status: ${order.status}`);

    // Add footer
    doc.moveDown(2);
    doc.fontSize(10).text('Thank you for shopping with Fabrico!', { align: 'center' });
    doc.text('This is a computer-generated invoice and does not require a signature.', { align: 'center' });

    // Finalize the PDF
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
