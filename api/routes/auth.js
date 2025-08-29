//node & express
import express from "express";
import emailValidator from "email-validator";
import bcrypt from "bcryptjs";
import dotenv from 'dotenv';
import crypto from 'crypto';
import passport from '../config/passport.js';


//utils
import { generateAccessToken, generateRefreshToken, AuthMethod } from "../utils/authUtils.js";
import { sendPasswordResetMail } from '../utils/mailUtils.js';

import User from '../models/User.js';

dotenv.config();

const router = express.Router();
const HASH_SALT = parseInt(process.env.HASH_SALT);
const PASSWORD_RESET_TOKEN_EXPIRATION = parseInt(process.env.PASSWORD_RESET_TOKEN_EXPIRATION);

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
        res.cookie('refreshToken', refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            path: `/pgrc/api/v1/users/${userId}`,
            maxAge: 24 * 60 * 60 * 1000
        });
        res.redirect('/pgrc/my-profile.html');
    }
);

export default router;
