import mongoose from 'mongoose';

const categorySchema = new mongoose.Schema(
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
    },
    { timestamps: true }
);

const Category = mongoose.model('Category', categorySchema);

export default Category;
