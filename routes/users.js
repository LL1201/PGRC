const express = require("express");
const router = express.Router();
const emailValidator = require("email-validator");
const bcrypt = require('bcryptjs');
const { getDb } = require('../db/db.js');
const { sendConfirmationMail, sendUserDeletionMail } = require('../utils/mail.js');
const { verifyRefreshToken } = require("../utils/authUtil");
const authenticateToken = require('../middleware/authMiddleware');
const crypto = require('crypto');

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

//per l'eliminazione viene richiesto anche il refresh token (security purpose)
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

router.get('/:userId', authenticateToken, async (req, res) =>
{
    const db = getDb();
    const userObjectId = req.userObjectId;
    const reqUserObjectId = req.reqUserObjectId;

    //solo l'utente può vedere e modificare le proprie info
    //TODO - miglioramento futuro, permettere ad altri utenti di interagire con altri
    if (!userObjectId.equals(reqUserObjectId))
        return res.status(403).json({ message: 'You can only view and edit your own profile.' });


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
            return res.status(404).json({ message: 'user not found in local database.' });

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
        return res.status(400).json({ message: 'At least one field (username or email) must be provided.' });

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

module.exports = router;
