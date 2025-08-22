import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config();

const dbUri = process.env.DB_STRING;
const dbName = process.env.DB_NAME;
const client = new MongoClient(dbUri);

let db;

export async function connectToDatabase()
{
    if (!db)
    {
        await client.connect();
        db = client.db(dbName);
        console.log("Connected to MongoDB");
    }
    return db;
}

export function getDb()
{
    if (!db)
        throw new Error("Database not connected. Call connectToDatabase first.");

    return db;
}
