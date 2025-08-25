//node & express
import express from "express";
import cookieParser from "cookie-parser";
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';
import swaggerUi from 'swagger-ui-express';
import swaggerJsDoc from 'swagger-jsdoc';

//database
import { connectToDatabase } from "./api/db/db.js";
import populateTheMealDbRecipes from './api/utils/populateDb.js';

//middlewares
import htmlProcessor from './api/middlewares/htmlProcessor.js';
import passport from './api/config/passport.js';

//routers
import authRouter from "./api/routes/auth.js";
import usersRouter from "./api/routes/users.js";
import recipesRouter from "./api/routes/recipes.js";
import cookbooksRouter from "./api/routes/cookbooks.js";
import reviewsRouter from "./api/routes/reviews.js";


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const swaggerOptions = {
    swaggerDefinition: {
        openapi: '3.0.0',
        info: {
            title: 'PGRC API',
            version: '1.0.0',
            description: 'PGRC API documentation',
            contact: {
                name: 'Luca Loner'
            }
        },
        servers: [
            {
                url: 'https://www.lloner.it/pgrc/api/v1',
            },
        ],
    },
    apis: ['./api/routes/*.js']
};

const corsOptions = {
    origin: ['https:/www.lloner.it'],
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Cookie'],
    // maxAge: 86400, // Cache the preflight response for 24 hours
};

const swaggerDocs = swaggerJsDoc(swaggerOptions);

//server
const app = express();
const port = 3003;

app.use(express.json());
app.use(cookieParser());

//middleware per l'aggiunta del menu a tutte le pagine che hanno il placeholder <!-- NAVBAR_PLACEHOLDER -->
app.use(htmlProcessor);
app.use(cors(corsOptions));

//enable CORS for preflight requests
app.options('/', cors(corsOptions));

app.use(passport.initialize());

app.use('/', express.static(path.join(__dirname, 'public')));
app.use('/api/v1/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocs));
app.use("/api/v1/users/:userId/cookbook", cookbooksRouter);
app.use("/api/v1/users", usersRouter);
app.use("/api/v1/auth", authRouter);
app.use("/api/v1/recipes/:mealDbId/reviews", reviewsRouter);
app.use("/api/v1/recipes", recipesRouter);

app.use((err, req, res, next) =>
{
    if (err instanceof SyntaxError && err.status === 400 && 'body' in err)
    {
        console.error(err);
        return res.status(400).send({ message: "Invalid JSON syntax" });
    }
    next(err);
});

app.use((req, res) =>
{
    res.status(404).json({ message: 'Invalid endpoint or HTTP method' });
});

connectToDatabase().then(async () =>
{
    //chiamata alla funzione di popolamento delle ricette dopo la connessione al DB
    await populateTheMealDbRecipes();
    app.listen(port, () =>
    {
        console.log(`Server is listening on http://localhost:${port}`);
    });
}).catch(err =>
{
    console.error("Cannot connect to DB:", err);
});
