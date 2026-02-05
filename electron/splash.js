(function () {
    // Translations
    var translations = {
        it: {
            tagline: 'La tua vita, il tuo sistema, le tue regole.',
            loading: 'Inizializzazione...',
            ready: 'Pronto!'
        },
        en: {
            tagline: 'Your life, your system, your rules.',
            loading: 'Initializing...',
            ready: 'Ready!'
        },
        de: {
            tagline: 'Dein Leben, dein System, deine Regeln.',
            loading: 'Initialisierung...',
            ready: 'Bereit!'
        },
        fr: {
            tagline: 'Ta vie, ton système, tes règles.',
            loading: 'Initialisation...',
            ready: 'Prêt!'
        },
        es: {
            tagline: 'Tu vida, tu sistema, tus reglas.',
            loading: 'Inicializando...',
            ready: '¡Listo!'
        }
    };

    // Get language from URL
    var urlParams = new URLSearchParams(window.location.search);
    var lang = urlParams.get('lang') || 'en';
    var t = translations[lang] || translations.en;

    // Apply translations
    var taglineEl = document.getElementById('tagline');
    var loadingEl = document.getElementById('loadingText');
    if (taglineEl) taglineEl.textContent = t.tagline;
    if (loadingEl) loadingEl.textContent = t.loading;

    // Elements
    var ring1 = document.getElementById('ring1');
    var ring2 = document.getElementById('ring2');
    var glow = document.getElementById('glow');
    var orb1 = document.getElementById('orb1');
    var orb2 = document.getElementById('orb2');
    var progressBar = document.getElementById('progressBar');
    var loadingText = document.getElementById('loadingText');

    var angle1 = 0;
    var angle2 = 0;
    var glowPhase = 0;
    var orbPhase = 0;
    var progress = 0;

    function animate() {
        // Rings rotation
        angle1 = angle1 + 0.5;
        angle2 = angle2 - 0.3;
        if (ring1) ring1.style.transform = 'rotate(' + angle1 + 'deg)';
        if (ring2) ring2.style.transform = 'rotate(' + angle2 + 'deg)';

        // Glow pulse
        glowPhase = glowPhase + 0.03;
        var glowOpacity = 0.4 + Math.sin(glowPhase) * 0.3;
        var glowScale = 1 + Math.sin(glowPhase) * 0.1;
        if (glow) {
            glow.style.opacity = glowOpacity;
            glow.style.transform = 'scale(' + glowScale + ')';
        }

        // Orbs floating
        orbPhase = orbPhase + 0.01;
        var x1 = Math.sin(orbPhase) * 20;
        var y1 = Math.cos(orbPhase) * 20;
        var x2 = Math.cos(orbPhase * 0.8) * 25;
        var y2 = Math.sin(orbPhase * 0.8) * 25;
        if (orb1) orb1.style.transform = 'translate(' + x1 + 'px, ' + y1 + 'px)';
        if (orb2) orb2.style.transform = 'translate(' + x2 + 'px, ' + y2 + 'px)';

        // Progress bar
        if (progress < 100) {
            progress = progress + 0.4;
            if (progress > 100) progress = 100;
            if (progressBar) progressBar.style.width = progress + '%';
            if (progress >= 100 && loadingText) {
                loadingText.textContent = t.ready;
            }
        }

        requestAnimationFrame(animate);
    }

    animate();

    // Particles
    function createParticle() {
        var particle = document.createElement('div');
        particle.className = 'particle';
        var size = Math.random() * 4 + 2;
        particle.style.width = size + 'px';
        particle.style.height = size + 'px';
        particle.style.left = (Math.random() * window.innerWidth) + 'px';
        particle.style.bottom = '-10px';
        particle.style.opacity = '0';
        document.body.appendChild(particle);

        var y = 0;
        var maxY = window.innerHeight + 20;
        var speed = 0.5 + Math.random() * 0.5;

        function moveParticle() {
            y = y + speed;
            var opacity = 0.5;
            if (y < 50) opacity = y / 50 * 0.5;
            else if (y > maxY - 50) opacity = (maxY - y) / 50 * 0.5;

            particle.style.bottom = y + 'px';
            particle.style.opacity = opacity;

            if (y < maxY) {
                requestAnimationFrame(moveParticle);
            } else {
                particle.remove();
            }
        }
        moveParticle();
    }

    function spawnLoop() {
        createParticle();
        setTimeout(spawnLoop, 400);
    }
    spawnLoop();
})();
