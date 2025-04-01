import asyncHandler from '../middlewares/asyncHandler.js';
import Cart from '../models/cartModel.js';


const getCart = asyncHandler(async (req, res) => {
    let cart = await Cart.findOne({ user: req.user._id })
        .populate({
            path: 'items.product',
            select: 'name brand category',
            populate: [
                { path: 'brand', select: 'name' },
                { path: 'category', select: 'name' }
            ]
        })
        .populate({
            path: 'items.variant',
            select: 'color price discountPrice mainImage stock'
        });

    if (!cart) {
        cart = await Cart.create({
            user: req.user._id,
            items: []
        });
    }

    res.json(cart);
});


const addToCart = asyncHandler(async (req, res) => {
    const { productId, variantId, quantity = 1 } = req.body;

    let cart = await Cart.findOne({ user: req.user._id });

    if (!cart) {
        cart = await Cart.create({
            user: req.user._id,
            items: []
        });
    }

    
    const itemExists = cart.items.find(
        item => item.product.toString() === productId && 
               item.variant.toString() === variantId
    );

    if (itemExists) {
        itemExists.quantity += quantity;
        await cart.save();
    } else {
        cart.items.push({
            product: productId,
            variant: variantId,
            quantity
        });
        await cart.save();
    }

    
    cart = await Cart.findOne({ user: req.user._id })
        .populate({
            path: 'items.product',
            select: 'name brand category',
            populate: [
                { path: 'brand', select: 'name' },
                { path: 'category', select: 'name' }
            ]
        })
        .populate({
            path: 'items.variant',
            select: 'color price discountPrice mainImage stock'
        });

    res.status(201).json(cart);
});


const removeFromCart = asyncHandler(async (req, res) => {
    const { itemId } = req.params;
    
    let cart = await Cart.findOne({ user: req.user._id });

    if (!cart) {
        return res.status(404).json({ message: 'Cart not found' });
    }

    cart.items = cart.items.filter(
        item => item._id.toString() !== itemId
    );

    await cart.save();

    
    cart = await Cart.findOne({ user: req.user._id })
        .populate({
            path: 'items.product',
            select: 'name brand category',
            populate: [
                { path: 'brand', select: 'name' },
                { path: 'category', select: 'name' }
            ]
        })
        .populate({
            path: 'items.variant',
            select: 'color price discountPrice mainImage stock'
        });

    res.json(cart);
});


const updateCartQuantity = asyncHandler(async (req, res) => {
    const { itemId } = req.params;
    const { quantity } = req.body;

    let cart = await Cart.findOne({ user: req.user._id });

    if (!cart) {
        return res.status(404).json({ message: 'Cart not found' });
    }

    const cartItem = cart.items.find(item => item._id.toString() === itemId);
    
    if (!cartItem) {
        return res.status(404).json({ message: 'Item not found in cart' });
    }

    if (quantity < 1) {
        return res.status(400).json({ message: 'Quantity must be at least 1' });
    }

    cartItem.quantity = quantity;
    await cart.save();

    
    cart = await Cart.findOne({ user: req.user._id })
        .populate({
            path: 'items.product',
            select: 'name brand category',
            populate: [
                { path: 'brand', select: 'name' },
                { path: 'category', select: 'name' }
            ]
        })
        .populate({
            path: 'items.variant',
            select: 'color price discountPrice mainImage stock'
        });

    res.json(cart);
});


const clearCart = asyncHandler(async (req, res) => {
    let cart = await Cart.findOne({ user: req.user._id });

    if (!cart) {
        return res.status(404).json({ message: 'Cart not found' });
    }

    cart.items = [];
    await cart.save();

    res.json(cart);
});

export { getCart, addToCart, removeFromCart, updateCartQuantity, clearCart };
