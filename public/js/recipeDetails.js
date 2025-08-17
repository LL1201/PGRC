document.addEventListener('DOMContentLoaded', () =>
{
    //const recipeContent = document.getElementById('recipe-content');

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
            const response = await fetch(`/pgrc/api/recipes/${recipeId}`, {
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

    // --- Recensioni ---
    const REVIEWS_PAGE_SIZE = 10;
    let reviewsCurrentStart = 0;
    let reviewsTotal = 0;
    //let recipeId = null;

    async function fetchAndDisplayReviews(reset = false, recipeId)
    {
        const reviewsListContainer = document.getElementById('reviews-list-container');
        const loadMoreBtn = document.getElementById('load-more-reviews-btn');

        if (reset)
        {
            reviewsCurrentStart = 0;
            reviewsListContainer.innerHTML = '';
        }

        try
        {
            const url = `/pgrc/api/recipes/${recipeId}/reviews?start=${reviewsCurrentStart}&offset=${REVIEWS_PAGE_SIZE}`;
            // Usa fetch "normale" per le recensioni pubbliche, NON authenticatedFetch!
            const response = await fetch(url, { method: 'GET', headers: { 'Content-Type': 'application/json' } });

            if (!response) return;

            const data = await response.json();
            reviewsTotal = data.total || 0;

            if (Array.isArray(data.reviews))
            {
                data.reviews.forEach(review =>
                {
                    reviewsListContainer.appendChild(renderReviewCard(review));
                });
            }

            reviewsCurrentStart += REVIEWS_PAGE_SIZE;

            // Mostra/nascondi bottone "Carica altro"
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
            }
        } catch (error)
        {
            reviewsListContainer.innerHTML = '<p class="text-danger">Errore nel caricamento delle recensioni.</p>';
        }
    }

    function renderReviewCard(review)
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
                <span class="review-date float-end">${dateStr ? 'Eseguita il ' + dateStr : ''}</span>
            </div>
            <div>
                <span class="text-muted small">Utente: ${review.authorUserId ? review.authorUserId : 'N/A'}</span>
            </div>
        `;
        return div;
    }

    // --- Form inserimento recensione ---
    function setupAddReviewForm(recipeId)
    {
        const addReviewContainer = document.getElementById('add-review-container');
        addReviewContainer.style.display = 'block';

        const addReviewForm = document.getElementById('add-review-form');
        addReviewForm.addEventListener('submit', async (e) =>
        {
            e.preventDefault();

            const difficulty = addReviewForm.difficultyEvaluation.value;
            const taste = addReviewForm.tasteEvaluation.value;
            const executionDate = addReviewForm.executionDate.value;

            if (!difficulty || !taste || !executionDate)
            {
                window.alertMsgs && window.alertMsgs.showError
                    ? window.alertMsgs.showError('Tutti i campi sono obbligatori.')
                    : alert('Tutti i campi sono obbligatori.');
                return;
            }

            try
            {
                const response = await window.authUtils.authenticatedFetch(
                    `/pgrc/api/recipes/${recipeId}/reviews`,
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
                    window.alertMsgs && window.alertMsgs.showSuccess
                        ? window.alertMsgs.showSuccess('Recensione aggiunta!')
                        : alert('Recensione aggiunta!');
                    addReviewForm.reset();
                    fetchAndDisplayReviews(true);
                } else
                {
                    window.alertMsgs && window.alertMsgs.showError
                        ? window.alertMsgs.showError(data.message || 'Errore nell\'aggiunta della recensione.')
                        : alert(data.message || 'Errore nell\'aggiunta della recensione.');
                }
            } catch (error)
            {
                window.alertMsgs && window.alertMsgs.showError
                    ? window.alertMsgs.showError('Errore di rete.')
                    : alert('Errore di rete.');
            }
        });
    }

    // --- Mostra/nascondi form recensione se loggato ---
    async function checkShowAddReviewForm()
    {
        const addReviewContainer = document.getElementById('add-review-container');
        if (window.authUtils && await window.authUtils.isAuthenticated())
        {
            addReviewContainer.style.display = 'block';
            setupAddReviewForm(recipeId);
        } else
        {
            addReviewContainer.style.display = 'none';
        }
    }

    // --- Inizializzazione ---
    async function initReviewsSection()
    {
        // Passa recipeId a fetchAndDisplayReviews
        await fetchAndDisplayReviews(true, recipeId);
        await checkShowAddReviewForm();

        // Bottone "Carica altro"
        const loadMoreBtn = document.getElementById('load-more-reviews-btn');
        loadMoreBtn.onclick = () => fetchAndDisplayReviews(false, recipeId);
    }

    const recipeId = getRecipeIdFromUrl();
    if (recipeId)
    {
        fetchRecipeDetails(recipeId);
        initReviewsSection();
    } else
    {
        showError('ID ricetta mancante', 'Nessun ID ricetta specificato nell\'URL.');
    }
});
