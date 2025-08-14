document.addEventListener('DOMContentLoaded', () =>
{
    const searchInput = document.getElementById('search-input');
    const searchButton = document.getElementById('search-button');
    const resetButton = document.getElementById('reset-button');
    const letterButtonsContainer = document.querySelector('.letter-buttons');
    const recipesResultsContainer = document.getElementById('recipes-results');
    const noResultsMessage = document.getElementById('no-results-message');
    const prevPageBtn = document.getElementById('prev-page');
    const nextPageBtn = document.getElementById('next-page');
    const pageInfoSpan = document.getElementById('page-info');

    let currentPage = 1;
    const itemsPerPage = 12;
    let currentQuery = { q: '', letter: '' };

    //genera i pulsanti per il filtro alfabetico e gestisce il loro evento di click
    function generateAlphabetButtons()
    {
        const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
        alphabet.forEach(letter =>
        {
            const button = document.createElement('button');
            button.classList.add('btn');
            button.textContent = letter;
            button.dataset.letter = letter; //li genera con l'attributo data-letter
            letterButtonsContainer.appendChild(button);

            button.addEventListener('click', () =>
            {
                //rimuove la classe css active da tutti i pulsanti lettera in modo da applicare lo stile corretto
                document.querySelectorAll('.letter-buttons .btn').forEach(btn => btn.classList.remove('active'));
                button.classList.add('active'); //aggiunge la classe css active al pulsante cliccato

                searchInput.value = '';
                currentPage = 1;
                currentQuery = { q: '', letter: letter };
                fetchRecipes();
            });
        });
    }

    //funzione per visualizzare le ricette
    function displayRecipes(recipes)
    {
        recipesResultsContainer.innerHTML = ''; //pulisce i risultati precedenti
        noResultsMessage.style.display = 'none';

        if (recipes && recipes.length > 0)
        {
            recipes.forEach(recipe =>
            {
                const recipeCard = document.createElement('div');
                recipeCard.classList.add('recipe-card');
                recipeCard.innerHTML = `
                    <img src="${recipe.mealThumb || 'https://dummyimage.com/200'}" alt="${recipe.name}">
                    <div class="recipe-card-content">
                        <h3>${recipe.name}</h3>
                        <p>${recipe.category || 'N/A'} | ${recipe.area || 'N/A'}</p>
                        <button class="btn primary-btn view-details-btn" data-mealid="${recipe.mealDbId}">Vedi Dettagli</button>
                        <button class="btn add-to-cookbook-btn" data-mealid="${recipe.mealDbId}">Aggiungi al tuo ricettario</button>
                    </div>
                `; //TODO - continuare con l'aggiunta della ricetta al ricettario, il bottone sopra qua aggiunto
                recipesResultsContainer.appendChild(recipeCard);
            });

            //aggiunge event listener ai nuovi pulsanti per i dettagli delle ricette
            document.querySelectorAll('.view-details-btn').forEach(button =>
            {
                button.addEventListener('click', (event) =>
                {
                    const mealDbId = event.target.dataset.mealid;
                    window.open('recipeDetails.html?id=' + mealDbId).focus();
                });
            });

            //event listener per il bottone per aggiungere al proprio ricettario
            document.querySelectorAll('.add-to-cookbook-btn').forEach(button =>
            {
                if (authUtils.isAuthenticated())
                    button.addEventListener('click', (event) =>
                    {
                        button.disabled = false;
                        const mealDbId = event.target.dataset.mealid;
                        addToCookbook(mealDbId);
                    });
                else
                    button.disabled = true;
            });
        } else
        {
            noResultsMessage.style.display = 'block';
        }
    }

    async function fetchRecipes()
    {
        //const token = localStorage.getItem('accessToken');

        //in pratica il range è [start, end)
        const startIndex = (currentPage - 1) * itemsPerPage;
        let url = `/pgrc/api/recipes/search?start=${startIndex}&end=${startIndex + itemsPerPage}`;

        if (currentQuery.q)
            url += `&q=${encodeURIComponent(currentQuery.q)}`;
        else if (currentQuery.letter)
            url += `&letter=${encodeURIComponent(currentQuery.letter)}`;
        else
        {
            //TODO
            // Se non c'è query o lettera, potresti caricare ricette recenti o popolari
            // O mostrare un messaggio di invito alla ricerca
            displayRecipes([]); // Non caricare nulla se non c'è una query iniziale
            updatePaginationControls(0); // Disabilita i controlli
            return;
        }

        try
        {
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                }
            });

            if (response.ok)
            {
                const data = await response.json();
                displayRecipes(data.recipes);
                updatePaginationControls(data.total);
            } else
            {
                const errorData = await response.json();
                console.error('Error fetching recipes:', errorData.message);
                displayRecipes([]); // Mostra array vuoto in caso di errore
                noResultsMessage.textContent = errorData.message || 'Errore nel recupero delle ricette.';
                noResultsMessage.style.display = 'block';
                updatePaginationControls(0);
            }
        } catch (error)
        {
            console.error('Network error fetching recipes:', error);
            displayRecipes([]);
            noResultsMessage.textContent = 'Si è verificato un errore di rete. Controlla la tua connessione.';
            noResultsMessage.style.display = 'block';
            updatePaginationControls(0);
        }
    }

    //funzione per aggiornare i controlli di paginazione
    function updatePaginationControls(totalResults)
    {
        //se totalResult è maggiore di 0, allora calcola il numero di pagine totali, altrimenti mette 1 di 1
        pageInfoSpan.textContent = `Pagina ${currentPage} di ${totalResults > 0 ? Math.ceil(totalResults / itemsPerPage) : 1}`;
        prevPageBtn.disabled = currentPage === 1;
        nextPageBtn.disabled = totalResults <= itemsPerPage;
    }

    async function addToCookbook(mealDbId)
    {
        if (!authUtils.requireAuth()) return;

        const userId = localStorage.getItem('userId');
        const url = `/pgrc/api/users/${userId}/cookbook`;

        const response = await authUtils.authenticatedFetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ mealDbId: parseInt(mealDbId), privateNote: "ss" })
        });

        if (!response) return;

        const data = await response.json();

        if (response.ok)
        {
            alertMsgs.showSuccess(data.message);
        } else
        {
            alertMsgs.showError(data.message);
        }
    }


    // Event Listeners
    searchButton.addEventListener('click', () =>
    {
        // Rimuovi 'active' da tutti i pulsanti lettera
        document.querySelectorAll('.letter-buttons .btn').forEach(btn => btn.classList.remove('active'));
        currentPage = 1;
        currentQuery = { q: searchInput.value.trim(), letter: '' };
        fetchRecipes();
    });

    searchInput.addEventListener('keypress', (event) =>
    {
        if (event.key === 'Enter')
        {
            searchButton.click();
        }
    });

    resetButton.addEventListener('click', () =>
    {
        searchInput.value = '';
        document.querySelectorAll('.letter-buttons .btn').forEach(btn => btn.classList.remove('active'));
        currentPage = 1;
        currentQuery = { q: '', letter: '' };
        displayRecipes([]); // Pulisce i risultati
        noResultsMessage.textContent = 'Inizia la tua ricerca per trovare ricette!';
        noResultsMessage.style.display = 'block';
        updatePaginationControls(0);
    });

    prevPageBtn.addEventListener('click', () =>
    {
        if (currentPage > 1)
        {
            currentPage--;
            fetchRecipes();
        }
    });

    nextPageBtn.addEventListener('click', () =>
    {
        currentPage++;
        fetchRecipes();
    });

    // Inizializzazione della pagina
    generateAlphabetButtons();
    // Non avviare una ricerca automatica al caricamento, aspetta l'input dell'utente
    noResultsMessage.textContent = 'Inizia la tua ricerca per trovare ricette!';
    noResultsMessage.style.display = 'block';
    updatePaginationControls(0); // Disabilita controlli inizialmente
});