import jwt from 'jsonwebtoken';
import { getDb } from "../db/db.js";
import dotenv from 'dotenv';

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET;
const ACCESS_TOKEN_EXPIRATION = process.env.JWT_ACCESS_TOKEN_EXPIRATION;
const REFRESH_TOKEN_EXPIRATION = process.env.JWT_REFRESH_TOKEN_EXPIRATION;

export function generateAccessToken(userId)
{
    return jwt.sign({ userId }, JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRATION });
}

export async function generateRefreshToken(userId)
{
    const refreshToken = jwt.sign({ userId }, JWT_SECRET, { expiresIn: REFRESH_TOKEN_EXPIRATION });

    const db = getDb();
    const refreshTokensCollection = db.collection('refreshTokens');

    //.exp dentro il JWT è espresso in secondi, Date lo vuole in millisecondi
    const expiresAt = new Date(jwt.decode(refreshToken).exp * 1000);

    await refreshTokensCollection.insertOne({
        userId: userId,
        token: refreshToken,
        expiresAt: expiresAt,
        createdAt: new Date()
    });
    return refreshToken;
}

export async function verifyToken(token)
{
    try
    {
        return await jwt.verify(token, JWT_SECRET);
    } catch (error)
    {
        return null;
    }
}

export async function removeRefreshToken(token)
{
    const db = getDb();
    const refreshTokensCollection = db.collection('refreshTokens');
    await refreshTokensCollection.deleteOne({ token: token });
}

export async function verifyRefreshToken(token)
{
    //controlla prima la presenza del token nel db e che non sia scaduto
    const db = getDb();
    const tokenDocument = await db.collection('refreshTokens').findOne({ token: token });
    if (!tokenDocument) return null;

    if (tokenDocument.expiresAt && tokenDocument.expiresAt < new Date())
        return null;

    //controlla la validità del JWT stesso  
    return verifyToken(token);
}