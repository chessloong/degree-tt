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
    mapScale: 5, // 地图缩放级别
    showSchoolModal: false, // 显示院校详情模态框
    selectedSchool: null, // 选中的院校信息
    schoolStats: { total: 0, public: 0, private: 0 } // 院校统计：总数、公办、民办
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

      // 计算院校统计：总数、公办(2B)、民办(2C)
      const stats = {
        total: schools.length,
        public: schools.filter(s => s.level === '2B').length,
        private: schools.filter(s => s.level === '2C').length
      }

      this.setData({
        schools: schools,
        loading: false,
        loadingText: '',
        markers: this.generateMarkers(schools),
        schoolStats: stats
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
      .map((school, index) => {
        // 根据院校层次确定颜色方案
        const isLevel2B = school.level === '2B'
        const iconPath = isLevel2B ? '/assets/school_marker.svg' : '/assets/school_marker_green.svg'
        const calloutBgColor = isLevel2B ? '#cce6ff' : '#d7f0db'  // 2B浅蓝色，2C浅绿色
        const calloutColor = isLevel2B ? '#0081ff' : '#39b54a'  // 2B蓝色，2C绿色

        return {
          id: index + 1,
          latitude: parseFloat(school.latitude),
          longitude: parseFloat(school.longitude),
          title: school.school_name,
          iconPath: iconPath,
          width: 30,
          height: 30,
          // 使用 callout 始终显示学校名称（比 label 效果更好）
          callout: {
            content: school.school_name,
            color: calloutColor,
            fontSize: 12,
            borderRadius: 5,
            bgColor: calloutBgColor,
            padding: 5,
            display: 'ALWAYS',  // 始终显示，不需要点击
            textAlign: 'center'
          }
        }
      })
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

    // 添加边距（扩大范围约 20%）
    const latRange = maxLat - minLat
    const lngRange = maxLng - minLng
    const padding = 0.2 // 20% 的边距

    minLat -= latRange * padding
    maxLat += latRange * padding
    minLng -= lngRange * padding
    maxLng += lngRange * padding

    // 计算中心点
    const centerLat = (minLat + maxLat) / 2
    const centerLng = (minLng + maxLng) / 2

    this.setData({
      mapLatitude: centerLat,
      mapLongitude: centerLng,
      mapScale: 10  // 默认缩放级别，include-points 会自动调整
    })

    console.log(`[地图] 中心点: (${centerLat.toFixed(4)}, ${centerLng.toFixed(4)})，使用 include-points 自动调整视野`)
  },

  /**
   * 重置地图视野到初始状态
   */
  resetMapView: function() {
    console.log('[地图] 点击重置视野按钮')
    
    if (this.data.markers.length > 0) {
      // 计算中心点
      let minLat = this.data.markers[0].latitude
      let maxLat = this.data.markers[0].latitude
      let minLng = this.data.markers[0].longitude
      let maxLng = this.data.markers[0].longitude

      this.data.markers.forEach(marker => {
        minLat = Math.min(minLat, marker.latitude)
        maxLat = Math.max(maxLat, marker.latitude)
        minLng = Math.min(minLng, marker.longitude)
        maxLng = Math.max(maxLng, marker.longitude)
      })

      // 添加边距（扩大范围约 20%）
      const latRange = maxLat - minLat
      const lngRange = maxLng - minLng
      const padding = 0.2 // 20% 的边距

      minLat -= latRange * padding
      maxLat += latRange * padding
      minLng -= lngRange * padding
      maxLng += lngRange * padding

      const centerLat = (minLat + maxLat) / 2
      const centerLng = (minLng + maxLng) / 2

      // 获取地图上下文
      const mapCtx = tt.createMapContext('schoolMap', this)
      
      // 使用 moveToLocation 或直接设置经纬度
      // 由于抖音小程序可能不支持某些方法，我们直接更新数据
      this.setData({
        mapLatitude: centerLat,
        mapLongitude: centerLng,
        // 临时移除 include-points 的效果，通过改变 markers 数组触发重新渲染
        markers: []
      }, () => {
        // 恢复 markers，触发地图重新计算
        setTimeout(() => {
          this.setData({
            markers: this.generateMarkers(this.data.schools),
            mapScale: 10
          }, () => {
            console.log('[地图] 视野已重置到:', centerLat, centerLng)
            tt.showToast({
              title: '已重置视野',
              icon: 'success'
            })
          })
        }, 100)
      })
    } else {
      console.log('[地图] 没有标记点，无法重置')
      tt.showToast({
        title: '暂无数据',
        icon: 'none'
      })
    }
  },

  /**
   * 点击地图标记点
   */
  onMarkerTap: function(e) {
    console.log('[地图] 点击标记点:', e)
    
    // 尝试多种方式获取 markerId
    let markerId = null
    
    if (e.detail && e.detail.markerId) {
      // markerId 可能是字符串，需要转换为数字
      markerId = parseInt(e.detail.markerId)
    } else if (e.target && e.target.id) {
      markerId = parseInt(e.target.id)
    } else if (e.target && e.target.dataset && e.target.dataset.id) {
      markerId = parseInt(e.target.dataset.id)
    }
    
    console.log('[地图] 获取到的 markerId:', markerId, '类型:', typeof markerId)
    
    if (!markerId) {
      console.log('[地图] 无法获取 markerId')
      return
    }
    
    // 直接通过 markerId 找到对应的标记点
    const marker = this.data.markers.find(m => m.id === markerId)
    
    if (!marker) {
      console.log('[地图] 未找到标记点, markerId:', markerId)
      console.log('[地图] 所有标记点 IDs:', this.data.markers.map(m => m.id))
      return
    }
    
    console.log('[地图] 找到标记点:', marker)
    
    // 通过经纬度找到对应的学校
    const school = this.data.schools.find(s => 
      parseFloat(s.latitude) === marker.latitude && 
      parseFloat(s.longitude) === marker.longitude
    )

    if (school) {
      console.log('[地图] 找到学校:', school.school_name)
      // 使用 setTimeout 延迟显示模态框，避免与地图拖拽冲突
      setTimeout(() => {
        this.setData({
          showSchoolModal: true,
          selectedSchool: school
        })
      }, 100)
    } else {
      console.log('[地图] 未找到对应学校')
    }
  },

  /**
   * 点击地图标记点的 callout 标签
   */
  onCalloutTap: function(e) {
    console.log('[地图] 点击 callout 标签:', e)
    
    // callout 点击事件也返回 markerId
    let markerId = null
    
    if (e.detail && e.detail.markerId) {
      markerId = parseInt(e.detail.markerId)
    }
    
    console.log('[地图] callout markerId:', markerId)
    
    if (!markerId) {
      console.log('[地图] 无法获取 markerId')
      return
    }
    
    // 直接通过 markerId 找到对应的标记点
    const marker = this.data.markers.find(m => m.id === markerId)
    
    if (!marker) {
      console.log('[地图] 未找到标记点, markerId:', markerId)
      return
    }
    
    // 通过经纬度找到对应的学校
    const school = this.data.schools.find(s => 
      parseFloat(s.latitude) === marker.latitude && 
      parseFloat(s.longitude) === marker.longitude
    )

    if (school) {
      console.log('[地图] 找到学校:', school.school_name)
      // 使用 setTimeout 延迟显示模态框，避免与地图拖拽冲突
      setTimeout(() => {
        this.setData({
          showSchoolModal: true,
          selectedSchool: school
        })
      }, 100)
    } else {
      console.log('[地图] 未找到对应学校')
    }
  },

  /**
   * 关闭院校详情模态框
   */
  closeSchoolModal: function() {
    console.log('[地图] 关闭模态框')
    this.setData({
      showSchoolModal: false,
      selectedSchool: null
    })
  },

  /**
   * 阻止事件冒泡（用于模态框内容）
   */
  stopPropagation: function() {
    // 空方法，仅用于阻止事件冒泡
  }
})
