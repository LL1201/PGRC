const { verifyToken } = require('../utils/authUtil');
require('dotenv').config();
const { ObjectId } = require('mongodb');

function authenticateToken(req, res, next)
{
    const authHeader = req.headers['authorization'];
    const { userId } = req.params;

    //per la gestione successiva, viene aggiunto alla richiesta il campo dello user id nell'URL e anche l'oggetto relativo ObjectID
    //req.reqUserId contiene l'id specificato nell'URL
    //req.reqUserObjectId contiene l'id di tipo ObjectID dell'utente specificato nell'URL
    if (userId)
    {
        if (!ObjectId.isValid(userId))
            return res.status(400).json({ message: 'Invalid User ID format in URL. Must be a valid ObjectId.' });

        req.reqUserObjectId = new ObjectId(userId);
        req.reqUserId = userId;
    }

    let token;

    //controllo che sia presente un auth header e che sia nel formato Bearer ...
    if (authHeader && authHeader.startsWith('Bearer '))
        token = authHeader.split(' ')[1];

    if (token == null)
        return res.status(401).json({ message: 'Access token required.' });

    const decoded = verifyToken(token);
    if (!decoded)
        return res.status(401).json({ message: 'Invalid or expired access token.' });

    //req.userId contiene l'id dell'utente associato al JWT passato
    //req.userObjectId contiene l'id associato al JWT in formato ObjectId
    if (typeof decoded.userId === 'string' && ObjectId.isValid(decoded.userId))
    {
        req.userObjectId = new ObjectId(decoded.userId);
        req.userId = decoded.userId;
    } else
    {
        console.error(`Decoded userId is not a valid ObjectId string: ${decoded.userId}`);
        return res.status(403).json({ message: 'Invalid user ID in token payload.' });
    }
    next();
}

module.exports = authenticateToken;