const { MongoClient } = require("mongodb");
require('dotenv').config()

const dbUri = process.env.DB_STRING;
const dbName = process.env.DB_NAME;
const client = new MongoClient(dbUri);

let db;

async function connectToDatabase()
{
    if (!db)
    {
        await client.connect();
        db = client.db(dbName);
        console.log("Connected to MongoDB");
    }
    return db;
}

function getDb()
{
    if (!db)
    {
        throw new Error("Database not connected. Call connectToDatabase first.");
    }
    return db;
}

module.exports = { connectToDatabase, getDb };