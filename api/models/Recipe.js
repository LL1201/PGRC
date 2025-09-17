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
        type: String
    },
    tags: {
        type: [String],
        required: true
    },
    youtubeLink: {
        type: String
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
        type: String
    },
    imageSource: {
        type: String
    },
    creativeCommonsConfirmed: {
        type: String
    },
    dateModified: {
        type: Date
    }
});

recipeSchema.index({
    name: "text",
    "ingredients.ingredientName": "text"
});

recipeSchema.index({ mealDbId: 1 }, { unique: true });

const Recipe = mongoose.model("Recipe", recipeSchema, "mealdbRecipes");

export default Recipe;