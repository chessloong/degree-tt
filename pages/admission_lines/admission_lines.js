const app = getApp()

Page({
  data: {
    title: '投档线',
    admissionLines: [],     // 投档线数据列表
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

      // 检查缓存
      const cachedData = app.getArrayCacheItem('admission_lines', 'class_name', className)
      if (cachedData) {
        console.log(`[投档线] 使用缓存数据，共 ${cachedData.length} 条`)
        this.setData({
          admissionLines: cachedData,
          currentClassName: className,
          loading: false,
          loadingText: ''
        })
        return
      }

      // 缓存无效或不存在，从云端拉取
      console.log('[投档线] 缓存无效，从云端加载')
      const data = await app.loadDataFromCloud('degree_admission_lines', { class_name: className })

      if (data && data.length > 0) {
        // 存入数组型缓存
        app.setArrayCacheItem('admission_lines', 'class_name', className, data)
        
        this.setData({
          admissionLines: data,
          currentClassName: className,
          loading: false,
          loadingText: ''
        })
        console.log(`[投档线] 加载成功，共 ${data.length} 条`)
      } else {
        console.log(`[投档线] 未找到 ${className} 的投档线数据`)
        this.setData({
          admissionLines: [],
          currentClassName: className,
          loading: false,
          loadingText: ''
        })
      }

    } catch (err) {
      console.error('[投档线] 加载失败:', err)
      tt.showToast({
        title: '加载失败，请重试',
        icon: 'none'
      })
      this.setData({
        loading: false,
        loadingText: '',
        admissionLines: []
      })
    }
  }
})
