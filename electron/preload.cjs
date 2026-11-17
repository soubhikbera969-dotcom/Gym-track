const { contextBridge, ipcRenderer } = require('electron');

function readArg(prefix) {
  const match = process.argv.find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length) : '';
}

contextBridge.exposeInMainWorld('kinetixDesktop', {
  isDesktop: true,
  localSessionToken: readArg('--kinetix-token='),
  appVersion: readArg('--kinetix-version=') || '1.0.0',
  companyName: readArg('--kinetix-company=') || 'Local Club',
  checkForUpdates: () => ipcRenderer.invoke('kinetix:check-updates'),
});
