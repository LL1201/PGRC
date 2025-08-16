document.addEventListener('DOMContentLoaded', () =>
{
    const authLink = document.getElementById('auth-link');
    const profileDropdown = document.getElementById('profile-dropdown');
    const cookbookNavItem = document.getElementById('cookbook-nav-item');
    const logoutBtn = document.getElementById('logout-btn');

    if (authUtils.isAuthenticated())
    {
        // Nascondi login e mostra dropdown profilo + ricettario
        authLink.style.display = 'none';
        profileDropdown.style.display = 'block';
        cookbookNavItem.style.display = 'block';

        logoutBtn.addEventListener('click', handleLogout);
    } else
    {
        // Mostra login e nascondi dropdown profilo + ricettario
        authLink.style.display = 'block';
        profileDropdown.style.display = 'none';
        cookbookNavItem.style.display = 'none';
    }

    async function handleLogout(event)
    {
        event.preventDefault();
        await authUtils.logout();
    }
});