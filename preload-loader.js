//=========================================================================================
//PRELOAD-LOADER - Version 3.4 - DEBUGGING
//=========================================================================================

const { contextBridge, ipcRenderer } = require('electron');

console.log("[Preload-Loader] Script initialized");

contextBridge.exposeInMainWorld('electronAPI', {

// Din befintliga funktion
onServerStatus: (callback) => {
console.log("[Preload-Loader] onServerStatus listener registered");
ipcRenderer.on('server-status', (event, status) => {
console.log(`[Preload-Loader] Forwarding server-status to renderer: ${status}`);
callback(status);
});
},

// 👉 Detta är det ENDA som behövs för att starta Atlas omedelbart vid GRÖNT
loaderDone: () => {
console.log("[Preload-Loader] loaderDone() called - sending to main process");
ipcRenderer.send('loader:done');
}
});

console.log("[Preload-Loader] contextBridge exposed successfully");

