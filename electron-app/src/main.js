import { app, ipcMain, BrowserWindow } from 'electron';
import path from 'node:path';
import started from 'electron-squirrel-startup';

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
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
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
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
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