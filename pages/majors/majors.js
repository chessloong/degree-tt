const app = getApp()

Page({
  data: {
    title: '招生专业',
    majorClasses: [],  // 专业大类列表
    loading: true
  },

  onLoad: function(options) {
    console.log('[专业] 页面加载')
    this.loadMajorClassesData()
  },

  onReady: function() {},

  onShow: function() {
    // 每次显示时刷新数据
    this.loadMajorClassesData()
  },

  onHide: function() {},

  onUnload: function() {},

  /**
   * 加载专业大类数据
   */
  async loadMajorClassesData() {
    this.setData({
      loading: true
    })

    try {
      // 优先从全局变量读取（app.js onLaunch 时已加载）
      let majorClasses = app.getMajorClasses()
      
      // 如果全局数据为空，才重新加载
      if (!majorClasses || majorClasses.length === 0) {
        console.log('[专业] 全局数据为空，从云端加载')
        majorClasses = await app.loadMajorClassesData()
      } else {
        console.log(`[专业] 使用全局缓存，共 ${majorClasses.length} 条`)
      }

      this.setData({
        majorClasses: majorClasses,
        loading: false
      })

      console.log(`[专业] 加载完成，共 ${majorClasses.length} 条`)

    } catch (err) {
      console.error('[专业] 加载失败:', err)
      tt.showToast({
        title: '加载失败，请重试',
        icon: 'none'
      })
      this.setData({
        loading: false,
        majorClasses: []
      })
    }
  }
})
