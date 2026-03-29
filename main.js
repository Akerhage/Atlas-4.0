// ============================================
// main.js — Electron Main Process
// VAD DEN GÖR: Startar Electron-fönstret,
//              laddar renderer, hanterar
//              app-livscykel
// ANVÄNDS AV: Electron runtime
// ============================================

const { app, BrowserWindow, ipcMain, globalShortcut, clipboard, session, nativeImage, Tray, Menu } = require('electron');
const path = require('path');
const { spawn, exec } = require('child_process');
const fs = require('fs');
const dotenv = require('dotenv');
const os = require('os');

// DATABASE CONNECTION
let dbFuncs = {};
try {
dbFuncs = require('./db');
} catch (e) {
console.error("CRITICAL: Kunde inte ladda db.js", e);
}

// GLOBAL STATE & CONFIGURATION

// Server Readiness State
let serverVersion = 'Väntar...';
let serverReady = false;
let tray = null;
let forceQuit = false;
let pendingCredentials = null; // Token + user från loader, injiceras i main-fönstret via preload.js

// Single Instance Lock & Server Detection
const isServerProcess = process.argv.includes(path.join(__dirname, 'server.js'));

if (!isServerProcess) {
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
}

// Window & Process References
let loaderWindow = null;
let mainWindow = null;
let serverProcess = null;
let config = {};
const SERVER_PORT = 3001;

// PATH RESOLUTION HELPERS
function getRendererPath(filename) {
return app.isPackaged 
? path.join(process.resourcesPath, 'Renderer', filename)
: path.join(__dirname, 'Renderer', filename);
}

function getLocalPath(filename) {
return path.join(__dirname, filename);
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
// Load .env File
const envPath = getResourcePath('.env');
if (fs.existsSync(envPath)) dotenv.config({ path: envPath });

// killPort3001 - Dödar ngrok och frigör port 3001 innan serverstart.
function killPort3001() {
return new Promise(resolve => {
// 1. REPLIKERA .BAT: Döda ALLA ngrok-processer först (viktigt för fasta domäner)
const killNgrokCmd = process.platform === 'win32' ? 'taskkill /F /IM ngrok.exe /T' : 'pkill ngrok';

exec(killNgrokCmd, () => {
// 2. När ngrok är borta, kolla om port 3001 är upptagen
const cmd = process.platform === 'win32' 
? `netstat -ano | findstr :${SERVER_PORT}` 
: `lsof -i tcp:${SERVER_PORT} -t`;

exec(cmd, (err, stdout) => {
if (stdout) {
const pid = process.platform === 'win32' ? stdout.match(/LISTENING\s+(\d+)/)?.[1] : stdout.trim();
if (pid) exec(process.platform === 'win32' ? `taskkill /F /PID ${pid}` : `kill -9 ${pid}`, () => resolve());
else resolve();
} else resolve();
      });
    });
  });
}

// getAuthHeaders - Bygger auth-headers beroende på om TEAM_USER/TEAM_PASS eller CLIENT_API_KEY används
function getAuthHeaders() {
const headers = { 'Content-Type': 'application/json' };
if (process.env.TEAM_USER && process.env.TEAM_PASS) {
const authString = Buffer.from(`${process.env.TEAM_USER}:${process.env.TEAM_PASS}`).toString('base64');
headers['Authorization'] = `Basic ${authString}`;
} else if (config.CLIENT_API_KEY) {
headers['x-api-key'] = config.CLIENT_API_KEY;
}
return headers;
}

// WINDOW CREATION
function createLoaderWindow() {
let loaderPath = getRendererPath('loader.html');
if (!fs.existsSync(loaderPath)) loaderPath = getLocalPath('loader.html');

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

loaderWindow.on('closed', () => {
loaderWindow = null;
});
}

// createMainWindow - Main Application Window
function createMainWindow() {
if (mainWindow) return;

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
contextIsolation: true,
nodeIntegration: false,
sandbox: false,
backgroundThrottling: false
}
});

// CSP Header Override — tillåt localhost:3001 + ngrok för React app
session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
callback({
responseHeaders: {
...details.responseHeaders,
'Content-Security-Policy': [
"default-src 'self' 'unsafe-inline' data: http://localhost:3001; script-src 'self' 'unsafe-inline' 'unsafe-eval' http://localhost:3001; connect-src 'self' http://localhost:* ws://localhost:* https://*.ngrok-free.dev wss://*.ngrok-free.dev; img-src 'self' data: http: https:; style-src 'self' 'unsafe-inline' http://localhost:3001;"
]
}
});
});

// Ladda React-appen via HTTP istället för file:// — eliminerar IPC-behovet
mainWindow.loadURL(`http://localhost:${SERVER_PORT}`);

// Window Lifecycle Events
mainWindow.once('ready-to-show', () => {
if (loaderWindow) { 
loaderWindow.close(); 
loaderWindow = null; 
}
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

// Stängnings-hanterare för .bat-filen
mainWindow.on('closed', () => {
mainWindow = null;
});
}

// =========================================================================
// APP LIFECYCLE & SERVER STARTUP
// =========================================================================
app.whenReady().then(async () => {
if (isServerProcess) return;

createLoaderWindow();

// Tray-ikon
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
await killPort3001(); // Denna kör taskkill /F /IM ngrok.exe /T

// Starta ngrok-tunnel mot port 3001
const TOKEN = process.env.NGROK_TOKEN;
const DOMAIN = process.env.NGROK_DOMAIN;
const NGROK_BIN = app.isPackaged
? path.join(process.resourcesPath, 'ngrok.exe')
: path.join(__dirname, 'ngrok.exe');

console.log(`[NGROK] Konfigurering: TOKEN=${TOKEN ? '✓' : '✗'}, DOMAIN=${DOMAIN ? '✓' : '✗'}, BIN=${NGROK_BIN}`);

if (TOKEN && DOMAIN) {
// 1. Sätta authtoken direkt med lokal ngrok.exe
console.log("[NGROK] Steg 1: Sätter authtoken med lokal ngrok.exe...");
exec(`"${NGROK_BIN}" config add-authtoken ${TOKEN}`, (err, stdout, stderr) => {
if (err) {
console.error("❌ [NGROK] Kunde inte sätta authtoken:", err.message);
if (stderr) console.error("   STDERR:", stderr);
} else {
console.log("✅ [NGROK] Authtoken inställt");
// 2. Starta tunneln (SYNLIGT FÖNSTER FÖR DEBUG)
console.log(`[NGROK] Steg 2: Startar tunnel med domain ${DOMAIN}...`);
exec(`start "Atlas_Ngrok" cmd /c "${NGROK_BIN}" http --domain=${DOMAIN} 3001`, (err, stdout, stderr) => {
if (err) {
console.error("❌ [NGROK] Kunde inte starta ngrok:", err.message);
if (stderr) console.error("   STDERR:", stderr);
} else {
console.log("✅ [NGROK] Tunnel-process startad");
}
});
}
});
} else {
console.log("⚠️  [NGROK] NGROK_TOKEN eller NGROK_DOMAIN saknas - Atlas körs på localhost");
}

// Server Startup
const serverPath = path.join(__dirname, 'server.js');

// Sätter roten till mappen där .exe-filen ligger (vid bygge) eller projektmappen (vid dev)
const rootPath = app.isPackaged 
? path.dirname(app.getPath('exe')) 
: __dirname;

const serverEnv = {
...process.env,
NODE_ENV: 'production',
IS_PACKAGED: app.isPackaged ? 'true' : 'false',
PORT: String(SERVER_PORT),
ATLAS_ROOT_PATH: rootPath, // Viktigt för db.js
ELECTRON_RUN_AS_NODE: '1'
};

serverProcess = spawn(process.execPath, [serverPath], {
cwd: __dirname,
env: serverEnv,
stdio: ['pipe', 'pipe', 'pipe'],
windowsHide: true
});

serverProcess.stdout.on('data', d => {
const out = d.toString().trim();
console.log(`[Server]: ${out}`);

// Detekterar "ONLINE"-signal från server och informerar loader-fönstret
if (out.includes("ONLINE")) {
serverReady = true;
if (loaderWindow && !loaderWindow.isDestroyed()) {
loaderWindow.webContents.send('server-status', true);
}
} else if (out.includes("error") || out.includes("ERROR") || out.includes("fail")) {
console.log("🔴 SERVER ERROR: " + out);
}
});

serverProcess.stderr.on('data', d => {
console.error(`[Server Error]: ${d.toString().trim()}`);
});

// Global Keyboard Shortcuts
globalShortcut.register('Control+P', () => {
if (mainWindow) mainWindow.webContents.send('process-clipboard-text', clipboard.readText().trim(), true);
});

globalShortcut.register('Control+Alt+P', () => {
if (mainWindow) mainWindow.webContents.send('process-clipboard-text', clipboard.readText().trim(), false);
});
});

// SHUTDOWN & CLEANUP

let isTerminating = false; // Spärr för att undvika dubbelkörning

// terminateServerProcess - Kill Backend & Cleanup
function terminateServerProcess() {
if (isTerminating) return; // Om vi redan städar, gör inget
isTerminating = true;      // Lås dörren

// 1. Döda Node-servern (server.js)
if (serverProcess) {
console.log('[MAIN] Dödar serverProcess...');
serverProcess.kill('SIGTERM');
serverProcess = null;
}

// 2. Döda Ngrok (Tvinga ner processen)
console.log('[MAIN] Städar upp Ngrok...');
try {
if (process.platform === 'win32') {
exec('taskkill /F /IM ngrok.exe /T', (err) => {});
} else {
exec('pkill ngrok');
}
} catch (e) {
console.error("Kunde inte döda ngrok:", e);
}

globalShortcut.unregisterAll();
}

// App Lifecycle Events
app.on('will-quit', terminateServerProcess);

app.on('window-all-closed', () => {
terminateServerProcess();
// Appen lever kvar i tray — avslutar inte automatiskt
});

process.on('exit', terminateServerProcess);

process.on('SIGINT', () => {
terminateServerProcess();
process.exit();
});


// =========================================================================
// IPC HANDLERS (BRIDGE & DATA)
// =========================================================================

// get-app-info - Return Version & Config to Renderer
ipcMain.handle('get-app-info', async () => {
// Vänta på att serverReady blir true (max 2 sekunder)
let attempts = 0;
while (!serverReady && attempts < 20) { 
await new Promise(r => setTimeout(r, 100)); 
attempts++;
}

return {
CLIENT_API_KEY: config.CLIENT_API_KEY,
APP_NAME: config.APP_NAME,
ATLAS_VERSION: config.VERSION || '4.0',
SERVER_VERSION: serverVersion,
SERVER_URL: config.SERVER_URL || 'http://localhost:3001'
};
});

// load-templates - Fetch All Templates from Database
ipcMain.handle('load-templates', async () => {
try { 
if (dbFuncs.getAllTemplates) {
return await dbFuncs.getAllTemplates();
}
return [];
} catch (err) {
console.error('[IPC] load-templates misslyckades:', err);
return [];
}
});

// save-templates - Save Multiple Templates to Database
ipcMain.handle('save-templates', async (_, templates) => {
try { 
if (dbFuncs.saveTemplate) {
for (const t of templates) {
await dbFuncs.saveTemplate(t);
}
return { success: true };
}
return { success: false, error: "DB func missing" };
} catch (err) {
return { success: false, error: err.message };
}
});

// delete-template - Remove Template from Database
ipcMain.handle('delete-template', async (_, templateId) => {
try {
if (dbFuncs.deleteTemplate) {
await dbFuncs.deleteTemplate(templateId);
return { success: true };
}
return { success: false, error: "DB func missing" };
} catch (err) {
return { success: false, error: err.message };
}
});

// INKORG & LOKAL HISTORIK (SQLite)

// save-qa - Save Message to Local Inbox
ipcMain.handle('save-qa', async (_, qaItem) => {
try {
if (dbFuncs.saveLocalQA) {
await dbFuncs.saveLocalQA(qaItem);
return { success: true };
}
return { success: false };
} catch (err) { return { success: false, error: err.message }; }
});

// load-qa-history - Fetch All Messages (Inbox & Archive)
ipcMain.handle('load-qa-history', async () => {
try {
if (dbFuncs.getLocalQAHistory) {
return await dbFuncs.getLocalQAHistory();
}
return [];
} catch (err) { return []; }
});

// delete-qa - Permanently Delete Message from Database
ipcMain.handle('delete-qa', async (_, qaId) => {
try {
if (dbFuncs.deleteLocalQA) {
await dbFuncs.deleteLocalQA(qaId);
return { success: true };
}
return { success: false };
} catch (err) { return { success: false, error: err.message }; }
});

// update-qa-archived-status - Move Message Between Inbox/Archive
ipcMain.handle('update-qa-archived-status', async (_, { id, status }) => {
try {
if (dbFuncs.updateQAArchivedStatus) {
await dbFuncs.updateQAArchivedStatus(id, status);
return { success: true };
}
return { success: false, error: "DB function missing" };
} catch (err) { 
return { success: false, error: err.message }; 
}
});

// TEAM-FUNKTIONER (Live-kö mot Server)

// team:fetch-inbox - Fetch Pending Customer Tickets from Server
ipcMain.handle('team:fetch-inbox', async () => {
try {
const res = await fetch(`http://localhost:${SERVER_PORT}/team/inbox`, { 
method: 'GET', 
headers: getAuthHeaders() 
});
if(!res.ok) throw new Error('Kunde inte hämta inkorg');
return await res.json();
} catch (err) { 
console.error('[Team Inbox] Error:', err); 
return { tickets: [] }; 
}
});

// team:claim-ticket - Claim Ticket from Queue
ipcMain.handle('team:claim-ticket', async (_, ticketId, agentName) => {
try {
const body = JSON.stringify({ 
conversationId: ticketId,
agentName: agentName 
});

const res = await fetch(`http://localhost:${SERVER_PORT}/team/claim`, { 
method: 'POST', 
headers: getAuthHeaders(), 
body 
});

if(!res.ok) throw new Error('Failed to claim ticket');
return await res.json();
} catch (err) { 
console.error('[Team Claim] Error:', err); 
throw err; 
}
});

// ÖVRIGA VERKTYG

// Skriv text till datorns urklipp
ipcMain.handle('clipboard:write', (_, text) => { 
clipboard.writeText(text); 
return true; 
});

// get-system-username - Hämtar inloggat OS-användarnamn
ipcMain.handle('get-system-username', () => {
return os.userInfo().username || 'Agent';
});

// force-copy-to-clipboard - Tvingad kopiering (fokus-oberoende)
ipcMain.on('force-copy-to-clipboard', (event, text) => {
clipboard.writeText(text);
});

// force-copy-html-to-clipboard - Kopierar Rich Text (HTML) till urklipp
ipcMain.on('force-copy-html-to-clipboard', (event, { html, text }) => {
clipboard.write({
html: html,
text: text
});
});

// TASKBAR BADGE (WINDOWS OVERLAY)
ipcMain.on('set-taskbar-icon', (event, dataUrl, text) => {
if (!mainWindow) return;

try {
if (dataUrl) {
// Skapa bild från data-strängen och sätt som overlay
const img = nativeImage.createFromDataURL(dataUrl);
mainWindow.setOverlayIcon(img, text);
} else {
// Rensa overlay om ingen data skickas
mainWindow.setOverlayIcon(null, '');
}
} catch (err) {
console.error("Failed to set overlay icon:", err);
}
});

// LOADER COMPLETION SIGNAL

// Tar emot token + user från loader efter lyckad inloggning
// Loggar ut — förstör main-fönstret och öppnar loader för ny inloggning
ipcMain.on('app:logout', () => {
if (mainWindow && !mainWindow.isDestroyed()) {
mainWindow.destroy();
mainWindow = null;
}
createLoaderWindow();
// Skicka server-status igen när loader-fönstret är redo
loaderWindow.webContents.once('did-finish-load', () => {
setTimeout(() => {
if (loaderWindow && !loaderWindow.isDestroyed()) {
loaderWindow.webContents.send('server-status', true);
}
}, 200);
});
});

ipcMain.on('loader:login-success', (_, { token, user }) => {
console.log('[Main] Credentials mottagna från loader.');
pendingCredentials = { token, user };
});

// Anropas synkront av preload.js INNAN sidans JS startar — garanterar att
// checkAuth() i renderer.js hittar token utan att visa login-modalen.
ipcMain.on('get-pending-credentials', (event) => {
event.returnValue = pendingCredentials || null;
pendingCredentials = null;
});

ipcMain.on('loader:done', () => {
if (loaderWindow && !loaderWindow.isDestroyed()) {
loaderWindow.close();
}
createMainWindow();
});