import passport from 'passport'
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { getDb } from '../db/db.js';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

passport.use(
    new GoogleStrategy(
        {
            clientID: GOOGLE_CLIENT_ID,
            clientSecret: GOOGLE_CLIENT_SECRET,
            callbackURL: "https://www.lloner.it/pgrc/api/v1/auth/google/callback",
        },
        async function (token, tokenSecret, profile, done)
        {
            try
            {
                // Per ottenere l'email dal profilo Google:
                const email = profile.emails && profile.emails.length > 0 ? profile.emails[0].value : null;

                if (!email)
                    return done(new Error('Email non trovata nel profilo Google'), null);

                const db = getDb();
                const usersCollection = db.collection('users');
                let user = await usersCollection.findOne({ email: email });

                if (user)
                {
                    //se l'utente esiste ma non ha il googleId aggiorna il documento
                    if (!user.googleId)
                    {
                        await usersCollection.updateOne(
                            { _id: user._id },
                            { $set: { googleId: profile.id } }
                        );
                        //restituisce l'utente a Passport
                        user.googleId = profile.id;
                    }
                    return done(null, user);
                }
                else
                {
                    //se non esiste l'utente ne crea uno nuovo, in questo caso non serve verifica via mail
                    const newUserDocument = {
                        email: email,
                        username: profile.displayName || profile.name.givenName || 'Utente Google',
                        googleId: profile.id,
                        verified: true,
                        createdAt: new Date()
                    };
                    const result = await usersCollection.insertOne(newUserDocument);
                    const newUser = { ...newUserDocument, _id: result.insertedId };

                    //crea anche il ricettario personale
                    await db.collection('personalCookbooks').insertOne({ userId: newUser._id, recipes: [] });

                    return done(null, newUser);
                }
            } catch (err)
            {
                return done(err, null);
            }
        }
    )
);

export default passport;