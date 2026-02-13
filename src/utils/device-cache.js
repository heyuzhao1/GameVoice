/**
 * 设备缓存管理器
 * 负责音频设备列表的缓存和持久化
 */
class DeviceCacheManager {
  constructor() {
    this.CACHE_KEY = 'gamevoice-audio-devices';
    this.CACHE_EXPIRY = 24 * 60 * 60 * 1000; // 24小时过期
  }

  /**
   * 保存设备列表到缓存
   * @param {Array} devices 设备列表
   */
  saveDevices(devices) {
    if (!devices || !Array.isArray(devices)) return;

    // 只缓存必要的字段
    const cachedData = {
      timestamp: Date.now(),
      devices: devices.map(d => ({
        deviceId: d.deviceId,
        kind: d.kind,
        label: d.label,
        groupId: d.groupId
      }))
    };

    try {
      localStorage.setItem(this.CACHE_KEY, JSON.stringify(cachedData));
    } catch (e) {
      console.warn('保存设备缓存失败:', e);
    }
  }

  /**
   * 获取缓存的设备列表
   * @returns {Array|null} 设备列表或null
   */
  getCachedDevices() {
    try {
      const data = localStorage.getItem(this.CACHE_KEY);
      if (!data) return null;

      const parsed = JSON.parse(data);
      
      // 检查是否过期
      if (Date.now() - parsed.timestamp > this.CACHE_EXPIRY) {
        localStorage.removeItem(this.CACHE_KEY);
        return null;
      }

      return parsed.devices;
    } catch (e) {
      console.warn('读取设备缓存失败:', e);
      return null;
    }
  }

  /**
   * 清除缓存
   */
  clearCache() {
    localStorage.removeItem(this.CACHE_KEY);
  }
}

export default new DeviceCacheManager();
