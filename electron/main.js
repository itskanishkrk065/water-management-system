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

let backendStderrLogs = [];
let backendExitedState = { exited: false, code: null };
let frontendStderrLogs = [];
let frontendExitedState = { exited: false, code: null };

// 3. Multi-Candidate Application Path Resolver
function resolveAppPath(subpath) {
  const candidates = [
    path.join(process.resourcesPath || '', subpath),
    path.join(process.resourcesPath || '', 'app', subpath),
    path.join(app.getAppPath(), subpath),
    path.join(__dirname, '..', subpath),
  ];

  for (const c of candidates) {
    if (fs.existsSync(c)) {
      return c;
    }
  }
  return candidates[0];
}

// 4. HTTP Health Check Helper with Immediate Crash Detection
function waitForHttpService(host, port, endpoint = '/', maxRetries = 75, intervalMs = 400, isDeadCheck = null) {
  return new Promise((resolve) => {
    let attempts = 0;

    const check = () => {
      if (isDeadCheck) {
        const deadInfo = isDeadCheck();
        if (deadInfo && deadInfo.exited) {
          const errorMsg = `Service process terminated unexpectedly with code ${deadInfo.code}.\n${deadInfo.logs ? deadInfo.logs.slice(-15).join('\n') : ''}`;
          logDesktop(errorMsg);
          resolve({ success: false, error: errorMsg });
          return;
        }
      }

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
      if (isDeadCheck) {
        const deadInfo = isDeadCheck();
        if (deadInfo && deadInfo.exited) {
          const errorMsg = `Service process crashed (code ${deadInfo.code}).\n${deadInfo.logs ? deadInfo.logs.slice(-15).join('\n') : ''}`;
          logDesktop(errorMsg);
          resolve({ success: false, error: errorMsg });
          return;
        }
      }

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

// 5. Universal Background Process Spawner (Clean Node/Electron Process)
function spawnNodeScript(scriptPath, args = [], options = {}) {
  const name = options.name || 'Child';
  logDesktop(`Spawning background process [${name}]: ${scriptPath}`);

  if (!fs.existsSync(scriptPath)) {
    logDesktop(`[${name} ERROR]: Script not found at path: ${scriptPath}`);
    return null;
  }

  const workingDir = options.cwd || path.dirname(scriptPath);

  // 1. Primary: Use Electron's native utilityProcess
  if (utilityProcess && typeof utilityProcess.fork === 'function') {
    try {
      const child = utilityProcess.fork(scriptPath, args, {
        cwd: workingDir,
        env: {
          ...process.env,
          ...(options.env || {}),
        },
        stdio: 'pipe',
      });

      if (child.stdout) {
        child.stdout.on('data', (data) => {
          const str = data.toString().trim();
          logDesktop(`[${name} stdout]: ${str}`);
        });
      }
      if (child.stderr) {
        child.stderr.on('data', (data) => {
          const str = data.toString().trim();
          logDesktop(`[${name} stderr]: ${str}`);
          if (name === 'Backend') {
            backendStderrLogs.push(str);
            if (backendStderrLogs.length > 50) backendStderrLogs.shift();
          } else if (name === 'Frontend') {
            frontendStderrLogs.push(str);
            if (frontendStderrLogs.length > 50) frontendStderrLogs.shift();
          }
        });
      }
      child.on('exit', (code) => {
        logDesktop(`[${name}] exited with code=${code}`);
        if (name === 'Backend') {
          backendExitedState = { exited: true, code, logs: backendStderrLogs };
        } else if (name === 'Frontend') {
          frontendExitedState = { exited: true, code, logs: frontendStderrLogs };
        }
      });

      logDesktop(`[${name}] utilityProcess spawned successfully`);
      return child;
    } catch (err) {
      logDesktop(`utilityProcess.fork failed for ${name}: ${err.message}. Trying child_process.fork fallback...`);
    }
  }

  // 2. Secondary: Fallback to standard child_process.fork with ELECTRON_RUN_AS_NODE
  try {
    const child = fork(scriptPath, args, {
      cwd: workingDir,
      env: {
        ...process.env,
        ...(options.env || {}),
        ELECTRON_RUN_AS_NODE: '1',
      },
      execPath: process.execPath,
      stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
    });

    child.stdout?.on('data', (data) => {
      const str = data.toString().trim();
      logDesktop(`[${name} stdout]: ${str}`);
    });
    child.stderr?.on('data', (data) => {
      const str = data.toString().trim();
      logDesktop(`[${name} stderr]: ${str}`);
      if (name === 'Backend') {
        backendStderrLogs.push(str);
        if (backendStderrLogs.length > 50) backendStderrLogs.shift();
      } else if (name === 'Frontend') {
        frontendStderrLogs.push(str);
        if (frontendStderrLogs.length > 50) frontendStderrLogs.shift();
      }
    });
    child.on('exit', (code, signal) => {
      logDesktop(`[${name}] process exited with code=${code}, signal=${signal}`);
      if (name === 'Backend') {
        backendExitedState = { exited: true, code, logs: backendStderrLogs };
      } else if (name === 'Frontend') {
        frontendExitedState = { exited: true, code, logs: frontendStderrLogs };
      }
    });

    logDesktop(`[${name}] child_process.fork spawned successfully (PID: ${child.pid})`);
    return child;
  } catch (err) {
    logDesktop(`child_process.fork failed for ${name}: ${err.message}`);
    return null;
  }
}

// 6. Start Embedded NestJS Backend Process
function startBackendService() {
  logDesktop('Initializing embedded NestJS backend service on 127.0.0.1...');

  const backendDistCandidates = [
    resolveAppPath(path.join('backend', 'dist', 'src', 'main.js')),
    resolveAppPath(path.join('backend', 'dist', 'main.js')),
  ];
  const backendDistPath = backendDistCandidates.find((p) => fs.existsSync(p)) || backendDistCandidates[0];
  const backendCwd = resolveAppPath('backend');

  // Ensure database directory exists
  const dbDir = path.join(appDataDir, 'database');
  if (!fs.existsSync(dbDir)) {
    try {
      fs.mkdirSync(dbDir, { recursive: true });
    } catch {}
  }

  const sqliteDbPath = path.join(dbDir, 'water_management.db');

  // Copy template DB if this is a fresh installation
  if (!fs.existsSync(sqliteDbPath)) {
    const templateDbCandidates = [
      resolveAppPath(path.join('backend', 'prisma', 'template.db')),
      path.join(process.resourcesPath || '', 'backend', 'prisma', 'template.db'),
      path.join(__dirname, '..', 'backend', 'prisma', 'template.db'),
    ];
    const foundTemplate = templateDbCandidates.find((p) => fs.existsSync(p));
    if (foundTemplate) {
      try {
        fs.copyFileSync(foundTemplate, sqliteDbPath);
        logDesktop(`✓ Initialized fresh database from template: ${foundTemplate}`);
      } catch (err) {
        logDesktop(`Failed to copy template DB: ${err.message}`);
      }
    }
  }

  // Windows SQLite URL format: file:C:/path/to/db.db (normalized forward slashes)
  const normalizedDbUrl = 'file:' + sqliteDbPath.replace(/\\/g, '/');

  logDesktop(`Backend dist path: ${backendDistPath}`);
  logDesktop(`Backend working dir: ${backendCwd}`);
  logDesktop(`SQLite database URL: ${normalizedDbUrl}`);

  const backendEnv = {
    PORT: String(BACKEND_PORT),
    DATABASE_URL: normalizedDbUrl,
    WATER_APP_DATA_DIR: appDataDir,
    NODE_ENV: 'production',
    NODE_PATH: path.join(backendCwd, 'node_modules'),
    CORS_ORIGIN: `http://localhost:${FRONTEND_PORT},http://${FRONTEND_HOST}:${FRONTEND_PORT},http://${BACKEND_HOST}:${BACKEND_PORT}`,
  };

  if (fs.existsSync(backendDistPath)) {
    backendProcess = spawnNodeScript(backendDistPath, [], {
      name: 'Backend',
      cwd: backendCwd,
      env: backendEnv,
    });
  } else {
    logDesktop(`Backend build not found at ${backendDistPath}`);
  }
}

// 7. Start Embedded Next.js Frontend Process
function startFrontendService() {
  logDesktop(`Initializing embedded Next.js frontend on ${FRONTEND_HOST}:${FRONTEND_PORT}...`);

  const standaloneServer = resolveAppPath(path.join('frontend', '.next', 'standalone', 'server.js'));
  const standaloneCwd = resolveAppPath(path.join('frontend', '.next', 'standalone'));
  const standaloneNodeModules = path.join(standaloneCwd, 'node_modules');

  logDesktop(`Frontend standalone path: ${standaloneServer}`);
  logDesktop(`Frontend standalone working dir: ${standaloneCwd}`);

  const targetApiUrl = (process.env.WATERGRID_API_URL || process.env.NEXT_PUBLIC_API_URL || `http://${BACKEND_HOST}:${BACKEND_PORT}/api/v1`).trim().replace(/\/+$/, '');

  const frontendEnv = {
    PORT: String(FRONTEND_PORT),
    HOSTNAME: FRONTEND_HOST,
    NODE_ENV: 'production',
    NODE_PATH: standaloneNodeModules,
    NEXT_PUBLIC_API_URL: targetApiUrl,
    WATERGRID_API_URL: targetApiUrl,
  };

  if (fs.existsSync(standaloneServer)) {
    frontendProcess = spawnNodeScript(standaloneServer, [], {
      name: 'Frontend',
      cwd: standaloneCwd,
      env: frontendEnv,
    });
  } else {
    logDesktop(`Frontend standalone server.js not found at ${standaloneServer}`);
  }
}

// 8. Initial Startup & Diagnostic HTML Screen
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
      width: 540px;
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
        <strong>Startup Diagnostic Report:</strong><br/><br/>
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

// Chromium GPU Acceleration & Rendering Switches for Windows/macOS Desktop
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('enable-zero-copy');
app.commandLine.appendSwitch('ignore-gpu-blocklist');
app.commandLine.appendSwitch('disable-http-cache', 'false');

// 9. Create Native Main Desktop Window
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
      backgroundThrottling: false,
      spellcheck: false,
    },
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    logDesktop('Main window displayed to user');
  });

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

// 10. Application Lifecycle & Startup Protocol
app.whenReady().then(async () => {
  logDesktop('==============================================');
  logDesktop('Water Management Desktop Application Starting');
  logDesktop(`Local Storage: ${appDataDir}`);
  logDesktop(`App Path: ${app.getAppPath()}`);
  logDesktop(`Resources Path: ${process.resourcesPath}`);
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
    waitForHttpService(
      BACKEND_HOST,
      BACKEND_PORT,
      '/api/docs',
      75,
      400,
      () => (backendExitedState.exited ? backendExitedState : null)
    ),
    waitForHttpService(
      FRONTEND_HOST,
      FRONTEND_PORT,
      '/login',
      75,
      400,
      () => (frontendExitedState.exited ? frontendExitedState : null)
    ),
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
    if (!backendStatus.success) {
      errors.push(`<strong>Backend API Failure:</strong><br/>${backendStatus.error || 'Port 4000 failed to respond.'}`);
    }
    if (!frontendStatus.success) {
      errors.push(`<strong>Frontend UI Failure:</strong><br/>${frontendStatus.error || 'Port 3000 failed to respond.'}`);
    }
    const fullError = errors.join('<br/><br/>') + `<br/><br/><strong>Log Path:</strong><br/><code>${logFilePath}</code>`;

    logDesktop(`Startup failed: ${backendStatus.error || ''} ${frontendStatus.error || ''}`);
    mainWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(getStartupHtml(null, fullError))}`);
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

// 11. IPC Handlers
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

// Persistent Device Identity
function getOrCreateDeviceId() {
  const configDir = path.join(appDataDir, 'config');
  if (!fs.existsSync(configDir)) {
    try { fs.mkdirSync(configDir, { recursive: true }); } catch {}
  }
  const configPath = path.join(configDir, 'device.json');
  try {
    if (fs.existsSync(configPath)) {
      const data = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      if (data.deviceId) return data.deviceId;
    }
  } catch {}
  const newId = `DEV-${process.platform.toUpperCase()}-${require('crypto').randomUUID()}`;
  try {
    fs.writeFileSync(configPath, JSON.stringify({ deviceId: newId, createdAt: new Date().toISOString() }, null, 2));
  } catch {}
  return newId;
}

const currentDeviceId = getOrCreateDeviceId();

ipcMain.handle('app:get-device-id', () => {
  return currentDeviceId;
});

ipcMain.handle('app:get-secure-token', async (event, key) => {
  const tokenFile = path.join(appDataDir, 'config', `${key}.bin`);
  if (!fs.existsSync(tokenFile)) return null;
  try {
    const encrypted = fs.readFileSync(tokenFile);
    const { safeStorage } = require('electron');
    if (safeStorage && safeStorage.isEncryptionAvailable()) {
      return safeStorage.decryptString(encrypted);
    }
    return encrypted.toString('utf8');
  } catch (err) {
    logDesktop(`Failed to decrypt secure token ${key}: ${err.message}`);
    return null;
  }
});

ipcMain.handle('app:set-secure-token', async (event, key, token) => {
  const configDir = path.join(appDataDir, 'config');
  if (!fs.existsSync(configDir)) {
    try { fs.mkdirSync(configDir, { recursive: true }); } catch {}
  }
  const tokenFile = path.join(configDir, `${key}.bin`);
  try {
    if (!token) {
      if (fs.existsSync(tokenFile)) fs.unlinkSync(tokenFile);
      return true;
    }
    const { safeStorage } = require('electron');
    if (safeStorage && safeStorage.isEncryptionAvailable()) {
      const encrypted = safeStorage.encryptString(token);
      fs.writeFileSync(tokenFile, encrypted);
    } else {
      fs.writeFileSync(tokenFile, Buffer.from(token, 'utf8'));
    }
    return true;
  } catch (err) {
    logDesktop(`Failed to encrypt secure token ${key}: ${err.message}`);
    return false;
  }
});

ipcMain.handle('app:get-api-url', () => {
  return (process.env.WATERGRID_API_URL || process.env.NEXT_PUBLIC_API_URL || `http://${BACKEND_HOST}:${BACKEND_PORT}/api/v1`).trim().replace(/\/+$/, '');
});

// 12. Graceful Application Shutdown
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
