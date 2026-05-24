const app = getApp()

Page({
  data: {
    title: '投档线',
    admissionLines: [],     // 投档线数据列表
    collectVolunteers: [],  // 征集志愿数据列表
    currentClassName: '',   // 当前专业大类
    loading: true,
    loadingText: '加载中...'
  },

  onLoad: function(options) {
    console.log('[投档线] 页面加载')
  },

  onReady: function() {},

  onShow: function() {
    // 每次显示时加载/刷新数据（内部已有缓存保护）
    this.loadAdmissionLinesData()
  },

  onHide: function() {},

  onUnload: function() {},

  /**
   * 加载投档线数据
   */
  async loadAdmissionLinesData() {
    this.setData({
      loading: true,
      loadingText: '加载中...'
    })

    try {
      // 获取用户的专业大类
      const className = app.getUserClassName() || '管理类'
      console.log(`[投档线] 当前用户大类: ${className}`)

      // 批量加载所需数据（并行加载）
      const data = await app.loadPageDataBatch([
        {
          cacheKey: 'admission_lines',
          collection: 'degree_admission_lines',
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
        admissionLines: data.admission_lines,
        collectVolunteers: data.collect_volunteer,
        currentClassName: className,
        loading: false,
        loadingText: ''
      })

      console.log(`[投档线] 加载完成，投档线 ${data.admission_lines.length} 条，征集志愿 ${data.collect_volunteer.length} 条`)

    } catch (err) {
      console.error('[投档线] 加载失败:', err)
      tt.showToast({
        title: '加载失败，请重试',
        icon: 'none'
      })
      this.setData({
        loading: false,
        loadingText: '',
        admissionLines: [],
        collectVolunteers: []
      })
    }
  }
})
