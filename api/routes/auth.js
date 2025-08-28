//node & express
import express from "express";
import emailValidator from "email-validator";
import bcrypt from "bcryptjs";
import dotenv from 'dotenv';
import crypto from 'crypto';
import passport from '../config/passport.js';

//utils
import { generateAccessToken, generateRefreshToken, removeRefreshToken, verifyRefreshToken, AuthMethod } from "../utils/authUtils.js";
import { sendPasswordResetMail } from '../utils/mailUtils.js';
import { createObjectId } from '../utils/objectId.js';

import User from '../models/User.js';
import Cookbook from '../models/Cookbook.js';

dotenv.config();

const router = express.Router();
const HASH_SALT = parseInt(process.env.HASH_SALT);

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
    const user = req.body;

    if (!user || !user.email || !user.password)
        return res.status(400).json({ message: 'Email and password are required' });

    //prevent possible nosql injection on email field
    if (!emailValidator.validate(user.email))
        return res.status(400).json({ message: 'Invalid email format' });

    try
    {
        const loginResult = await User.findOne({ email: user.email, verified: true });

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
        if (await removeRefreshToken(refreshToken))
        {

            //invalida il cookie refreshToken impostado il suo valore a deleted e scadenza alla data 0        
            res.cookie('refreshToken', 'deleted', {
                path: '/pgrc/api/v1/',
                expires: new Date(0),
                httpOnly: true,
                sameSite: 'strict'
                //secure: process.env.NODE_ENV === 'production'
            });

            res.status(200).json({ message: 'Logged out successfully.' });
        } else
        {
            res.status(500).json({ message: 'Internal server error.' });
        }
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
router.get("/access-token", async (req, res) =>
{
    const refreshToken = req.cookies.refreshToken;

    if (!refreshToken)
        return res.status(400).json({ message: 'Refresh token is required.' });

    try
    {
        const tokenData = await verifyRefreshToken(refreshToken);
        if (!tokenData)
            return res.status(401).json({ message: 'Invalid refresh token.' });

        const userId = tokenData.userId;
        const authMethod = tokenData.authMethod;

        const newAccessToken = generateAccessToken(userId, authMethod);
        res.status(200).json({
            userId: userId,
            accessToken: newAccessToken
        });
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
    const { token } = req.body;

    if (!token)
        return res.status(400).json({ message: 'Verification token is missing.' });

    try
    {
        //cerca l'utente con il token di verifica passato e che non sia già verificato
        const user = await User.findOne({
            verified: false,
            'verificationData.token': token,
            'verificationData.expiration': { $gt: new Date() }
        });

        if (!user)
            return res.status(404).json({ message: 'Invalid, expired, or already used verification token.' });

        //update dell'utente: imposta verified a true e rimuove il token di verifica
        const updateResult = await User.updateOne(
            { _id: user._id },
            {
                $set: { verified: true },
                $unset: {
                    'verificationData.token': '',
                    'verificationData.expiration': ''
                }
            }
        );

        if (updateResult.modifiedCount === 0)
        {
            console.warn(`User ${user.email} not modified during verification update.`);
            return res.status(500).json({ message: 'Failed to update user verification status. Please try again.' });
        }

        //creazione del ricettario personale
        const newCookbook = new Cookbook({ userId: user._id });
        try
        {
            await newCookbook.save();
        } catch (error)
        {
            console.error(`Failed to create personal cookbook for user ${user._id} after verification.`, error);
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

/**
 * @swagger
 * /api/v1/auth/password-lost:
 *   post:
 *     summary: Request password reset email
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
 *     responses:
 *       200:
 *         description: If the email exists, a password reset link will be sent
 *       400:
 *         description: Email is required
 *       500:
 *         description: Internal server error
 */
router.post("/password-lost", async (req, res) =>
{
    const { email } = req.body;

    if (!email)
        return res.status(400).json({ message: 'Email is required.' });

    //controllo l'esistenza dello user    
    const user = await User.findOne({
        email: email,
        $or: [
            { 'resetPasswordData.expiration': { $exists: false } },
            { 'resetPasswordData.expiration': { $lte: new Date() } }
        ]
    });

    //prevenzione attacchi di enumerazione email: non informare il client se l'email esiste
    if (!user)
        return res.status(200).json({ message: 'If this email is in our system, you will receive a password reset link shortly.' });

    //genera un token
    //non uso JWT in questo caso per evitare la dipendenza da un token che si autodistrugge
    const resetToken = crypto.randomBytes(32).toString('hex');
    const hashedResetToken = await bcrypt.hash(resetToken, HASH_SALT);
    const resetTokenExpiration = new Date(Date.now() + 3600000); //scadenza tra 1 ora

    try
    {
        //aggiorna l'utente con il token e la sua scadenza
        await User.updateOne(
            { _id: user._id },
            {
                $set: {
                    resetPasswordData: {
                        token: hashedResetToken,
                        expiration: resetTokenExpiration
                    }
                }
            }
        );

        sendPasswordResetMail(email, resetToken, user._id);

        res.status(200).json({ message: 'If this email is in our system, you will receive a password reset link shortly.' });

    } catch (e)
    {
        console.error("Error during password reset request:", e);
        res.status(500).json({ message: 'An internal server error occurred. Please try again later.' });
    }
});

/**
 * @swagger
 * /api/v1/auth/password-reset:
 *   post:
 *     summary: Reset password using reset token
 *     tags:
 *       - Auth
 *     parameters:
 *       - in: query
 *         name: resetToken
 *         required: true
 *         schema:
 *           type: string
 *         description: Token received via email
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               password:
 *                 type: string
 *                 example: nuovaPassword123
 *     responses:
 *       200:
 *         description: Password has been reset successfully
 *       400:
 *         description: Reset token and new password are required
 *       403:
 *         description: Invalid token
 *       404:
 *         description: User not found or token has expired
 *       500:
 *         description: Internal server error
 */
router.post("/password-reset", async (req, res) =>
{
    const { password, resetToken, userId } = req.body;

    if (!resetToken || !password || !userId)
        return res.status(400).json({ message: 'Reset token, new password and user ID are required.' });

    try
    {
        const user = await User.findOne({
            _id: createObjectId(userId),
            'resetPasswordData.token': { $exists: true, $ne: null },
            'resetPasswordData.expiration': { $gt: new Date() }
        });

        if (!user)
            return res.status(404).json({ message: 'User not found or token has expired.' });

        const isMatch = await bcrypt.compare(resetToken, user.resetPasswordData.token);
        if (!isMatch)
            return res.status(403).json({ message: 'Invalid token.' });

        if (await bcrypt.compare(password, user.hashedPassword))
            return res.status(400).json({ message: 'New password must be different from the old password.' });

        //hash della nuova password e aggiornamento nel DB
        const newPasswordHash = await bcrypt.hash(password, HASH_SALT);

        //rimuove il token di reset dal DB per evitare riutilizzi
        //TODO - miglioramento futuro fare in modo che ci sia uno storico dei password reset
        await User.updateOne(
            { _id: user._id },
            {
                $set: { hashedPassword: newPasswordHash },
                $unset: {
                    'resetPasswordData.token': '',
                    'resetPasswordData.expiration': ''
                }
            }
        );

        res.status(200).json({ message: 'Password has been reset successfully. You can now log in.' });

    } catch (e)
    {
        console.error("Error resetting password:", e);
        res.status(500).json({ message: 'An internal server error occurred.' });
    }
});

router.get("/google", passport.authenticate("google", {
    scope: ["https://www.googleapis.com/auth/plus.login", "email"],
})
);

router.get("/google/callback",
    passport.authenticate("google", { failureRedirect: "/pgrc/login.html", session: false }),
    async (req, res) =>
    {
        // Se l'autenticazione ha successo, Passport ha messo l'utente nell'oggetto req.user
        // Ora puoi generare i tuoi token JWT e reindirizzare al frontend
        const userId = req.user._id.toString();
        const refreshToken = await generateRefreshToken(userId, AuthMethod.Google);

        // Reindirizza l'utente alla tua pagina di profilo o a una pagina di benvenuto,
        // passando i token come parametri dell'URL o in un cookie.
        // Utilizzare un redirect è standard per OAuth
        //TODO - vedere se il path è possibile limitarlo... perché senno in user deletion non lo passa e mi tocca includere tutto
        res.cookie('refreshToken', refreshToken, {
            httpOnly: true,
            //secure: process.env.NODE_ENV === 'production', //invia solo su HTTPS in produzione
            sameSite: 'strict',
            path: '/pgrc/api/v1/',
            maxAge: 24 * 60 * 60 * 1000
        });
        res.redirect('/pgrc/my-profile.html');
    }
);

export default router;
