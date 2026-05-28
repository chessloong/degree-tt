const { cloudService, initCloud } = require('./utils/cloud.js')
const { authService, login } = require('./utils/auth.js')
const { getObjectCache, setObjectCache, getArrayCacheItem, setArrayCacheItem } = require('./utils/cache.js')

App({
  globalData: {
    cloud: null,
    openId: '',
    unionId: '',
    isLogin: false,
    appConfig: {},
    schools: [],
    majorClasses: [],
    userInfo: {}
  },

  onLaunch: async function () {
    console.log('[App] 启动开始')
    const startTime = Date.now()

    try {
      await this.initCloudService()
      await this.handleLogin()
      await this.loadAppConfig()
      await this.loadSchoolsData()
      await this.loadMajorClassesData()

      const elapsed = Date.now() - startTime
      console.log(`[App] 启动完成，耗时 ${elapsed}ms`)
    } catch (err) {
      console.error('[App] 启动异常:', err)
    }
  },

  async initCloudService() {
    try {
      await initCloud()
      this.globalData.cloud = cloudService.getCloudInstance()
      console.log('[App] 云服务初始化完成')
    } catch (err) {
      console.error('[App] 云服务初始化失败:', err)
    }
  },

  async handleLogin() {
    try {
      const isLogin = await login()
      this.globalData.isLogin = isLogin
      this.globalData.openId = authService.getOpenId()
      this.globalData.unionId = authService.getUnionId()
      this.globalData.userInfo = authService.getUserInfoData()
      console.log(`[App] 登录状态: ${isLogin}`)
    } catch (err) {
      console.error('[App] 登录失败:', err)
    }
  },

  async loadAppConfig() {
    try {
      const result = await cloudService.get('/loadConfig')
      if (result && result.data) {
        this.globalData.appConfig = result.data
        tt.setStorageSync('appConfig', JSON.stringify(result.data))
        console.log('[App] 云端配置加载成功')
      }
    } catch (err) {
      console.error('[App] 云端配置加载失败:', err)
      this.loadConfigFromStorage()
    }
  },

  loadConfigFromStorage() {
    try {
      const cachedConfig = tt.getStorageSync('appConfig')
      if (cachedConfig) {
        this.globalData.appConfig = JSON.parse(cachedConfig)
        console.log('[App] 从缓存加载配置')
      }
    } catch (err) {
      console.error('[App] 读取缓存配置失败:', err)
    }
  },

  getConfig(key, defaultValue = null) {
    if (!this.globalData.appConfig || Object.keys(this.globalData.appConfig).length === 0) {
      this.loadConfigFromStorage()
    }
    return this.globalData.appConfig[key] ?? defaultValue
  },

  getExpireMinutes(cacheKey) {
    const expireConfig = this.getConfig('expireMinute', {})
    return expireConfig[cacheKey] || expireConfig.default || 10
  },

  async loadSchoolsData() {
    const cachedData = getObjectCache('schools', this.globalData.appConfig)
    if (cachedData) {
      console.log('[App] 院校数据使用缓存')
      this.globalData.schools = cachedData
      return cachedData
    }

    try {
      const data = await cloudService.post('/queryDegrees', {
        collectionName: 'degree_schools',
        limit: 1000
      })
      if (data && data.data) {
        this.globalData.schools = data.data
        setObjectCache('schools', data.data, true)
        console.log('[App] 院校数据从云端加载成功')
        return data.data
      }
    } catch (err) {
      console.error('[App] 加载院校数据失败:', err)
    }
    return []
  },

  async loadMajorClassesData() {
    const cachedData = getObjectCache('major_classes', this.globalData.appConfig)
    if (cachedData) {
      console.log('[App] 专业大类数据使用缓存')
      this.globalData.majorClasses = cachedData
      return cachedData
    }

    try {
      const data = await cloudService.post('/queryDegrees', {
        collectionName: 'degree_major_classes',
        limit: 1000
      })
      if (data && data.data) {
        this.globalData.majorClasses = data.data
        setObjectCache('major_classes', data.data, true)
        console.log('[App] 专业大类数据从云端加载成功')
        return data.data
      }
    } catch (err) {
      console.error('[App] 加载专业大类数据失败:', err)
    }
    return []
  },

  getSchools() {
    return this.globalData.schools
  },

  getMajorClasses() {
    return this.globalData.majorClasses
  },

  getUserClassName() {
    return authService.getUserClassName()
  },

  async loadPageDataBatch(dataConfigs, options = {}) {
    const { parallel = true, onError = 'continue' } = options
    console.log(`[App] 开始批量加载 ${dataConfigs.length} 个数据项`)
    const startTime = Date.now()

    const results = {}

    const loadSingle = async (config) => {
      try {
        const data = await this._loadSingleData(config)
        results[config.cacheKey] = data
      } catch (err) {
        console.error(`[App] 批量加载 ${config.cacheKey} 失败:`, err)
        if (onError === 'abort') {
          throw err
        }
        results[config.cacheKey] = config.defaultValue || null
      }
    }

    if (parallel) {
      await Promise.all(dataConfigs.map(loadSingle))
    } else {
      for (const config of dataConfigs) {
        await loadSingle(config)
      }
    }

    const elapsed = Date.now() - startTime
    console.log(`[App] 批量加载完成，耗时 ${elapsed}ms`)

    return results
  },

  async _loadSingleData(config) {
    const {
      cacheKey,
      collection,
      filter = {},
      type = 'array',
      itemKey,
      itemValue,
      defaultValue = null
    } = config

    console.log(`[App] 开始加载: ${cacheKey} (类型: ${type})`)

    let cachedData = null

    if (type === 'array' && itemKey && itemValue) {
      cachedData = getArrayCacheItem(cacheKey, itemKey, itemValue, this.globalData.appConfig)
    } else if (type === 'object') {
      cachedData = getObjectCache(cacheKey, this.globalData.appConfig)
    }

    if (cachedData !== null) {
      console.log(`[App] ${cacheKey} 使用缓存`)
      return cachedData
    }

    try {
      console.log(`[App] ${cacheKey} 从云端加载`)
      const data = await cloudService.post('/queryDegrees', {
        collectionName: collection,
        limit: 1000,
        filter
      })

      const finalData = data && data.data ? data.data : defaultValue

      if (data && data.data) {
        if (type === 'array' && itemKey && itemValue) {
          setArrayCacheItem(cacheKey, itemKey, itemValue, finalData || [])
        } else if (type === 'object') {
          setObjectCache(cacheKey, finalData || {}, true)
        }
      }

      return finalData
    } catch (err) {
      console.error(`[App] 加载 ${cacheKey} 失败:`, err)
      return defaultValue
    }
  },

  getObjectCache(key) {
    return getObjectCache(key, this.globalData.appConfig)
  },

  setObjectCache(key, data) {
    setObjectCache(key, data, true)
  },

  getArrayCacheItem(cacheKey, itemKey, itemValue) {
    return getArrayCacheItem(cacheKey, itemKey, itemValue, this.globalData.appConfig)
  },

  setArrayCacheItem(cacheKey, itemKey, itemValue, data) {
    setArrayCacheItem(cacheKey, itemKey, itemValue, data)
  },

  isLoggedIn() {
    return authService.isLoggedIn()
  },

  doLogin() {
    return authService.doLogin()
  },

  logout() {
    return authService.logout()
  },

  getUserInfo(openid, douyinInfo) {
    return authService.getUserInfo(openid, douyinInfo)
  },

  getUserNickname() {
    return authService.getUserNickname()
  },

  getUserLevel() {
    return authService.getUserLevel()
  },

  getUserAvatar() {
    return authService.getUserAvatar()
  },

  async loadDataFromCloud(collectionName, filter = {}, limit = 1000) {
    try {
      const data = await cloudService.post('/queryDegrees', {
        collectionName,
        limit,
        filter
      })
      return data && data.data ? data.data : null
    } catch (err) {
      console.error(`[App] loadDataFromCloud ${collectionName} 失败:`, err)
      return null
    }
  },

  getDouyinUserProfile() {
    return authService.getDouyinUserProfile()
  }
})
