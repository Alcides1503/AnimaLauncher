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
};

$('mEdit').onclick = () => { $('menu').hidden = true; openModal(apps.find(a => a.id === menuId)); };
$('mRemove').onclick = async () => {
  $('menu').hidden = true;
  if (confirm('Remover este app da lista?')) { apps = await window.api.remove(menuId); render(); }
};
document.addEventListener('click', () => { $('menu').hidden = true; });

(async () => { apps = await window.api.list(); render(); })();
