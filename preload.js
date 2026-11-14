const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('api', {
  list: () => ipcRenderer.invoke('apps:list'),
  pickTarget: () => ipcRenderer.invoke('apps:pickTarget'),
  pickMedia: () => ipcRenderer.invoke('apps:pickMedia'),
  save: item => ipcRenderer.invoke('apps:save', item),
  remove: id => ipcRenderer.invoke('apps:remove', id),
  readFile: p => ipcRenderer.invoke('file:read', p),
  shortcut: (id, png) => ipcRenderer.invoke('apps:shortcut', id, png),
  launch: target => ipcRenderer.invoke('apps:launch', target),
  // widgets
  widgetEnable: id => ipcRenderer.invoke('widget:enable', id),
  widgetInfo: id => ipcRenderer.invoke('widget:info', id),
  widgetLaunch: id => ipcRenderer.invoke('widget:launch', id),
  widgetMove: (x, y) => ipcRenderer.send('widget:moveTo', x, y),
  widgetDropped: () => ipcRenderer.send('widget:dropped'),
  widgetMenu: () => ipcRenderer.send('widget:menu')
});
