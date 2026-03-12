// ============================================
// main-client.js
// VAD DEN GÖR: Klient-only Electron-app. Skapar loader- och huvudfönster,
//              hanterar IPC-bryggor och ansluter mot extern server via SERVER_URL.
// ANVÄNDS AV: Electron (entry point för klientbygget via electron-builder-client.json)
// ============================================

const { app, BrowserWindow, ipcMain, globalShortcut, clipboard, session, nativeImage, Tray, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');
const os = require('os');

// GLOBAL STATE
let mainWindow = null;
let loaderWindow = null;
let tray = null;
let forceQuit = false;
let config = {};

// Single Instance Lock
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

// =============================================================================
// PATH RESOLUTION HELPERS (Fixade för ASAR)
// =============================================================================

function getRendererPath(filename) {
    // VIKTIGT: Renderer-mappen ligger packad INUTI app.asar.
    // __dirname pekar på roten inuti asar-filen när appen körs.
    return path.join(__dirname, 'Renderer', filename);
}

function getResourcePath(filename) {
    // VIKTIGT: .env och config.json ligger i /resources UTANFÖR asar-filen
    // tack vare extraResources i electron-builder-client.json.
    return app.isPackaged 
        ? path.join(process.resourcesPath, filename)
        : path.join(__dirname, filename);
}

// Miljöinställningar
process.env.LANG = 'sv_SE.UTF-8';
process.env.NODE_NO_WARNINGS = '1';

// Ladda Config & Env
const configPath = getResourcePath('config.json');
if (fs.existsSync(configPath)) {
    try {
        config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        console.log("✅ Config laddad från:", configPath);
    } catch (e) { console.error("❌ Config error", e); }
}

const envPath = getResourcePath('.env');
if (fs.existsSync(envPath)) dotenv.config({ path: envPath });

// =============================================================================
// WINDOW CREATION
// =============================================================================

function createLoaderWindow() {
    const loaderPath = getRendererPath('loader.html');
    
    loaderWindow = new BrowserWindow({
        width: 300, height: 500, frame: false, transparent: true,
        modal: true, resizable: false, backgroundColor: '#00000000',
        icon: getRendererPath('assets/icons/app/icon.ico'),
        webPreferences: { 
            // Preload-filen ligger i samma mapp som main-client.js
            preload: path.join(__dirname, 'preload-loader.js'),
            contextIsolation: true, 
            nodeIntegration: false,
            sandbox: false
        }
    });

    loaderWindow.loadURL(`file://${loaderPath}`);
    loaderWindow.on('closed', () => { loaderWindow = null; });
}

function createMainWindow() {
    if (mainWindow) return;

    const indexPath = getRendererPath('index.html');

    mainWindow = new BrowserWindow({
        width: 1600, height: 950,
        minWidth: 1280, minHeight: 760,
        center: true,
        show: false,
        icon: getRendererPath('assets/icons/app/icon.ico'),
        autoHideMenuBar: true,
        titleBarStyle: 'hidden',
        titleBarOverlay: { color: '#0a0f1a', symbolColor: '#00d4b4', height: 36 },
        webPreferences: { 
            preload: path.join(__dirname, 'preload.js'), 
            contextIsolation: true, 
            nodeIntegration: false,
            sandbox: false,
            backgroundThrottling: false
        }
    });

    // CSP Header Override — tillåter anslutning mot VPS (atlas-support.se) och lokal dev
    const serverOrigin = (config.SERVER_URL || 'https://atlas-support.se').replace(/\/$/, '');
    const serverWss = serverOrigin.replace(/^https/, 'wss').replace(/^http/, 'ws');
    session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
        callback({
            responseHeaders: {
                ...details.responseHeaders,
                'Content-Security-Policy': [
                    "default-src 'self' 'unsafe-inline' data:; " +
                    `script-src 'self' 'unsafe-inline' 'unsafe-eval' ${serverOrigin} https://*.ngrok-free.dev https://cdn.socket.io; ` +
                    `connect-src 'self' ${serverOrigin} ${serverWss} https://*.ngrok-free.dev wss://*.ngrok-free.dev ws://localhost:* http://localhost:*; ` +
                    "img-src 'self' data: http: https:;"
                ]
            }
        });
    });

    mainWindow.loadURL(`file://${indexPath}`);

    mainWindow.once('ready-to-show', () => {
        if (loaderWindow) { loaderWindow.close(); loaderWindow = null; }
        mainWindow.show();
        mainWindow.focus();
        // Lås zoom — förhindrar att Ctrl+scroll förstör layouten
        mainWindow.webContents.setVisualZoomLevelLimits(1, 1);
    });

    // Stäng till tray istället för att avsluta helt
    mainWindow.on('close', (e) => {
        if (!forceQuit) {
            e.preventDefault();
            mainWindow.hide();
        }
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

// =============================================================================
// APP LIFECYCLE
// =============================================================================

app.whenReady().then(async () => {
    createLoaderWindow();

    // Tray-ikon — använder samma ikon som fönstret
    const iconPath = getRendererPath('assets/icons/app/icon.ico');
    tray = new Tray(nativeImage.createFromPath(iconPath));
    tray.setToolTip('Atlas');
    const trayMenu = Menu.buildFromTemplate([
        { label: 'Öppna Atlas', click: () => { if (mainWindow) { mainWindow.show(); mainWindow.focus(); } } },
        { type: 'separator' },
        { label: 'Avsluta Atlas', click: () => { forceQuit = true; app.quit(); } }
    ]);
    tray.setContextMenu(trayMenu);
    tray.on('click', () => {
        if (mainWindow) {
            if (mainWindow.isVisible()) { mainWindow.focus(); }
            else { mainWindow.show(); mainWindow.focus(); }
        }
    });

    // Triggar server-ready efter 1.5 sekunder för att simulera nätverkscheck
    setTimeout(() => {
        if (loaderWindow && !loaderWindow.isDestroyed()) {
            loaderWindow.webContents.send('server-status', true);
        }
    }, 1500);

    // Globala genvägar
    globalShortcut.register('Control+P', () => {
        if (mainWindow) mainWindow.webContents.send('process-clipboard-text', clipboard.readText().trim(), true);
    });
});

app.on('will-quit', () => globalShortcut.unregisterAll());
app.on('window-all-closed', () => { /* Appen lever kvar i tray — inget här */ });

// =============================================================================
// IPC HANDLERS
// =============================================================================

ipcMain.handle('get-app-info', async () => {
    return {
        CLIENT_API_KEY: config.CLIENT_API_KEY,
        APP_NAME: config.APP_NAME,
        ATLAS_VERSION: config.VERSION || '4.0',
        SERVER_VERSION: 'Extern server (Ngrok)',
        SERVER_URL: config.SERVER_URL || (() => {
            console.error('❌ KRITISKT: SERVER_URL saknas i config.json — klienten vet inte var servern är!');
            return null;
        })()
    };
});

// Bryggor för att förhindra krascher i Renderer
ipcMain.handle('load-templates', async () => []);
ipcMain.handle('save-templates', async () => ({ success: true }));
ipcMain.handle('delete-template', async () => ({ success: true }));
ipcMain.handle('save-qa', async () => ({ success: true }));
ipcMain.handle('load-qa-history', async () => []);
ipcMain.handle('delete-qa', async () => ({ success: true }));
ipcMain.handle('update-qa-archived-status', async () => ({ success: true }));
ipcMain.handle('team:fetch-inbox', async () => ({ tickets: [] }));
ipcMain.handle('team:claim-ticket', async () => ({ success: true }));

ipcMain.handle('clipboard:write', (_, text) => { clipboard.writeText(text); return true; });
ipcMain.handle('get-system-username', () => os.userInfo().username || 'Agent');
ipcMain.on('force-copy-to-clipboard', (_, text) => clipboard.writeText(text));
ipcMain.on('force-copy-html-to-clipboard', (_, { html, text }) => clipboard.write({ html, text }));

ipcMain.on('set-taskbar-icon', (_, dataUrl, text) => {
    if (!mainWindow) return;
    try {
        if (dataUrl) mainWindow.setOverlayIcon(nativeImage.createFromDataURL(dataUrl), text);
        else mainWindow.setOverlayIcon(null, '');
    } catch (err) { console.error("Failed to set overlay icon:", err); }
});

ipcMain.on('loader:done', () => {
    if (loaderWindow && !loaderWindow.isDestroyed()) loaderWindow.close();
    createMainWindow();
});