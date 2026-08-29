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
    // Check for updates when coming back online
    if (window.electronAPI && window.electronAPI.checkForUpdates) {
        window.electronAPI.checkForUpdates();
    }
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

// ─── Mandatory Update Screen elements ─────────────────────────────────────────
const mandatoryScreen        = document.getElementById('mandatory-update-screen');
const stateAvailable         = document.getElementById('mandatory-state-available');
const stateDownloading       = document.getElementById('mandatory-state-downloading');
const stateReady             = document.getElementById('mandatory-state-ready');
const stateError             = document.getElementById('mandatory-state-error');
const updateVersionText      = document.getElementById('mandatory-update-version');
const downloadingVersionText = document.getElementById('mandatory-downloading-version');
const btnMandatoryUpdate     = document.getElementById('btn-mandatory-update');
const btnMandatoryRestart    = document.getElementById('btn-mandatory-restart');
const btnMandatoryRetry      = document.getElementById('btn-mandatory-retry');
const progressPercent        = document.getElementById('mandatory-progress-percent');
const progressFill           = document.getElementById('mandatory-progress-fill');
const progressStats          = document.getElementById('mandatory-progress-stats');
const progressSpeed          = document.getElementById('mandatory-progress-speed');
const mandatoryErrorMsg      = document.getElementById('mandatory-error-msg');

function switchMandatoryState(activeStateEl) {
    [stateAvailable, stateDownloading, stateReady, stateError].forEach(el => {
        if (el) el.classList.toggle('hidden', el !== activeStateEl);
    });
}

function showMandatoryUpdate(version) {
    if (version) {
        if (updateVersionText) updateVersionText.textContent = 'v' + version;
        if (downloadingVersionText) downloadingVersionText.textContent = 'v' + version;
    }
    switchMandatoryState(stateAvailable);
    if (mandatoryScreen) {
        mandatoryScreen.classList.remove('hidden');
        void mandatoryScreen.offsetWidth;
        mandatoryScreen.classList.add('visible');
    }
    // Hide the web contents view so the mandatory update screen is interactive and blocking
    if (window.electronAPI && window.electronAPI.setViewVisible) {
        window.electronAPI.setViewVisible(false);
    }
}

if (btnMandatoryUpdate) {
    btnMandatoryUpdate.addEventListener('click', () => {
        switchMandatoryState(stateDownloading);
        if (progressFill) progressFill.style.width = '0%';
        if (progressPercent) progressPercent.textContent = '0%';
        if (progressStats) progressStats.textContent = 'Starting download…';
        if (progressSpeed) progressSpeed.textContent = 'Connecting…';
        if (window.electronAPI && window.electronAPI.startUpdateDownload) {
            window.electronAPI.startUpdateDownload();
        }
    });
}

if (btnMandatoryRetry) {
    btnMandatoryRetry.addEventListener('click', () => {
        switchMandatoryState(stateDownloading);
        if (progressFill) progressFill.style.width = '0%';
        if (progressPercent) progressPercent.textContent = '0%';
        if (progressStats) progressStats.textContent = 'Retrying download…';
        if (progressSpeed) progressSpeed.textContent = 'Connecting…';
        if (window.electronAPI && window.electronAPI.startUpdateDownload) {
            window.electronAPI.startUpdateDownload();
        }
    });
}

if (btnMandatoryRestart) {
    btnMandatoryRestart.addEventListener('click', () => {
        btnMandatoryRestart.disabled = true;
        btnMandatoryRestart.textContent = 'Restarting…';
        if (window.electronAPI && window.electronAPI.restartAndInstall) {
            window.electronAPI.restartAndInstall();
        }
    });
}

// ─── Update Toast elements (fallback) ─────────────────────────────────────────
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

function switchToastState(showEl) {
    [toastAvailable, toastDownloading, toastReady].forEach(el => {
        if (el) el.classList.toggle('hidden', el !== showEl);
    });
}

function showToast() {
    if (!updateToast) return;
    updateToast.classList.remove('hidden');
    void updateToast.offsetWidth;
    updateToast.classList.add('visible');
}

function hideToast() {
    if (!updateToast) return;
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

// 1. New version found → show mandatory update screen
window.electronAPI.onUpdateAvailable((info) => {
    showMandatoryUpdate(info.version);

    if (updateVersionBadge) updateVersionBadge.textContent = 'v' + info.version;
    switchToastState(toastAvailable);
});

// 2. Download in progress → update progress bar & stats
window.electronAPI.onUpdateProgress((progress) => {
    switchMandatoryState(stateDownloading);

    const pct = Math.min(progress.percent, 100);
    const transferred = formatBytes(progress.transferred);
    const total = formatBytes(progress.total);
    const speed = formatSpeed(progress.bytesPerSecond);

    if (progressFill) progressFill.style.width = pct + '%';
    if (progressPercent) progressPercent.textContent = pct + '%';
    if (progressStats) progressStats.textContent = `${transferred} / ${total}`;
    if (progressSpeed) progressSpeed.textContent = speed;

    // Also update toast if visible
    if (toastProgressFill) toastProgressFill.style.width = pct + '%';
    if (toastPercent) toastPercent.textContent = pct + '%';
    if (toastSpeed) toastSpeed.textContent = `${transferred} / ${total} · ${speed}`;
});

// 3. Download complete → show "Restart & Install" state and automatically apply
window.electronAPI.onUpdateDownloaded((info) => {
    switchMandatoryState(stateReady);
    switchToastState(toastReady);

    // Auto-restart after 1.5 seconds so user sees completion
    setTimeout(() => {
        if (window.electronAPI && window.electronAPI.restartAndInstall) {
            window.electronAPI.restartAndInstall();
        }
    }, 1500);
});

// 4. Update error → display error state on mandatory screen
window.electronAPI.onUpdateError((msg) => {
    console.warn('[Update] Error:', msg);
    switchMandatoryState(stateError);
    if (mandatoryErrorMsg) {
        mandatoryErrorMsg.textContent = msg || 'Could not download the update. Please check your connection and try again.';
    }
    hideToast();
});

// ─── Update Toast button actions ──────────────────────────────────────────────
if (btnStartDownload) {
    btnStartDownload.addEventListener('click', () => {
        showMandatoryUpdate();
        switchMandatoryState(stateDownloading);
        window.electronAPI.startUpdateDownload();
    });
}

if (btnDismissLater) {
    btnDismissLater.addEventListener('click', () => hideToast());
}

if (btnRestartInstall) {
    btnRestartInstall.addEventListener('click', () => {
        btnRestartInstall.disabled = true;
        btnRestartInstall.textContent = 'Restarting…';
        window.electronAPI.restartAndInstall();
    });
}

if (btnDismissReady) {
    btnDismissReady.addEventListener('click', () => hideToast());
}
