document.addEventListener('DOMContentLoaded', async () =>
{
    const cookbookRecipesContainer = document.getElementById('cookbook-recipes');
    const prevPageBtnCookbook = document.getElementById('prev-page-cookbook');
    const nextPageBtnCookbook = document.getElementById('next-page-cookbook');
    const pageInfoSpanCookbook = document.getElementById('page-info-cookbook');

    let currentPageCookbook = 1;
    const itemsPerPageCookbook = 12;
    let userId = null;

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
                    Your cookbook is empty! Start adding recipes from the 
                    <a href="recipes.html" class="fw-bold">Recipes</a> page.
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
                        ${recipe.privateNote ? `<p class="private-note-display">Note: ${recipe.privateNote}</p>` : ''}
                        <div class="cookbook-card-actions">
                            <button class="btn primary-btn view-details-btn w-100" data-mealid="${recipe.mealDbId}">View Details</button>
                            <button class="btn edit-note-btn w-100" data-cookbookrecipeid="${recipe.cookBookRecipeId}" data-mealid="${recipe.mealDbId}" data-privatenote="${recipe.privateNote || ''}">Edit Note</button>
                            <button class="btn remove-btn w-100" data-cookbookrecipeid="${recipe.cookBookRecipeId}" data-mealid="${recipe.mealDbId}">Remove from cookbook</button>
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
                window.open('recipe-details.html?id=' + mealDbId).focus();
            });
        });
    }

    async function fetchCookbookRecipes()
    {
        //if (!authUtils.requireAuth()) return;

        userId = localStorage.getItem('userId');
        const startIndex = (currentPageCookbook - 1) * itemsPerPageCookbook;
        const url = `/pgrc/api/v1/users/${userId}/cookbook?start=${startIndex}&offset=${startIndex + itemsPerPageCookbook}`;

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
                cookbookRecipesContainer.innerHTML = `<p class="message error show">${errorData.message || 'Error during cookbook retrieval.'}</p>`;
                updatePaginationControlsCookbook(0);
            }
        } catch (error)
        {
            console.error('Network error fetching cookbook:', error);
            cookbookRecipesContainer.innerHTML = `<p class="message error show">A network error occurred. Please check your connection.</p>`;
            updatePaginationControlsCookbook(0);
        }
    }

    function updatePaginationControlsCookbook(totalResults)
    {

        const totalPages = totalResults > 0 ? Math.ceil(totalResults / itemsPerPageCookbook) : 1;
        pageInfoSpanCookbook.textContent = `Pagina ${currentPageCookbook} di ${totalPages}`;
        prevPageBtnCookbook.disabled = currentPageCookbook === 1;
        nextPageBtnCookbook.disabled = currentPageCookbook >= totalPages;

        //se un utente si ritrova in una pagina che non esiste durante l'eliminazione di una ricetta viene portato
        //all'ultima pagina realmente disponibile
        if (currentPageCookbook > totalPages)
        {
            currentPageCookbook = totalPages;
            fetchCookbookRecipes();
        }
    }

    async function handleRemoveFromCookbook(event)
    {
        if (!authUtils.requireAuth()) return;

        const cookbookRecipeId = event.target.dataset.cookbookrecipeid;

        alertMsgsUtils.showConfirmation(
            'Are you sure to remove this recipe from your cookbook?',
            async () =>
            {
                try
                {
                    const response = await authUtils.authenticatedFetch(`/pgrc/api/v1/users/${userId}/cookbook/${cookbookRecipeId}`, {
                        method: 'DELETE'
                    });

                    if (!response) return;

                    const data = await response.json();

                    if (response.ok)
                    {
                        alertMsgsUtils.showSuccess(data.message);
                        fetchCookbookRecipes();
                    } else
                    {
                        alertMsgsUtils.showError(data.message || 'Error during recipe removal.');
                    }
                } catch (error)
                {
                    console.error('Network error removing recipe:', error);
                    alertMsgsUtils.showError('A network error occurred during removal.');
                }
            },
            null,
            'Confirm recipe removal',
            'danger',
            'Remove',
            'Cancel'
        );
    }

    async function handleEditNote(event)
    {
        if (!authUtils.requireAuth()) return;

        const cookbookRecipeId = event.target.dataset.cookbookrecipeid;
        const currentNote = event.target.dataset.privatenote;

        alertMsgsUtils.showPrompt(
            'Edit your private note for this recipe:',
            currentNote,
            async (newNote) =>
            {
                try
                {
                    const response = await authUtils.authenticatedFetch(`/pgrc/api/v1/users/${userId}/cookbook/${cookbookRecipeId}`, {
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
                        alertMsgsUtils.showSuccess(data.message);
                        fetchCookbookRecipes();
                    } else
                    {
                        alertMsgsUtils.showError(data.message || 'Error during note update.');
                    }
                } catch (error)
                {
                    console.error('Network error updating note:', error);
                    alertMsgsUtils.showError('A network error occurred during update.');
                }
            },
            null,
            'Save',
            'Cancel',
            'Write your private note here... (leave empty to remove)'
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
    //questa pagina richiede auth, in caso di utente non loggato
    //viene reindirizzato alla pagina di login
    if (await authUtils.requireAuth())
        fetchCookbookRecipes();

});