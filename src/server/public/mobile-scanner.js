/* Photo retries stay on the phone; images are never uploaded to the POS. */
(function (root) {
  'use strict';

  async function loadPhoto(file) {
    const url = URL.createObjectURL(file);
    try {
      const image = new Image();
      await new Promise((resolve, reject) => {
        image.onload = resolve;
        image.onerror = () => reject(new Error('Fotoğraf açılamadı. JPG veya PNG biçiminde yeniden çekin.'));
        image.src = url;
      });
      return image;
    } finally { URL.revokeObjectURL(url); }
  }

  function makeCanvas(image, crop, rotation, contrast) {
    const sourceWidth = image.naturalWidth * crop.width;
    const sourceHeight = image.naturalHeight * crop.height;
    const scale = Math.min(1, 2200 / Math.max(sourceWidth, sourceHeight));
    const width = Math.max(1, Math.round(sourceWidth * scale));
    const height = Math.max(1, Math.round(sourceHeight * scale));
    const canvas = document.createElement('canvas');
    canvas.width = rotation ? height : width;
    canvas.height = rotation ? width : height;
    const context = canvas.getContext('2d', { willReadFrequently: contrast });
    if (!context) throw new Error('Bu tarayıcı fotoğraf işlemeyi desteklemiyor.');
    context.fillStyle = '#fff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    if (rotation) { context.translate(height, 0); context.rotate(Math.PI / 2); }
    context.drawImage(image, image.naturalWidth * crop.x, image.naturalHeight * crop.y,
      sourceWidth, sourceHeight, 0, 0, width, height);
    if (contrast) {
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
      for (let i = 0; i < pixels.data.length; i += 4) {
        const gray = 0.299 * pixels.data[i] + 0.587 * pixels.data[i + 1] + 0.114 * pixels.data[i + 2];
        const value = Math.max(0, Math.min(255, (gray - 128) * 1.5 + 128));
        pixels.data[i] = pixels.data[i + 1] = pixels.data[i + 2] = value;
      }
      context.putImageData(pixels, 0, 0);
    }
    return canvas;
  }

  async function decodePhoto(file, options) {
    const image = await loadPhoto(file);
    const full = { x: 0, y: 0, width: 1, height: 1 };
    const center = { x: 0.15, y: 0.15, width: 0.7, height: 0.7 };
    const strip = { x: 0, y: 0.3, width: 1, height: 0.4 };
    const attempts = [
      [full, false, false], [full, true, false],
      [center, false, false], [center, true, false],
      [strip, false, false], [strip, true, false],
      [full, false, true], [full, true, true],
    ];
    for (let i = 0; i < attempts.length; i++) {
      options.onProgress?.(i + 1, attempts.length);
      // Yield to paint the progress indicator before CPU-intensive decoding.
      await new Promise(resolve => setTimeout(resolve, 0));
      const canvas = makeCanvas(image, ...attempts[i]);
      try {
        if (options.detect) {
          try {
            const found = await options.detect(canvas);
            if (found) return found;
          } catch (_) { /* Native API can reject individual image formats. */ }
        }
        const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
        if (!blob) continue;
        try {
          const found = await options.scanFile(new File([blob], 'barcode.png', { type: 'image/png' }));
          if (found) return found;
        } catch (_) { /* Try the next orientation or crop. */ }
      } finally { canvas.width = canvas.height = 1; }
    }
    return null;
  }

  root.MobileBarcodeScanner = { decodePhoto };
})(window);
