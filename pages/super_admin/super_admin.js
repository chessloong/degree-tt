const app = getApp()

Page({
  data: {
    expireConfig: {},        // 缓存过期配置
    icpBeian: '',            // ICP备案号
    loading: true,           // 加载状态
    saving: false            // 保存状态
  },
  
  onLoad: function() {
    console.log('[超级管理] 页面加载')
    this.loadExpireConfig()
  },
  
  onShow: function() {
    // 每次显示时刷新配置
    this.loadExpireConfig()
    this.loadIcpBeian()
  },
  
  /**
   * 加载缓存过期配置
   */
  loadExpireConfig() {
    this.setData({ loading: true })
    
    try {
      // 从全局配置中获取 expireMinute
      const expireConfig = app.getConfig('expireMinute', {})
      
      this.setData({
        expireConfig: expireConfig,
        loading: false
      })
      
      console.log('[超级管理] 缓存配置加载成功:', expireConfig)
    } catch (err) {
      console.error('[超级管理] 加载配置失败:', err)
      this.setData({ loading: false })
      tt.showToast({
        title: '加载配置失败',
        icon: 'none'
      })
    }
  },
  
  /**
   * 输入框变化事件
   */
  onInputChange(e) {
    const key = e.currentTarget.dataset.key
    const value = parseInt(e.detail.value) || 0
    
    const expireConfig = { ...this.data.expireConfig }
    expireConfig[key] = value
    
    this.setData({ expireConfig })
  },
  
  /**
   * 保存配置
   */
  async saveConfig() {
    if (this.data.saving) {
      return
    }
    
    this.setData({ saving: true })
    tt.showLoading({ title: '保存中...' })
    
    try {
      // 调用云函数更新配置（直接传递 expireMinute 对象）
      const cloud = app.globalData.cloud
      
      if (!cloud) {
        throw new Error('cloud 实例未初始化')
      }
      
      console.log('[超级管理] 开始保存配置:', this.data.expireConfig)
      
      const response = await new Promise((resolve, reject) => {
        cloud.callContainer({
          path: '/updateConfig',
          init: {
            method: 'POST',
            timeout: 30000,
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              configKey: 'expireMinute',
              configValue: this.data.expireConfig
            })
          },
          success: resolve,
          fail: reject
        })
      })
      
      console.log('[超级管理] 云函数响应:', response)
      
      if (response.statusCode !== 200) {
        throw new Error(`接口失败，状态码: ${response.statusCode}`)
      }
      
      const result = typeof response.data === 'string' ? JSON.parse(response.data) : response.data
      
      if (result.code !== 0) {
        throw new Error(result.message || '更新失败')
      }
      
      console.log('[超级管理] 配置更新成功:', result.data)
      
      tt.hideLoading()
      tt.showToast({
        title: '保存成功',
        icon: 'success'
      })
      
      // 重新加载配置（从云端拉取最新）
      await app.loadAppConfig()
      
      this.setData({ saving: false })
    } catch (err) {
      console.error('[超级管理] 保存配置失败:', err)
      tt.hideLoading()
      tt.showToast({
        title: '保存失败: ' + err.message,
        icon: 'none'
      })
      this.setData({ saving: false })
    }
  },
  
  /**
   * 加载 ICP 备案号
   */
  loadIcpBeian() {
    const beian = app.getConfig('beian', '')
    this.setData({
      icpBeian: beian || ''
    })
    console.log('[超级管理] ICP备案号:', beian || '未设置')
  },
  
  /**
   * 备案号输入变化
   */
  onBeianInputChange(e) {
    this.setData({
      icpBeian: e.detail.value
    })
  },
  
  /**
   * 保存备案号
   */
  async saveIcpBeian() {
    if (this.data.saving) {
      return
    }
    
    const beian = this.data.icpBeian.trim()
    
    if (!beian) {
      tt.showToast({
        title: '备案号不能为空',
        icon: 'none'
      })
      return
    }
    
    this.setData({ saving: true })
    tt.showLoading({ title: '保存中...' })
    
    try {
      const cloud = app.globalData.cloud
      
      if (!cloud) {
        throw new Error('cloud 实例未初始化')
      }
      
      console.log('[超级管理] 开始保存备案号:', beian)
      
      const response = await new Promise((resolve, reject) => {
        cloud.callContainer({
          path: '/updateConfig',
          init: {
            method: 'POST',
            timeout: 30000,
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              configKey: 'beian',
              configValue: beian
            })
          },
          success: resolve,
          fail: reject
        })
      })
      
      if (response.statusCode !== 200) {
        throw new Error(`接口失败，状态码: ${response.statusCode}`)
      }
      
      const result = typeof response.data === 'string' ? JSON.parse(response.data) : response.data
      
      if (result.code !== 0) {
        throw new Error(result.message || '更新失败')
      }
      
      console.log('[超级管理] 备案号保存成功:', result.data)
      
      tt.hideLoading()
      tt.showToast({
        title: '保存成功',
        icon: 'success'
      })
      
      // 重新加载配置（从云端拉取最新）
      await app.loadAppConfig()
      
      this.setData({ saving: false })
    } catch (err) {
      console.error('[超级管理] 保存备案号失败:', err)
      tt.hideLoading()
      tt.showToast({
        title: '保存失败: ' + err.message,
        icon: 'none'
      })
      this.setData({ saving: false })
    }
  }
})