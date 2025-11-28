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
        const typingSpeed = 20; // milliseconds per character
        
        function typeNext() {
            if (nodeIndex >= textNodes.length) {
                return;
            }

            const currentNode = textNodes[nodeIndex];
            
            if (currentNode.type === 'openTag' || currentNode.type === 'closeTag') {
                heroDescription.innerHTML += currentNode.content;
                nodeIndex++;
                return typeNext();
            }

            if (currentNode.type === 'text') {
                if (charIndex < currentNode.content.length) {
                    heroDescription.innerHTML += currentNode.content[charIndex];
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
        
        // Start typing after title appears
        setTimeout(() => {
            typeNext();
        }, 1000);
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
        
        show: function(title, message, type = 'success') {
            this.title.textContent = title;
            this.message.textContent = message;
            this.modal.className = `custom-modal ${type} active`;
            
            // Focus management
            this.button.focus();
        },
        
        hide: function() {
            this.modal.classList.remove('active');
        },
        
        init: function() {
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

    // Footer Section Micro Animations
    const footer = document.querySelector('.footer');
    if (footer) {
        const footerDescription = footer.querySelector('.footer-description');
        const footerColumns = footer.querySelectorAll('.footer-column');
        const footerNav = footer.querySelector('.footer-nav');

        // Initialize Footer elements
        if (footerDescription) {
            footerDescription.style.opacity = '0';
            footerDescription.style.transform = 'translateY(30px)';
            footerDescription.style.transition = 'opacity 0.8s ease-out, transform 0.8s ease-out';
        }
        footerColumns.forEach((column, index) => {
            column.style.opacity = '0';
            column.style.transform = 'translateY(30px)';
            column.style.transition = `opacity 0.7s ease-out ${0.2 + (index * 0.1)}s, transform 0.7s ease-out ${0.2 + (index * 0.1)}s`;
        });
        if (footerNav) {
            footerNav.style.opacity = '0';
            footerNav.style.transform = 'translateY(20px)';
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
    const partnersWrapper = document.querySelector('.partners-carousel-wrapper');

    if (partnersCarousel && partnersWrapper) {
        const waitForPartnerImages = () => {
            const images = partnersCarousel.querySelectorAll('img');
            if (!images.length) {
                return Promise.resolve();
            }

            const loaders = Array.from(images).map(img => {
                if (img.complete && img.naturalWidth > 0) {
                    return Promise.resolve();
                }
                return new Promise(resolve => {
                    const done = () => resolve();
                    img.addEventListener('load', done, { once: true });
                    img.addEventListener('error', done, { once: true });
                });
            });

            return Promise.all(loaders);
        };

        const initializePartnersCarousel = async () => {
            await waitForPartnerImages();

            if (!partnersCarousel.dataset.loopReady) {
                const originalItems = Array.from(partnersCarousel.children);
                const singleSetWidth = partnersCarousel.scrollWidth;

                if (!singleSetWidth || !originalItems.length) {
                    return;
                }

                let currentWidth = singleSetWidth;
                const minWidth = partnersWrapper.offsetWidth * 3;

                while (currentWidth < minWidth) {
                    originalItems.forEach(item => {
                        const clone = item.cloneNode(true);
                        clone.setAttribute('aria-hidden', 'true');
                        partnersCarousel.appendChild(clone);
                    });
                    currentWidth = partnersCarousel.scrollWidth;
                }

                partnersCarousel.dataset.loopReady = singleSetWidth;
            }

            const baseWidth = Number(partnersCarousel.dataset.loopReady) || partnersCarousel.scrollWidth;
            if (!baseWidth) {
                return;
            }

            let position = 0;
            let lastTimestamp = 0;
            let animationFrame;
            const speed = 40; // pixels per second

            const animate = (timestamp) => {
                if (!lastTimestamp) lastTimestamp = timestamp;
                const delta = timestamp - lastTimestamp;
                lastTimestamp = timestamp;

                position -= (speed * delta) / 1000;
                if (position <= -baseWidth) {
                    position += baseWidth;
                }

                partnersCarousel.style.transform = `translateX(${position}px)`;
                animationFrame = requestAnimationFrame(animate);
            };

            if (!partnersCarousel.dataset.looping) {
                partnersCarousel.dataset.looping = 'true';
                animationFrame = requestAnimationFrame(animate);
            }
        };

        initializePartnersCarousel();
    }
});
