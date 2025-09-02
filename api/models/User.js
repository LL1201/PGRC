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
        default: false
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    personalCookbook: {
        type: {
            recipes: {
                type: [{
                    mealDbId: {
                        type: Number,
                        required: true
                    },
                    addedAt: {
                        type: Date,
                        default: Date.now
                    },
                    privateNote: {
                        type: String,
                        default: ''
                    }
                }]
            },
            publicVisible: {
                type: Boolean
            }
        },
        default: {
            recipes: [],
            publicVisible: false
        }
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
    },
    deleteAccountData: {
        token: {
            type: String
        },
        expiration: {
            type: Date
        },
    },
    googleId: {
        type: String
    }
});

const User = mongoose.model("User", userSchema, "users");

export default User;