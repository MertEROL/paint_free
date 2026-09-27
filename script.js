const canvas = document.getElementById('paint-canvas');
const ctx = canvas.getContext('2d');
const container = document.getElementById('canvas-container');

// State
let images = ['1.png', '2.png', '3.png', '4.png']; // Örnek resimler, images klasöründe olmalı
let currentImageIndex = 0;
let currentColor = '#FF0000';
let brushSize = 20;

let isDrawing = false;
let lastX = 0;
let lastY = 0;
let currentPath = []; // Mevcut fırça darbesinin noktaları

// Layers (Offscreen Canvases)
const baseOutlineCanvas = document.createElement('canvas');
const baseOutlineCtx = baseOutlineCanvas.getContext('2d', { willReadFrequently: true });

const coloredLayerCanvas = document.createElement('canvas');
const coloredLayerCtx = coloredLayerCanvas.getContext('2d');

const activeStrokeCanvas = document.createElement('canvas');
const activeStrokeCtx = activeStrokeCanvas.getContext('2d');

const maskCanvas = document.createElement('canvas');
const maskCtx = maskCanvas.getContext('2d');

let originalImageData = null;
let imgObj = new Image();

// Initialization
function init() {
    setupUI();
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    loadImage(images[currentImageIndex]);
}

function setupUI() {
    // Colors
    document.querySelectorAll('.color-swatch').forEach(swatch => {
        swatch.addEventListener('click', (e) => {
            document.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('selected'));
            e.target.classList.add('selected');
            currentColor = e.target.dataset.color;
        });
    });
    document.querySelector('.color-swatch').classList.add('selected'); // First selected

    // Brush
    const brushInput = document.getElementById('brush-size');
    brushInput.addEventListener('input', (e) => {
        brushSize = e.target.value;
    });
    brushSize = brushInput.value;

    // Navigation
    document.getElementById('prev-btn').addEventListener('click', () => {
        currentImageIndex = (currentImageIndex - 1 + images.length) % images.length;
        loadImage(images[currentImageIndex]);
    });
    document.getElementById('next-btn').addEventListener('click', () => {
        currentImageIndex = (currentImageIndex + 1) % images.length;
        loadImage(images[currentImageIndex]);
    });
    document.getElementById('clear-btn').addEventListener('click', () => {
        coloredLayerCtx.clearRect(0, 0, coloredLayerCanvas.width, coloredLayerCanvas.height);
        render();
    });

    // Touch and Mouse events
    canvas.addEventListener('mousedown', startDrawing);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', stopDrawing);
    canvas.addEventListener('mouseout', stopDrawing);

    canvas.addEventListener('touchstart', (e) => {
        e.preventDefault();
        const touch = e.touches[0];
        const mouseEvent = new MouseEvent('mousedown', {
            clientX: touch.clientX,
            clientY: touch.clientY
        });
        canvas.dispatchEvent(mouseEvent);
    }, {passive: false});

    canvas.addEventListener('touchmove', (e) => {
        e.preventDefault();
        const touch = e.touches[0];
        const mouseEvent = new MouseEvent('mousemove', {
            clientX: touch.clientX,
            clientY: touch.clientY
        });
        canvas.dispatchEvent(mouseEvent);
    }, {passive: false});

    canvas.addEventListener('touchend', (e) => {
        e.preventDefault();
        const mouseEvent = new MouseEvent('mouseup', {});
        canvas.dispatchEvent(mouseEvent);
    }, {passive: false});
}

function resizeCanvas() {
    const rect = container.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;

    // We will set internal canvas size when image loads to match image aspect ratio
}

function setCanvasesSize(w, h) {
    canvas.width = w;
    canvas.height = h;
    baseOutlineCanvas.width = w;
    baseOutlineCanvas.height = h;
    coloredLayerCanvas.width = w;
    coloredLayerCanvas.height = h;
    activeStrokeCanvas.width = w;
    activeStrokeCanvas.height = h;
    maskCanvas.width = w;
    maskCanvas.height = h;
}

function loadImage(filename) {
    imgObj = new Image();
    imgObj.crossOrigin = "Anonymous";
    imgObj.onload = () => {
        // Fit to container
        const rect = container.getBoundingClientRect();
        const containerRatio = rect.width / rect.height;
        const imgRatio = imgObj.width / imgObj.height;

        let drawW, drawH;
        if (containerRatio > imgRatio) {
            drawH = rect.height;
            drawW = drawH * imgRatio;
        } else {
            drawW = rect.width;
            drawH = drawW / imgRatio;
        }

        setCanvasesSize(drawW, drawH);

        // Draw outline
        baseOutlineCtx.clearRect(0, 0, drawW, drawH);
        baseOutlineCtx.drawImage(imgObj, 0, 0, drawW, drawH);
        originalImageData = baseOutlineCtx.getImageData(0, 0, drawW, drawH);

        // Clear colors
        coloredLayerCtx.clearRect(0, 0, drawW, drawH);
        
        render();
    };
    imgObj.onerror = () => {
        // Hata durumunda boş bir tuval oluştur (örneğin resimler yoksa)
        setCanvasesSize(container.clientWidth, container.clientHeight);
        baseOutlineCtx.fillStyle = 'white';
        baseOutlineCtx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Rastgele bir şekil çizelim (test için)
        baseOutlineCtx.strokeStyle = 'black';
        baseOutlineCtx.lineWidth = 5;
        baseOutlineCtx.beginPath();
        baseOutlineCtx.arc(canvas.width/2, canvas.height/2, 100, 0, Math.PI*2);
        baseOutlineCtx.stroke();
        
        originalImageData = baseOutlineCtx.getImageData(0, 0, canvas.width, canvas.height);
        coloredLayerCtx.clearRect(0, 0, canvas.width, canvas.height);
        render();
    }
    imgObj.src = 'images/' + filename;
}

function getEventPos(e) {
    const rect = canvas.getBoundingClientRect();
    return {
        x: (e.clientX - rect.left) * (canvas.width / rect.width),
        y: (e.clientY - rect.top) * (canvas.height / rect.height)
    };
}

function startDrawing(e) {
    const pos = getEventPos(e);
    lastX = pos.x;
    lastY = pos.y;
    isDrawing = true;
    currentPath = [{x: lastX, y: lastY}];

    // Maske oluştur (Flood fill)
    if (document.getElementById('mask-toggle').checked) {
        generateMask(Math.floor(lastX), Math.floor(lastY));
    }
    
    // Aktif çizimi temizle
    activeStrokeCtx.clearRect(0, 0, canvas.width, canvas.height);
}

function draw(e) {
    if (!isDrawing) return;
    const pos = getEventPos(e);
    currentPath.push({x: pos.x, y: pos.y});
    lastX = pos.x;
    lastY = pos.y;

    // Aktif katmana çiz
    activeStrokeCtx.clearRect(0, 0, canvas.width, canvas.height);
    
    activeStrokeCtx.lineCap = 'round';
    activeStrokeCtx.lineJoin = 'round';
    activeStrokeCtx.lineWidth = brushSize;
    activeStrokeCtx.strokeStyle = currentColor;
    
    activeStrokeCtx.beginPath();
    activeStrokeCtx.moveTo(currentPath[0].x, currentPath[0].y);
    for (let i = 1; i < currentPath.length; i++) {
        activeStrokeCtx.lineTo(currentPath[i].x, currentPath[i].y);
    }
    activeStrokeCtx.stroke();

    // Maskeyi uygula (sadece maske olan yerler kalsın)
    if (document.getElementById('mask-toggle').checked) {
        activeStrokeCtx.globalCompositeOperation = 'destination-in';
        activeStrokeCtx.drawImage(maskCanvas, 0, 0);
        activeStrokeCtx.globalCompositeOperation = 'source-over';
    }

    render();
}

function stopDrawing() {
    if (!isDrawing) return;
    isDrawing = false;
    
    // Aktif çizimi kalıcı katmana aktar
    coloredLayerCtx.drawImage(activeStrokeCanvas, 0, 0);
    activeStrokeCtx.clearRect(0, 0, canvas.width, canvas.height);
    
    render();
}

function render() {
    // 1. Ana tuvali temizle
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // 2. Beyaz arkaplan (isteğe bağlı)
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 3. Boyalı katmanı çiz
    ctx.drawImage(coloredLayerCanvas, 0, 0);
    
    // 4. Aktif çizimi çiz
    ctx.drawImage(activeStrokeCanvas, 0, 0);
    
    // 5. En üste siyah çizgileri çiz (Multiply kullanarak veya transparan resimse direkt)
    // Eğer orijinal resim beyaz arkaplanlıysa, multiply işe yarar
    ctx.globalCompositeOperation = 'multiply';
    ctx.drawImage(baseOutlineCanvas, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
}

function generateMask(startX, startY) {
    maskCtx.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
    
    const w = canvas.width;
    const h = canvas.height;
    
    if (startX < 0 || startX >= w || startY < 0 || startY >= h) return;
    
    const imgData = originalImageData.data; // rgba
    const maskData = maskCtx.createImageData(w, h);
    
    const pixelPos = (startY * w + startX) * 4;
    const startR = imgData[pixelPos];
    const startG = imgData[pixelPos + 1];
    const startB = imgData[pixelPos + 2];
    
    // Siyah çizgiye tıklandıysa veya gri tonlara, toleransla kontrol et
    // Eğer outline ise maskeyi tam ekran yap (veya maskeyi boş bırak)
    if (startR < 100 && startG < 100 && startB < 100) {
        // Siyah çizgi, maske boş kalır, çizim yapamaz
        maskCtx.putImageData(maskData, 0, 0);
        return;
    }

    // Stack tabanlı flood fill
    const stack = [[startX, startY]];
    const visited = new Uint8Array(w * h);
    
    while (stack.length > 0) {
        const [x, y] = stack.pop();
        const idx = y * w + x;
        
        if (visited[idx]) continue;
        visited[idx] = 1;
        
        const p = idx * 4;
        
        // Siyah mı (outline mı)? (Tolerans < 100 siyahımsı kabul edelim)
        const isBlack = imgData[p] < 120 && imgData[p+1] < 120 && imgData[p+2] < 120;
        
        if (isBlack) {
            // Sınır, dur.
            continue;
        }
        
        // Maskeye beyaz (opak) yaz
        maskData.data[p] = 255;
        maskData.data[p+1] = 255;
        maskData.data[p+2] = 255;
        maskData.data[p+3] = 255;
        
        if (x > 0) stack.push([x - 1, y]);
        if (x < w - 1) stack.push([x + 1, y]);
        if (y > 0) stack.push([x, y - 1]);
        if (y < h - 1) stack.push([x, y + 1]);
    }
    
    maskCtx.putImageData(maskData, 0, 0);
}

// Başlat
window.onload = () => {
    init();
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('sw.js');
    }
};
