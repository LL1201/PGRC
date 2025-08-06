document.addEventListener('DOMContentLoaded', () =>
{
    const authLink = document.getElementById('auth-link');
    const cookbookNavItem = document.getElementById('cookbook-nav-item');
    const userId = localStorage.getItem('userId');
    const accessToken = localStorage.getItem('accessToken');

    if (userId && accessToken)
    {
        //se l'utente è loggato, mostra logout e il mio ricettario
        authLink.innerHTML = '<a href="#" id="logout-btn">Logout</a>';
        cookbookNavItem.style.display = 'block';
        const logoutBtn = document.getElementById('logout-btn');
        logoutBtn.addEventListener('click', handleLogout);
    }

    async function handleLogout(event)
    {
        event.preventDefault();
        await authUtils.logout();
    }
});