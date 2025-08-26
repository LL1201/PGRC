import mongoose from "mongoose";

const recipeSchema = new mongoose.Schema({
    mealDbId: {
        type: Number,
        required: true
    },
    name: {
        type: String,
        required: true
    },
    category: {
        type: String,
        required: true
    },
    area: {
        type: String,
        required: true
    },
    instructions: {
        type: String,
        required: true
    },
    mealThumb: {
        type: String,
        required: false
    },
    tags: {
        type: [String],
        required: true
    },
    youtubeLink: {
        type: String,
        required: false
    },
    ingredients: {
        type: [{
            _id: false,
            ingredientName: {
                type: String,
                required: true
            },
            measure: {
                type: String,
                required: false
            }
        }],
        required: true
    },
    source: {
        type: String,
        required: false
    },
    imageSource: {
        type: String,
        required: false
    },
    creativeCommonsConfirmed: {
        type: String,
        required: false
    },
    dateModified: {
        type: Date,
        required: false
    }
});

const Recipe = mongoose.model("Recipe", recipeSchema, "mealdbRecipes");

export default Recipe;