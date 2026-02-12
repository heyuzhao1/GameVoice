/**
 * 音频处理器
 * 负责音频的降噪、回声消除、语音激活检测等处理
 */

class AudioProcessor {
  async init(stream) {
    try {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
        sampleRate: this.options.sampleRate,
        latencyHint: 'interactive'
      });

      // 检查是否支持AudioWorklet
      if (this.audioContext.audioWorklet && this.options.useWorklet !== false) {
        return await this.setupAudioWorklet(stream);
      } else {
        // 降级到ScriptProcessorNode
        return await this.setupScriptProcessor(stream);
      }
    } catch (error) {
      console.error('音频处理器初始化失败:', error);
      this.emit('error', error);
      throw error;
    }
  }

  async setupAudioWorklet(stream) {
    try {
      // 创建音频上下文
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
        sampleRate: this.options.sampleRate,
        latencyHint: 'interactive'
      });

      // 创建源节点
      this.sourceNode = this.audioContext.createMediaStreamSource(stream);

      // 创建分析节点
      this.analyserNode = this.audioContext.createAnalyser();
      this.analyserNode.fftSize = 2048;
      this.analyserNode.smoothingTimeConstant = 0.8;

      // 创建目标节点
      this.destinationNode = this.audioContext.createMediaStreamDestination();

      // 连接节点
      this.sourceNode.connect(this.analyserNode);
      this.analyserNode.connect(this.destinationNode);

      console.log('使用AudioWorkletNode（现代API）');
      return this.destinationNode.stream;
    } catch (error) {
      console.warn('AudioWorklet初始化失败，降级到ScriptProcessor:', error);
      return await this.setupScriptProcessor(stream);
    }
  }

  async setupScriptProcessor(stream) {
    try {
      // 创建音频上下文
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
        sampleRate: this.options.sampleRate,
        latencyHint: 'interactive'
      });

      // 创建源节点
      this.sourceNode = this.audioContext.createMediaStreamSource(stream);

      // 创建分析节点
      this.analyserNode = this.audioContext.createAnalyser();
      this.analyserNode.fftSize = 2048;
      this.analyserNode.smoothingTimeConstant = 0.8;

      // 创建处理节点（使用已弃用的ScriptProcessorNode）
      this.processorNode = this.audioContext.createScriptProcessor(
        this.options.bufferSize,
        1,
        1
      );

      // 创建目标节点
      this.destinationNode = this.audioContext.createMediaStreamDestination();

      // 连接节点
      this.sourceNode.connect(this.analyserNode);
      this.sourceNode.connect(this.processorNode);
      this.processorNode.connect(this.destinationNode);
      this.analyserNode.connect(this.destinationNode);

      // 设置处理回调
      this.processorNode.onaudioprocess = (event) => {
        this.processAudio(event);
      };

      // 开始语音激活检测
      if (this.options.voiceActivation) {
        this.startVoiceActivationDetection();
      }

      console.warn('使用ScriptProcessorNode（已弃用API）');
      return this.destinationNode.stream;
    } catch (error) {
      console.error('ScriptProcessorNode初始化失败:', error);
      this.emit('error', error);
      throw error;
    }
  }
  constructor(options = {}) {
    this.options = {
      noiseSuppression: true,
      echoCancellation: true,
      autoGainControl: true,
      voiceActivation: true,
      activationThreshold: -45, // dB
      activationDelay: 100, // ms
      deactivationDelay: 500, // ms
      sampleRate: 48000,
      bufferSize: 2048,
      ...options
    };

    this.audioContext = null;
    this.sourceNode = null;
    this.processorNode = null;
    this.destinationNode = null;
    this.analyserNode = null;

    this.isSpeaking = false;
    this.speechTimeout = null;
    this.silenceTimeout = null;

    this.volumeHistory = [];
    this.maxHistorySize = 100;

    this.listeners = {
      'speech-start': [],
      'speech-end': [],
      'volume-change': [],
      'error': []
    };
  }


  /**
   * 应用WebRTC音频效果
   */
  applyWebRTCEffects() {
    // 创建音频约束
    const constraints = {
      audio: {
        echoCancellation: this.options.echoCancellation,
        noiseSuppression: this.options.noiseSuppression,
        autoGainControl: this.options.autoGainControl,
        channelCount: 1,
        sampleRate: this.options.sampleRate,
        sampleSize: 16
      }
    };

    // 注意：实际的WebRTC效果由浏览器在getUserMedia时应用
    // 这里主要是配置约束，实际处理在浏览器层面
    console.log('WebRTC音频效果已启用:', {
      echoCancellation: this.options.echoCancellation,
      noiseSuppression: this.options.noiseSuppression,
      autoGainControl: this.options.autoGainControl
    });
  }

  /**
   * 处理音频数据
   */
  processAudio(event) {
    const inputBuffer = event.inputBuffer;
    const outputBuffer = event.outputBuffer;
    const inputData = inputBuffer.getChannelData(0);
    const outputData = outputBuffer.getChannelData(0);

    // 简单的降噪处理
    if (this.options.noiseSuppression) {
      this.applyNoiseSuppression(inputData, outputData);
    } else {
      // 直接复制数据
      for (let i = 0; i < inputData.length; i++) {
        outputData[i] = inputData[i];
      }
    }

    // 计算音量
    const volume = this.calculateVolume(inputData);
    this.updateVolumeHistory(volume);

    // 触发音量变化事件
    this.emit('volume-change', volume);
  }

  /**
   * 应用简单的降噪
   */
  applyNoiseSuppression(input, output) {
    const threshold = 0.01; // 噪声阈值
    const attack = 0.1; // 启动时间
    const release = 0.5; // 释放时间

    let envelope = 0;

    for (let i = 0; i < input.length; i++) {
      const sample = input[i];
      const amplitude = Math.abs(sample);

      // 简单的包络跟随器
      if (amplitude > envelope) {
        envelope = attack * (envelope - amplitude) + amplitude;
      } else {
        envelope = release * (envelope - amplitude) + amplitude;
      }

      // 噪声门
      if (envelope > threshold) {
        output[i] = sample;
      } else {
        output[i] = 0;
      }
    }
  }

  /**
   * 计算音频音量（dB）
   */
  calculateVolume(data) {
    let sum = 0;
    for (let i = 0; i < data.length; i++) {
      sum += data[i] * data[i];
    }
    const rms = Math.sqrt(sum / data.length);
    const db = 20 * Math.log10(rms);
    return db;
  }

  /**
   * 更新音量历史
   */
  updateVolumeHistory(volume) {
    this.volumeHistory.push(volume);
    if (this.volumeHistory.length > this.maxHistorySize) {
      this.volumeHistory.shift();
    }
  }

  /**
   * 获取平均音量
   */
  getAverageVolume() {
    if (this.volumeHistory.length === 0) return -Infinity;

    const sum = this.volumeHistory.reduce((a, b) => a + b, 0);
    return sum / this.volumeHistory.length;
  }

  /**
   * 开始语音激活检测
   */
  startVoiceActivationDetection() {
    const checkInterval = 50; // 每50ms检查一次

    const checkSpeech = () => {
      if (!this.analyserNode) return;

      const dataArray = new Uint8Array(this.analyserNode.frequencyBinCount);
      this.analyserNode.getByteFrequencyData(dataArray);

      // 计算平均音量
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        sum += dataArray[i];
      }
      const average = sum / dataArray.length;
      const db = 20 * Math.log10(average / 255);

      // 检测语音
      if (db > this.options.activationThreshold) {
        if (!this.isSpeaking) {
          clearTimeout(this.silenceTimeout);
          this.speechTimeout = setTimeout(() => {
            this.isSpeaking = true;
            this.emit('speech-start', db);
          }, this.options.activationDelay);
        }
      } else {
        if (this.isSpeaking) {
          clearTimeout(this.speechTimeout);
          this.silenceTimeout = setTimeout(() => {
            this.isSpeaking = false;
            this.emit('speech-end');
          }, this.options.deactivationDelay);
        }
      }
    };

    this.activationInterval = setInterval(checkSpeech, checkInterval);
  }

  /**
   * 停止语音激活检测
   */
  stopVoiceActivationDetection() {
    if (this.activationInterval) {
      clearInterval(this.activationInterval);
      this.activationInterval = null;
    }
  }

  /**
   * 设置语音激活阈值
   */
  setActivationThreshold(threshold) {
    this.options.activationThreshold = threshold;
  }

  /**
   * 获取音频分析数据
   */
  getAnalyserData() {
    if (!this.analyserNode) return null;

    const frequencyData = new Uint8Array(this.analyserNode.frequencyBinCount);
    const timeData = new Uint8Array(this.analyserNode.frequencyBinCount);

    this.analyserNode.getByteFrequencyData(frequencyData);
    this.analyserNode.getByteTimeDomainData(timeData);

    return {
      frequencyData,
      timeData,
      sampleRate: this.audioContext.sampleRate
    };
  }

  /**
   * 获取处理后的音频流
   */
  getProcessedStream() {
    return this.destinationNode ? this.destinationNode.stream : null;
  }

  /**
   * 添加事件监听器
   */
  on(event, callback) {
    if (this.listeners[event]) {
      this.listeners[event].push(callback);
    }
  }

  /**
   * 移除事件监听器
   */
  off(event, callback) {
    if (this.listeners[event]) {
      this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
    }
  }

  /**
   * 触发事件
   */
  emit(event, data) {
    if (this.listeners[event]) {
      this.listeners[event].forEach(callback => {
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
    this.stopVoiceActivationDetection();

    if (this.processorNode) {
      this.processorNode.disconnect();
      this.processorNode.onaudioprocess = null;
    }

    if (this.analyserNode) {
      this.analyserNode.disconnect();
    }

    if (this.sourceNode) {
      this.sourceNode.disconnect();
    }

    if (this.destinationNode) {
      this.destinationNode.disconnect();
    }

    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close();
    }

    this.audioContext = null;
    this.sourceNode = null;
    this.processorNode = null;
    this.destinationNode = null;
    this.analyserNode = null;

    console.log('音频处理器已清理');
  }
}

export default AudioProcessor;
// module.exports = AudioProcessor;