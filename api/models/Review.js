import mongoose from "mongoose";

const reviewSchema = new mongoose.Schema({
    mealDbId: {
        type: Number,
        required: true
    },
    authorUserId: {
        type: mongoose.ObjectId,
        required: true
    },
    difficultyEvaluation: {
        type: Number,
        min: 0,
        max: 5,
        required: true
    },
    tasteEvaluation: {
        type: Number,
        min: 0,
        max: 5,
        required: true
    },
    notes: {
        type: String,
        required: false
    },
    executionDate: {
        type: Date,
        required: true
    },
    reviewDate: {
        type: Date,
        default: Date.now
    }
});

const Review = mongoose.model("Review", reviewSchema, "reviews");

export default Review;