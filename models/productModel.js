import mongoose, { mongo, Schema } from 'mongoose';

const productSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true,
    },
    description: {
        type: String,
        required: true,
    },
    price: {
        type: Number,
        required: true,
    },
    category: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Category',
        required: true
    },
    brand: {
        type: String,
    },
    stock: {
        type: Number,
        required: true,
    },
    images: [{
        type: String,
        required: true
    }],
    status: {
        type: String,
        enum: ['active', 'inactive'],
        default: 'active'
    },
}, { timestamps: true }
);


const Product = mongoose.model('Product', productSchema);
export default Product;