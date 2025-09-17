//node & express
import express from "express";
import dotenv from 'dotenv';

dotenv.config();

//utils
import { createObjectId, isValidObjectId } from '../utils/objectId.js';

//middlewares
import { authenticateUser, authenticateUserOptionally } from '../middlewares/authMiddleware.js';

//models
import User from '../models/User.js';
import Recipe from '../models/Recipe.js';

const BASE_URL = process.env.BASE_URL;

const router = express.Router({ mergeParams: true });

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

        res.status(201).json({ message: 'Recipe successfully added to personal cookbook.' });

    } catch (error)
    {
        console.error('Error adding recipe to personal cookbook:', error);
        res.status(500).json({ message: 'An internal server error occurred while adding the recipe.' });
    }
});

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
                $sort: { "personalCookbook.recipes.addedAt": -1 }
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
                                privateNote: !userObjectId || !userObjectId.equals(reqUserObjectId) ? "" : "$personalCookbook.recipes.privateNote"
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
        const recipes = result[0].pagination;

        //formato di total: [ { count: 12 } ]
        //se il count è 0, total è un array vuoto, quindi devo controllare prima di assegnarlo
        const total = result[0].total.length > 0 ? result[0].total[0].count : 0;

        res.status(200).json({
            recipes: recipes,
            total: total
        });

    } catch (error)
    {
        console.error('Error retrieving personal cookbook:', error);
        res.status(500).json({ message: 'An internal server error occurred while retrieving the cookbook.' });
    }
});

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

        res.status(200).json({ message: 'Recipe successfully removed from personal cookbook.' });

    } catch (error)
    {
        console.error('Error removing recipe from personal cookbook:', error);
        res.status(500).json({ message: 'An internal server error occurred while removing the recipe.' });
    }
});

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
            return res.status(500).json({ message: 'Failed to update note.' });

        res.status(200).json({ message: 'Private note successfully updated.' });

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

        res.status(200).json({ message: 'Cookbook successfully updated.' });

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
            return res.status(404).json({ message: 'Cookbook not found' });

        res.status(200).json({
            publicVisible: userCookbook.personalCookbook.publicVisible,
            recipes: `${BASE_URL}/api/v1/users/${reqUserObjectId}/recipes`
        });

    } catch (error)
    {
        console.error('Error retrieving personal cookbook:', error);
        res.status(500).json({ message: 'An internal server error occurred while retrieving the cookbook.' });
    }
});

export default router;