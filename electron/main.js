const { app, BrowserWindow, ipcMain, shell, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');
const { spawn, fork } = require('child_process');

let mainWindow = null;
let backendProcess = null;
const BACKEND_PORT = process.env.PORT || 4000;
const BACKEND_HOST = '127.0.0.1';

// 1. Resolve User AppData Storage Directory
function getAppDataDirectory() {
  const localAppData = process.env.LOCALAPPDATA || process.env.APPDATA || app.getPath('userData');
  const appDataDir = path.join(localAppData, 'WaterManagement');

  const subdirs = ['database', 'documents', 'receipts', 'reports', 'backups', 'logs', 'config'];
  subdirs.forEach((sub) => {
    const p = path.join(appDataDir, sub);
    if (!fs.existsSync(p)) {
      try {
        fs.mkdirSync(p, { recursive: true });
      } catch (err) {
        console.error('Failed to create directory:', p, err);
      }
    }
  });

  return appDataDir;
}

const appDataDir = getAppDataDirectory();
const logFilePath = path.join(appDataDir, 'logs', 'desktop.log');

function logDesktop(msg) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  try {
    fs.appendFileSync(logFilePath, line);
  } catch {}
  console.log(msg);
}

// 2. Acquire Single Instance Lock
const gotSingleLock = app.requestSingleInstanceLock();
if (!gotSingleLock) {
  logDesktop('Another instance of Water Management is already running. Exiting.');
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

// 3. Health Check Helper for Embedded Backend
function waitForBackendReady(port, maxRetries = 40, intervalMs = 500) {
  return new Promise((resolve, reject) => {
    let attempts = 0;

    const check = () => {
      attempts++;
      const req = http.get(`http://${BACKEND_HOST}:${port}/api/docs`, (res) => {
        if (res.statusCode === 200 || res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 404) {
          logDesktop(`Backend active and responding on port ${port} after ${attempts} attempts`);
          resolve(true);
        } else {
          retry();
        }
      });

      req.on('error', () => {
        retry();
      });

      req.setTimeout(1000, () => {
        req.destroy();
        retry();
      });
    };

    const retry = () => {
      if (attempts >= maxRetries) {
        logDesktop(`Backend failed to respond within ${(maxRetries * intervalMs) / 1000}s`);
        resolve(false); // Resolve false so we still show UI with error state
      } else {
        setTimeout(check, intervalMs);
      }
    };

    check();
  });
}

// 4. Start Embedded NestJS Backend Process
function startBackendService() {
  logDesktop('Initializing embedded NestJS backend service on 127.0.0.1...');

  const backendDistPath = path.join(__dirname, '..', 'backend', 'dist', 'main.js');
  const sqliteDbPath = path.join(appDataDir, 'database', 'water_management.db');

  const backendEnv = {
    ...process.env,
    PORT: String(BACKEND_PORT),
    DATABASE_URL: `file:${sqliteDbPath}`,
    WATER_APP_DATA_DIR: appDataDir,
    NODE_ENV: 'production',
    CORS_ORIGIN: `http://localhost:3000,http://127.0.0.1:3000,http://${BACKEND_HOST}:${BACKEND_PORT}`,
  };

  if (fs.existsSync(backendDistPath)) {
    try {
      backendProcess = fork(backendDistPath, [], {
        env: backendEnv,
        stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
      });

      backendProcess.stdout?.on('data', (data) => {
        const str = data.toString();
        logDesktop(`[Backend stdout]: ${str.trim()}`);
      });

      backendProcess.stderr?.on('data', (data) => {
        const str = data.toString();
        logDesktop(`[Backend stderr]: ${str.trim()}`);
      });

      backendProcess.on('exit', (code, signal) => {
        logDesktop(`Backend process exited with code=${code}, signal=${signal}`);
      });

      logDesktop(`Backend child process spawned (PID: ${backendProcess.pid})`);
    } catch (err) {
      logDesktop(`Failed to fork backend process: ${err.message}`);
    }
  } else {
    logDesktop(`Backend build not found at ${backendDistPath}. In development mode, please run backend independently.`);
  }
}

// 5. Create Native Main Desktop Window
async function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1366,
    height: 860,
    minWidth: 1024,
    minHeight: 700,
    backgroundColor: '#0f172a',
    title: 'Kongu Water Management System',
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  // Gracefully show window when ready
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    logDesktop('Main window displayed to user');
  });

  // External links open in default OS browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http:') || url.startsWith('https:')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  // Determine load target
  const isDev = process.env.NODE_ENV === 'development';
  if (isDev) {
    mainWindow.loadURL('http://localhost:3000');
  } else {
    // In packaged production, connect to frontend dev server or exported static build
    const frontendPort = process.env.FRONTEND_PORT || 3000;
    mainWindow.loadURL(`http://127.0.0.1:${frontendPort}`).catch(() => {
      // Fallback: load internal status if frontend server is starting
      mainWindow.loadURL(`http://127.0.0.1:${BACKEND_PORT}/api/docs`);
    });
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// 6. Application Lifecycle & Startup Protocol
app.whenReady().then(async () => {
  logDesktop('==============================================');
  logDesktop('Water Management Desktop Application Starting');
  logDesktop(`Local Storage: ${appDataDir}`);
  logDesktop('==============================================');

  // Start embedded backend service
  startBackendService();

  // Wait for backend to be ready
  await waitForBackendReady(BACKEND_PORT);

  // Open native UI window
  await createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

// 7. IPC Handlers
ipcMain.handle('app:get-info', () => {
  return {
    version: app.getVersion(),
    appDataDir,
    platform: process.platform,
    isOffline: true,
  };
});

ipcMain.handle('app:open-storage-folder', () => {
  shell.openPath(appDataDir);
  return true;
});

// 8. Graceful Application Shutdown
app.on('before-quit', (e) => {
  logDesktop('Application closing. Initiating graceful shutdown...');

  if (backendProcess) {
    try {
      logDesktop('Terminating embedded backend process...');
      backendProcess.kill('SIGTERM');
    } catch (err) {
      logDesktop(`Error terminating backend process: ${err.message}`);
    }
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
