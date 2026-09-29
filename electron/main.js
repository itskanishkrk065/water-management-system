const { app, BrowserWindow, ipcMain, shell, utilityProcess, globalShortcut } = require('electron');
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
            resolve({ success: true, attempts });
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
        const errorMsg = `Service at http://${host}:${port}${endpoint} timed out after ${(maxRetries * intervalMs) / 1000}s`;
        logDesktop(errorMsg);
        resolve({ success: false, error: errorMsg });
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

// 7. Initial Startup HTML Screen
function getStartupHtml(statusText = 'Starting Services...', error = null) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Kongu Water Management System</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background: #0f172a;
      color: #f8fafc;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100vh;
      box-sizing: border-box;
    }
    .card {
      background: #1e293b;
      border: 1px solid #334155;
      border-radius: 20px;
      padding: 40px;
      width: 520px;
      text-align: center;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
    }
    .logo {
      width: 56px;
      height: 56px;
      margin: 0 auto 16px;
      background: linear-gradient(135deg, #0284c7, #38bdf8);
      border-radius: 16px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 28px;
    }
    h1 {
      font-size: 20px;
      font-weight: 700;
      margin: 0 0 8px;
      color: #ffffff;
    }
    p {
      color: #94a3b8;
      font-size: 13px;
      margin: 0 0 24px;
      line-height: 1.5;
    }
    .spinner {
      width: 28px;
      height: 28px;
      border: 3px solid #334155;
      border-top-color: #38bdf8;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
      margin: 0 auto 16px;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    .status {
      font-size: 13px;
      font-weight: 600;
      color: #38bdf8;
    }
    .error-box {
      background: rgba(239, 68, 68, 0.1);
      border: 1px solid rgba(239, 68, 68, 0.3);
      color: #fca5a5;
      padding: 16px;
      border-radius: 12px;
      font-size: 12px;
      text-align: left;
      margin-top: 16px;
      word-break: break-word;
    }
    .btn-row {
      display: flex;
      gap: 12px;
      justify-content: center;
      margin-top: 20px;
    }
    button {
      background: #0284c7;
      color: white;
      border: none;
      padding: 10px 18px;
      border-radius: 10px;
      font-weight: 600;
      font-size: 12px;
      cursor: pointer;
      transition: background 0.2s;
    }
    button:hover { background: #0369a1; }
    button.secondary {
      background: #334155;
    }
    button.secondary:hover { background: #475569; }
    .hint {
      margin-top: 20px;
      font-size: 11px;
      color: #64748b;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">💧</div>
    <h1>Kongu Water Management</h1>
    <p>Offline Administrative & Beneficiary Control System</p>
    
    ${
      error
        ? `
      <div class="error-box">
        <strong>Startup Error:</strong><br/>
        ${error}
      </div>
      <div class="btn-row">
        <button onclick="window.electronAPI.openStorageFolder()">Open Logs Folder</button>
        <button class="secondary" onclick="location.reload()">Retry Startup</button>
      </div>
    `
        : `
      <div class="spinner"></div>
      <div class="status">${statusText}</div>
    `
    }

    <div class="hint">Press <strong>F12</strong> or <strong>Ctrl+Shift+I</strong> to open Developer Diagnostics</div>
  </div>
</body>
</html>`;
}

// 8. Create Native Main Desktop Window
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

  // Toggle DevTools with F12 or CommandOrControl+Shift+I
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.key === 'F12' || (input.control && input.shift && input.key.toUpperCase() === 'I')) {
      mainWindow.webContents.toggleDevTools();
      event.preventDefault();
    }
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http:') || url.startsWith('https:')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// 9. Application Lifecycle & Startup Protocol
app.whenReady().then(async () => {
  logDesktop('==============================================');
  logDesktop('Water Management Desktop Application Starting');
  logDesktop(`Local Storage: ${appDataDir}`);
  logDesktop(`App Path: ${app.getAppPath()}`);
  logDesktop('==============================================');

  await createMainWindow();

  // 1. Show startup screen while initializing services
  mainWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(getStartupHtml('Starting Offline Database & Services...'))}`);

  const isDev = process.env.NODE_ENV === 'development';

  // 2. Start embedded backend
  startBackendService();

  // 3. Start embedded frontend in production
  if (!isDev) {
    startFrontendService();
  }

  // 4. Await health checks
  logDesktop('Awaiting backend and frontend services readiness...');
  const [backendStatus, frontendStatus] = await Promise.all([
    waitForHttpService(BACKEND_HOST, BACKEND_PORT, '/api/docs', 60, 400),
    waitForHttpService(FRONTEND_HOST, FRONTEND_PORT, '/login', 60, 400),
  ]);

  if (backendStatus.success && frontendStatus.success) {
    const frontendUrl = `http://${FRONTEND_HOST}:${FRONTEND_PORT}/login`;
    logDesktop(`Both services ready! Loading application URL: ${frontendUrl}`);
    mainWindow.loadURL(frontendUrl).catch((err) => {
      logDesktop(`Navigation error to ${frontendUrl}: ${err.message}`);
      mainWindow.loadURL(
        `data:text/html;charset=utf-8,${encodeURIComponent(
          getStartupHtml(null, `Failed to connect to UI: ${err.message}`)
        )}`
      );
    });
  } else {
    const errors = [];
    if (!backendStatus.success) errors.push(`Backend API (Port ${BACKEND_PORT}) failed to respond.`);
    if (!frontendStatus.success) errors.push(`Frontend UI (Port ${FRONTEND_PORT}) failed to respond.`);
    const fullError = errors.join('<br/>') + `<br/><br/>Detailed logs available in:<br/><code>${logFilePath}</code>`;

    logDesktop(`Startup failed: ${errors.join(' ')}`);
    mainWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(getStartupHtml(null, fullError))}`);
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

// 10. IPC Handlers
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

// 11. Graceful Application Shutdown
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
