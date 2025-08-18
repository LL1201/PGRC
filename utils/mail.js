const nodemailer = require('nodemailer');
require('dotenv').config()

const FRONTEND_URL = process.env.FRONTEND_URL;
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;

const transporter = nodemailer.createTransport({
    host: 'smtps.aruba.it',
    port: 465,
    secure: true, // SSL
    auth: {
        user: SMTP_USER,
        pass: SMTP_PASS
    }
});

async function sendConfirmationMail(mailTo, token)
{
    const mailOptions = {
        from: SMTP_USER,
        to: mailTo,
        subject: 'Conferma il tuo account',
        text: `Ciao, \nPer confermare la tua registrazione a PGRC visita il seguente link: ${FRONTEND_URL}/verify-account.html?token=${token}`
    };

    try
    {
        await transporter.sendMail(mailOptions);
        console.log('Email sent');
    } catch (error)
    {
        throw new Error('Failed to send verification email.');
    }
}

function sendPasswordResetMail(mailTo, token)
{
    const mailOptions = {
        from: SMTP_USER,
        to: mailTo,
        subject: 'Reimposta la tua password',
        text: `Ciao, \nPer reimpostare la tua password di Party Join visita il seguente link: ${FRONTEND_URL}/verify-account?token=${verificationToken}`
    };

    transporter.sendMail(mailOptions, function (error, info)
    {
        if (error)
        {
            console.log('Error:', error);
        } else
        {
            console.log('Email sent:', info.response);
        }
    });
}

function sendUserDeletionMail(mailTo)
{
    const mailOptions = {
        from: SMTP_USER,
        to: mailTo,
        subject: 'Conferma di cancellazione account',
        text: `Ciao, \nQuesta email ti conferma l'effettiva cancellazione di tutti i dati associati al tuo account PGRC.`
    };

    transporter.sendMail(mailOptions, function (error, info)
    {
        if (error)
        {
            console.log('Error:', error);
        } else
        {
            console.log('Email sent:', info.response);
        }
    });
}

module.exports = { sendConfirmationMail, sendPasswordResetMail, sendUserDeletionMail }