import mongoose from "mongoose";

const paymentSchema = new mongoose.Schema({
    paymentId: {
        type: String,
        required: true,
        unique: true,
        match: /^PAY-\d{5}$/,  // Validates format: PAY-XXXXX (where X is a digit)
    },
    order: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Order",
        required: true
    },
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    amount: {
        type: Number,
        required: true,
        min: 0
    },
    currency: {
        type: String,
        default: "INR",
        required: true
    },
    paymentMethod: {
        type: String,
        enum: ['cod', 'online', 'wallet'],
        required: true
    },
    paymentStatus: {
        type: String,
        enum: ['pending', 'completed', 'failed', 'refunded', 'partially_refunded'],
        default: 'pending'
    },
    paymentDetails: {
        transactionId: {
            type: String,
            sparse: true  // Allows null/undefined values
        },
        paymentGateway: {
            type: String,
            enum: ['razorpay', 'stripe', 'paypal', null],
            default: null
        },
        paymentMethodDetails: {
            type: mongoose.Schema.Types.Mixed,
            default: null
        }
    },
    refundDetails: {
        refundId: {
            type: String,
            sparse: true
        },
        amount: {
            type: Number,
            default: 0
        },
        reason: {
            type: String
        },
        status: {
            type: String,
            enum: ['pending', 'completed', 'failed'],
            default: 'pending'
        },
        processedAt: {
            type: Date
        }
    },
    metadata: {
        ipAddress: String,
        userAgent: String,
        deviceInfo: String
    },
    notes: {
        type: String
    }
}, {
    timestamps: true
});

// Create indexes for common search and filter operations
paymentSchema.index({ order: 1 });
paymentSchema.index({ user: 1 });
paymentSchema.index({ paymentStatus: 1 });
paymentSchema.index({ createdAt: -1 });

const Payment = mongoose.model("Payment", paymentSchema);

export default Payment;
