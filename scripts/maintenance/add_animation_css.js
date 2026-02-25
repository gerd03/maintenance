const fs = require('fs');

// Read the style.css file
let content = fs.readFileSync('assets/css/style.css', 'utf-8');

// The CSS to add
const animationCss = `
/* Scroll Animation Utilities */
.reveal-on-scroll {
    opacity: 0;
    transform: translateY(30px);
    transition: opacity 0.6s ease-out, transform 0.6s ease-out;
    will-change: opacity, transform;
}

.reveal-on-scroll.is-visible {
    opacity: 1;
    transform: translateY(0);
}

.reveal-on-scroll-left {
    opacity: 0;
    transform: translateX(-20px);
    transition: opacity 0.6s ease-out, transform 0.6s ease-out;
    will-change: opacity, transform;
}

.reveal-on-scroll-left.is-visible {
    opacity: 1;
    transform: translateX(0);
}
`;

// Append to the end of the file
content += '\n' + animationCss;
console.log('✓ Added animation utility classes to style.css');
fs.writeFileSync('assets/css/style.css', content, 'utf-8');
