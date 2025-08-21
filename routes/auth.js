const express = require("express");
const router = express.Router();
const emailValidator = require("email-validator");
const bcrypt = require("bcryptjs");
const { getDb } = require("../db/db.js");
const { generateAccessToken, generateRefreshToken, removeRefreshToken, verifyToken, verifyRefreshToken } = require("../utils/authUtil");
const authenticateToken = require('../middleware/authMiddleware');
require('dotenv').config();

/**
 * @swagger
 * /api/v1/auth/login:
 *   post:
 *     summary: Login using email and password
 *     tags:
 *       - Auth
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *                 example: user@example.com
 *               password:
 *                 type: string
 *                 example: password123
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 userId:
 *                   type: string
 *                 accessToken:
 *                   type: string
 *                 accessTokenExpiration:
 *                   type: integer
 *       400:
 *         description: Email and password are required or invalid email format
 *       401:
 *         description: Invalid email or password or account not confirmed
 *       500:
 *         description: Database error
 */
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

        //TODO - vedere se il path è possibile limitarlo... perché senno in user deletion non lo passa e mi tocca includere tutto
        res.cookie('refreshToken', refreshToken, {
            httpOnly: true,
            //secure: process.env.NODE_ENV === 'production', //invia solo su HTTPS in produzione
            sameSite: 'strict',
            path: '/pgrc/api/v1/',
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

/**
 * @swagger
 * /api/v1/auth/logout:
 *   post:
 *     summary: Logout and invalidate refresh token
 *     tags:
 *       - Auth
 *     description: |
 *       Effettua il logout dell'utente. Richiede il cookie `refreshToken` inviato dal client.
 *     parameters:
 *       - in: cookie
 *         name: refreshToken
 *         required: true
 *         schema:
 *           type: string
 *         description: Refresh token cookie
 *     responses:
 *       200:
 *         description: Logged out successfully
 *       400:
 *         description: Refresh token is required
 *       401:
 *         description: Invalid refresh token
 *       500:
 *         description: Internal server error
 */
router.post("/logout", async (req, res) =>
{
    const refreshToken = req.cookies.refreshToken;

    if (!refreshToken)
        return res.status(400).json({ message: 'Refresh token is required.' });

    if (!await verifyRefreshToken(refreshToken))
        return res.status(401).json({ message: 'Invalid refresh token.' });

    try
    {
        await removeRefreshToken(refreshToken);

        //invalida il cookie refreshToken impostado il suo valore a deleted e scadenza alla data 0        
        res.cookie('refreshToken', 'deleted', {
            path: '/pgrc/api/v1/auth',
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

/**
 * @swagger
 * /api/v1/auth/access-token/refresh:
 *   post:
 *     summary: Refresh access token using refresh token cookie
 *     tags:
 *       - Auth
 *     description: |
 *       Richiede il cookie `refreshToken` inviato dal client.
 *     parameters:
 *       - name: refreshToken
 *         in: cookie
 *         required: true
 *         schema:
 *           type: string
 *         description: Refresh token cookie
 *     responses:
 *       200:
 *         description: New access token issued
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 accessToken:
 *                   type: string
 *       400:
 *         description: Refresh token is required
 *       401:
 *         description: Invalid refresh token
 *       500:
 *         description: Internal server error
 */
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

/**
 * @swagger
 * /api/v1/auth/confirm-account:
 *   post:
 *     summary: Confirm user account with verification token
 *     tags:
 *       - Auth
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               token:
 *                 type: string
 *                 example: 123456abcdef
 *     responses:
 *       200:
 *         description: Account verified successfully
 *       400:
 *         description: Verification token is missing
 *       404:
 *         description: Invalid, expired, or already used verification token
 *       500:
 *         description: Internal server error
 */
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

router.post("/password-reset", async (req, res) =>
{
    const db = getDb();
    const { email } = req.body;

    if (!email)
        return res.status(400).json({ message: 'Email is required.' });

    //TODO - bisogna anche controllare che la data di scadenza sia scaduta per procedere ad una nuova richiesta
    //controllare anche che l'account sia verificato...
    const user = await db.collection('users').findOne({ email: email, resetPasswordToken: { $exists: false } });

    //prevenzione attacchi di enumerazione email: non informare il client se l'email esiste
    if (!user)
        return res.status(200).json({ message: 'If this email is in our system, you will receive a password reset link shortly.' });

    //genera un token
    //non uso JWT in questo caso per evitare la dipendenza da un token che si autodistrugge
    const resetToken = crypto.randomBytes(32).toString('hex');
    const hashedResetToken = await bcrypt.hash(resetToken, 10);
    const resetTokenExpiration = new Date(Date.now() + 3600000); //scadenza tra 1 ora

    try
    {
        //aggiorna l'utente con il token e la sua scadenza
        await db.collection('users').updateOne(
            { _id: user._id },
            {
                $set: {
                    resetPasswordToken: hashedResetToken,
                    resetTokenExpiration: resetTokenExpiration,
                }
            }
        );

        await sendPasswordResetMail(email, resetToken);

        res.status(200).json({ message: 'If this email is in our system, you will receive a password reset link shortly.' });

    } catch (e)
    {
        console.error("Error during password reset request:", e);
        res.status(500).json({ message: 'An internal server error occurred. Please try again later.' });
    }
});

module.exports = router;
