/* ══════════════════════════════════════════════════════════════
   BINITA YADAV — Profile App JavaScript
   Typing animation · Counter · Carousel · Tabs · Parallax · Fade
════════════════════════════════════════════════════════════════ */

document.addEventListener('DOMContentLoaded', () => {

    // ──────────────────────────────────────────
    // 1. TYPING ANIMATION
    // ──────────────────────────────────────────
    const typedEl = document.getElementById('typed');
    const phrases = [
        'Mindset Coach',
        'Yoga Instructor',
        'Breathwork Guide',
        'Your Transformation Partner'
    ];
    let phraseIndex = 0;
    let charIndex = 0;
    let isDeleting = false;

    function type() {
        const current = phrases[phraseIndex];
        if (isDeleting) {
            typedEl.textContent = current.substring(0, charIndex - 1);
            charIndex--;
        } else {
            typedEl.textContent = current.substring(0, charIndex + 1);
            charIndex++;
        }

        let speed = isDeleting ? 60 : 120;

        if (!isDeleting && charIndex === current.length) {
            speed = 2200; // pause at end
            isDeleting = true;
        } else if (isDeleting && charIndex === 0) {
            isDeleting = false;
            phraseIndex = (phraseIndex + 1) % phrases.length;
            speed = 400;
        }

        setTimeout(type, speed);
    }
    type();


    // ──────────────────────────────────────────
    // 2. SCROLL-TRIGGERED FADE IN
    // ──────────────────────────────────────────
    const faders = document.querySelectorAll('.fade-in');
    const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry, i) => {
            if (entry.isIntersecting) {
                // Stagger if multiple items visible
                setTimeout(() => {
                    entry.target.classList.add('visible');
                }, i * 80);
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

    faders.forEach(el => observer.observe(el));


    // ──────────────────────────────────────────
    // 3. ANIMATED NUMBER COUNTERS
    // ──────────────────────────────────────────
    const counters = document.querySelectorAll('.stat-number');
    let countersStarted = false;

    const statsObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting && !countersStarted) {
                countersStarted = true;
                counters.forEach(counter => {
                    const target = parseInt(counter.getAttribute('data-target'), 10);
                    const duration = 1800;
                    const step = target / (duration / 16);
                    let current = 0;

                    const tick = () => {
                        current += step;
                        if (current < target) {
                            counter.textContent = Math.floor(current);
                            requestAnimationFrame(tick);
                        } else {
                            counter.textContent = target;
                        }
                    };
                    requestAnimationFrame(tick);
                });
            }
        });
    }, { threshold: 0.4 });

    const statsSection = document.querySelector('.stats-section');
    if (statsSection) statsObserver.observe(statsSection);


    // ──────────────────────────────────────────
    // 4. SERVICES TAB FILTER
    // ──────────────────────────────────────────
    const tabBtns = document.querySelectorAll('.tab-btn');
    const serviceCards = document.querySelectorAll('.service-card');

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            // Update active tab
            tabBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            const filter = btn.getAttribute('data-filter');

            serviceCards.forEach(card => {
                const category = card.getAttribute('data-category');
                const show = filter === 'all' || category === filter;

                if (show) {
                    card.style.display = 'flex';
                    // Re-trigger fade for newly shown cards
                    setTimeout(() => card.classList.add('visible'), 30);
                } else {
                    card.style.display = 'none';
                }
            });
        });
    });

    // Initial show all
    serviceCards.forEach(c => c.style.display = 'flex');


    // ──────────────────────────────────────────
    // 5. TESTIMONIALS CAROUSEL
    // ──────────────────────────────────────────
    const track = document.getElementById('carouselTrack');
    const dots = document.querySelectorAll('.dot');
    let currentSlide = 0;
    let autoSlide;

    function goToSlide(index) {
        if (!track) return;
        currentSlide = (index + dots.length) % dots.length;
        track.style.transform = `translateX(-${currentSlide * 100}%)`;
        dots.forEach(d => d.classList.remove('active'));
        dots[currentSlide].classList.add('active');
    }

    dots.forEach(dot => {
        dot.addEventListener('click', () => {
            clearInterval(autoSlide);
            goToSlide(parseInt(dot.getAttribute('data-index'), 10));
            startAutoSlide();
        });
    });

    function startAutoSlide() {
        autoSlide = setInterval(() => {
            goToSlide(currentSlide + 1);
        }, 4000);
    }

    // Pause on hover
    if (track) {
        track.addEventListener('mouseenter', () => clearInterval(autoSlide));
        track.addEventListener('mouseleave', startAutoSlide);
        startAutoSlide();
    }


    // ──────────────────────────────────────────
    // 6. SUBTLE PARALLAX ON LIFESTYLE IMAGES
    // ──────────────────────────────────────────
    const parallaxImgs = document.querySelectorAll('.parallax-img');

    function updateParallax() {
        parallaxImgs.forEach(el => {
            const rect = el.getBoundingClientRect();
            const speed = parseFloat(el.getAttribute('data-speed') || '0.1');
            const viewH = window.innerHeight;
            const center = rect.top + rect.height / 2 - viewH / 2;
            const offset = center * speed;
            const img = el.querySelector('img');
            if (img) img.style.transform = `scale(1.08) translateY(${offset}px)`;
        });
    }

    window.addEventListener('scroll', updateParallax, { passive: true });
    updateParallax();


    // ──────────────────────────────────────────
    // 7. SMOOTH SCROLL FOR ANCHOR LINKS
    // ──────────────────────────────────────────
    document.querySelectorAll('a[href^="#"]').forEach(link => {
        link.addEventListener('click', e => {
            const target = document.querySelector(link.getAttribute('href'));
            if (target) {
                e.preventDefault();
                target.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        });
    });

});
