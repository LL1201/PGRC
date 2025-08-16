document.addEventListener('DOMContentLoaded', () =>
{
    const authLink = document.getElementById('auth-link');
    const profileDropdown = document.getElementById('profile-dropdown');
    const cookbookNavItem = document.getElementById('cookbook-nav-item');
    const logoutBtn = document.getElementById('logout-btn');

    if (authUtils.isAuthenticated())
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

    async function handleLogout(event)
    {
        event.preventDefault();
        await authUtils.logout();
    }
});