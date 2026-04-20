// ─── Navigation elements ──────────────────────────────────────────────────────
const btnSidebar    = document.getElementById('btn-sidebar');
const btnBack       = document.getElementById('btn-back');
const btnForward    = document.getElementById('btn-forward');
const btnReload     = document.getElementById('btn-reload');
const spinner       = document.getElementById('loading-spinner');
const offlineScreen = document.getElementById('offline-screen');
const btnRetry      = document.getElementById('btn-retry-offline');
const offlineTitle  = document.getElementById('offline-title');
const offlineSub    = document.getElementById('offline-subtitle');
const splashScreen  = document.getElementById('splash-screen');
const netBanner     = document.getElementById('network-banner');
let splashDismissed = false;
let isCurrentlyOffline = !navigator.onLine; // capture real state immediately

// ── Startup: if device is already offline, show banner properly ──
if (isCurrentlyOffline) {
    // Defer until after electronAPI is ready (end of script execution)
    setTimeout(() => showNetworkBanner(), 0);
}

// ─── Update Toast elements ────────────────────────────────────────────────────
const updateToast         = document.getElementById('update-toast');
const toastAvailable      = document.getElementById('toast-available');
const toastDownloading    = document.getElementById('toast-downloading');
const toastReady          = document.getElementById('toast-ready');
const updateVersionBadge  = document.getElementById('update-version-badge');
const toastPercent        = document.getElementById('toast-percent');
const toastProgressFill   = document.getElementById('toast-progress-fill');
const toastSpeed          = document.getElementById('toast-speed');
const btnStartDownload    = document.getElementById('btn-start-download');
const btnDismissLater     = document.getElementById('btn-dismiss-later');
const btnRestartInstall   = document.getElementById('btn-restart-install');
const btnDismissReady     = document.getElementById('btn-dismiss-ready');

// ─── Navigation actions ───────────────────────────────────────────────────────
btnSidebar.addEventListener('click', () => window.electronAPI.toggleSidebar());
btnBack.addEventListener('click', () => window.electronAPI.navBack());
btnForward.addEventListener('click', () => window.electronAPI.navForward());

btnReload.addEventListener('click', () => {
    hideOffline();
    window.electronAPI.navReload();
});

btnRetry.addEventListener('click', () => {
    btnRetry.classList.add('spinning');
    setTimeout(() => btnRetry.classList.remove('spinning'), 1000);
    hideOffline();
    window.electronAPI.navReload();
});

// ─── Network banner helpers ───────────────────────────────────────────────────
function showNetworkBanner() {
    if (!netBanner) return;
    netBanner.classList.remove('hidden');
    void netBanner.offsetWidth;
    netBanner.classList.add('visible');
    // Tell main process to push WebContentsView down so banner is fully visible
    window.electronAPI.bannerShow();
}

function hideNetworkBanner() {
    if (!netBanner) return;
    netBanner.classList.remove('visible');
    setTimeout(() => {
        netBanner.classList.add('hidden');
        // Tell main process to restore WebContentsView to normal position
        window.electronAPI.bannerHide();
    }, 400);
}

// ─── Offline screen helpers ───────────────────────────────────────────────────
function showOffline(isOffline, description) {
    isCurrentlyOffline = isOffline;
    if (isOffline) {
        offlineTitle.textContent = "You're Offline";
        offlineSub.innerHTML = "No internet connection detected.<br>Please check your Wi-Fi or network settings.";
    } else {
        offlineTitle.textContent = "Unable to Connect";
        offlineSub.textContent = description || "The page could not be loaded. Please try again.";
    }
    offlineScreen.classList.remove('hidden');
    void offlineScreen.offsetWidth;
    offlineScreen.classList.add('visible');
    if (isOffline) showNetworkBanner();
}

function hideOffline() {
    offlineScreen.classList.remove('visible');
    setTimeout(() => offlineScreen.classList.add('hidden'), 350);
    hideNetworkBanner();
}

// ─── Real-time network monitoring ─────────────────────────────────────────────
window.addEventListener('offline', () => {
    isCurrentlyOffline = true;
    showNetworkBanner();
    // Show offline screen if splash is already gone
    if (splashDismissed) {
        showOffline(true);
    }
});

window.addEventListener('online', () => {
    isCurrentlyOffline = false;
    hideNetworkBanner();
    // Auto-reload page when connection restored
    if (splashDismissed) {
        hideOffline();
        setTimeout(() => window.electronAPI.navReload(), 500);
    }
});

// ─── IPC: Navigation & loading ────────────────────────────────────────────────
window.electronAPI.onLoadingState((isLoading) => {
    spinner.classList.toggle('hidden', !isLoading);
});

window.electronAPI.onNavState((state) => {
    btnBack.disabled    = !state.canGoBack;
    btnForward.disabled = !state.canGoForward;
    hideOffline();

    if (!splashDismissed && splashScreen) {
        splashDismissed = true;
        setTimeout(() => {
            splashScreen.classList.add('fade-out');
            setTimeout(() => splashScreen.remove(), 700);
        }, 800);
    }
});

window.electronAPI.onLoadError((payload) => {
    const isOffline = payload && (payload.offline || !navigator.onLine);
    const desc      = payload && payload.description;
    showOffline(isOffline, desc);
    spinner.classList.add('hidden');
    // Always show the banner if we're offline
    if (isOffline) showNetworkBanner();

    if (!splashDismissed && splashScreen) {
        splashDismissed = true;
        splashScreen.classList.add('fade-out');
        setTimeout(() => splashScreen.remove(), 700);
    }
});

// ─── Update Toast helpers ─────────────────────────────────────────────────────
function switchToastState(showEl) {
    [toastAvailable, toastDownloading, toastReady].forEach(el => {
        el.classList.toggle('hidden', el !== showEl);
    });
}

function showToast() {
    updateToast.classList.remove('hidden');
    void updateToast.offsetWidth; // force reflow for animation
    updateToast.classList.add('visible');
}

function hideToast() {
    updateToast.classList.remove('visible');
    setTimeout(() => updateToast.classList.add('hidden'), 420);
}

function formatSpeed(bps) {
    if (bps >= 1024 * 1024) return (bps / 1024 / 1024).toFixed(1) + ' MB/s';
    return Math.round(bps / 1024) + ' KB/s';
}

function formatBytes(bytes) {
    if (bytes >= 1024 * 1024) return (bytes / 1024 / 1024).toFixed(1) + ' MB';
    return Math.round(bytes / 1024) + ' KB';
}

// ─── IPC: Auto-updater events ─────────────────────────────────────────────────

// 1. New version found → show "Update Available" state
window.electronAPI.onUpdateAvailable((info) => {
    updateVersionBadge.textContent = 'v' + info.version;
    switchToastState(toastAvailable);
    showToast();
});

// 2. Download in progress → show progress bar
window.electronAPI.onUpdateProgress((progress) => {
    switchToastState(toastDownloading);
    // Make sure toast is visible
    if (updateToast.classList.contains('hidden')) showToast();

    const pct = Math.min(progress.percent, 100);
    toastProgressFill.style.width = pct + '%';
    toastPercent.textContent = pct + '%';

    const transferred = formatBytes(progress.transferred);
    const total = formatBytes(progress.total);
    const speed = formatSpeed(progress.bytesPerSecond);
    toastSpeed.textContent = `${transferred} / ${total} · ${speed}`;
});

// 3. Download complete → show "Restart & Install" state
window.electronAPI.onUpdateDownloaded((info) => {
    switchToastState(toastReady);
    if (updateToast.classList.contains('hidden')) showToast();
});

// 4. Update error → silently hide toast & log
window.electronAPI.onUpdateError((msg) => {
    console.warn('[Update] Error:', msg);
    hideToast();
});

// ─── Update Toast button actions ──────────────────────────────────────────────

btnStartDownload.addEventListener('click', () => {
    // Switch to downloading state immediately (feels responsive)
    toastProgressFill.style.width = '0%';
    toastPercent.textContent = '0%';
    toastSpeed.textContent = 'Starting download…';
    switchToastState(toastDownloading);
    window.electronAPI.startUpdateDownload();
});

btnDismissLater.addEventListener('click', () => hideToast());

btnRestartInstall.addEventListener('click', () => {
    btnRestartInstall.disabled = true;
    btnRestartInstall.textContent = 'Restarting…';
    window.electronAPI.restartAndInstall();
});

btnDismissReady.addEventListener('click', () => hideToast());
