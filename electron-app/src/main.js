const { app, ipcMain, BrowserWindow } = require('electron');
const path = require('node:path');
const started = require('electron-squirrel-startup');
const AutoLaunch = require('auto-launch');

// Import main services and IPC handlers
const mainService = require('./main/mainService');
const { initializeAllIpcHandlers } = require('./main/ipcHandlers');
const logEventHub = require('./main/services/logEventHub');
const sqliteLogger = require('./main/services/sqliteLogger');

// Initialize AutoLaunch
const launcher = new AutoLaunch({
  name: 'RST - Advance Website Seo Tool',
  path: app.getPath('exe'),
});

// Track IPC handlers initialization to prevent duplicates
let ipcHandlersInitialized = false;

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit();
}


function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    frame: false, // Disable the frame for a custom title bar
    titleBarStyle: 'hidden', // Hide the default title bar
    titleBarOverlay: {
      color: '#1b1340', // Custom color for the title bar
      symbolColor: '#ffffff', // Color for the close/minimize/maximize buttons
      height: 32, // Height of the title bar
    },
    icon: path.join(__dirname, '../public/app-icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // mainWindow.webContents.on("context-menu", (e) => {
  //   e.preventDefault();
  // });

  // if (process.env.NODE_ENV === "production") {
  //   mainWindow.setMenu(null);
  // }



  // if (process.env.NODE_ENV !== 'development') {
  //   mainWindow.setMenuBarVisibility(false); // Hide the menu bar in production
  // }


  if (!app.isPackaged) {
    // ─── DEVELOPMENT ────────────────────────────────
    // Vite dev server is running on port 5173 by default
    mainWindow.loadURL('http://localhost:5173');
  } else {
    // ─── PRODUCTION ─────────────────────────────────
    // After packaging, your renderer build lives under:
    //   <project>/electron-app/.vite/build/renderer/index.html
    mainWindow.loadFile(
      path.join(__dirname, 'renderer', 'index.html')
    );
  }
  console.log(path.join(__dirname, 'renderer', 'index.html'));

  // Open the DevTools.
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }

  // Register window for log broadcasting
  logEventHub.addWindow(mainWindow);
  sqliteLogger.addWindow(mainWindow);

  return mainWindow;
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(async () => {
  try {
    // Initialize main service (database, schedulers, etc.)
    await mainService.initialize();
    
    // Initialize all IPC handlers (only once)
    if (!ipcHandlersInitialized) {
      initializeAllIpcHandlers();
      ipcHandlersInitialized = true;
    }
    
    console.log('✅ Electron app initialized successfully');
  } catch (error) {
    console.error('❌ Failed to initialize main service:', error);
    console.log('⚠️ Continuing with limited functionality...');
    
    // Still initialize IPC handlers even if main service fails (but only once)
    if (!ipcHandlersInitialized) {
      try {
        initializeAllIpcHandlers();
        ipcHandlersInitialized = true;
      } catch (ipcError) {
        console.error('❌ Failed to initialize IPC handlers:', ipcError);
      }
    }
  }
  
  // Always create the window regardless of service initialization
  createWindow();

  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// app.on("browser-window-created", (_, window) => {
//   window.webContents.on("before-input-event", (event, input) => {
//     // Disable F12 and Ctrl+Shift+I
//     if (
//       (input.key === "F12") ||
//       (input.control && input.shift && input.key.toLowerCase() === "i")
//     ) {
//       event.preventDefault();
//     }
//   });
// });

// app.on("web-contents-created", (_, contents) => {
//   contents.on("devtools-opened", () => {
//     if (process.env.NODE_ENV === "production") {
//       contents.closeDevTools();
//     }
//   });
// });


// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', async () => {
  if (process.platform !== 'darwin') {
    try {
      await mainService.shutdown();
      app.quit();
    } catch (error) {
      console.error('❌ Error during app shutdown:', error);
      app.quit();
    }
  }
});

// Handle app termination
app.on('before-quit', async (event) => {
  if (!mainService.isShuttingDown) {
    event.preventDefault();
    mainService.isShuttingDown = true;
    
    try {
      await mainService.shutdown();
      app.quit();
    } catch (error) {
      console.error('❌ Error during graceful shutdown:', error);
      app.quit();
    }
  }
});

// const { ipcMain, BrowserWindow } = require('electron');

ipcMain.on('window-minimize', () => {
  BrowserWindow.getFocusedWindow()?.minimize();
});

ipcMain.on('window-maximize', () => {
  const win = BrowserWindow.getFocusedWindow();
  if (win.isMaximized()) {
    win.unmaximize();
  } else {
    win.maximize();
  }
});

ipcMain.on('window-close', () => {
  BrowserWindow.getFocusedWindow()?.close();
});

// Health check IPC handler
ipcMain.handle('get-app-health', async () => {
  try {
    return { success: true, data: mainService.getHealthStatus() };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Restart services (for development)
ipcMain.handle('restart-services', async () => {
  try {
    await mainService.restart();
    return { success: true, message: 'Services restarted successfully' };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Auto-launch functionality
const enableStartup = async () => {
  try {
    await launcher.enable();
    return true;
  } catch (error) {
    console.error('❌ Failed to enable startup:', error);
    return false;
  }
};

const disableStartup = async () => {
  try {
    await launcher.disable();
    return true;
  } catch (error) {
    console.error('❌ Failed to disable startup:', error);
    return false;
  }
};

const isStartupEnabled = async () => {
  try {
    return await launcher.isEnabled();
  } catch (error) {
    console.error('❌ Failed to check startup status:', error);
    return false;
  }
};

// Auto-launch IPC handlers
ipcMain.handle('get-startup-enabled', async () => {
  try {
    const enabled = await isStartupEnabled();
    return { success: true, enabled };
  } catch (error) {
    return { success: false, error: error.message, enabled: false };
  }
});

ipcMain.handle('set-startup-enabled', async (event, enable) => {
  try {
    const success = enable ? await enableStartup() : await disableStartup();
    return { success, enabled: enable };
  } catch (error) {
    return { success: false, error: error.message };
  }
});



// Export log event hub for use in other main process modules
module.exports = { logEventHub };