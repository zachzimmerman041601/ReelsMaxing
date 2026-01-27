const { contextBridge, ipcRenderer } = require('electron');

// Expose IPC methods to renderer
contextBridge.exposeInMainWorld('reelsmax', {
  onPauseReels: (callback) => ipcRenderer.on('pause-reels', callback),
  onPlayReels: (callback) => ipcRenderer.on('play-reels', callback),
  aiStarted: () => ipcRenderer.send('ai-started'),
  aiComplete: () => ipcRenderer.send('ai-complete')
});
