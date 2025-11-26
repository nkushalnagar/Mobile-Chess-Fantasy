// Simple script to create placeholder assets for development
// Run with: node create-assets.js

const fs = require('fs');
const path = require('path');

const assetsDir = path.join(__dirname, 'assets');

// Create assets directory if it doesn't exist
if (!fs.existsSync(assetsDir)) {
  fs.mkdirSync(assetsDir, { recursive: true });
}

// Create a simple SVG that can be used as placeholder
const createSVG = (width, height, text, bgColor = '#2563eb') => {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${width}" height="${height}" fill="${bgColor}"/>
  <text x="50%" y="50%" font-family="Arial, sans-serif" font-size="200" fill="white" text-anchor="middle" dominant-baseline="middle">${text}</text>
</svg>`;
};

// For now, create SVG files (you'll need to convert to PNG manually or use a tool)
const assets = [
  { name: 'icon.svg', width: 1024, height: 1024, text: '♟️' },
  { name: 'splash.svg', width: 1242, height: 2436, text: '♟️' },
  { name: 'adaptive-icon.svg', width: 1024, height: 1024, text: '♟️' },
  { name: 'favicon.svg', width: 48, height: 48, text: '♟️' },
];

assets.forEach(asset => {
  const svg = createSVG(asset.width, asset.height, asset.text);
  fs.writeFileSync(path.join(assetsDir, asset.name), svg);
  console.log(`✓ Created ${asset.name}`);
});

console.log('\n⚠️  Note: SVG files created. For production, convert these to PNG files.');
console.log('You can use online tools like https://cloudconvert.com/svg-to-png');
console.log('Or install sharp: npm install sharp && convert with a script\n');
