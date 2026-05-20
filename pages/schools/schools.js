const app = getApp()
const { pinyinSort } = require('../../utils/pinyinSort')

Page({
  data: {
    title: '招生院校',
    schools: [],
    loading: true,
    loadingText: '加载中...',
    isCardExpanded: false, // 卡片展开状态
    markers: [], // 地图标记点
    mapLatitude: 39.9042, // 地图中心纬度
    mapLongitude: 116.4074, // 地图中心经度
    mapScale: 5 // 地图缩放级别
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
        loadingText: '',
        markers: this.generateMarkers(schools)
      })

      // 计算地图中心点（include-points 会自动调整视野）
      if (this.data.markers.length > 0) {
        this.calculateMapCenter(this.data.markers)
      }

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
  },

  /**
   * 切换卡片展开/折叠状态
   */
  toggleCard: function() {
    this.setData({
      isCardExpanded: !this.data.isCardExpanded
    })
  },

  /**
   * 生成地图标记点
   */
  generateMarkers: function(schools) {
    return schools
      .filter(school => school.latitude && school.longitude)
      .map((school, index) => ({
        id: index + 1,
        latitude: parseFloat(school.latitude),
        longitude: parseFloat(school.longitude),
        title: school.school_name,
        iconPath: '/assets/school_marker.svg',
        width: 30,
        height: 30,
        // 始终显示学校名称标签
        label: {
          content: school.school_name,
          color: '#333',
          fontSize: 11,
          borderRadius: 3,
          bgColor: '#fff',
          padding: 3,
          textAlign: 'center'
        },
        callout: {
          content: school.school_name,
          color: '#333',
          fontSize: 12,
          borderRadius: 5,
          bgColor: '#fff',
          padding: 5,
          display: 'BYCLICK'
        }
      }))
  },

  /**
   * 计算地图中心点
   * 注意：使用 include-points 属性后，地图会自动调整视野以包含所有标记点
   * 这里只计算中心点作为初始位置
   */
  calculateMapCenter: function(markers) {
    if (!markers || markers.length === 0) return

    // 计算所有标记点的边界
    let minLat = markers[0].latitude
    let maxLat = markers[0].latitude
    let minLng = markers[0].longitude
    let maxLng = markers[0].longitude

    markers.forEach(marker => {
      minLat = Math.min(minLat, marker.latitude)
      maxLat = Math.max(maxLat, marker.latitude)
      minLng = Math.min(minLng, marker.longitude)
      maxLng = Math.max(maxLng, marker.longitude)
    })

    // 计算中心点
    const centerLat = (minLat + maxLat) / 2
    const centerLng = (minLng + maxLng) / 2

    this.setData({
      mapLatitude: centerLat,
      mapLongitude: centerLng,
      mapScale: 10  // 默认缩放级别，include-points 会自动调整
    })

    console.log(`[地图] 中心点: (${centerLat.toFixed(4)}, ${centerLng.toFixed(4)})，使用 include-points 自动调整视野`)
  }
})
