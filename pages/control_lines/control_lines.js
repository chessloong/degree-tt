const app = getApp()

Page({
  data: {
    title: '省控线',
    controlLines: [],       // 省控线数据列表
    collectVolunteers: [],  // 征集志愿数据列表
    currentClassName: '',   // 当前专业大类
    loading: true,
    loadingText: '加载中...'
  },

  onLoad: function(options) {
    console.log('[省控线] 页面加载')
  },

  onReady: function() {},

  onShow: function() {
    // 每次显示时加载/刷新数据（内部已有缓存保护）
    this.loadControlLinesData()
  },

  onHide: function() {},

  onUnload: function() {},

  /**
   * 加载省控线数据
   */
  async loadControlLinesData() {
    this.setData({
      loading: true,
      loadingText: '加载中...'
    })

    try {
      // 获取用户的专业大类
      const className = app.getUserClassName() || '管理类'
      console.log(`[省控线] 当前用户大类: ${className}`)

      // 批量加载所需数据（并行加载）
      const data = await app.loadPageDataBatch([
        {
          cacheKey: 'control_lines',
          collection: 'degree_control_lines',
          filter: { class_name: className },
          type: 'array',
          itemKey: 'class_name',
          itemValue: className,
          defaultValue: []
        },
        {
          cacheKey: 'collect_volunteer',
          collection: 'degree_collect_volunteer',
          filter: { class_name: className },
          type: 'array',
          itemKey: 'class_name',
          itemValue: className,
          defaultValue: []
        }
      ])

      this.setData({
        controlLines: data.control_lines,
        collectVolunteers: data.collect_volunteer,
        currentClassName: className,
        loading: false,
        loadingText: ''
      })

      console.log(`[省控线] 加载完成，省控线 ${data.control_lines.length} 条，征集志愿 ${data.collect_volunteer.length} 条`)

    } catch (err) {
      console.error('[省控线] 加载失败:', err)
      tt.showToast({
        title: '加载失败，请重试',
        icon: 'none'
      })
      this.setData({
        loading: false,
        loadingText: '',
        controlLines: [],
        collectVolunteers: []
      })
    }
  }
})
