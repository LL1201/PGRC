import mongoose from "mongoose";
import dotenv from 'dotenv';

dotenv.config();

const DB_NAME = process.env.DB_NAME
const DB_HOST = process.env.DB_HOST
const DB_PORT = process.env.DB_PORT
const DB_USER = process.env.DB_USER
const DB_PSW = process.env.DB_PSW

// Costruzione dinamica della connection string
const DB_STRING = `mongodb://${DB_USER}:${DB_PSW}@${DB_HOST}:${DB_PORT}/`;

class Database
{
    constructor()
    {
        this.connection = null;
        mongoose.set("strictQuery", true);
    }

    async connect()
    {
        try
        {
            const connection = await mongoose.connect(DB_STRING, {
                dbName: DB_NAME,
            });
            this.connection = connection;
            console.log("Connected to MongoDB");
        }
        catch (e)
        {
            console.error("Error connecting to MongoDB:", e.message);
        }
    }
}

export default Database;