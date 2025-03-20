import mongoose from 'mongoose';

const brandSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true,
            unique: true,
        },
        status: {
            type: String,
            enum: ['Activated', 'Deactivated'],
            default: 'Activated',
        },
        createdAt: {
            type: Date,
            default: Date.now,
        },
    },
    
    { timestamps: true }
);

const Brand = mongoose.model('Brand', brandSchema);

export default Brand;
