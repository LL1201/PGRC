document.addEventListener('DOMContentLoaded', () =>
{
    //TODO - eliminare recensione
    //TODO - vedere la propria in cima
    //const recipeContent = document.getElementById('recipe-content');
    const REVIEWS_PAGE_SIZE = 10;
    let reviewsCurrentStart = 0;
    let reviewsTotal = 0;
    let foundOwnReview;

    function getRecipeIdFromUrl()
    {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get('id');
    }

    function displayRecipeDetails(recipe)
    {
        document.title = `PGRC - ${recipe.name}`;

        const recipeContainer = document.getElementById('recipe-container');
        const errorContainer = document.getElementById('error-container');
        const loadingContainer = document.getElementById('loading-container');

        recipeContainer.style.display = 'block';
        errorContainer.style.display = 'none';
        loadingContainer.style.display = 'none';

        //popolamento dei dati della ricetta
        document.getElementById('recipe-title').textContent = recipe.name;
        document.getElementById('recipe-image').src = recipe.mealThumb;
        document.getElementById('recipe-image').alt = recipe.name;

        const ingredientsList = document.getElementById('ingredients-list');
        ingredientsList.innerHTML = '';
        recipe.ingredients.forEach(ing =>
        {
            const li = document.createElement('li');
            li.innerHTML = `
                <span class="ingredient-name">${ing.ingredient}</span>
                <span class="ingredient-measure">${ing.measure}</span>
            `;
            ingredientsList.appendChild(li);
        });

        document.getElementById('recipe-category').textContent = recipe.category || 'N/A';
        document.getElementById('recipe-area').textContent = recipe.area || 'N/A';

        const youtubeContainer = document.getElementById('youtube-container');
        const youtubeLink = document.getElementById('youtube-link');
        if (recipe.youtubeLink)
        {
            youtubeLink.href = recipe.youtubeLink;
            youtubeContainer.style.display = 'block';
        } else
        {
            youtubeContainer.style.display = 'none';
        }

        //gestione dei tag con le classi di bootstrap
        const tagsContainer = document.getElementById('tags-container');
        const tagsList = document.getElementById('tags-list');
        if (recipe.tags && recipe.tags.length > 0)
        {
            tagsList.innerHTML = '';
            recipe.tags.forEach(tag =>
            {
                const span = document.createElement('span');
                span.className = 'badge tag me-1 mb-1';
                span.textContent = tag;
                tagsList.appendChild(span);
            });
            tagsContainer.style.display = 'block';
        } else
        {
            tagsContainer.style.display = 'none';
        }

        document.getElementById('recipe-instructions').textContent = recipe.instructions;
    }

    //TODO - sostituire con i miei errori
    function showError(title, message)
    {
        const recipeContainer = document.getElementById('recipe-container');
        const errorContainer = document.getElementById('error-container');
        const loadingContainer = document.getElementById('loading-container');

        recipeContainer.style.display = 'none';
        errorContainer.style.display = 'block';
        loadingContainer.style.display = 'none';

        document.getElementById('error-title').textContent = title;
        document.getElementById('error-message').textContent = message;
    }

    async function fetchRecipeDetails(recipeId)
    {
        try
        {
            const response = await fetch(`/pgrc/api/v1/recipes/${recipeId}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok)
            {
                const recipe = await response.json();
                displayRecipeDetails(recipe);
            } else
            {
                const errorData = await response.json();
                showError('Errore nel caricamento della ricetta', errorData.message || 'Ricetta non trovata');
            }
        } catch (error)
        {
            console.error('Network error fetching recipe:', error);
            showError('Errore di connessione', 'Si è verificato un errore di rete. Controlla la tua connessione.');
        }
    }

    //reset è usato per resettare la pagina corrente delle recensioni
    //viene impostato a true quando carico per la prima volta le recensioni
    //impostato a false quande quando carico altre recensioni per non pulire l'area già popolata
    async function fetchAndDisplayReviews(reset = false, recipeId)
    {
        const reviewsListContainer = document.getElementById('reviews-list-container');
        const loadMoreBtn = document.getElementById('load-more-reviews-btn');

        if (reset)
        {
            reviewsCurrentStart = 0;
            reviewsListContainer.innerHTML = '';
        }

        //resetta il flag ogni volta che ricarichi le recensioni
        foundOwnReview = false;

        try
        {
            //imposto la richiesta autenticata se sono effettivamente autenticato
            //in modo da ottenere la mia recensione in cima alle altre e mostrare il pulsante elimina
            let myUserId = null;
            const url = `/pgrc/api/v1/recipes/${recipeId}/reviews?start=${reviewsCurrentStart}&offset=${REVIEWS_PAGE_SIZE}`;
            let response = null;

            if (authUtils.isAuthenticated())
            {
                response = await authUtils.authenticatedFetch(url, {
                    method: 'GET',
                    headers: { 'Content-Type': 'application/json' }
                });
                myUserId = localStorage.getItem('userId');
            } else
            {
                response = await fetch(url, {
                    method: 'GET',
                    headers: { 'Content-Type': 'application/json' }
                });
            }

            const data = await response.json();

            reviewsTotal = data.total || 0;

            if (Array.isArray(data.reviews))
            {
                data.reviews.forEach(review =>
                {
                    //se la recensione è la propria, aggiunge il pulsante elimina
                    const isOwn = myUserId && review.authorUserId && review.authorUserId === myUserId;
                    if (isOwn)
                        foundOwnReview = true;
                    reviewsListContainer.appendChild(renderReviewCard(review, isOwn));
                });
            }

            // Aggiorna la visibilità del form ogni volta che aggiorni le recensioni
            await checkShowAddReviewForm(recipeId);

            reviewsCurrentStart += REVIEWS_PAGE_SIZE;

            //mostra/nascondi bottone "Carica altro"
            if (reviewsCurrentStart < reviewsTotal)
            {
                loadMoreBtn.style.display = '';
            } else
            {
                loadMoreBtn.style.display = 'none';
            }

            if (reviewsTotal === 0 && reset)
            {
                reviewsListContainer.innerHTML = '<p class="text-center text-muted">Nessuna recensione presente.</p>';
                //toggleAddReviewForm(true);
            }
        } catch (error)
        {
            reviewsListContainer.innerHTML = '<p class="text-danger">Errore nel caricamento delle recensioni.</p>';
        }
    }

    function renderReviewCard(review, isOwn = false)
    {
        const div = document.createElement('div');
        div.className = 'review-card';

        // Format date
        let dateStr = '';
        if (review.executionDate)
        {
            const d = new Date(review.executionDate);
            if (!isNaN(d))
            {
                dateStr = d.toLocaleDateString('it-IT');
            }
        }

        div.innerHTML = `
            <div class="review-meta">
                <span class="review-rating">Difficoltà: ${review.difficulty} | Gusto: ${review.taste}</span>
                <span class="review-date float-end">${dateStr ? 'Realizzata il ' + dateStr : ''}</span>
            </div>
            <div>
                <span class="text-muted small">Utente: ${review.authorUsername ? review.authorUsername : 'N/A'}</span>
                ${isOwn ? `<button class="btn btn-sm btn-danger ms-2 delete-review-btn" data-reviewid="${review.reviewId}">Elimina</button>` : ''}
            </div>
        `;

        // Se è la propria recensione, aggiungi event listener per il delete
        if (isOwn)
        {
            const btn = div.querySelector('.delete-review-btn');
            btn.addEventListener('click', async function ()
            {
                window.alertMsgsUtils.showConfirmation(
                    'Sei sicuro di voler eliminare la tua recensione?',
                    async () =>
                    {
                        try
                        {
                            const response = await window.authUtils.authenticatedFetch(
                                `/pgrc/api/v1/recipes/${review.mealDbId}/reviews/${review.reviewId}`,
                                { method: 'DELETE' }
                            );
                            const data = await response.json();
                            if (response.ok)
                            {
                                window.alertMsgsUtils && window.alertMsgsUtils.showSuccess
                                    ? window.alertMsgsUtils.showSuccess('Recensione eliminata!')
                                    : alert('Recensione eliminata!');
                                //ricarica le recensioni e mostra il form di nuovo
                                fetchAndDisplayReviews(true, review.mealDbId);
                            }
                            else
                            {
                                window.alertMsgsUtils && window.alertMsgsUtils.showError
                                    ? window.alertMsgsUtils.showError(data.message || 'Errore durante l\'eliminazione della recensione.')
                                    : alert(data.message || 'Errore durante l\'eliminazione della recensione.');
                            }
                        }
                        catch (err)
                        {
                            window.alertMsgsUtils && window.alertMsgsUtils.showError
                                ? window.alertMsgsUtils.showError('Errore di rete.')
                                : alert('Errore di rete.');
                        }
                    },
                    null,
                    'Elimina',
                    'Annulla'
                );
            });
        }

        return div;
    }

    //form inserimento recensione
    function setupAddReviewForm(recipeId)
    {
        const addReviewContainer = document.getElementById('add-review-container');
        addReviewContainer.style.display = 'block';

        const addReviewForm = document.getElementById('add-review-form');

        //rimuove eventuali listener precedenti
        addReviewForm.onsubmit = null;

        addReviewForm.onsubmit = async (e) =>
        {
            e.preventDefault();

            const difficulty = addReviewForm.difficultyEvaluation.value;
            const taste = addReviewForm.tasteEvaluation.value;
            const executionDate = addReviewForm.executionDate.value;

            if (!difficulty || !taste || !executionDate)
            {
                window.alertMsgsUtils && window.alertMsgsUtils.showError
                    ? window.alertMsgsUtils.showError('Tutti i campi sono obbligatori.')
                    : alert('Tutti i campi sono obbligatori.');
                return;
            }

            try
            {
                const response = await window.authUtils.authenticatedFetch(
                    `/pgrc/api/v1/recipes/${recipeId}/reviews`,
                    {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            difficultyEvaluation: difficulty,
                            tasteEvaluation: taste,
                            executionDate: executionDate
                        })
                    }
                );

                if (!response) return;

                const data = await response.json();

                if (response.ok)
                {
                    window.alertMsgsUtils && window.alertMsgsUtils.showSuccess
                        ? window.alertMsgsUtils.showSuccess('Recensione aggiunta!')
                        : alert('Recensione aggiunta!');
                    addReviewForm.reset();
                    fetchAndDisplayReviews(true, recipeId);
                } else
                {
                    window.alertMsgsUtils && window.alertMsgsUtils.showError
                        ? window.alertMsgsUtils.showError(data.message || 'Errore nell\'aggiunta della recensione.')
                        : alert(data.message || 'Errore nell\'aggiunta della recensione.');
                }
            } catch (error)
            {
                window.alertMsgsUtils && window.alertMsgsUtils.showError
                    ? window.alertMsgsUtils.showError('Errore di rete.')
                    : alert('Errore di rete.');
            }
        };
    }

    //mostra form recensione solo se autenticato e se l'utente non ha già lasciato una recensione
    async function checkShowAddReviewForm(recipeId)
    {
        const addReviewContainer = document.getElementById('add-review-container');
        if (await authUtils.isAuthenticated() && !foundOwnReview)
        {
            addReviewContainer.style.display = 'block';
            setupAddReviewForm(recipeId);
        } else
        {
            addReviewContainer.style.display = 'none';
        }
    }

    async function initReviewsSection(recipeId)
    {
        await fetchAndDisplayReviews(true, recipeId);
        await checkShowAddReviewForm(recipeId);

        //bottone "Carica altro"
        const loadMoreBtn = document.getElementById('load-more-reviews-btn');
        loadMoreBtn.onclick = () => fetchAndDisplayReviews(false, recipeId);
    }

    const recipeId = getRecipeIdFromUrl();
    if (recipeId)
    {
        fetchRecipeDetails(recipeId);
        initReviewsSection(recipeId);
    } else
    {
        showError('ID ricetta mancante', 'Nessun ID ricetta specificato nell\'URL.');
    }
});
