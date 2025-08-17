const express = require("express");
const router = express.Router();
const emailValidator = require("email-validator");
const bcrypt = require("bcryptjs");
const { getDb } = require("../db/db.js");
const { generateAccessToken, generateRefreshToken, removeRefreshToken, verifyToken, findRefreshTokenInDb } = require("../utils/authUtil");
const authenticateToken = require('../middleware/authMiddleware');

router.post("/login", async (req, res) =>
{
    const db = getDb();
    const user = req.body;

    if (!user || !user.email || !user.password)
        return res.status(400).json({ message: 'Email and password are required' });

    //prevent possible nosql injection on email field
    if (!emailValidator.validate(user.email))
        return res.status(400).json({ message: 'Invalid email format' });

    try
    {
        const loginResult = await db.collection('users').findOne({ email: user.email, verified: true });

        if (!loginResult || !await bcrypt.compare(user.password, loginResult.hashedPassword))
            return res.status(401).json({ message: 'Invalid email or password or you did not confirmed your account' });

        const accessToken = generateAccessToken(loginResult._id);
        const refreshToken = await generateRefreshToken(loginResult._id);

        res.cookie('refreshToken', refreshToken, {
            httpOnly: true,
            //secure: process.env.NODE_ENV === 'production', //invia solo su HTTPS in produzione
            sameSite: 'strict',
            path: '/pgrc/api/auth',
            maxAge: 24 * 60 * 60 * 1000
        });

        res.status(200).json({
            message: 'Successful login',
            userId: loginResult._id,
            accessToken: accessToken,
            accessTokenExpiration: 1000 * 60 * 60
        });
    } catch (e)
    {
        console.log(e);
        return res.status(500).json({ message: 'Database error' });
    }
});

router.post("/logout", async (req, res) =>
{
    const refreshToken = req.cookies.refreshToken;

    if (!refreshToken)
        return res.status(400).json({ message: 'Refresh token is required.' });

    if (!await findRefreshTokenInDb(refreshToken))
        return res.status(401).json({ message: 'Invalid refresh token.' });

    try
    {
        await removeRefreshToken(refreshToken);

        //invalida il cookie refreshToken
        //TODO - vedere bene i campi inviati (documentazione)
        res.cookie('refreshToken', 'deleted', {
            path: '/pgrc/api/auth',
            expires: new Date(0),
            httpOnly: true,
            sameSite: 'strict'
            //secure: process.env.NODE_ENV === 'production'
        });

        res.status(200).json({ message: 'Logged out successfully.' });
    } catch (e)
    {
        console.error("Logout error:", e);
        res.status(500).json({ message: 'Internal server error.' });
    }
});

//di fatto crea una nuova risorsa, quindi POST
router.post("/access-token/refresh", async (req, res) =>
{
    const refreshToken = req.cookies.refreshToken;

    if (!refreshToken)
        return res.status(400).json({ message: 'Refresh token is required.' });

    if (!await findRefreshTokenInDb(refreshToken))
        return res.status(401).json({ message: 'Invalid refresh token.' });

    try
    {
        const tokenData = verifyToken(refreshToken);
        if (!tokenData)
            return res.status(401).json({ message: 'Invalid refresh token.' });

        const newAccessToken = generateAccessToken(tokenData.userId);
        res.status(200).json({ accessToken: newAccessToken });
    } catch (e)
    {
        console.error("Error refreshing access token:", e);
        res.status(500).json({ message: 'Internal server error.' });
    }
});

//conferma l'account e crea anche il ricettario personale
router.post("/confirm-account", async (req, res) =>
{
    const db = getDb();
    const { token } = req.body;

    if (!token)
        return res.status(400).json({ message: 'Verification token is missing.' });

    try
    {
        //cerca l'utente con il token di verifica passato e che non sia già verificato
        const user = await db.collection('users').findOne({
            verificationToken: token,
            verified: false,
            verificationTokenExpiration: { $gt: new Date() } //token non scaduto
        });

        if (!user)
            return res.status(404).json({ message: 'Invalid, expired, or already used verification token.' });

        //update dell'utente: imposta verified a true e rimuove il token di verifica
        const updateResult = await db.collection('users').updateOne(
            { _id: user._id },
            {
                $set: { verified: true },
                $unset: { verificationToken: "", verificationTokenExpires: "" }
            }
        );

        if (updateResult.modifiedCount === 0)
        {
            console.warn(`User ${user.email} not modified during verification update.`);
            return res.status(500).json({ message: 'Failed to update user verification status. Please try again.' });
        }

        //const userCookbook = await db.collection('personalCookbooks').findOne({ userId: user._id });

        //creazione del ricettario personale
        const newCookbookResult = await db.collection('personalCookbooks').insertOne({
            userId: user._id,
            recipes: []
        });

        if (!newCookbookResult.acknowledged)
        {
            //se la creazione del ricettario fallisce
            console.error(`Failed to create personal cookbook for user ${user._id} after verification.`);
            return res.status(500).json({ message: 'Account verified, but failed to create personal cookbook. Please contact support.' });
        }
        console.log(`New personal cookbook created for user ${user._id}.`);

        //risposta di conferma positiva
        console.log(`User ${user.email} verified successfully.`);
        return res.status(200).json({ status: 'OK', message: 'Account verified successfully! You can now log in.' });
    } catch (e)
    {
        console.error("Error during account verification:", e);
        res.status(500).json({ message: 'An internal server error occurred during verification.' });
    }
});

router.get("/access-token/verify-token", authenticateToken, async (req, res) =>
{
    try
    {
        const db = getDb();
        const user = await db.collection('users').findOne(
            { _id: req.userObjectId },
            { projection: { _id: 1, username: 1, email: 1 } } // Seleziona solo i campi che vuoi restituire
        );

        if (!user)
        {
            return res.status(404).json({ message: 'User not found.' });
        }

        res.status(200).json({
            message: 'Token is valid.'
        });
    } catch (error)
    {
        console.error('Error in /verify-token endpoint:', error);
        res.status(500).json({ message: 'Internal server error.' });
    }
});

module.exports = router;
