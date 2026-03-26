//===========================================================
//========= LOADER.JS v.4.1.2 ======//
//===========================================================
document.addEventListener("DOMContentLoaded", () => {
const dRed    = document.getElementById("light-red");
const dYellow = document.getElementById("light-yellow");
const dGreen  = document.getElementById("light-green");
const text    = document.getElementById("loader-text");
const fill    = document.getElementById("progress-fill");

const loginBtn   = document.getElementById("login-btn");
const loginUser  = document.getElementById("login-username");
const loginPass  = document.getElementById("login-password");
const loginError = document.getElementById("login-error");

let animationFinished = false;
let serverIsReady     = false;
let serverUrl         = 'https://atlas-support.se'; // Skrivs över av getAppInfo

// ── Hjälpfunktioner ──────────────────────────────────
const setProgress = (pct) => { if (fill) fill.style.width = pct + '%'; };
const setStatus   = (msg) => { if (text) text.textContent = msg; };

const showError = (msg) => {
if (!loginError) return;
loginError.textContent = msg;
loginError.classList.add("visible");
};
const clearError = () => {
if (!loginError) return;
loginError.textContent = '';
loginError.classList.remove("visible");
};

// Aktiverar login-knappen när både animation och server är klara
const tryEnableLogin = () => {
if (animationFinished && serverIsReady) {
if (loginBtn) loginBtn.disabled = false;
setStatus("Redo.");
setProgress(100);
}
};

// ── Hämta SERVER_URL från config.json via main-client.js ──
if (window.electronAPI?.getAppInfo) {
window.electronAPI.getAppInfo().then(info => {
if (info?.SERVER_URL) {
serverUrl = info.SERVER_URL.replace(/\/$/, '');
console.log("[Loader] SERVER_URL:", serverUrl);
}
});
}

// ── ESC — manuell stängning (debug) ──────────────────
document.addEventListener('keydown', (e) => {
if (e.key === 'Escape' && window.electronAPI?.loaderDone) {
window.electronAPI.loaderDone();
}
if (e.key === 'Enter' && !loginBtn?.disabled) {
handleLogin();
}
});

// ── IPC: server-signal ───────────────────────────────
if (window.electronAPI?.onServerStatus) {
window.electronAPI.onServerStatus((status) => {
if (status === true) {
serverIsReady = true;
tryEnableLogin();
}
});
}

// ── Inloggningslogik ─────────────────────────────────
async function handleLogin() {
if (loginBtn?.disabled) return;
clearError();

const username = loginUser?.value.trim();
const password = loginPass?.value;

if (!username || !password) {
showError("Fyll i användarnamn och lösenord.");
return;
}

loginBtn.disabled = true;
const btnText = document.getElementById("login-btn-text");
if (btnText) btnText.textContent = "Loggar in...";

try {
const res = await fetch(`${serverUrl}/api/auth/login`, {
method: "POST",
headers: { "Content-Type": "application/json" },
body: JSON.stringify({ username, password })
});

const data = await res.json().catch(() => ({}));

if (res.ok && data.token) {
setStatus("Välkommen!");
setProgress(100);

// Skicka token + user till main-client.js via IPC.
// main-client.js injicerar dem i main-fönstrets localStorage (atlas-support.se origin)
// så att renderer.js hittar dem direkt vid checkAuth().
if (window.electronAPI?.loginSuccess) {
window.electronAPI.loginSuccess(data.token, data.user);
}

setTimeout(() => {
if (window.electronAPI?.loaderDone) window.electronAPI.loaderDone();
}, 400);

} else {
const msg = data.error || data.message || "Fel användarnamn eller lösenord.";
showError(msg);
loginBtn.disabled = false;
if (btnText) btnText.textContent = "Logga in";
}
} catch (err) {
showError("Kunde inte nå servern. Försök igen.");
loginBtn.disabled = false;
if (btnText) btnText.textContent = "Logga in";
}
}

if (loginBtn) {
loginBtn.addEventListener("click", handleLogin);
}

// ── Animationssekvens ────────────────────────────────
setTimeout(() => {
dRed.classList.add("active");
setStatus("Söker efter satelliter...");
setProgress(22);
}, 350);

setTimeout(() => {
dRed.classList.remove("active");
dYellow.classList.add("active");
setStatus("Värmer upp systemet...");
setProgress(55);
}, 1900);

setTimeout(() => {
dYellow.classList.remove("active");
dGreen.classList.add("active");
setStatus("Ansluter till server...");
setProgress(82);
animationFinished = true;
tryEnableLogin();
}, 3600);
});