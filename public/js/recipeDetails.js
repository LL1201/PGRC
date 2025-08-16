document.addEventListener('DOMContentLoaded', () =>
{
    const recipeContent = document.getElementById('recipe-content');

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

    const recipeId = getRecipeIdFromUrl();
    if (recipeId)
    {
        fetchRecipeDetails(recipeId);
    } else
    {
        showError('ID ricetta mancante', 'Nessun ID ricetta specificato nell\'URL.');
    }
});
