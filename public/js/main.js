document.addEventListener('DOMContentLoaded', async () =>
{
    const homeNavItem = document.getElementById('home-nav-item');
    const recipesNavItem = document.getElementById('recipes-nav-item');
    const authLink = document.getElementById('auth-link');
    const profileDropdown = document.getElementById('profile-dropdown');
    const myProfileNavItem = document.getElementById('my-profile-nav-item');
    const cookbookNavItem = document.getElementById('cookbook-nav-item');
    const logoutBtn = document.getElementById('logout-btn');

    homeNavItem.querySelector('a').setAttribute('href', 'index.html');
    recipesNavItem.querySelector('a').setAttribute('href', 'recipes.html');
    cookbookNavItem.querySelector('a').setAttribute('href', 'cookbook.html');
    authLink.querySelector('a').setAttribute('href', 'login.html');

    if ('serviceWorker' in navigator)
    {
        window.addEventListener('load', function ()
        {
            navigator.serviceWorker.register('serviceWorker.js', { scope: '/' }).then(function (registration)
            {
                console.log('ServiceWorker registration succesful!')
            }, function (err)
            {
                console.log('ServiceWorker registration failed: ', err);
            });
        });
    }

    try
    {
        const isAuth = await authUtils.isAuthenticated();

        if (isAuth)
        {
            //nascondi login e mostra dropdown del profilo
            authLink.style.display = 'none';
            profileDropdown.style.display = 'block';
            myProfileNavItem.setAttribute('href', 'my-profile.html');
            cookbookNavItem.style.display = 'block';

            logoutBtn.addEventListener('click', handleLogout);
        } else
        {
            //mostra login e nascondi dropdown profilo
            authLink.style.display = 'block';
            profileDropdown.style.display = 'none';
            cookbookNavItem.style.display = 'none';
        }
    } catch (err)
    {
        console.error('Error during authentication control:', err);
    }

    async function handleLogout(event)
    {
        event.preventDefault();
        //TODO errori
        await authUtils.logout();
    }
});