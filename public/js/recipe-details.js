document.addEventListener('DOMContentLoaded', () =>
{
    //const recipeContent = document.getElementById('recipe-content');
    const REVIEWS_PAGE_SIZE = 10;
    let reviewsCurrentStart = 0;
    let reviewsTotal = 0;
    let foundOwnReview;

    const recipeId = getRecipeIdFromUrl();
    if (recipeId)
    {
        fetchRecipeDetails(recipeId);
        initReviewsSection(recipeId);
    } else
    {
        showError('Missing recipe ID', 'No recipe ID specified in the URL.');
    }

    function getRecipeIdFromUrl()
    {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get('id');
    }

    async function fetchRecipeDetails(recipeId)
    {
        try
        {
            const response = await fetch(`/api/v1/recipes/${recipeId}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok)
            {
                const recipe = await response.json();
                displayRecipeDetails(recipe);
                //dopo aver mostrato i dettagli, mostra le statistiche delle review
                await fetchAndDisplayReviewStatistics(recipeId);
            } else
            {
                const errorData = await response.json();
                showError('Error loading recipe', errorData.message || 'Recipe not found');
            }
        } catch (error)
        {
            console.error('Network error fetching recipe:', error);
            showError('Connection error', 'A network error has occurred. Please check your connection.');
        }
    }

    async function fetchAndDisplayReviewStatistics(recipeId)
    {
        try
        {
            const response = await fetch(`/api/v1/recipes/${recipeId}/reviews?start=0&offset=1`, {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' }
            });
            if (!response.ok) return;

            const data = await response.json();
            const stats = data.statistics || {};
            const statsBox = document.getElementById('review-statistics-box');
            if (!statsBox) return;

            if (stats.avgDifficulty == null && stats.avgTaste == null)
            {
                statsBox.innerHTML = `<span class="text-muted">No reviews statistics available.</span>`;
            }
            else
            {
                statsBox.innerHTML = `
                    <div class="review-stats-info">
                        <span class="badge bg-primary me-2">Average difficulty rating: ${stats.avgDifficulty ? stats.avgDifficulty.toFixed(1) : '-'}</span>
                        <span class="badge bg-success">Average taste rating: ${stats.avgTaste ? stats.avgTaste.toFixed(1) : '-'}</span>
                    </div>
                `;
            }
        }
        catch (e)
        {
            //silenzia errori di rete per la sezione statistiche
        }
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
                <span class="ingredient-name">${ing.ingredientName}</span>
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

        //mostra box statistiche review
        let statsBox = document.getElementById('review-statistics-box');
        statsBox.style.display = 'block';
        statsBox.innerHTML = `<span class="text-muted">Loading reviews statistics...</span>`;
    }

    async function initReviewsSection(recipeId)
    {
        await fetchAndDisplayReviews(true, recipeId);
        await checkShowAddReviewForm(recipeId);

        //bottone "Carica altro"
        const loadMoreBtn = document.getElementById('load-more-reviews-btn');
        loadMoreBtn.onclick = () => fetchAndDisplayReviews(false, recipeId);
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
            const url = `/api/v1/recipes/${recipeId}/reviews?start=${reviewsCurrentStart}&offset=${REVIEWS_PAGE_SIZE}`;
            let response = null;

            if (await authUtils.isAuthenticated())
            {
                response = await authUtils.authenticatedFetch(url, {
                    method: 'GET',
                    headers: { 'Content-Type': 'application/json' }
                });
                myUserId = sessionStorage.getItem('userId');
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

            //aggiorna la presenza del form ogni volta che aggiorna le recensioni
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
                reviewsListContainer.innerHTML = '<p class="text-center text-muted">No reviews available.</p>';
                //toggleAddReviewForm(true);
            }
        } catch (error)
        {
            reviewsListContainer.innerHTML = '<p class="text-danger">Error loading reviews.</p>';
        }
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

    function renderReviewCard(review, isOwn = false)
    {
        const div = document.createElement('div');
        div.className = 'review-card';

        //formattazione data a seconda del preferred language settato sul browser
        let dateStr = '';
        if (review.executionDate)
        {
            const d = new Date(review.executionDate);

            if (!isNaN(d))
                dateStr = d.toLocaleDateString(navigator.language);

        }

        div.innerHTML = `
            <div class="review-meta">
                <span class="review-rating">Difficoltà: ${review.difficulty} | Taste: ${review.taste}</span>
                <span class="review-date float-end">${dateStr ? 'Made on ' + dateStr : ''}</span>
            </div>
            <div class="review-notes"${!review.notes ? ' style="display:none;"' : ''}>
                <div class="review-note">${review.notes ? review.notes : ''}</div>
            </div>
            <div>
                <span class="text-muted small">Username: ${review.authorUsername ? review.authorUsername : 'N/A'}</span>
                ${isOwn ? `<button class="btn btn-sm btn-danger ms-2 delete-review-btn" data-reviewid="${review.reviewId}">Delete</button>` : ''}
            </div>
        `;

        //se è la propria recensione, aggiunge event listener per il delete
        if (isOwn)
        {
            const btn = div.querySelector('.delete-review-btn');
            btn.addEventListener('click', async function ()
            {
                window.alertMsgsUtils.showConfirmation(
                    'Are you sure to delete your review?',
                    async () =>
                    {
                        try
                        {
                            const response = await window.authUtils.authenticatedFetch(
                                `/api/v1/recipes/${review.mealDbId}/reviews/${review.reviewId}`,
                                { method: 'DELETE' }
                            );
                            const data = await response.json();
                            if (response.ok)
                            {
                                alertMsgsUtils.showSuccess('Review deleted successfully!');
                                //ricarica le review per mostrare l'aggiornamento avvenuto
                                fetchAndDisplayReviews(true, review.mealDbId);
                            }
                            else
                                alertMsgsUtils.showError(data.message || 'Error deleting review.');
                        }
                        catch (err)
                        {
                            alertMsgsUtils.showError('Network error.');
                        }
                    },
                    null,
                    'Confirm review removal',
                    'danger',
                    'Delete',
                    'Cancel'
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
            const notes = addReviewForm.notes.value;

            if (!difficulty || !taste || !executionDate)
            {
                window.alertMsgsUtils && window.alertMsgsUtils.showError
                    ? window.alertMsgsUtils.showError('All fields are required.')
                    : alert('All fields are required.');
                return;
            }

            try
            {
                const response = await window.authUtils.authenticatedFetch(
                    `/api/v1/recipes/${recipeId}/reviews`,
                    {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            difficultyEvaluation: difficulty,
                            tasteEvaluation: taste,
                            executionDate: executionDate,
                            notes: !notes ? '' : notes
                        })
                    }
                );

                if (!response) return;

                const data = await response.json();

                if (response.ok)
                {
                    window.alertMsgsUtils.showSuccess('Review added successfully!');
                    addReviewForm.reset();
                    fetchAndDisplayReviews(true, recipeId);
                } else
                {
                    window.alertMsgsUtils.showError(data.message || 'Error adding review.');
                }
            } catch (error)
            {
                window.alertMsgsUtils.showError('Network error.');
            }
        };
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
});
