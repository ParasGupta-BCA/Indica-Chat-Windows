const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // ── Navigation ──────────────────────────────────────────────────────────────
  navBack: () => ipcRenderer.send('nav-back'),
  navForward: () => ipcRenderer.send('nav-forward'),
  navReload: () => ipcRenderer.send('nav-reload'),
  toggleSidebar: () => ipcRenderer.send('toggle-sidebar'),

  // ── Banner (shifts WebContentsView to expose banner) ─────────────────────────
  bannerShow: () => ipcRenderer.send('banner-show'),
  bannerHide: () => ipcRenderer.send('banner-hide'),

  onLoadingState: (cb) => ipcRenderer.on('loading-state', (_e, v) => cb(v)),
  onNavState: (cb) => ipcRenderer.on('nav-state', (_e, v) => cb(v)),
  onLoadError: (cb) => ipcRenderer.on('load-error', (_e, v) => cb(v)),

  // ── Auto-Updater ────────────────────────────────────────────────────────────
  // Events from main → renderer
  onUpdateAvailable: (cb) => ipcRenderer.on('update-available', (_e, info) => cb(info)),
  onUpdateProgress: (cb) => ipcRenderer.on('update-progress', (_e, progress) => cb(progress)),
  onUpdateDownloaded: (cb) => ipcRenderer.on('update-downloaded', (_e, info) => cb(info)),
  onUpdateError: (cb) => ipcRenderer.on('update-error', (_e, msg) => cb(msg)),

  // Actions from renderer → main
  startUpdateDownload: () => ipcRenderer.send('start-update-download'),
  restartAndInstall: () => ipcRenderer.send('restart-and-install'),
});
