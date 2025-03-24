const { app, BrowserWindow, dialog } = require('electron')
const path = require('path')
const fs = require('fs')
const isDev = process.env.NODE_ENV === 'development'

// 检查文件是否存在
function fileExists(filePath) {
  try {
    return fs.existsSync(filePath)
  } catch (error) {
    console.error(`检查文件存在出错: ${error.message}`)
    return false
  }
}

// 列出目录内容
function listDirectory(dirPath) {
  try {
    if (fs.existsSync(dirPath)) {
      const files = fs.readdirSync(dirPath)
      console.log(`目录 ${dirPath} 的内容:`, files)
      return files
    }
    return []
  } catch (error) {
    console.error(`列出目录内容出错: ${error.message}`)
    return []
  }
}

// 获取图标路径
function getIconPath() {
  const iconPaths = [
    path.join(__dirname, 'build', 'icon.ico'),
    path.join(process.resourcesPath || __dirname, 'build', 'icon.ico'),
    path.join(app.getAppPath(), 'build', 'icon.ico'),
    path.join(__dirname, '..', 'build', 'icon.ico')
  ]

  for (const iconPath of iconPaths) {
    if (fileExists(iconPath)) {
      console.log('找到图标文件:', iconPath)
      return iconPath
    }
  }
  
  console.log('未找到图标文件，使用默认图标')
  return undefined
}

async function createWindow() {
  // 输出重要的路径信息
  console.log('=== 应用程序路径信息 ===')
  console.log(`应用程序路径: ${app.getAppPath()}`)
  console.log(`当前工作目录: ${process.cwd()}`)
  console.log(`__dirname: ${__dirname}`)
  console.log(`用户数据目录: ${app.getPath('userData')}`)
  console.log(`可执行文件目录: ${app.getPath('exe')}`)
  console.log('========================')
  
  // 创建日志目录
  const logDir = path.join(app.getPath('userData'), 'logs')
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true })
  }
  
  // 设置日志文件
  const logFile = path.join(logDir, `app-${new Date().toISOString().split('T')[0]}.log`)
  const logStream = fs.createWriteStream(logFile, { flags: 'a' })
  
  // 重定向控制台输出到文件
  const originalConsoleLog = console.log
  const originalConsoleError = console.error
  
  console.log = (...args) => {
    const message = args.map(arg => 
      typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
    ).join(' ')
    const logMessage = `${new Date().toISOString()} [INFO] ${message}\n`
    logStream.write(logMessage)
    originalConsoleLog.apply(console, args)
  }
  
  console.error = (...args) => {
    const message = args.map(arg => 
      typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
    ).join(' ')
    const logMessage = `${new Date().toISOString()} [ERROR] ${message}\n`
    logStream.write(logMessage)
    originalConsoleError.apply(console, args)
  }

  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    frame: true,
    autoHideMenuBar: true,
    icon: getIconPath(),
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
      } catch (e) {
        if (retries < 3) {
          console.log(`重试加载开发服务器 (${retries + 1}/3)...`)
          await new Promise(resolve => setTimeout(resolve, 1000))
          await tryLoad(retries + 1)
        } else {
          console.error('无法连接到开发服务器:', e)
          dialog.showErrorBox('开发服务器错误', '无法连接到开发服务器，请确保已运行 yarn dev')
        }
      }
    }
    await tryLoad()
  } else {
    // 生产环境下加载打包后的文件
    const possiblePaths = [
      path.join(__dirname, 'dist', 'index.html'),
      path.join(process.resourcesPath, 'dist', 'index.html'),
      path.join(app.getAppPath(), 'dist', 'index.html'),
      path.join(__dirname, '..', 'dist', 'index.html')
    ]
    
    console.log('=== 尝试加载的路径 ===')
    for (const p of possiblePaths) {
      console.log(`${p} - 存在: ${fileExists(p)}`)
    }
    console.log('=====================')
    
    let loaded = false
    
    for (const indexPath of possiblePaths) {
      if (fileExists(indexPath)) {
        const dirPath = path.dirname(indexPath)
        console.log(`检查目录 ${dirPath} 的内容:`)
        listDirectory(dirPath)
        
        try {
          await mainWindow.loadFile(indexPath)
          console.log('成功加载:', indexPath)
          loaded = true
          break
        } catch (e) {
          console.error(`加载 ${indexPath} 失败:`, e)
        }
      }
    }
    
    if (!loaded) {
      console.error('所有路径加载失败')
      dialog.showErrorBox('加载错误', '无法找到应用程序文件，请确保应用程序已正确安装。')
      mainWindow.webContents.loadURL(`data:text/html;charset=utf-8,
        <html>
          <head>
            <title>加载错误</title>
            <meta charset="utf-8">
            <style>
              body {
                font-family: 'Microsoft YaHei', sans-serif;
                padding: 20px;
                background: #f5f5f5;
              }
              .error-container {
                background: white;
                padding: 20px;
                border-radius: 8px;
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
              }
              pre {
                background: #f8f8f8;
                padding: 10px;
                border-radius: 4px;
                overflow-x: auto;
              }
            </style>
          </head>
          <body>
            <div class="error-container">
              <h1>应用程序加载失败</h1>
              <p>无法找到应用程序文件。尝试过以下路径：</p>
              <pre>${possiblePaths.join('\n')}</pre>
              <p>请确保应用程序已正确安装。</p>
            </div>
          </body>
        </html>
      `)
    }
  }

  // 错误处理
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error('页面加载失败:', errorDescription)
    if (isDev) {
      setTimeout(() => mainWindow.reload(), 1000)
    } else {
      dialog.showErrorBox('加载错误', `页面加载失败: ${errorDescription}`)
    }
  })
}

// 应用程序准备就绪时创建窗口
app.whenReady().then(createWindow)

// 所有窗口关闭时退出应用（macOS除外）
app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit()
})

// 在macOS上点击dock图标时重新创建窗口
app.on('activate', function () {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})

// 未捕获的异常处理
process.on('uncaughtException', (error) => {
  console.error('未捕获的异常:', error)
  dialog.showErrorBox('应用程序错误', `未捕获的异常: ${error.message}`)
})

process.on('unhandledRejection', (reason, promise) => {
  console.error('未处理的Promise拒绝:', reason)
}) 