const path = require('path');
const fs = require('fs').promises;

async function htmlProcessor(req, res, next)
{
    //controlla se la richiesta è per un file del frontend
    //se è una / restituisce index.html
    const filePath = req.path === '/' ? '/index.html' : req.path;
    if (filePath.endsWith('.html'))
    {
        try
        {
            //legge il contenuto del file HTML richiesto
            let htmlContent = await fs.readFile(path.join(__dirname, '../public', filePath), 'utf-8');

            //legge il contenuto della navbar
            const navbarContent = await fs.readFile(path.join(__dirname, '../public', 'navbar.html'), 'utf-8');

            //sostituisce il placeholder con il contenuto della navbar
            const updatedHtml = htmlContent.replace('<!-- NAVBAR_PLACEHOLDER -->', navbarContent);

            //invia la pagina modificata al client
            res.send(updatedHtml);
        } catch (err)
        {
            console.error(`Errore nel processare il file HTML: ${err.message}`);
            next();
        }
    } else
    {
        next();
    }
};

module.exports = htmlProcessor;