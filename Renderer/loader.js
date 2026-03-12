//===========================================================
//========= LOADER.JS v.4.0.0 ======//
//===========================================================
document.addEventListener("DOMContentLoaded", () => {
  const dRed    = document.getElementById("light-red");
  const dYellow = document.getElementById("light-yellow");
  const dGreen  = document.getElementById("light-green");
  const text    = document.getElementById("loader-text");
  const fill    = document.getElementById("progress-fill");

  let animationFinished = false;
  let serverIsReady     = false;

  const setProgress = (pct) => { if (fill) fill.style.width = pct + '%'; };
  const setStatus   = (msg) => { if (text) text.textContent = msg; };

  const tryFinish = () => {
    if (animationFinished && serverIsReady) {
      setStatus("Redo.");
      setProgress(100);
      setTimeout(() => {
        if (window.electronAPI?.loaderDone) window.electronAPI.loaderDone();
      }, 550);
    }
  };

  // ESC — manuell stängning (debug)
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && window.electronAPI?.loaderDone) window.electronAPI.loaderDone();
  });

  // Server-signal via IPC
  if (window.electronAPI?.onServerStatus) {
    window.electronAPI.onServerStatus((status) => {
      if (status === true) { serverIsReady = true; tryFinish(); }
    });
  }

  // ── Animationssekvens ──────────────────────────────────
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
    tryFinish();
  }, 3600);
});