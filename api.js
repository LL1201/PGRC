const express = require("express");
const cookieParser = require('cookie-parser');

//custom modules
const { connectToDatabase } = require("./db/db.js");
const { populateTheMealDbRecipes } = require('./utils/populateDb.js');
const htmlProcessor = require('./middleware/htmlProcessor.js');
const usersRouter = require("./routes/users");
const authRouter = require("./routes/auth");
const recipesRouter = require("./routes/recipes");
const cookbooksRouter = require("./routes/cookbooks");
const reviewsRouter = require("./routes/reviews");

const swaggerUi = require('swagger-ui-express');
const swaggerJsDoc = require('swagger-jsdoc');

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
    apis: ['./routes/*.js']
};

const swaggerDocs = swaggerJsDoc(swaggerOptions);


//server
const app = express();
const port = 3003;

app.use(express.json());
app.use(cookieParser());

//middleware per l'aggiunta del menu a tutte le pagine che hanno il placeholder <!-- NAVBAR_PLACEHOLDER -->
app.use(htmlProcessor);

app.use('/', express.static('public'))
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

