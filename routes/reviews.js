const express = require("express");
const router = express.Router({ mergeParams: true }); //per ottenere anche il parametro dell'URL "userId"
const { getDb } = require("../db/db.js");
const authenticateToken = require('../middleware/authMiddleware.js');
const { ObjectId } = require('mongodb');

router.post('/', authenticateToken, async (req, res) =>
{
    const db = getDb();
    const mealDbId = parseInt(req.params.mealDbId);
    const userObjectId = req.userObjectId;

    const { difficultyEvaluation, tasteEvaluation, executionDate } = req.body;

    const difficultyEvaluationNum = parseInt(difficultyEvaluation);
    const tasteEvaluationNum = parseInt(tasteEvaluation);

    if (!mealDbId)
        return res.status(400).json({ message: 'mealDbId is required.' });

    if (!difficultyEvaluation || !tasteEvaluation || !executionDate)
        return res.status(400).json({ message: 'difficultyEvaluation, tasteEvaluation and executionDate are required.' });

    if (isNaN(difficultyEvaluationNum) || isNaN(tasteEvaluationNum))
        return res.status(400).json({ message: 'Difficulty and taste evaluations must be numbers.' });

    if (difficultyEvaluationNum < 1 || difficultyEvaluationNum > 5 || tasteEvaluationNum < 1 || tasteEvaluationNum > 5)
        return res.status(400).json({ message: 'Difficulty and taste evaluations must be between 1 and 5.' });

    if (difficultyEvaluation < 1 || difficultyEvaluation > 5 || tasteEvaluation < 1 || tasteEvaluation > 5)
        return res.status(400).json({ message: 'Difficulty and taste evaluations must be between 1 and 5.' });

    const parsedExecutionDate = new Date(executionDate);

    if (isNaN(parsedExecutionDate.getTime()))
        return res.status(400).json({ message: 'Invalid date format for executionDate. Please use YYYY-MM-DD.' });


    try
    {
        //verifica se l'id è valido e appartenente agli id di TheMealDB        
        const existingMealDbRecipe = await db.collection('mealdbRecipes').findOne({ mealDbId: mealDbId });

        if (!existingMealDbRecipe)
            return res.status(404).json({ message: 'Recipe with the provided mealDbId does not exist in the MealDB database.' });

        const newReviewDocument = {
            mealDbId: mealDbId,
            authorUserId: userObjectId,
            difficultyEvaluation: difficultyEvaluation,
            tasteEvaluation: tasteEvaluation,
            executionDate: executionDate
        };

        const result = await db.collection('reviews').insertOne(newReviewDocument);

        if (!result.acknowledged)
        {
            console.error('Failed to acknowledge review insertion.');
            return res.status(500).json({ message: 'Failed to add review to recipe.' });
        }

        res.status(201).json({ message: 'Review added to recipe.', reviewId: result.insertedId });

    } catch (error)
    {
        console.error('Error adding review to recipe:', error);
        res.status(500).json({ message: 'An internal server error occurred while adding the review.' });
    }
});

router.get('/', async (req, res) =>
{
    const db = getDb();
    const mealDbIdFromParams = req.params.mealDbId;
    const mealDbId = parseInt(mealDbIdFromParams);

    let start = parseInt(req.query.start);
    let end = parseInt(req.query.end);

    //controlla che mealDbId sia un numero valido
    if (!mealDbIdFromParams || isNaN(mealDbId))
        return res.status(400).json({ message: 'A valid mealDbId is required in the URL path.' });


    //validazione dei parametri di limit
    //se nessun parametro viene specificato vengono impostati start e end rispettivamente a 0 e 10
    if (isNaN(start) || start < 0)
        start = 0;

    if (isNaN(end) || end <= 0)
        end = 10;

    try
    {
        //verifica che la ricetta esista tra le ricette di TheMealDB       
        const existingMealDbRecipe = await db.collection('mealdbRecipes').findOne({ mealDbId: mealDbId });

        if (!existingMealDbRecipe)
            return res.status(404).json({ message: 'Recipe with the provided mealDbId does not exist.' });

        //.sort per ordinare, in questo caso discendente per data di esecuzione
        const reviewsCursor = db.collection('reviews')
            .find({ mealDbId: mealDbId })
            .sort({ executionDate: -1 })
            .skip(start)
            .limit(end);

        const reviewsResult = await reviewsCursor.toArray();

        const reviews = reviewsResult.map(review =>
        {
            return {
                reviewId: review._id,
                mealDbId: review.mealDbId,
                authorUserId: review.authorUserId,
                difficulty: review.difficultyEvaluation,
                taste: review.tasteEvaluation,
                executionDate: review.executionDate,
            };
        });

        res.status(200).json({ reviews: reviews });

    } catch (error)
    {
        console.error(`Error retrieving reviews for mealDbId ${mealDbId}:`, error);
        res.status(500).json({ message: 'An internal server error occurred while retrieving reviews.' });
    }
});

router.delete('/:reviewId', authenticateToken, async (req, res) =>
{
    const db = getDb();
    let objectReviewId;
    const userObjectId = req.userObjectId;
    const reviewIdFromParams = req.params.reviewId;
    const mealDbIdFromParams = req.params.mealDbId;
    const mealDbId = parseInt(mealDbIdFromParams);

    //controlla che mealDbId sia un numero valido
    if (!mealDbIdFromParams || isNaN(mealDbId))
        return res.status(400).json({ message: 'A valid mealDbId is required in the URL path.' });

    //controlla che reviewId sia un numero valido
    if (!reviewIdFromParams)
        return res.status(400).json({ message: 'A reviewId is required in the URL path.' });

    if (typeof reviewIdFromParams === 'string' && ObjectId.isValid(reviewIdFromParams))
        objectReviewId = new ObjectId(reviewIdFromParams);
    else
    {
        console.error(`reviewId is not a valid ObjectId string: ${reviewIdFromParams}`);
        return res.status(400).json({ message: 'Invalid Review ID.' });
    }

    try
    {
        //verifica che la ricetta esista tra le ricette di TheMealDB
        const existingMealDbRecipe = await db.collection('mealdbRecipes').findOne({ mealDbId: mealDbId });
        if (!existingMealDbRecipe)
            return res.status(404).json({ message: 'Recipe with the provided mealDbId does not exist.' });

        //verifica che la recensione esista tra le ricette di TheMealDB
        const existingReview = await db.collection('reviews').findOne({ _id: objectReviewId });
        if (!existingReview)
            return res.status(404).json({ message: 'Review with the provided reviewId does not exist.' });

        //verifica che la recensione sia stata scritta dall'utente autenticato
        if (!existingReview.authorUserId.equals(userObjectId))
            return res.status(403).json({ message: 'You are not authorized to delete this review.' });


        const deleteReviewResult = await db.collection('reviews').deleteOne({ _id: objectReviewId });

        if (deleteReviewResult.deletedCount === 0)
        {
            console.warn(`Review with ID ${objectReviewId} was found but not deleted.`);
            return res.status(500).json({ message: 'Review not found or already deleted.' });
        }

        console.log(`Review with ID: ${objectReviewId} deleted successfully.`);
        res.status(200).json({ message: 'Review removed.' });

    } catch (error)
    {
        console.error(`Error retrieving reviews for mealDbId ${mealDbId}:`, error);
        res.status(500).json({ message: 'An internal server error occurred while retrieving reviews.' });
    }
});

module.exports = router;
