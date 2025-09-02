//node & express
import express from "express";

import dotenv from 'dotenv';

dotenv.config();

//database
import { createObjectId, isValidObjectId } from '../utils/objectId.js';

//middlewares
import { authenticateUser, authenticateUserOptionally } from '../middlewares/authMiddleware.js';

import User from '../models/User.js';
import Recipe from '../models/Recipe.js';

const BASE_URL = process.env.BASE_URL;

const router = express.Router({ mergeParams: true });

/**
 * @swagger
 * /api/v1/users/{userId}/cookbook:
 *   post:
 *     summary: Add a recipe to the user's personal cookbook
 *     tags:
 *       - Cookbook
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
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
 *               mealDbId:
 *                 type: integer
 *                 example: 52772
 *               privateNote:
 *                 type: string
 *                 example: "Ricetta preferita"
 *     responses:
 *       201:
 *         description: Recipe added to personal cookbook successfully
 *       400:
 *         description: mealDbId is required
 *       403:
 *         description: You can only add recipes to your own cookbook
 *       404:
 *         description: Recipe with the provided mealDbId does not exist in the MealDB database
 *       409:
 *         description: Recipe already exists in your personal cookbook
 *       500:
 *         description: Internal server error
 */
router.post('/recipes', authenticateUser, async (req, res) =>
{
    const { mealDbId, privateNote } = req.body;
    const userObjectId = req.userObjectId;
    const reqUserObjectId = req.reqUserObjectId;

    if (!userObjectId.equals(reqUserObjectId))
        return res.status(403).json({ message: 'You can only add recipes to your own cookbook.' });

    if (!mealDbId)
        return res.status(400).json({ message: 'mealDbId is required.' });

    try
    {
        //verifica se l'id è valido e appartenente agli id di TheMealDB   
        const existingMealDbRecipe = await Recipe.findOne({ mealDbId: mealDbId });

        if (!existingMealDbRecipe)
            return res.status(404).json({ message: 'Recipe with the provided mealDbId does not exist in the MealDB database.' });

        //verifica se la ricetta è già presente nel ricettario
        const user = await User.findOne({
            _id: reqUserObjectId,
            'personalCookbook.recipes.mealDbId': mealDbId
        });

        if (user)
            return res.status(409).json({ message: 'Recipe already exists in your personal cookbook.' });

        const newRecipe = {
            mealDbId: mealDbId
        };

        if (privateNote)
            newRecipe.privateNote = privateNote;

        const updateResult = await User.updateOne(
            { _id: userObjectId },
            { $push: { 'personalCookbook.recipes': newRecipe } }
        );

        if (updateResult.modifiedCount === 0)
            return res.status(500).json({ message: 'Failed to add recipe to cookbook.' });

        res.status(201).json({ message: 'Recipe added to personal cookbook successfully.' });

    } catch (error)
    {
        console.error('Error adding recipe to personal cookbook:', error);
        res.status(500).json({ message: 'An internal server error occurred while adding the recipe.' });
    }
});

/**
 * @swagger
 * /api/v1/users/{userId}/cookbook:
 *   get:
 *     summary: Get paginated recipes from the user's personal cookbook
 *     tags:
 *       - Cookbook
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *       - in: header
 *         name: Authorization
 *         required: true
 *         schema:
 *           type: string
 *         description: Bearer access token (Bearer &lt;access_token&gt;)
 *       - in: query
 *         name: start
 *         required: true
 *         schema:
 *           type: integer
 *         description: Start index for pagination (>= 0)
 *       - in: query
 *         name: offset
 *         required: true
 *         schema:
 *           type: integer
 *         description: End index for pagination (>= start, <= start+12)
 *     responses:
 *       200:
 *         description: Paginated recipes and total count
 *       400:
 *         description: Invalid or missing pagination parameters
 *       403:
 *         description: You can only view your own cookbook
 *       500:
 *         description: Internal server error
 */
router.get('/recipes', authenticateUserOptionally, async (req, res) =>
{
    let userObjectId = null;
    const reqUserObjectId = req.reqUserObjectId;

    if (req.userObjectId)
        userObjectId = req.userObjectId;

    const start = parseInt(req.query.start);
    const offset = parseInt(req.query.offset);

    if (req.query.start === undefined || req.query.offset === undefined)
        return res.status(400).json({ message: 'Both start and offset parameters are required.' });

    if (isNaN(start) || isNaN(offset))
        return res.status(400).json({ message: 'Start and offset parameters must be valid numbers.' });

    if (start < 0)
        return res.status(400).json({ message: 'Start parameter must be >= 0.' });

    if (offset < start || offset < 0)
        return res.status(400).json({ message: 'offset parameter must be >= start and >= 0.' });

    if (offset - start > 12)
        return res.status(400).json({ message: 'offset parameter must be <= start + 12.' });

    try
    {
        /* --------------- OLD METHOD -------------------------
        const personalCookbook = await db.collection('personalCookbooks').findOne({ userId: reqUserObjectId });

        if (!personalCookbook || personalCookbook.recipes.length === 0)
            return res.status(200).json({ recipes: [] });

        
        //per ogni elemento in personalCookbook ricava l'id e restituisce l'array di questi id
        //serve per la riga successiva che estrae le info di tutti i questi id
        const mealDbIds = personalCookbook.recipes.map((r) => r.mealDbId);

        const projection = {
            name: 1,
            category: 1,
            category: 1,
            mealThumb: 1,
            mealDbId: 1,
            area: 1,
            _id: 0
        };


        const detailedRecipes = await db.collection('mealdbRecipes')
            .find({ mealDbId: { $in: mealDbIds } })
            .project(projection)
            .skip(start)
            .limit(offset)
            .toArray();

        //ottimizzato... piuttosto che ottenere tutto e poi paginare        
        const total = await db.collection('mealdbRecipes').countDocuments({ mealDbId: { $in: mealDbIds } });

        //aggiunge le note alle ricette dettagliate
        const recipesWithNotes = detailedRecipes.map((detailedRecipe) =>
        {
            //per ogni ricetta dettagliata in detailedRecipes, viene cercata nel ricettario personale
            //confronta i due id per verificare che siano la stessa ricetta 
            //l'elemento che fa matchh è ritornato e conterrà la privateNote
            const cookbookEntry = personalCookbook.recipes.find((r) => r.mealDbId === detailedRecipe.mealDbId);
            return {
                cookBookRecipeId: cookbookEntry._id,
                ...detailedRecipe,
                //aggiunge la nota se presente
                //verifica con operatore ternario
                privateNote: cookbookEntry ? cookbookEntry.privateNote : undefined
            };
        });*/

        const grantedAccess = await User.findOne({ _id: reqUserObjectId, 'personalCookbook.publicVisible': true });

        if (!grantedAccess && (!userObjectId || !userObjectId.equals(reqUserObjectId)))
            return res.status(403).json({ message: 'Access denied.' });

        const result = await User.aggregate([
            {
                $match: {
                    _id: reqUserObjectId,
                    $or: [
                        //condizione 1: l'utente che fa la richiesta è il proprietario del ricettario
                        { _id: userObjectId },
                        //condizione 2: il ricettario è pubblico
                        { 'personalCookbook.publicVisible': true }
                    ]
                }
            },
            {
                $unwind: "$personalCookbook.recipes"
            },
            {
                $lookup: {
                    from: "mealdbRecipes",
                    localField: "personalCookbook.recipes.mealDbId",
                    foreignField: "mealDbId",
                    as: "recipeDetails"
                }
            },
            {
                $unwind: "$recipeDetails"
            },
            {
                $facet: {
                    pagination: [
                        { $skip: start },
                        { $limit: offset },
                        {
                            $project: {
                                _id: 0,
                                cookBookRecipeId: "$personalCookbook.recipes._id",
                                name: "$recipeDetails.name",
                                category: "$recipeDetails.category",
                                mealThumb: "$recipeDetails.mealThumb",
                                mealDbId: "$recipeDetails.mealDbId",
                                area: "$recipeDetails.area",
                                privateNote: "$personalCookbook.recipes.privateNote"
                            }
                        }
                    ],
                    total: [
                        {
                            $count: "count"
                        }
                    ]
                }
            }
        ]);

        //devo far così perché il risultato è nel formato 
        //[ { pagination: [ [Object], [Object] ], total: [ [Object] ] } ]
        //quindi un array, che in questo caso ha un solo elemento ([0])
        const recipesWithNotes = result[0].pagination;

        //formato di total: [ { count: 12 } ]
        //se il count è 0, total è un array vuoto, quindi devo controllare prima di assegnarlo
        const total = result[0].total.length > 0 ? result[0].total[0].count : 0;

        res.status(200).json({
            recipes: recipesWithNotes,
            total: total
        });

    } catch (error)
    {
        console.error('Error retrieving personal cookbook:', error);
        res.status(500).json({ message: 'An internal server error occurred while retrieving the cookbook.' });
    }
});

/**
 * @swagger
 * /api/v1/users/{userId}/cookbook/{cookbookRecipeId}:
 *   delete:
 *     summary: Remove a recipe from the user's personal cookbook
 *     tags:
 *       - Cookbook
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *       - in: path
 *         name: cookbookRecipeId
 *         required: true
 *         schema:
 *           type: string
 *         description: Cookbook recipe ID (ObjectId)
 *       - in: header
 *         name: Authorization
 *         required: true
 *         schema:
 *           type: string
 *         description: Bearer access token (Bearer &lt;access_token&gt;)
 *     responses:
 *       200:
 *         description: Recipe removed from personal cookbook successfully
 *       400:
 *         description: cookbookRecipeId is required or invalid
 *       403:
 *         description: You can only delete recipes from your own cookbook
 *       404:
 *         description: Recipe not found in your personal cookbook
 *       500:
 *         description: Internal server error
 */
router.delete('/recipes/:cookbookRecipeId', authenticateUser, async (req, res) =>
{
    const userObjectId = req.userObjectId;
    const reqUserObjectId = req.reqUserObjectId;
    const cookbookRecipeIdFromParams = req.params.cookbookRecipeId;

    let objectCookbookRecipeId;

    if (!userObjectId.equals(reqUserObjectId))
        return res.status(403).json({ message: 'You can only delete recipes from your own cookbook.' });

    if (!cookbookRecipeIdFromParams)
        return res.status(400).json({ message: 'cookbookRecipeId is required.' });

    if (typeof cookbookRecipeIdFromParams === 'string' && isValidObjectId(cookbookRecipeIdFromParams))
        objectCookbookRecipeId = createObjectId(cookbookRecipeIdFromParams);
    else
    {
        console.error(`CookbookRecipeId is not a valid ObjectId string: ${cookbookRecipeIdFromParams}`);
        return res.status(400).json({ message: 'Invalid Cookbook ID.' });
    }

    try
    {
        const updateResult = await User.updateOne(
            { _id: reqUserObjectId },
            { $pull: { 'personalCookbook.recipes': { _id: objectCookbookRecipeId } } }
        );


        //se non è stato modificato nessun documento significa che la ricetta in questione non era presente nel ricettario
        if (updateResult.modifiedCount === 0)
            return res.status(404).json({ message: 'Recipe not found in your personal cookbook.' });

        res.status(200).json({ message: 'Recipe removed from personal cookbook successfully.' });

    } catch (error)
    {
        console.error('Error removing recipe from personal cookbook:', error);
        res.status(500).json({ message: 'An internal server error occurred while removing the recipe.' });
    }
});

/**
 * @swagger
 * /api/v1/users/{userId}/cookbook/{cookbookRecipeId}:
 *   patch:
 *     summary: Edit or remove the private note of a recipe in the user's personal cookbook
 *     tags:
 *       - Cookbook
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *       - in: path
 *         name: cookbookRecipeId
 *         required: true
 *         schema:
 *           type: string
 *         description: Cookbook recipe ID (ObjectId)
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
 *               privateNote:
 *                 type: string
 *                 example: "Nuova nota privata"
 *     responses:
 *       200:
 *         description: Private note updated successfully
 *       400:
 *         description: cookbookRecipeId is required or invalid
 *       403:
 *         description: You can only edit notes of your own cookbook
 *       500:
 *         description: Internal server error
 */
router.patch('/recipes/:cookbookRecipeId', authenticateUser, async (req, res) =>
{
    //privateNote sarà non presente o una stringa vuota per rimuovere la nota dalla ricetta
    const { privateNote } = req.body;
    const userObjectId = req.userObjectId;
    const reqUserObjectId = req.reqUserObjectId;
    const cookbookRecipeIdFromParams = req.params.cookbookRecipeId;

    let objectCookbookRecipeId;

    if (!userObjectId.equals(reqUserObjectId))
        return res.status(403).json({ message: 'You can only edit notes of your own cookbook.' });

    if (!cookbookRecipeIdFromParams)
        return res.status(400).json({ message: 'cookbookRecipeId is required.' });

    if (typeof cookbookRecipeIdFromParams === 'string' && isValidObjectId(cookbookRecipeIdFromParams))
        objectCookbookRecipeId = createObjectId(cookbookRecipeIdFromParams);
    else
    {
        console.error(`cookbookRecipeId is not a valid ObjectId string: ${cookbookRecipeIdFromParams}`);
        return res.status(400).json({ message: 'Invalid Cookbook ID.' });
    }

    try
    {
        //fase di costruzione della query di update
        let updateQuery;
        if (privateNote.trim() !== '')
        {
            //se la nota è specificata viene impostata
            updateQuery = { $set: { "personalCookbook.recipes.$.privateNote": privateNote } };
        } else
        {
            //se la nota è stringa vuota viene rimosso il campo
            updateQuery = { $unset: { "personalCookbook.recipes.$.privateNote": "" } };
        }
        //sintassi:
        //db.collection.updateOne(
        //    <filter>,
        //    <update>,
        const updateResult = await User.updateOne(
            {
                _id: reqUserObjectId,
                "personalCookbook.recipes._id": objectCookbookRecipeId
            },
            updateQuery
        );


        if (updateResult.modifiedCount === 0)
        {
            return res.status(500).json({ message: 'Failed to update note.' });
            /*//se la ricetta non è stata trovata o non è stata modificata
            const cookbook = await db.collection('personalCookbooks').findOne({ userId: userObjectId });
            if (!cookbook || !cookbook.recipes.some(r => r.mealDbId === mealDbId))
            {
                return res.status(404).json({ message: 'Recipe not found in your personal cookbook.' });
            } else
            {
                // Ricetta trovata ma forse la nota era già quella o altri problemi
                return res.status(500).json({ message: 'Failed to update note (no modification made).' });
            }*/
        }

        res.status(200).json({ message: 'Private note updated successfully.' });

    } catch (error)
    {
        console.error('Error updating private note:', error);
        res.status(500).json({ message: 'An internal server error occurred while updating the note.' });
    }
});

router.patch('/', authenticateUser, async (req, res) =>
{
    //privateNote sarà non presente o una stringa vuota per rimuovere la nota dalla ricetta
    const { publicVisible } = req.body;
    const userObjectId = req.userObjectId;
    const reqUserObjectId = req.reqUserObjectId;

    if (!userObjectId.equals(reqUserObjectId))
        return res.status(403).json({ message: 'You can only edit notes of your own cookbook.' });

    //non potevo fare !publicVisible perché se passo publicVisible a false questo controllo scatta
    if (typeof publicVisible === 'undefined')
        return res.status(400).json({ message: 'publicVisible attribute is required.' });

    if (typeof publicVisible !== 'boolean')
    {
        console.error(`publicVisible is not a valid boolean: ${publicVisible}`);
        return res.status(400).json({ message: 'Invalid publicVisible value.' });
    }

    try
    {
        const updateQuery = { $set: { "personalCookbook.publicVisible": publicVisible } };

        const updateResult = await User.updateOne(
            {
                _id: reqUserObjectId
            },
            updateQuery
        );

        if (updateResult.modifiedCount === 0)
            return res.status(500).json({ message: 'Failed to update cookbook.' });

        res.status(200).json({ message: 'Cookbook updated successfully.' });

    } catch (error)
    {
        console.error('Error updating cookbook:', error);
        res.status(500).json({ message: 'An internal server error occurred while updating the cookbook.' });
    }
});

router.get('/', authenticateUser, async (req, res) =>
{
    const userObjectId = req.userObjectId;
    const reqUserObjectId = req.reqUserObjectId;

    if (!userObjectId.equals(reqUserObjectId))
        return res.status(403).json({ message: 'You can only view your own cookbook.' });

    try
    {
        const userCookbook = await User.findOne({ _id: reqUserObjectId }).select({ "personalCookbook.publicVisible": 1 });

        if (!userCookbook)
            return res.status(403).json({ message: 'Cookbook not found' });

        res.status(200).json({
            publicVisible: userCookbook.personalCookbook.publicVisible,
            recipes: `${BASE_URL}/pgrc/api/v1/users/${reqUserObjectId}/recipes`
        });

    } catch (error)
    {
        console.error('Error retrieving personal cookbook:', error);
        res.status(500).json({ message: 'An internal server error occurred while retrieving the cookbook.' });
    }
});

export default router;


//TODO vedere output di login accesstoken exp