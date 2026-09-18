// Registers the service worker and offers a refresh when a new version is ready.

if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      const reg = await navigator.serviceWorker.register('./sw.js');

      // A new version has been downloaded while this one is open.
      reg.addEventListener('updatefound', () => {
        const worker = reg.installing;
        if (!worker) return;
        worker.addEventListener('statechange', () => {
          if (worker.state === 'installed' && navigator.serviceWorker.controller) {
            showUpdateToast();
          }
        });
      });

      // Check for a new version each time the app is brought to the front.
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') reg.update().catch(() => {});
      });
    } catch (err) {
      console.warn('Offline support unavailable:', err);
    }
  });
}

function showUpdateToast() {
  const t = document.getElementById('toast');
  t.textContent = 'New version ready. Tap to refresh';
  t.classList.remove('hidden');
  t.classList.add('tappable');
  t.onclick = () => location.reload();
}
