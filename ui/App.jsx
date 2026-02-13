import React, { useState, useEffect, useRef } from 'react'
import {
  Mic,
  MicOff,
  Users,
  Settings,
  Volume2,
  Wifi,
  Battery,
  Clock,
  Headphones,
} from 'lucide-react'
import { useVoiceApp } from './voice-app-hook'
import {
  Skeleton,
  AnimatedButton,
  Card,
  FadeIn,
  AnimatedInput,
} from './components/UIComponents'

const AudioDeviceSelector = ({
  audioDevices,
  selectedDevice,
  handleDeviceChange,
  isLoadingDevices,
  refreshDevices,
}) => (
  <div>
    <label className="block text-sm font-medium mb-2 flex justify-between items-center">
      音频输入设备
      <button
        onClick={() => refreshDevices && refreshDevices()}
        className="text-xs text-blue-400 hover:text-blue-300 flex items-center"
        type="button"
        disabled={isLoadingDevices}
      >
        {isLoadingDevices ? (
          <span className="w-3 h-3 border-2 border-blue-400 border-t-transparent rounded-full animate-spin mr-1"></span>
        ) : null}
        刷新
      </button>
    </label>
    <select
      value={selectedDevice || ''}
      onChange={handleDeviceChange}
      className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg focus:outline-none focus:border-blue-500 text-white disabled:opacity-60"
      disabled={isLoadingDevices}
    >
      {isLoadingDevices && audioDevices.length === 0 ? (
        <option value="">正在检测设备...</option>
      ) : audioDevices.length === 0 ? (
        <option value="">未找到音频输入设备</option>
      ) : (
        audioDevices.map((device) => (
          <option key={device.deviceId} value={device.deviceId}>
            {device.label || `音频设备 ${device.deviceId.slice(0, 8)}`}
          </option>
        ))
      )}
    </select>
  </div>
)

const App = () => {
  const {
    // 状态
    isInitialized,
    isLoading,
    error,

    // 连接状态
    isConnected,
    roomId,
    activeUsers,
    connectionStats,

    // 音频设备
    audioDevices,
    selectedDevice,
    isLoadingDevices,
    selectDevice,
    refreshDevices, // 假设 hook 导出了 refreshDevices，如果没有需要检查 hook

    // 音频控制
    isMuted,
    volume,
    isSpeaking,
    localVolume,
    toggleMute,
    changeVolume,

    // 设置
    showSettings,
    settings,
    openSettings,
    closeSettings,
    updateSetting,
    saveSettings,

    // 性能
    performanceStats,

    // 功能函数
    createRoom,
    joinRoom,
    leaveRoom,
    updateUserSpeaking,
    updateUserVolume,
  } = useVoiceApp()

  const [localRoomId, setLocalRoomId] = useState('')
  const [joinError, setJoinError] = useState('')
  const [isJoining, setIsJoining] = useState(false)
  const pendingJoinRef = useRef(null)

  // 监听深度链接自动加入
  useEffect(() => {
    if (window.electronAPI && window.electronAPI.onJoinRoomViaLink) {
      window.electronAPI.onJoinRoomViaLink((roomId) => {
        console.log('通过链接自动加入房间:', roomId)
        setLocalRoomId(roomId)
        if (isInitialized) {
          handleJoinRoom(roomId)
        } else {
          pendingJoinRef.current = roomId
        }
      })
    }
  }, [isInitialized])

  useEffect(() => {
    if (isInitialized && pendingJoinRef.current) {
      handleJoinRoom(pendingJoinRef.current)
      pendingJoinRef.current = null
    }
  }, [isInitialized])

  const handleMuteToggle = () => {
    toggleMute()
  }

  const handleJoinRoom = async (overrideRoomId = null) => {
    setJoinError('')
    const rid = (
      typeof overrideRoomId === 'string' ? overrideRoomId : localRoomId
    ).trim()

    if (!rid) {
      setJoinError('请输入房间ID')
      return
    }

    if (!/^[a-zA-Z0-9_-]+$/.test(rid)) {
      setJoinError('房间ID只能包含字母、数字、下划线和连字符')
      return
    }

    if (rid.length > 32) {
      setJoinError('房间ID过长')
      return
    }

    try {
      setIsJoining(true)
      await joinRoom(rid)
    } catch (err) {
      console.error('UI捕获到加入房间错误:', err)
      let msg = err.message || '加入房间失败'
      if (err.code === 'ROOM_NOT_FOUND') {
        msg = '房间不存在，请检查ID或创建新房间'
      } else if (err.message.includes('超时')) {
        msg = '连接超时，请检查网络'
      }
      setJoinError(msg)
    } finally {
      setIsJoining(false)
    }
  }

  const handleCreateRoom = async () => {
    setJoinError('')
    try {
      setIsJoining(true)
      const room = await createRoom()
      if (room && room.id) {
        setLocalRoomId(room.id)
        // 注意：createRoom现在会自动加入，或者我们可以在这里手动加入
        // 取决于 createRoom 的实现。如果 createRoom 返回 room 对象且已经触发了 room-joined，则不需要做任何事
        // 如果 createRoom 只是创建了房间，我们需要加入
        // 根据之前的修改，createRoom 会触发 room-created，然后服务器发送 room-joined
        // 所以不需要额外操作
      }
    } catch (err) {
      setJoinError('创建房间失败: ' + err.message)
    } finally {
      setIsJoining(false)
    }
  }

  const copyInviteLink = () => {
    // 确保 roomId 存在
    if (!roomId) return

    // 直接复制房间号
    navigator.clipboard
      .writeText(roomId)
      .then(() => {
        // 简单的反馈
        const btn = document.getElementById('copy-link-btn')
        if (btn) {
          btn.innerText = '已复制'
          setTimeout(() => {
            btn.innerText = '复制房间号'
          }, 2000)
        }
      })
      .catch((err) => {
        console.error('复制失败:', err)
        // 如果 clipboard API 失败，尝试 execCommand 降级方案
        const textArea = document.createElement('textarea')
        textArea.value = roomId
        document.body.appendChild(textArea)
        textArea.select()
        try {
          document.execCommand('copy')
          const btn = document.getElementById('copy-link-btn')
          if (btn) {
            btn.innerText = '已复制!'
            setTimeout(() => {
              btn.innerText = '复制房间号'
            }, 2000)
          }
        } catch (e) {
          console.error('降级复制也失败:', e)
        }
        document.body.removeChild(textArea)
      })
  }

  const handleLeaveRoom = async () => {
    await leaveRoom()
  }

  const handleVolumeChange = (e) => {
    const newVolume = parseInt(e.target.value)
    changeVolume(newVolume)
  }

  const handleDeviceChange = (e) => {
    selectDevice(e.target.value)
  }

  // 显示加载状态 (骨架屏)
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex flex-col animate-fade-in">
        <div className="h-16 border-b border-gray-800 flex items-center px-6 bg-gray-900/50 backdrop-blur-sm">
          <Skeleton width="120px" height="24px" className="mr-auto" />
          <div className="flex space-x-4">
            <Skeleton width="80px" height="20px" />
            <Skeleton width="80px" height="20px" />
            <Skeleton width="32px" height="32px" circle />
          </div>
        </div>
        <div className="container mx-auto p-8 grid grid-cols-1 lg:grid-cols-3 gap-8 flex-1">
          <div className="lg:col-span-1 space-y-6">
            <Skeleton height="300px" className="rounded-2xl" />
            <Skeleton height="150px" className="rounded-2xl" />
          </div>
          <div className="lg:col-span-2">
            <Skeleton height="400px" className="rounded-2xl" />
            <div className="mt-6 grid grid-cols-4 gap-4">
              <Skeleton height="80px" className="rounded-xl" />
              <Skeleton height="80px" className="rounded-xl" />
              <Skeleton height="80px" className="rounded-xl" />
              <Skeleton height="80px" className="rounded-xl" />
            </div>
          </div>
        </div>
      </div>
    )
  }

  // 显示错误状态
  if (error && !isInitialized) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 to-black text-white flex items-center justify-center">
        <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-8 max-w-md text-center border border-gray-700">
          <div className="text-4xl mb-4">😢</div>
          <h1 className="text-2xl font-bold text-white mb-4">初始化失败</h1>
          <p className="text-gray-400 mb-6">
            无法初始化语音应用。请检查浏览器权限并刷新页面重试。
          </p>
          <div className="text-red-400 mb-6">{error}</div>
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-black text-white">
      {/* 顶部状态栏 */}
      <FadeIn enableAnimations={settings.enableAnimations} direction="down">
        <div className="flex items-center justify-between px-6 py-3 bg-gray-800/50 backdrop-blur-sm border-b border-gray-700">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <Volume2 className="w-5 h-5 text-green-400" />
              <span className="text-sm font-medium">GameVoice</span>
            </div>
            <div
              className={`px-3 py-1 rounded-full text-xs ${isConnected ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}
            >
              {isConnected ? '已连接' : '未连接'}
            </div>
          </div>

          <div className="flex items-center space-x-6">
            <div className="flex items-center space-x-2">
              <Wifi className="w-4 h-4" />
              <span className="text-sm">{connectionStats.latency}ms</span>
            </div>
            <div className="flex items-center space-x-2">
              <Clock className="w-4 h-4" />
              <span className="text-sm">{connectionStats.bandwidth}kbps</span>
            </div>
            <AnimatedButton
              variant="ghost"
              onClick={() => (showSettings ? closeSettings() : openSettings())}
              className="p-2 hover:bg-gray-700 rounded-lg"
              enableAnimations={settings.enableAnimations}
            >
              <Settings className="w-5 h-5" />
            </AnimatedButton>
          </div>
        </div>
      </FadeIn>

      <div className="container mx-auto px-6 py-8">
        {/* 主内容区 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* 左侧：房间控制 */}
          <FadeIn
            className="lg:col-span-1 space-y-6"
            delay={100}
            enableAnimations={settings.enableAnimations}
          >
            <Card className="p-6" enableAnimations={settings.enableAnimations}>
              <h2 className="text-xl font-bold mb-4 flex items-center">
                <Users className="w-6 h-6 mr-2" />
                房间控制
              </h2>

              {!isConnected ? (
                <div className="space-y-4">
                  {/* 音频设备选择器 */}
                  <div className="p-3 bg-gray-900 rounded-lg border border-gray-700">
                    <AudioDeviceSelector
                      audioDevices={audioDevices}
                      selectedDevice={selectedDevice}
                      handleDeviceChange={handleDeviceChange}
                      isLoadingDevices={isLoadingDevices}
                      refreshDevices={refreshDevices}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      房间ID
                    </label>
                    <AnimatedInput
                      type="text"
                      value={localRoomId}
                      onChange={(e) => setLocalRoomId(e.target.value)}
                      placeholder="输入房间ID"
                      enableAnimations={settings.enableAnimations}
                    />
                  </div>
                  <AnimatedButton
                    onClick={handleJoinRoom}
                    disabled={!localRoomId.trim() || isJoining}
                    variant="primary"
                    className="w-full py-3"
                    enableAnimations={settings.enableAnimations}
                  >
                    {isJoining ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                        正在加入...
                      </>
                    ) : (
                      '加入房间'
                    )}
                  </AnimatedButton>
                  <AnimatedButton
                    onClick={handleCreateRoom}
                    disabled={isJoining}
                    variant="secondary"
                    className="w-full py-3"
                    enableAnimations={settings.enableAnimations}
                  >
                    创建随机房间
                  </AnimatedButton>
                  {joinError && (
                    <FadeIn
                      className="text-red-400 text-sm text-center bg-red-500/10 border border-red-500/20 rounded-lg p-3"
                      enableAnimations={settings.enableAnimations}
                    >
                      {joinError}
                    </FadeIn>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold mb-2">
                      房间 #{roomId}
                    </div>
                    <button
                      id="copy-link-btn"
                      onClick={copyInviteLink}
                      className="text-sm bg-blue-600/20 text-blue-400 px-3 py-1 rounded-full hover:bg-blue-600/30 transition-colors mb-2"
                    >
                      复制房间号
                    </button>
                    <div className="text-gray-400">
                      {activeUsers.length} 人在线
                    </div>
                  </div>
                  <AnimatedButton
                    onClick={handleLeaveRoom}
                    variant="danger"
                    className="w-full py-3"
                    enableAnimations={settings.enableAnimations}
                  >
                    离开房间
                  </AnimatedButton>
                </div>
              )}

              {/* 麦克风控制 */}
              <div className="mt-8 pt-8 border-t border-gray-700">
                <div className="flex items-center justify-between mb-4">
                  <span className="font-medium">
                    麦克风{' '}
                    {isSpeaking && (
                      <span className="text-green-400 text-sm">(正在说话)</span>
                    )}
                  </span>
                  <button
                    onClick={handleMuteToggle}
                    className={`p-3 rounded-full transition-colors ${isMuted ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'}`}
                  >
                    {isMuted ? (
                      <MicOff className="w-6 h-6" />
                    ) : (
                      <Mic className="w-6 h-6" />
                    )}
                  </button>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-400">音量</span>
                    <span className="text-sm">{volume}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={volume}
                    onChange={handleVolumeChange}
                    className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white"
                  />
                </div>
              </div>
            </Card>

            {/* 连接统计 */}
            <Card className="p-6" enableAnimations={settings.enableAnimations}>
              <h3 className="font-bold mb-4">连接统计</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-400">延迟</span>
                  <span
                    className={
                      connectionStats.latency < 50
                        ? 'text-green-400'
                        : 'text-yellow-400'
                    }
                  >
                    {connectionStats.latency}ms
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">丢包率</span>
                  <span
                    className={
                      connectionStats.packetLoss < 0.1
                        ? 'text-green-400'
                        : 'text-red-400'
                    }
                  >
                    {(connectionStats.packetLoss * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">带宽</span>
                  <span className="text-blue-400">
                    {connectionStats.bandwidth}kbps
                  </span>
                </div>
              </div>
            </Card>
          </FadeIn>

          {/* 右侧：用户列表 */}
          <div className="lg:col-span-2">
            <FadeIn delay={200} enableAnimations={settings.enableAnimations}>
              <Card
                className="p-6"
                enableAnimations={settings.enableAnimations}
              >
                <h2 className="text-xl font-bold mb-6">
                  在线用户 ({activeUsers.length})
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {activeUsers.map((user) => (
                    <Card
                      key={user.id}
                      hover={true}
                      enableAnimations={settings.enableAnimations}
                      className={`p-4 border transition-all ${user.speaking ? 'bg-green-500/10 border-green-500/30' : 'bg-gray-900/50 border-gray-700'}`}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center space-x-3">
                          <div
                            className={`w-3 h-3 rounded-full ${user.speaking ? 'bg-green-500 animate-pulse' : 'bg-gray-500'}`}
                          />
                          <span className="font-medium">{user.name}</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Volume2 className="w-4 h-4" />
                          <span className="text-sm">{user.volume}%</span>
                        </div>
                      </div>

                      {/* 音量条 */}
                      <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-green-500 rounded-full transition-all duration-100 ease-linear"
                          style={{ width: `${user.volume}%` }}
                        />
                      </div>

                      {/* 用户状态 */}
                      <div className="flex items-center justify-between mt-3 text-sm text-gray-400">
                        <span>{user.speaking ? '正在说话...' : '静音中'}</span>
                        <span>ID: {user.id}</span>
                      </div>
                    </Card>
                  ))}
                </div>

                {/* 空状态 */}
                {activeUsers.length === 0 && (
                  <div className="text-center py-12">
                    <Users className="w-16 h-16 mx-auto text-gray-600 mb-4 animate-float" />
                    <h3 className="text-xl font-medium mb-2">暂无用户在线</h3>
                    <p className="text-gray-400">
                      加入房间后，其他用户将显示在这里
                    </p>
                  </div>
                )}
              </Card>
            </FadeIn>

            {/* 快速操作 */}
            <FadeIn
              className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4"
              delay={300}
              enableAnimations={settings.enableAnimations}
            >
              {['🎤 语音激活', '🔇 降噪', '📊 统计', '⚙️ 高级'].map(
                (item, i) => (
                  <AnimatedButton
                    key={i}
                    variant="outline"
                    className="p-4 flex-col h-auto"
                    enableAnimations={settings.enableAnimations}
                  >
                    <div className="text-2xl mb-2">{item.split(' ')[0]}</div>
                    <div className="text-sm">{item.split(' ')[1]}</div>
                  </AnimatedButton>
                ),
              )}
            </FadeIn>
          </div>
        </div>
      </div>

      {/* 设置面板 */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-gray-900 rounded-2xl p-6 w-full max-w-md border border-gray-700">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold">设置</h2>
              <button
                onClick={closeSettings}
                className="p-2 hover:bg-gray-800 rounded-lg"
              >
                ✕
              </button>
            </div>

            <div className="space-y-6">
              <AudioDeviceSelector
                audioDevices={audioDevices}
                selectedDevice={selectedDevice}
                handleDeviceChange={handleDeviceChange}
                isLoadingDevices={isLoadingDevices}
                refreshDevices={refreshDevices}
              />

              <div>
                <label className="block text-sm font-medium mb-2">
                  音频质量
                </label>
                <select className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-blue-500">
                  <option>高音质 (128kbps)</option>
                  <option>平衡 (64kbps)</option>
                  <option>低延迟 (32kbps)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  网络优化
                </label>
                <div className="space-y-2">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      className="mr-2"
                      checked={settings.enableAnimations}
                      onChange={(e) =>
                        updateSetting('enableAnimations', e.target.checked)
                      }
                    />
                    <span className="text-sm">启用界面动画</span>
                  </label>
                  <label className="flex items-center">
                    <input type="checkbox" className="mr-2" defaultChecked />
                    <span className="text-sm">启用低延迟模式</span>
                  </label>
                  <label className="flex items-center">
                    <input type="checkbox" className="mr-2" defaultChecked />
                    <span className="text-sm">自动重连</span>
                  </label>
                  <label className="flex items-center">
                    <input type="checkbox" className="mr-2" />
                    <span className="text-sm">使用TURN服务器</span>
                  </label>
                </div>
              </div>

              <button
                onClick={saveSettings}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition-colors"
              >
                保存设置
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 底部状态栏 */}
      <div className="fixed bottom-0 left-0 right-0 bg-gray-900/80 backdrop-blur-sm border-t border-gray-800 px-6 py-3">
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <Battery className="w-4 h-4" />
              <span>
                CPU: {performanceStats.cpuUsage}% | 内存:{' '}
                {performanceStats.memoryUsage}MB
              </span>
            </div>
            <div className="text-gray-400">v0.1.0</div>
          </div>
          <div className="text-gray-400">
            GameVoice © 2024 - 专为游戏玩家设计
          </div>
        </div>
      </div>
    </div>
  )
}

export default App
