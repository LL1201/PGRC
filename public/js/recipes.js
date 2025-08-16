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

        if (recipes && recipes.length > 0)
        {
            recipes.forEach(recipe =>
            {
                const recipeCard = document.createElement('div');
                recipeCard.classList.add('col-lg-3', 'col-md-4', 'col-sm-6', 'mb-3');
                recipeCard.innerHTML = `
                    <div class="recipe-card h-100">
                        <img src="${recipe.mealThumb || 'https://dummyimage.com/200'}" alt="${recipe.name}" class="card-img-top">
                        <div class="recipe-card-content">
                            <h3>${recipe.name}</h3>
                            <p>${recipe.category || 'N/A'} | ${recipe.area || 'N/A'}</p>
                            <button class="btn primary-btn view-details-btn w-100 mb-2" data-mealid="${recipe.mealDbId}">Vedi Dettagli</button>
                            <button class="btn add-to-cookbook-btn w-100" data-mealid="${recipe.mealDbId}">Aggiungi al tuo ricettario</button>
                        </div>
                    </div>
                `;
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
            const noResultsCol = document.createElement('div');
            noResultsCol.classList.add('col-12', 'd-flex', 'align-items-center', 'justify-content-center');
            noResultsCol.style.minHeight = '300px';
            noResultsCol.innerHTML = '<p class="text-center text-muted fs-5">Nessuna ricetta trovata. Prova una ricerca diversa!</p>';
            recipesResultsContainer.appendChild(noResultsCol);
        }
    }

    async function fetchRecipes()
    {
        //in pratica il range è [start, end)
        const startIndex = (currentPage - 1) * itemsPerPage;
        let url = `/pgrc/api/recipes/search?start=${startIndex}&end=${startIndex + itemsPerPage}`;

        if (currentQuery.q)
            url += `&q=${encodeURIComponent(currentQuery.q)}`;
        else if (currentQuery.letter)
            url += `&letter=${encodeURIComponent(currentQuery.letter)}`;
        else
        {
            displayRecipes([]);
            updatePaginationControls(0);
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
        const totalPages = totalResults > 0 ? Math.ceil(totalResults / itemsPerPage) : 1;
        pageInfoSpan.textContent = `Pagina ${currentPage} di ${totalPages}`;
        prevPageBtn.disabled = currentPage === 1;
        nextPageBtn.disabled = currentPage >= totalPages;
    }

    //TODO - manca la specifica della nota quando aggiunto al ricettario
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
            body: JSON.stringify({ mealDbId: parseInt(mealDbId) })
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


    //event Listeners
    searchButton.addEventListener('click', () =>
    {
        //rimuovi 'active' da tutti i pulsanti lettera
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

        const welcomeCol = document.createElement('div');
        welcomeCol.classList.add('col-12', 'd-flex', 'align-items-center', 'justify-content-center');
        welcomeCol.style.minHeight = '300px';
        welcomeCol.innerHTML = '<p class="text-center text-muted fs-5">Inizia la tua ricerca per trovare ricette!</p>';
        recipesResultsContainer.innerHTML = '';
        recipesResultsContainer.appendChild(welcomeCol);

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

    //inizializzazione pagina
    generateAlphabetButtons();
    const initialCol = document.createElement('div');
    initialCol.classList.add('col-12', 'd-flex', 'align-items-center', 'justify-content-center');
    initialCol.style.minHeight = '300px';
    initialCol.innerHTML = '<p class="text-center text-muted fs-5">Inizia la tua ricerca per trovare ricette!</p>';
    recipesResultsContainer.appendChild(initialCol);
    updatePaginationControls(0);
});