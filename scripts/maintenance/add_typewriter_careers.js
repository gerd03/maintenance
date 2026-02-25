const fs = require('fs');

// Read the script file
let content = fs.readFileSync('assets/js/script.js', 'utf-8');

// The updated code for careers page animations with typewriter effect
const updatedCareersCode = `
    // Careers Page Micro Animations
    document.addEventListener('DOMContentLoaded', function() {
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

            // Map Section on Careers Page
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
                        if (entry.target === heroTitle || entry.target === heroSubtitle) {
                            entry.target.style.opacity = '1';
                            entry.target.style.transform = 'translateY(0)';
                        }
                        
                        // Typewriter Trigger
                        if (entry.target === heroDesc) {
                            if (typeWriterFunc && !heroDesc.dataset.typingStarted) {
                                heroDesc.dataset.typingStarted = 'true';
                                typeWriterFunc();
                            }
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
            
            const allFormContainers = document.querySelectorAll('.form-container');
            allFormContainers.forEach(container => careersObserver.observe(container));
        }
    });
`;

// Find the start of the previous block
const startMarker = '// Careers Page Micro Animations';
const startIndex = content.indexOf(startMarker);

if (startIndex !== -1) {
    // Replace everything from the start marker to the end of the file (assuming it was appended to the end)
    // Or better, just replace the rest of the file if we are sure it's at the end.
    // Given the previous step appended it, it should be at the end.
    content = content.substring(0, startIndex) + updatedCareersCode;
    console.log('✓ Updated careers page animations with typewriter effect');
    fs.writeFileSync('assets/js/script.js', content, 'utf-8');
} else {
    console.log('✗ Could not find the previous code block to replace');
}
