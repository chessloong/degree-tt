const app = getApp()

Page({
  data: {
    title: '招生专业',
    majorClasses: [],  // 专业大类列表
    majors: [],        // 当前大类的专业列表
    currentClassName: '',  // 当前选中的专业大类名称
    loading: true,
    loadingText: '加载中...'
  },

  onLoad: function(options) {
    console.log('[招生专业页] 页面加载')
  },

  onReady: function() {},

  onShow: function() {
    // 每次显示时加载/刷新数据（内部已有缓存保护）
    this.loadData()
  },

  onHide: function() {},

  onUnload: function() {},

  /**
   * 并行加载专业大类和专业列表数据
   */
  async loadData() {
    this.setData({
      loading: true,
      loadingText: '加载中...'
    })

    try {
      // 获取用户的专业大类
      const className = app.getUserClassName() || '管理类'
      console.log(`[专业列表] 当前用户大类: ${className}`)

      // 并行加载专业大类和专业列表
      const [majorClasses, majors] = await Promise.all([
        this.loadMajorClassesData(),
        this.loadMajorsData(className)
      ])

      this.setData({
        majorClasses: majorClasses,
        majors: majors,
        currentClassName: className,
        loading: false,
        loadingText: ''
      })

      console.log(`[专业列表] 加载完成 - 大类: ${majorClasses.length} 条, 专业: ${majors.length} 条`)

    } catch (err) {
      console.error('[专业列表] 加载失败:', err)
      tt.showToast({
        title: '加载失败，请重试',
        icon: 'none'
      })
      this.setData({
        loading: false,
        loadingText: '',
        majorClasses: [],
        majors: []
      })
    }
  },

  /**
   * 加载专业大类数据
   */
  async loadMajorClassesData() {
    // 优先从全局变量读取（app.js onLaunch 时已加载）
    let majorClasses = app.getMajorClasses()
    
    // 如果全局数据为空，才重新加载
    if (!majorClasses || majorClasses.length === 0) {
      console.log('[专业大类] 全局数据为空，从云端加载')
      majorClasses = await app.loadMajorClassesData()
    } else {
      console.log(`[专业大类] 使用全局缓存，共 ${majorClasses.length} 条`)
    }

    return majorClasses
  },

  /**
   * 加载指定大类的专业列表
   * @param {string} className - 专业大类名称
   */
  async loadMajorsData(className) {
    console.log(`[专业列表] 加载: ${className}`)

    // 检查缓存
    const cachedData = app.getArrayCacheItem('majors', 'class_name', className)
    if (cachedData) {
      console.log(`[专业列表] 使用缓存，共 ${cachedData.length} 条`)
      return cachedData
    }

    // 缓存无效或不存在，从云端拉取
    console.log('[专业列表] 缓存无效，从云端加载')
    
    try {
      const data = await app.loadDataFromCloud('degree_majors', { class_name: className })
      
      if (data && data.length > 0) {
        // 存入数组型缓存
        app.setArrayCacheItem('majors', 'class_name', className, data)
        console.log(`[专业列表] 加载成功，共 ${data.length} 条`)
        return data
      } else {
        console.log(`[专业列表] 未找到 ${className} 的数据`)
        return []
      }
    } catch (err) {
      console.error('[专业列表] 加载失败:', err)
      return []
    }
  },

  /**
   * 切换专业大类
   * @param {object} e - 事件对象
   */
  onClassChange(e) {
    const className = e.detail.value
    console.log(`[专业列表] 切换到大类: ${className}`)

    this.setData({
      currentClassName: className,
      loading: true,
      loadingText: '加载中...'
    })

    // 加载对应大类的专业列表
    this.loadMajorsData(className).then(majors => {
      this.setData({
        majors: majors,
        loading: false,
        loadingText: ''
      })
      console.log(`[专业列表] 已切换到 ${className}，共 ${majors.length} 个专业`)
    }).catch(err => {
      console.error('[专业列表] 切换大类失败:', err)
      this.setData({
        loading: false,
        loadingText: '',
        majors: []
      })
    })
  }
})
