const app = getApp()

Page({
  data: {
    title: '超级管理',
    userInfo: {},
    isAdmin: false,
    loading: true
  },

  onLoad: function(options) {
    console.log('[超级管理] 页面加载')
    this.checkAdminPermission()
  },

  onShow: function() {
    // 每次显示时重新验证权限
    this.checkAdminPermission()
  },

  /**
   * 检查管理员权限
   */
  checkAdminPermission() {
    this.setData({ loading: true })

    try {
      // 获取用户信息
      const userInfo = app.globalData.userInfo
      
      if (!userInfo) {
        // 从缓存获取
        const userInfoStr = tt.getStorageSync('userInfo')
        if (userInfoStr) {
          app.globalData.userInfo = JSON.parse(userInfoStr)
        }
      }

      const currentUserInfo = app.globalData.userInfo
      const isAdmin = currentUserInfo && currentUserInfo.level === 99

      if (!isAdmin) {
        console.log('[超级管理] 非管理员用户，拒绝访问')
        tt.showToast({
          title: '无权限访问',
          icon: 'none',
          duration: 2000
        })
        
        // 延迟返回
        setTimeout(() => {
          tt.navigateBack()
        }, 2000)
        
        this.setData({ 
          isAdmin: false,
          loading: false 
        })
        return
      }

      console.log('[超级管理] 管理员验证通过')
      this.setData({
        isAdmin: true,
        userInfo: currentUserInfo,
        loading: false
      })

    } catch (err) {
      console.error('[超级管理] 权限检查失败:', err)
      tt.showToast({
        title: '权限检查失败',
        icon: 'none'
      })
      this.setData({ 
        isAdmin: false,
        loading: false 
      })
    }
  },

  /**
   * 刷新缓存
   */
  refreshCache() {
    console.log('[超级管理] 手动刷新所有缓存')
    
    // 清除所有缓存
    try {
      tt.removeStorageSync('schools')
      tt.removeStorageSync('major_classes')
      tt.removeStorageSync('plans')
      tt.removeStorageSync('majors')
      tt.removeStorageSync('score_segments')
      tt.removeStorageSync('control_lines')
      tt.removeStorageSync('admission_lines')
      
      // 清除全局变量
      app.globalData.schools = []
      app.globalData.majorClasses = []
      
      tt.showToast({
        title: '缓存已清除',
        icon: 'success'
      })
      console.log('[超级管理] 所有缓存已清除')
    } catch (err) {
      console.error('[超级管理] 清除缓存失败:', err)
      tt.showToast({
        title: '清除失败',
        icon: 'none'
      })
    }
  },

  /**
   * 查看用户信息
   */
  viewUserInfo() {
    console.log('[超级管理] 当前用户信息:', this.data.userInfo)
    tt.showModal({
      title: '用户信息',
      content: JSON.stringify(this.data.userInfo, null, 2),
      showCancel: false
    })
  },

  /**
   * 返回上一页
   */
  goBack() {
    tt.navigateBack()
  }
})