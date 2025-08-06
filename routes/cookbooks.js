const express = require("express");
const router = express.Router({ mergeParams: true }); //per ottenere anche il parametro dell'URL "userId"
const { getDb } = require("../db/db.js");
const authenticateToken = require('../middleware/authMiddleware');
const { ObjectId } = require('mongodb');

router.post('/', authenticateToken, async (req, res) =>
{
    const db = getDb();
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
        const existingMealDbRecipe = await db.collection('mealdbRecipes').findOne({ mealDbId: mealDbId });

        if (!existingMealDbRecipe)
            return res.status(404).json({ message: 'Recipe with the provided mealDbId does not exist in the MealDB database.' });

        //trova il ricettario personale dell'utente specificato (già creato in fase di registrazione)
        let personalCookbook = await db.collection('personalCookbooks').findOne({ userId: reqUserObjectId });

        //verifica se la ricetta è già presente nel ricettario
        const recipeExists = personalCookbook.recipes.some(r => r.mealDbId === mealDbId);
        if (recipeExists)
            return res.status(409).json({ message: 'Recipe already exists in your personal cookbook.' });

        //crea il documento da inserire nella collection
        /*const newRecipeDocument = {
            mealDbId: mealDbId,
            addedAt: new Date(),
            ...(privateNote && { privateNote: privateNote }) // Aggiunge privateNote solo se fornita
        };*/

        //inserito con un id numerico casuale di 4 cifre
        /*const newRecipeDocument = {
            cookbookRecipeId: Math.floor(1000 + Math.random() * 9000),
            mealDbId: mealDbId,
            addedAt: new Date()
        };*/

        const newRecipeDocument = {
            _id: new ObjectId(),
            mealDbId: mealDbId,
            addedAt: new Date()
        };

        //verifica se la nota è stata specificata 
        if (privateNote)
            newRecipeDocument.privateNote = privateNote;

        //fa l'update del ricettario già presente, aggiungendo le ricette
        const updateResult = await db.collection('personalCookbooks').updateOne(
            { userId: reqUserObjectId },
            { $push: { recipes: newRecipeDocument } }
        );

        if (updateResult.modifiedCount === 0)
            return res.status(500).json({ message: 'Failed to add recipe to cookbook.' });

        res.status(201).json({ message: 'Recipe added to personal cookbook successfully.', cookBookRecipeId: newRecipeDocument._id });

    } catch (error)
    {
        console.error('Error adding recipe to personal cookbook:', error);
        res.status(500).json({ message: 'An internal server error occurred while adding the recipe.' });
    }
});

router.get('/', authenticateToken, async (req, res) =>
{
    const db = getDb();
    const userObjectId = req.userObjectId;
    const reqUserObjectId = req.reqUserObjectId;

    // Extract pagination parameters from query and make them required
    const start = parseInt(req.query.start);
    const end = parseInt(req.query.end);

    // Check if parameters are provided
    if (req.query.start === undefined || req.query.end === undefined)
        return res.status(400).json({ message: 'Both start and end parameters are required.' });

    // Check if parameters are valid numbers
    if (isNaN(start) || isNaN(end))
        return res.status(400).json({ message: 'Start and end parameters must be valid numbers.' });

    if (!userObjectId.equals(reqUserObjectId))
        return res.status(403).json({ message: 'You can only view your own cookbook.' });

    // Validate pagination parameters
    if (start < 0)
        return res.status(400).json({ message: 'Start parameter must be >= 0.' });

    if (end < start || end < 0)
        return res.status(400).json({ message: 'End parameter must be >= start and >= 0.' });

    if (end - start > 12)
        return res.status(400).json({ message: 'End parameter must be <= start + 12.' });

    try
    {
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
        const detailedRecipes = await db.collection('mealdbRecipes').find({ mealDbId: { $in: mealDbIds } }).project(projection).toArray();

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
        });

        // Apply pagination
        //in pratica il range è [start, end)
        //se end è maggiore della lunghezza dell'array, viene impostato a length
        const total = recipesWithNotes.length;
        const actualEnd = Math.min(end, total);
        const paginatedRecipes = recipesWithNotes.slice(start, actualEnd);

        res.status(200).json({
            recipes: paginatedRecipes,
            total: total
        });

    } catch (error)
    {
        console.error('Error retrieving personal cookbook:', error);
        res.status(500).json({ message: 'An internal server error occurred while retrieving the cookbook.' });
    }
});

router.delete('/:cookbookRecipeId', authenticateToken, async (req, res) =>
{
    const db = getDb();
    const userObjectId = req.userObjectId;
    const reqUserObjectId = req.reqUserObjectId;
    const cookbookRecipeIdFromParams = req.params.cookbookRecipeId;

    let objectCookbookRecipeId;

    if (!userObjectId.equals(reqUserObjectId))
        return res.status(403).json({ message: 'You can only delete recipes from your own cookbook.' });

    if (!cookbookRecipeIdFromParams)
        return res.status(400).json({ message: 'cookbookRecipeId is required.' });

    if (typeof cookbookRecipeIdFromParams === 'string' && ObjectId.isValid(cookbookRecipeIdFromParams))
        objectCookbookRecipeId = new ObjectId(cookbookRecipeIdFromParams);
    else
    {
        console.error(`CookbookRecipeId is not a valid ObjectId string: ${cookbookRecipeIdFromParams}`);
        return res.status(400).json({ message: 'Invalid Cookbook ID.' });
    }

    try
    {
        const updateResult = await db.collection('personalCookbooks').updateOne(
            { userId: reqUserObjectId },
            { $pull: { recipes: { _id: objectCookbookRecipeId } } }
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

router.patch('/:cookbookRecipeId', authenticateToken, async (req, res) =>
{
    const db = getDb();
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

    if (typeof cookbookRecipeIdFromParams === 'string' && ObjectId.isValid(cookbookRecipeIdFromParams))
        objectCookbookRecipeId = new ObjectId(cookbookRecipeIdFromParams);
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
            updateQuery = { $set: { "recipes.$.privateNote": privateNote } };
        } else
        {
            //se la nota è stringa vuota viene rimosso il campo
            updateQuery = { $unset: { "recipes.$.privateNote": "" } };
        }

        //sintassi:
        //db.collection.updateOne(
        //    <filter>,
        //    <update>,
        const updateResult = await db.collection('personalCookbooks').updateOne(
            {
                userId: reqUserObjectId,
                "recipes._id": objectCookbookRecipeId
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

module.exports = router;
