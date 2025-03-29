import asyncHandler from '../middlewares/asyncHandler.js';
import Cart from '../models/cartModel.js';

// @desc    Get user's cart
// @route   GET /api/cart
// @access  Private
const getCart = asyncHandler(async (req, res) => {
    let cart = await Cart.findOne({ user: req.user._id })
        .populate({
            path: 'items.product',
            select: 'name brand category'
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

// @desc    Add to cart
// @route   POST /api/cart
// @access  Private
const addToCart = asyncHandler(async (req, res) => {
    const { productId, variantId, quantity = 1 } = req.body;

    let cart = await Cart.findOne({ user: req.user._id });

    if (!cart) {
        cart = await Cart.create({
            user: req.user._id,
            items: []
        });
    }

    // Check if product variant already exists
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

    // Populate cart before sending response
    cart = await Cart.findOne({ user: req.user._id })
        .populate({
            path: 'items.product',
            select: 'name brand category'
        })
        .populate({
            path: 'items.variant',
            select: 'color price discountPrice mainImage stock'
        });

    res.status(201).json(cart);
});

// @desc    Remove from cart
// @route   DELETE /api/cart/:itemId
// @access  Private
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

    // Populate cart before sending response
    cart = await Cart.findOne({ user: req.user._id })
        .populate({
            path: 'items.product',
            select: 'name brand category'
        })
        .populate({
            path: 'items.variant',
            select: 'color price discountPrice mainImage stock'
        });

    res.json(cart);
});

export { getCart, addToCart, removeFromCart };
