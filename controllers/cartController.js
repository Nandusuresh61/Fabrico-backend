import asyncHandler from '../middlewares/asyncHandler.js';
import Cart from '../models/cartModel.js';

// @desc    Get user's cart
// @route   GET /api/cart
// @access  Private
const getCart = asyncHandler(async (req, res) => {
    let cart = await Cart.findOne({ user: req.user._id })
        .populate({
            path: 'products',
            populate: {
                path: 'variants',
                select: 'color price discountPrice mainImage stock'
            },
            select: 'name brand category variants'
        });

    if (!cart) {
        cart = await Cart.create({
            user: req.user._id,
            products: []
        });
    }

    res.json(cart);
});

// @desc    Add to cart
// @route   POST /api/cart
// @access  Private
const addToCart = asyncHandler(async (req, res) => {
    const { productId } = req.body;

    let cart = await Cart.findOne({ user: req.user._id });

    if (!cart) {
        cart = await Cart.create({
            user: req.user._id,
            products: []
        });
    }

    // Check if product already exists
    const productExists = cart.products.find(
        product => product.toString() === productId
    );

    if (productExists) {
        return res.status(400).json({ message: 'Product already in cart' });
    }

    cart.products.push(productId);
    await cart.save();

    // Populate cart before sending response
    cart = await Cart.findOne({ user: req.user._id })
        .populate({
            path: 'products',
            populate: {
                path: 'variants',
                select: 'color price discountPrice mainImage stock'
            },
            select: 'name brand category variants'
        });

    res.status(201).json(cart);
});

// @desc    Remove from cart
// @route   DELETE /api/cart/:productId
// @access  Private
const removeFromCart = asyncHandler(async (req, res) => {
    let cart = await Cart.findOne({ user: req.user._id });

    if (!cart) {
        return res.status(404).json({ message: 'Cart not found' });
    }

    cart.products = cart.products.filter(
        product => product.toString() !== req.params.productId
    );

    await cart.save();

    // Populate cart before sending response
    cart = await Cart.findOne({ user: req.user._id })
        .populate({
            path: 'products',
            populate: {
                path: 'variants',
                select: 'color price discountPrice mainImage stock'
            },
            select: 'name brand category variants'
        });

    res.json(cart);
});

export { getCart, addToCart, removeFromCart };
