const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

// Images to optimize
const imagesToOptimize = [
    { input: 'HERO SECTION/slideshow carousel1.png', output: 'HERO SECTION/slideshow carousel1.webp', width: 1920 },
    { input: 'HERO SECTION/slideshow carousel2.png', output: 'HERO SECTION/slideshow carousel2.webp', width: 1920 },
    { input: 'HERO SECTION/slideshow carousel3.png', output: 'HERO SECTION/slideshow carousel3.webp', width: 1920 },
    { input: 'PROFESSIONAL EXCELLENCE/PROFESSIONALEXCELLENCE1.png', output: 'PROFESSIONAL EXCELLENCE/PROFESSIONALEXCELLENCE1.webp', width: 800 },
    { input: 'PROFESSIONAL EXCELLENCE/PROFESSIONALEXCELLENCE2.png', output: 'PROFESSIONAL EXCELLENCE/PROFESSIONALEXCELLENCE2.webp', width: 800 },
];

// Also create mobile versions (smaller)
const mobileVersions = [
    { input: 'HERO SECTION/slideshow carousel1.png', output: 'HERO SECTION/slideshow carousel1-mobile.webp', width: 768 },
    { input: 'HERO SECTION/slideshow carousel2.png', output: 'HERO SECTION/slideshow carousel2-mobile.webp', width: 768 },
    { input: 'HERO SECTION/slideshow carousel3.png', output: 'HERO SECTION/slideshow carousel3-mobile.webp', width: 768 },
];

async function optimizeImages() {
    console.log('Starting image optimization...\n');
    
    // Optimize main images
    for (const img of imagesToOptimize) {
        try {
            const inputPath = path.join(__dirname, img.input);
            const outputPath = path.join(__dirname, img.output);
            
            const inputStats = fs.statSync(inputPath);
            
            await sharp(inputPath)
                .resize(img.width, null, { withoutEnlargement: true })
                .webp({ quality: 85 })
                .toFile(outputPath);
            
            const outputStats = fs.statSync(outputPath);
            const savings = ((inputStats.size - outputStats.size) / inputStats.size * 100).toFixed(1);
            
            console.log(`✓ ${img.input}`);
            console.log(`  ${(inputStats.size / 1024 / 1024).toFixed(2)}MB → ${(outputStats.size / 1024).toFixed(0)}KB (${savings}% smaller)\n`);
        } catch (err) {
            console.error(`✗ Error processing ${img.input}:`, err.message);
        }
    }
    
    // Create mobile versions
    console.log('\nCreating mobile versions...\n');
    for (const img of mobileVersions) {
        try {
            const inputPath = path.join(__dirname, img.input);
            const outputPath = path.join(__dirname, img.output);
            
            await sharp(inputPath)
                .resize(img.width, null, { withoutEnlargement: true })
                .webp({ quality: 80 })
                .toFile(outputPath);
            
            const outputStats = fs.statSync(outputPath);
            console.log(`✓ Mobile: ${img.output} - ${(outputStats.size / 1024).toFixed(0)}KB`);
        } catch (err) {
            console.error(`✗ Error processing mobile ${img.input}:`, err.message);
        }
    }
    
    console.log('\n✅ Image optimization complete!');
}

optimizeImages();
