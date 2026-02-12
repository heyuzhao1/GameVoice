import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

// 性能监控
const startTime = performance.now()

// 错误边界
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true }
  }

  componentDidCatch(error, errorInfo) {
    console.error('GameVoice UI错误:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gray-900 flex items-center justify-center">
          <div className="text-center p-8">
            <div className="text-4xl mb-4">😢</div>
            <h1 className="text-2xl font-bold text-white mb-2">出错了</h1>
            <p className="text-gray-400 mb-6">
              应用程序遇到问题，请刷新页面重试
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition-colors"
            >
              刷新页面
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

// 性能优化：延迟加载非关键资源
const loadCriticalResources = () => {
  // 预加载关键资源
  const preloadLinks = [
    // 可以在这里添加预加载的资源
  ]

  preloadLinks.forEach((href) => {
    const link = document.createElement('link')
    link.rel = 'preload'
    link.href = href
    link.as = 'fetch'
    document.head.appendChild(link)
  })
}

// 启动应用
const startApp = () => {
  // 检查WebRTC支持
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    console.error('浏览器不支持WebRTC或媒体设备')
    // 显示错误提示
    const errorDiv = document.createElement('div')
    errorDiv.className =
      'fixed inset-0 bg-gray-900 flex items-center justify-center z-50'
    errorDiv.innerHTML = `
      <div class="bg-gray-800 rounded-2xl p-8 max-w-md text-center">
        <div class="text-4xl mb-4">🚫</div>
        <h1 class="text-2xl font-bold text-white mb-4">浏览器不支持</h1>
        <p class="text-gray-400 mb-6">
          您的浏览器不支持WebRTC或媒体设备功能。<br>
          请使用最新版本的Chrome、Firefox或Edge浏览器。
        </p>
        <div class="space-y-3">
          <a href="https://www.google.com/chrome/" class="block px-4 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition-colors">
            下载 Chrome
          </a>
          <a href="https://www.mozilla.org/firefox/" class="block px-4 py-3 bg-orange-600 hover:bg-orange-700 rounded-lg font-medium transition-colors">
            下载 Firefox
          </a>
        </div>
      </div>
    `
    document.body.appendChild(errorDiv)
    return
  }

  // 创建根元素
  const rootElement = document.getElementById('root')
  if (!rootElement) {
    console.error('找不到根元素')
    return
  }

  // 使用React 18的createRoot API
  const root = ReactDOM.createRoot(rootElement)

  // 渲染应用
  root.render(
    <React.StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </React.StrictMode>,
  )

  const loadingScreen = document.getElementById('loading')
  if (loadingScreen) {
    loadingScreen.style.opacity = '0'
    setTimeout(() => {
      loadingScreen.style.display = 'none'
    }, 300)
  }

  // 记录启动时间
  const endTime = performance.now()
  console.log(
    `GameVoice UI启动完成，耗时: ${(endTime - startTime).toFixed(2)}ms`,
  )

  // 注册Service Worker（生产环境）
  if (import.meta.env.PROD && 'serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/service-worker.js').catch((error) => {
        console.log('Service Worker注册失败:', error)
      })
    })
  }
}

// 等待DOM加载完成
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    loadCriticalResources()
    startApp()
  })
} else {
  loadCriticalResources()
  startApp()
}

// 性能监控
window.addEventListener('load', () => {
  // 报告性能指标
  const perfEntries = performance.getEntriesByType('navigation')
  if (perfEntries.length > 0) {
    const navEntry = perfEntries[0]
    console.log('性能指标:', {
      DNS查询时间: navEntry.domainLookupEnd - navEntry.domainLookupStart,
      TCP连接时间: navEntry.connectEnd - navEntry.connectStart,
      请求响应时间: navEntry.responseEnd - navEntry.requestStart,
      DOM解析时间:
        navEntry.domContentLoadedEventEnd - navEntry.domContentLoadedEventStart,
      页面完全加载时间: navEntry.loadEventEnd - navEntry.loadEventStart,
    })
  }
})

// 错误监控
window.addEventListener('error', (event) => {
  console.error('全局错误:', event.error)
  // 这里可以添加错误上报逻辑
})

// 未处理的Promise rejection
window.addEventListener('unhandledrejection', (event) => {
  console.error('未处理的Promise rejection:', event.reason)
  // 这里可以添加错误上报逻辑
})

// 导出给Electron使用
if (window.require) {
  try {
    const { ipcRenderer } = window.require('electron')

    // 监听Electron事件
    ipcRenderer.on('app-command', (event, command) => {
      console.log('收到Electron命令:', command)
      // 处理Electron命令
    })

    // 发送就绪信号
    ipcRenderer.send('renderer-ready')
  } catch (e) {
    console.error('Electron IPC初始化失败:', e)
  }
}

// 开发环境热重载
if (import.meta.hot) {
  import.meta.hot.accept('./App', () => {
    console.log('App组件热更新')
  })
}
