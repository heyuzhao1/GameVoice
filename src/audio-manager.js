/**
 * 音频管理器
 * 负责音频设备的获取、音频流的创建和管理
 */

import AudioProcessor from '../audio/audio-processor';
import deviceCache from './utils/device-cache';

class AudioManager {
  constructor() {
    this.audioContext = null;
    this.audioProcessor = null;
    this.localStream = null;
    this.remoteStreams = new Map(); // peerId -> stream
    this.audioElements = new Map(); // peerId -> audio element

    this.isMuted = false;
    this.isSpeaking = false;
    this.volume = 80; // 0-100

    // 初始化时尝试从缓存加载设备
    this.audioDevices = deviceCache.getCachedDevices() || [];
    this.selectedDeviceId = '';
    this.isDetectingDevices = false;

    this.eventListeners = {
      'local-stream-ready': [],
      'remote-stream-added': [],
      'remote-stream-removed': [],
      'speech-detected': [],
      'volume-changed': [],
      'device-changed': [],
      'detecting-devices': [], // 新增事件
      'error': []
    };

    // 监听设备热插拔
    if (navigator.mediaDevices && navigator.mediaDevices.ondevicechange !== undefined) {
      navigator.mediaDevices.ondevicechange = () => {
        console.log('检测到设备变更，自动刷新...');
        this.refreshAudioDevices();
      };
    }
  }

  /**
   * 初始化音频管理器
   */
  async init() {
    try {
      // 如果缓存中有设备，先触发一次更新，让UI显示缓存数据
      if (this.audioDevices.length > 0) {
        this.emit('device-changed', this.audioDevices);
      }

      // 异步刷新设备列表
      this.refreshAudioDevices();

      console.log('音频管理器初始化完成');
      return true;
    } catch (error) {
      console.error('音频管理器初始化失败:', error);
      this.emit('error', error);
      return false;
    }
  }

  /**
   * 刷新音频设备列表
   * @param {number} retryCount 重试次数
   */
  async refreshAudioDevices(retryCount = 0) {
    if (this.isDetectingDevices) return;
    
    this.isDetectingDevices = true;
    this.emit('detecting-devices', true);

    try {
      let devices = await navigator.mediaDevices.enumerateDevices();
      let audioInputs = devices.filter(device => device.kind === 'audioinput');

      // 检查是否有设备且标签为空 (说明无权限)
      // 或者列表完全为空 (可能是权限导致无法枚举)
      const hasEmptyLabels = audioInputs.some(d => d.deviceId !== 'default' && !d.label);
      const isEmptyList = audioInputs.length === 0;

      if (hasEmptyLabels || isEmptyList) {
        console.log('检测到设备列表为空或标签为空，尝试请求权限...');
        try {
          // 临时请求一次流以触发权限弹窗
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          
          // 获取成功后立即关闭流
          stream.getTracks().forEach(track => track.stop());
          
          // 再次枚举，此时应该有 label 了
          devices = await navigator.mediaDevices.enumerateDevices();
          audioInputs = devices.filter(device => device.kind === 'audioinput');
        } catch (err) {
          console.warn('请求权限失败，只能显示默认名称', err);
          
          // 失败重试机制
          if (retryCount < 2) {
            console.log(`重试获取设备 (${retryCount + 1}/2)...`);
            this.isDetectingDevices = false;
            setTimeout(() => this.refreshAudioDevices(retryCount + 1), 1000);
            return;
          }
        }
      }

      this.audioDevices = audioInputs;
      
      // 更新缓存
      if (audioInputs.length > 0 && !hasEmptyLabels) {
        deviceCache.saveDevices(audioInputs);
      }

      if (this.audioDevices.length > 0 && !this.selectedDeviceId) {
        this.selectedDeviceId = this.audioDevices[0].deviceId;
      }

      this.emit('device-changed', this.audioDevices);
      return this.audioDevices;
    } catch (error) {
      console.error('获取音频设备失败:', error);
      // 出错时也尝试重试
      if (retryCount < 2) {
        this.isDetectingDevices = false;
        setTimeout(() => this.refreshAudioDevices(retryCount + 1), 1000);
        return;
      }
      throw error;
    } finally {
      this.isDetectingDevices = false;
      this.emit('detecting-devices', false);
    }
  }

  /**
   * 获取本地音频流
   */
  async getLocalStream(constraints = {}) {
    try {
      const defaultConstraints = {
        audio: {
          deviceId: this.selectedDeviceId ? { exact: this.selectedDeviceId } : undefined,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
          sampleRate: 48000
        },
        video: false
      };

      const mergedConstraints = {
        audio: { ...defaultConstraints.audio, ...constraints.audio },
        video: false
      };

      this.localStream = await navigator.mediaDevices.getUserMedia(mergedConstraints);

      // 初始化音频处理器
      this.audioProcessor = new AudioProcessor();
      const processedStream = await this.audioProcessor.init(this.localStream);

      // 设置音频处理器事件监听
      this.audioProcessor.on('speech-start', (db) => {
        this.isSpeaking = true;
        this.emit('speech-detected', { type: 'start', volume: db });
      });

      this.audioProcessor.on('speech-end', () => {
        this.isSpeaking = false;
        this.emit('speech-detected', { type: 'end' });
      });

      this.audioProcessor.on('volume-change', (volume) => {
        this.emit('volume-changed', volume);
      });

      console.log('本地音频流获取成功');
      this.emit('local-stream-ready', processedStream);

      return processedStream;
    } catch (error) {
      console.error('获取本地音频流失败:', error);
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * 停止本地音频流
   */
  stopLocalStream() {
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }

    if (this.audioProcessor) {
      this.audioProcessor.cleanup();
      this.audioProcessor = null;
    }

    this.isSpeaking = false;
    console.log('本地音频流已停止');
  }

  /**
   * 添加远程音频流
   */
  addRemoteStream(peerId, stream) {
    if (!stream || !peerId) {
      console.error('无效的远程音频流参数');
      return false;
    }

    // 创建音频元素
    const audioElement = document.createElement('audio');
    audioElement.autoplay = true;
    audioElement.volume = this.volume / 100;

    // 设置音频源
    audioElement.srcObject = stream;

    // 添加到文档中（隐藏）
    audioElement.style.display = 'none';
    document.body.appendChild(audioElement);

    // 存储引用
    this.remoteStreams.set(peerId, stream);
    this.audioElements.set(peerId, audioElement);

    console.log(`远程音频流已添加: ${peerId}`);
    this.emit('remote-stream-added', { peerId, stream });

    return true;
  }

  /**
   * 移除远程音频流
   */
  removeRemoteStream(peerId) {
    const audioElement = this.audioElements.get(peerId);
    if (audioElement) {
      audioElement.pause();
      audioElement.srcObject = null;
      audioElement.remove();
    }

    this.remoteStreams.delete(peerId);
    this.audioElements.delete(peerId);

    console.log(`远程音频流已移除: ${peerId}`);
    this.emit('remote-stream-removed', peerId);
  }

  /**
   * 设置音频设备
   */
  async setAudioDevice(deviceId) {
    if (this.selectedDeviceId === deviceId) {
      return true;
    }

    this.selectedDeviceId = deviceId;

    // 如果正在使用音频流，重新获取
    if (this.localStream) {
      const wasMuted = this.isMuted;
      this.stopLocalStream();

      try {
        await this.getLocalStream();

        // 恢复静音状态
        if (wasMuted) {
          this.setMuted(true);
        }

        this.emit('device-changed', this.audioDevices);
        return true;
      } catch (error) {
        console.error('切换音频设备失败:', error);
        this.emit('error', error);
        return false;
      }
    }

    return true;
  }

  /**
   * 设置静音状态
   */
  setMuted(muted) {
    this.isMuted = muted;

    if (this.localStream) {
      this.localStream.getAudioTracks().forEach(track => {
        track.enabled = !muted;
      });
    }

    console.log(`麦克风 ${muted ? '已静音' : '已取消静音'}`);
    return true;
  }

  /**
   * 切换静音状态
   */
  toggleMute() {
    this.setMuted(!this.isMuted);
    return this.isMuted;
  }

  /**
   * 设置音量
   */
  setVolume(volume) {
    const newVolume = Math.max(0, Math.min(100, volume));
    this.volume = newVolume;

    // 更新所有远程音频元素的音量
    this.audioElements.forEach(audioElement => {
      audioElement.volume = newVolume / 100;
    });

    this.emit('volume-changed', newVolume);
    return newVolume;
  }

  /**
   * 获取音频分析数据
   */
  getAnalyserData() {
    if (this.audioProcessor) {
      return this.audioProcessor.getAnalyserData();
    }
    return null;
  }

  /**
   * 获取音频设备列表
   */
  getAudioDevices() {
    return [...this.audioDevices];
  }

  /**
   * 获取当前音频设备
   */
  getCurrentDevice() {
    return this.audioDevices.find(device => device.deviceId === this.selectedDeviceId);
  }

  /**
   * 获取本地音频流
   */
  getLocalAudioStream() {
    return this.localStream;
  }

  /**
   * 获取处理后的音频流
   */
  getProcessedStream() {
    if (this.audioProcessor) {
      return this.audioProcessor.getProcessedStream();
    }
    return this.localStream;
  }

  /**
   * 检查是否正在说话
   */
  isUserSpeaking() {
    return this.isSpeaking;
  }

  /**
   * 检查是否静音
   */
  isUserMuted() {
    return this.isMuted;
  }

  /**
   * 获取当前音量
   */
  getCurrentVolume() {
    return this.volume;
  }

  /**
   * 添加事件监听器
   */
  on(event, callback) {
    if (this.eventListeners[event]) {
      this.eventListeners[event].push(callback);
    }
  }

  /**
   * 移除事件监听器
   */
  off(event, callback) {
    if (this.eventListeners[event]) {
      this.eventListeners[event] = this.eventListeners[event].filter(cb => cb !== callback);
    }
  }

  /**
   * 触发事件
   */
  emit(event, data) {
    if (this.eventListeners[event]) {
      this.eventListeners[event].forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`事件 ${event} 回调错误:`, error);
        }
      });
    }
  }

  /**
   * 清理资源
   */
  cleanup() {
    // 停止本地音频流
    this.stopLocalStream();

    // 移除所有远程音频流
    this.remoteStreams.forEach((stream, peerId) => {
      this.removeRemoteStream(peerId);
    });

    // 清理音频设备
    this.audioDevices = [];
    this.selectedDeviceId = '';

    console.log('音频管理器资源已清理');
  }
}

export default AudioManager;
// module.exports = AudioManager;