import axios from 'axios';
import { getDb } from "../db/db.js";

async function populateTheMealDbRecipes()
{
    const db = getDb();
    const recipesCollection = db.collection('mealdbRecipes');

    // Controlla se la collezione è già popolata
    const count = await recipesCollection.countDocuments();
    if (count > 0)
    {
        console.log("La collezione 'mealdbRecipes' è già popolata. Salto il dump iniziale.");
        return;
    }

    console.log("Starting TheMealDB recipes dump");

    const alphabet = 'abcdefghijklmnopqrstuvwxyz'.split('');
    const MEALDB_API_BASE_URL = 'https://www.themealdb.com/api/json/v1/1/';
    let totalRecipesSaved = 0;

    //for of per gestire correttamente await
    for (const letter of alphabet)
    {
        try
        {
            const response = await axios.get(`${MEALDB_API_BASE_URL}search.php?f=${letter}`);
            const { meals } = response.data;

            if (meals && meals.length > 0)
            {
                const recipesToInsert = [];
                meals.forEach((meal) =>
                {
                    const ingredients = [];
                    for (let i = 1; i <= 20; i++)
                    {
                        const ingredientName = meal[`strIngredient${i}`];
                        const measure = meal[`strMeasure${i}`];
                        if (ingredientName && ingredientName.trim() !== '')
                        {
                            ingredients.push({ ingredientName: ingredientName.trim(), measure: measure ? measure.trim() : '' });
                        }
                    }

                    recipesToInsert.push({
                        mealDbId: parseInt(meal.idMeal),
                        name: meal.strMeal,
                        category: meal.strCategory,
                        area: meal.strArea,
                        instructions: meal.strInstructions,
                        mealThumb: meal.strMealThumb,
                        tags: meal.strTags ? meal.strTags.split(',').map((tag) => tag.trim()) : [],
                        youtubeLink: meal.strYoutube,
                        ingredients: ingredients,
                        source: meal.strSource,
                        imageSource: meal.strImageSource,
                        creativeCommonsConfirmed: meal.strCreativeCommonsConfirmed,
                        dateModified: meal.dateModified
                    });
                });

                const insertResult = await recipesCollection.insertMany(recipesToInsert);
                totalRecipesSaved += insertResult.insertedCount;
            }
        } catch (error)
        {
            console.error(`Errore nel fetch/salvataggio delle ricette per la lettera ${letter}:`, error.message);
        }
    }

    console.log(`Dump of TheMealDB completed. Total number of recipes saved: ${totalRecipesSaved}`);
}

export default populateTheMealDbRecipes;