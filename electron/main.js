const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');
const { fork } = require('child_process');

let mainWindow = null;
let backendProcess = null;
let frontendProcess = null;

const BACKEND_PORT = process.env.PORT || 4000;
const BACKEND_HOST = '127.0.0.1';
const FRONTEND_PORT = process.env.FRONTEND_PORT || 3000;
const FRONTEND_HOST = '127.0.0.1';

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

// 3. HTTP Health Check Helper
function waitForHttpService(host, port, endpoint = '/', maxRetries = 60, intervalMs = 400) {
  return new Promise((resolve) => {
    let attempts = 0;

    const check = () => {
      attempts++;
      const req = http.get({
        host,
        port,
        path: endpoint,
        timeout: 1000,
      }, (res) => {
        if (res.statusCode && res.statusCode < 500) {
          logDesktop(`Service at http://${host}:${port}${endpoint} ready after ${attempts} attempts`);
          resolve(true);
        } else {
          retry();
        }
      });

      req.on('error', () => {
        retry();
      });

      req.on('timeout', () => {
        req.destroy();
        retry();
      });
    };

    const retry = () => {
      if (attempts >= maxRetries) {
        logDesktop(`Service at http://${host}:${port}${endpoint} failed to respond within ${(maxRetries * intervalMs) / 1000}s`);
        resolve(false);
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
    CORS_ORIGIN: `http://localhost:${FRONTEND_PORT},http://${FRONTEND_HOST}:${FRONTEND_PORT},http://${BACKEND_HOST}:${BACKEND_PORT}`,
  };

  if (fs.existsSync(backendDistPath)) {
    try {
      backendProcess = fork(backendDistPath, [], {
        env: backendEnv,
        stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
      });

      backendProcess.stdout?.on('data', (data) => {
        logDesktop(`[Backend stdout]: ${data.toString().trim()}`);
      });

      backendProcess.stderr?.on('data', (data) => {
        logDesktop(`[Backend stderr]: ${data.toString().trim()}`);
      });

      backendProcess.on('exit', (code, signal) => {
        logDesktop(`Backend process exited with code=${code}, signal=${signal}`);
      });

      logDesktop(`Backend child process spawned (PID: ${backendProcess.pid})`);
    } catch (err) {
      logDesktop(`Failed to fork backend process: ${err.message}`);
    }
  } else {
    logDesktop(`Backend build not found at ${backendDistPath}`);
  }
}

// 5. Start Embedded Next.js Frontend Process
function startFrontendService() {
  logDesktop(`Initializing embedded Next.js frontend on ${FRONTEND_HOST}:${FRONTEND_PORT}...`);

  const frontendDir = path.join(__dirname, '..', 'frontend');
  const nextBinPath = path.join(frontendDir, 'node_modules', 'next', 'dist', 'bin', 'next');

  if (fs.existsSync(nextBinPath)) {
    try {
      frontendProcess = fork(
        nextBinPath,
        ['start', '-p', String(FRONTEND_PORT), '-H', FRONTEND_HOST],
        {
          cwd: frontendDir,
          env: {
            ...process.env,
            PORT: String(FRONTEND_PORT),
            HOSTNAME: FRONTEND_HOST,
            NODE_ENV: 'production',
            NEXT_PUBLIC_API_URL: `http://${BACKEND_HOST}:${BACKEND_PORT}/api/v1`,
          },
          stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
        }
      );

      frontendProcess.stdout?.on('data', (data) => {
        logDesktop(`[Frontend stdout]: ${data.toString().trim()}`);
      });

      frontendProcess.stderr?.on('data', (data) => {
        logDesktop(`[Frontend stderr]: ${data.toString().trim()}`);
      });

      frontendProcess.on('exit', (code, signal) => {
        logDesktop(`Frontend process exited with code=${code}, signal=${signal}`);
      });

      logDesktop(`Frontend child process spawned (PID: ${frontendProcess.pid})`);
    } catch (err) {
      logDesktop(`Failed to fork frontend process: ${err.message}`);
    }
  } else {
    logDesktop(`Next.js CLI binary not found at ${nextBinPath}`);
  }
}

// 6. Create Native Main Desktop Window
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

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    logDesktop('Main window displayed to user');
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http:') || url.startsWith('https:')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  const frontendUrl = `http://${FRONTEND_HOST}:${FRONTEND_PORT}/login`;
  logDesktop(`Loading frontend URL: ${frontendUrl}`);
  mainWindow.loadURL(frontendUrl).catch((err) => {
    logDesktop(`Failed to load ${frontendUrl}: ${err.message}`);
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// 7. Application Lifecycle & Startup Protocol
app.whenReady().then(async () => {
  logDesktop('==============================================');
  logDesktop('Water Management Desktop Application Starting');
  logDesktop(`Local Storage: ${appDataDir}`);
  logDesktop('==============================================');

  const isDev = process.env.NODE_ENV === 'development';

  // 1. Start backend process
  startBackendService();

  // 2. Start frontend process if in production or not running
  if (!isDev) {
    startFrontendService();
  }

  // 3. Wait for backend and frontend to be responsive
  logDesktop('Awaiting backend and frontend services...');
  await Promise.all([
    waitForHttpService(BACKEND_HOST, BACKEND_PORT, '/api/docs'),
    waitForHttpService(FRONTEND_HOST, FRONTEND_PORT, '/login'),
  ]);

  // 4. Open native window
  await createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

// 8. IPC Handlers
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

// 9. Graceful Application Shutdown
app.on('before-quit', () => {
  logDesktop('Application closing. Initiating graceful shutdown...');

  if (backendProcess) {
    try {
      logDesktop('Terminating backend process...');
      backendProcess.kill('SIGTERM');
    } catch {}
  }

  if (frontendProcess) {
    try {
      logDesktop('Terminating frontend process...');
      frontendProcess.kill('SIGTERM');
    } catch {}
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
