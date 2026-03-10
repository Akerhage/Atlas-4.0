// ============================================
// preload-loader.js
// VAD DEN GÖR: Preload-skript för loader-fönstret. Exponerar server-status-lyssnare
//              och loaderDone() via contextBridge.
// ANVÄNDS AV: main.js / main-client.js (webPreferences.preload för loaderWindow)
// ============================================

const { contextBridge, ipcRenderer } = require('electron');

console.log("[Preload-Loader] Script initialized");

contextBridge.exposeInMainWorld('electronAPI', {

onServerStatus: (callback) => {
console.log("[Preload-Loader] onServerStatus listener registered");
ipcRenderer.on('server-status', (event, status) => {
console.log(`[Preload-Loader] Forwarding server-status to renderer: ${status}`);
callback(status);
});
},

loaderDone: () => {
console.log("[Preload-Loader] loaderDone() called - sending to main process");
ipcRenderer.send('loader:done');
}
});

console.log("[Preload-Loader] contextBridge exposed successfully");

