//===========================================================
//========= LOADER.JS v.3.0.0 ======//
//===========================================================
document.addEventListener("DOMContentLoaded", () => {
const red = document.getElementById("light-red");
const yellow = document.getElementById("light-yellow");
const green = document.getElementById("light-green");
const text = document.getElementById("loader-text");

console.log("🔵 Loader.js: DOMContentLoaded event triggered");
console.log("✓ DOM element references loaded:", { red, yellow, green, text });

let animationFinished = false;
let serverIsReady = false;

const tryFinish = () => {
console.log(`🔍 tryFinish() called: animationFinished=${animationFinished}, serverIsReady=${serverIsReady}`);
if (animationFinished && serverIsReady) {
console.log("🟢 ALL SYSTEMS GO! Closing loader in 800ms...");
text.textContent = "NU KÖR VI!";
setTimeout(() => {
if (window.electronAPI && window.electronAPI.loaderDone) {
console.log("📤 Sending loader:done signal to main process");
window.electronAPI.loaderDone();
} else {
console.log("❌ ERROR: window.electronAPI.loaderDone not available");
}
}, 800);
} else {
console.log(`⏳ Waiting for: animation=(${animationFinished}) + server=(${serverIsReady})`);
}
};

// ESC-tangent för MANUELL stängning (debug)
document.addEventListener('keydown', (e) => {
if (e.key === 'Escape') {
console.log("🛑 ESC pressed - manually closing loader (DEBUG MODE)");
if (window.electronAPI && window.electronAPI.loaderDone) {
window.electronAPI.loaderDone();
} else {
console.log("❌ Cannot close: window.electronAPI.loaderDone not available");
}
}
});

if (window.electronAPI && window.electronAPI.onServerStatus) {
console.log("✓ Server status listener registered");
window.electronAPI.onServerStatus((status) => {
console.log(`📡 Server status received: ${status}`);
if (status === true) {
serverIsReady = true;
tryFinish();
}
});
} else {
console.log("❌ ERROR: window.electronAPI.onServerStatus not available");
}

// --- ANIMATIONS-SEKVENS (Långsammare) ---
// Rött direkt
setTimeout(() => {
console.log("🔴 RED: Søker efter satelliter...");
red.classList.add("active");
text.textContent = "Söker efter satelliter...";
}, 500);

// Växla till Orange efter 2 sekunder (tidigare 1.3s)
setTimeout(() => {
console.log("🟠 YELLOW: Värmer upp motorn...");
red.classList.remove("active");
yellow.classList.add("active");
text.textContent = "Värmer upp motorn...";
}, 2500);

// Växla till "Väntar på tunnel" efter ytterligare 2.5 sekunder
setTimeout(() => {
console.log("🟢 GREEN: Öppnar säker tunnel... Waiting for server signal");
yellow.classList.remove("active");
green.classList.add("active");
text.textContent = "Öppnar säker tunnel..."; 
animationFinished = true;
tryFinish(); // Kolla om server redan är redo
}, 5000);
});