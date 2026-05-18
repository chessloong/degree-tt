const app = getApp()

Page({
  data: {
    userClassName: '未选择',  // 用户专业大类
    majorClasses: [],          // 所有专业大类列表
    showPicker: false,         // 是否显示选择器
    multiIndex: [0, 0],       // 当前选择的索引 [分组索引, 大类索引]
    multiArray: [[], []],     // 多列数据 [[分组列表], [对应大类列表]]
    groups: [],               // 分组后的数据结构
    isAdmin: false            // 是否为管理员用户
  },
  
  onLoad: function() {
    console.log('[设置] 页面加载')
    this.loadUserInfo()
  },
  
  onShow: function() {
    // 每次显示时刷新用户信息和专业大类数据
    this.loadUserInfo()
    this.ensureMajorClassesData()
  },
  
  /**
   * 加载用户信息
   */
  loadUserInfo() {
    const className = app.getUserClassName()
    if (className) {
      console.log(`[设置] 用户专业大类: ${className}`)
      this.setData({
        userClassName: className
      })
    } else {
      console.log('[设置] 用户未设置专业大类')
      this.setData({
        userClassName: '未选择'
      })
    }
    
    // 检查是否为管理员
    this.checkAdminPermission()
  },
  
  /**
   * 检查管理员权限
   */
  checkAdminPermission() {
    const userInfo = app.globalData.userInfo
    const isAdmin = userInfo && userInfo.level === 99
    this.setData({ isAdmin })
    console.log(`[设置] 用户级别: ${userInfo?.level || '未知'}, 是否管理员: ${isAdmin}`)
  },
  
  /**
   * 跳转到超级管理页面
   */
  goToSuperAdmin() {
    console.log('[设置] 跳转到超级管理页面')
    tt.navigateTo({
      url: '/pages/super_admin/super_admin'
    })
  },

  
  /**
   * 确保专业大类数据存在
   */
  async ensureMajorClassesData() {
    // 检查全局数据是否存在
    let majorClasses = app.getMajorClasses()
    
    if (!majorClasses || majorClasses.length === 0) {
      console.log('[设置] 专业大类数据为空，加载数据')
      try {
        majorClasses = await app.loadMajorClassesData()
        this.setData({
          majorClasses: majorClasses
        })
        console.log(`[设置] 专业大类加载完成，共 ${majorClasses.length} 条`)
      } catch (err) {
        console.error('[设置] 专业大类加载失败:', err)
      }
    } else {
      console.log(`[设置] 使用缓存的专业大类数据，共 ${majorClasses.length} 条`)
      this.setData({
        majorClasses: majorClasses
      })
    }
  },
  
  /**
   * 点击专业大类选项，打开选择器
   */
  openMajorClassPicker() {
    const majorClasses = this.data.majorClasses
    
    if (!majorClasses || majorClasses.length === 0) {
      tt.showToast({
        title: '数据加载中，请稍后',
        icon: 'none'
      })
      return
    }
    
    // 对专业大类进行分组
    const groups = this.groupMajorClasses(majorClasses)
    
    // 查找当前用户大类在分组中的位置
    const currentClassName = this.data.userClassName
    let defaultGroupIndex = 0
    let defaultClassIndex = 0
    let found = false
    
    console.log(`[设置] 当前用户大类: ${currentClassName}`)
    
    // 查找当前选中的大类所在的分组和索引
    for (let i = 0; i < groups.length; i++) {
      const classIndex = groups[i].classes.findIndex(c => c.class_name === currentClassName)
      if (classIndex !== -1) {
        defaultGroupIndex = i
        defaultClassIndex = classIndex
        found = true
        console.log(`[设置] 找到用户大类在第 ${i} 个分组，第 ${classIndex} 项`)
        break
      }
    }
    
    if (!found) {
      console.log(`[设置] 未找到用户大类 "${currentClassName}"，使用默认值`)
    }
    
    // ✅ 构建多列数据：第二列应该是用户当前所在分组的数据
    const groupNames = groups.map(g => g.name)
    const currentUserGroupClasses = groups[defaultGroupIndex].classes.map(c => c.class_name)
    
    console.log(`[设置] 第一列数据: ${groupNames.join(', ')}`)
    console.log(`[设置] 第二列数据: ${currentUserGroupClasses.join(', ')}`)
    console.log(`[设置] 初始索引: [${defaultGroupIndex}, ${defaultClassIndex}]`)
    
    this.setData({
      groups: groups,
      multiArray: [groupNames, currentUserGroupClasses],  // ✅ 使用当前分组的第二类数据
      multiIndex: [defaultGroupIndex, defaultClassIndex],
      showPicker: true,
      tempSelectedClass: null
    })
    
    console.log('[设置] 打开专业大类选择器')
  },
  
  /**
   * 关闭选择器（取消）
   */
  closePicker() {
    this.setData({
      showPicker: false,
      tempSelectedClass: null
    })
    console.log('[设置] 取消选择')
  },
  
  /**
   * 确认选择
   */
  confirmSelection() {
    const multiIndex = this.data.multiIndex
    const groupIndex = multiIndex[0]
    const classIndex = multiIndex[1]
    
    const selectedClass = this.data.groups[groupIndex].classes[classIndex]
    const className = selectedClass.class_name
    
    console.log(`[设置] 确认选择专业大类: ${className}`)
    
    // 更新用户选择
    this.updateUserClassName(className)
    
    // 关闭选择器
    this.closePicker()
  },
  
  /**
   * 多列选择器列变化事件
   */
  onColumnChange(e) {
    const column = e.detail.column
    const value = e.detail.value
    
    console.log(`[设置] 选择器第${column}列变化为${value}`)
    
    let multiIndex = this.data.multiIndex
    let multiArray = this.data.multiArray
    
    if (column === 0) {
      // 第一列（分组）变化，更新第二列数据
      const selectedGroup = this.data.groups[value]
      const secondColumnData = selectedGroup.classes.map(c => c.class_name)
      
      multiArray[1] = secondColumnData
      multiIndex[0] = value
      multiIndex[1] = 0  // 重置第二列为第一项
    } else if (column === 1) {
      // 第二列（具体大类）变化
      multiIndex[1] = value
    }
    
    this.setData({
      multiArray: multiArray,
      multiIndex: multiIndex
    })
  },
  
  /**
   * 多列选择器值变化事件（处理滚动和列变化）
   */
  onPickerChange(e) {
    const value = e.detail.value
    console.log(`[设置] 选择器值变化: [${value}]`)
    
    // 检查是否有列发生变化导致需要更新第二列数据
    const oldGroupIndex = this.data.multiIndex[0]
    const newGroupIndex = value[0]
    
    let multiArray = this.data.multiArray
    let multiIndex = value
    
    // 如果第一列（分组）发生了变化，需要更新第二列数据
    if (oldGroupIndex !== newGroupIndex) {
      console.log(`[设置] 第一列从 ${oldGroupIndex} 变为 ${newGroupIndex}，更新第二列数据`)
      
      const selectedGroup = this.data.groups[newGroupIndex]
      const secondColumnData = selectedGroup.classes.map(c => c.class_name)
      
      multiArray = [multiArray[0], secondColumnData]
      multiIndex = [newGroupIndex, 0]  // 重置第二列为第一项
      
      console.log(`[设置] 第二列更新为: ${secondColumnData.join(', ')}`)
    }
    
    this.setData({
      multiArray: multiArray,
      multiIndex: multiIndex
    })
  },
  
  /**
   * 更新用户专业大类
   * 1. 更新本地显示
   * 2. 更新全局变量
   * 3. 更新缓存
   * 4. 同步到云端
   */
  updateUserClassName(className) {
    console.log(`[设置] 开始更新用户专业大类为: ${className}`)
    
    // 1. 更新本地显示
    this.setData({
      userClassName: className
    })
    
    // 2. 更新全局变量
    if (!app.globalData.userInfo) {
      app.globalData.userInfo = {}
    }
    app.globalData.userInfo.userClassName = className
    
    // 3. 更新缓存
    try {
      const userInfoStr = tt.getStorageSync('userInfo')
      let userInfo = userInfoStr ? JSON.parse(userInfoStr) : {}
      userInfo.userClassName = className
      tt.setStorageSync('userInfo', JSON.stringify(userInfo))
      console.log('[设置] 用户信息缓存已更新')
    } catch (err) {
      console.error('[设置] 更新缓存失败:', err)
    }
    
    // 4. 同步到云端
    this.syncUserClassNameToCloud(className)
    
    tt.showToast({
      title: `已选择: ${className}`,
      icon: 'success'
    })
    
    console.log(`[设置] 用户专业大类已更新为: ${className}`)
  },
  
  /**
   * 同步用户专业大类到云端
   */
  syncUserClassNameToCloud(className) {
    const cloud = app.globalData.cloud
    const openId = app.globalData.openId
    
    if (!cloud || !openId) {
      console.error('[设置] cloud 或 openId 未初始化')
      return
    }
    
    console.log('[设置] 同步专业大类到云端...')
    
    cloud.callContainer({
      path: '/updateUserInfo',
      init: {
        method: 'POST',
        timeout: 30000,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          openId: openId,
          userClassName: className
        })
      },
      success: ({ statusCode, data }) => {
        if (statusCode === 200) {
          try {
            const result = typeof data === 'string' ? JSON.parse(data) : data
            if (result && result.code === 0) {
              console.log('[设置] 云端同步成功')
            } else {
              console.error('[设置] 云端同步失败:', result.message)
            }
          } catch (err) {
            console.error('[设置] 解析云端响应失败:', err)
          }
        } else {
          console.error('[设置] 云端接口失败，状态码:', statusCode)
        }
      },
      fail: (err) => {
        console.error('[设置] 云端同步异常:', err)
      }
    })
  },
  
  /**
   * 对专业大类进行分组
   * 规则：
   * - 前三字是"教育类"的归教育类
   * - 前三字是"医药卫"的归医药卫生类
   * - 前三字是"艺术类"的归艺术类
   * - 剩余的归为其它类
   */
  groupMajorClasses(majorClasses) {
    const groups = [
      { name: '教育类', classes: [] },
      { name: '医药卫生类', classes: [] },
      { name: '艺术类', classes: [] },
      { name: '其它类', classes: [] }
    ]
    
    majorClasses.forEach(item => {
      const className = item.class_name
      const prefix = className.substring(0, 3)
      
      if (prefix === '教育类') {
        groups[0].classes.push(item)
      } else if (prefix === '医药卫') {
        groups[1].classes.push(item)
      } else if (prefix === '艺术类') {
        groups[2].classes.push(item)
      } else {
        groups[3].classes.push(item)
      }
    })
    
    // 过滤掉空的分组
    return groups.filter(g => g.classes.length > 0)
  }
})
