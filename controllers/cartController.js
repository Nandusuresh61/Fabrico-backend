import asyncHandler from '../middlewares/asyncHandler.js';
import Cart from '../models/cartModel.js';
import Variant from '../models/varientModel.js';
import Product from '../models/productModel.js';
import Category from '../models/categoryModel.js';


const getCart = asyncHandler(async (req, res) => {
    let cart = await Cart.findOne({ user: req.user._id })
        .populate({
            path: 'items.product',
            select: 'name brand category status',
            populate: [
                { path: 'brand', select: 'name' },
                { path: 'category', select: 'name status' }
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

    // Filter blcocked/ unavailabl e items
    cart.items = cart.items.filter(
        item => item.product.status === 'active' && !item.variant.isBlocked &&
               item.product.category.status !== 'blocked'
    );

    // Recalculate total
    cart.totalAmount = cart.items.reduce(
        (total,item) => {
            const price = item.variant.discountPrice || item.variant.price;
            return total + (price * item.quantity);
        },0);

    await cart.save();

    res.json(cart);
});


const addToCart = asyncHandler(async (req, res) => {
    const { productId, variantId, quantity = 1 } = req.body;

    //checking if exists and is active

    const product = await Product.findById(productId)
    .populate("category");
    if(!product){
        return res.status(404).json({ message : "Product not found"});
    }

    if(product.status !== 'active'){
        return res.status(400).json({ message : "This product is currently unavailable"});
    }

    //check the varient exist and is not blocked
    const variant = await Variant.findById(variantId);
    if(!variant || variant.isBlocked){
        return res.status(400).json({message : "This Product Variant is currently unavailable"});
    }


    let cart = await Cart.findOne({ user: req.user._id });

    if (!cart) {
        cart = await Cart.create({
            user: req.user._id,
            items: []
        });
    }

    // Get the variant to check stock
    // const variant = await Variant.findById(variantId);
    // if (!variant) {
    //     return res.status(404).json({ message: 'Variant not found' });
    // }

    // Check if item exists in cart
    const itemExists = cart.items.find(
        item => item.product.toString() === productId && 
               item.variant.toString() === variantId
    );

    // Calculate total quantity after adding
    const newQuantity = itemExists ? itemExists.quantity + quantity : quantity;

    // Check if new quantity exceeds stock
    if (newQuantity > variant.stock) {
        return res.status(400).json({ 
            message: `Cannot add ${quantity} more items. Only ${variant.stock - (itemExists ? itemExists.quantity : 0)} items available in stock.` 
        });
    }

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
            select: 'name brand category status',
            populate: [
                { path: 'brand', select: 'name' },
                { path: 'category', select: 'name status' }
            ]
        })
        .populate({
            path: 'items.variant',
            select: 'color price discountPrice mainImage stock'
        });

    // Recalculate total
    cart.totalAmount = cart.items.reduce((total, item) => {
        const price = item.variant.discountPrice || item.variant.price;
        return total + (price * item.quantity);
    }, 0);

    await cart.save();

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
