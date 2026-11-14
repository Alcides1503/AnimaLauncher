const { app, BrowserWindow, ipcMain, dialog, shell, Menu, screen } = require('electron');
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');

if (!app.requestSingleInstanceLock()) app.quit();
app.on('second-instance', () => showMain());

const dbFile = () => path.join(app.getPath('userData'), 'apps.json');
const mediaDir = () => path.join(app.getPath('userData'), 'media');
const exePath = () => process.env.PORTABLE_EXECUTABLE_FILE || process.execPath;

function load() {
  try { return JSON.parse(fs.readFileSync(dbFile(), 'utf8')); } catch { return []; }
}
function save(list) {
  fs.mkdirSync(app.getPath('userData'), { recursive: true });
  fs.writeFileSync(dbFile(), JSON.stringify(list, null, 2));
}
function pngToIco(png) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); header.writeUInt16LE(1, 2); header.writeUInt16LE(1, 4);
  const entry = Buffer.alloc(16); // largura/altura 0 = 256px
  entry.writeUInt16LE(1, 4); entry.writeUInt16LE(32, 6);
  entry.writeUInt32LE(png.length, 8); entry.writeUInt32LE(22, 12);
  return Buffer.concat([header, entry, png]);
}
function withUrls(list) {
  return list.map(a => ({
    ...a,
    mediaUrl: a.media ? pathToFileURL(path.join(mediaDir(), a.media)).href : null,
    mediaPath: a.media ? path.join(mediaDir(), a.media) : null
  }));
}
function updateWidget(id, patch) {
  const list = load();
  const e = list.find(a => a.id === id);
  if (!e) return;
  e.widget = { ...(e.widget || {}), ...patch };
  save(list);
}

/* ---------- Janela principal ---------- */
let win = null;
function createWindow() {
  win = new BrowserWindow({
    width: 1000, height: 700, backgroundColor: '#0f1115',
    autoHideMenuBar: true,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true }
  });
  win.on('closed', () => { win = null; });
  win.loadFile('index.html');
}
function showMain() {
  if (win && !win.isDestroyed()) {
    if (win.isMinimized()) win.restore();
    win.show(); win.focus();
  } else createWindow();
}
const openDialog = opts => (win ? dialog.showOpenDialog(win, opts) : dialog.showOpenDialog(opts));

/* ---------- Widgets animados na área de trabalho ---------- */
const widgets = new Map(); // id -> BrowserWindow

function idOf(wnd) {
  for (const [id, w] of widgets) if (w === wnd) return id;
  return null;
}

function defaultPos(size) {
  const wa = screen.getPrimaryDisplay().workArea;
  const gap = 16, h = size + 24 + gap;
  const n = widgets.size;
  const rows = Math.max(1, Math.floor((wa.height - gap) / h));
  const col = Math.floor(n / rows), row = n % rows;
  return { x: wa.x + wa.width - (size + gap) * (col + 1), y: wa.y + gap + row * h };
}

function openWidget(entry) {
  if (widgets.has(entry.id)) return;
  const w = entry.widget || {};
  const size = w.size || 128;
  const wnd = new BrowserWindow({
    x: w.x, y: w.y, width: size, height: size + 24,
    frame: false, transparent: true, backgroundColor: '#00000000',
    resizable: false, maximizable: false, minimizable: false, fullscreenable: false,
    hasShadow: false, skipTaskbar: true, alwaysOnTop: w.onTop !== false,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true }
  });
  wnd._w = size; wnd._h = size + 24;
  wnd.loadFile('widget.html', { query: { id: entry.id } });
  widgets.set(entry.id, wnd);
  wnd.on('closed', () => widgets.delete(entry.id));
}

ipcMain.handle('widget:enable', (_e, id) => {
  const list = load();
  const e = list.find(a => a.id === id);
  if (!e) return 'App não encontrado';
  const size = (e.widget && e.widget.size) || 128;
  if (!e.widget || e.widget.x === undefined) {
    e.widget = { size, onTop: true, ...(e.widget || {}), ...defaultPos(size) };
  }
  e.widget.enabled = true;
  save(list);
  openWidget(e);
  const w = widgets.get(id);
  if (w) w.show();
  return null;
});

ipcMain.handle('widget:info', (_e, id) => {
  const e = withUrls(load()).find(a => a.id === id);
  return e ? { name: e.name, mediaUrl: e.mediaUrl } : null;
});

ipcMain.handle('widget:launch', async (_e, id) => {
  const e = load().find(a => a.id === id);
  return e ? (await shell.openPath(e.target)) || null : 'App não encontrado';
});

ipcMain.on('widget:moveTo', (e, x, y) => {
  const w = BrowserWindow.fromWebContents(e.sender);
  if (w) w.setBounds({ x: Math.round(x), y: Math.round(y), width: w._w, height: w._h });
});

ipcMain.on('widget:dropped', e => {
  const w = BrowserWindow.fromWebContents(e.sender);
  const id = w && idOf(w);
  if (id) { const b = w.getBounds(); updateWidget(id, { x: b.x, y: b.y }); }
});

ipcMain.on('widget:menu', e => {
  const w = BrowserWindow.fromWebContents(e.sender);
  const id = w && idOf(w);
  if (!id) return;
  const entry = load().find(a => a.id === id) || {};
  const cfg = entry.widget || {};
  const loginOpts = { path: exePath(), args: ['--widgets'] };
  const setSize = size => {
    updateWidget(id, { size });
    w._w = size; w._h = size + 24;
    const b = w.getBounds();
    w.setBounds({ x: b.x, y: b.y, width: w._w, height: w._h });
  };
  Menu.buildFromTemplate([
    { label: 'Abrir app', click: () => shell.openPath(entry.target) },
    { type: 'separator' },
    { label: 'Sempre por cima', type: 'checkbox', checked: cfg.onTop !== false,
      click: item => { updateWidget(id, { onTop: item.checked }); w.setAlwaysOnTop(item.checked); } },
    { label: 'Tamanho', submenu: [
      { label: 'Pequeno', type: 'radio', checked: (cfg.size || 128) === 96, click: () => setSize(96) },
      { label: 'Médio', type: 'radio', checked: (cfg.size || 128) === 128, click: () => setSize(128) },
      { label: 'Grande', type: 'radio', checked: (cfg.size || 128) === 192, click: () => setSize(192) }
    ] },
    { label: 'Iniciar com o Windows', type: 'checkbox',
      checked: app.getLoginItemSettings(loginOpts).openAtLogin,
      click: item => app.setLoginItemSettings({ openAtLogin: item.checked, ...loginOpts }) },
    { type: 'separator' },
    { label: 'Abrir AnimaLauncher', click: showMain },
    { label: 'Remover da área de trabalho', click: () => { updateWidget(id, { enabled: false }); w.close(); } }
  ]).popup({ window: w });
});

/* ---------- Apps ---------- */
ipcMain.handle('apps:list', () => withUrls(load()));

ipcMain.handle('apps:pickTarget', async () => {
  const r = await openDialog({
    title: 'Escolha o app ou atalho',
    properties: ['openFile'],
    filters: [{ name: 'Apps e atalhos', extensions: ['exe', 'lnk', 'bat', 'url'] }, { name: 'Todos', extensions: ['*'] }]
  });
  return r.canceled ? null : r.filePaths[0];
});

ipcMain.handle('apps:pickMedia', async () => {
  const r = await openDialog({
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
  const w = widgets.get(entry.id);
  if (w) w.webContents.reload();
  return withUrls(list);
});

ipcMain.handle('apps:remove', (_e, id) => {
  let list = load();
  const entry = list.find(a => a.id === id);
  if (entry && entry.media) fs.rmSync(path.join(mediaDir(), entry.media), { force: true });
  const w = widgets.get(id);
  if (w) w.close();
  list = list.filter(a => a.id !== id);
  save(list);
  return withUrls(list);
});

ipcMain.handle('file:read', (_e, p) => fs.readFileSync(p));

ipcMain.handle('apps:shortcut', (_e, id, pngDataUrl) => {
  const entry = load().find(a => a.id === id);
  if (!entry) return 'App não encontrado';
  const opts = { target: entry.target, cwd: path.dirname(entry.target), description: entry.name };
  if (pngDataUrl) {
    const iconDir = path.join(app.getPath('userData'), 'icons');
    fs.mkdirSync(iconDir, { recursive: true });
    const ico = path.join(iconDir, id + '.ico');
    fs.writeFileSync(ico, pngToIco(Buffer.from(pngDataUrl.split(',')[1], 'base64')));
    opts.icon = ico; opts.iconIndex = 0;
  }
  const safe = entry.name.replace(/[\\/:*?"<>|]/g, '_');
  const lnk = path.join(app.getPath('desktop'), safe + '.lnk');
  return shell.writeShortcutLink(lnk, 'create', opts) ? null : 'Falha ao criar o atalho';
});

ipcMain.handle('apps:launch', async (_e, target) => {
  const err = await shell.openPath(target);
  return err || null;
});

/* ---------- Início ---------- */
app.whenReady().then(() => {
  const active = load().filter(a => a.widget && a.widget.enabled);
  active.forEach(openWidget);
  const widgetsOnly = process.argv.includes('--widgets') && active.length > 0;
  if (!widgetsOnly) createWindow();
});
app.on('window-all-closed', () => app.quit());
