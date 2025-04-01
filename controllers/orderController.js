import asyncHandler from '../middlewares/asyncHandler.js';
import Order from '../models/orderModel.js';
import User from '../models/userModel.js';
import PDFDocument from 'pdfkit';


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
        res.status(400);
        throw new Error('No order items');
    }

    
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

    
    const query = {};

   
    if (search) {
        query.$or = [
            { orderId: { $regex: search, $options: 'i' } },
            { 'user.name': { $regex: search, $options: 'i' } },
            { 'user.email': { $regex: search, $options: 'i' } }
        ];
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
        .populate('shippingAddress')
        .sort({ [sortBy]: sortOrder })
        .skip((page - 1) * limit)
        .limit(limit);

    
    console.log('Fetched orders with items:', JSON.stringify(orders, null, 2));

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
        .populate('items.variant', 'name sku mainImage subImages color size')
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

    
    const item = order.items.find(item => item._id.toString() === req.params.itemId);

    if (!item) {
        res.status(404);
        throw new Error('Order item not found');
    }

    if (!item.returnRequest || item.returnRequest.status !== 'requested') {
        res.status(400);
        throw new Error('No active return request found for this item');
    }

    
    item.returnRequest.status = status;
    item.returnRequest.processedAt = Date.now();

    
    if (status === 'approved') {
        const user = await User.findById(order.user);
        if (!user) {
            res.status(404);
            throw new Error('User not found');
        }

        
        const refundAmount = item.price * item.quantity;

        
        user.walletBalance = (user.walletBalance || 0) + refundAmount;
        await user.save();
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
    const sortBy = req.query.sortBy || 'createdAt';
    const sortOrder = req.query.sortOrder || 'desc';

    
    const query = { user: req.user._id };

   
    const total = await Order.countDocuments(query);

    
    const orders = await Order.find(query)
        .populate('items.product', 'name price brand category mainImage')
        .populate('items.variant', 'name sku mainImage subImages color size')
        .populate('shippingAddress')
        .sort({ [sortBy]: sortOrder })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean();  // Convert to plain JavaScript objects

    
    // console.log('Fetched orders:', JSON.stringify(orders, null, 2));

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
        res.status(404);
        throw new Error('Order not found');
    }

    
    if (order.user._id.toString() !== req.user._id.toString()) {
        res.status(403);
        throw new Error('Not authorized to cancel this order');
    }

    
    if (order.status !== 'pending' && order.status !== 'processing') {
        res.status(400);
        throw new Error('Order cannot be cancelled at this stage');
    }

    
    for (const item of order.items) {
        const variant = item.variant;
        if (variant) {
            variant.stock += item.quantity;
            await variant.save();
        }
    }

    
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
        res.status(404);
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
