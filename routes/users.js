const express = require("express");
const router = express.Router();
const emailValidator = require("email-validator");
const bcrypt = require('bcryptjs');
const { getDb } = require('../db/db.js');
const { sendConfirmationMail, sendUserDeletionMail } = require('../utils/mail.js');
const { verifyRefreshToken } = require("../utils/authUtil");
const authenticateToken = require('../middleware/authMiddleware');
const crypto = require('crypto');

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
    const db = getDb();
    const user = req.body;

    if (!user || !user.email || !user.username || !user.password)
        return res.status(400).json({ message: 'All fields are required' });

    if (!emailValidator.validate(user.email))
        return res.status(400).json({ message: 'Invalid email format' });

    //check if username or email already exists on db
    const existingUser = await db.collection('users').findOne({
        $or: [
            { email: user.email },
            { username: user.username }
        ]
    });

    if (existingUser)
        return res.status(409).json({ status: 'KO', message: 'Email or username already exists' });

    const pswHash = await bcrypt.hash(user.password, 10);

    //token esadecimale di 64 caratteri per la conferma dell'email
    const emailVerificationToken = crypto.randomBytes(32).toString('hex');
    //scadenza tra 30 minuti (ottiene il timestamp corrente in millisecondi e somma 30 minuti convertito in millisecondi)
    const emailVerificationTokenExpiration = new Date(Date.now() + 30 * 60 * 1000);

    //TODO - piatti preferiti
    const newUserDocument = {
        email: user.email,
        username: user.username,
        hashedPassword: pswHash,
        //piattiPreferiti: [],
        verified: false,
        createdAt: new Date(),
        verificationToken: emailVerificationToken,
        verificationTokenExpiration: emailVerificationTokenExpiration
    };

    try
    {
        const result = await db.collection('users').insertOne(newUserDocument);
        console.log(`User registered successfully. ID: ${result.insertedId}`);

        await sendConfirmationMail(newUserDocument.email, emailVerificationToken);

        res.status(202).json({ message: 'Verification email sent. Please check your inbox and spam folder.', userId: result.insertedId });
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
router.delete("/:userId", authenticateToken, async (req, res) =>
{
    const db = getDb();
    const userObjectId = req.userObjectId;
    const reqUserObjectId = req.reqUserObjectId;

    const password = req.body && req.body.password;
    const refreshToken = req.cookies.refreshToken;

    if (!refreshToken)
        return res.status(400).json({ message: 'Refresh token is required.' });

    if (!await verifyRefreshToken(refreshToken))
        return res.status(401).json({ message: 'Invalid refresh token.' });

    //controlla che la password sia presente
    if (!password)
        return res.status(400).json({ message: 'Password is required.' });

    try
    {
        if (!userObjectId.equals(reqUserObjectId))
            return res.status(403).json({ message: 'You can only delete your own account.' });

        //estraggo l'utente con tale id e verifico che la password inserita sia corretta
        const user = await db.collection('users').findOne({ _id: userObjectId });
        if (!user || !await bcrypt.compare(password, user.hashedPassword))
            return res.status(401).json({
                message: 'Cannot delete account. Invalid password or user not found.'
            });

        //elimina tutti i refreshToken associati all'utente, il suo cookbook e le sue review
        await db.collection('refreshTokens').deleteMany({ userId: userObjectId });
        await db.collection('personalCookbooks').deleteOne({ userId: userObjectId });
        await db.collection('reviews').deleteMany({ authorUserId: userObjectId });

        //eliminazione effettiva dell'utente
        const deleteUserResult = await db.collection('users').deleteOne({ _id: userObjectId });

        //controlla che l'operazione di eliminazione abbia avuto esito positivo
        if (deleteUserResult.deletedCount === 0)
        {
            console.warn(`User with ID ${userObjectId} was found but not deleted.`);
            return res.status(404).json({ message: 'User not found or already deleted.' });
        }

        sendUserDeletionMail(user.email);
        console.log(`User with ID: ${userObjectId} deleted successfully.`);
        res.status(200).json({ message: 'User successfully deleted.' });
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
router.get('/:userId', authenticateToken, async (req, res) =>
{
    const db = getDb();
    const userObjectId = req.userObjectId;
    const reqUserObjectId = req.reqUserObjectId;

    //solo l'utente può vedere le proprie info
    //TODO - miglioramento futuro, permettere ad altri utenti di interagire con altri
    if (!userObjectId.equals(reqUserObjectId))
        return res.status(403).json({ message: 'You can only view your own profile.' });


    if (!reqUserObjectId)
        return res.status(400).json({ message: 'User ID is required.' });

    try
    {
        const projection = {
            email: 1,
            username: 1
        };

        const user = await db.collection('users').findOne(
            { _id: reqUserObjectId },
            { projection }
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
router.patch("/:userId", authenticateToken, async (req, res) =>
{
    //TODO - valutare il cambio mail con conferma via email
    const db = getDb();
    const userObjectId = req.userObjectId;
    const reqUserObjectId = req.reqUserObjectId;
    const { username, email } = req.body;

    if (!userObjectId.equals(reqUserObjectId))
        return res.status(403).json({ message: 'You can only update your own account.' });

    if (!username && !email)
        return res.status(400).json({ message: 'At least one populated field (username or email) must be provided.' });

    //validazione email se fornita
    if (email && !emailValidator.validate(email))
        return res.status(400).json({ message: 'Invalid email format.' });

    //controllo unicità username/email se forniti
    const query = [];
    if (username) query.push({ username });
    if (email) query.push({ email });
    if (query.length > 0)
    {
        const existing = await db.collection('users').findOne({
            $or: query,
            _id: { $ne: userObjectId }
        });
        if (existing)
            return res.status(409).json({ message: 'Email or username already exists.' });
    }

    //costruisce la query per l'update
    const updateFields = {};
    if (username) updateFields.username = username;
    if (email) updateFields.email = email;

    try
    {
        const updateResult = await db.collection('users').updateOne(
            { _id: userObjectId },
            { $set: updateFields }
        );

        if (updateResult.modifiedCount === 0)
            return res.status(400).json({ message: 'No changes made or user not found.' });

        res.status(200).json({ message: 'User data updated successfully.' });
    } catch (e)
    {
        console.error("Error updating user data:", e);
        res.status(500).json({ message: 'An internal server error occurred during user update.' });
    }
});

/**
 * @swagger
 * /api/auth/access-token/verify-token:
 *   get:
 *     summary: Verify if access token is valid
 *     tags:
 *       - Auth
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Token is valid
 *       404:
 *         description: User not found
 *       500:
 *         description: Internal server error
 */
// router.get("/:userId/access-tokens/verify-token", authenticateToken, async (req, res) =>
// {
//     try
//     {
//         const db = getDb();
//         const user = await db.collection('users').findOne(
//             { _id: req.userObjectId },
//             { projection: { _id: 1, username: 1, email: 1 } } // Seleziona solo i campi che vuoi restituire
//         );

//         if (!user)
//         {
//             return res.status(404).json({ message: 'User not found.' });
//         }

//         res.status(200).json({
//             message: 'Token is valid.'
//         });
//     } catch (error)
//     {
//         console.error('Error in /verify-token endpoint:', error);
//         res.status(500).json({ message: 'Internal server error.' });
//     }
// });*/

module.exports = router;
