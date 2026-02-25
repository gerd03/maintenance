const sharp = require('sharp');
const fs = require('fs');
const path = require('path');
const repoRoot = path.resolve(__dirname, '..', '..');

// Images to optimize
const imagesToOptimize = [
    { input: 'assets/images/home/hero/slideshow-carousel-1.png', output: 'assets/images/home/hero/slideshow-carousel-1.webp', width: 1920 },
    { input: 'assets/images/home/hero/slideshow-carousel-2.png', output: 'assets/images/home/hero/slideshow-carousel-2.webp', width: 1920 },
    { input: 'assets/images/home/hero/slideshow-carousel-3.png', output: 'assets/images/home/hero/slideshow-carousel-3.webp', width: 1920 },
    { input: 'assets/images/home/professional-excellence/professional-excellence-1.png', output: 'assets/images/home/professional-excellence/professional-excellence-1.webp', width: 800 },
    { input: 'assets/images/home/professional-excellence/professional-excellence-2.png', output: 'assets/images/home/professional-excellence/professional-excellence-2.webp', width: 800 },
];

// Also create mobile versions (smaller)
const mobileVersions = [
    { input: 'assets/images/home/hero/slideshow-carousel-1.png', output: 'assets/images/home/hero/slideshow-carousel-1-mobile.webp', width: 768 },
    { input: 'assets/images/home/hero/slideshow-carousel-2.png', output: 'assets/images/home/hero/slideshow-carousel-2-mobile.webp', width: 768 },
    { input: 'assets/images/home/hero/slideshow-carousel-3.png', output: 'assets/images/home/hero/slideshow-carousel-3-mobile.webp', width: 768 },
];

async function optimizeImages() {
    console.log('Starting image optimization...\n');
    
    // Optimize main images
    for (const img of imagesToOptimize) {
        try {
            const resolvedInputPath = path.join(repoRoot, img.input);
            const outputPath = path.join(repoRoot, img.output);

            const inputStats = fs.statSync(resolvedInputPath);

            await sharp(resolvedInputPath)
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
            const resolvedInputPath = path.join(repoRoot, img.input);
            const outputPath = path.join(repoRoot, img.output);

            await sharp(resolvedInputPath)
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
