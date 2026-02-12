/**
 * React Hooks for Voice Application
 * 提供语音应用的状态管理和业务逻辑
 */

import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * 语音连接状态管理Hook
 */
export function useVoiceConnection() {
  const [isConnected, setIsConnected] = useState(false);
  const [roomId, setRoomId] = useState('');
  const [activeUsers, setActiveUsers] = useState([]);
  const [connectionStats, setConnectionStats] = useState({
    latency: 0,
    packetLoss: 0,
    bandwidth: 0,
    bytesSent: 0,
    bytesReceived: 0
  });

  const connectionRef = useRef(null);

  // 模拟连接状态更新
  useEffect(() => {
    if (isConnected) {
      const interval = setInterval(() => {
        setConnectionStats(prev => ({
          ...prev,
          latency: Math.floor(Math.random() * 30) + 10,
          packetLoss: Math.random() * 0.5,
          bandwidth: Math.floor(Math.random() * 500) + 100
        }));
      }, 3000);

      return () => clearInterval(interval);
    }
  }, [isConnected]);

  const joinRoom = useCallback((roomId) => {
    if (!roomId.trim()) {
      console.error('房间ID不能为空');
      return false;
    }

    // 模拟加入房间
    setRoomId(roomId);
    setIsConnected(true);

    // 模拟用户列表
    const mockUsers = [
      { id: 1, name: '玩家1', speaking: true, volume: 85, peerId: 'peer1' },
      { id: 2, name: '玩家2', speaking: false, volume: 70, peerId: 'peer2' },
      { id: 3, name: '玩家3', speaking: true, volume: 90, peerId: 'peer3' },
      { id: 4, name: '玩家4', speaking: false, volume: 60, peerId: 'peer4' }
    ];
    setActiveUsers(mockUsers);

    console.log(`加入房间: ${roomId}`);
    return true;
  }, []);

  const leaveRoom = useCallback(() => {
    setIsConnected(false);
    setActiveUsers([]);
    setRoomId('');
    console.log('离开房间');
  }, []);

  const updateUserSpeaking = useCallback((peerId, speaking) => {
    setActiveUsers(prev => prev.map(user =>
      user.peerId === peerId ? { ...user, speaking } : user
    ));
  }, []);

  const updateUserVolume = useCallback((peerId, volume) => {
    setActiveUsers(prev => prev.map(user =>
      user.peerId === peerId ? { ...user, volume } : user
    ));
  }, []);

  const addUser = useCallback((user) => {
    setActiveUsers(prev => [...prev, user]);
  }, []);

  const removeUser = useCallback((peerId) => {
    setActiveUsers(prev => prev.filter(user => user.peerId !== peerId));
  }, []);

  return {
    isConnected,
    roomId,
    activeUsers,
    connectionStats,
    joinRoom,
    leaveRoom,
    updateUserSpeaking,
    updateUserVolume,
    addUser,
    removeUser,
    setConnectionStats
  };
}

/**
 * 音频设备管理Hook
 */
export function useAudioDevices() {
  const [audioDevices, setAudioDevices] = useState([]);
  const [selectedDevice, setSelectedDevice] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const refreshDevices = useCallback(async () => {
    setIsLoading(true);
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioInputs = devices.filter(device => device.kind === 'audioinput');
      setAudioDevices(audioInputs);

      if (audioInputs.length > 0 && !selectedDevice) {
        setSelectedDevice(audioInputs[0].deviceId);
      }
    } catch (error) {
      console.error('获取音频设备失败:', error);
    } finally {
      setIsLoading(false);
    }
  }, [selectedDevice]);

  useEffect(() => {
    refreshDevices();

    // 监听设备变化
    navigator.mediaDevices.addEventListener('devicechange', refreshDevices);
    return () => {
      navigator.mediaDevices.removeEventListener('devicechange', refreshDevices);
    };
  }, [refreshDevices]);

  const selectDevice = useCallback((deviceId) => {
    setSelectedDevice(deviceId);
  }, []);

  return {
    audioDevices,
    selectedDevice,
    isLoading,
    refreshDevices,
    selectDevice
  };
}

/**
 * 音频控制Hook
 */
export function useAudioControl() {
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(80);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [localVolume, setLocalVolume] = useState(-45); // dB

  const toggleMute = useCallback(() => {
    const newMutedState = !isMuted;
    setIsMuted(newMutedState);

    // 这里应该调用实际的音频控制
    console.log(`麦克风 ${newMutedState ? '已静音' : '已取消静音'}`);

    return newMutedState;
  }, [isMuted]);

  const changeVolume = useCallback((newVolume) => {
    const clampedVolume = Math.max(0, Math.min(100, newVolume));
    setVolume(clampedVolume);

    // 这里应该调用实际的音量控制
    console.log(`音量设置为: ${clampedVolume}%`);

    return clampedVolume;
  }, []);

  const updateSpeakingState = useCallback((speaking, volumeDb = -45) => {
    setIsSpeaking(speaking);
    if (speaking) {
      setLocalVolume(volumeDb);
    }
  }, []);

  return {
    isMuted,
    volume,
    isSpeaking,
    localVolume,
    toggleMute,
    changeVolume,
    updateSpeakingState
  };
}

/**
 * 设置面板管理Hook
 */
export function useSettings() {
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState({
    audioQuality: 'high', // high, balanced, low-latency
    enableLowLatency: true,
    enableAutoReconnect: true,
    useTurnServer: false,
    voiceActivation: true,
    noiseSuppression: true,
    echoCancellation: true
  });

  const openSettings = useCallback(() => {
    setShowSettings(true);
  }, []);

  const closeSettings = useCallback(() => {
    setShowSettings(false);
  }, []);

  const updateSetting = useCallback((key, value) => {
    setSettings(prev => ({
      ...prev,
      [key]: value
    }));
  }, []);

  const saveSettings = useCallback(() => {
    // 这里应该保存设置到本地存储或服务器
    console.log('保存设置:', settings);
    closeSettings();
  }, [settings, closeSettings]);

  return {
    showSettings,
    settings,
    openSettings,
    closeSettings,
    updateSetting,
    saveSettings
  };
}

/**
 * 性能监控Hook
 */
export function usePerformanceMonitor() {
  const [performanceStats, setPerformanceStats] = useState({
    cpuUsage: 0,
    memoryUsage: 0,
    networkUsage: 0,
    audioLatency: 0
  });

  useEffect(() => {
    // 模拟性能数据更新
    const interval = setInterval(() => {
      setPerformanceStats({
        cpuUsage: Math.floor(Math.random() * 10) + 1,
        memoryUsage: Math.floor(Math.random() * 50) + 50,
        networkUsage: Math.floor(Math.random() * 100) + 50,
        audioLatency: Math.floor(Math.random() * 20) + 10
      });
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  return {
    performanceStats
  };
}

/**
 * 语音应用主Hook
 * 整合所有功能
 */
export function useVoiceApp() {
  const connection = useVoiceConnection();
  const audioDevices = useAudioDevices();
  const audioControl = useAudioControl();
  const settings = useSettings();
  const performance = usePerformanceMonitor();

  // 整合的加入房间函数
  const handleJoinRoom = useCallback((roomId) => {
    const success = connection.joinRoom(roomId);
    if (success) {
      // 这里可以添加音频初始化逻辑
      console.log('房间加入成功，初始化音频...');
    }
    return success;
  }, [connection]);

  // 整合的离开房间函数
  const handleLeaveRoom = useCallback(() => {
    connection.leaveRoom();
    // 这里可以添加音频清理逻辑
    console.log('离开房间，清理音频...');
  }, [connection]);

  return {
    // 连接状态
    isConnected: connection.isConnected,
    roomId: connection.roomId,
    activeUsers: connection.activeUsers,
    connectionStats: connection.connectionStats,

    // 音频设备
    audioDevices: audioDevices.audioDevices,
    selectedDevice: audioDevices.selectedDevice,
    isLoadingDevices: audioDevices.isLoading,
    refreshDevices: audioDevices.refreshDevices,
    selectDevice: audioDevices.selectDevice,

    // 音频控制
    isMuted: audioControl.isMuted,
    volume: audioControl.volume,
    isSpeaking: audioControl.isSpeaking,
    localVolume: audioControl.localVolume,
    toggleMute: audioControl.toggleMute,
    changeVolume: audioControl.changeVolume,
    updateSpeakingState: audioControl.updateSpeakingState,

    // 设置
    showSettings: settings.showSettings,
    settings: settings.settings,
    openSettings: settings.openSettings,
    closeSettings: settings.closeSettings,
    updateSetting: settings.updateSetting,
    saveSettings: settings.saveSettings,

    // 性能
    performanceStats: performance.performanceStats,

    // 整合的函数
    joinRoom: handleJoinRoom,
    leaveRoom: handleLeaveRoom,
    updateUserSpeaking: connection.updateUserSpeaking,
    updateUserVolume: connection.updateUserVolume,
    addUser: connection.addUser,
    removeUser: connection.removeUser
  };
}