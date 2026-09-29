// Renders build/icon.svg and build/tray.svg to the PNGs the app ships with.
// Run with: npx electron scripts/render-icons.cjs
const { app, BrowserWindow } = require('electron');
const { readFileSync, writeFileSync } = require('node:fs');
const { join } = require('node:path');

const root = join(__dirname, '..');
const targets = [
  { svg: 'build/icon.svg', out: 'build/icon.png', size: 1024 },
  { svg: 'build/tray.svg', out: 'assets/trayTemplate.png', size: 16 },
  { svg: 'build/tray.svg', out: 'assets/trayTemplate@2x.png', size: 32 },
];

async function render(window, { svg, out, size }) {
  const markup = readFileSync(join(root, svg), 'utf8');
  const html = `<html><body style="margin:0;background:transparent"><img width="${size}" height="${size}" src="data:image/svg+xml;base64,${Buffer.from(markup).toString('base64')}"></body></html>`;
  await window.loadURL(`data:text/html;base64,${Buffer.from(html).toString('base64')}`);
  const image = await window.webContents.capturePage({ x: 0, y: 0, width: size, height: size });
  writeFileSync(join(root, out), image.resize({ width: size, height: size }).toPNG());
  console.log(`wrote ${out}`);
}

app
  .whenReady()
  .then(async () => {
    const window = new BrowserWindow({
      width: 1024,
      height: 1024,
      show: false,
      transparent: true,
      frame: false,
      useContentSize: true,
      webPreferences: { offscreen: true },
    });
    for (const target of targets) await render(window, target);
    window.destroy();
    app.quit();
  })
  .catch((error) => {
    console.error(error);
    app.exit(1);
  });
