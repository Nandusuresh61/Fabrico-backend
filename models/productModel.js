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
    discount: {
        type: Number,
        required: true,
    },
    category: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Category',
        required: true
    },
    brand: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Brand',
        required: true
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
        enum: ['active', 'blocked'],
        default: 'active'
    },
}, { timestamps: true }
);


const Product = mongoose.model('Product', productSchema);
export default Product;