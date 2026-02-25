const fs = require('fs');

// Read the script file
let content = fs.readFileSync('assets/js/script.js', 'utf-8');

// The code to add for careers page animations
const careersAnimationCode = `
    // Careers Page Micro Animations
    const careersPage = document.querySelector('.hero-minimal'); // Check if we are on careers page
    if (careersPage) {
        // Hero Section
        const heroTitle = document.querySelector('.hero-minimal h1');
        const heroSubtitle = document.querySelector('.hero-minimal h2');
        const heroDesc = document.querySelector('.hero-minimal p');

        if (heroTitle) {
            heroTitle.style.opacity = '0';
            heroTitle.style.transform = 'translateY(30px)';
            heroTitle.style.transition = 'opacity 0.8s ease-out, transform 0.8s ease-out';
        }
        if (heroSubtitle) {
            heroSubtitle.style.opacity = '0';
            heroSubtitle.style.transform = 'translateY(30px)';
            heroSubtitle.style.transition = 'opacity 0.8s ease-out 0.2s, transform 0.8s ease-out 0.2s';
        }
        if (heroDesc) {
            heroDesc.style.opacity = '0';
            heroDesc.style.transform = 'translateY(30px)';
            heroDesc.style.transition = 'opacity 0.8s ease-out 0.4s, transform 0.8s ease-out 0.4s';
        }

        // Job Overview
        const overviewSection = document.querySelector('.overview');
        const overviewItems = document.querySelectorAll('.overview-item');
        
        if (overviewSection) {
            const overviewTitle = overviewSection.querySelector('h3');
            if (overviewTitle) {
                overviewTitle.style.opacity = '0';
                overviewTitle.style.transform = 'translateY(20px)';
                overviewTitle.style.transition = 'opacity 0.6s ease-out, transform 0.6s ease-out';
            }
            overviewItems.forEach((item, index) => {
                item.style.opacity = '0';
                item.style.transform = 'translateY(20px)';
                item.style.transition = \`opacity 0.6s ease-out \${0.2 + (index * 0.1)}s, transform 0.6s ease-out \${0.2 + (index * 0.1)}s\`;
            });
        }

        // Section Blocks (Qualifications & Responsibilities)
        const sectionBlocks = document.querySelectorAll('.section-block');
        sectionBlocks.forEach(block => {
            const title = block.querySelector('h3');
            const listItems = block.querySelectorAll('li');
            const cards = block.querySelectorAll('.resp-card');

            if (title) {
                title.style.opacity = '0';
                title.style.transform = 'translateY(20px)';
                title.style.transition = 'opacity 0.6s ease-out, transform 0.6s ease-out';
            }
            
            listItems.forEach((item, index) => {
                item.style.opacity = '0';
                item.style.transform = 'translateX(-10px)';
                item.style.transition = \`opacity 0.5s ease-out \${0.2 + (index * 0.05)}s, transform 0.5s ease-out \${0.2 + (index * 0.05)}s\`;
            });

            cards.forEach((card, index) => {
                card.style.opacity = '0';
                card.style.transform = 'translateY(30px)';
                card.style.transition = \`opacity 0.7s ease-out \${0.2 + (index * 0.2)}s, transform 0.7s ease-out \${0.2 + (index * 0.2)}s\`;
            });
        });

        // Application Form
        const formContainer = document.querySelector('.form-container'); // First one is application form
        if (formContainer) {
            formContainer.style.opacity = '0';
            formContainer.style.transform = 'translateY(50px)';
            formContainer.style.transition = 'opacity 0.8s cubic-bezier(0.4, 0, 0.2, 1), transform 0.8s cubic-bezier(0.4, 0, 0.2, 1)';
        }

        // Map Section on Careers Page (Second form-container or distinct class)
        // Note: The map section in careers.html is inside a .form-container but we can target the .map-section inside it
        const mapSectionCareers = document.querySelector('.map-section');
        if (mapSectionCareers) {
            const mapContainerParent = mapSectionCareers.closest('.form-container');
            if (mapContainerParent && mapContainerParent !== formContainer) {
                 mapContainerParent.style.opacity = '0';
                 mapContainerParent.style.transform = 'translateY(50px)';
                 mapContainerParent.style.transition = 'opacity 0.8s cubic-bezier(0.4, 0, 0.2, 1), transform 0.8s cubic-bezier(0.4, 0, 0.2, 1)';
            }
        }


        // Observer for Careers Page
        const careersObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    // Hero Elements
                    if (entry.target === heroTitle || entry.target === heroSubtitle || entry.target === heroDesc) {
                        entry.target.style.opacity = '1';
                        entry.target.style.transform = 'translateY(0)';
                    }

                    // Overview
                    if (entry.target.classList.contains('overview')) {
                        const title = entry.target.querySelector('h3');
                        if (title) {
                            title.style.opacity = '1';
                            title.style.transform = 'translateY(0)';
                        }
                        const items = entry.target.querySelectorAll('.overview-item');
                        items.forEach(item => {
                            item.style.opacity = '1';
                            item.style.transform = 'translateY(0)';
                        });
                    }

                    // Section Blocks
                    if (entry.target.classList.contains('section-block')) {
                        const title = entry.target.querySelector('h3');
                        if (title) {
                            title.style.opacity = '1';
                            title.style.transform = 'translateY(0)';
                        }
                        const items = entry.target.querySelectorAll('li');
                        items.forEach(item => {
                            item.style.opacity = '1';
                            item.style.transform = 'translateX(0)';
                        });
                        const cards = entry.target.querySelectorAll('.resp-card');
                        cards.forEach(card => {
                            card.style.opacity = '1';
                            card.style.transform = 'translateY(0)';
                        });
                    }

                    // Form Containers
                    if (entry.target.classList.contains('form-container')) {
                        entry.target.style.opacity = '1';
                        entry.target.style.transform = 'translateY(0)';
                    }
                }
            });
        }, {
            threshold: 0.1,
            rootMargin: '0px 0px -50px 0px'
        });

        // Observe elements
        if (heroTitle) careersObserver.observe(heroTitle);
        if (heroSubtitle) careersObserver.observe(heroSubtitle);
        if (heroDesc) careersObserver.observe(heroDesc);
        if (overviewSection) careersObserver.observe(overviewSection);
        sectionBlocks.forEach(block => careersObserver.observe(block));
        
        // Observe all form containers (Application Form and Map Container)
        const allFormContainers = document.querySelectorAll('.form-container');
        allFormContainers.forEach(container => careersObserver.observe(container));
    }
`;

// Insert at the end of the file
content += '\n' + careersAnimationCode;
console.log('✓ Added careers page animations');
fs.writeFileSync('assets/js/script.js', content, 'utf-8');
