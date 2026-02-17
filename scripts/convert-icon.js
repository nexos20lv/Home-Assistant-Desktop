const sharp = require('sharp');
const toIco = require('to-ico');
const fs = require('fs');
const path = require('path');

const svgPath = path.join(__dirname, '../src/assets/logo.svg');
const pngPath = path.join(__dirname, '../src/assets/logo.png');
const icoPath = path.join(__dirname, '../src/assets/logo.ico');

async function convert() {
    try {
        console.log('Converting SVG to PNG Buffer...');
        const pngBuf = await sharp(svgPath)
            .resize(256, 256)
            .png()
            .toBuffer();

        // Also save PNG for tray
        fs.writeFileSync(pngPath, pngBuf);
        console.log('Logo converted to PNG successfully at:', pngPath);

        console.log('Converting to ICO...');
        // PNG -> ICO
        // to-ico expects an array of buffers
        const icoBuf = await toIco([pngBuf], {
            resize: true,
            sizes: [16, 24, 32, 48, 64, 128, 256]
        });

        fs.writeFileSync(icoPath, icoBuf);
        console.log('Logo converted to ICO successfully at:', icoPath);
    } catch (err) {
        console.error('Error converting logo:', err);
        process.exit(1);
    }
}

convert();
