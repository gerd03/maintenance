const fs = require('fs');

// Read the HTML file
let content = fs.readFileSync('careers.html', 'utf-8');

console.log("Before replacement:");
const checkText = content.substring(content.indexOf('</form>'), content.indexOf('</form>') + 100);
console.log(checkText.substring(0, 100));

// First replacement: close form-container after form
content = content.replace(
    '            </form>\r\n\r\n            <!-- Map Section -->',
    '            </form>\r\n        </div>\r\n\r\n        <!-- Map Section -->'
);

// Second replacement: wrap map section in new form-container
content = content.replace(
    '        </div>\r\n\r\n        <!-- Map Section -->\r\n            <div class="map-section">',
    '        </div>\r\n\r\n        <!-- Map Section -->\r\n        <div class="form-container" style="margin-top: 32px;">\r\n            <div class="map-section">'
);

console.log("\nAfter replacement:");
const checkText2 = content.substring(content.indexOf('</form>'), content.indexOf('</form>') + 200);
console.log(checkText2.substring(0, 200));

// Write the modified content back
fs.writeFileSync('careers.html', content, 'utf-8');

console.log('\n✓ Successfully separated the form and map containers!');
