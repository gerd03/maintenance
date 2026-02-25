const fs = require('fs');

// Read the HTML file
let content = fs.readFileSync('careers.html', 'utf-8');

// 1. Update form-container border and shadow
// Using a more robust replacement that targets the specific block we modified earlier or the original one
const formContainerRegex = /\.form-container\s*\{[^}]*border:\s*[^;]+;[^}]*\}/s;
const newFormContainerCss = `.form-container {
            max-width: 600px;
            margin: 0 auto;
            padding: 32px 24px;
            background: white;
            border: 4px solid #9ca3af; /* Thicker, visible border */
            border-radius: 16px;
            box-shadow: 0 10px 25px rgba(0, 0, 0, 0.05);
        }`;

if (formContainerRegex.test(content)) {
    content = content.replace(formContainerRegex, newFormContainerCss);
    console.log('✓ Updated form-container styles');
} else {
    console.log('✗ Could not find form-container CSS block to update');
}

// 2. Update Input Fields & Textareas
const inputCssRegex = /\.form-group\s+input,\s*\.form-group\s+textarea\s*\{[^}]*\}/s;
const newInputCss = `.form-group input,
        .form-group textarea {
            width: 100%;
            font-size: 0.9375rem;
            padding: 14px 16px; /* More padding */
            border: 1px solid #d1d5db;
            border-radius: 8px; /* Rounded corners */
            font-family: inherit;
            transition: all 0.2s ease;
            background-color: #f9fafb; /* Slight background */
        }

        .form-group input:focus,
        .form-group textarea:focus {
            outline: none;
            border-color: #FF6D1F;
            background-color: white;
            box-shadow: 0 0 0 4px rgba(255, 109, 31, 0.1);
        }`;

if (inputCssRegex.test(content)) {
    content = content.replace(inputCssRegex, newInputCss);
    console.log('✓ Updated input/textarea styles');
} else {
    console.log('✗ Could not find input/textarea CSS block');
}

// 3. Update Radio Options (Card Style)
const radioOptionRegex = /\.radio-option\s*\{[^}]*\}/s;
const newRadioOptionCss = `.radio-option {
            display: flex;
            align-items: center;
            padding: 16px 20px;
            border: 1px solid #e5e7eb;
            border-radius: 8px;
            cursor: pointer;
            transition: all 0.2s ease;
            font-size: 0.9375rem;
            background-color: #f9fafb;
            margin-bottom: 0; /* Reset */
        }

        .radio-option:hover {
            border-color: #FF6D1F;
            background-color: #fff7ed;
            transform: translateY(-1px);
        }

        /* Active state styling using :has if supported, or just rely on hover/focus for now */
        .radio-option:has(input:checked) {
            border-color: #FF6D1F;
            background-color: #fff7ed;
            box-shadow: 0 2px 5px rgba(255, 109, 31, 0.1);
        }`;

if (radioOptionRegex.test(content)) {
    content = content.replace(radioOptionRegex, newRadioOptionCss);
    console.log('✓ Updated radio-option styles');
} else {
    console.log('✗ Could not find radio-option CSS block');
}

// 4. Update radio input styling (make it bigger)
const radioInputRegex = /\.radio-option\s+input\[type="radio"\]\s*\{[^}]*\}/s;
const newRadioInputCss = `.radio-option input[type="radio"] {
            margin-right: 12px;
            width: 18px;
            height: 18px;
            accent-color: #FF6D1F;
        }`;

if (radioInputRegex.test(content)) {
    content = content.replace(radioInputRegex, newRadioInputCss);
    console.log('✓ Updated radio input styles');
} else {
    // If it doesn't exist, we append it after the radio-option block
    // But for now let's just log it. The original file had it.
    if (content.includes('.radio-option input[type="radio"]')) {
        content = content.replace(radioInputRegex, newRadioInputCss);
        console.log('✓ Updated radio input styles (found existing)');
    } else {
        console.log('✗ Could not find radio input CSS block');
    }
}

// Write the modified content back
fs.writeFileSync('careers.html', content, 'utf-8');
