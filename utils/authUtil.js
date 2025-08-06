const jwt = require('jsonwebtoken');
const { getDb } = require('../db/db');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET;
const ACCESS_TOKEN_EXPIRATION = process.env.JWT_ACCESS_TOKEN_EXPIRATION;
const REFRESH_TOKEN_EXPIRATION = process.env.JWT_REFRESH_TOKEN_EXPIRATION;

function generateAccessToken(userId)
{
    return jwt.sign({ userId }, JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRATION });
}

async function generateRefreshToken(userId)
{
    const refreshToken = jwt.sign({ userId }, JWT_SECRET, { expiresIn: REFRESH_TOKEN_EXPIRATION });

    const db = getDb();
    const refreshTokensCollection = db.collection('refreshTokens');

    //.exp dentro il JWT è espresso in secondi, Date lo vuole in millisecondi
    const expiresAt = new Date(jwt.decode(refreshToken).exp * 1000);

    await refreshTokensCollection.insertOne({
        userId: userId,
        token: refreshToken,
        expiration: expiresAt,
        creation: new Date()
    });
    return refreshToken;
}

function verifyToken(token)
{
    try
    {
        return jwt.verify(token, JWT_SECRET);
    } catch (error)
    {
        return null;
    }
}

async function removeRefreshToken(token)
{
    const db = getDb();
    const refreshTokensCollection = db.collection('refreshTokens');
    await refreshTokensCollection.deleteOne({ token: token });
}

async function findRefreshTokenInDb(token)
{
    //TODO - se refresh token vengono salvati in users cambiare
    const db = getDb();
    const refreshTokensCollection = db.collection('refreshTokens');
    return await refreshTokensCollection.findOne({ token: token });
}

module.exports = {
    generateAccessToken,
    generateRefreshToken,
    verifyToken,
    removeRefreshToken,
    findRefreshTokenInDb
};