/**
 * React Hook for VoiceApp integration
 * 将VoiceApp核心功能集成到React组件中
 */

import { useState, useEffect, useCallback, useRef } from 'react';
// import VoiceApp from '../src/voice-app'; // Static import

// 创建VoiceApp实例的工厂函数
const createVoiceApp = async () => {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    // 动态导入VoiceApp
    const module = await import('../src/voice-app.js');
    const VoiceApp = module.default || module; // Handle default or named export

    // 创建实例
    const voiceApp = new VoiceApp({
      userId: `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userName: `玩家${Math.floor(Math.random() * 1000)}`
    });

    // 初始化
    await voiceApp.init();

    return voiceApp;
  } catch (error) {
    console.error('创建VoiceApp失败:', error);
    throw error; // Throw error to be caught by caller
  }
};

/**
 * 语音应用主Hook
 */
export function useVoiceApp() {
  const [voiceApp, setVoiceApp] = useState(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // 应用状态
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

  // 音频设备
  const [audioDevices, setAudioDevices] = useState([]);
  const [selectedDevice, setSelectedDevice] = useState('');
  const [isLoadingDevices, setIsLoadingDevices] = useState(false);

  // 音频控制
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(80);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [localVolume, setLocalVolume] = useState(-45);

  // 设置
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState({
    audioQuality: 'balanced',
    enableLowLatency: true,
    enableAutoReconnect: true,
    useTurnServer: false,
    voiceActivation: true,
    noiseSuppression: true,
    echoCancellation: true,
    enableAnimations: true
  });

  // 性能统计
  const [performanceStats, setPerformanceStats] = useState({
    cpuUsage: 0,
    memoryUsage: 0,
    networkUsage: 0,
    audioLatency: 0
  });

  // 引用
  const voiceAppRef = useRef(null);
  const statsIntervalRef = useRef(null);
  const perfIntervalRef = useRef(null);

  /**
   * 初始化VoiceApp
   */
  const initVoiceApp = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const app = await createVoiceApp();
      if (!app) {
        throw new Error('无法创建VoiceApp实例');
      }

      voiceAppRef.current = app;
      setVoiceApp(app);

      // 设置事件监听
      setupEventListeners(app);

      // 获取音频设备
      await refreshAudioDevices(app);

      setIsInitialized(true);
      setIsLoading(false);

      console.log('VoiceApp初始化成功');
    } catch (err) {
      console.error('VoiceApp初始化失败:', err);
      setError(err.message);
      setIsLoading(false);
    }
  }, []);

  /**
   * 设置事件监听
   */
  const setupEventListeners = useCallback((app) => {
    if (!app) return;

    // 连接状态变化
    app.on('room-joined', (room) => {
      setIsConnected(true);
      setRoomId(room.id);
      updateActiveUsers(app);
    });

    app.on('room-left', () => {
      setIsConnected(false);
      setRoomId('');
      setActiveUsers([]);
    });

    // 活跃用户更新
    app.on('active-users-updated', (users) => {
      setActiveUsers(users);
    });

    // 音频事件
    app.on('speech-detected', (data) => {
      if (data.type === 'start') {
        setIsSpeaking(true);
        setLocalVolume(data.volume);
      } else if (data.type === 'end') {
        setIsSpeaking(false);
      }
    });

    app.on('mute-toggled', (muted) => {
      setIsMuted(muted);
    });

    app.on('volume-changed', (newVolume) => {
      setVolume(newVolume);
    });

    app.on('device-changed', (deviceId) => {
      setSelectedDevice(deviceId);
    });

    // 错误处理
    app.on('error', (error) => {
      console.error('VoiceApp错误:', error);
      setError(error.message);
    });
  }, []);

  /**
   * 刷新音频设备
   */
  const refreshAudioDevices = useCallback(async (app) => {
    if (!app) return;

    setIsLoadingDevices(true);
    try {
      const devices = app.getAudioDevices();
      setAudioDevices(devices);

      if (devices.length > 0 && !selectedDevice) {
        setSelectedDevice(devices[0].deviceId);
      }
    } catch (err) {
      console.error('获取音频设备失败:', err);
    } finally {
      setIsLoadingDevices(false);
    }
  }, [selectedDevice]);

  /**
   * 更新活跃用户
   */
  const updateActiveUsers = useCallback((app) => {
    if (!app) return;

    const state = app.getState();
    setActiveUsers(state.activeUsers || []);
  }, []);

  /**
   * 更新连接统计
   */
  const updateConnectionStats = useCallback(() => {
    if (!voiceAppRef.current) return;

    const stats = voiceAppRef.current.getConnectionStats();
    setConnectionStats(stats);
  }, []);

  /**
   * 更新性能统计
   */
  const updatePerformanceStats = useCallback(() => {
    // 模拟性能数据
    setPerformanceStats({
      cpuUsage: Math.floor(Math.random() * 10) + 1,
      memoryUsage: Math.floor(Math.random() * 50) + 50,
      networkUsage: Math.floor(Math.random() * 100) + 50,
      audioLatency: Math.floor(Math.random() * 20) + 10
    });
  }, []);

  /**
   * 加入房间
   */
  const joinRoom = useCallback(async (roomId) => {
    if (!voiceAppRef.current) {
      console.error('VoiceApp未初始化');
      return false;
    }

    try {
      await voiceAppRef.current.joinRoom(roomId);
      return true;
    } catch (err) {
      console.error('加入房间失败:', err);
      setError(err.message);
      return false;
    }
  }, []);

  /**
   * 创建房间（可选指定roomId）
   */
  const createRoom = useCallback(async (roomId = null) => {
    if (!voiceAppRef.current) {
      console.error('VoiceApp未初始化');
      return null;
    }
    try {
      const room = await voiceAppRef.current.createRoom(roomId);
      return room;
    } catch (err) {
      console.error('创建房间失败:', err);
      setError(err.message);
      return null;
    }
  }, []);

  /**
   * 离开房间
   */
  const leaveRoom = useCallback(async () => {
    if (!voiceAppRef.current) {
      console.error('VoiceApp未初始化');
      return false;
    }

    try {
      await voiceAppRef.current.leaveRoom();
      return true;
    } catch (err) {
      console.error('离开房间失败:', err);
      setError(err.message);
      return false;
    }
  }, []);

  /**
   * 切换静音
   */
  const toggleMute = useCallback(() => {
    if (!voiceAppRef.current) {
      console.error('VoiceApp未初始化');
      return false;
    }

    const muted = voiceAppRef.current.toggleMute();
    setIsMuted(muted);
    return muted;
  }, []);

  /**
   * 改变音量
   */
  const changeVolume = useCallback((newVolume) => {
    if (!voiceAppRef.current) {
      console.error('VoiceApp未初始化');
      return 0;
    }

    const volume = voiceAppRef.current.setVolume(newVolume);
    setVolume(volume);
    return volume;
  }, []);

  /**
   * 选择音频设备
   */
  const selectDevice = useCallback(async (deviceId) => {
    if (!voiceAppRef.current) {
      console.error('VoiceApp未初始化');
      return false;
    }

    try {
      const success = await voiceAppRef.current.setAudioDevice(deviceId);
      if (success) {
        setSelectedDevice(deviceId);
      }
      return success;
    } catch (err) {
      console.error('切换音频设备失败:', err);
      setError(err.message);
      return false;
    }
  }, []);

  /**
   * 更新设置
   */
  const updateSetting = useCallback((key, value) => {
    setSettings(prev => ({
      ...prev,
      [key]: value
    }));
  }, []);

  /**
   * 保存设置
   */
  const saveSettings = useCallback(() => {
    // 这里应该将设置保存到本地存储
    localStorage.setItem('gamevoice-settings', JSON.stringify(settings));
    setShowSettings(false);
    console.log('设置已保存:', settings);
  }, [settings]);

  /**
   * 打开设置
   */
  const openSettings = useCallback(() => {
    setShowSettings(true);
  }, []);

  /**
   * 关闭设置
   */
  const closeSettings = useCallback(() => {
    setShowSettings(false);
  }, []);

  /**
   * 更新用户说话状态
   */
  const updateUserSpeaking = useCallback((peerId, speaking) => {
    // 这里应该通过VoiceApp更新用户状态
    console.log(`更新用户说话状态: ${peerId} -> ${speaking}`);
  }, []);

  /**
   * 更新用户音量
   */
  const updateUserVolume = useCallback((peerId, volume) => {
    // 这里应该通过VoiceApp更新用户音量
    console.log(`更新用户音量: ${peerId} -> ${volume}`);
  }, []);

  // 初始化效果
  useEffect(() => {
    initVoiceApp();

    return () => {
      // 清理资源
      if (voiceAppRef.current) {
        voiceAppRef.current.cleanup();
      }

      if (statsIntervalRef.current) {
        clearInterval(statsIntervalRef.current);
      }

      if (perfIntervalRef.current) {
        clearInterval(perfIntervalRef.current);
      }
    };
  }, [initVoiceApp]);

  // 设置定时器
  useEffect(() => {
    if (!isInitialized) return;

    // 连接统计更新
    statsIntervalRef.current = setInterval(() => {
      updateConnectionStats();
    }, 3000);

    // 性能统计更新
    perfIntervalRef.current = setInterval(() => {
      updatePerformanceStats();
    }, 5000);

    return () => {
      if (statsIntervalRef.current) {
        clearInterval(statsIntervalRef.current);
      }
      if (perfIntervalRef.current) {
        clearInterval(perfIntervalRef.current);
      }
    };
  }, [isInitialized, updateConnectionStats, updatePerformanceStats]);

  // 加载设置
  useEffect(() => {
    const savedSettings = localStorage.getItem('gamevoice-settings');
    if (savedSettings) {
      try {
        setSettings(JSON.parse(savedSettings));
      } catch (err) {
        console.error('加载设置失败:', err);
      }
    }
  }, []);

  return {
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
    refreshDevices: () => refreshAudioDevices(voiceAppRef.current),

    // 音频控制
    isMuted,
    volume,
    isSpeaking,
    localVolume,
    toggleMute,
    changeVolume,
    updateSpeakingState: (speaking, volumeDb) => {
      setIsSpeaking(speaking);
      if (speaking) {
        setLocalVolume(volumeDb);
      }
    },

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

    // 原始实例（高级用途）
    voiceApp: voiceAppRef.current
  };
}
