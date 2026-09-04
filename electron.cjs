const { app, BrowserWindow } = require("electron");
const path = require("path");
const http = require("http");

// Ensure production mode and local port for desktop server
process.env.NODE_ENV = "production";
process.env.PORT = process.env.PORT || "3000";

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 720,
    title: "AI Shop Agent - Desktop Suite",
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
    autoHideMenuBar: true,
  });

  const appUrl = `http://localhost:${process.env.PORT}`;

  function checkAndLoad(attempts = 0) {
    if (!mainWindow) return;
    const req = http.get(`${appUrl}/api/health`, (res) => {
      if (res.statusCode === 200) {
        mainWindow.loadURL(appUrl);
      } else {
        setTimeout(() => checkAndLoad(attempts + 1), 300);
      }
    });
    req.on("error", () => {
      setTimeout(() => checkAndLoad(attempts + 1), 300);
    });
  }

  // Poll server readiness then load
  checkAndLoad();

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  // Start the bundled Express server
  try {
    require(path.join(__dirname, "dist", "server.cjs"));
  } catch (err) {
    console.error("[Desktop Server Startup Error]:", err);
  }

  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
