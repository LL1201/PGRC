//node & express
import express from "express";

//database
import Recipe from '../models/Recipe.js';

const router = express.Router();

/**
 * @swagger
 * /api/v1/recipes/search:
 *   get:
 *     summary: Search recipes by keyword or starting letter (paginated)
 *     tags:
 *       - Recipes
 *     parameters:
 *       - in: query
 *         name: q
 *         schema:
 *           type: string
 *         description: Search query (name or ingredient)
 *       - in: query
 *         name: letter
 *         schema:
 *           type: string
 *         description: Starting letter of recipe name
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
 *         description: Invalid or missing parameters
 *       500:
 *         description: Internal server error
 */
router.get('', async (req, res) =>
{
    //q contiene la query nel caso di ricerca
    //letter contiene una singola lettera nel caso voglia ottenere un elenco delle ricette che iniziano per A
    //TODO - miglioramento futuro utile in caso di ordinamenti
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
            const letterRegex = new RegExp(`^${letter.charAt(0)}`, 'i');
            query.name = { $regex: letterRegex };
        } else
        {
            //TODO - miglioramento futuro valutare se restituire delle ricette se non specifico parameteri (miglioramento futuro)
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

        const result = await Recipe.aggregate([
            {
                $match: query
            },
            {
                $facet: {
                    pagination: [
                        { $skip: start },
                        { $limit: offset },
                        { $project: projection }
                    ],
                    total: [
                        { $count: "count" }
                    ]
                }
            }
        ]);

        const recipes = result[0].pagination;
        const total = result[0].total.length > 0 ? result[0].total[0].count : 0;

        //in pratica il range è [start, start+offset)
        //se offfset è maggiore della lunghezza dell'array, viene impostato a length       

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

/**
 * @swagger
 * /api/v1/recipes/{mealDbId}:
 *   get:
 *     summary: Get details of a recipe by mealDbId
 *     tags:
 *       - Recipes
 *     parameters:
 *       - in: path
 *         name: mealDbId
 *         required: true
 *         schema:
 *           type: integer
 *         description: TheMealDB recipe ID
 *     responses:
 *       200:
 *         description: Recipe details
 *       400:
 *         description: Recipe ID is required
 *       404:
 *         description: Recipe not found in local database
 *       500:
 *         description: Internal server error
 */
router.get('/:mealDbId', async (req, res) =>
{
    const mealDbIdFromParams = req.params.mealDbId; //id originario di TheMealDB (vedi documentazione per ulteriori dettagli)
    const mealDbId = parseInt(mealDbIdFromParams);

    if (!mealDbId)
        return res.status(400).json({ message: 'Recipe ID is required.' });

    try
    {
        const recipe = await Recipe.findOne({ mealDbId: mealDbId });

        if (!recipe)
            return res.status(404).json({ message: 'Recipe not found in local database.' });

        res.json(recipe);

    } catch (error)
    {
        console.error(`Error fetching recipe ${id} details from MongoDB:`, error);
        res.status(500).json({ message: 'Internal server error fetching recipe details.' });
    }
});

export default router;
