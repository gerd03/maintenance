// =====================================================
// PERFORMANCE DETECTION FOR LOW-END DEVICES
// =====================================================
const isLowEndDevice = (() => {
    // Check for low memory (navigator.deviceMemory is in GB, undefined on unsupported)
    const lowMemory = navigator.deviceMemory && navigator.deviceMemory <= 2;
    // Check for low CPU cores
    const lowCPU = navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 2;
    // Check for mobile/touch device
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    // Check for slow connection
    const slowConnection = navigator.connection &&
        (navigator.connection.saveData ||
            navigator.connection.effectiveType === 'slow-2g' ||
            navigator.connection.effectiveType === '2g');
    // Check for reduced motion preference
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Consider device low-end if any 2+ conditions are true, or reduced motion is preferred
    const lowEndScore = [lowMemory, lowCPU, isMobile, slowConnection].filter(Boolean).length;
    const isLowEnd = prefersReducedMotion || lowEndScore >= 2;

    if (isLowEnd) {
        console.log('Low-end device detected - disabling heavy animations');
        document.documentElement.classList.add('low-end-device');
    }

    return isLowEnd;
})();

// Hero Slideshow Functionality
document.addEventListener('DOMContentLoaded', function () {
    const slides = document.querySelectorAll('.hero-slide');
    let currentSlide = 0;

    function showSlide(index) {
        slides.forEach((slide, i) => {
            slide.classList.remove('active', 'prev');
            if (i === index) {
                slide.classList.add('active');
            } else if (i < index) {
                slide.classList.add('prev');
            }
        });
    }

    function nextSlide() {
        currentSlide = (currentSlide + 1) % slides.length;
        showSlide(currentSlide);
    }

    // Auto-advance slideshow every 5 seconds
    if (slides.length > 0) {
        showSlide(0); // Initialize first slide
        setInterval(nextSlide, 5000);
    }

    // Typing Animation for Hero Description Only
    const heroTitle = document.querySelector('.hero-title');
    const heroDescription = document.querySelector('.hero-description');

    if (heroTitle) {
        // Title fades in smoothly
        heroTitle.style.opacity = '0';
        setTimeout(() => {
            heroTitle.style.transition = 'opacity 0.8s ease-in';
            heroTitle.style.opacity = '1';
        }, 200);
    }

    if (heroDescription) {
        // Skip typing animation on low-end devices - just show the content
        if (isLowEndDevice) {
            heroDescription.style.opacity = '1';
        } else {
            // Description has typing animation
            // Store the original HTML structure
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = heroDescription.innerHTML;
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
                    const openTag = `<${tagName}${node.className ? ` class="${node.className}"` : ''}>`;
                    const closeTag = `</${tagName}>`;

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

            // Clear the description
            heroDescription.innerHTML = '';
            heroDescription.style.opacity = '1';

            let nodeIndex = 0;
            let charIndex = 0;
            const typingSpeed = 5; // milliseconds per character (fast typing - ~3 seconds total)
            let lastTime = 0;

            function typeNext(timestamp) {
                // Use requestAnimationFrame for smoother, consistent timing
                if (!lastTime) lastTime = timestamp;

                const elapsed = timestamp - lastTime;

                // Only type when enough time has passed
                if (elapsed < typingSpeed) {
                    requestAnimationFrame(typeNext);
                    return;
                }

                lastTime = timestamp;

                if (nodeIndex >= textNodes.length) {
                    return;
                }

                const currentNode = textNodes[nodeIndex];

                if (currentNode.type === 'openTag' || currentNode.type === 'closeTag') {
                    heroDescription.innerHTML += currentNode.content;
                    nodeIndex++;
                    // Continue immediately for tags (no delay)
                    requestAnimationFrame(typeNext);
                    return;
                }

                if (currentNode.type === 'text') {
                    if (charIndex < currentNode.content.length) {
                        heroDescription.innerHTML += currentNode.content[charIndex];
                        charIndex++;
                        requestAnimationFrame(typeNext);
                    } else {
                        charIndex = 0;
                        nodeIndex++;
                        // Continue immediately when moving to next node
                        requestAnimationFrame(typeNext);
                    }
                } else {
                    nodeIndex++;
                    requestAnimationFrame(typeNext);
                }
            }

            // Start typing after title appears
            setTimeout(() => {
                requestAnimationFrame(typeNext);
            }, 1000);
        }
    }

    // Why Choose Us Image Carousel
    const whyImageSlides = document.querySelectorAll('.why-image-slide');
    let currentWhySlide = 0;

    function showWhySlide(index) {
        whyImageSlides.forEach((slide, i) => {
            slide.classList.toggle('active', i === index);
        });
    }

    function nextWhySlide() {
        currentWhySlide = (currentWhySlide + 1) % whyImageSlides.length;
        showWhySlide(currentWhySlide);
    }

    // Auto-advance Why Choose Us carousel every 4 seconds
    if (whyImageSlides.length > 0) {
        setInterval(nextWhySlide, 4000);
    }

    // Writing animation for Mission and Vision descriptions
    const missionVisionDescriptions = document.querySelectorAll('.mission-vision-description');
    const missionVisionLists = document.querySelectorAll('.mission-vision-list');

    function animateTextWriting(element, delay = 0) {
        if (!element) return;

        const originalText = element.innerHTML;
        element.innerHTML = '';
        element.style.opacity = '1';

        // Extract text content while preserving HTML structure
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = originalText;
        const textNodes = [];

        function extractText(node) {
            if (node.nodeType === Node.TEXT_NODE) {
                textNodes.push({
                    type: 'text',
                    content: node.textContent
                });
            } else if (node.nodeType === Node.ELEMENT_NODE) {
                const tagName = node.tagName.toLowerCase();
                const openTag = `<${tagName}${node.className ? ` class="${node.className}"` : ''}>`;
                const closeTag = `</${tagName}>`;

                textNodes.push({
                    type: 'openTag',
                    content: openTag
                });

                Array.from(node.childNodes).forEach(child => {
                    extractText(child);
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

        let nodeIndex = 0;
        let charIndex = 0;
        const typingSpeed = 15; // milliseconds per character

        function typeNext() {
            if (nodeIndex >= textNodes.length) {
                return;
            }

            const currentNode = textNodes[nodeIndex];

            if (currentNode.type === 'openTag' || currentNode.type === 'closeTag') {
                element.innerHTML += currentNode.content;
                nodeIndex++;
                return typeNext();
            }

            if (currentNode.type === 'text') {
                if (charIndex < currentNode.content.length) {
                    element.innerHTML += currentNode.content[charIndex];
                    charIndex++;
                    setTimeout(typeNext, typingSpeed);
                } else {
                    charIndex = 0;
                    nodeIndex++;
                    return typeNext();
                }
            } else {
                nodeIndex++;
                return typeNext();
            }
        }

        setTimeout(() => {
            typeNext();
        }, delay);
    }

    // Animate mission/vision descriptions when they come into view
    const missionVisionObserver = new IntersectionObserver((entries) => {
        entries.forEach((entry, index) => {
            if (entry.isIntersecting) {
                const card = entry.target.closest('.mission-vision-card');
                if (card) {
                    const description = card.querySelector('.mission-vision-description');
                    const list = card.querySelector('.mission-vision-list');

                    if (description && !description.dataset.animated) {
                        description.dataset.animated = 'true';
                        animateTextWriting(description, index * 300);
                    }

                    if (list && !list.dataset.animated) {
                        list.dataset.animated = 'true';
                        const listItems = list.querySelectorAll('li');
                        listItems.forEach((item, itemIndex) => {
                            item.style.opacity = '0';
                            setTimeout(() => {
                                item.style.transition = 'opacity 0.5s ease';
                                item.style.opacity = '1';
                            }, (index * 300) + 1500 + (itemIndex * 100));
                        });
                    }
                }
            }
        });
    }, { threshold: 0.3 });

    missionVisionDescriptions.forEach(desc => {
        missionVisionObserver.observe(desc);
    });
});

// FAQ Accordion Functionality
document.addEventListener('DOMContentLoaded', function () {
    // Handle hash navigation on page load (for cross-page links like from careers.html)
    if (window.location.hash) {
        const hash = window.location.hash;
        const target = document.querySelector(hash);

        if (target) {
            // Wait a moment for the page to fully load
            setTimeout(() => {
                const headerOffset = 100; // Offset for fixed header
                const elementPosition = target.getBoundingClientRect().top;
                const offsetPosition = elementPosition + window.pageYOffset - headerOffset;

                window.scrollTo({
                    top: offsetPosition,
                    behavior: 'smooth'
                });
            }, 100);
        }
    }

    const faqItems = document.querySelectorAll('.faq-item');

    faqItems.forEach(item => {
        const question = item.querySelector('.faq-question');

        question.addEventListener('click', () => {
            // Toggle active class
            const isActive = item.classList.contains('active');

            // Close all FAQ items
            faqItems.forEach(faq => faq.classList.remove('active'));

            // If the clicked item wasn't active, open it
            if (!isActive) {
                item.classList.add('active');
            }
        });
    });

    // Smooth scrolling for anchor links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));

            if (target) {
                const headerOffset = 80;
                const elementPosition = target.getBoundingClientRect().top;
                const offsetPosition = elementPosition + window.pageYOffset - headerOffset;

                window.scrollTo({
                    top: offsetPosition,
                    behavior: 'smooth'
                });
            }
        });
    });

    // Custom Modal System
    const customModal = {
        modal: document.getElementById('customModal'),
        title: document.getElementById('modalTitle'),
        message: document.getElementById('modalMessage'),
        button: document.getElementById('modalButton'),
        close: document.getElementById('modalClose'),

        show: function (title, message, type = 'success') {
            this.title.textContent = title;
            this.message.textContent = message;
            this.modal.className = `custom-modal ${type} active`;

            // Focus management
            this.button.focus();
        },

        hide: function () {
            this.modal.classList.remove('active');
        },

        init: function () {
            const self = this;

            // Close on button click
            this.button.addEventListener('click', () => {
                self.hide();
            });

            // Close on X button click
            this.close.addEventListener('click', () => {
                self.hide();
            });

            // Close on overlay click
            this.modal.querySelector('.modal-overlay').addEventListener('click', () => {
                self.hide();
            });

            // Close on Escape key
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape' && this.modal.classList.contains('active')) {
                    self.hide();
                }
            });
        }
    };

    // Initialize modal
    customModal.init();

    // Form validation and submission
    const contactForm = document.getElementById('contactForm');

    if (contactForm) {
        contactForm.addEventListener('submit', async function (e) {
            e.preventDefault();

            const name = document.getElementById('name').value.trim();
            const email = document.getElementById('email').value.trim();
            const message = document.getElementById('message').value.trim();

            // Basic validation
            if (!name || !email) {
                customModal.show('Required Fields', 'Please fill in all required fields.', 'error');
                return;
            }

            // Email validation
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                customModal.show('Invalid Email', 'Please enter a valid email address.', 'error');
                return;
            }

            // Disable submit button and show loading state
            const submitButton = contactForm.querySelector('button[type="submit"]');
            const originalButtonText = submitButton.textContent;
            submitButton.disabled = true;
            submitButton.textContent = 'SENDING...';

            try {
                // Determine API URL - use localhost:3000 for Node.js server
                const apiUrl = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
                    ? 'http://localhost:3000/api/contact'
                    : '/api/contact';

                // Send form data to backend
                const response = await fetch(apiUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        name: name,
                        email: email,
                        message: message
                    })
                });

                // Check if response is ok
                if (!response.ok) {
                    // Try to parse error response
                    let errorData;
                    try {
                        errorData = await response.json();
                    } catch {
                        errorData = { error: `Server error: ${response.status} ${response.statusText}` };
                    }

                    // Show specific error message from server
                    const errorMessage = errorData.error || `Server error: ${response.status}`;
                    throw new Error(errorMessage);
                }

                const data = await response.json();

                if (data.success) {
                    customModal.show(
                        'Message Sent!',
                        data.message || 'Thank you for your message! We will get back to you within 24-48 hours.',
                        'success'
                    );
                    contactForm.reset();
                } else {
                    customModal.show(
                        'Error',
                        data.error || 'Failed to send message. Please try again later.',
                        'error'
                    );
                }
            } catch (error) {
                console.error('Error submitting form:', error);

                // Check if it's a network error (server not running)
                if (error.message.includes('Failed to fetch') ||
                    error.message.includes('NetworkError') ||
                    error.message.includes('ERR_CONNECTION_REFUSED') ||
                    error.name === 'TypeError') {
                    customModal.show(
                        'Server Not Running',
                        'Please make sure the server is running.\n\n1. Install Node.js from https://nodejs.org/\n2. Close and reopen your terminal\n3. Run: npm install\n4. Run: npm start\n\nOr double-click START_SERVER.bat file.',
                        'error'
                    );
                } else {
                    customModal.show(
                        'Error',
                        error.message || 'An error occurred while sending your message. Please try again later.',
                        'error'
                    );
                }
            } finally {
                // Re-enable submit button
                submitButton.disabled = false;
                submitButton.textContent = originalButtonText;
            }
        });
    }

    // Add scroll animation to header
    let lastScroll = 0;
    const header = document.querySelector('.header');

    window.addEventListener('scroll', () => {
        const currentScroll = window.pageYOffset;

        if (currentScroll > 100) {
            header.style.boxShadow = '0 4px 20px rgba(0, 0, 0, 0.1)';
        } else {
            header.style.boxShadow = '0 2px 10px rgba(0, 0, 0, 0.05)';
        }

        lastScroll = currentScroll;
    });

    // Enhanced Intersection Observer for WordPress-like micro animations
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -100px 0px'
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('animate-in');
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0) scale(1)';
            }
        });
    }, observerOptions);

    // Observe elements for animation with staggered delays
    const animatedElements = document.querySelectorAll('.value-card, .faq-item, .section-title-center, .section-title-left, .why-content, .why-image-carousel-wrapper');
    animatedElements.forEach((el, index) => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(40px) scale(0.95)';
        el.style.transition = `opacity 0.8s ease-out ${index * 0.1}s, transform 0.8s ease-out ${index * 0.1}s`;
        observer.observe(el);
    });

    // About Us Section Micro Animations
    const aboutSection = document.querySelector('#about');
    if (aboutSection) {
        const aboutLabel = aboutSection.querySelector('.section-label');
        const aboutTitle = aboutSection.querySelector('.section-title');
        const aboutDescriptions = aboutSection.querySelectorAll('.about-description');

        // Initialize About Us section elements
        if (aboutLabel) {
            aboutLabel.style.opacity = '0';
            aboutLabel.style.transform = 'translateX(-20px)';
        }
        if (aboutTitle) {
            aboutTitle.style.opacity = '0';
            aboutTitle.style.transform = 'translateY(30px) scale(0.98)';
        }
        aboutDescriptions.forEach((desc, index) => {
            desc.style.opacity = '0';
            desc.style.transform = 'translateY(30px)';
            desc.style.transition = `opacity 0.8s cubic-bezier(0.4, 0, 0.2, 1) ${0.4 + (index * 0.15)}s, transform 0.8s cubic-bezier(0.4, 0, 0.2, 1) ${0.4 + (index * 0.15)}s`;
        });

        // Create observer for About Us section
        const aboutObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    // Animate label
                    if (aboutLabel && !aboutLabel.classList.contains('animate-in')) {
                        aboutLabel.classList.add('animate-in');
                        setTimeout(() => {
                            aboutLabel.style.opacity = '1';
                            aboutLabel.style.transform = 'translateX(0)';
                        }, 50);
                    }

                    // Animate title
                    if (aboutTitle && !aboutTitle.classList.contains('animate-in')) {
                        aboutTitle.classList.add('animate-in');
                        setTimeout(() => {
                            aboutTitle.style.opacity = '1';
                            aboutTitle.style.transform = 'translateY(0) scale(1)';
                        }, 200);
                    }

                    // Animate descriptions with stagger
                    aboutDescriptions.forEach((desc, index) => {
                        if (!desc.classList.contains('animate-in')) {
                            desc.classList.add('animate-in');
                            setTimeout(() => {
                                desc.style.opacity = '1';
                                desc.style.transform = 'translateY(0)';
                            }, 400 + (index * 150));
                        }
                    });
                }
            });
        }, {
            threshold: 0.1,
            rootMargin: '0px 0px -100px 0px'
        });

        aboutObserver.observe(aboutSection);
    }

    // Contact Section (Get in Touch) Micro Animations
    const contactSection = document.querySelector('#contact');
    if (contactSection) {
        const contactLabel = contactSection.querySelector('.section-label-white');
        const contactTitle = contactSection.querySelector('.contact-title');
        const contactSubtitle = contactSection.querySelector('.contact-subtitle');
        const contactForm = contactSection.querySelector('.contact-form-wrapper');
        const formGroups = contactSection.querySelectorAll('.form-group');

        // Initialize Contact section elements
        if (contactLabel) {
            contactLabel.style.opacity = '0';
            contactLabel.style.transform = 'translateY(-20px)';
            contactLabel.style.transition = 'opacity 0.6s ease-out, transform 0.6s ease-out';
        }
        if (contactTitle) {
            contactTitle.style.opacity = '0';
            contactTitle.style.transform = 'translateY(30px)';
            contactTitle.style.transition = 'opacity 0.8s cubic-bezier(0.4, 0, 0.2, 1) 0.2s, transform 0.8s cubic-bezier(0.4, 0, 0.2, 1) 0.2s';
        }
        if (contactSubtitle) {
            contactSubtitle.style.opacity = '0';
            contactSubtitle.style.transform = 'translateY(20px)';
            contactSubtitle.style.transition = 'opacity 0.7s ease-out 0.4s, transform 0.7s ease-out 0.4s';
        }
        if (contactForm) {
            contactForm.style.opacity = '0';
            contactForm.style.transform = 'translateX(30px) scale(0.98)';
            contactForm.style.transition = 'opacity 0.8s cubic-bezier(0.4, 0, 0.2, 1) 0.6s, transform 0.8s cubic-bezier(0.4, 0, 0.2, 1) 0.6s';
        }
        formGroups.forEach((group, index) => {
            group.style.opacity = '0';
            group.style.transform = 'translateY(20px)';
            group.style.transition = `opacity 0.6s ease-out ${0.8 + (index * 0.1)}s, transform 0.6s ease-out ${0.8 + (index * 0.1)}s`;
        });

        // Create observer for Contact section
        const contactObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    if (contactLabel && !contactLabel.classList.contains('animate-in')) {
                        contactLabel.classList.add('animate-in');
                        contactLabel.style.opacity = '1';
                        contactLabel.style.transform = 'translateY(0)';
                    }
                    if (contactTitle && !contactTitle.classList.contains('animate-in')) {
                        contactTitle.classList.add('animate-in');
                        contactTitle.style.opacity = '1';
                        contactTitle.style.transform = 'translateY(0)';
                    }
                    if (contactSubtitle && !contactSubtitle.classList.contains('animate-in')) {
                        contactSubtitle.classList.add('animate-in');
                        contactSubtitle.style.opacity = '1';
                        contactSubtitle.style.transform = 'translateY(0)';
                    }
                    if (contactForm && !contactForm.classList.contains('animate-in')) {
                        contactForm.classList.add('animate-in');
                        contactForm.style.opacity = '1';
                        contactForm.style.transform = 'translateX(0) scale(1)';
                    }
                    formGroups.forEach((group) => {
                        if (!group.classList.contains('animate-in')) {
                            group.classList.add('animate-in');
                            group.style.opacity = '1';
                            group.style.transform = 'translateY(0)';
                        }
                    });
                }
            });
        }, {
            threshold: 0.15,
            rootMargin: '0px 0px -100px 0px'
        });

        contactObserver.observe(contactSection);
    }


    // Map Section Micro Animations
    const mapSection = document.querySelector('.map-section-home');
    if (mapSection) {
        const mapHeader = mapSection.querySelector('.section-header');
        const locationForm = mapSection.querySelector('.location-form-card');
        const mapInstruction = mapSection.querySelector('.map-instruction');
        const mapContainer = mapSection.querySelector('#mapHome');

        // Initialize Map section elements
        if (mapHeader) {
            mapHeader.style.opacity = '0';
            mapHeader.style.transform = 'translateY(30px)';
            mapHeader.style.transition = 'opacity 0.8s cubic-bezier(0.4, 0, 0.2, 1), transform 0.8s cubic-bezier(0.4, 0, 0.2, 1)';
        }
        if (locationForm) {
            locationForm.style.opacity = '0';
            locationForm.style.transform = 'translateY(40px)';
            locationForm.style.transition = 'opacity 0.8s cubic-bezier(0.4, 0, 0.2, 1) 0.2s, transform 0.8s cubic-bezier(0.4, 0, 0.2, 1) 0.2s';
        }
        if (mapInstruction) {
            mapInstruction.style.opacity = '0';
            mapInstruction.style.transform = 'translateY(20px)';
            mapInstruction.style.transition = 'opacity 0.6s ease-out 0.4s, transform 0.6s ease-out 0.4s';
        }
        if (mapContainer) {
            mapContainer.style.opacity = '0';
            mapContainer.style.transform = 'translateY(40px) scale(0.98)';
            mapContainer.style.transition = 'opacity 1s cubic-bezier(0.4, 0, 0.2, 1) 0.5s, transform 1s cubic-bezier(0.4, 0, 0.2, 1) 0.5s';
        }

        // Create observer for Map section
        const mapObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    if (mapHeader && !mapHeader.classList.contains('animate-in')) {
                        mapHeader.classList.add('animate-in');
                        mapHeader.style.opacity = '1';
                        mapHeader.style.transform = 'translateY(0)';
                    }
                    if (locationForm && !locationForm.classList.contains('animate-in')) {
                        locationForm.classList.add('animate-in');
                        locationForm.style.opacity = '1';
                        locationForm.style.transform = 'translateY(0)';
                    }
                    if (mapInstruction && !mapInstruction.classList.contains('animate-in')) {
                        mapInstruction.classList.add('animate-in');
                        mapInstruction.style.opacity = '1';
                        mapInstruction.style.transform = 'translateY(0)';
                    }
                    if (mapContainer && !mapContainer.classList.contains('animate-in')) {
                        mapContainer.classList.add('animate-in');
                        mapContainer.style.opacity = '1';
                        mapContainer.style.transform = 'translateY(0) scale(1)';
                    }
                }
            });
        }, {
            threshold: 0.15,
            rootMargin: '0px 0px -100px 0px'
        });

        mapObserver.observe(mapSection);
    }


    // Footer Section Micro Animations
    const footer = document.querySelector('.footer');
    if (footer) {
        const footerDescription = footer.querySelector('.footer-description');
        const footerColumns = footer.querySelectorAll('.footer-column');
        const footerNav = footer.querySelector('.footer-nav');

        // Initialize Footer elements - kept visible for reliability
        if (footerDescription) {
            // footerDescription.style.opacity = '0';
            // footerDescription.style.transform = 'translateY(30px)';
            footerDescription.style.transition = 'opacity 0.8s ease-out, transform 0.8s ease-out';
        }
        footerColumns.forEach((column, index) => {
            // column.style.opacity = '0';
            // column.style.transform = 'translateY(30px)';
            column.style.transition = `opacity 0.7s ease-out ${0.2 + (index * 0.1)}s, transform 0.7s ease-out ${0.2 + (index * 0.1)}s`;
        });
        if (footerNav) {
            // footerNav.style.opacity = '0';
            // footerNav.style.transform = 'translateY(20px)';
            footerNav.style.transition = 'opacity 0.6s ease-out 0.8s, transform 0.6s ease-out 0.8s';
        }

        // Create observer for Footer
        const footerObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    if (footerDescription && !footerDescription.classList.contains('animate-in')) {
                        footerDescription.classList.add('animate-in');
                        footerDescription.style.opacity = '1';
                        footerDescription.style.transform = 'translateY(0)';
                    }
                    footerColumns.forEach((column) => {
                        if (!column.classList.contains('animate-in')) {
                            column.classList.add('animate-in');
                            column.style.opacity = '1';
                            column.style.transform = 'translateY(0)';
                        }
                    });
                    if (footerNav && !footerNav.classList.contains('animate-in')) {
                        footerNav.classList.add('animate-in');
                        footerNav.style.opacity = '1';
                        footerNav.style.transform = 'translateY(0)';
                    }
                }
            });
        }, {
            threshold: 0.2,
            rootMargin: '0px 0px -50px 0px'
        });

        footerObserver.observe(footer);
    }

    // Animate list items in Why Choose Us section
    const whyListItems = document.querySelectorAll('.why-list li');
    const whyListObserver = new IntersectionObserver((entries) => {
        entries.forEach((entry, index) => {
            if (entry.isIntersecting) {
                setTimeout(() => {
                    entry.target.style.opacity = '1';
                    entry.target.style.transform = 'translateX(0)';
                }, index * 50);
            }
        });
    }, { threshold: 0.1 });

    whyListItems.forEach(item => {
        whyListObserver.observe(item);
    });

    // Parallax effect for hero section (disabled on mobile for performance)
    if (window.innerWidth > 768) {
        window.addEventListener('scroll', () => {
            const scrolled = window.pageYOffset;
            const heroSlideshow = document.querySelector('.hero-slideshow');
            if (heroSlideshow) {
                heroSlideshow.style.transform = `translateY(${scrolled * 0.5}px)`;
            }
        });
    }

    // Partners Carousel - continuous infinite auto-scroll
    const partnersCarousel = document.querySelector('.partners-carousel');

    if (partnersCarousel) {
        // Force load all partner images (remove lazy loading)
        const partnerImages = partnersCarousel.querySelectorAll('img');
        partnerImages.forEach(img => {
            img.loading = 'eager';
        });

        const waitForPartnerImages = () => {
            const images = partnersCarousel.querySelectorAll('img');
            if (!images.length) return Promise.resolve();

            const loaders = Array.from(images).map(img => {
                if (img.complete && img.naturalWidth > 0) {
                    return Promise.resolve();
                }
                return new Promise(resolve => {
                    const done = () => resolve();
                    img.addEventListener('load', done, { once: true });
                    img.addEventListener('error', done, { once: true });
                    // Timeout fallback in case image never loads
                    setTimeout(done, 3000);
                });
            });

            return Promise.all(loaders);
        };

        const initializePartnersCarousel = async () => {
            // Pause animation during setup
            partnersCarousel.style.animationPlayState = 'paused';

            await waitForPartnerImages();

            if (partnersCarousel.dataset.loopReady) return;

            const originalItems = Array.from(partnersCarousel.children);
            if (!originalItems.length) return;

            const singleSetWidth = partnersCarousel.scrollWidth;
            if (!singleSetWidth) return;

            // Clone items twice for seamless infinite loop
            const fragment = document.createDocumentFragment();
            for (let i = 0; i < 2; i++) {
                originalItems.forEach(item => {
                    const clone = item.cloneNode(true);
                    clone.setAttribute('aria-hidden', 'true');
                    fragment.appendChild(clone);
                });
            }

            partnersCarousel.appendChild(fragment);

            const speed = 50; // pixels per second (slower = smoother)
            const duration = singleSetWidth / speed;

            partnersCarousel.style.setProperty('--partners-loop-distance', `${singleSetWidth}px`);
            partnersCarousel.style.setProperty('--partners-loop-duration', `${duration}s`);
            partnersCarousel.dataset.loopReady = 'true';

            // Resume animation after a brief delay
            requestAnimationFrame(() => {
                partnersCarousel.style.animationPlayState = 'running';
            });
        };

        initializePartnersCarousel();
    }
});

// Careers Form Handling
document.addEventListener('DOMContentLoaded', function () {
    const careersForm = document.getElementById('careersForm');

    if (!careersForm) return; // Exit if not on careers page

    // Form submission handler
    careersForm.addEventListener('submit', async function (e) {
        e.preventDefault();

        // Get form values
        const fullName = document.getElementById('fullName').value.trim();
        const email = document.getElementById('email').value.trim();
        const phone = document.getElementById('phone').value.trim();
        const workingHours = document.querySelector('input[name="workingHours"]:checked')?.value;
        const availability = document.querySelector('input[name="availability"]:checked')?.value;
        const experience = document.getElementById('experience').value.trim();
        const yearsExperience = document.querySelector('input[name="yearsExperience"]:checked')?.value;
        const resumeFile = document.getElementById('resume').files[0];
        const whyHireYou = document.getElementById('whyHireYou').value.trim();
        const compensation = document.getElementById('compensation').value.trim();

        // New fields
        const flexibleSchedule = document.querySelector('input[name="flexibleSchedule"]:checked')?.value;
        const workAuthorization = document.querySelector('input[name="workAuthorization"]:checked')?.value;
        const weekendAvailability = document.querySelector('input[name="weekendAvailability"]:checked')?.value;
        const reliableTransportation = document.querySelector('input[name="reliableTransportation"]:checked')?.value;
        const previousTermination = document.querySelector('input[name="previousTermination"]:checked')?.value;
        const relevantSkills = document.getElementById('relevantSkills').value.trim();
        const coverLetterFile = document.getElementById('coverLetter').files[0];

        // Get modal from main page
        const customModal = {
            modal: document.getElementById('customModal'),
            title: document.getElementById('modalTitle'),
            message: document.getElementById('modalMessage'),
            button: document.getElementById('modalButton'),

            show: function (title, message, type = 'success') {
                this.title.textContent = title;
                this.message.textContent = message;
                this.modal.className = `custom-modal ${type} active`;
                this.button.focus();
            },

            hide: function () {
                this.modal.classList.remove('active');
            }
        };

        // Validation
        if (!fullName || !email || !phone) {
            customModal.show('Required Fields', 'Please fill in your full name, email, and phone number.', 'error');
            return;
        }

        // Email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            customModal.show('Invalid Email', 'Please enter a valid email address.', 'error');
            return;
        }

        // Check if working hours is selected
        if (!workingHours) {
            customModal.show('Required Selection', 'Please select your preferred working hours.', 'error');
            return;
        }

        // Check if availability is selected
        if (!availability) {
            customModal.show('Required Selection', 'Please select when you can start.', 'error');
            return;
        }

        // Check if experience is provided
        if (!experience) {
            customModal.show('Required Field', 'Please tell us about your experience as a Virtual Assistant.', 'error');
            return;
        }

        // Check if years of experience is selected
        if (!yearsExperience) {
            customModal.show('Required Selection', 'Please select your years of experience.', 'error');
            return;
        }

        // Check if resume file is provided
        if (!resumeFile) {
            customModal.show('Required Field', 'Please upload your resume/portfolio file.', 'error');
            return;
        }

        // Validate file size (10MB max)
        const maxFileSize = 10 * 1024 * 1024; // 10MB in bytes
        if (resumeFile.size > maxFileSize) {
            customModal.show('File Too Large', 'Resume file must be smaller than 10MB. Please compress or use a different file.', 'error');
            return;
        }

        // Validate file type
        const allowedTypes = [
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'image/png',
            'image/jpeg',
            'image/jpg'
        ];
        if (!allowedTypes.includes(resumeFile.type)) {
            customModal.show('Invalid File Type', 'Please upload a PDF, Word, Excel, PNG, or JPG file.', 'error');
            return;
        }

        // Check if "why hire you" is provided
        if (!whyHireYou) {
            customModal.show('Required Field', 'Please tell us why we should consider you for this role.', 'error');
            return;
        }

        // Check if compensation is provided
        if (!compensation) {
            customModal.show('Required Field', 'Please provide your expected compensation.', 'error');
            return;
        }

        // Validate new Yes/No questions
        if (!flexibleSchedule) {
            customModal.show('Required Selection', 'Please answer if you are willing to adjust your work hours.', 'error');
            return;
        }

        if (!workAuthorization) {
            customModal.show('Required Selection', 'Please answer if you are legally authorized to work in this country.', 'error');
            return;
        }

        if (!weekendAvailability) {
            customModal.show('Required Selection', 'Please answer if you are willing to work on weekends or holidays.', 'error');
            return;
        }

        if (!reliableTransportation) {
            customModal.show('Required Selection', 'Please answer if you have reliable transportation to work.', 'error');
            return;
        }

        if (!previousTermination) {
            customModal.show('Required Selection', 'Please answer if you have ever been terminated from a job.', 'error');
            return;
        }

        // Check if relevant skills is provided
        if (!relevantSkills) {
            customModal.show('Required Field', 'Please list your relevant skills for the position.', 'error');
            return;
        }

        // Validate cover letter file if provided (optional)
        if (coverLetterFile) {
            if (coverLetterFile.size > maxFileSize) {
                customModal.show('File Too Large', 'Cover letter file must be smaller than 10MB. Please compress or use a different file.', 'error');
                return;
            }
            const coverLetterAllowedTypes = [
                'application/pdf',
                'application/msword',
                'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
            ];
            if (!coverLetterAllowedTypes.includes(coverLetterFile.type)) {
                customModal.show('Invalid File Type', 'Cover letter must be a PDF or Word document.', 'error');
                return;
            }
        }


        // Disable submit button and show loading state
        const submitButton = careersForm.querySelector('button[type="submit"]');
        const originalButtonText = submitButton.textContent;
        submitButton.disabled = true;
        submitButton.textContent = 'UPLOADING...';

        try {
            // Convert resume file to base64
            const fileReader = new FileReader();
            const fileData = await new Promise((resolve, reject) => {
                fileReader.onload = () => resolve(fileReader.result);
                fileReader.onerror = () => reject(new Error('Failed to read file'));
                fileReader.readAsDataURL(resumeFile);
            });

            // Convert cover letter to base64 if provided
            let coverLetterData = null;
            if (coverLetterFile) {
                const coverLetterReader = new FileReader();
                coverLetterData = await new Promise((resolve, reject) => {
                    coverLetterReader.onload = () => resolve(coverLetterReader.result);
                    coverLetterReader.onerror = () => reject(new Error('Failed to read cover letter file'));
                    coverLetterReader.readAsDataURL(coverLetterFile);
                });
            }

            // Determine API URL
            const apiUrl = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
                ? 'http://localhost:3000/api/careers'
                : '/api/careers';

            // Send form data to backend
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    fullName,
                    email,
                    phone,
                    workingHours,
                    availability,
                    experience,
                    yearsExperience,
                    resume: fileData,
                    resumeFileName: resumeFile.name,
                    resumeFileType: resumeFile.type,
                    whyHireYou,
                    compensation,
                    // New fields
                    flexibleSchedule,
                    workAuthorization,
                    weekendAvailability,
                    reliableTransportation,
                    previousTermination,
                    relevantSkills,
                    coverLetter: coverLetterData,
                    coverLetterFileName: coverLetterFile?.name || null,
                    coverLetterFileType: coverLetterFile?.type || null
                })
            });

            // Check if response is ok
            if (!response.ok) {
                let errorData;
                try {
                    errorData = await response.json();
                } catch {
                    errorData = { error: `Server error: ${response.status} ${response.statusText}` };
                }

                const errorMessage = errorData.error || `Server error: ${response.status}`;
                throw new Error(errorMessage);
            }

            const data = await response.json();

            if (data.success) {
                customModal.show(
                    'Application Submitted!',
                    data.message || 'Thank you for your application! We will review your submission and get back to you soon.',
                    'success'
                );

                // Reset form
                careersForm.reset();

                // Clear button selections
                document.querySelectorAll('.option-button.selected').forEach(btn => {
                    btn.classList.remove('selected');
                });
            } else {
                customModal.show(
                    'Error',
                    data.error || 'Failed to submit application. Please try again later.',
                    'error'
                );
            }
        } catch (error) {
            console.error('Error submitting form:', error);

            // Check if it's a network error
            if (error.message.includes('Failed to fetch') ||
                error.message.includes('NetworkError') ||
                error.message.includes('ERR_CONNECTION_REFUSED') ||
                error.name === 'TypeError') {
                customModal.show(
                    'Server Not Running',
                    'Please make sure the server is running.\n\n1. Install Node.js from https://nodejs.org/\n2. Close and reopen your terminal\n3. Run: npm install\n4. Run: npm start',
                    'error'
                );
            } else {
                customModal.show(
                    'Error',
                    error.message || 'An error occurred while submitting your application. Please try again later.',
                    'error'
                );
            }
        } finally {
            // Re-enable submit button
            submitButton.disabled = false;
            submitButton.textContent = originalButtonText;
        }
    });
});

// Hamburger Menu Functionality
document.addEventListener('DOMContentLoaded', function () {
    const hamburger = document.querySelector('.hamburger-menu');
    const navMenu = document.querySelector('.header-actions');

    if (hamburger && navMenu) {
        hamburger.addEventListener('click', function () {
            hamburger.classList.toggle('active');
            navMenu.classList.toggle('active');
        });

        // Close menu when clicking outside
        document.addEventListener('click', function (event) {
            if (!hamburger.contains(event.target) && !navMenu.contains(event.target)) {
                hamburger.classList.remove('active');
                navMenu.classList.remove('active');
            }
        });

        // Close menu when clicking a link
        const navLinks = navMenu.querySelectorAll('a');
        navLinks.forEach(link => {
            link.addEventListener('click', () => {
                hamburger.classList.remove('active');
                navMenu.classList.remove('active');
            });
        });
    }
});




// Careers Page Micro Animations (Refactored)
document.addEventListener('DOMContentLoaded', function () {
    const careersPage = document.querySelector('.hero-minimal'); // Check if we are on careers page
    if (careersPage) {
        console.log('Careers page detected, initializing animations...');

        // Helper function to setup animation
        const setupAnimation = (element, delay = 0, type = 'reveal-on-scroll') => {
            if (element) {
                element.classList.add(type);
                if (delay > 0) {
                    element.style.transitionDelay = `${delay}s`;
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
                    const openTag = `<${tagName}${node.className ? ` class="${node.className}"` : ''}>`;
                    const closeTag = `</${tagName}>`;

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

            typeWriterFunc = function () {
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
