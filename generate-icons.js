const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// Create PNG buffer with RGBA pixels
function createPng(width, height, pixelFn) {
    // Each row has 1 filter byte (0) followed by 4 * width bytes (RGBA)
    const rowBytes = 1 + width * 4;
    const rawData = Buffer.alloc(rowBytes * height);

    for (let y = 0; y < height; y++) {
        const rowOffset = y * rowBytes;
        rawData[rowOffset] = 0; // Filter type 0 (None)

        for (let x = 0; x < width; x++) {
            const pixelOffset = rowOffset + 1 + x * 4;
            const [r, g, b, a] = pixelFn(x, y, width, height);
            rawData[pixelOffset] = r;
            rawData[pixelOffset + 1] = g;
            rawData[pixelOffset + 2] = b;
            rawData[pixelOffset + 3] = a;
        }
    }

    const compressed = zlib.deflateSync(rawData);

    // Helper to calculate CRC32
    function crc32(buf) {
        let crc = 0xffffffff;
        for (let i = 0; i < buf.length; i++) {
            crc ^= buf[i];
            for (let j = 0; j < 8; j++) {
                crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
            }
        }
        return (crc ^ 0xffffffff) >>> 0;
    }

    function makeChunk(type, data) {
        const len = Buffer.alloc(4);
        len.writeUInt32BE(data.length, 0);

        const typeBuf = Buffer.from(type, 'ascii');
        const chunkData = Buffer.concat([typeBuf, data]);

        const crc = Buffer.alloc(4);
        crc.writeUInt32BE(crc32(chunkData), 0);

        return Buffer.concat([len, chunkData, crc]);
    }

    // 1. Signature
    const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

    // 2. IHDR
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(width, 0);
    ihdr.writeUInt32BE(height, 4);
    ihdr[8] = 8; // Bit depth: 8
    ihdr[9] = 6; // Color type: RGBA (6)
    ihdr[10] = 0; // Compression: 0
    ihdr[11] = 0; // Filter: 0
    ihdr[12] = 0; // Interlace: 0
    const ihdrChunk = makeChunk('IHDR', ihdr);

    // 3. IDAT
    const idatChunk = makeChunk('IDAT', compressed);

    // 4. IEND
    const iendChunk = makeChunk('IEND', Buffer.alloc(0));

    return Buffer.concat([sig, ihdrChunk, idatChunk, iendChunk]);
}

// Pixel generator for AuraChat logo (Indigo/Purple/Pink Gradient rounded bubble)
function logoPixel(x, y, w, h) {
    const cx = w / 2;
    const cy = h / 2;
    const dx = x - cx;
    const dy = y - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const radius = w * 0.44;

    // Background outside round rect or circle
    if (dist > radius + 1) {
        return [0, 0, 0, 0];
    }

    // Antialiasing on the outer edge
    let alpha = 255;
    if (dist > radius - 1) {
        alpha = Math.max(0, Math.min(255, Math.round((radius + 1 - dist) * 127.5)));
    }

    // Diagonal gradient: #6366f1 (Indigo) -> #8b5cf6 (Purple) -> #d946ef (Magenta/Pink)
    const t = (x + y) / (w + h);
    let r, g, b;
    if (t < 0.5) {
        const factor = t * 2;
        r = Math.round(99 + factor * (139 - 99));
        g = Math.round(102 + factor * (92 - 102));
        b = Math.round(241 + factor * (246 - 241));
    } else {
        const factor = (t - 0.5) * 2;
        r = Math.round(139 + factor * (217 - 139));
        g = Math.round(92 + factor * (70 - 92));
        b = Math.round(246 + factor * (239 - 246));
    }

    // Inner chat bubble symbol in white/glow
    // Speech bubble center is (cx, cy - h*0.02)
    const bx = cx;
    const by = cy - h * 0.02;
    const bubbleW = w * 0.48;
    const bubbleH = h * 0.38;
    const bubbleCorner = w * 0.12;

    // Check if inside rounded rectangle for chat bubble
    const bdx = Math.abs(x - bx);
    const bdy = Math.abs(y - by);
    const inCornerX = bdx - (bubbleW / 2 - bubbleCorner);
    const inCornerY = bdy - (bubbleH / 2 - bubbleCorner);

    let insideBubble = false;
    if (inCornerX <= 0 && bdy <= bubbleH / 2) insideBubble = true;
    else if (inCornerY <= 0 && bdx <= bubbleW / 2) insideBubble = true;
    else if (inCornerX > 0 && inCornerY > 0) {
        if (inCornerX * inCornerX + inCornerY * inCornerY <= bubbleCorner * bubbleCorner) {
            insideBubble = true;
        }
    }

    // Chat bubble tail (bottom left corner of bubble)
    const tailX = bx - bubbleW * 0.22;
    const tailY = by + bubbleH / 2;
    if (x >= tailX - w * 0.1 && x <= tailX + w * 0.05 && y >= tailY - 2 && y <= tailY + h * 0.12) {
        const tailSlope = (y - tailY) / (h * 0.12);
        if (x <= tailX - w * 0.08 * tailSlope) {
            insideBubble = true;
        }
    }

    // Inner 3 dots in the bubble
    if (insideBubble) {
        const dotRadius = w * 0.038;
        const dotY = by;
        const dotSpacing = w * 0.11;
        const isDot1 = Math.sqrt((x - (bx - dotSpacing)) ** 2 + (y - dotY) ** 2) <= dotRadius;
        const isDot2 = Math.sqrt((x - bx) ** 2 + (y - dotY) ** 2) <= dotRadius;
        const isDot3 = Math.sqrt((x - (bx + dotSpacing)) ** 2 + (y - dotY) ** 2) <= dotRadius;

        if (isDot1 || isDot2 || isDot3) {
            // Gradient dots
            return [99, 102, 241, alpha];
        }
        // White bubble interior
        return [255, 255, 255, alpha];
    }

    return [r, g, b, alpha];
}

const iconsDir = path.join(__dirname, 'public', 'icons');
if (!fs.existsSync(iconsDir)) {
    fs.mkdirSync(iconsDir, { recursive: true });
}

const sizes = [72, 96, 128, 144, 152, 192, 384, 512];
for (const size of sizes) {
    const pngBuf = createPng(size, size, logoPixel);
    const dest = path.join(iconsDir, `icon-${size}.png`);
    fs.writeFileSync(dest, pngBuf);
    console.log(`Created: ${dest} (${size}x${size})`);
}

// Badge 72 icon for monochrome notification
const badgeBuf = createPng(72, 72, (x, y, w, h) => {
    const cx = w / 2;
    const cy = h / 2;
    const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
    if (dist <= w * 0.45) {
        return [255, 255, 255, 255];
    }
    return [0, 0, 0, 0];
});
fs.writeFileSync(path.join(iconsDir, 'badge-72.png'), badgeBuf);
console.log('Created badge-72.png');
