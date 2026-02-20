document.addEventListener('DOMContentLoaded', () => {
    console.log("Premium Profile App Loaded");

    // --- FILTERING LOGIC ---
    const tabButtons = document.querySelectorAll('.tab-btn');
    const serviceCards = document.querySelectorAll('.service-card');

    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            // 1. Remove active class from all buttons
            tabButtons.forEach(b => b.classList.remove('active'));
            // 2. Add active class to clicked button
            btn.classList.add('active');

            const filterValue = btn.getAttribute('data-filter');

            // 3. Filter cards
            serviceCards.forEach(card => {
                const category = card.getAttribute('data-category');

                if (filterValue === 'all' || category === filterValue) {
                    card.style.display = 'flex';
                    // Re-trigger animation
                    card.classList.remove('visible');
                    setTimeout(() => card.classList.add('visible'), 50);
                } else {
                    card.style.display = 'none';
                }
            });
        });
    });

    // --- SCROLL ANIMATIONS (Intersection Observer) ---
    const observerOptions = {
        threshold: 0.1,
        rootMargin: "0px 0px -50px 0px"
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                observer.unobserve(entry.target); // Only animate once
            }
        });
    }, observerOptions);

    const fadeElements = document.querySelectorAll('.fade-in');
    fadeElements.forEach(el => observer.observe(el));

    // --- INTERACTIVITY ---
    serviceCards.forEach(card => {
        card.addEventListener('click', () => {
            const title = card.querySelector('h3').innerText;
            // Simple interaction for now
            console.log(`User clicked on: ${title}`);
            // Force a small pulse effect
            card.style.transform = "scale(0.98)";
            setTimeout(() => card.style.transform = "", 150);
        });
    });
});
