// Run with Playwright page.evaluate() on the isolated mobile static fixture.
async () => {
  const expected = '5901234123457';
  const left = ['0001101','0011001','0010011','0111101','0100011','0110001','0101111','0111011','0110111','0001011'];
  const alternate = ['0100111','0110011','0011011','0100001','0011101','0111001','0000101','0010001','0001001','0010111'];
  const right = left.map(bits => bits.replace(/[01]/g, bit => bit === '0' ? '1' : '0'));
  const parity = 'LGGLLG'; // Leading digit 5.
  let bars = '101';
  for (let i = 1; i <= 6; i++) bars += (parity[i - 1] === 'L' ? left : alternate)[Number(expected[i])];
  bars += '01010';
  for (let i = 7; i <= 12; i++) bars += right[Number(expected[i])];
  bars += '101';

  const readerElement = document.createElement('div');
  readerElement.id = 'barcode-test-reader';
  readerElement.style.cssText = 'position:absolute;left:-10000px;width:1200px';
  document.body.appendChild(readerElement);
  const reader = new Html5Qrcode(readerElement.id, { verbose: false });
  const canvas = document.createElement('canvas');
  const results = [];
  async function photo(width, height, rotate = false, blank = false) {
    canvas.width = width; canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, width, height);
    if (!blank) {
      ctx.translate(width / 2, height / 2);
      if (rotate) ctx.rotate(Math.PI / 2);
      ctx.fillStyle = '#000';
      for (let i = 0; i < bars.length; i++) if (bars[i] === '1') ctx.fillRect(Math.round((i - bars.length / 2) * 4), -100, 4, 200);
    }
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    return new File([blob], 'fixture.png', { type: 'image/png' });
  }
  try {
    for (const [name, width, height, rotate] of [
      ['horizontal', 1800, 1200, false],
      ['vertical', 1200, 1800, true],
      ['large photo with small central barcode', 6000, 4000, false],
    ]) {
      let attempts = 0;
      const result = await MobileBarcodeScanner.decodePhoto(await photo(width, height, rotate), {
        // Model a phone with no usable native detector.
        detect: async () => { throw new Error('Native detector unsupported'); },
        scanFile: file => reader.scanFile(file, false),
        onProgress: () => attempts++,
      });
      if (result !== expected) throw new Error(name + ': expected ' + expected + ', got ' + result);
      results.push({ name, result, attempts });
    }
    let attempts = 0;
    const missing = await MobileBarcodeScanner.decodePhoto(await photo(640, 480, false, true), {
      scanFile: file => reader.scanFile(file, false), onProgress: () => attempts++,
    });
    if (missing !== null || attempts !== 8) throw new Error('Blank photo must stop after 8 bounded retries');
    results.push({ name: 'blank photo', result: missing, attempts });
    let rejected = false;
    try {
      await MobileBarcodeScanner.decodePhoto(new File(['invalid'], 'invalid.jpg', { type: 'image/jpeg' }), { scanFile: () => { throw Error('Should not decode invalid image'); } });
    } catch (error) { rejected = /Fotoğraf açılamadı/.test(error.message); }
    if (!rejected) throw Error('Invalid image must produce an actionable error');
    results.push({ name: 'invalid image', rejected });

    const transfer = new DataTransfer();
    transfer.items.add(await photo(1800, 1200));
    const input = document.getElementById('cameraFileInput');
    input.files = transfer.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));
    const deadline = Date.now() + 5000;
    while (document.getElementById('btnCamera').disabled && Date.now() < deadline) {
      await new Promise(resolve => setTimeout(resolve, 20));
    }
    if (document.getElementById('searchInput').value !== expected || document.getElementById('btnCamera').disabled) {
      throw Error('Photo input must populate the stock search and release the busy state');
    }
    results.push({ name: 'photo input to stock search', result: expected });

    // Simulate closing the modal while the browser permission prompt is pending.
    const previousReader = html5QrCode;
    let finishStart;
    let lateCallback;
    let stopped = 0;
    const fake = {
      isScanning: false,
      start: (_camera, _config, callback) => {
        lateCallback = callback;
        return new Promise(resolve => { finishStart = () => { fake.isScanning = true; resolve(); }; });
      },
      stop: async () => { stopped++; fake.isScanning = false; },
    };
    html5QrCode = fake;
    try {
      const starting = startLiveCamera();
      await new Promise(resolve => setTimeout(resolve, 0));
      const stopping = stopCamera();
      finishStart();
      await Promise.all([starting, stopping]);
      lateCallback('STALE-RESULT');
      if (stopped !== 1 || fake.isScanning || document.getElementById('searchInput').value !== expected) {
        throw Error('Closing during startup must release the camera and ignore stale detections');
      }
      results.push({ name: 'close during camera startup', stopped, staleResultIgnored: true });
    } finally { html5QrCode = previousReader; }
    return results;
  } finally {
    reader.clear(); readerElement.remove(); canvas.width = canvas.height = 1;
  }
}
