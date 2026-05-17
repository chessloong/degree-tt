const config = require('./config.js')

App({
  globalData: {
    cloud: null,
    openId: '',
    unionId: '',
    isLogin: false,
    appConfig: {}, // 存储从云端拉取的配置对象
    schools: [],        // 存储院校信息
    majorClasses: [],   // 存储专业大类信息
    userInfo: {}        // 存储用户信息（级别、昵称等）
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
      console.log('[启动] Session 有效')
    } catch (err) {
      console.log('[启动] Session 过期，重新登录')
      const res = await this.handleLogin()
      isLogin = res.isLogin
    }
    
    // 3. 保存全局数据
    this.globalData.cloud = cloud
    this.globalData.isLogin = isLogin
    
    // 4. 如果登录成功，获取用户openid并处理用户信息
    if (isLogin) {
      await this.getUserOpenId()
    }
    
    // 5. 拉取云端配置（无论登录状态都执行）
    await this.loadAppConfig()
    
    // 6. 加载院校信息（依赖配置加载完成，以获取缓存有效期）
    await this.loadSchoolsData()
    
    // 7. 加载专业大类信息
    await this.loadMajorClassesData()
  },
  
  // 登录方法（Promise封装）
  handleLogin() {
    return new Promise((resolve) => {
      tt.login({
        success: (res) => {
          resolve(res)
        },
        fail: (err) => {
          console.error('[登录] 失败:', err.errMsg)
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
          resolve(res)
        },
        fail: (err) => {
          reject(err)
        }
      })
    })
  },
  
  // 获取用户openid
  async getUserOpenId() {
    return new Promise((resolve) => {
      this.globalData.cloud.callContainer({
        path: '/getOpenid',
        init: {
          method: 'GET',
          timeout: 60000
        },
        success: ({ statusCode, data }) => {
          if (statusCode === 200) {
            const result = typeof data === 'string' ? JSON.parse(data) : data
            if (result && result.code === 0) {
              // 保存到全局变量
              this.globalData.openId = result.data.openId || ''
              this.globalData.unionId = result.data.unionId || ''
              console.log('[OpenID] 获取成功')
              
              // 获取openid后，调用getUser云函数获取或创建用户信息
              this.getUserInfo(this.globalData.openId).then(() => {
                resolve()
              }).catch(() => {
                resolve()
              })
            } else {
              console.error('[OpenID] 获取失败:', result?.message || '未知错误')
              resolve()
            }
          } else {
            console.error('[OpenID] 云函数调用失败，状态码:', statusCode)
            resolve()
          }
        },
        fail: (err) => {
          console.error('[OpenID] 云函数调用异常:', err)
          resolve()
        }
      })
    })
  },
  
  // 获取或创建用户信息
  async getUserInfo(openid) {
    return new Promise((resolve) => {
      if (!openid) {
        console.error('openid为空，无法获取用户信息')
        resolve(null)
        return
      }
      
      const cloud = this.globalData.cloud
      if (!cloud) {
        console.error('cloud实例未初始化')
        resolve(null)
        return
      }
      
      cloud.callContainer({
        path: '/getUser',
        init: {
          method: 'POST',
          timeout: 60000,
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            openid: openid
          })
        },
        success: ({ statusCode, data }) => {
          if (statusCode === 200) {
            const result = typeof data === 'string' ? JSON.parse(data) : data
            if (result && result.code === 0 && result.data) {
              // 更新全局变量
              this.globalData.userInfo = result.data
              console.log('[用户信息] 获取成功')
              
              // 更新storage
              tt.setStorageSync('userInfo', JSON.stringify(result.data))
              
              resolve(result.data)
            } else {
              console.error('[用户信息] 获取失败:', result?.message || '未知错误')
              resolve(null)
            }
          } else {
            console.error('[用户信息] 云函数调用失败，状态码:', statusCode)
            resolve(null)
          }
        },
        fail: (err) => {
          console.error('[用户信息] 云函数调用异常:', err)
          resolve(null)
        }
      })
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
                
                console.log('[配置] 加载成功')
                resolve(configObject)
              } else {
                console.error('[配置] 数据格式错误')
                resolve(null)
              }
            } catch (err) {
              console.error('[配置] 解析失败:', err)
              resolve(null)
            }
          } else {
            console.error('[配置] 接口调用失败，状态码:', statusCode)
            // 尝试从本地storage读取缓存
            this.loadConfigFromStorage()
            resolve(null)
          }
        },
        fail: (err) => {
          console.error('[配置] 接口调用异常:', err)
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
      }
    } catch (err) {
      console.error('[配置缓存] 读取失败:', err)
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
        console.log('[院校] 使用缓存数据')
        this.globalData.schools = cachedData
        resolve(cachedData)
        return
      }

      // 缓存无效或不存在，从云端拉取
      console.log('[院校] 从云端加载')
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
   * 加载专业大类数据
   * 优先从 storage 缓存加载，有效期内使用缓存，否则从云端拉取
   * @returns {Promise<Array>} 专业大类数据数组
   */
  async loadMajorClassesData() {
    return new Promise((resolve) => {
      // 尝试从缓存加载
      const cachedData = this.getCachedData('major_classes')
      if (cachedData) {
        console.log('[专业大类] 使用缓存数据')
        this.globalData.majorClasses = cachedData
        resolve(cachedData)
        return
      }

      // 缓存无效或不存在，从云端拉取
      console.log('[专业大类] 从云端加载')
      this.loadDataFromCloud('degree_major_classes', 'major_classes').then((data) => {
        if (data) {
          this.globalData.majorClasses = data
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
   * @param {Object} filter - 筛选条件对象（可选，如 { year: "2024" } 或 { majorCategory: "工学" }）
   * @returns {Promise<Array|null>} 数据数组
   */
  async loadDataFromCloud(collectionName, cacheKey, filter = {}) {
    return new Promise((resolve) => {
      const cloud = this.globalData.cloud

      if (!cloud) {
        console.error('cloud 实例未初始化')
        resolve(null)
        return
      }

      cloud.callContainer({
        path: '/queryDegrees',
        init: {
          method: 'POST',
          timeout: 60000,
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            collectionName: collectionName,
            limit: 1000,
            filter: filter
          })
        },
        success: ({ statusCode, data }) => {
          if (statusCode === 200) {
            try {
              const result = typeof data === 'string' ? JSON.parse(data) : data
              if (result && result.code === 0 && result.data) {
                // 获取缓存有效期（分钟）
                const expireMinutes = this.getExpireMinutes(cacheKey)
                
                // 存入缓存（包含过期时间）
                this.setCachedData(cacheKey, result.data, expireMinutes)
                
                console.log(`[云端] ${collectionName} 拉取成功，共 ${result.data.length} 条`)
                resolve(result.data)
              } else {
                console.error(`[数据] ${collectionName} 格式错误`)
                resolve(null)
              }
            } catch (err) {
              console.error(`[数据] ${collectionName} 解析失败:`, err)
              resolve(null)
            }
          } else {
            console.error(`[数据] ${collectionName} 接口失败，状态码:`, statusCode)
            resolve(null)
          }
        },
        fail: (err) => {
          console.error(`[数据] ${collectionName} 接口异常:`, err)
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
      if (!cached) {
        console.log(`[缓存] ${key} 不存在`)
        return null
      }

      const parsed = JSON.parse(cached)
      const now = Date.now()

      // 获取当前配置的过期时长（分钟）
      const expireMinutes = this.getExpireMinutes(key)
      
      // 检查是否有 timestamp
      if (!parsed.timestamp) {
        console.log(`[缓存] ${key} 无时间戳，视为无效`)
        tt.removeStorageSync(key)
        return null
      }

      // 计算缓存已存在的时间（分钟）
      const elapsedMinutes = Math.floor((now - parsed.timestamp) / 60000)
      
      // 判断是否过期
      if (elapsedMinutes < expireMinutes) {
        console.log(`[缓存] ${key} 命中 - 存在 ${elapsedMinutes} 分钟，有效期 ${expireMinutes} 分钟`)
        return parsed.data
      }

      console.log(`[缓存] ${key} 已过期 - 存在 ${elapsedMinutes} 分钟，有效期 ${expireMinutes} 分钟`)
      // 删除过期缓存
      tt.removeStorageSync(key)
      return null
    } catch (err) {
      console.error(`[缓存] 读取 ${key} 失败:`, err)
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
    } catch (err) {
      console.error(`[缓存] 设置 ${key} 失败:`, err)
    }
  },
  
  /**
   * 获取院校数据
   * @returns {Array} 院校数据数组
   */
  getSchools() {
    return this.globalData.schools
  },
  
  /**
   * 获取专业大类数据
   * @returns {Array} 专业大类数据数组
   */
  getMajorClasses() {
    return this.globalData.majorClasses
  },
  
  /**
   * 获取用户的大类名称
   * 优先从全局变量获取，其次从 storage 获取
   * @returns {string|null} 用户大类名称
   */
  getUserClassName() {
    // 1. 优先从全局变量获取
    if (this.globalData.userInfo && this.globalData.userInfo.userClassName) {
      return this.globalData.userInfo.userClassName
    }
    
    // 2. 从 storage 获取
    try {
      const userInfoStr = tt.getStorageSync('userInfo')
      if (userInfoStr) {
        const userInfo = JSON.parse(userInfoStr)
        if (userInfo.userClassName) {
          return userInfo.userClassName
        }
      }
    } catch (err) {
      console.error('读取用户信息失败:', err)
    }
    
    return null
  },
  
  /**
   * 从缓存数组中查找指定键的数据项
   * @param {string} cacheKey - 缓存键名（如 'plans'）
   * @param {string} itemKey - 数组元素的查找键名（如 'class_name'）
   * @param {string} itemValue - 要查找的值
   * @returns {Object|null} 找到的数据项（包含 data 和 timestamp）
   */
  findCachedItem(cacheKey, itemKey, itemValue) {
    try {
      const cached = tt.getStorageSync(cacheKey)
      if (!cached) return null
      
      const cacheArray = JSON.parse(cached)
      if (!Array.isArray(cacheArray)) return null
      
      return cacheArray.find(item => item[itemKey] === itemValue)
    } catch (err) {
      console.error(`从缓存 ${cacheKey} 查找数据失败:`, err)
      return null
    }
  },
  
  /**
   * 获取有效的缓存数据项（合并查找和验证）
   * @param {string} cacheKey - 缓存键名（如 'plans'）
   * @param {string} itemKey - 数组元素的查找键名（如 'class_name'）
   * @param {string} itemValue - 要查找的值
   * @param {string} expireKey - 配置中的过期时间键名
   * @returns {Object|null} 有效时返回数据项，否则返回 null
   */
  getValidCachedItem(cacheKey, itemKey, itemValue, expireKey) {
    const cachedItem = this.findCachedItem(cacheKey, itemKey, itemValue)
    if (!cachedItem) {
      console.log(`[缓存] ${cacheKey} 中未找到 ${itemKey}=${itemValue}`)
      return null
    }
    
    const isValid = this.isCachedItemValid(cachedItem, expireKey || cacheKey)
    if (!isValid) {
      console.log(`[缓存] ${cacheKey} 中 ${itemKey}=${itemValue} 已过期`)
      return null
    }
    
    console.log(`[缓存] ${cacheKey} 中 ${itemKey}=${itemValue} 命中`)
    return cachedItem
  },
  
  /**
   * 判断缓存项是否有效（未过期）
   * @param {Object} cachedItem - 缓存项（需包含 timestamp 字段）
   * @param {string} expireKey - 配置中的过期时间键名（如 'plans'）
   * @returns {boolean} 是否有效
   */
  isCachedItemValid(cachedItem, expireKey) {
    if (!cachedItem || !cachedItem.timestamp) {
      console.log('[缓存验证] 缓存项不存在或缺少时间戳')
      return false
    }
    
    const expireMinutes = this.getExpireMinutes(expireKey)
    const now = Date.now()
    const elapsedMinutes = Math.floor((now - cachedItem.timestamp) / 60000)
    const isExpired = elapsedMinutes >= expireMinutes
    
    if (isExpired) {
      console.log(`[缓存验证] 已过期 - 存在 ${elapsedMinutes} 分钟，有效期 ${expireMinutes} 分钟`)
    } else {
      console.log(`[缓存验证] 未过期 - 存在 ${elapsedMinutes} 分钟，有效期 ${expireMinutes} 分钟`)
    }
    
    return !isExpired
  },
  
  /**
   * 更新缓存数组中的数据项（存在则替换，不存在则新增）
   * @param {string} cacheKey - 缓存键名（如 'plans'）
   * @param {string} itemKey - 数组元素的唯一标识键名（如 'class_name'）
   * @param {string} itemValue - 唯一标识值
   * @param {any} data - 要缓存的数据
   */
  updateCachedItem(cacheKey, itemKey, itemValue, data) {
    try {
      // 获取当前缓存数组
      let cacheArray = []
      const cached = tt.getStorageSync(cacheKey)
      if (cached) {
        cacheArray = JSON.parse(cached)
        if (!Array.isArray(cacheArray)) {
          cacheArray = []
        }
      }
      
      // 查找并替换或新增
      const index = cacheArray.findIndex(item => item[itemKey] === itemValue)
      
      const newItem = {
        [itemKey]: itemValue,
        data: data,
        timestamp: Date.now()
      }
      
      if (index >= 0) {
        // 替换现有数据
        cacheArray[index] = newItem
      } else {
        // 新增数据
        cacheArray.push(newItem)
      }
      
      // 保存到 storage
      tt.setStorageSync(cacheKey, JSON.stringify(cacheArray))
    } catch (err) {
      console.error(`[缓存] 更新 ${cacheKey} 失败:`, err)
    }
  }
})