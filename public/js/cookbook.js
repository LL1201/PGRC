document.addEventListener('DOMContentLoaded', async () =>
{
    const cookbookRecipesContainer = document.getElementById('cookbook-recipes');
    const prevPageBtnCookbook = document.getElementById('prev-page-cookbook');
    const nextPageBtnCookbook = document.getElementById('next-page-cookbook');
    const pageInfoSpanCookbook = document.getElementById('page-info-cookbook');

    let currentPageCookbook = 1;
    const itemsPerPageCookbook = 12;

    //per visualizzare le ricette nel ricettario
    function displayCookbookRecipes(recipes)
    {
        cookbookRecipesContainer.innerHTML = '';

        if (!recipes || recipes.length === 0)
        {
            const emptyCol = document.createElement('div');
            emptyCol.classList.add('col-12', 'd-flex', 'align-items-center', 'justify-content-center');
            emptyCol.style.minHeight = '300px';
            emptyCol.innerHTML = `
                <p class="text-center text-muted fs-5">
                    Il tuo ricettario è vuoto! Inizia ad aggiungere ricette dalla pagina 
                    <a href="recipes.html" class="fw-bold">Ricette</a>.
                </p>
            `;
            cookbookRecipesContainer.appendChild(emptyCol);
            updatePaginationControlsCookbook(0);
            return;
        }

        recipes.forEach(recipe =>
        {
            const recipeCard = document.createElement('div');
            recipeCard.classList.add('col-lg-3', 'col-md-4', 'col-sm-6', 'mb-3');
            recipeCard.innerHTML = `
                <div class="recipe-card h-100">
                    <img src="${recipe.mealThumb}" alt="${recipe.name}" class="card-img-top">
                    <div class="recipe-card-content">
                        <h3>${recipe.name}</h3>
                        <p>${recipe.category || 'N/A'} | ${recipe.area || 'N/A'}</p>
                        ${recipe.privateNote ? `<p class="private-note-display">Nota: ${recipe.privateNote}</p>` : ''}
                        <div class="cookbook-card-actions">
                            <button class="btn primary-btn view-details-btn w-100" data-mealid="${recipe.mealDbId}">Vedi Dettagli</button>
                            <button class="btn edit-note-btn w-100" data-cookbookrecipeid="${recipe.cookBookRecipeId}" data-mealid="${recipe.mealDbId}" data-privatenote="${recipe.privateNote || ''}">Modifica Nota</button>
                            <button class="btn remove-btn w-100" data-cookbookrecipeid="${recipe.cookBookRecipeId}" data-mealid="${recipe.mealDbId}">Rimuovi</button>
                        </div>
                    </div>
                </div>
            `;
            cookbookRecipesContainer.appendChild(recipeCard);
        });

        //event listeners
        document.querySelectorAll('.remove-btn').forEach(button =>
        {
            button.addEventListener('click', handleRemoveFromCookbook);
        });

        document.querySelectorAll('.edit-note-btn').forEach(button =>
        {
            button.addEventListener('click', handleEditNote);
        });

        document.querySelectorAll('.view-details-btn').forEach(button =>
        {
            button.addEventListener('click', (event) =>
            {
                const mealDbId = event.target.dataset.mealid;
                window.open('recipeDetails.html?id=' + mealDbId).focus();
            });
        });
    }

    async function fetchCookbookRecipes()
    {
        if (!authUtils.requireAuth()) return;

        const userId = localStorage.getItem('userId');
        const startIndex = (currentPageCookbook - 1) * itemsPerPageCookbook;
        const url = `/pgrc/api/users/${userId}/cookbook?start=${startIndex}&offset=${startIndex + itemsPerPageCookbook}`;

        try
        {
            const response = await authUtils.authenticatedFetch(url);

            if (!response) return; // Authentication failed, user redirected

            if (response.ok)
            {
                const data = await response.json();
                displayCookbookRecipes(data.recipes);
                updatePaginationControlsCookbook(data.total);
            } else
            {
                const errorData = await response.json();
                console.error('Error fetching cookbook:', errorData.message);
                cookbookRecipesContainer.innerHTML = `<p class="message error show">${errorData.message || 'Errore nel recupero del ricettario.'}</p>`;
                updatePaginationControlsCookbook(0);
            }
        } catch (error)
        {
            console.error('Network error fetching cookbook:', error);
            cookbookRecipesContainer.innerHTML = `<p class="message error show">Si è verificato un errore di rete. Controlla la tua connessione.</p>`;
            updatePaginationControlsCookbook(0);
        }
    }

    function updatePaginationControlsCookbook(totalResults)
    {
        const totalPages = totalResults > 0 ? Math.ceil(totalResults / itemsPerPageCookbook) : 1;
        pageInfoSpanCookbook.textContent = `Pagina ${currentPageCookbook} di ${totalPages}`;
        prevPageBtnCookbook.disabled = currentPageCookbook === 1;
        nextPageBtnCookbook.disabled = currentPageCookbook >= totalPages;
    }

    //TODO - quando viene rimossa la ricetta bisogna gestire la riduzione del numero di pagine, sennò 
    //l'utente rischia di trovarsi in una pagina che non esiste...
    async function handleRemoveFromCookbook(event)
    {
        if (!authUtils.requireAuth()) return;

        const cookbookRecipeId = event.target.dataset.cookbookrecipeid;
        const userId = localStorage.getItem('userId');

        alertMsgs.showConfirmation(
            'Sei sicuro di voler rimuovere questa ricetta dal tuo ricettario?',
            async () =>
            {
                try
                {
                    const response = await authUtils.authenticatedFetch(`/pgrc/api/users/${userId}/cookbook/${cookbookRecipeId}`, {
                        method: 'DELETE'
                    });

                    if (!response) return;

                    const data = await response.json();

                    if (response.ok)
                    {
                        alertMsgs.showSuccess(data.message);
                        fetchCookbookRecipes();
                    } else
                    {
                        alertMsgs.showError(data.message || 'Errore durante la rimozione della ricetta.');
                    }
                } catch (error)
                {
                    console.error('Network error removing recipe:', error);
                    alertMsgs.showError('Si è verificato un errore di rete durante la rimozione.');
                }
            },
            null,
            'Rimuovi',
            'Annulla'
        );
    }

    async function handleEditNote(event)
    {
        if (!authUtils.requireAuth()) return;

        const cookbookRecipeId = event.target.dataset.cookbookrecipeid;
        const currentNote = event.target.dataset.privatenote;
        const userId = localStorage.getItem('userId');

        alertMsgs.showPrompt(
            'Modifica la tua nota privata per questa ricetta:',
            currentNote,
            async (newNote) =>
            {
                try
                {
                    const response = await authUtils.authenticatedFetch(`/pgrc/api/users/${userId}/cookbook/${cookbookRecipeId}`, {
                        method: 'PATCH',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({ privateNote: newNote.trim() })
                    });

                    if (!response) return;

                    const data = await response.json();

                    if (response.ok)
                    {
                        alertMsgs.showSuccess(data.message);
                        fetchCookbookRecipes();
                    } else
                    {
                        alertMsgs.showError(data.message || 'Errore durante l\'aggiornamento della nota.');
                    }
                } catch (error)
                {
                    console.error('Network error updating note:', error);
                    alertMsgs.showError('Si è verificato un errore di rete durante l\'aggiornamento.');
                }
            },
            null,
            'Salva',
            'Annulla',
            'Scrivi qui la tua nota privata... (lascia vuoto per rimuovere)'
        );
    }

    prevPageBtnCookbook.addEventListener('click', () =>
    {
        if (currentPageCookbook > 1)
        {
            currentPageCookbook--;
            fetchCookbookRecipes();
        }
    });

    nextPageBtnCookbook.addEventListener('click', () =>
    {
        currentPageCookbook++;
        fetchCookbookRecipes();
    });

    //popolamento della pagina, prima cosa che succede all'apertura 
    if (await authUtils.isAuthenticated())
    {
        fetchCookbookRecipes();
    } else
    {
        //TODO - valutare se reindirizzare direttamente al login
        const authCol = document.createElement('div');
        authCol.classList.add('col-12', 'd-flex', 'align-items-center', 'justify-content-center');
        authCol.style.minHeight = '300px';
        authCol.innerHTML = '<p class="text-center text-muted fs-5">Accedi per visualizzare il tuo ricettario.</p>';
        cookbookRecipesContainer.appendChild(authCol);
        updatePaginationControlsCookbook(0);
    }
});