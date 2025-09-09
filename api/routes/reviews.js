//node & express
import express from "express";

//database
import { createObjectId, isValidObjectId } from '../utils/objectId.js';

import Review from '../models/Review.js';
import Recipe from '../models/Recipe.js';

//middlewares
import { authenticateUser, authenticateUserOptionally } from '../middlewares/authMiddleware.js';

const router = express.Router({ mergeParams: true });

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
 *         description: Bearer access token (Bearer <access_token>)
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
 *               notes:
 *                 type: string
 *                 example: "Ottima ricetta!"
 *     responses:
 *       201:
 *         description: Review added to recipe
 *       400:
 *         description: Missing or invalid parameters
 *       403:
 *         description: Unauthorized
 *       404:
 *         description: Recipe not found
 *       409:
 *         description: You have already left a review for this recipe
 *       500:
 *         description: Internal server error
 */
router.post('/', authenticateUser, async (req, res) =>
{
    const mealDbId = parseInt(req.params.mealDbId);
    const userObjectId = req.userObjectId;

    const { difficultyEvaluation, tasteEvaluation, executionDate, notes } = req.body;

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


    const parsedExecutionDate = new Date(executionDate);

    if (isNaN(parsedExecutionDate.getTime()))
        return res.status(400).json({ message: 'Invalid date format for executionDate. Please use YYYY-MM-DD.' });

    try
    {
        //verifica se l'id è valido e appartenente agli id di TheMealDB        
        const existingMealDbRecipe = await Recipe.findOne({ mealDbId: mealDbId });

        if (!existingMealDbRecipe)
            return res.status(404).json({ message: 'Recipe with the provided mealDbId does not exist in the MealDB database.' });

        //verifica se l'utente ha già recensito questa ricetta
        const existingReview = await Review.findOne({
            mealDbId: mealDbId,
            authorUserId: userObjectId
        });

        if (existingReview)
            return res.status(409).json({ message: 'You have already left a review for this recipe.' });

        const newReview = new Review({
            mealDbId: mealDbId,
            authorUserId: userObjectId,
            difficultyEvaluation: difficultyEvaluationNum,
            tasteEvaluation: tasteEvaluationNum,
            executionDate: executionDate,
            notes: !notes ? "" : notes
        });


        try
        {
            await newReview.save();
        } catch (error)
        {
            console.error('Failed to insert review:', error);
            return res.status(500).json({ message: 'Failed to add review to recipe.' });
        }

        res.status(201).json({ message: 'Review added to recipe.', reviewId: newReview._id });

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
 *         description: Paginated reviews, total count, and statistics
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 reviews:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       reviewId:
 *                         type: string
 *                       mealDbId:
 *                         type: integer
 *                       authorUsername:
 *                         type: string
 *                       authorUserId:
 *                         type: string
 *                       difficulty:
 *                         type: integer
 *                       taste:
 *                         type: integer
 *                       notes:
 *                         type: string
 *                       executionDate:
 *                         type: string
 *                         format: date
 *                 total:
 *                   type: integer
 *                 statistics:
 *                   type: object
 *                   properties:
 *                     avgDifficulty:
 *                       type: number
 *                     avgTaste:
 *                       type: number
 *       400:
 *         description: Invalid or missing parameters
 *       404:
 *         description: Recipe not found
 *       500:
 *         description: Internal server error
 */
router.get('/', authenticateUserOptionally, async (req, res) =>
{
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

    //recupera l'userId autenticato se presente (quindi solo se autenticato)
    let userObjectId = null;
    if (req.userObjectId)
        userObjectId = req.userObjectId;

    try
    {
        //verifica che la ricetta esista tra le ricette di TheMealDB       
        const existingMealDbRecipe = await Recipe.findOne({ mealDbId });

        if (!existingMealDbRecipe)
            return res.status(404).json({ message: 'Recipe with the provided mealDbId does not exist.' });

        //TODO - capire bene
        const pipeline = [
            { $match: { mealDbId: mealDbId } },
            {
                $facet: {
                    //pipeline per ottenere le recensioni paginate e ordinate
                    reviews: [
                        ...(userObjectId ? [
                            {
                                $addFields: {
                                    isMine: { $cond: [{ $eq: ["$authorUserId", userObjectId] }, 1, 0] }
                                }
                            },
                            { $sort: { isMine: -1, executionDate: -1 } }
                        ] : [
                            { $sort: { executionDate: -1 } }
                        ]),
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
                        { $unwind: '$author' },
                        {
                            $project: {
                                _id: 1,
                                mealDbId: 1,
                                authorUserId: 1,
                                difficultyEvaluation: 1,
                                tasteEvaluation: 1,
                                executionDate: 1,
                                notes: 1,
                                username: '$author.username'
                            }
                        }
                    ],
                    //pipeline per calcolare le statistiche aggregate
                    statistics: [
                        {
                            $group: {
                                _id: null,
                                avgDifficulty: { $avg: "$difficultyEvaluation" },
                                avgTaste: { $avg: "$tasteEvaluation" }
                            }
                        }
                    ],
                    //pipeline per contare il totale dei documenti (alternativa a countDocuments)
                    totalCount: [
                        {
                            $count: "count"
                        }
                    ]
                }
            }
        ];

        const result = await Review.aggregate(pipeline);

        //controlla che result[0] esista
        const reviewsResult = result[0]?.reviews || [];
        const statsAgg = result[0]?.statistics || [];
        const total = (result[0]?.totalCount?.[0]?.count) || 0;

        const reviews = reviewsResult.map(review =>
        {
            return {
                reviewId: review._id,
                mealDbId: review.mealDbId,
                authorUsername: review.username,
                authorUserId: review.authorUserId,
                difficulty: review.difficultyEvaluation,
                taste: review.tasteEvaluation,
                notes: review.notes,
                executionDate: review.executionDate
            };
        });

        const statistics = statsAgg.length > 0
            ? {
                avgDifficulty: statsAgg[0].avgDifficulty ?? null,
                avgTaste: statsAgg[0].avgTaste ?? null
            }
            : { avgDifficulty: null, avgTaste: null };

        res.status(200).json({
            reviews,
            total,
            statistics
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
 *         description: Bearer access token (Bearer <access_token>)
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
router.delete('/:reviewId', authenticateUser, async (req, res) =>
{
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

    if (typeof reviewIdFromParams === 'string' && isValidObjectId(reviewIdFromParams))
        objectReviewId = createObjectId(reviewIdFromParams);
    else
    {
        console.error(`reviewId is not a valid ObjectId string: ${reviewIdFromParams}`);
        return res.status(400).json({ message: 'Invalid Review ID.' });
    }

    try
    {
        //verifica che la ricetta esista tra le ricette di TheMealDB
        const existingMealDbRecipe = await Recipe.findOne({ mealDbId });
        if (!existingMealDbRecipe)
            return res.status(404).json({ message: 'Recipe with the provided mealDbId does not exist.' });

        //verifica che la recensione esista tra le ricette di TheMealDB
        const existingReview = await Review.findOne({ _id: objectReviewId });
        if (!existingReview)
            return res.status(404).json({ message: 'Review with the provided reviewId does not exist.' });

        //verifica che la recensione sia stata scritta dall'utente autenticato
        if (!existingReview.authorUserId.equals(userObjectId))
            return res.status(403).json({ message: 'You are not authorized to delete this review.' });

        const deleteReviewResult = await Review.deleteOne({ _id: objectReviewId });

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

export default router;
