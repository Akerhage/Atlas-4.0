// ============================================
// preload.js
// VAD DEN GÖR: Exponerar Electron IPC-kanaler till renderer-processen via contextBridge.
//              Tillgängliggör window.electronAPI (clipboard, mallar, badges) och
//              window.atlasTeam (inbox, claim) i webbkontexten.
// ANVÄNDS AV: Renderer/renderer.js, Renderer/modules/* (via window.electronAPI / window.atlasTeam)
// ============================================

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {

// === App Info ===
getAppInfo: () => ipcRenderer.invoke('get-app-info'),

// === System & Urklipp ===
copyToClipboard: (text) => ipcRenderer.invoke('clipboard:write', text),

// Tvingar kopiering oavsett fönsterfokus
send: (channel, data) => ipcRenderer.send(channel, data),

// Hämtar Windows-användarnamn
getSystemUsername: () => ipcRenderer.invoke('get-system-username'),

onProcessClipboard: (callback) => {
const subscription = (_event, text, shouldClear) => callback(text, shouldClear);
ipcRenderer.on('process-clipboard-text', subscription);
return () => ipcRenderer.removeListener('process-clipboard-text', subscription);
},

// === Mallar (Databas) ===
loadTemplates: () => ipcRenderer.invoke('load-templates'),
saveTemplates: (templates) => ipcRenderer.invoke('save-templates', templates),
deleteTemplate: (templateId) => ipcRenderer.invoke('delete-template', templateId),

// === Inkorg / QA History (Databas) ===
saveQA: (qaItem) => ipcRenderer.invoke('save-qa', qaItem),
loadQAHistory: () => ipcRenderer.invoke('load-qa-history'),
deleteQA: (qaId) => ipcRenderer.invoke('delete-qa', qaId),

// Arkivera-knappen
updateQAArchivedStatus: (id, status) => ipcRenderer.invoke('update-qa-archived-status', { id, status }),

// Skicka ikon-data till Windows aktivitetsfält
setTaskbarIcon: (dataUrl, text) => ipcRenderer.send('set-taskbar-icon', dataUrl, text)
});

// === TEAM / LIVE KÖ ===
contextBridge.exposeInMainWorld('atlasTeam', {
fetchInbox: () => ipcRenderer.invoke('team:fetch-inbox'),
claimTicket: (id, agentName) => ipcRenderer.invoke('team:claim-ticket', id, agentName)
});