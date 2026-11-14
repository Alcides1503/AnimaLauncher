const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('api', {
  list: () => ipcRenderer.invoke('apps:list'),
  pickTarget: () => ipcRenderer.invoke('apps:pickTarget'),
  pickMedia: () => ipcRenderer.invoke('apps:pickMedia'),
  save: item => ipcRenderer.invoke('apps:save', item),
  remove: id => ipcRenderer.invoke('apps:remove', id),
  readFile: p => ipcRenderer.invoke('file:read', p),
  shortcut: (id, png) => ipcRenderer.invoke('apps:shortcut', id, png),
  launch: target => ipcRenderer.invoke('apps:launch', target)
});
