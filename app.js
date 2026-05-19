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
              
              // 尝试从本地缓存恢复用户信息
              try {
                const cachedUserInfo = tt.getStorageSync('userInfo')
                if (cachedUserInfo) {
                  this.globalData.userInfo = JSON.parse(cachedUserInfo)
                  console.log('[OpenID] 从缓存恢复用户信息')
                }
              } catch (err) {
                console.error('[OpenID] 恢复缓存用户信息失败:', err)
              }
              
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
  
  // 获取或创建用户信息（支持传入抖音用户信息）
  async getUserInfo(openid, douyinInfo = {}) {
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
      
      // 构建请求参数，包含抖音用户信息
      const requestBody = {
        openid: openid
      }
      
      // 如果有抖音头像或昵称，添加到请求中
      if (douyinInfo.avatarUrl) {
        requestBody.avatarUrl = douyinInfo.avatarUrl
      }
      if (douyinInfo.nickName) {
        requestBody.nickName = douyinInfo.nickName
      }
      
      console.log('[用户信息] 请求参数:', requestBody)
      
      cloud.callContainer({
        path: '/getUser',
        init: {
          method: 'POST',
          timeout: 60000,
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(requestBody)
        },
        success: ({ statusCode, data }) => {
          if (statusCode === 200) {
            const result = typeof data === 'string' ? JSON.parse(data) : data
            if (result && result.code === 0 && result.data) {
              let userInfo = result.data
              
              // 如果请求中包含抖音头像昵称，确保返回的数据也包含这些信息
              // 防止云函数更新失败导致数据回退
              if (douyinInfo.avatarUrl && !userInfo.avatarUrl) {
                userInfo.avatarUrl = douyinInfo.avatarUrl
              }
              if (douyinInfo.nickName && !userInfo.nickname) {
                userInfo.nickname = douyinInfo.nickName
              }
              
              // 更新全局变量
              this.globalData.userInfo = userInfo
              console.log('[用户信息] 获取成功，数据:', userInfo)
              
              // 更新storage
              tt.setStorageSync('userInfo', JSON.stringify(userInfo))
              
              resolve(userInfo)
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
      // 尝试从缓存加载（使用统一的对象型缓存方法）
      const cachedData = this.getObjectCache('schools')
      if (cachedData) {
        console.log('[院校] 使用缓存数据')
        this.globalData.schools = cachedData
        resolve(cachedData)
        return
      }

      // 缓存无效或不存在，从云端拉取
      console.log('[院校] 从云端加载')
      this.loadDataFromCloud('degree_schools').then((data) => {
        if (data) {
          this.globalData.schools = data
          this.setObjectCache('schools', data)
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
      // 尝试从缓存加载（使用统一的对象型缓存方法）
      const cachedData = this.getObjectCache('major_classes')
      if (cachedData) {
        console.log('[专业大类] 使用缓存数据')
        this.globalData.majorClasses = cachedData
        resolve(cachedData)
        return
      }

      // 缓存无效或不存在，从云端拉取
      console.log('[专业大类] 从云端加载')
      this.loadDataFromCloud('degree_major_classes').then((data) => {
        if (data) {
          this.globalData.majorClasses = data
          this.setObjectCache('major_classes', data)
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
   * 从云端加载数据的通用方法（仅负责获取数据，不处理缓存）
   * @param {string} collectionName - 表名
   * @param {Object} filter - 筛选条件对象（可选，如 { year: "2024" } 或 { majorCategory: "工学" }）
   * @returns {Promise<Array|null>} 数据数组
   */
  async loadDataFromCloud(collectionName, filter = {}) {
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
  
  // ============================================
  // 对象型缓存方法（适用于单一数据集，如院校、专业大类、用户信息）
  // ============================================
  
  /**
   * 获取对象型缓存数据（自动验证过期）
   * @param {string} key - 缓存键名
   * @returns {any|null} 缓存数据（过期或不存在返回 null）
   */
  getObjectCache(key) {
    try {
      const cached = tt.getStorageSync(key)
      if (!cached) {
        console.log(`[对象缓存] ${key} 不存在`)
        return null
      }

      const parsed = JSON.parse(cached)
      const now = Date.now()
      const expireMinutes = this.getExpireMinutes(key)
      
      if (!parsed.timestamp) {
        console.log(`[对象缓存] ${key} 无时间戳，视为无效`)
        tt.removeStorageSync(key)
        return null
      }

      const elapsedMinutes = Math.floor((now - parsed.timestamp) / 60000)
      
      if (elapsedMinutes < expireMinutes) {
        console.log(`[对象缓存] ${key} 命中 - 存在 ${elapsedMinutes} 分钟，有效期 ${expireMinutes} 分钟`)
        return parsed.data
      }

      console.log(`[对象缓存] ${key} 已过期 - 存在 ${elapsedMinutes} 分钟，有效期 ${expireMinutes} 分钟`)
      tt.removeStorageSync(key)
      return null
    } catch (err) {
      console.error(`[对象缓存] 读取 ${key} 失败:`, err)
      return null
    }
  },

  /**
   * 设置对象型缓存数据
   * @param {string} key - 缓存键名
   * @param {any} data - 要缓存的数据
   */
  setObjectCache(key, data) {
    try {
      const cacheObject = {
        data: data,
        timestamp: Date.now()
      }
      tt.setStorageSync(key, JSON.stringify(cacheObject))
      console.log(`[对象缓存] ${key} 已保存`)
    } catch (err) {
      console.error(`[对象缓存] 设置 ${key} 失败:`, err)
    }
  },

  /**
   * 判断对象型缓存是否有效（未过期）
   * @param {string} key - 缓存键名
   * @returns {boolean} 是否有效
   */
  isObjectCacheValid(key) {
    try {
      const cached = tt.getStorageSync(key)
      if (!cached) {
        console.log(`[对象缓存验证] ${key} 不存在`)
        return false
      }

      const parsed = JSON.parse(cached)
      if (!parsed.timestamp) {
        console.log(`[对象缓存验证] ${key} 无时间戳，视为无效`)
        return false
      }

      const expireMinutes = this.getExpireMinutes(key)
      const now = Date.now()
      const elapsedMinutes = Math.floor((now - parsed.timestamp) / 60000)
      const isExpired = elapsedMinutes >= expireMinutes

      if (isExpired) {
        console.log(`[对象缓存验证] ${key} 已过期 - 存在 ${elapsedMinutes} 分钟，有效期 ${expireMinutes} 分钟`)
      } else {
        console.log(`[对象缓存验证] ${key} 未过期 - 存在 ${elapsedMinutes} 分钟，有效期 ${expireMinutes} 分钟`)
      }

      return !isExpired
    } catch (err) {
      console.error(`[对象缓存验证] 判断 ${key} 有效性失败:`, err)
      return false
    }
  },
  
  // ============================================
  // 数组型缓存方法（适用于按分类存储的数据集，如招生计划按大类存储）
  // ============================================
  
  /**
   * 获取数组型缓存中的指定数据项（自动验证过期）
   * @param {string} cacheKey - 缓存键名（如 'plans'）
   * @param {string} itemKey - 数组元素的唯一标识键名（如 'class_name'）
   * @param {string} itemValue - 唯一标识值
   * @returns {any|null} 缓存数据（过期或不存在返回 null）
   */
  getArrayCacheItem(cacheKey, itemKey, itemValue) {
    try {
      const cached = tt.getStorageSync(cacheKey)
      if (!cached) {
        console.log(`[数组缓存] ${cacheKey} 不存在`)
        return null
      }

      const cacheArray = JSON.parse(cached)
      if (!Array.isArray(cacheArray)) {
        console.log(`[数组缓存] ${cacheKey} 不是数组格式`)
        return null
      }

      const cachedItem = cacheArray.find(item => item[itemKey] === itemValue)
      if (!cachedItem) {
        console.log(`[数组缓存] ${cacheKey} 中未找到 ${itemKey}=${itemValue}`)
        return null
      }

      const expireMinutes = this.getExpireMinutes(cacheKey)
      const now = Date.now()
      const elapsedMinutes = Math.floor((now - cachedItem.timestamp) / 60000)

      if (elapsedMinutes < expireMinutes) {
        console.log(`[数组缓存] ${cacheKey} 中 ${itemKey}=${itemValue} 命中 - 存在 ${elapsedMinutes} 分钟，有效期 ${expireMinutes} 分钟`)
        return cachedItem.data
      }

      console.log(`[数组缓存] ${cacheKey} 中 ${itemKey}=${itemValue} 已过期 - 存在 ${elapsedMinutes} 分钟，有效期 ${expireMinutes} 分钟`)
      return null
    } catch (err) {
      console.error(`[数组缓存] 获取 ${cacheKey} 中 ${itemKey}=${itemValue} 失败:`, err)
      return null
    }
  },

  /**
   * 设置数组型缓存中的数据项（存在则替换，不存在则新增）
   * @param {string} cacheKey - 缓存键名（如 'plans'）
   * @param {string} itemKey - 数组元素的唯一标识键名（如 'class_name'）
   * @param {string} itemValue - 唯一标识值
   * @param {any} data - 要缓存的数据
   */
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
      const newItem = {
        [itemKey]: itemValue,
        data: data,
        timestamp: Date.now()
      }

      if (index >= 0) {
        cacheArray[index] = newItem
      } else {
        cacheArray.push(newItem)
      }

      tt.setStorageSync(cacheKey, JSON.stringify(cacheArray))
      console.log(`[数组缓存] ${cacheKey} 中 ${itemKey}=${itemValue} 已保存`)
    } catch (err) {
      console.error(`[数组缓存] 设置 ${cacheKey} 中 ${itemKey}=${itemValue} 失败:`, err)
    }
  },

  /**
   * 判断数组型缓存项是否有效（未过期）
   * @param {Object} cachedItem - 缓存项（需包含 timestamp 字段）
   * @param {string} expireKey - 配置中的过期时间键名
   * @returns {boolean} 是否有效
   */
  isArrayCacheItemValid(cachedItem, expireKey) {
    if (!cachedItem || !cachedItem.timestamp) {
      console.log('[数组缓存验证] 缓存项不存在或缺少时间戳')
      return false
    }

    const expireMinutes = this.getExpireMinutes(expireKey)
    const now = Date.now()
    const elapsedMinutes = Math.floor((now - cachedItem.timestamp) / 60000)
    const isExpired = elapsedMinutes >= expireMinutes

    if (isExpired) {
      console.log(`[数组缓存验证] 已过期 - 存在 ${elapsedMinutes} 分钟，有效期 ${expireMinutes} 分钟`)
    } else {
      console.log(`[数组缓存验证] 未过期 - 存在 ${elapsedMinutes} 分钟，有效期 ${expireMinutes} 分钟`)
    }

    return !isExpired
  },

  // ============================================
  // 统一登录状态管理方法
  // ============================================

  /**
   * 统一登录方法（封装了checkSession、login、获取openid和用户信息的完整流程）
   * @returns {Promise<boolean>} 返回登录是否成功
   */
  async doLogin() {
    console.log('[登录] 开始统一登录流程')

    try {
      // 1. 先检查Session是否有效
      await this.handleCheckSession()
      console.log('[登录] Session有效')
    } catch {
      console.log('[登录] Session过期，重新登录')
      const loginRes = await this.handleLogin()
      if (loginRes.isLogin === false) {
        console.error('[登录] 登录失败')
        return false
      }
      console.log('[登录] 重新登录成功')
    }

    // 2. 获取OpenId
    if (!this.globalData.openId) {
      console.log('[登录] OpenId不存在，开始获取')
      await this.getUserOpenId()
    }

    // 3. 获取用户信息（不自动获取抖音信息，因为需要用户主动授权）
    if (this.globalData.openId) {
      console.log('[登录] 获取用户信息')
      await this.getUserInfo(this.globalData.openId)
    }

    // 5. 设置登录状态
    this.globalData.isLogin = !!(this.globalData.openId && this.globalData.userInfo)
    console.log(`[登录] 登录完成，状态: ${this.globalData.isLogin}`)

    return this.globalData.isLogin
  },

  /**
   * 退出登录方法
   * 清除全局状态和本地缓存
   */
  logout() {
    console.log('[登录] 开始退出登录')

    // 1. 清除全局状态
    this.globalData.isLogin = false
    this.globalData.userInfo = {}
    this.globalData.openId = ''
    this.globalData.unionId = ''

    // 2. 清除本地缓存
    try {
      tt.removeStorageSync('userInfo')
      // 清除openid相关缓存
      tt.removeStorageSync('openId')
      tt.removeStorageSync('unionId')
      console.log('[登录] 用户缓存已清除')
    } catch (err) {
      console.error('[登录] 清除用户缓存失败:', err)
    }

    console.log('[登录] 退出登录完成')
  },

  /**
   * 获取当前登录状态
   * @returns {boolean} 是否已登录
   */
  isLoggedIn() {
    return this.globalData.isLogin && !!(this.globalData.openId && this.globalData.userInfo)
  },

  /**
   * 获取用户昵称
   * @returns {string} 用户昵称
   */
  getUserNickname() {
    if (this.globalData.userInfo && this.globalData.userInfo.nickname) {
      return this.globalData.userInfo.nickname
    }
    try {
      const userInfoStr = tt.getStorageSync('userInfo')
      if (userInfoStr) {
        const userInfo = JSON.parse(userInfoStr)
        return userInfo.nickname || '未登录'
      }
    } catch (err) {
      console.error('[用户] 读取昵称失败:', err)
    }
    return '未登录'
  },

  /**
   * 获取用户等级
   * @returns {number} 用户等级
   */
  getUserLevel() {
    if (this.globalData.userInfo && this.globalData.userInfo.level) {
      return this.globalData.userInfo.level
    }
    try {
      const userInfoStr = tt.getStorageSync('userInfo')
      if (userInfoStr) {
        const userInfo = JSON.parse(userInfoStr)
        return userInfo.level || 0
      }
    } catch (err) {
      console.error('[用户] 读取等级失败:', err)
    }
    return 0
  },

  /**
   * 获取用户头像URL
   * @returns {string} 用户头像URL
   */
  getUserAvatar() {
    if (this.globalData.userInfo && this.globalData.userInfo.avatarUrl) {
      return this.globalData.userInfo.avatarUrl
    }
    try {
      const userInfoStr = tt.getStorageSync('userInfo')
      if (userInfoStr) {
        const userInfo = JSON.parse(userInfoStr)
        return userInfo.avatarUrl || ''
      }
    } catch (err) {
      console.error('[用户] 读取头像失败:', err)
    }
    return ''
  },

  /**
   * 获取抖音用户信息（头像、昵称）
   * @returns {Promise<Object>} 用户信息 {avatarUrl, nickName}
   */
  getDouyinUserProfile() {
    return new Promise((resolve) => {
      tt.getUserProfile({
        desc: '用于完善用户资料',
        success: (res) => {
          console.log('[抖音] 获取用户信息成功:', res.userInfo)
          resolve({
            avatarUrl: res.userInfo.avatarUrl || '',
            nickName: res.userInfo.nickName || ''
          })
        },
        fail: (err) => {
          console.error('[抖音] 获取用户信息失败:', err)
          // 获取失败也继续，使用默认信息
          resolve({
            avatarUrl: '',
            nickName: ''
          })
        }
      })
    })
  }
})