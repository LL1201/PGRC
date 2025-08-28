import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
dotenv.config();

import RefreshToken from '../models/RefreshToken.js';

const JWT_SECRET = process.env.JWT_SECRET;
const ACCESS_TOKEN_EXPIRATION = process.env.JWT_ACCESS_TOKEN_EXPIRATION;
const REFRESH_TOKEN_EXPIRATION = process.env.JWT_REFRESH_TOKEN_EXPIRATION;

export const AuthMethod = {
    Google: 'google',
    Email: 'email'
};

export function generateAccessToken(userId, authMethod = AuthMethod.Email)
{
    return jwt.sign({
        userId: userId,
        authMethod: authMethod
    }, JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRATION });
}

export async function generateRefreshToken(userId, authMethod = AuthMethod.Email)
{
    const refreshToken = jwt.sign({
        userId: userId,
        authMethod: authMethod
    }, JWT_SECRET, { expiresIn: REFRESH_TOKEN_EXPIRATION });

    //.exp dentro il JWT è espresso in secondi, Date lo vuole in millisecondi
    const expiresAt = new Date(jwt.decode(refreshToken).exp * 1000);

    const tokenData = new RefreshToken({
        userId: userId,
        token: refreshToken,
        expiresAt: expiresAt,
        createdAt: new Date()
    });

    try
    {
        await tokenData.save();
    } catch (error)
    {
        console.error('Failed to insert refresh token:', error);
        return res.status(500).json({ message: 'Failed to create refresh token.' });
    }

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
    const deleteTokenResult = await RefreshToken.deleteOne({ token });

    if (deleteTokenResult.deletedCount === 0)
    {
        console.warn(`Refresh token with ID ${token} was found but not deleted.`);
        return false;
    }
    return true;
}

export async function verifyRefreshToken(token)
{
    //controlla prima la presenza del token nel db e che non sia scaduto
    const tokenDocument = await RefreshToken.findOne({ token });
    if (!tokenDocument) return null;

    if (tokenDocument.expiresAt && tokenDocument.expiresAt < new Date())
        return null;

    //controlla la validità del JWT stesso  
    return verifyToken(token);
}