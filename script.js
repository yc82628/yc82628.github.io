/* ==========================================================================
   Yu Chuan Oh — Portfolio script (used by every page)
   1. Light / dark theme toggle
   2. Mobile menu
   3. Typing effect on the home page
   ========================================================================== */

const root = document.documentElement;   // the <html> element


/* 1. LIGHT / DARK THEME ----------------------------------------------------
   The small script in each page's <head> already added class="light" to
   <html> if the visitor chose light mode before, so the page never flashes
   dark first. Here we wire up the button and remember new choices.        */

const themeBtn = document.querySelector('#theme-toggle');

function setTheme(mode) {
    const isLight = mode === 'light';
    root.classList.toggle('light', isLight);

    // Show a sun in light mode, a moon in dark mode
    const icon = themeBtn.querySelector('i');
    icon.classList.toggle('fa-sun', isLight);
    icon.classList.toggle('fa-moon', !isLight);
    themeBtn.setAttribute('aria-label', isLight ? 'Switch to dark mode' : 'Switch to light mode');

    // Remember the choice for the next page / visit.
    // try/catch because some browsers block storage in private windows.
    try { localStorage.setItem('theme', mode); } catch (e) {}
}

if (themeBtn) {
    setTheme(root.classList.contains('light') ? 'light' : 'dark');
    themeBtn.addEventListener('click', () => {
        setTheme(root.classList.contains('light') ? 'dark' : 'light');
    });
}


/* 2. MOBILE MENU ----------------------------------------------------------- */

const menuBtn = document.querySelector('#menu-icon');
const navbar = document.querySelector('.navbar');

function setMenu(open) {
    navbar.classList.toggle('open', open);
    const icon = menuBtn.querySelector('i');
    icon.classList.toggle('fa-bars', !open);
    icon.classList.toggle('fa-xmark', open);
    menuBtn.setAttribute('aria-expanded', open);
    menuBtn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
}

if (menuBtn && navbar) {
    menuBtn.addEventListener('click', () => setMenu(!navbar.classList.contains('open')));

    // Close the menu after a link is picked, or when Escape is pressed
    navbar.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', () => setMenu(false));
    });
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') setMenu(false);
    });
}


/* 3. TYPING EFFECT ("I'm a ____") ------------------------------------------
   Only runs on pages that have <span id="typed">. To change the roles,
   edit this list, and the matching sentence in index.html's .sr-only span. */

const typed = document.querySelector('#typed');
const article = document.querySelector('#typed-article');

if (typed) {
    // Matches the four Services boxes on the home page
    const roles = ['Data Analyst', 'Full Stack Developer', 'Software Tester', 'AI Engineer'];

    const TYPE_SPEED = 95;      // ms per letter while typing
    const DELETE_SPEED = 45;    // ms per letter while deleting
    const HOLD_TIME = 1600;     // ms a finished word stays on screen

    let roleIndex = 0;
    let charIndex = roles[0].length;   // the first word is already in the HTML
    let deleting = true;

    function tick() {
        const word = roles[roleIndex];
        charIndex += deleting ? -1 : 1;
        typed.textContent = word.slice(0, charIndex);

        let delay = deleting ? DELETE_SPEED : TYPE_SPEED;

        if (!deleting && charIndex === word.length) {
            // Finished typing: pause, then start deleting
            deleting = true;
            delay = HOLD_TIME;
        } else if (deleting && charIndex === 0) {
            // Finished deleting: move on to the next role
            deleting = false;
            roleIndex = (roleIndex + 1) % roles.length;
            delay = 350;

            // "a Data Analyst" but "an AI Engineer": use "an" before a vowel
            if (article) article.textContent = /^[AEIOU]/i.test(roles[roleIndex]) ? 'an' : 'a';
        }

        setTimeout(tick, delay);
    }

    setTimeout(tick, HOLD_TIME);
}
