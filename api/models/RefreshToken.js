import mongoose from "mongoose";

const refreshTokenSchema = new mongoose.Schema({
    userId: {
        type: mongoose.ObjectId,
        required: true
    },
    token: {
        type: String,
        required: true
    },
    expiresAt: {
        type: Date,
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const RefreshToken = mongoose.model("RefreshToken", refreshTokenSchema, "refreshTokens");

export default RefreshToken;