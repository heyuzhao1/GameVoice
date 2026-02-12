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

  const handleMuteToggle = () => {
    toggleMute()
  }

  const handleJoinRoom = async () => {
    setJoinError('')
    const rid = localRoomId.trim()

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
      if (room && room.id) setLocalRoomId(room.id)
    } catch (err) {
      setJoinError('创建房间失败: ' + err.message)
    } finally {
      setIsJoining(false)
    }
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

  // 显示加载状态
  if (isLoading) {
    return (
      <div
        className="min-h-screen bg-gradient-to-br from-gray-900 to-black text-white flex items-center justify-center"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          background: '#111',
          color: 'white',
        }}
      >
        <div className="text-center">
          <div
            className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"
            style={{
              width: '64px',
              height: '64px',
              border: '4px solid #3b82f6',
              borderTopColor: 'transparent',
              borderRadius: '50%',
              margin: '0 auto 16px',
            }}
          ></div>
          <div className="text-lg font-medium">正在初始化语音应用...</div>
          {error && (
            <div
              className="mt-4 text-red-400"
              style={{ color: '#f87171', marginTop: '16px' }}
            >
              错误: {error}
            </div>
          )}
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
          <button
            onClick={() => (showSettings ? closeSettings() : openSettings())}
            className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="container mx-auto px-6 py-8">
        {/* 主内容区 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* 左侧：房间控制 */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 border border-gray-700">
              <h2 className="text-xl font-bold mb-4 flex items-center">
                <Users className="w-6 h-6 mr-2" />
                房间控制
              </h2>

              {!isConnected ? (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      房间ID
                    </label>
                    <input
                      type="text"
                      value={localRoomId}
                      onChange={(e) => setLocalRoomId(e.target.value)}
                      placeholder="输入房间ID"
                      className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <button
                    onClick={handleJoinRoom}
                    disabled={!localRoomId.trim() || isJoining}
                    className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed rounded-lg font-medium transition-colors flex items-center justify-center"
                  >
                    {isJoining ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                        正在加入...
                      </>
                    ) : (
                      '加入房间'
                    )}
                  </button>
                  <button
                    onClick={handleCreateRoom}
                    disabled={isJoining}
                    className="w-full py-3 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-medium transition-colors"
                  >
                    创建随机房间
                  </button>
                  {joinError && (
                    <div className="text-red-400 text-sm text-center bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                      {joinError}
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold mb-2">
                      房间 #{roomId}
                    </div>
                    <div className="text-gray-400">
                      {activeUsers.length} 人在线
                    </div>
                  </div>
                  <button
                    onClick={handleLeaveRoom}
                    className="w-full py-3 bg-red-600 hover:bg-red-700 rounded-lg font-medium transition-colors"
                  >
                    离开房间
                  </button>
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
            </div>

            {/* 连接统计 */}
            <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 border border-gray-700">
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
            </div>
          </div>

          {/* 右侧：用户列表 */}
          <div className="lg:col-span-2">
            <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 border border-gray-700">
              <h2 className="text-xl font-bold mb-6">
                在线用户 ({activeUsers.length})
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {activeUsers.map((user) => (
                  <div
                    key={user.id}
                    className={`p-4 rounded-xl border transition-all ${user.speaking ? 'bg-green-500/10 border-green-500/30' : 'bg-gray-900/50 border-gray-700'}`}
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
                        className="h-full bg-green-500 rounded-full transition-all"
                        style={{ width: `${user.volume}%` }}
                      />
                    </div>

                    {/* 用户状态 */}
                    <div className="flex items-center justify-between mt-3 text-sm text-gray-400">
                      <span>{user.speaking ? '正在说话...' : '静音中'}</span>
                      <span>ID: {user.id}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* 空状态 */}
              {activeUsers.length === 0 && (
                <div className="text-center py-12">
                  <Users className="w-16 h-16 mx-auto text-gray-600 mb-4" />
                  <h3 className="text-xl font-medium mb-2">暂无用户在线</h3>
                  <p className="text-gray-400">
                    加入房间后，其他用户将显示在这里
                  </p>
                </div>
              )}
            </div>

            {/* 快速操作 */}
            <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
              <button className="p-4 bg-gray-800/50 backdrop-blur-sm rounded-xl border border-gray-700 hover:bg-gray-700/50 transition-colors text-center">
                <div className="text-2xl mb-2">🎤</div>
                <div className="text-sm">语音激活</div>
              </button>
              <button className="p-4 bg-gray-800/50 backdrop-blur-sm rounded-xl border border-gray-700 hover:bg-gray-700/50 transition-colors text-center">
                <div className="text-2xl mb-2">🔇</div>
                <div className="text-sm">降噪</div>
              </button>
              <button className="p-4 bg-gray-800/50 backdrop-blur-sm rounded-xl border border-gray-700 hover:bg-gray-700/50 transition-colors text-center">
                <div className="text-2xl mb-2">📊</div>
                <div className="text-sm">统计</div>
              </button>
              <button className="p-4 bg-gray-800/50 backdrop-blur-sm rounded-xl border border-gray-700 hover:bg-gray-700/50 transition-colors text-center">
                <div className="text-2xl mb-2">⚙️</div>
                <div className="text-sm">高级</div>
              </button>
            </div>
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
              <div>
                <label className="block text-sm font-medium mb-2">
                  音频输入设备
                </label>
                <select
                  value={selectedDevice}
                  onChange={handleDeviceChange}
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-blue-500"
                  disabled={isLoadingDevices}
                >
                  {isLoadingDevices ? (
                    <option>加载设备中...</option>
                  ) : (
                    audioDevices.map((device) => (
                      <option key={device.deviceId} value={device.deviceId}>
                        {device.label ||
                          `音频设备 ${device.deviceId.slice(0, 8)}`}
                      </option>
                    ))
                  )}
                </select>
              </div>

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
