const fs = require('fs');

// Read the script file
let content = fs.readFileSync('assets/js/script.js', 'utf-8');

// The code to add for map animations
const mapAnimationCode = `
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
`;

// Insert before the Footer Section animations
const insertPoint = '// Footer Section Micro Animations';
if (content.includes(insertPoint)) {
    content = content.replace(insertPoint, mapAnimationCode + '\n\n    ' + insertPoint);
    console.log('✓ Added map section animations');
    fs.writeFileSync('assets/js/script.js', content, 'utf-8');
} else {
    console.log('✗ Could not find insertion point');
}
