const app = getApp()

Page({
  data: {
    title: '一分一段',
    scoreSegments: [],     // 一分一段数据列表
    currentClassName: '',  // 当前专业大类
    loading: true,
    loadingText: '加载中...'
  },

  onLoad: function(options) {
    console.log('[分段] 页面加载')
  },

  onReady: function() {},

  onShow: function() {
    // 每次显示时加载/刷新数据（内部已有缓存保护）
    this.loadScoreSegmentsData()
  },

  onHide: function() {},

  onUnload: function() {},

  /**
   * 加载一分一段数据
   */
  async loadScoreSegmentsData() {
    this.setData({
      loading: true,
      loadingText: '加载中...'
    })

    try {
      // 获取用户的专业大类
      const className = app.getUserClassName() || '管理类'
      console.log(`[分段] 当前用户大类: ${className}`)

      // 检查缓存
      const cachedData = app.getArrayCacheItem('score_segments', 'class_name', className)
      if (cachedData) {
        console.log(`[分段] 使用缓存数据，共 ${cachedData.length} 条`)
        this.setData({
          scoreSegments: cachedData,
          currentClassName: className,
          loading: false,
          loadingText: ''
        })
        return
      }

      // 缓存无效或不存在，从云端拉取
      console.log('[分段] 缓存无效，从云端加载')
      const data = await app.loadDataFromCloud('degree_score_segments', { class_name: className })

      if (data && data.length > 0) {
        // 存入数组型缓存
        app.setArrayCacheItem('score_segments', 'class_name', className, data)
        
        this.setData({
          scoreSegments: data,
          currentClassName: className,
          loading: false,
          loadingText: ''
        })
        console.log(`[分段] 加载成功，共 ${data.length} 条`)
      } else {
        console.log(`[分段] 未找到 ${className} 的一分一段数据`)
        this.setData({
          scoreSegments: [],
          currentClassName: className,
          loading: false,
          loadingText: ''
        })
      }

    } catch (err) {
      console.error('[分段] 加载失败:', err)
      tt.showToast({
        title: '加载失败，请重试',
        icon: 'none'
      })
      this.setData({
        loading: false,
        loadingText: '',
        scoreSegments: []
      })
    }
  }
})
