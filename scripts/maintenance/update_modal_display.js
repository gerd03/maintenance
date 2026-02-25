const fs = require('fs');

// Read index.html and careers.html to update display: flex instead of display: none
const files = ['index.html', 'careers.html'];

files.forEach(file => {
    let content = fs.readFileSync(file, 'utf-8');

    // Replace the modal display logic
    content = content.replace(
        /modal\.style\.display = 'flex';/g,
        "modal.style.display = 'flex'; modal.classList.add('active');"
    );

    content = content.replace(
        /modal\.style\.display = 'none';/g,
        "modal.style.display = 'none'; modal.classList.remove('active');"
    );

    fs.writeFileSync(file, content, 'utf-8');
    console.log(`✓ Updated modal display logic in ${file}`);
});
