// =============================================================================
// ATLAS MAIN-CLIENT v.3.4
// Klient-only Electron — startar INTE server.js eller ngrok
// Ansluter mot extern server via SERVER_URL i config.json
// =============================================================================

const { app, BrowserWindow, ipcMain, globalShortcut, clipboard, session, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');
const os = require('os');

// GLOBAL STATE
let mainWindow = null;
let loaderWindow = null;
let config = {};

// Single Instance Lock
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
console.log('[SINGLE INSTANCE] En instans körs redan, avslutar...');
app.quit();
} else {
app.on('second-instance', () => {
if (mainWindow) {
if (mainWindow.isMinimized()) mainWindow.restore();
mainWindow.focus();
}
});
}

// PATH RESOLUTION HELPERS
function getRendererPath(filename) {
return app.isPackaged 
? path.join(process.resourcesPath, 'Renderer', filename)
: path.join(__dirname, 'Renderer', filename);
}

function getResourcePath(filename) {
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
} catch (e) { console.error("Config error", e); }
}

const envPath = getResourcePath('.env');
if (fs.existsSync(envPath)) dotenv.config({ path: envPath });

// WINDOW CREATION
function createLoaderWindow() {
let loaderPath = getRendererPath('loader.html');

loaderWindow = new BrowserWindow({
width: 300, height: 500, frame: false, transparent: true,
modal: true, resizable: false, backgroundColor: '#00000000',
icon: getRendererPath('assets/icons/app/icon.ico'),
webPreferences: { 
preload: fs.existsSync(path.join(__dirname, 'preload-loader.js')) 
? path.join(__dirname, 'preload-loader.js') 
: path.join(__dirname, 'preload.js'),
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

let indexPath = getRendererPath('index.html');

mainWindow = new BrowserWindow({
width: 1400, height: 1000, show: false,
icon: getRendererPath('assets/icons/app/icon.ico'),
autoHideMenuBar: true,
webPreferences: { 
preload: path.join(__dirname, 'preload.js'), 
contextIsolation: true, 
nodeIntegration: false,
sandbox: false
}
});

// CSP Header
session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
callback({
responseHeaders: {
...details.responseHeaders,
'Content-Security-Policy': [
"default-src 'self' 'unsafe-inline' data:; script-src 'self' 'unsafe-inline' 'unsafe-eval' https:; connect-src 'self' https://* wss://*; img-src 'self' data: http: https:;"
]
}
});
});

mainWindow.loadURL(`file://${indexPath}`);

mainWindow.once('ready-to-show', () => {
if (loaderWindow) { loaderWindow.close(); loaderWindow = null; }
mainWindow.show();
mainWindow.focus();
});

mainWindow.on('closed', () => {
mainWindow = null;
app.quit(); 
});
}

// APP LIFECYCLE
app.whenReady().then(async () => {
createLoaderWindow();

// Skicka server-ready direkt — ingen lokal server att vänta på
setTimeout(() => {
if (loaderWindow && !loaderWindow.isDestroyed()) {
loaderWindow.webContents.send('server-status', true);
}
}, 1500);

// Keyboard shortcuts
globalShortcut.register('Control+P', () => {
if (mainWindow) mainWindow.webContents.send('process-clipboard-text', clipboard.readText().trim(), true);
});
globalShortcut.register('Control+Alt+P', () => {
if (mainWindow) mainWindow.webContents.send('process-clipboard-text', clipboard.readText().trim(), false);
});
});

app.on('will-quit', () => globalShortcut.unregisterAll());
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });

// =========================================================================
// IPC HANDLERS
// =========================================================================

// get-app-info — skickar SERVER_URL från config.json till renderer
ipcMain.handle('get-app-info', async () => {
return {
CLIENT_API_KEY: config.CLIENT_API_KEY,
APP_NAME: config.APP_NAME,
ATLAS_VERSION: config.VERSION || '3.4',
SERVER_VERSION: 'Extern server',
SERVER_URL: config.SERVER_URL || null
};
});

// Templates
ipcMain.handle('load-templates', async () => []);
ipcMain.handle('save-templates', async () => ({ success: true }));
ipcMain.handle('delete-template', async () => ({ success: true }));

// QA
ipcMain.handle('save-qa', async () => ({ success: true }));
ipcMain.handle('load-qa-history', async () => []);
ipcMain.handle('delete-qa', async () => ({ success: true }));
ipcMain.handle('update-qa-archived-status', async () => ({ success: true }));

// Team
ipcMain.handle('team:fetch-inbox', async () => ({ tickets: [] }));
ipcMain.handle('team:claim-ticket', async () => ({ success: true }));

// Övrigt
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