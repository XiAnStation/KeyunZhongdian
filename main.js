const { app, BrowserWindow } = require('electron')
const path = require('path')
const isDev = process.env.NODE_ENV === 'development'

async function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    frame: true,
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      webSecurity: !isDev
    }
  })

  if (isDev) {
    // 开发环境下，等待开发服务器启动
    const tryLoad = async (retries = 0) => {
      try {
        await mainWindow.loadURL('http://localhost:3000')
        mainWindow.webContents.openDevTools()
      } catch (e) {
        if (retries < 3) {
          console.log(`重试加载开发服务器 (${retries + 1}/3)...`)
          await new Promise(resolve => setTimeout(resolve, 1000))
          await tryLoad(retries + 1)
        } else {
          console.error('无法连接到开发服务器:', e)
        }
      }
    }
    await tryLoad()
  } else {
    mainWindow.loadFile(path.join(__dirname, 'dist', 'index.html'))
  }

  // 错误处理
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error('页面加载失败:', errorDescription)
    if (isDev) {
      setTimeout(() => mainWindow.reload(), 1000)
    }
  })
}

app.whenReady().then(createWindow)

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', function () {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})

// 未捕获的异常处理
process.on('uncaughtException', (error) => {
  console.error('未捕获的异常:', error)
})

process.on('unhandledRejection', (reason, promise) => {
  console.error('未处理的Promise拒绝:', reason)
}) 