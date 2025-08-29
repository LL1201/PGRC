import mongoose from "mongoose";
import dotenv from 'dotenv';

dotenv.config();

const DB_STRING = process.env.DB_STRING;
const DB_NAME = process.env.DB_NAME;

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
                useNewUrlParser: true,
                useUnifiedTopology: true,
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