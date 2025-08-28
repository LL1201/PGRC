import { verifyToken } from '../utils/authUtils.js';
import dotenv from 'dotenv';
import { createObjectId, isValidObjectId } from '../utils/objectId.js';
dotenv.config();

async function authenticateUser(req, res, next, authIsOptional = false)
{
    const authHeader = req.headers['authorization'];
    const { userId } = req.params;

    //per la gestione successiva, viene aggiunto alla richiesta il campo dello user id nell'URL e anche l'oggetto relativo ObjectID
    //req.reqUserId contiene l'id specificato nell'URL
    //req.reqUserObjectId contiene l'id di tipo ObjectID dell'utente specificato nell'URL
    if (userId)
    {
        if (!isValidObjectId(userId))
            return res.status(400).json({ message: 'Invalid User ID format in URL. Must be a valid ObjectId.' });

        req.reqUserObjectId = createObjectId(userId);
        req.reqUserId = userId;
    }
    let token;

    //controllo che sia presente un auth header e che sia nel formato Bearer ...
    if (authHeader && authHeader.startsWith('Bearer '))
        token = authHeader.split(' ')[1];

    //se l'auth è obbligatoria e il token è null restituisce errore
    //se l'auth è opzionale e il token è null va avanti
    if (!authIsOptional && !token)
        return res.status(401).json({ message: 'Access token required.' });
    else if (!token && authIsOptional)
        return next();

    const decoded = await verifyToken(token);
    if (!decoded)
        return res.status(401).json({ message: 'Invalid or expired access token.' });

    //req.userId contiene l'id dell'utente associato al JWT passato
    //req.userObjectId contiene l'id associato al JWT in formato ObjectId
    if (typeof decoded.userId === 'string' && isValidObjectId(decoded.userId))
    {
        req.userObjectId = createObjectId(decoded.userId);
        req.userId = decoded.userId;
    } else
    {
        console.error(`Decoded userId is not a valid ObjectId string: ${decoded.userId}`);
        return res.status(403).json({ message: 'Invalid user ID in token payload.' });
    }
    next();
}

export default authenticateUser;