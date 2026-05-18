const app = getApp()

Page({
  data: {
    title: '招生计划',
    plansData: [],  // 当前大类的招生计划数据
    className: ''   // 当前大类名称
  },

  onLoad: function(options) {
    // 获取当前大类名称（调用全局方法 getUserClassName）
    const className = app.getUserClassName() || '管理类'
    this.setData({
      className: className
    })
    
    console.log(`[计划] 页面加载，大类: ${className}`)
    // 加载当前大类的数据
    this.loadPlansData(className)
  },

  onReady: function() {},

  onShow: function() {},

  onHide: function() {},

  onUnload: function() {},

  /**
   * 加载指定大类的招生计划数据
   * @param {string} className - 大类名称
   */
  async loadPlansData(className) {
    console.log(`[计划] 加载数据: ${className}`)
    // 使用统一的数组型缓存获取方法（自动验证过期）
    const cachedData = app.getArrayCacheItem('plans', 'class_name', className)
    
    if (cachedData) {
      console.log(`[计划] 使用缓存数据，共 ${cachedData.length} 条`)
      this.setData({
        plansData: cachedData
      })
      return
    }
    
    // 数据不存在或已过期，从云端获取
    console.log('[计划] 缓存未命中，从云端拉取')
    await this.fetchPlansFromCloud(className)
  },

  /**
   * 从云端获取招生计划数据
   * @param {string} className - 大类名称
   */
  async fetchPlansFromCloud(className) {
    const cloud = app.globalData.cloud
    
    if (!cloud) {
      console.error('[计划] cloud 实例未初始化')
      return null
    }
    
    try {
      const response = await new Promise((resolve, reject) => {
        cloud.callContainer({
          path: '/queryDegrees',
          init: {
            method: 'POST',
            timeout: 60000,
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              collectionName: 'degree_plans',
              limit: 1000,
              filter: {
                class_name: className
              }
            })
          },
          success: resolve,
          fail: reject
        })
      })
      
      if (response.statusCode !== 200) {
        console.error('[计划] 接口失败，状态码:', response.statusCode)
        return null
      }
      
      const result = typeof response.data === 'string' ? JSON.parse(response.data) : response.data
      
      if (!result || result.code !== 0 || !result.data) {
        console.error('[计划] 数据格式错误')
        return null
      }
      
      // 更新页面数据
      this.setData({
        plansData: result.data
      })
      
      console.log(`[计划] 云端拉取成功，共 ${result.data.length} 条`)
      
      // 使用统一的数组型缓存存储方法（按 class_name 分类）
      app.setArrayCacheItem('plans', 'class_name', className, result.data)
      
      return result.data
    } catch (err) {
      console.error('[计划] 接口异常:', err)
      return null
    }
  },
})