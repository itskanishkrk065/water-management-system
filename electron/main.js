const { app, BrowserWindow, ipcMain, shell, utilityProcess } = require('electron');
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
      const req = http.get(
        {
          host,
          port,
          path: endpoint,
          timeout: 1000,
        },
        (res) => {
          if (res.statusCode && res.statusCode < 500) {
            logDesktop(`Service at http://${host}:${port}${endpoint} ready after ${attempts} attempts`);
            resolve(true);
          } else {
            retry();
          }
        }
      );

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
        logDesktop(
          `Service at http://${host}:${port}${endpoint} failed to respond within ${
            (maxRetries * intervalMs) / 1000
          }s`
        );
        resolve(false);
      } else {
        setTimeout(check, intervalMs);
      }
    };

    check();
  });
}

// 4. Universal Background Node Process Spawner
function spawnNodeScript(scriptPath, args = [], options = {}) {
  const env = {
    ...process.env,
    ...(options.env || {}),
    ELECTRON_RUN_AS_NODE: '1',
  };

  const name = options.name || 'Child';
  logDesktop(`Spawning background process [${name}]: ${scriptPath}`);

  // Use Electron's native utilityProcess if available
  if (utilityProcess && typeof utilityProcess.fork === 'function') {
    try {
      const child = utilityProcess.fork(scriptPath, args, {
        cwd: options.cwd || process.cwd(),
        env,
        stdio: 'pipe',
      });

      if (child.stdout) {
        child.stdout.on('data', (data) => {
          logDesktop(`[${name} stdout]: ${data.toString().trim()}`);
        });
      }
      if (child.stderr) {
        child.stderr.on('data', (data) => {
          logDesktop(`[${name} stderr]: ${data.toString().trim()}`);
        });
      }
      child.on('exit', (code) => {
        logDesktop(`[${name}] exited with code=${code}`);
      });

      logDesktop(`[${name}] utilityProcess spawned successfully (PID: ${child.pid})`);
      return child;
    } catch (err) {
      logDesktop(`utilityProcess.fork failed for ${name}: ${err.message}. Trying child_process.fork...`);
    }
  }

  // Fallback to standard child_process.fork
  try {
    const child = fork(scriptPath, args, {
      cwd: options.cwd || process.cwd(),
      env,
      stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
    });

    child.stdout?.on('data', (data) => {
      logDesktop(`[${name} stdout]: ${data.toString().trim()}`);
    });
    child.stderr?.on('data', (data) => {
      logDesktop(`[${name} stderr]: ${data.toString().trim()}`);
    });
    child.on('exit', (code, signal) => {
      logDesktop(`[${name}] process exited with code=${code}, signal=${signal}`);
    });

    logDesktop(`[${name}] child_process.fork spawned successfully (PID: ${child.pid})`);
    return child;
  } catch (err) {
    logDesktop(`child_process.fork failed for ${name}: ${err.message}`);
    return null;
  }
}

// 5. Start Embedded NestJS Backend Process
function startBackendService() {
  logDesktop('Initializing embedded NestJS backend service on 127.0.0.1...');

  const appRoot = app.isPackaged ? app.getAppPath() : path.join(__dirname, '..');
  const backendDistPath = path.join(appRoot, 'backend', 'dist', 'main.js');
  const sqliteDbPath = path.join(appDataDir, 'database', 'water_management.db');

  const backendEnv = {
    PORT: String(BACKEND_PORT),
    DATABASE_URL: `file:${sqliteDbPath}`,
    WATER_APP_DATA_DIR: appDataDir,
    NODE_ENV: 'production',
    CORS_ORIGIN: `http://localhost:${FRONTEND_PORT},http://${FRONTEND_HOST}:${FRONTEND_PORT},http://${BACKEND_HOST}:${BACKEND_PORT}`,
  };

  if (fs.existsSync(backendDistPath)) {
    backendProcess = spawnNodeScript(backendDistPath, [], {
      name: 'Backend',
      cwd: path.join(appRoot, 'backend'),
      env: backendEnv,
    });
  } else {
    logDesktop(`Backend build not found at ${backendDistPath}`);
  }
}

// 6. Start Embedded Next.js Frontend Process
function startFrontendService() {
  logDesktop(`Initializing embedded Next.js frontend on ${FRONTEND_HOST}:${FRONTEND_PORT}...`);

  const appRoot = app.isPackaged ? app.getAppPath() : path.join(__dirname, '..');
  const standaloneServer = path.join(appRoot, 'frontend', '.next', 'standalone', 'server.js');
  const standaloneCwd = path.join(appRoot, 'frontend', '.next', 'standalone');
  const nextBinPath = path.join(appRoot, 'frontend', 'node_modules', 'next', 'dist', 'bin', 'next');

  const frontendEnv = {
    PORT: String(FRONTEND_PORT),
    HOSTNAME: FRONTEND_HOST,
    NODE_ENV: 'production',
    NEXT_PUBLIC_API_URL: `http://${BACKEND_HOST}:${BACKEND_PORT}/api/v1`,
  };

  if (fs.existsSync(standaloneServer)) {
    frontendProcess = spawnNodeScript(standaloneServer, [], {
      name: 'Frontend',
      cwd: standaloneCwd,
      env: frontendEnv,
    });
  } else if (fs.existsSync(nextBinPath)) {
    frontendProcess = spawnNodeScript(nextBinPath, ['start', '-p', String(FRONTEND_PORT), '-H', FRONTEND_HOST], {
      name: 'Frontend-CLI',
      cwd: path.join(appRoot, 'frontend'),
      env: frontendEnv,
    });
  } else {
    logDesktop(`Neither standalone server.js nor Next.js CLI binary found in ${appRoot}`);
  }
}

// 7. Create Native Main Desktop Window
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

// 8. Application Lifecycle & Startup Protocol
app.whenReady().then(async () => {
  logDesktop('==============================================');
  logDesktop('Water Management Desktop Application Starting');
  logDesktop(`Local Storage: ${appDataDir}`);
  logDesktop(`App Path: ${app.getAppPath()}`);
  logDesktop('==============================================');

  const isDev = process.env.NODE_ENV === 'development';

  // 1. Start embedded backend process
  startBackendService();

  // 2. Start embedded frontend process in production
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

// 9. IPC Handlers
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

// 10. Graceful Application Shutdown
app.on('before-quit', () => {
  logDesktop('Application closing. Initiating graceful shutdown...');

  if (backendProcess) {
    try {
      logDesktop('Terminating backend process...');
      backendProcess.kill();
    } catch {}
  }

  if (frontendProcess) {
    try {
      logDesktop('Terminating frontend process...');
      frontendProcess.kill();
    } catch {}
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
