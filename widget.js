const id = new URLSearchParams(location.search).get('id');
const VIDEO_EXT = /\.(mp4|webm|mkv|mov)$/i;

(async () => {
  const info = await window.api.widgetInfo(id);
  if (!info) return;
  document.getElementById('name').textContent = info.name;
  if (!info.mediaUrl) return;
  let el;
  if (VIDEO_EXT.test(info.mediaUrl)) {
    el = document.createElement('video');
    el.autoplay = true; el.loop = true; el.muted = true; el.playsInline = true;
  } else {
    el = document.createElement('img');
  }
  el.src = info.mediaUrl;
  document.getElementById('thumb').appendChild(el);
})();

// Arrastar manualmente (mantém o duplo clique funcionando)
let drag = null;
document.addEventListener('pointerdown', e => {
  if (e.button !== 0) return;
  document.body.setPointerCapture(e.pointerId);
  drag = { mx: e.screenX, my: e.screenY, wx: window.screenX, wy: window.screenY, moved: false };
});
document.addEventListener('pointermove', e => {
  if (!drag) return;
  const dx = e.screenX - drag.mx, dy = e.screenY - drag.my;
  if (Math.abs(dx) + Math.abs(dy) > 3) drag.moved = true;
  if (drag.moved) window.api.widgetMove(drag.wx + dx, drag.wy + dy);
});
document.addEventListener('pointerup', () => {
  if (drag && drag.moved) window.api.widgetDropped();
  drag = null;
});
document.addEventListener('dblclick', () => window.api.widgetLaunch(id));
document.addEventListener('contextmenu', e => { e.preventDefault(); window.api.widgetMenu(); });
