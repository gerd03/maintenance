const fs = require('fs');

// Read careers.html
let content = fs.readFileSync('careers.html', 'utf-8');

// Add the showModal helper function right after the map initialization script starts
const helperFunction = `
        // Helper function to show custom modal
        function showModal(message, title = 'Notification') {
            const modal = document.getElementById('customModal');
            const modalTitle = document.getElementById('modalTitle');
            const modalMessage = document.getElementById('modalMessage');
            const modalClose = document.getElementById('modalClose');
            const modalButton = document.getElementById('modalButton');

            modalTitle.textContent = title;
            modalMessage.textContent = message;
            modal.style.display = 'flex';

            const closeModal = () => {
                modal.style.display = 'none';
            };

            modalClose.onclick = closeModal;
            modalButton.onclick = closeModal;
            modal.querySelector('.modal-overlay').onclick = closeModal;
        }
`;

// Find the location right after the <script> tag that contains the map code
const mapScriptStart = content.indexOf('// AOAS Office location');
if (mapScriptStart !== -1) {
    content = content.substring(0, mapScriptStart) + helperFunction + '\n        ' + content.substring(mapScriptStart);
}

// Replace all alert() calls with showModal()
const replacements = [
    {
        old: "alert('Please enable location access in your browser settings.');",
        new: "showModal('Please enable location access in your browser settings.', 'Location Access Required');"
    },
    {
        old: "alert('Geolocation is not supported by your browser.');",
        new: "showModal('Geolocation is not supported by your browser.', 'Feature Not Supported');"
    },
    {
        old: "alert('Please enter valid latitude and longitude values.');",
        new: "showModal('Please enter valid latitude and longitude values.', 'Invalid Input');"
    },
    {
        old: "alert('Latitude must be between -90 and 90, Longitude must be between -180 and 180.');",
        new: "showModal('Latitude must be between -90 and 90, Longitude must be between -180 and 180.', 'Invalid Coordinates');"
    }
];

replacements.forEach(r => {
    content = content.replace(r.old, r.new);
});

console.log('✓ Replaced all alert() calls in careers.html with showModal()');
fs.writeFileSync('careers.html', content, 'utf-8');
