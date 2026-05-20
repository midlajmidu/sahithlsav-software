// js/image-optimizer.js — Production Image Processor (WebP + Compression)

const MAX_WIDTH = 1600;
const QUALITY = 0.8; // Target 200KB-300KB range

/**
 * Main optimization function
 * @param {File} file 
 * @returns {Promise<{blob: Blob, stats: object}>}
 */
async function optimizeImage(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;

                // Handle Max Width
                if (width > MAX_WIDTH) {
                    height = (MAX_WIDTH / width) * height;
                    width = MAX_WIDTH;
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                // Convert to WebP
                canvas.toBlob((blob) => {
                    if (!blob) return reject(new Error('Canvas toBlob failed'));
                    
                    const originalSize = file.size;
                    const compressedSize = blob.size;
                    const reduction = ((originalSize - compressedSize) / originalSize * 100).toFixed(1);

                    resolve({
                        blob,
                        fileName: file.name.replace(/\.[^/.]+$/, "") + ".webp",
                        stats: {
                            original: (originalSize / 1024).toFixed(1) + ' KB',
                            compressed: (compressedSize / 1024).toFixed(1) + ' KB',
                            reduction: reduction + '%'
                        }
                    });
                }, 'image/webp', QUALITY);
            };
            img.onerror = reject;
        };
        reader.onerror = reject;
    });
}

/**
 * Preview Helper
 */
function displayStats(statsEl, stats) {
    if (!statsEl) return;
    statsEl.innerHTML = `
        <div class="stats-box" style="font-size:0.8rem; background:rgba(0,0,0,0.05); padding:10px; border-radius:8px; margin-top:10px;">
            <p>Original: <strong>${stats.original}</strong></p>
            <p>Optimized (WebP): <strong>${stats.compressed}</strong></p>
            <p>Reduction: <strong style="color:var(--success);">${stats.reduction}</strong></p>
        </div>
    `;
}

window.ImageProcessor = { optimizeImage, displayStats };
