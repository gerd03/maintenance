const fs = require('fs');

// Read the HTML file
let content = fs.readFileSync('careers.html', 'utf-8');

// 1. Update form-container CSS
// We use a regex to match the block because of potential whitespace variations
const cssRegex = /(\.form-container\s*\{\s*max-width:\s*600px;\s*margin:\s*0\s*auto;\s*padding:\s*28px\s*20px;\s*background:\s*white;\s*)border:\s*2px\s*solid\s*#e5e7eb;(\s*border-radius:\s*12px;\s*)box-shadow:\s*0\s*4px\s*6px\s*rgba\(0,\s*0,\s*0,\s*0\.07\);/s;

if (cssRegex.test(content)) {
    content = content.replace(cssRegex, '$1border: 3px solid #9ca3af;$2box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);');
    console.log('✓ Updated form-container CSS');
} else {
    console.log('✗ Could not find form-container CSS block');
    // Fallback: try to find just the border line if the block match fails
    if (content.includes('border: 2px solid #e5e7eb;')) {
        content = content.replace('border: 2px solid #e5e7eb;', 'border: 3px solid #9ca3af;');
        console.log('✓ Updated form-container border (fallback)');
    }
}

// 2. Update compensation placeholder
const placeholderOld = 'placeholder="e.g., 20,000 - 25,000"';
const placeholderNew = 'placeholder="e.g 15,000 - 30,000"';

if (content.includes(placeholderOld)) {
    content = content.replace(placeholderOld, placeholderNew);
    console.log('✓ Updated compensation placeholder');
} else {
    console.log('✗ Could not find compensation placeholder');
}

// Write the modified content back
fs.writeFileSync('careers.html', content, 'utf-8');
