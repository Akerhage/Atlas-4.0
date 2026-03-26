// ============================================
// preload-loader.js
// VAD DEN GÖR: Preload-skript för loader-fönstret. Exponerar server-status-lyssnare,
//              loaderDone(), getAppInfo() och loginSuccess() via contextBridge.
// ANVÄNDS AV: main.js / main-client.js (webPreferences.preload för loaderWindow)
// ============================================

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {

  onServerStatus: (callback) => {
    ipcRenderer.on('server-status', (event, status) => {
      callback(status);
    });
  },

  loaderDone: () => {
    ipcRenderer.send('loader:done');
  },

  // Hämtar SERVER_URL och övrig config från main.js / main-client.js
  getAppInfo: () => ipcRenderer.invoke('get-app-info'),

  // Skickar inloggad token + user till main.js som injicerar dem
  // i main-fönstrets localStorage via preload.js
  loginSuccess: (token, user) => ipcRenderer.send('loader:login-success', { token, user })

});