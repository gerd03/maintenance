const fs = require('fs');

// Read the file
const content = fs.readFileSync('careers.html', 'utf8');
const lines = content.split('\r\n');

// Remove lines 546-579 (0-indexed: 545-578 inclusive)
// This is the first map section at the top
const newLines = [...lines.slice(0, 545), ...lines.slice(579)];

// Write back
fs.writeFileSync('careers.html', newLines.join('\r\n'), 'utf8');

console.log('Successfully removed duplicate map section from top of page');
