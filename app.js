const config = require('./config.js')

App({
  globalData: {
    cloud: null,
    openId: '',
    unionId: '',
    isLogin: false,
    appConfig: {}, // 存储从云端拉取的配置对象
    schools: []    // 存储院校信息
  },
  
  onLaunch: async function () {
    // 1. 初始化抖音云
    const cloud = tt.createCloud({
      envID: config.env,
      serviceID: config.serviceId,
    })
    
    // 2. 检查登录状态
    let isLogin = false
    try {
      await this.handleCheckSession()
      isLogin = true
      console.log('session 有效')
    } catch (err) {
      console.log('session 已过期，需要重新登录', err)
      const res = await this.handleLogin()
      isLogin = res.isLogin
    }
    
    // 3. 保存全局数据
    this.globalData.cloud = cloud
    this.globalData.isLogin = isLogin
    
    // 4. 如果登录成功，获取用户openid
    if (isLogin) {
      this.getUserOpenId()
    }
    
    // 5. 拉取云端配置（无论登录状态都执行）
    await this.loadAppConfig()
    
    // 6. 加载院校信息（依赖配置加载完成，以获取缓存有效期）
    await this.loadSchoolsData()
  },
  
  // 登录方法（Promise封装）
  handleLogin() {
    return new Promise((resolve) => {
      tt.login({
        success: (res) => {
          console.log('login success', res)
          resolve(res)
        },
        fail: (err) => {
          console.log('login err', err)
          resolve({
            isLogin: false,
            errMsg: err.errMsg
          })
        }
      })
    })
  },
  
  // 检查session（Promise封装）
  handleCheckSession() {
    return new Promise((resolve, reject) => {
      tt.checkSession({
        success: (res) => {
          console.log('checkSession success', res)
          resolve(res)
        },
        fail: (err) => {
          console.log('checkSession fail', err)
          reject(err)
        }
      })
    })
  },
  
  // 获取用户openid
  getUserOpenId() {
    this.globalData.cloud.callContainer({
      path: '/getOpenid',
      init: {
        method: 'GET',
        timeout: 60000
      },
      success: ({ statusCode, data }) => {
        console.log('云函数响应:', statusCode, data)
        if (statusCode === 200) {
          const result = typeof data === 'string' ? JSON.parse(data) : data
          if (result && result.code === 0) {
            // 保存到全局变量
            this.globalData.openId = result.data.openId || ''
            this.globalData.unionId = result.data.unionId || ''
            console.log('获取openid成功:', this.globalData.openId)
          } else {
            console.error('获取openid失败:', result?.message || '未知错误')
          }
        } else {
          console.error('云函数调用失败，状态码:', statusCode)
        }
      },
      fail: (err) => {
        console.error('云函数调用失败:', err)
      }
    })
  },
  
  // 从云端拉取配置并序列化存储
  async loadAppConfig() {
    return new Promise((resolve) => {
      // 使用已初始化的 cloud 实例
      const cloud = this.globalData.cloud
      
      if (!cloud) {
        console.error('cloud 实例未初始化')
        this.loadConfigFromStorage()
        resolve(null)
        return
      }
      
      cloud.callContainer({
        path: '/loadConfig',
        init: {
          method: 'GET',
          timeout: 60000
        },
        success: ({ statusCode, data }) => {
          console.log('配置接口响应:', statusCode, data)
          if (statusCode === 200) {
            try {
              const result = typeof data === 'string' ? JSON.parse(data) : data
              if (result && result.code === 0 && result.data) {
                // 云函数已返回序列化好的配置对象，直接使用
                const configObject = result.data
                
                // 存入全局变量
                this.globalData.appConfig = configObject
                
                // 存入本地storage
                tt.setStorageSync('appConfig', JSON.stringify(configObject))
                
                console.log('配置加载成功:', configObject)
                resolve(configObject)
              } else {
                console.error('配置数据格式错误:', result)
                resolve(null)
              }
            } catch (err) {
              console.error('配置解析失败:', err)
              resolve(null)
            }
          } else {
            console.error('配置接口调用失败，状态码:', statusCode)
            // 尝试从本地storage读取缓存
            this.loadConfigFromStorage()
            resolve(null)
          }
        },
        fail: (err) => {
          console.error('配置接口调用失败:', err)
          // 尝试从本地storage读取缓存
          this.loadConfigFromStorage()
          resolve(null)
        }
      })
    })
  },
  
  // 从本地storage加载配置缓存
  loadConfigFromStorage() {
    try {
      const cachedConfig = tt.getStorageSync('appConfig')
      if (cachedConfig) {
        this.globalData.appConfig = JSON.parse(cachedConfig)
        console.log('从本地缓存加载配置:', this.globalData.appConfig)
      }
    } catch (err) {
      console.error('读取缓存配置失败:', err)
    }
  },
  
  // 获取配置值
  getConfig(key, defaultValue = null) {
    // 如果 globalData 中没有配置，尝试从缓存读取
    if (!this.globalData.appConfig || Object.keys(this.globalData.appConfig).length === 0) {
      this.loadConfigFromStorage()
    }
    return this.globalData.appConfig[key] ?? defaultValue
  },

  /**
   * 加载院校数据
   * 优先从 storage 缓存加载，有效期内使用缓存，否则从云端拉取
   * @returns {Promise<Array>} 院校数据数组
   */
  async loadSchoolsData() {
    return new Promise((resolve) => {
      // 尝试从缓存加载
      const cachedData = this.getCachedData('schools')
      if (cachedData) {
        console.log('从缓存加载院校数据成功')
        this.globalData.schools = cachedData
        resolve(cachedData)
        return
      }

      // 缓存无效或不存在，从云端拉取
      console.log('缓存无效，从云端拉取院校数据')
      this.loadDataFromCloud('degree_schools', 'schools').then((data) => {
        if (data) {
          this.globalData.schools = data
          resolve(data)
        } else {
          resolve([])
        }
      }).catch(() => {
        resolve([])
      })
    })
  },

  /**
   * 从云端加载数据的通用方法
   * @param {string} collectionName - 表名
   * @param {string} cacheKey - 缓存键名
   * @returns {Promise<Array|null>} 数据数组
   */
  async loadDataFromCloud(collectionName, cacheKey) {
    return new Promise((resolve) => {
      const cloud = this.globalData.cloud
      
      if (!cloud) {
        console.error('cloud 实例未初始化')
        resolve(null)
        return
      }

      cloud.callContainer({
        path: '/getAllData',
        init: {
          method: 'POST',
          timeout: 60000,
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            collectionName: collectionName,
            limit: 1000 // 单次最大数量
          })
        },
        success: ({ statusCode, data }) => {
          console.log(`${collectionName} 数据接口响应: 状态码=${statusCode}`)
          if (statusCode === 200) {
            try {
              const result = typeof data === 'string' ? JSON.parse(data) : data
              if (result && result.code === 0 && result.data) {
                // 获取缓存有效期（分钟）
                const expireMinutes = this.getExpireMinutes(cacheKey)
                
                // 存入缓存（包含过期时间）
                this.setCachedData(cacheKey, result.data, expireMinutes)
                
                console.log(`${collectionName} 数据加载成功，共 ${result.data.length} 条`)
                resolve(result.data)
              } else {
                console.error(`${collectionName} 数据格式错误:`, result)
                resolve(null)
              }
            } catch (err) {
              console.error(`${collectionName} 数据解析失败:`, err)
              resolve(null)
            }
          } else {
            console.error(`${collectionName} 数据接口调用失败，状态码:`, statusCode)
            resolve(null)
          }
        },
        fail: (err) => {
          console.error(`${collectionName} 数据接口调用失败:`, err)
          resolve(null)
        }
      })
    })
  },

  /**
   * 获取指定数据类型的缓存有效期（分钟）
   * @param {string} cacheKey - 缓存键名
   * @returns {number} 有效期（分钟）
   */
  getExpireMinutes(cacheKey) {
    // 从配置中获取对应数据类型的缓存有效期
    const expireConfig = this.getConfig('expireMinute', {})
    const expireMinutes = expireConfig[cacheKey] || expireConfig['default'] || 10
    return expireMinutes
  },

  /**
   * 获取缓存数据
   * @param {string} key - 缓存键名
   * @returns {any|null} 缓存数据，如果已过期或不存在返回 null
   */
  getCachedData(key) {
    try {
      const cached = tt.getStorageSync(key)
      if (!cached) return null

      const parsed = JSON.parse(cached)
      const now = Date.now()

      // 获取当前配置的过期时长（分钟）
      const expireMinutes = this.getExpireMinutes(key)
      
      // 检查是否有 timestamp
      if (!parsed.timestamp) {
        console.log(`${key} 缓存无时间戳，视为无效`)
        tt.removeStorageSync(key)
        return null
      }

      // 计算缓存已存在的时间（分钟）
      const elapsedMinutes = Math.floor((now - parsed.timestamp) / 60000)
      
      // 判断是否过期
      if (elapsedMinutes < expireMinutes) {
        console.log(`${key} 缓存未过期，已存在 ${elapsedMinutes} 分钟，有效期 ${expireMinutes} 分钟`)
        return parsed.data
      }

      console.log(`${key} 缓存已过期，已存在 ${elapsedMinutes} 分钟，有效期 ${expireMinutes} 分钟`)
      // 删除过期缓存
      tt.removeStorageSync(key)
      return null
    } catch (err) {
      console.error(`读取缓存 ${key} 失败:`, err)
      return null
    }
  },

  /**
   * 设置缓存数据
   * @param {string} key - 缓存键名
   * @param {any} data - 缓存数据
   * @param {number} expireMinutes - 有效期（分钟，仅用于日志显示）
   */
  setCachedData(key, data, expireMinutes) {
    try {
      const cacheObject = {
        data: data,
        timestamp: Date.now()
      }
      tt.setStorageSync(key, JSON.stringify(cacheObject))
      console.log(`${key} 缓存已设置，当前配置有效期 ${expireMinutes} 分钟`)
    } catch (err) {
      console.error(`设置缓存 ${key} 失败:`, err)
    }
  },

  /**
   * 获取院校数据
   * @returns {Array} 院校数据数组
   */
  getSchools() {
    return this.globalData.schools
  }
})
