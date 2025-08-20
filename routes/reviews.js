const express = require("express");
const router = express.Router({ mergeParams: true }); //per ottenere anche il parametro dell'URL "userId"
const { getDb } = require("../db/db.js");
const authenticateToken = require('../middleware/authMiddleware.js');
const { ObjectId } = require('mongodb');

/**
 * @swagger
 * /api/v1/recipes/{mealDbId}/reviews:
 *   post:
 *     summary: Add a review to a recipe
 *     tags:
 *       - Reviews
 *     parameters:
 *       - in: path
 *         name: mealDbId
 *         required: true
 *         schema:
 *           type: integer
 *         description: TheMealDB recipe ID
 *       - in: header
 *         name: Authorization
 *         required: true
 *         schema:
 *           type: string
 *         description: Bearer access token (Bearer &lt;access_token&gt;)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               difficultyEvaluation:
 *                 type: integer
 *                 example: 4
 *               tasteEvaluation:
 *                 type: integer
 *                 example: 5
 *               executionDate:
 *                 type: string
 *                 format: date
 *                 example: "2024-06-01"
 *     responses:
 *       201:
 *         description: Review added to recipe
 *       400:
 *         description: Missing or invalid parameters
 *       403:
 *         description: Unauthorized
 *       404:
 *         description: Recipe not found
 *       500:
 *         description: Internal server error
 */
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

/**
 * @swagger
 * /api/v1/recipes/{mealDbId}/reviews:
 *   get:
 *     summary: Get paginated reviews for a recipe
 *     tags:
 *       - Reviews
 *     parameters:
 *       - in: path
 *         name: mealDbId
 *         required: true
 *         schema:
 *           type: integer
 *         description: TheMealDB recipe ID
 *       - in: query
 *         name: start
 *         schema:
 *           type: integer
 *         description: Start index for pagination (default 0)
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *         description: Number of reviews to return (default 10)
 *     responses:
 *       200:
 *         description: Paginated reviews and total count
 *       400:
 *         description: Invalid or missing parameters
 *       404:
 *         description: Recipe not found
 *       500:
 *         description: Internal server error
 */
router.get('/', async (req, res) =>
{
    const db = getDb();
    const mealDbIdFromParams = req.params.mealDbId;
    const mealDbId = parseInt(mealDbIdFromParams);

    let start = parseInt(req.query.start);
    let offset = parseInt(req.query.offset);

    //controlla che mealDbId sia un numero valido
    if (!mealDbIdFromParams || isNaN(mealDbId))
        return res.status(400).json({ message: 'A valid mealDbId is required in the URL path.' });


    //validazione dei parametri di limit
    //se nessun parametro viene specificato vengono impostati start e end rispettivamente a 0 e 10
    if (isNaN(start) || start < 0)
        start = 0;

    if (isNaN(offset) || offset <= 0)
        offset = 10;

    try
    {
        //verifica che la ricetta esista tra le ricette di TheMealDB       
        const existingMealDbRecipe = await db.collection('mealdbRecipes').findOne({ mealDbId: mealDbId });

        if (!existingMealDbRecipe)
            return res.status(404).json({ message: 'Recipe with the provided mealDbId does not exist.' });

        //.sort per ordinare, in questo caso discendente per data di esecuzione
        /*const reviewsResult = await db.collection('reviews')
            .find({ mealDbId: mealDbId })
            .sort({ executionDate: -1 })
            .skip(start)
            .limit(offset)
            .toArray();*/

        //TODO - vedere bene come funziona
        const reviewsResult = await db.collection('reviews').aggregate([
            { $match: { mealDbId: mealDbId } },
            { $sort: { executionDate: -1 } },
            { $skip: start },
            { $limit: offset },
            {
                $lookup: {
                    from: 'users',
                    localField: 'authorUserId',
                    foreignField: '_id',
                    as: 'author'
                }
            },
            {
                $unwind: '$author'
            },
            {
                $project: {
                    _id: 1,
                    mealDbId: 1,
                    authorUserId: 1,
                    difficultyEvaluation: 1,
                    tasteEvaluation: 1,
                    executionDate: 1,
                    username: '$author.username'
                }
            }
        ]).toArray();

        const total = await db.collection('reviews').countDocuments({ mealDbId: mealDbId });

        //const reviewsResult = await reviewsCursor.toArray();

        const reviews = reviewsResult.map(review =>
        {
            return {
                reviewId: review._id,
                mealDbId: review.mealDbId,
                authorUsername: review.username,
                difficulty: review.difficultyEvaluation,
                taste: review.tasteEvaluation,
                executionDate: review.executionDate
            };
        });

        res.status(200).json({
            reviews: reviews,
            total: total
        });

    } catch (error)
    {
        console.error(`Error retrieving reviews for mealDbId ${mealDbId}:`, error);
        res.status(500).json({ message: 'An internal server error occurred while retrieving reviews.' });
    }
});

/**
 * @swagger
 * /api/v1/recipes/{mealDbId}/reviews/{reviewId}:
 *   delete:
 *     summary: Delete a review from a recipe
 *     tags:
 *       - Reviews
 *     parameters:
 *       - in: path
 *         name: mealDbId
 *         required: true
 *         schema:
 *           type: integer
 *         description: TheMealDB recipe ID
 *       - in: path
 *         name: reviewId
 *         required: true
 *         schema:
 *           type: string
 *         description: Review ID (ObjectId)
 *       - in: header
 *         name: Authorization
 *         required: true
 *         schema:
 *           type: string
 *         description: Bearer access token (Bearer &lt;access_token&gt;)
 *     responses:
 *       200:
 *         description: Review removed
 *       400:
 *         description: Invalid parameters
 *       403:
 *         description: Unauthorized
 *       404:
 *         description: Recipe or review not found
 *       500:
 *         description: Internal server error
 */
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
