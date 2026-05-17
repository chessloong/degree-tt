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
    // 使用便捷方法获取有效缓存（合并查找和验证）
    const cachedItem = app.getValidCachedItem('plans', 'class_name', className, 'plans')
    
    if (cachedItem) {
      console.log(`[计划] 使用缓存数据，共 ${cachedItem.data.length} 条`)
      this.setData({
        plansData: cachedItem.data
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
    return new Promise((resolve) => {
      const cloud = app.globalData.cloud
      
      if (!cloud) {
        console.error('[计划] cloud 实例未初始化')
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
            collectionName: 'degree_plans',
            limit: 1000,
            filter: {
              class_name: className
            }
          })
        },
        success: ({ statusCode, data }) => {
          if (statusCode === 200) {
            try {
              const result = typeof data === 'string' ? JSON.parse(data) : data
              if (result && result.code === 0 && result.data) {
                // 更新页面数据
                this.setData({
                  plansData: result.data
                })
                
                console.log(`[计划] 云端拉取成功，共 ${result.data.length} 条`)
                
                // 使用数组型缓存存储（按 class_name 分类）
                app.updateCachedItem('plans', 'class_name', className, result.data)
                
                resolve(result.data)
              } else {
                console.error('[计划] 数据格式错误')
                resolve(null)
              }
            } catch (err) {
              console.error('[计划] 数据解析失败:', err)
              resolve(null)
            }
          } else {
            console.error('[计划] 接口失败，状态码:', statusCode)
            resolve(null)
          }
        },
        fail: (err) => {
          console.error('[计划] 接口异常:', err)
          resolve(null)
        }
      })
    })
  },
})