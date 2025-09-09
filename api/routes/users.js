//node & express
import express from "express";
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

//utils
import emailValidator from "email-validator";
import { sendConfirmationMail, sendAccountDeletionEmail, sendAccountDeletionConfirmationEmail } from '../utils/mailUtils.js';
import { AuthMethod, verifyRefreshToken, generateAccessToken, removeRefreshToken } from "../utils/authUtils.js";

import User from '../models/User.js';
import RefreshToken from "../models/RefreshToken.js";
import Review from "../models/Review.js";

//middlewares
import { authenticateUser, authenticateUserOptionally } from '../middlewares/authMiddleware.js';

const router = express.Router();
const HASH_SALT = parseInt(process.env.HASH_SALT);
const ACCOUNT_CONFIRMATION_TOKEN_EXPIRATION = parseInt(process.env.ACCOUNT_CONFIRMATION_TOKEN_EXPIRATION) || 3600000; //default 1h

/**
 * @swagger
 * /api/v1/users:
 *   post:
 *     summary: Register a new user
 *     tags:
 *       - Users
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               username:
 *                 type: string
 *                 example: johndoe
 *               email:
 *                 type: string
 *                 example: johndoe@example.com
 *               password:
 *                 type: string
 *                 example: password123
 *     responses:
 *       202:
 *         description: Verification email sent
 *       400:
 *         description: All fields are required or invalid email format
 *       409:
 *         description: Email or username already exists
 *       500:
 *         description: Internal server error
 */
router.post("/", async (req, res) =>
{
    const user = req.body;

    if (!user || !user.email || !user.username || !user.password)
        return res.status(400).json({ message: 'All fields are required' });

    if (!emailValidator.validate(user.email))
        return res.status(400).json({ message: 'Invalid email format' });

    //check if username or email already exists on db
    const existingUser = await User.findOne({
        $or: [
            { email: user.email },
            { username: user.username }
        ]
    });

    if (existingUser)
        return res.status(409).json({ status: 'KO', message: 'Email or username already exists' });

    const pswHash = await bcrypt.hash(user.password, HASH_SALT);

    //token esadecimale di 64 caratteri per la conferma dell'email
    const emailVerificationToken = crypto.randomBytes(32).toString('hex');
    //scadenza tra 30 minuti (ottiene il timestamp corrente in millisecondi e somma 30 minuti convertito in millisecondi)
    const emailVerificationTokenExpiration = new Date(Date.now() + 30 * 60 * 1000);

    const newUserDocument = {
        email: user.email,
        username: user.username,
        hashedPassword: pswHash,
        verificationData: {
            token: emailVerificationToken,
            expiration: emailVerificationTokenExpiration
        }
    };

    const newUser = new User(newUserDocument);

    try
    {
        const result = await newUser.save();
        console.log(`User registered successfully. ID: ${result._id}`);

        await sendConfirmationMail(newUserDocument.email, emailVerificationToken);

        res.status(202).json({ message: 'Verification email sent. Please check your inbox and spam folder.', userId: result._id });
    } catch (e)
    {
        console.error("Database or email error during user registration:", e);
        return res.status(500).json({ message: 'An internal server error occurred during registration. Please try again later.' });
    }
});

/**
 * @swagger
 * /api/v1/users/{userId}:
 *   delete:
 *     summary: Delete the authenticated user's account
 *     tags:
 *       - Users
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *       - in: header
 *         name: Authorization
 *         required: true
 *         schema:
 *           type: string
 *         description: Bearer access token (Bearer &lt;access_token&gt;)
 *       - in: cookie
 *         name: refreshToken
 *         required: true
 *         schema:
 *           type: string
 *         description: Refresh token cookie
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               password:
 *                 type: string
 *                 example: password123
 *     responses:
 *       200:
 *         description: User successfully deleted
 *       400:
 *         description: Refresh token or password is required
 *       401:
 *         description: Invalid refresh token or password
 *       403:
 *         description: You can only delete your own account
 *       404:
 *         description: User not found or already deleted
 *       500:
 *         description: Internal server error
 */
router.delete("/:userId", authenticateUserOptionally, async (req, res) =>
{
    //l'auth è opzionale perché quando richiedo l'eliminazione account faccio un logout allo user e quindi quando clicca il link
    //via mail non ci sono più le informazioni sul local storage
    const reqUserObjectId = req.reqUserObjectId;
    const authMethod = req.authMethod;

    if (req.userObjectId)
    {
        if (!req.userObjectId.equals(reqUserObjectId))
            return res.status(403).json({ message: 'You can only delete your own account.' });
    }

    const password = req.header('X-User-Password');
    const deleteToken = req.header('X-User-Delete-Token');

    try
    {
        //estraggo l'utente con tale id
        let user = await User.findById(reqUserObjectId);

        if (!user)
            return res.status(404).json({ message: 'User not found or already deleted.' });

        if (password || authMethod === AuthMethod.Google)
        {
            if (deleteToken)
                return res.status(400).json({ message: 'Cannot provide both password and delete token.' });

            if (authMethod === AuthMethod.Email)
            {
                if (!password)
                    return res.status(400).json({ message: 'Password is required for email-authenticated users.' });

                if (!await bcrypt.compare(password, user.hashedPassword))
                    return res.status(401).
                        set('WWW-Authenticate', 'Bearer realm="Access to the protected API"').json({ message: 'Invalid password.' });
            }

            //genera un token
            //non uso JWT in questo caso per evitare la dipendenza da un token che si autodistrugge
            const newDeleteToken = crypto.randomBytes(32).toString('hex');
            const hashedDeleteToken = await bcrypt.hash(newDeleteToken, HASH_SALT);
            const deleteTokenExpiration = new Date(Date.now() + ACCOUNT_CONFIRMATION_TOKEN_EXPIRATION);

            await User.updateOne(
                { _id: user._id },
                {
                    $set: {
                        deleteAccountData: {
                            token: hashedDeleteToken,
                            expiration: deleteTokenExpiration
                        }
                    }
                }
            );

            //TODO vedere di errori invio mail
            sendAccountDeletionEmail(user.email, newDeleteToken, user._id);
            console.log(`Deletion confirmation email sent for user ID: ${reqUserObjectId}`);

            return res.status(202).json({ message: 'Deletion confirmation email sent. Please check your inbox to confirm.' });
        } else if (deleteToken)
        {
            if (!user.deleteAccountData || !user.deleteAccountData.token || !user.deleteAccountData.expiration)
                return res.status(400).json({ message: 'Invalid or expired delete token. Please restart the deletion process.' });

            if (!await bcrypt.compare(deleteToken, user.deleteAccountData.token) || user.deleteAccountData.expiration < new Date())
            {
                //invalida refresh per prevenire utilizzi futuri
                await User.updateOne(
                    { _id: user._id },
                    { $unset: { deleteAccountData: "" } }
                );
                return res.status(401).
                    set('WWW-Authenticate', 'Bearer realm="Access to the protected API"').json({ message: 'Invalid or expired delete token. Please restart the deletion process.' });
            }

            //elimina tutti i refreshToken associati all'utente, il suo cookbook e le sue review   
            await RefreshToken.deleteMany({ userId: reqUserObjectId });
            await Review.deleteMany({ authorUserId: reqUserObjectId });
            const deleteUserResult = await User.deleteOne({ _id: reqUserObjectId });

            if (deleteUserResult.deletedCount === 0)
            {
                console.warn(`User with ID ${reqUserObjectId} was found but not deleted.`);
                return res.status(404).json({ message: 'User not found or already deleted.' });
            }

            sendAccountDeletionConfirmationEmail(user.email);
            console.log(`User with ID: ${reqUserObjectId} deleted successfully.`);

            return res.status(200).json({ message: 'User and all associated data successfully deleted.' });
        }

        //default se non sono stati forniti né token né password
        return res.status(400).json({ message: 'Password or a valid delete token is required.' });
    } catch (e)
    {
        console.error("Error during user removal.", e);
        return res.status(500).json({ message: 'An internal server error occurred during user removal. Please try again later.' });
    }
});

/**
 * @swagger
 * /api/v1/users/{userId}:
 *   get:
 *     summary: Get authenticated user's profile
 *     tags:
 *       - Users
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *       - in: header
 *         name: Authorization
 *         required: true
 *         schema:
 *           type: string
 *         description: Bearer access token (Bearer &lt;access_token&gt;)
 *     responses:
 *       200:
 *         description: User profile data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 userId:
 *                   type: string
 *                 email:
 *                   type: string
 *                 username:
 *                   type: string
 *       400:
 *         description: User ID is required
 *       403:
 *         description: You can only view your own profile
 *       404:
 *         description: User not found in local database
 *       500:
 *         description: Internal server error
 */
router.get('/:userId', authenticateUser, async (req, res) =>
{
    //TODO HATEOS cookbook
    const userObjectId = req.userObjectId;
    const reqUserObjectId = req.reqUserObjectId;

    if (!reqUserObjectId)
        return res.status(400).json({ message: 'User ID is required.' });

    //solo l'utente può vedere le proprie info
    if (!userObjectId.equals(reqUserObjectId))
        return res.status(403).json({ message: 'You can only view your own profile.' });

    try
    {
        const projection = {
            email: 1,
            username: 1
        };

        const user = await User.findOne(
            { _id: reqUserObjectId },
            projection
        );

        if (!user)
            return res.status(404).json({ message: 'User not found in local database.' });

        res.status(200).json({
            userId: user._id,
            email: user.email,
            username: user.username
        });

    } catch (error)
    {
        console.error(`Error fetching user ${reqUserObjectId} details from MongoDB:`, error);
        res.status(500).json({ message: 'Internal server error fetching user details.' });
    }
});

/**
 * @swagger
 * /api/v1/users/{userId}:
 *   patch:
 *     summary: Update authenticated user's username and/or email
 *     tags:
 *       - Users
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *       - in: header
 *         name: Authorization
 *         required: true
 *         schema:
 *           type: string
 *         description: Bearer access token (Bearer &lt;access_token&gt;)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               username:
 *                 type: string
 *                 example: newusername
 *               email:
 *                 type: string
 *                 example: newemail@example.com
 *     responses:
 *       200:
 *         description: User data updated successfully
 *       400:
 *         description: No changes made or user not found, or invalid email format
 *       403:
 *         description: You can only update your own account
 *       409:
 *         description: Email or username already exists
 *       500:
 *         description: Internal server error
 */
router.patch("/:userId", authenticateUserOptionally, async (req, res) =>
{
    //TODO - valutare il cambio mail con conferma via email      
    const reqUserObjectId = req.reqUserObjectId;
    const { username, email, confirmed, confirmationToken, password, resetPasswordToken } = req.body;

    if (username || email)
        if (!req.userObjectId)
            return res.status(401).
                set('WWW-Authenticate', 'Bearer realm="Access to the protected API"').json({ message: 'Unauthorized. Please log in.' });

    if (confirmed && !confirmationToken)
        return res.status(400).json({ message: 'Confirmation token and confirmation value are both required when confirming account.' });

    if (password && !resetPasswordToken)
        return res.status(400).json({ message: 'Reset token and password are both required when resetting password.' });

    if (username || email)
        if (!req.userObjectId)
            return res.status(401).
                set('WWW-Authenticate', 'Bearer realm="Access to the protected API"').json({ message: 'Unauthorized. Please log in.' });
        else
            if (!req.userObjectId.equals(reqUserObjectId))
                return res.status(403).json({ message: 'You can only edit your own account.' });


    if (email && !emailValidator.validate(email))
        return res.status(400).json({ message: 'Invalid email format.' });

    let query = [];
    let updateFields = {};
    if (username || email)
    {
        //controllo unicità username/email se forniti        
        if (username)
            query.push({ username });

        if (email)
            query.push({ email });

        if (query.length > 0)
        {
            const existing = await User.findOne({
                $or: query,
                _id: { $ne: reqUserObjectId }
            });
            if (existing)
                return res.status(409).json({ message: 'Email or username already exists.' });
        }

        //costruisce la query per l'update
        if (username)
            updateFields.username = username;

        if (email)
            updateFields.email = email;

        if (await updateUser(reqUserObjectId, updateFields))
        {
            return res.status(200).json({ message: 'User information updated successfully.' });
        }
    } else if (confirmed && confirmationToken)
    {
        const user = await User.findOne({
            _id: reqUserObjectId,
            verified: false,
            'verificationData.token': confirmationToken,
            'verificationData.expiration': { $gt: new Date() }
        });

        if (!user)
            return res.status(404).json({ message: 'Invalid, expired, or already used verification token.' });

        if (await updateUser(reqUserObjectId,
            { verified: true },
            {
                'verificationData.token': '',
                'verificationData.expiration': ''
            }))
        {
            return res.status(200).json({ status: 'OK', message: 'Account verified successfully! You can now log in.' });
        }

    } else if (password && resetPasswordToken)
    {
        if (!resetPasswordToken || !password || !reqUserObjectId)
            return res.status(400).json({ message: 'Reset token, new password and user ID are required.' });

        try
        {
            const user = await User.findOne({
                _id: reqUserObjectId,
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
            if (await updateUser(reqUserObjectId, { hashedPassword: newPasswordHash },
                {
                    'resetPasswordData.token': '',
                    'resetPasswordData.expiration': ''
                }))
            {
                console.log(`User ${user.email} reset password successfully.`);
                return res.status(200).json({ message: 'Password has been reset successfully. You can now log in.' });
            }
            //TODO controllare comportamento in caso di ritorno null della funzione updateUser
        } catch (e)
        {
            console.error("Error resetting password:", e);
            res.status(500).json({ message: 'An internal server error occurred.' });
        }
    }

    async function updateUser(userObjectId, updateFields, unsetFields = {})
    {
        try
        {
            let updateQuery = {};
            if (Object.keys(updateFields).length > 0)
                updateQuery.$set = updateFields;
            if (Object.keys(unsetFields).length > 0)
                updateQuery.$unset = unsetFields;

            const updateResult = await User.updateOne(
                { _id: userObjectId },
                updateQuery
            );

            if (updateResult.modifiedCount === 0)
            {
                res.status(400).json({ message: 'No changes made or user not found.' });
                return null;
            } else
            {
                return true;
            }
        } catch (e)
        {
            console.error("Error updating user data:", e);
            res.status(500).json({ message: 'An internal server error occurred during user update.' });
            return null;
        }
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
router.delete("/:userId/access-token", async (req, res) =>
{
    const refreshToken = req.cookies.refreshToken;
    const reqUserId = req.params.userId;

    if (!refreshToken)
        return res.status(400).json({ message: 'Refresh token is required.' });

    if (!await verifyRefreshToken(reqUserId, refreshToken))
        return res
            .status(401)
            .set('WWW-Authenticate', 'Bearer realm="Access to the protected API"')
            .json({ message: 'Invalid refresh token.' });

    try
    {
        if (await removeRefreshToken(refreshToken))
        {

            //invalida il cookie refreshToken impostado il suo valore a deleted e scadenza alla data 0        
            res.cookie('refreshToken', 'deleted', {
                path: '/api/v1/',
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
router.post("/:userId/access-token", async (req, res) =>
{
    const refreshToken = req.cookies.refreshToken;
    const reqUserId = req.params.userId;

    if (!refreshToken)
        return res.status(400).json({ message: 'Refresh token is required.' });

    try
    {
        const tokenData = await verifyRefreshToken(reqUserId, refreshToken);
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



export default router;
