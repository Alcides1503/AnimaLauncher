const $ = id => document.getElementById(id);
const VIDEO_EXT = /\.(mp4|webm|mkv|mov)$/i;
let apps = [];
let editing = null;      // id em edição
let form = { target: '', mediaSrc: '', mediaUrl: '' };
let menuId = null;

function mediaEl(url) {
  if (!url) return null;
  if (VIDEO_EXT.test(url)) {
    const v = document.createElement('video');
    v.src = url; v.autoplay = true; v.loop = true; v.muted = true; v.playsInline = true;
    return v;
  }
  const i = document.createElement('img');
  i.src = url;
  return i;
}

const MIME = { gif: 'image/gif', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp',
  mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime', mkv: 'video/x-matroska' };

// Captura o primeiro quadro do GIF/vídeo como PNG 256x256 (o Windows não anima ícones)
async function framePng(blob, isVideo) {
  const url = URL.createObjectURL(blob);
  try {
    const size = 256;
    const c = document.createElement('canvas');
    c.width = c.height = size;
    let el, w, h;
    if (isVideo) {
      el = document.createElement('video');
      el.muted = true; el.src = url;
      await new Promise((res, rej) => { el.onloadeddata = res; el.onerror = rej; });
      await new Promise(res => { el.onseeked = res; el.currentTime = 0.1; });
      w = el.videoWidth; h = el.videoHeight;
    } else {
      el = new Image(); el.src = url;
      await el.decode();
      w = el.naturalWidth; h = el.naturalHeight;
    }
    const s = Math.max(size / w, size / h);
    c.getContext('2d').drawImage(el, (size - w * s) / 2, (size - h * s) / 2, w * s, h * s);
    return c.toDataURL('image/png');
  } finally { URL.revokeObjectURL(url); }
}

async function createShortcut(a) {
  let png = null;
  if (a.mediaPath) {
    try {
      const ext = a.mediaPath.split('.').pop().toLowerCase();
      const bytes = await window.api.readFile(a.mediaPath);
      png = await framePng(new Blob([bytes], { type: MIME[ext] || '' }), VIDEO_EXT.test(a.mediaPath));
    } catch (e) { console.error(e); }
  }
  const err = await window.api.shortcut(a.id, png);
  alert(err ? 'Erro: ' + err : 'Atalho criado na área de trabalho!');
}

function render() {
  const grid = $('grid');
  grid.innerHTML = '';
  $('empty').hidden = apps.length > 0;
  for (const a of apps) {
    const tile = document.createElement('div');
    tile.className = 'tile';
    const thumb = document.createElement('div');
    thumb.className = 'thumb';
    const m = mediaEl(a.mediaUrl);
    if (m) thumb.appendChild(m);
    else { thumb.innerHTML = '<div class="ph">▶</div>'; }
    const label = document.createElement('span');
    label.textContent = a.name;
    tile.append(thumb, label);
    tile.onclick = async () => {
      const err = await window.api.launch(a.target);
      if (err) alert('Não foi possível abrir: ' + err);
    };
    tile.oncontextmenu = e => {
      e.preventDefault();
      menuId = a.id;
      const menu = $('menu');
      menu.style.left = e.clientX + 'px';
      menu.style.top = e.clientY + 'px';
      menu.hidden = false;
    };
    grid.appendChild(tile);
  }
}

function updatePreview() {
  const p = $('preview');
  p.innerHTML = '';
  const url = form.mediaSrc ? 'file:///' + form.mediaSrc.replace(/\\/g, '/') : form.mediaUrl;
  const m = mediaEl(url);
  if (m) p.appendChild(m);
}

function openModal(app) {
  editing = app ? app.id : null;
  form = { target: app ? app.target : '', mediaSrc: '', mediaUrl: app ? app.mediaUrl : '' };
  $('modalTitle').textContent = app ? 'Editar app' : 'Adicionar app';
  $('fName').value = app ? app.name : '';
  $('fTarget').value = form.target;
  $('fMedia').value = app && app.media ? app.media : '';
  updatePreview();
  $('modal').hidden = false;
}

$('addBtn').onclick = () => openModal(null);
$('cancel').onclick = () => { $('modal').hidden = true; };

$('pickTarget').onclick = async () => {
  const p = await window.api.pickTarget();
  if (!p) return;
  form.target = p;
  $('fTarget').value = p;
  if (!$('fName').value) {
    $('fName').value = p.split(/[\\/]/).pop().replace(/\.[^.]+$/, '');
  }
};

$('pickMedia').onclick = async () => {
  const p = await window.api.pickMedia();
  if (!p) return;
  form.mediaSrc = p;
  $('fMedia').value = p;
  updatePreview();
};

$('saveBtn').onclick = async () => {
  const name = $('fName').value.trim();
  if (!name || !form.target) { alert('Informe o nome e escolha o app.'); return; }
  apps = await window.api.save({ id: editing, name, target: form.target, mediaSrc: form.mediaSrc });
  $('modal').hidden = true;
  render();
  if ($('fShortcut').checked) {
    await createShortcut(editing ? apps.find(a => a.id === editing) : apps[apps.length - 1]);
  }
};

$('mEdit').onclick = () => { $('menu').hidden = true; openModal(apps.find(a => a.id === menuId)); };
$('mShortcut').onclick = () => { $('menu').hidden = true; createShortcut(apps.find(a => a.id === menuId)); };
$('mRemove').onclick = async () => {
  $('menu').hidden = true;
  if (confirm('Remover este app da lista?')) { apps = await window.api.remove(menuId); render(); }
};
document.addEventListener('click', () => { $('menu').hidden = true; });

(async () => { apps = await window.api.list(); render(); })();
