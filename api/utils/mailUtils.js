import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

const FRONTEND_URL = process.env.FRONTEND_URL;
const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;

const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: 465,
    secure: true, // SSL
    auth: {
        user: SMTP_USER,
        pass: SMTP_PASS
    }
});

export async function sendConfirmationMail(mailTo, token, userId)
{
    const mailOptions = {
        from: SMTP_USER,
        to: mailTo,
        subject: 'Conferma il tuo account',
        text: `Ciao, \n\nper confermare la tua registrazione a PGRC visita il seguente link: ${FRONTEND_URL}/verify-account.html?confirmationToken=${token}&userId=${userId}`
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

export function sendPasswordResetMail(mailTo, token, userId)
{
    const mailOptions = {
        from: SMTP_USER,
        to: mailTo,
        subject: 'Reimposta la tua password',
        text: `Ciao, \n\nper reimpostare la tua password di Party Join visita il seguente link: ${FRONTEND_URL}/password-reset.html?resetToken=${token}&userId=${userId}`
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

export function sendAccountDeletionEmail(mailTo, token, userId)
{
    const mailOptions = {
        from: SMTP_USER,
        to: mailTo,
        subject: 'Conferma di cancellazione account',
        text: `Ciao, \n\nper confermare la cancellazione del tuo account PGRC visita il seguente link: ${FRONTEND_URL}/account-deletion.html?deleteToken=${token}&userId=${userId}`
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

export function sendAccountDeletionConfirmationEmail(mailTo)
{
    const mailOptions = {
        from: SMTP_USER,
        to: mailTo,
        subject: 'Conferma di cancellazione account',
        text: `Ciao, \n\nquesta email ti conferma l'effettiva cancellazione di tutti i dati associati al tuo account PGRC.`
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
