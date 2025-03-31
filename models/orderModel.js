import mongoose from "mongoose";

const orderSchema = new mongoose.Schema({
    orderId: {
        type: String,
        required: true,
        unique: true,
        match: /^ORD-\d{5}$/,  // Validates format: ORD-XXXXX (where X is a digit)
    },
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    items: [{
        product: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Product",
            required: true
        },
        variant: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Variant",
            required: true
        },
        quantity: {
            type: Number,
            required: true,
            min: 1
        },
        price: {
            type: Number,
            required: true
        },
        returnRequest: {
            status: {
                type: String,
                enum: ['none', 'requested', 'approved', 'rejected'],
                default: 'none'
            },
            reason: {
                type: String
            },
            requestedAt: {
                type: Date
            },
            processedAt: {
                type: Date
            }
        }
    }],
    shippingAddress: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Address",
        required: true
    },
    totalAmount: {
        type: Number,
        required: true
    },
    status: {
        type: String,
        enum: ['pending', 'shipped', 'out for delivery', 'delivered', 'cancelled'],
        default: 'pending'
    },
    paymentMethod: {
        type: String,
        enum: ['cod', 'online', 'wallet'],
        required: true
    },
    paymentStatus: {
        type: String,
        enum: ['pending', 'completed', 'failed', 'refunded'],
        default: 'pending'
    },
    orderNotes: {
        type: String
    },
    invoice: {
        number: {
            type: String
        },
        url: {
            type: String
        }
    }
}, {
    timestamps: true
});

// Create index for orderId to ensure uniqueness
orderSchema.index({ orderId: 1 }, { unique: true });

// Create indexes for common search and filter operations
orderSchema.index({ status: 1 });
orderSchema.index({ createdAt: -1 });
orderSchema.index({ user: 1 });
orderSchema.index({ 'items.returnRequest.status': 1 });

const Order = mongoose.model("Order", orderSchema);

export default Order;
