import passport from 'passport'
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import crypto from 'crypto';

import User from '../models/User.js';
import Cookbook from '../models/Cookbook.js';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_OAUTH_CALLBACK_URI = process.env.GOOGLE_OAUTH_CALLBACK_URI;

passport.use(
    new GoogleStrategy(
        {
            clientID: GOOGLE_CLIENT_ID,
            clientSecret: GOOGLE_CLIENT_SECRET,
            callbackURL: GOOGLE_OAUTH_CALLBACK_URI,
        },
        async function (token, tokenSecret, profile, done)
        {
            try
            {
                // Per ottenere l'email dal profilo Google:
                const email = profile.emails && profile.emails.length > 0 ? profile.emails[0].value : null;

                if (!email)
                    return done(new Error('Email non trovata nel profilo Google'), null);

                let user = await User.findOne({ email: email });

                if (user)
                {
                    //se l'utente esiste ma non ha il googleId aggiorna il documento
                    if (!user.googleId)
                    {
                        await User.updateOne(
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
                    const newUser = new User({
                        email: email,
                        username: profile.displayName || profile.name.givenName || 'GoogleUser' + profile.id,
                        googleId: profile.id,
                        verified: true,
                        createdAt: new Date()
                    });

                    await newUser.save();

                    //crea anche il ricettario personale
                    await Cookbook.create({ userId: newUser._id, recipes: [] });

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