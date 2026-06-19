const { app, BrowserWindow, WebContentsView, ipcMain, shell, Menu, net } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const { execSync, spawn } = require('child_process');
const fs = require('fs');

// ─── One-Time First-Launch Admin Elevation ────────────────────────────────────
// The app needs elevated rights ONCE on first launch to register itself
// properly (startup, AppCompatFlags, etc.). After that, it opens normally
// like any regular Windows app — no UAC prompt on every start.
(function handleFirstLaunchElevation() {
  // Skip entirely when running in development (non-packaged mode)
  if (!app.isPackaged) return;

  const ELEVATED_FLAG = '--elevated-first-run';
  const isElevatedProcess = process.argv.includes(ELEVATED_FLAG);

  // ── Path to the flag file that marks initialisation as done ──
  const flagPath = path.join(app.getPath('userData'), 'initialized.flag');

  // ── If this IS the elevated process, perform one-time setup then quit ──
  if (isElevatedProcess) {
    // Write the AppCompatFlags registry key so Windows knows we've set up
    try {
      const exePath = process.execPath;
      // Remove any stale RUNASADMIN flag — we only wanted it once
      execSync(
        `reg delete "HKCU\\Software\\Microsoft NT\\CurrentVersion\\AppCompatFlags\\Layers" /v "${exePath}" /f`,
        { stdio: 'ignore' }
      );
    } catch (_) { /* key may not exist — safe to ignore */ }

    // Write the flag so future launches skip elevation
    try {
      fs.mkdirSync(path.dirname(flagPath), { recursive: true });
      fs.writeFileSync(flagPath, new Date().toISOString(), 'utf8');
    } catch (err) {
      console.error('[FirstRun] Could not write flag:', err.message);
    }

    // Exit the elevated process — the original (normal) process continues
    app.quit();
    return;
  }

  // ── If flag does NOT exist → this is the very first launch ──
  if (!fs.existsSync(flagPath)) {
    const exePath = process.execPath;

    // Launch a new elevated instance of ourselves with the special flag.
    // PowerShell's Start-Process -Verb RunAs triggers the UAC prompt.
    const psCmd = [
      'Start-Process',
      `-FilePath '${exePath.replace(/'/g, "''")}' `,
      `-ArgumentList '${ELEVATED_FLAG}'`,
      '-Verb RunAs',
      '-Wait'   // wait for the elevated process to finish before we continue
    ].join(' ');

    try {
      execSync(`powershell -WindowStyle Hidden -Command "${psCmd}"`, {
        windowsHide: true,
        stdio: 'ignore'
      });
    } catch (err) {
      // User clicked "No" on UAC or elevation failed — write the flag anyway
      // so we don't keep pestering them every launch.
      console.warn('[FirstRun] Elevation skipped or denied:', err.message);
      try {
        fs.mkdirSync(path.dirname(flagPath), { recursive: true });
        fs.writeFileSync(flagPath, 'skipped', 'utf8');
      } catch (_) {}
    }
    // After the elevated process has finished (or was denied),
    // the normal process simply continues to open the app window.
  }
  // If flag DOES exist → not first launch → do nothing, open normally.
}());
// ─────────────────────────────────────────────────────────────────────────────

// ─── Single Instance Lock ────────────────────────────────────────────────────
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}
// ─────────────────────────────────────────────────────────────────────────────

let mainWindow;
let splashWindow;
let view;
let bannerVisible = false;   // tracks whether the offline banner is shown
const BANNER_HEIGHT = 36;    // must match the banner's rendered height in CSS

// ─── Auto-Updater Configuration ─────────────────────────────────────────────
// Do NOT auto-download — let the user decide via the in-app toast.
autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = false;
// Set logger so update events show in console
autoUpdater.logger = null;

function setupAutoUpdater() {
  // Check for updates silently 3 seconds after launch
  setTimeout(() => {
    autoUpdater.checkForUpdates().catch(err => {
      console.log('[Updater] Check failed (this is normal in dev):', err.message);
    });
  }, 3000);

  // ── Update events → forward to renderer ──
  autoUpdater.on('update-available', (info) => {
    if (mainWindow) {
      mainWindow.webContents.send('update-available', {
        version: info.version,
        releaseDate: info.releaseDate
      });
    }
  });

  autoUpdater.on('update-not-available', () => {
    // Silently ignore — no notification needed
  });

  autoUpdater.on('download-progress', (progress) => {
    if (mainWindow) {
      mainWindow.webContents.send('update-progress', {
        percent: Math.round(progress.percent),
        bytesPerSecond: progress.bytesPerSecond,
        transferred: progress.transferred,
        total: progress.total
      });
    }
  });

  autoUpdater.on('update-downloaded', (info) => {
    if (mainWindow) {
      mainWindow.webContents.send('update-downloaded', {
        version: info.version
      });
    }
  });

  autoUpdater.on('error', (err) => {
    console.log('[Updater] Error:', err.message);
    // Suppress ALL network-related errors — they are expected when offline
    const netErrors = [
      'net::ERR', 'fetch', 'connect', 'ENOTFOUND',
      'ETIMEDOUT', 'ECONNREFUSED', 'ECONNRESET', 'socket',
      'network', 'offline', 'getaddrinfo'
    ];
    const isNetError = netErrors.some(k => err.message.toLowerCase().includes(k.toLowerCase()));
    if (mainWindow && !isNetError) {
      mainWindow.webContents.send('update-error', err.message);
    }
  });

  // ── IPC: renderer triggers download ──
  ipcMain.removeAllListeners('start-update-download');
  ipcMain.on('start-update-download', () => {
    autoUpdater.downloadUpdate().catch(err => {
      console.log('[Updater] Download failed:', err.message);
    });
  });

  // ── IPC: renderer triggers install & restart ──
  ipcMain.removeAllListeners('restart-and-install');
  ipcMain.on('restart-and-install', () => {
    // false = don't run installer silently (show it), true = restart app after
    autoUpdater.quitAndInstall(false, true);
  });
}
// ─────────────────────────────────────────────────────────────────────────────

function createWindow() {
  mainWindow = new BrowserWindow({
    icon: path.join(__dirname, 'logo_image', 'logo_main.png'),
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    show: false,
    frame: true,
    backgroundColor: '#09090b',
    titleBarStyle: 'hidden',
    opacity: 0,
    titleBarOverlay: {
      color: '#09090b',
      symbolColor: '#ffffff',
      height: 44
    },
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    }
  });

  // Remove default menu to prevent accidental new-window shortcuts
  Menu.setApplicationMenu(null);

  mainWindow.loadFile('ui/index.html');

  mainWindow.once('ready-to-show', () => {
    mainWindow.center();
    // We show the main window only after the web content has finished loading (in setupWebContentsView)
    setupWebContentsView();
    setupAutoUpdater();
  });

  mainWindow.on('resize', updateViewBounds);
  mainWindow.on('maximize', updateViewBounds);
  mainWindow.on('restore', updateViewBounds);
  mainWindow.on('enter-full-screen', updateViewBounds);
  mainWindow.on('leave-full-screen', updateViewBounds);
}

function setupWebContentsView() {
  if (!mainWindow) return;

  view = new WebContentsView({
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: true,
    }
  });

  mainWindow.contentView.addChildView(view);
  updateViewBounds();

  const handleZoom = (event, input) => {
    if (input.control) {
      if (input.key === '=' || input.key === '+') {
        const level = view.webContents.getZoomLevel();
        view.webContents.setZoomLevel(level + 0.5);
        event.preventDefault();
      } else if (input.key === '-') {
        const level = view.webContents.getZoomLevel();
        view.webContents.setZoomLevel(level - 0.5);
        event.preventDefault();
      } else if (input.key === '0') {
        view.webContents.setZoomLevel(0);
        event.preventDefault();
      }
    }
  };

  view.webContents.on('before-input-event', handleZoom);
  mainWindow.webContents.on('before-input-event', handleZoom);

  view.webContents.loadURL('https://www.indicachat.in/');

  // ── Show Main Window & Close Splash when ready ──
  const showMainAndCloseSplash = () => {
    if (splashWindow) {
      const tempSplash = splashWindow;
      splashWindow = null;
      tempSplash.setAlwaysOnTop(false);

      mainWindow.show();
      mainWindow.focus();

      // Smoothly fade in the main window
      let opacity = 0;
      const interval = setInterval(() => {
        opacity += 0.08;
        if (opacity >= 1) {
          mainWindow.setOpacity(1);
          clearInterval(interval);
          tempSplash.close();
        } else {
          mainWindow.setOpacity(opacity);
        }
      }, 16);
    }
  };

  // Give it a 10s maximum timeout as a fallback
  const splashTimeout = setTimeout(showMainAndCloseSplash, 10000);

  view.webContents.on('did-finish-load', () => {
    clearTimeout(splashTimeout);
    // Add a slight delay for a smoother transition
    setTimeout(showMainAndCloseSplash, 800);
  });

  view.webContents.on('did-fail-load', () => {
    clearTimeout(splashTimeout);
    showMainAndCloseSplash();
  });

  // ── Immediately tell renderer if device is offline at startup ──
  setTimeout(() => {
    if (!net.isOnline() && mainWindow) {
      mainWindow.webContents.send('load-error', {
        description: 'No internet connection',
        offline: true,
        errorCode: -106
      });
    }
  }, 200);

  view.webContents.setWindowOpenHandler(({ url }) => {
    if (!url.includes('indicachat.in')) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'deny' };
  });

  // Handle right-click context menu (Spellcheck corrections, Add to Dictionary, Copy, Paste, etc.)
  view.webContents.on('context-menu', (event, params) => {
    const menuTemplate = [];

    // 1. Spellcheck suggestions
    if (params.misspelledWord) {
      if (params.dictionarySuggestions && params.dictionarySuggestions.length > 0) {
        params.dictionarySuggestions.slice(0, 5).forEach((suggestion) => {
          menuTemplate.push({
            label: suggestion,
            click: () => {
              view.webContents.replaceMisspelling(suggestion);
            }
          });
        });
      } else {
        menuTemplate.push({
          label: 'No spelling suggestions',
          enabled: false
        });
      }
      
      menuTemplate.push({
        label: `Add "${params.misspelledWord}" to Dictionary`,
        click: () => {
          view.webContents.session.addWordToSpellCheckerDictionary(params.misspelledWord);
        }
      });
      menuTemplate.push({ type: 'separator' });
    }

    // 2. Editable text operations (Inputs, textareas)
    if (params.isEditable) {
      menuTemplate.push({
        label: 'Undo',
        role: 'undo',
        enabled: params.editFlags.canUndo
      });
      menuTemplate.push({
        label: 'Redo',
        role: 'redo',
        enabled: params.editFlags.canRedo
      });
      menuTemplate.push({ type: 'separator' });
      menuTemplate.push({
        label: 'Cut',
        role: 'cut',
        enabled: params.editFlags.canCut
      });
      menuTemplate.push({
        label: 'Copy',
        role: 'copy',
        enabled: params.editFlags.canCopy
      });
      menuTemplate.push({
        label: 'Paste',
        role: 'paste',
        enabled: params.editFlags.canPaste
      });
      menuTemplate.push({ type: 'separator' });
      menuTemplate.push({
        label: 'Select All',
        role: 'selectall',
        enabled: params.editFlags.canSelectAll
      });
    } else {
      // 3. Non-editable selection operations
      if (params.selectionText && params.selectionText.trim() !== '') {
        menuTemplate.push({
          label: 'Copy',
          role: 'copy',
          enabled: params.editFlags.canCopy
        });
        menuTemplate.push({
          label: 'Select All',
          role: 'selectall',
          enabled: params.editFlags.canSelectAll
        });
      } else {
        // 4. Default navigation options
        menuTemplate.push({
          label: 'Back',
          enabled: view.webContents.navigationHistory.canGoBack(),
          click: () => {
            view.webContents.navigationHistory.goBack();
          }
        });
        menuTemplate.push({
          label: 'Forward',
          enabled: view.webContents.navigationHistory.canGoForward(),
          click: () => {
            view.webContents.navigationHistory.goForward();
          }
        });
      }
    }

    if (menuTemplate.length > 0) {
      const menu = Menu.buildFromTemplate(menuTemplate);
      menu.popup({ window: mainWindow });
    }
  });

  view.webContents.on('did-start-loading', () => {
    mainWindow.webContents.send('loading-state', true);
  });

  view.webContents.on('dom-ready', () => {
    view.webContents.insertCSS(`
      ::-webkit-scrollbar { display: none !important; width: 0 !important; height: 0 !important; }
      * { scrollbar-width: none !important; -ms-overflow-style: none !important; }
    `);
  });

  view.webContents.on('did-stop-loading', () => {
    mainWindow.webContents.send('loading-state', false);
    updateNavButtons();
  });

  view.webContents.on('did-fail-load', (e, errorCode, errorDescription) => {
    if (errorCode !== -3) {
      // -106 = ERR_INTERNET_DISCONNECTED, -105 = ERR_NAME_NOT_RESOLVED
      // -102 = ERR_CONNECTION_REFUSED, -104 = ERR_CONNECTION_RESET
      const offlineCodes = [-106, -105, -104, -102, -21, -2];
      const isOffline = offlineCodes.includes(errorCode) || !net.isOnline();
      mainWindow.webContents.send('load-error', {
        description: errorDescription,
        offline: isOffline,
        errorCode
      });
    }
  });

  ipcMain.on('nav-back', () => {
    if (view.webContents.navigationHistory.canGoBack()) view.webContents.navigationHistory.goBack();
  });

  ipcMain.on('nav-forward', () => {
    if (view.webContents.navigationHistory.canGoForward()) view.webContents.navigationHistory.goForward();
  });

  ipcMain.on('nav-reload', () => {
    view.webContents.reload();
  });

  // ── Banner visibility: shift WebContentsView down to make room ──
  ipcMain.removeAllListeners('banner-show');
  ipcMain.on('banner-show', () => {
    bannerVisible = true;
    updateViewBounds();
  });

  ipcMain.removeAllListeners('banner-hide');
  ipcMain.on('banner-hide', () => {
    bannerVisible = false;
    updateViewBounds();
  });

  ipcMain.on('toggle-sidebar', () => {
    view.webContents.executeJavaScript(`
      try {
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 's', code: 'KeyS', ctrlKey: true, shiftKey: true, bubbles: true }));
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'S', code: 'KeyS', metaKey: true, shiftKey: true, bubbles: true }));
      } catch(e) { console.error(e); }
    `);
  });

  function updateNavButtons() {
    mainWindow.webContents.send('nav-state', {
      canGoBack: view.webContents.navigationHistory.canGoBack(),
      canGoForward: view.webContents.navigationHistory.canGoForward()
    });
  }
}

function updateViewBounds() {
  if (!mainWindow || !view) return;
  const titleBarHeight = 44;
  const topOffset = titleBarHeight + (bannerVisible ? BANNER_HEIGHT : 0);
  const contentBounds = mainWindow.getContentBounds();
  view.setBounds({
    x: 0,
    y: topOffset,
    width: contentBounds.width,
    height: Math.max(0, contentBounds.height - topOffset)
  });
}

function createSplashWindow() {
  splashWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    frame: false,
    transparent: false,
    alwaysOnTop: true,
    show: false,
    backgroundColor: '#000000',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    }
  });

  // In dev mode, load from Vite dev server for hot-reload; in production, load built files
  if (!app.isPackaged) {
    splashWindow.loadURL('http://localhost:5173');
  } else {
    splashWindow.loadFile(path.join(__dirname, 'splash', 'dist', 'index.html'));
  }
  splashWindow.center();
  splashWindow.once('ready-to-show', () => {
    splashWindow.show();
  });
}

// ─── App lifecycle ────────────────────────────────────────────────────────────
app.whenReady().then(() => {
  createSplashWindow();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      if (!mainWindow) createWindow();
      else mainWindow.show();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
