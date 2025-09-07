//node & express
import express from "express";
import emailValidator from "email-validator";
import bcrypt from "bcryptjs";
import dotenv from 'dotenv';
import crypto from 'crypto';

import { google } from 'googleapis';

//utils
import { generateAccessToken, generateRefreshToken, AuthMethod } from "../utils/authUtils.js";
import { sendPasswordResetMail } from '../utils/mailUtils.js';

import User from '../models/User.js';

dotenv.config();

const router = express.Router();
const HASH_SALT = parseInt(process.env.HASH_SALT);
const PASSWORD_RESET_TOKEN_EXPIRATION = parseInt(process.env.PASSWORD_RESET_TOKEN_EXPIRATION);

const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_OAUTH_CALLBACK_URI
);

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
router.post("/access-tokens", async (req, res) =>
{
    const loginData = req.body;

    if (!loginData)
        return res.status(400).json({ message: 'Login data is required' });
    else if (loginData.authProvider && loginData.authProvider === AuthMethod.Google)
    {
        const url = oauth2Client.generateAuthUrl({
            access_type: "offline",
            scope: ["email", "profile"],
            prompt: "consent"
        });

        return res.status(200).json({
            redirectUrl: url
        });
    }

    if (!loginData.email || !loginData.password)
        return res.status(400).json({ message: 'Email and password are required' });

    //prevent possible nosql injection on email field
    if (!emailValidator.validate(loginData.email))
        return res.status(400).json({ message: 'Invalid email format' });

    try
    {
        const loginResult = await User.findOne({ email: loginData.email, verified: true });

        if (!loginResult.hashedPassword && loginResult.googleId)
            return res.status(400).json({ message: 'Invalid authentication method.' });


        if (!loginResult || !await bcrypt.compare(loginData.password, loginResult.hashedPassword))
            return res.status(401).
                set('WWW-Authenticate', 'Bearer realm="Access to the protected API"').json({ message: 'Invalid email or password or you did not confirmed your account' });

        const accessToken = generateAccessToken(loginResult._id);
        const refreshToken = await generateRefreshToken(loginResult._id);

        res.cookie('refreshToken', refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            path: `/pgrc/api/v1/users/${loginResult._id}`,
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
router.post("/password-lost-tokens", async (req, res) =>
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
    const resetTokenExpiration = new Date(Date.now() + PASSWORD_RESET_TOKEN_EXPIRATION);

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

router.get("/auth/google/callback", async (req, res) =>
{
    const { code, state } = req.query;

    if (!code) return res.status(400).send("Missing code");

    try
    {
        const { tokens } = await oauth2Client.getToken(code);
        oauth2Client.setCredentials(tokens);

        //recupero info utente
        const oauth2 = google.oauth2({ version: "v2", auth: oauth2Client });
        const { data: profile } = await oauth2.userinfo.get();

        const email = profile.email;
        if (!email) throw new Error("Email non trovata nel profilo Google");

        let user = await User.findOne({ email });

        if (user)
        {
            //se l'utente esiste ma non ha il googleId aggiorna il documento
            if (!user.googleId)
            {
                user.googleId = profile.id;
                await user.save();
            }
        } else
        {
            //se non esiste l'utente ne crea uno nuovo, in questo caso non serve verifica via mail
            user = new User({
                email,
                username: profile.name || profile.given_name || `GoogleUser${profile.id}`,
                googleId: profile.id,
                verified: true,
                createdAt: new Date()
            });
            await user.save();
        }

        const userId = user._id.toString();

        const refreshToken = await generateRefreshToken(userId, AuthMethod.Google);

        res.cookie('refreshToken', refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            path: `/pgrc/api/v1/users/${userId}`,
            maxAge: 24 * 60 * 60 * 1000
        });

        res.redirect(`/pgrc/google-callback.html?user-id=${userId}`);
    } catch (err)
    {
        console.error(err);
        res.redirect("/pgrc/login.html");
    }
});

export default router;
