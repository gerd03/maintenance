const fs = require('fs');

// Read the script file
let content = fs.readFileSync('assets/js/script.js', 'utf-8');

// The updated code for careers page animations using CSS classes
const updatedCareersCode = `
    // Careers Page Micro Animations (Refactored)
    document.addEventListener('DOMContentLoaded', function() {
        const careersPage = document.querySelector('.hero-minimal'); // Check if we are on careers page
        if (careersPage) {
            console.log('Careers page detected, initializing animations...');
            
            // Helper function to setup animation
            const setupAnimation = (element, delay = 0, type = 'reveal-on-scroll') => {
                if (element) {
                    element.classList.add(type);
                    if (delay > 0) {
                        element.style.transitionDelay = \`\${delay}s\`;
                    }
                }
            };

            // Hero Section
            const heroTitle = document.querySelector('.hero-minimal h1');
            const heroSubtitle = document.querySelector('.hero-minimal h2');
            const heroDesc = document.querySelector('.hero-minimal p');

            setupAnimation(heroTitle, 0);
            setupAnimation(heroSubtitle, 0.2);
            
            // Typewriter Setup for Description
            let typeWriterFunc = null;
            if (heroDesc) {
                // Store the original HTML structure
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = heroDesc.innerHTML;
                const textNodes = [];

                // Extract text content while preserving HTML structure
                function extractText(node, parentTag = '') {
                    if (node.nodeType === Node.TEXT_NODE) {
                        textNodes.push({
                            type: 'text',
                            content: node.textContent,
                            parentTag: parentTag
                        });
                    } else if (node.nodeType === Node.ELEMENT_NODE) {
                        const tagName = node.tagName.toLowerCase();
                        const openTag = \`<\${tagName}\${node.className ? \` class="\${node.className}"\` : ''}>\`;
                        const closeTag = \`</\${tagName}>\`;

                        textNodes.push({
                            type: 'openTag',
                            content: openTag
                        });

                        Array.from(node.childNodes).forEach(child => {
                            extractText(child, tagName);
                        });

                        textNodes.push({
                            type: 'closeTag',
                            content: closeTag
                        });
                    }
                }

                Array.from(tempDiv.childNodes).forEach(node => {
                    extractText(node);
                });

                // Clear the description initially
                heroDesc.innerHTML = '';
                heroDesc.style.opacity = '1'; // Keep visible for typing

                let nodeIndex = 0;
                let charIndex = 0;
                const typingSpeed = 15;

                typeWriterFunc = function() {
                    if (nodeIndex >= textNodes.length) return;

                    const currentNode = textNodes[nodeIndex];

                    if (currentNode.type === 'openTag' || currentNode.type === 'closeTag') {
                        heroDesc.innerHTML += currentNode.content;
                        nodeIndex++;
                        typeWriterFunc();
                        return;
                    }

                    if (currentNode.type === 'text') {
                        if (charIndex < currentNode.content.length) {
                            heroDesc.innerHTML += currentNode.content[charIndex];
                            charIndex++;
                            setTimeout(typeWriterFunc, typingSpeed);
                        } else {
                            charIndex = 0;
                            nodeIndex++;
                            typeWriterFunc();
                        }
                    } else {
                        nodeIndex++;
                        typeWriterFunc();
                    }
                };
            }

            // Job Overview
            const overviewSection = document.querySelector('.overview');
            const overviewItems = document.querySelectorAll('.overview-item');
            
            if (overviewSection) {
                const overviewTitle = overviewSection.querySelector('h3');
                setupAnimation(overviewTitle, 0);
                
                overviewItems.forEach((item, index) => {
                    setupAnimation(item, 0.2 + (index * 0.1));
                });
            }

            // Section Blocks (Qualifications & Responsibilities)
            const sectionBlocks = document.querySelectorAll('.section-block');
            sectionBlocks.forEach(block => {
                const title = block.querySelector('h3');
                const listItems = block.querySelectorAll('li');
                const cards = block.querySelectorAll('.resp-card');

                setupAnimation(title, 0);
                
                listItems.forEach((item, index) => {
                    setupAnimation(item, 0.2 + (index * 0.05), 'reveal-on-scroll-left');
                });

                cards.forEach((card, index) => {
                    setupAnimation(card, 0.2 + (index * 0.2));
                });
            });

            // Application Form
            const formContainer = document.querySelector('.form-container'); // First one is application form
            setupAnimation(formContainer, 0.2);

            // Map Section on Careers Page
            const mapSectionCareers = document.querySelector('.map-section');
            if (mapSectionCareers) {
                const mapContainerParent = mapSectionCareers.closest('.form-container');
                if (mapContainerParent && mapContainerParent !== formContainer) {
                     setupAnimation(mapContainerParent, 0.2);
                }
            }

            // Observer for Careers Page
            const careersObserver = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        // Add is-visible class to trigger animation
                        if (entry.target.classList.contains('reveal-on-scroll') || entry.target.classList.contains('reveal-on-scroll-left')) {
                            entry.target.classList.add('is-visible');
                        }

                        // Typewriter Trigger
                        if (entry.target === heroDesc) {
                            if (typeWriterFunc && !heroDesc.dataset.typingStarted) {
                                heroDesc.dataset.typingStarted = 'true';
                                typeWriterFunc();
                            }
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
            
            if (overviewSection) {
                const overviewTitle = overviewSection.querySelector('h3');
                if (overviewTitle) careersObserver.observe(overviewTitle);
                overviewItems.forEach(item => careersObserver.observe(item));
            }

            sectionBlocks.forEach(block => {
                const title = block.querySelector('h3');
                if (title) careersObserver.observe(title);
                
                const listItems = block.querySelectorAll('li');
                listItems.forEach(item => careersObserver.observe(item));

                const cards = block.querySelectorAll('.resp-card');
                cards.forEach(card => careersObserver.observe(card));
            });
            
            const allFormContainers = document.querySelectorAll('.form-container');
            allFormContainers.forEach(container => careersObserver.observe(container));
        }
    });
`;

// Find the start of the previous block
const startMarker = '// Careers Page Micro Animations';
const startIndex = content.indexOf(startMarker);

if (startIndex !== -1) {
    // Replace everything from the start marker to the end of the file
    content = content.substring(0, startIndex) + updatedCareersCode;
    console.log('✓ Refactored careers page animations to use CSS classes');
    fs.writeFileSync('assets/js/script.js', content, 'utf-8');
} else {
    console.log('✗ Could not find the previous code block to replace');
}
