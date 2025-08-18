const express = require("express");
const cookieParser = require('cookie-parser');

//custom modules
const { connectToDatabase } = require("./db/db.js");
const { populateTheMealDbRecipes } = require('./utils/populateDb.js');
const usersRouter = require("./routes/users");
const authRouter = require("./routes/auth");
const recipesRouter = require("./routes/recipes");
const cookbooksRouter = require("./routes/cookbooks");
const reviewsRouter = require("./routes/reviews");

// server
const app = express();
const port = 3003;

app.use(express.json());
app.use(cookieParser());

app.use('/', express.static('public'))
app.use("/api/users/:userId/cookbook", cookbooksRouter);
app.use("/api/users", usersRouter);
app.use("/api/auth", authRouter);
app.use("/api/recipes/:mealDbId/reviews", reviewsRouter);
app.use("/api/recipes", recipesRouter);

app.use((err, req, res, next) =>
{
    if (err instanceof SyntaxError && err.status === 400 && 'body' in err)
    {
        console.error(err);
        return res.status(400).send({ message: "Invalid JSON syntax" });
    }
    next(err);
});

//TODO - verificare funzionamento
app.use((req, res) =>
{
    res.status(404).json({ message: 'Invalid endpoint or HTTP method' });
});

connectToDatabase().then(async () =>
{
    //chiamata alla funzione di popolamento dopo la connessione al DB
    await populateTheMealDbRecipes();
    app.listen(port, () =>
    {
        console.log(`Server is listening on http://localhost:${port}`);
    });
}).catch(err =>
{
    console.error("Cannot connect to DB:", err);
});

