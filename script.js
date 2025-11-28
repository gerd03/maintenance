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

    // Parallax effect for hero section
    window.addEventListener('scroll', () => {
        const scrolled = window.pageYOffset;
        const heroSlideshow = document.querySelector('.hero-slideshow');
        if (heroSlideshow) {
            heroSlideshow.style.transform = `translateY(${scrolled * 0.5}px)`;
        }
    });
});
