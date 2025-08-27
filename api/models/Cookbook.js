import mongoose from "mongoose";

const cookbookSchema = new mongoose.Schema({
    userId: {
        type: mongoose.ObjectId,
        required: true
    },
    recipes: {
        default: [],
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
    publicShared: {
        type: Boolean,
        default: false
    }
});

const Cookbook = mongoose.model("Cookbook", cookbookSchema, "personalCookbooks");

export default Cookbook;