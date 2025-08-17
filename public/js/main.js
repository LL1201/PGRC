document.addEventListener('DOMContentLoaded', async () =>
{
    const authLink = document.getElementById('auth-link');
    const profileDropdown = document.getElementById('profile-dropdown');
    const cookbookNavItem = document.getElementById('cookbook-nav-item');
    const logoutBtn = document.getElementById('logout-btn');

    try
    {
        const isAuth = await authUtils.isAuthenticated();

        if (isAuth)
        {
            //nascondi login e mostra dropdown del profilo
            authLink.style.display = 'none';
            profileDropdown.style.display = 'block';
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
        console.error('Errore durante il controllo autenticazione:', err);
    }

    async function handleLogout(event)
    {
        event.preventDefault();
        await authUtils.logout();
    }
});