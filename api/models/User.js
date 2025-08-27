import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true
    },
    username: {
        type: String,
        required: true
    },
    hashedPassword: {
        type: String,
        required: true
    },
    verified: {
        type: Boolean,
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    verificationData: {
        token: {
            type: String
        },
        expiration: {
            type: Date
        },
    },
    resetPasswordData: {
        token: {
            type: String
        },
        expiration: {
            type: Date
        },
    }
});

const User = mongoose.model("User", userSchema, "users");

export default User;