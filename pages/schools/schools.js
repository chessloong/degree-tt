const app = getApp()
const { pinyinSort } = require('../../utils/pinyinSort')

Page({
  data: {
    title: '招生院校',
    schools: [],
    loading: true,
    loadingText: '加载中...'
  },

  onLoad: function(options) {
    console.log('[院校] 页面加载')
  },

  onReady: function() {},

  onShow: function() {
    // 每次显示时加载/刷新数据（内部已有缓存保护）
    this.loadSchoolsData()
  },

  onHide: function() {},

  onUnload: function() {},

  /**
   * 加载院校数据
   * 优先从全局变量读取，仅在数据为空时才重新加载
   */
  async loadSchoolsData() {
    this.setData({
      loading: true,
      loadingText: '加载中...'
    })

    try {
      // 优先从全局变量读取（app.js onLaunch 时已加载）
      let schools = app.getSchools()
      
      // 如果全局数据为空，才重新加载
      if (!schools || schools.length === 0) {
        console.log('[院校] 全局数据为空，从云端加载')
        schools = await app.loadSchoolsData()
      } else {
        console.log(`[院校] 使用全局缓存，共 ${schools.length} 条`)
      }

      // 按院校名称拼音升序排列（使用自定义拼音排序工具）
      schools = pinyinSort(schools, 'school_name')

      this.setData({
        schools: schools,
        loading: false,
        loadingText: ''
      })

      console.log(`[院校] 加载完成，共 ${schools.length} 条`)

    } catch (err) {
      console.error('[院校] 加载失败:', err)
      tt.showToast({
        title: '加载失败，请重试',
        icon: 'none'
      })
      this.setData({
        loading: false,
        loadingText: '',
        schools: []
      })
    }
  },

  /**
   * 下拉刷新
   */
  onPullDownRefresh: function() {
    // 清除缓存
    tt.removeStorageSync('schools')
    app.globalData.schools = []
    
    // 重新加载
    this.loadSchoolsData().then(() => {
      tt.stopPullDownRefresh()
    })
  }
})
