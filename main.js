const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');

const dbFile = () => path.join(app.getPath('userData'), 'apps.json');
const mediaDir = () => path.join(app.getPath('userData'), 'media');

function load() {
  try { return JSON.parse(fs.readFileSync(dbFile(), 'utf8')); } catch { return []; }
}
function save(list) {
  fs.mkdirSync(app.getPath('userData'), { recursive: true });
  fs.writeFileSync(dbFile(), JSON.stringify(list, null, 2));
}
function withUrls(list) {
  return list.map(a => ({
    ...a,
    mediaUrl: a.media ? pathToFileURL(path.join(mediaDir(), a.media)).href : null
  }));
}

let win;
function createWindow() {
  win = new BrowserWindow({
    width: 1000, height: 700, backgroundColor: '#0f1115',
    autoHideMenuBar: true,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true }
  });
  win.loadFile('index.html');
}

ipcMain.handle('apps:list', () => withUrls(load()));

ipcMain.handle('apps:pickTarget', async () => {
  const r = await dialog.showOpenDialog(win, {
    title: 'Escolha o app ou atalho',
    properties: ['openFile'],
    filters: [{ name: 'Apps e atalhos', extensions: ['exe', 'lnk', 'bat', 'url'] }, { name: 'Todos', extensions: ['*'] }]
  });
  return r.canceled ? null : r.filePaths[0];
});

ipcMain.handle('apps:pickMedia', async () => {
  const r = await dialog.showOpenDialog(win, {
    title: 'Escolha o GIF ou vídeo',
    properties: ['openFile'],
    filters: [{ name: 'GIF, vídeo e imagem', extensions: ['gif', 'mp4', 'webm', 'mkv', 'mov', 'png', 'jpg', 'jpeg', 'webp'] }]
  });
  return r.canceled ? null : r.filePaths[0];
});

ipcMain.handle('apps:save', (_e, item) => {
  const list = load();
  let entry = item.id ? list.find(a => a.id === item.id) : null;
  if (!entry) {
    entry = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6) };
    list.push(entry);
  }
  entry.name = item.name;
  entry.target = item.target;
  if (item.mediaSrc) {
    fs.mkdirSync(mediaDir(), { recursive: true });
    const name = entry.id + '-' + Date.now() + path.extname(item.mediaSrc).toLowerCase();
    fs.copyFileSync(item.mediaSrc, path.join(mediaDir(), name));
    if (entry.media) fs.rmSync(path.join(mediaDir(), entry.media), { force: true });
    entry.media = name;
  }
  save(list);
  return withUrls(list);
});

ipcMain.handle('apps:remove', (_e, id) => {
  let list = load();
  const entry = list.find(a => a.id === id);
  if (entry && entry.media) fs.rmSync(path.join(mediaDir(), entry.media), { force: true });
  list = list.filter(a => a.id !== id);
  save(list);
  return withUrls(list);
});

ipcMain.handle('apps:launch', async (_e, target) => {
  const err = await shell.openPath(target);
  return err || null;
});

app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());
