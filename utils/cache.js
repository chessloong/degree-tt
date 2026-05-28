class CacheService {
  constructor() {
    this.systemFields = ['__v', 'sync_timestamp', 'updated_at', 'created_at', 'createdAt', 'updatedAt', '_openid']
  }

  getExpireMinutes(appConfig, cacheKey) {
    if (!appConfig) {
      return 10
    }
    const expireConfig = appConfig.expireMinute || {}
    return expireConfig[cacheKey] || expireConfig.default || 10
  }

  getObjectCache(key, appConfig = {}) {
    try {
      const cached = tt.getStorageSync(key)
      if (!cached) {
        console.log(`[缓存] 对象缓存 ${key} 不存在`)
        return null
      }

      const parsed = JSON.parse(cached)
      const now = Date.now()
      const expireMinutes = this.getExpireMinutes(appConfig, key)

      if (!parsed.timestamp) {
        console.log(`[缓存] 对象缓存 ${key} 无时间戳，视为无效`)
        tt.removeStorageSync(key)
        return null
      }

      const elapsedMinutes = Math.floor((now - parsed.timestamp) / 60000)

      if (elapsedMinutes < expireMinutes) {
        console.log(`[缓存] 对象缓存 ${key} 命中 - 存在 ${elapsedMinutes} 分钟，有效期 ${expireMinutes} 分钟`)
        return parsed.data
      }

      console.log(`[缓存] 对象缓存 ${key} 已过期 - 存在 ${elapsedMinutes} 分钟，有效期 ${expireMinutes} 分钟`)
      tt.removeStorageSync(key)
      return null
    } catch (err) {
      console.error(`[缓存] 读取对象缓存 ${key} 失败:`, err)
      return null
    }
  }

  setObjectCache(key, data, keepId = false) {
    try {
      const cleanedData = this.cleanSystemFields(data, keepId)
      const cacheObject = {
        data: cleanedData,
        timestamp: Date.now()
      }
      tt.setStorageSync(key, JSON.stringify(cacheObject))
      console.log(`[缓存] 对象缓存 ${key} 已保存`)
    } catch (err) {
      console.error(`[缓存] 设置对象缓存 ${key} 失败:`, err)
    }
  }

  getArrayCacheItem(cacheKey, itemKey, itemValue, appConfig = {}) {
    try {
      const cached = tt.getStorageSync(cacheKey)
      if (!cached) {
        console.log(`[缓存] 数组缓存 ${cacheKey} 不存在`)
        return null
      }

      const cacheArray = JSON.parse(cached)
      if (!Array.isArray(cacheArray)) {
        console.log(`[缓存] 数组缓存 ${cacheKey} 不是数组格式`)
        return null
      }

      const cachedItem = cacheArray.find(item => item[itemKey] === itemValue)
      if (!cachedItem) {
        console.log(`[缓存] 数组缓存 ${cacheKey} 中未找到 ${itemKey}=${itemValue}`)
        return null
      }

      const expireMinutes = this.getExpireMinutes(appConfig, cacheKey)
      const now = Date.now()
      const elapsedMinutes = Math.floor((now - cachedItem.timestamp) / 60000)

      if (elapsedMinutes < expireMinutes) {
        console.log(`[缓存] 数组缓存 ${cacheKey} 中 ${itemKey}=${itemValue} 命中 - 存在 ${elapsedMinutes} 分钟，有效期 ${expireMinutes} 分钟`)
        return cachedItem.data
      }

      console.log(`[缓存] 数组缓存 ${cacheKey} 中 ${itemKey}=${itemValue} 已过期 - 存在 ${elapsedMinutes} 分钟，有效期 ${expireMinutes} 分钟`)
      return null
    } catch (err) {
      console.error(`[缓存] 获取数组缓存 ${cacheKey} 中 ${itemKey}=${itemValue} 失败:`, err)
      return null
    }
  }

  setArrayCacheItem(cacheKey, itemKey, itemValue, data) {
    try {
      let cacheArray = []
      const cached = tt.getStorageSync(cacheKey)
      if (cached) {
        cacheArray = JSON.parse(cached)
        if (!Array.isArray(cacheArray)) {
          cacheArray = []
        }
      }

      const index = cacheArray.findIndex(item => item[itemKey] === itemValue)
      const cleanedData = this.cleanSystemFields(data)
      const newItem = {
        [itemKey]: itemValue,
        data: cleanedData,
        timestamp: Date.now()
      }

      if (index >= 0) {
        cacheArray[index] = newItem
      } else {
        cacheArray.push(newItem)
      }

      let cacheStr = JSON.stringify(cacheArray)

      if (cacheStr.length > 1024 * 1024) {
        console.warn(`[缓存] 数组缓存 ${cacheKey} 数据过大 (${cacheStr.length} 字节)，尝试清理最早的缓存项`)
        let cleaned = false
        let attempts = 0
        const maxAttempts = cacheArray.length - 1

        while (cacheStr.length > 1024 * 1024 && attempts < maxAttempts) {
          if (this.tryCleanOldestInArrayCache(cacheArray)) {
            cleaned = true
            attempts++
            cacheStr = JSON.stringify(cacheArray)
            console.log(`[缓存] 数组缓存 ${cacheKey} 清理第 ${attempts} 项后，当前大小: ${cacheStr.length} 字节`)
          } else {
            break
          }
        }

        if (cleaned && cacheStr.length <= 1024 * 1024) {
          tt.setStorageSync(cacheKey, cacheStr)
          console.log(`[缓存] 数组缓存 ${cacheKey} 中 ${itemKey}=${itemValue} 已保存（清理了 ${attempts} 个旧项）`)
        } else {
          console.warn(`[缓存] 数组缓存 ${cacheKey} 清理 ${attempts} 项后仍过大，跳过缓存`)
        }
      } else {
        tt.setStorageSync(cacheKey, cacheStr)
        console.log(`[缓存] 数组缓存 ${cacheKey} 中 ${itemKey}=${itemValue} 已保存`)
      }
    } catch (err) {
      if (err && err.errMsg) {
        if (err.errMsg.includes('exceed storage item max length')) {
          console.warn(`[缓存] 数组缓存 ${cacheKey} 数据过大，跳过缓存`)
        } else if (err.errMsg.includes('exceed') || err.errMsg.includes('quota')) {
          console.warn(`[缓存] 数组缓存 ${cacheKey} 存储容量不足，尝试清理最早的缓存项`)
          if (this.tryCleanOldestCache()) {
            this.setArrayCacheItem(cacheKey, itemKey, itemValue, data)
          } else {
            console.warn(`[缓存] 数组缓存 ${cacheKey} 清理缓存后仍无法保存，跳过缓存`)
          }
        } else {
          console.error(`[缓存] 设置数组缓存 ${cacheKey} 中 ${itemKey}=${itemValue} 失败:`, err)
        }
      } else {
        console.error(`[缓存] 设置数组缓存 ${cacheKey} 中 ${itemKey}=${itemValue} 失败:`, err)
      }
    }
  }

  isObjectCacheValid(key, appConfig = {}) {
    try {
      const cached = tt.getStorageSync(key)
      if (!cached) {
        console.log(`[缓存] 对象缓存 ${key} 不存在`)
        return false
      }

      const parsed = JSON.parse(cached)
      if (!parsed.timestamp) {
        console.log(`[缓存] 对象缓存 ${key} 无时间戳，视为无效`)
        return false
      }

      const expireMinutes = this.getExpireMinutes(appConfig, key)
      const now = Date.now()
      const elapsedMinutes = Math.floor((now - parsed.timestamp) / 60000)
      const isExpired = elapsedMinutes >= expireMinutes

      if (isExpired) {
        console.log(`[缓存] 对象缓存 ${key} 已过期 - 存在 ${elapsedMinutes} 分钟，有效期 ${expireMinutes} 分钟`)
      } else {
        console.log(`[缓存] 对象缓存 ${key} 未过期 - 存在 ${elapsedMinutes} 分钟，有效期 ${expireMinutes} 分钟`)
      }

      return !isExpired
    } catch (err) {
      console.error(`[缓存] 判断对象缓存 ${key} 有效性失败:`, err)
      return false
    }
  }

  isArrayCacheItemValid(cachedItem, expireKey, appConfig = {}) {
    if (!cachedItem || !cachedItem.timestamp) {
      console.log('[缓存] 数组缓存项不存在或缺少时间戳')
      return false
    }

    const expireMinutes = this.getExpireMinutes(appConfig, expireKey)
    const now = Date.now()
    const elapsedMinutes = Math.floor((now - cachedItem.timestamp) / 60000)
    const isExpired = elapsedMinutes >= expireMinutes

    if (isExpired) {
      console.log(`[缓存] 数组缓存项已过期 - 存在 ${elapsedMinutes} 分钟，有效期 ${expireMinutes} 分钟`)
    } else {
      console.log(`[缓存] 数组缓存项未过期 - 存在 ${elapsedMinutes} 分钟，有效期 ${expireMinutes} 分钟`)
    }

    return !isExpired
  }

  cleanSystemFields(data, keepId = false) {
    const fields = [...this.systemFields]
    if (!keepId) {
      fields.push('_id')
    }

    if (Array.isArray(data)) {
      return data.map(item => this.cleanObjectFields(item, fields))
    } else if (typeof data === 'object' && data !== null) {
      return this.cleanObjectFields(data, fields)
    }
    return data
  }

  cleanObjectFields(obj, fields) {
    const cleaned = { ...obj }
    for (const field of fields) {
      if (field in cleaned) {
        delete cleaned[field]
      }
    }
    return cleaned
  }

  tryCleanOldestCache() {
    try {
      const keys = tt.getStorageInfoSync().keys || []
      if (keys.length === 0) {
        console.log('[缓存] 没有缓存项可清理')
        return false
      }

      let oldestKey = null
      let oldestTimestamp = Date.now()

      for (const key of keys) {
        try {
          const cached = tt.getStorageSync(key)
          if (cached) {
            const parsed = JSON.parse(cached)
            if (parsed.timestamp && parsed.timestamp < oldestTimestamp) {
              oldestTimestamp = parsed.timestamp
              oldestKey = key
            }
          }
        } catch (e) {
          // 忽略解析失败的缓存项
        }
      }

      if (oldestKey) {
        tt.removeStorageSync(oldestKey)
        const oldestDate = new Date(oldestTimestamp)
        console.log(`[缓存] 已删除最早的缓存项: ${oldestKey} (创建于 ${oldestDate.toLocaleString()})`)
        return true
      } else {
        console.log('[缓存] 未找到可清理的缓存项')
        return false
      }
    } catch (err) {
      console.error('[缓存] 清理失败:', err)
      return false
    }
  }

  tryCleanOldestInArrayCache(cacheArray) {
    if (!Array.isArray(cacheArray) || cacheArray.length <= 1) {
      console.log('[缓存] 数组长度不足，无法清理')
      return false
    }

    let oldestIndex = 0
    let oldestTimestamp = Date.now()

    for (let i = 0; i < cacheArray.length; i++) {
      const item = cacheArray[i]
      if (item.timestamp && item.timestamp < oldestTimestamp) {
        oldestTimestamp = item.timestamp
        oldestIndex = i
      }
    }

    if (oldestIndex >= 0 && cacheArray[oldestIndex]) {
      const removedItem = cacheArray.splice(oldestIndex, 1)[0]
      const oldestDate = new Date(oldestTimestamp)
      console.log(`[缓存] 已删除最早的数组缓存项: ${removedItem.class_name || removedItem.key || 'unknown'} (创建于 ${oldestDate.toLocaleString()})`)
      return true
    }

    return false
  }

  removeCache(key) {
    try {
      tt.removeStorageSync(key)
      console.log(`[缓存] 已删除缓存项: ${key}`)
      return true
    } catch (err) {
      console.error(`[缓存] 删除缓存项 ${key} 失败:`, err)
      return false
    }
  }

  clearAllCache() {
    try {
      const keys = tt.getStorageInfoSync().keys || []
      for (const key of keys) {
        tt.removeStorageSync(key)
      }
      console.log(`[缓存] 已清除所有缓存，共 ${keys.length} 项`)
      return true
    } catch (err) {
      console.error('[缓存] 清除所有缓存失败:', err)
      return false
    }
  }
}

const cacheService = new CacheService()

module.exports = {
  CacheService,
  cacheService,
  getObjectCache: (key, appConfig) => cacheService.getObjectCache(key, appConfig),
  setObjectCache: (key, data, keepId) => cacheService.setObjectCache(key, data, keepId),
  getArrayCacheItem: (cacheKey, itemKey, itemValue, appConfig) => cacheService.getArrayCacheItem(cacheKey, itemKey, itemValue, appConfig),
  setArrayCacheItem: (cacheKey, itemKey, itemValue, data) => cacheService.setArrayCacheItem(cacheKey, itemKey, itemValue, data),
  isObjectCacheValid: (key, appConfig) => cacheService.isObjectCacheValid(key, appConfig),
  isArrayCacheItemValid: (cachedItem, expireKey, appConfig) => cacheService.isArrayCacheItemValid(cachedItem, expireKey, appConfig),
  removeCache: (key) => cacheService.removeCache(key),
  clearAllCache: () => cacheService.clearAllCache(),
  cleanSystemFields: (data, keepId) => cacheService.cleanSystemFields(data, keepId)
}
