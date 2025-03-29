import asyncHandler from '../middlewares/asyncHandler.js';
import Wishlist from '../models/wishlistModel.js';

// @desc    Get user's wishlist
// @route   GET /api/wishlist
// @access  Private
const getWishlist = asyncHandler(async (req, res) => {
    let wishlist = await Wishlist.findOne({ user: req.user._id })
        .populate({
            path: 'items.product',
            select: 'name brand category'
        })
        .populate({
            path: 'items.variant',
            select: 'color price discountPrice mainImage stock'
        });

    if (!wishlist) {
        wishlist = await Wishlist.create({
            user: req.user._id,
            items: []
        });
    }

    res.json(wishlist);
});

// @desc    Add item to wishlist
// @route   POST /api/wishlist
// @access  Private
const addToWishlist = asyncHandler(async (req, res) => {
    const { productId, variantId } = req.body;

    let wishlist = await Wishlist.findOne({ user: req.user._id });

    if (!wishlist) {
        wishlist = await Wishlist.create({
            user: req.user._id,
            items: []
        });
    }

    // Check if item already exists
    const itemExists = wishlist.items.find(
        item => item.product.toString() === productId && item.variant.toString() === variantId
    );

    if (itemExists) {
        return res.status(400).json({ message: 'Item already in wishlist' });
    }

    wishlist.items.push({
        product: productId,
        variant: variantId
    });

    await wishlist.save();

    // Populate the wishlist before sending response
    wishlist = await Wishlist.findOne({ user: req.user._id })
        .populate({
            path: 'items.product',
            select: 'name brand category'
        })
        .populate({
            path: 'items.variant',
            select: 'color price discountPrice mainImage stock'
        });

    res.status(201).json(wishlist);
});

// @desc    Remove item from wishlist
// @route   DELETE /api/wishlist/:itemId
// @access  Private
const removeFromWishlist = asyncHandler(async (req, res) => {
    let wishlist = await Wishlist.findOne({ user: req.user._id });

    if (!wishlist) {
        return res.status(404).json({ message: 'Wishlist not found' });
    }

    wishlist.items = wishlist.items.filter(
        item => item._id.toString() !== req.params.itemId
    );

    await wishlist.save();

    // Populate the wishlist before sending response
    wishlist = await Wishlist.findOne({ user: req.user._id })
        .populate({
            path: 'items.product',
            select: 'name brand category'
        })
        .populate({
            path: 'items.variant',
            select: 'color price discountPrice mainImage stock'
        });

    res.json(wishlist);
});

export { getWishlist, addToWishlist, removeFromWishlist };

