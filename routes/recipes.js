const express = require("express");
const router = express.Router();
const { getDb } = require("../db/db.js");

router.get('/search', async (req, res) =>
{
    const db = getDb();
    //q contiene la query nel caso di ricerca
    //letter contiene una singola lettera nel caso voglia ottenere un elenco delle ricette che iniziano per A
    //TODO - utile in caso di ordinamenti
    const { q, letter } = req.query;

    const start = parseInt(req.query.start);
    const offset = parseInt(req.query.offset);

    // Check if parameters are provided
    if (req.query.start === undefined || req.query.offset === undefined)
        return res.status(400).json({ message: 'Both start and offset parameters are required.' });

    // Check if parameters are valid numbers
    if (isNaN(start) || isNaN(offset))
        return res.status(400).json({ message: 'Start and offset parameters must be valid numbers.' });

    if (start < 0)
        return res.status(400).json({ message: 'Start parameter must be >= 0.' });

    if (offset < start || offset < 0)
        return res.status(400).json({ message: 'offset parameter must be >= start and >= 0.' });

    if (offset - start > 12)
        return res.status(400).json({ message: 'offset parameter must be <= start + 12.' });

    let query = {};

    try
    {
        if (q)  
        {
            //ricerca per parole chiave (nome del piatto o ingredienti)            
            //$regex: cerca la stringa 'q'
            //$options: 'i' rende la ricerca case-insensitive          
            const searchRegex = new RegExp(q, 'i');
            query.$or = [
                { name: { $regex: searchRegex } },
                { 'ingredients.ingredientName': { $regex: searchRegex } }
            ];
        } else if (letter)
        {
            //ricerca per lettera iniziale del nome del piatto            
            const letterRegex = new RegExp(`^${letter}`, 'i');
            query.name = { $regex: letterRegex };
        } else
        {
            //TODO - valutare se restituire delle ricette se non specifico parameteri
            return res.status(400).json({ message: 'Please provide a search query (q) or a starting letter (letter).' });
        }

        //seleziono solo i campi essenziali
        //per ottenere info aggiuntive per ogni ricetta c'è l'altro endpoint
        //idem per le recensioni
        const projection = {
            mealDbId: 1,
            name: 1,
            category: 1,
            mealThumb: 1,
            area: 1,
            _id: 0
        };

        const recipes = await db.collection('mealdbRecipes')
            .find(query)
            .project(projection)
            .skip(start)
            .limit(offset)
            .toArray();

        const total = await db.collection('mealdbRecipes').countDocuments(query);

        //in pratica il range è [start, start+offset)
        //se offfset è maggiore della lunghezza dell'array, viene impostato a length
        //const total = recipes.length;
        //const actualEnd = Math.min(offset, total);
        //const paginatedRecipes = recipes.slice(start, actualEnd);

        res.status(200).json({
            recipes: recipes,
            total: total
        });
    } catch (error)
    {
        console.error('Error fetching recipes:', error);
        res.status(500).json({ message: 'An internal server error occurred while fetching recipes.' });
    }
});

router.get('/:mealDbId', async (req, res) =>
{
    const db = getDb();
    const mealDbIdFromParams = req.params.mealDbId; //id originario di TheMealDB (vedi documentazione per ulteriori dettagli)
    const mealDbId = parseInt(mealDbIdFromParams);


    if (!mealDbId)
        return res.status(400).json({ message: 'Recipe ID is required.' });

    try
    {
        const recipe = await db.collection('mealdbRecipes').findOne({ mealDbId: mealDbId });

        if (!recipe)
            return res.status(404).json({ message: 'Recipe not found in local database.' });

        //find delle recensioni associate alla ricetta richiesta
        //aggiungo le recensioni all'oggetto restituito in precedenza sotto un'altra keyword
        recipe.userReviews = await db.collection('reviews').find({ recipeId: mealDbId }).toArray();

        res.json(recipe);

    } catch (error)
    {
        console.error(`Error fetching recipe ${id} details from MongoDB:`, error);
        res.status(500).json({ message: 'Internal server error fetching recipe details.' });
    }
});

module.exports = router;
