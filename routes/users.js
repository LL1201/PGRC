const express = require("express");
const router = express.Router();
const emailValidator = require("email-validator");
const bcrypt = require('bcryptjs');
const { getDb } = require('../db/db.js');
const { sendConfirmationMail } = require('../utils/mail.js');
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

//middleware di auth richiesto per garantire che l'utente ad eliminare l'account sia solo il richiedente
//TODO - bisogna gestire l'eliminazione di tutti i token dell'utente, cookbooks e le review (valutare)
//TODO - valutare anche l'invio di altre mail
router.delete("/:userId", authenticateToken, async (req, res) =>
{
    const db = getDb();
    const userObjectId = req.userObjectId;
    const { password } = req.body;

    try
    {
        if (!userObjectId.equals(new ObjectId(req.params.userId)))
            return res.status(403).json({ message: 'You can only delete your own account.' });

        //estraggo l'utente con tale id e verifico che la password inserita sia corretta
        const user = await db.collection('users').findOne({ _id: userObjectId });
        if (!user || !await bcrypt.compare(password, user.hashedPassword))
            return res.status(401).json({
                message: 'Cannot delete account. Invalid password or user not found.'
            });


        const deleteUserResult = await db.collection('users').deleteOne({ _id: userObjectId });

        //controlla che l'operazione di eliminazione abbia avuto esito positivo
        if (deleteUserResult.deletedCount === 0)
        {
            console.warn(`User with ID ${userObjectId} was found but not deleted.`);
            return res.status(404).json({ message: 'User not found or already deleted.' });
        }

        console.log(`User with ID: ${userObjectId} deleted successfully.`);
        res.status(200).json({ message: 'User successfully deleted.' });
    } catch (e)
    {
        console.error("Error during user removal.", e);
        return res.status(500).json({ message: 'An internal server error occurred during user removal. Please try again later.' });
    }
});

module.exports = router;
