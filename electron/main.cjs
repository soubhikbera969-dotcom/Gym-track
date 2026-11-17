const { app, BrowserWindow, dialog, ipcMain, safeStorage } = require('electron');
const { spawn } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const http = require('http');
const net = require('net');
const path = require('path');

let mainWindow = null;
let serverProcess = null;
let autoUpdater = null;

function getAppDataDir() {
  const dir = path.join(app.getPath('userData'), 'KinetixCompanyData');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function getOrCreateVaultSecret(dataDir) {
  const dpapiPath = path.join(dataDir, 'vault.dpapi');
  if (fs.existsSync(dpapiPath)) {
    const raw = fs.readFileSync(dpapiPath);
    if (safeStorage.isEncryptionAvailable()) {
      return safeStorage.decryptString(raw);
    }
    return raw.toString('utf8');
  }

  const secret = crypto.randomBytes(32).toString('hex');
  if (safeStorage.isEncryptionAvailable()) {
    fs.writeFileSync(dpapiPath, safeStorage.encryptString(secret), { mode: 0o600 });
  } else {
    fs.writeFileSync(dpapiPath, secret, { encoding: 'utf8', mode: 0o600 });
  }
  return secret;
}

function loadExternalEnvFile(filePath) {
  const envVars = {};
  if (!fs.existsSync(filePath)) return envVars;
  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const k = trimmed.slice(0, eq).trim();
    const v = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
    if (k && v) envVars[k] = v;
  }
  return envVars;
}

function findFreePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.unref();
    srv.on('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const addr = srv.address();
      const port = typeof addr === 'object' && addr ? addr.port : 3000;
      srv.close(() => resolve(port));
    });
  });
}

function waitForServer(port, getStderr, retries = 80) {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    const check = () => {
      attempts += 1;
      const req = http.get(`http://127.0.0.1:${port}/api/health`, (res) => {
        res.resume();
        if (res.statusCode === 200) return resolve();
        if (attempts >= retries) {
          const detail = getStderr ? getStderr().trim() : '';
          return reject(
            new Error(detail ? `Local server did not become ready:\n${detail}` : 'Local server did not become ready.')
          );
        }
        setTimeout(check, 250);
      });
      req.on('error', () => {
        if (attempts >= retries) {
          const detail = getStderr ? getStderr().trim() : '';
          return reject(
            new Error(detail ? `Local server failed to start:\n${detail}` : 'Local server failed to start.')
          );
        }
        setTimeout(check, 250);
      });
    };
    check();
  });
}

function setupAutoUpdater() {
  try {
    ({ autoUpdater } = require('electron-updater'));
  } catch {
    return;
  }
  if (!app.isPackaged || !autoUpdater) return;

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppExit = true;

  autoUpdater.on('update-downloaded', (info) => {
    if (!mainWindow) return;
    dialog
      .showMessageBox(mainWindow, {
        type: 'info',
        buttons: ['Restart & Update', 'Later'],
        defaultId: 0,
        title: 'Kinetix Update Ready',
        message: `Version ${info.version} is ready to install.`,
        detail:
          'Restart Kinetix to apply the update. All of your club data stays safely stored offline on this computer.',
      })
      .then((res) => {
        if (res.response === 0) {
          autoUpdater.quitAndInstall();
        }
      })
      .catch(() => {});
  });

  autoUpdater.checkForUpdates().catch(() => {
    // Offline — ignore silently
  });
}

async function createDesktopWindow() {
  const dataDir = getAppDataDir();
  const vaultSecret = getOrCreateVaultSecret(dataDir);
  const localToken = crypto.randomBytes(32).toString('hex');
  const port = await findFreePort();

  const appRoot = app.getAppPath();
  const externalEnv = loadExternalEnvFile(path.join(dataDir, 'kinetix.env'));

  const childEnv = {
    ...process.env,
    ...externalEnv,
    NODE_ENV: 'production',
    HOST: '127.0.0.1',
    PORT: String(port),
    LOCAL_OFFLINE: 'true',
    KINETIX_DATA_DIR: dataDir,
    KINETIX_VAULT_SECRET: vaultSecret,
    KINETIX_LOCAL_TOKEN: localToken,
    KINETIX_COMPANY_NAME: externalEnv.KINETIX_COMPANY_NAME || 'Local Club',
  };
  delete childEnv.SQL_HOST;

  const bundledServer = path.join(appRoot, 'dist-server', 'server.cjs');
  const tsxCli = path.join(appRoot, 'node_modules', 'tsx', 'dist', 'cli.mjs');
  const serverEntry = path.join(appRoot, 'server.ts');

  const spawnArgs = fs.existsSync(bundledServer)
    ? [bundledServer]
    : [tsxCli, serverEntry];

  let stderrBuffer = '';
  serverProcess = spawn(process.execPath, spawnArgs, {
    cwd: appRoot,
    env: { ...childEnv, ELECTRON_RUN_AS_NODE: '1' },
    stdio: ['ignore', 'ignore', 'pipe'],
  });

  if (serverProcess.stderr) {
    serverProcess.stderr.on('data', (chunk) => {
      stderrBuffer = (stderrBuffer + chunk.toString('utf8')).slice(-4000);
    });
  }

  serverProcess.on('exit', (code) => {
    if (code && code !== 0 && stderrBuffer) {
      try {
        fs.writeFileSync(path.join(dataDir, 'startup-error.log'), stderrBuffer, 'utf8');
      } catch {
        // Ignore log write failure
      }
    }
  });

  await waitForServer(port, () => stderrBuffer);

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: 'Kinetix — Gym Operations',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      additionalArguments: [
        `--kinetix-token=${localToken}`,
        `--kinetix-version=${app.getVersion()}`,
        `--kinetix-company=${childEnv.KINETIX_COMPANY_NAME}`,
      ],
    },
  });

  // Block untrusted external navigation or popup windows
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  mainWindow.webContents.on('will-navigate', (event, targetUrl) => {
    if (!targetUrl.startsWith(`http://127.0.0.1:${port}`)) {
      event.preventDefault();
    }
  });

  await mainWindow.loadURL(`http://127.0.0.1:${port}`);
  setupAutoUpdater();
}

ipcMain.handle('kinetix:check-updates', async () => {
  if (!app.isPackaged || !autoUpdater) {
    return { available: false, message: 'Running local version.' };
  }
  try {
    const result = await autoUpdater.checkForUpdates();
    const nextVer = result?.updateInfo?.version;
    const available = Boolean(nextVer && nextVer !== app.getVersion());
    return {
      available,
      message: available
        ? `Update v${nextVer} is downloading in the background.`
        : `You are running the latest version (v${app.getVersion()}).`,
    };
  } catch {
    return {
      available: false,
      message: 'Offline right now — updates will check automatically when connected.',
    };
  }
});

app.whenReady().then(() => {
  createDesktopWindow().catch((err) => {
    dialog.showErrorBox(
      'Unable to Start Kinetix',
      err instanceof Error ? err.message : 'An unexpected startup error occurred.'
    );
    app.quit();
  });
});

app.on('window-all-closed', () => {
  if (serverProcess) {
    serverProcess.kill();
    serverProcess = null;
  }
  app.quit();
});
