const app = getApp()

Page({
  data: {
    userClassName: '未选择', // 用户专业大类
    majorClasses: [], // 所有专业大类列表
    showPicker: false, // 是否显示选择器
    multiIndex: [0, 0], // 当前选择的索引 [分组索引, 大类索引]
    multiArray: [[], []], // 多列数据 [[分组列表], [对应大类列表]]
    groups: [], // 分组后的数据结构
    isAdmin: false, // 是否为管理员用户
    isLogin: false, // 登录状态
    nickname: '未登录', // 用户昵称
    level: 0, // 用户等级
    avatarUrl: '', // 用户头像URL
    beian: '', // 备案号
    version: 'v1.0.0', // 版本号
    cacheSize: '0KB', // 缓存大小
    
    // 考试分数相关
    showScoreModal: false, // 是否显示分数设置弹窗
    needMajorTest: false, // 当前专业大类是否需要专业测试
    eduScore: '', // 公共基础分数（满分150）
    majorBasicScore: '', // 专业基础分数（满分150）
    majorTestScore: '', // 专业测试分数（满分100，仅当needMajorTest为true时显示）
    scoreDisplay: '设置成绩' // 格式化后的分数显示
  },

  onLoad: function () {
    console.log('[设置] 页面加载')
    this.loadUserInfo()
    this.loadLoginStatus()
    this.loadConfig()
    this.loadCacheSize()
  },

  async onShow() {
    // 每次显示时刷新用户信息和专业大类数据
    this.loadUserInfo()
    this.loadLoginStatus()
    // 等待专业大类数据加载完成
    await this.ensureMajorClassesData()
    this.loadConfig()
    this.loadCacheSize()
    // 更新 needMajorTest 状态和分数显示
    this.loadMajorTestConfigSync()
    this.formatScoreDisplay()
  },

  /**
   * 获取并显示实际缓存大小
   * 注意：tt.getStorageInfo 返回的 currentSize 单位是 KB，不是字节！
   */
  loadCacheSize() {
    tt.getStorageInfo({
      success: (res) => {
        // currentSize 的单位是 KB，需要转换为字节
        const sizeInKB = res.currentSize || 0
        const sizeInBytes = sizeInKB * 1024
        const formattedSize = this.formatFileSize(sizeInBytes)
        this.setData({
          cacheSize: formattedSize
        })
        console.log(`[设置] 缓存大小: ${formattedSize} (原始值: ${sizeInKB} KB)`)
      },
      fail: (err) => {
        console.error('[设置] 获取缓存大小失败:', err)
        this.setData({
          cacheSize: '未知'
        })
      }
    })
  },

  /**
   * 格式化文件大小（输入为字节）
   */
  formatFileSize(bytes) {
    if (bytes === 0) return '0KB'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + sizes[i]
  },

  /**
   * 加载配置信息（备案号、版本号等）
   */
  loadConfig() {
    const app = getApp()
    const beian = app.getConfig('beian', '')
    const version = app.getConfig('ver', 'v1.0.0')
    this.setData({
      beian,
      version
    })
  },

  /**
   * 加载登录状态
   */
  loadLoginStatus() {
    const app = getApp()
    const isLogin = app.isLoggedIn()

    // 如果标记为已登录但缺少必要信息，重新获取
    if (isLogin && (!app.globalData.userInfo || !app.globalData.userInfo.nickname)) {
      console.log('[设置] 登录状态不一致，重新获取用户信息')
      if (app.globalData.openId) {
        app.getUserInfo(app.globalData.openId)
      }
    }

    const nickname = app.getUserNickname()
    const level = app.getUserLevel()
    const avatarUrl = app.getUserAvatar()

    console.log(`[设置] loadLoginStatus - isLogin: ${isLogin}, nickname: ${nickname}, level: ${level}, avatarUrl: ${avatarUrl}`)

    this.setData({
      isLogin,
      nickname,
      level,
      avatarUrl
    })
  },

  /**
   * 登录按钮点击处理
   * 根据登录状态决定是登录还是更新头像昵称
   */
  handleLogin() {
    const app = getApp()

    // 如果已登录，点击则执行更新头像昵称
    if (app.isLoggedIn()) {
      this.updateDouyinProfile()
      return
    }

    // 未登录，执行登录流程
    tt.showLoading({ title: '登录中...' })

    // 先获取抖音用户信息（必须在用户点击事件中直接调用）
    app.getDouyinUserProfile().then((douyinInfo) => {
      console.log('[设置] 获取抖音信息:', douyinInfo)

      // 调用登录方法
      return app.doLogin().then((success) => {
        tt.hideLoading()
        if (success) {
          // 如果获取到了抖音信息，更新用户信息
          if (douyinInfo.avatarUrl || douyinInfo.nickName) {
            return app.getUserInfo(app.globalData.openId, douyinInfo)
          }
          return true
        }
        return false
      })
    }).then((success) => {
      if (success) {
        tt.showToast({ title: '登录成功', icon: 'success' })
        this.loadLoginStatus()
        this.loadUserInfo()
        this.checkAdminPermission()
      } else {
        tt.showToast({ title: '登录失败', icon: 'none' })
      }
    }).catch((err) => {
      tt.hideLoading()
      console.error('[设置] 登录异常:', err)
      // 如果获取抖音信息失败，仍尝试登录
      this.tryLoginWithoutDouyinInfo()
    })
  },

  /**
   * 不使用抖音信息登录
   */
  tryLoginWithoutDouyinInfo() {
    const app = getApp()

    tt.showLoading({ title: '登录中...' })

    app.doLogin().then((success) => {
      tt.hideLoading()
      if (success) {
        tt.showToast({ title: '登录成功', icon: 'success' })
        this.loadLoginStatus()
        this.loadUserInfo()
        this.checkAdminPermission()
      } else {
        tt.showToast({ title: '登录失败', icon: 'none' })
      }
    }).catch((err) => {
      tt.hideLoading()
      console.error('[设置] 登录异常:', err)
      tt.showToast({ title: '登录异常', icon: 'none' })
    })
  },

  /**
   * 退出登录按钮点击处理
   */
  handleLogout() {
    tt.showModal({
      title: '确认退出',
      content: '确定要退出登录吗？',
      success: (res) => {
        if (res.confirm) {
          const app = getApp()
          app.logout()

          // 刷新页面状态
          this.loadLoginStatus()
          this.loadUserInfo()
          this.checkAdminPermission()

          tt.showToast({ title: '已退出登录', icon: 'success' })
        }
      }
    })
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

    // 格式化分数显示
    this.formatScoreDisplay()

    // 检查是否为管理员
    this.checkAdminPermission()
  },

  /**
   * 格式化分数显示
   * 不需要专业测试：基础总分.专业基础(3位补0)公共基础(3位补0) → 如 195.115080
   * 需要专业测试：专业测试(2位小数)基础总分(3位补0)专业基础(3位补0) → 如 85.20095045
   */
  formatScoreDisplay() {
    const userInfo = app.globalData.userInfo || {}
    const { eduScore, majorBasicScore, majorTestScore } = userInfo
    
    // 先确保 needMajorTest 已正确设置
    this.loadMajorTestConfigSync()
    
    const needMajorTest = this.data.needMajorTest
    
    // 检查是否已设置分数（公共基础和专业基础都必须设置）
    if (!eduScore || !majorBasicScore) {
      this.setData({ scoreDisplay: '设置成绩' })
      return
    }
    
    const edu = parseInt(eduScore) || 0
    const majorBasic = parseInt(majorBasicScore) || 0
    const total = edu + majorBasic
    
    if (needMajorTest) {
      // 需要专业测试：专业测试(2位小数)基础总分(3位补0)专业基础(3位补0)
      const majorTest = parseFloat(majorTestScore) || 0
      const formatted = `${majorTest.toFixed(2)}${String(total).padStart(3, '0')}${String(majorBasic).padStart(3, '0')}`
      this.setData({ scoreDisplay: formatted })
    } else {
      // 不需要专业测试：基础总分.专业基础(3位补0)公共基础(3位补0)
      const formatted = `${total}.${String(majorBasic).padStart(3, '0')}${String(edu).padStart(3, '0')}`
      this.setData({ scoreDisplay: formatted })
    }
  },

  /**
   * 同步加载专业测试配置（用于格式化显示）
   */
  loadMajorTestConfigSync() {
    const className = this.data.userClassName
    if (!className || className === '未选择') {
      this.setData({ needMajorTest: false })
      return
    }
    
    const majorClasses = this.data.majorClasses || app.globalData.majorClasses || []
    if (!majorClasses || majorClasses.length === 0) {
      this.setData({ needMajorTest: false })
      return
    }
    
    const currentClass = majorClasses.find(item => item.class_name === className)
    const needMajorTest = currentClass && currentClass.major_test === true
    
    this.setData({ needMajorTest })
  },

  /**
   * 更新抖音头像昵称
   */
  updateDouyinProfile() {
    const app = getApp()

    // 检查是否已登录
    if (!app.isLoggedIn()) {
      tt.showToast({ title: '请先登录', icon: 'none' })
      return
    }

    tt.showLoading({ title: '更新中...' })

    // 获取最新的抖音用户信息
    app.getDouyinUserProfile().then((douyinInfo) => {
      console.log('[设置] 获取到抖音信息:', douyinInfo)
      console.log('[设置] 当前globalData.userInfo:', app.globalData.userInfo)

      if (douyinInfo.avatarUrl || douyinInfo.nickName) {
        // 先更新本地全局数据，确保页面能立即显示
        if (app.globalData.userInfo) {
          app.globalData.userInfo = {
            ...app.globalData.userInfo,
            avatarUrl: douyinInfo.avatarUrl || app.globalData.userInfo.avatarUrl,
            nickname: douyinInfo.nickName || app.globalData.userInfo.nickname
          }
          tt.setStorageSync('userInfo', JSON.stringify(app.globalData.userInfo))
          console.log('[设置] 已更新本地数据:', app.globalData.userInfo)
        }

        // 调用云函数更新用户信息
        return app.getUserInfo(app.globalData.openId, douyinInfo)
      } else {
        tt.hideLoading()
        tt.showToast({ title: '未获取到用户信息', icon: 'none' })
        return Promise.reject(new Error('未获取到用户信息'))
      }
    }).then((userInfo) => {
      console.log('[设置] 云函数返回的用户信息:', userInfo)
      console.log('[设置] 更新后globalData.userInfo:', app.globalData.userInfo)

      // 检查云函数是否真正返回了有效的用户信息
      if (!userInfo) {
        tt.hideLoading()
        tt.showToast({ title: '同步失败，请重试', icon: 'none' })
        return
      }

      tt.hideLoading()
      tt.showToast({ title: '更新成功', icon: 'success' })
      // 刷新页面显示
      this.loadLoginStatus()
      this.loadUserInfo()
    }).catch((err) => {
      tt.hideLoading()
      console.error('[设置] 更新头像昵称失败:', err)
      tt.showToast({ title: '更新失败', icon: 'none' })
    })
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
          majorClasses
        })
        console.log(`[设置] 专业大类加载完成，共 ${majorClasses.length} 条`)
      } catch (err) {
        console.error('[设置] 专业大类加载失败:', err)
      }
    } else {
      console.log(`[设置] 使用缓存的专业大类数据，共 ${majorClasses.length} 条`)
      this.setData({
        majorClasses
      })
    }

    // 如果需要自动打开选择器，延迟一段时间后打开（等待数据绑定完成）
    const openPicker = tt.getStorageSync('openPicker')
    if (openPicker === 'true') {
      tt.removeStorageSync('openPicker')
      setTimeout(() => {
        this.openMajorClassPicker()
      }, 300)
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
      groups,
      multiArray: [groupNames, currentUserGroupClasses], // ✅ 使用当前分组的第二类数据
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

    const multiIndex = this.data.multiIndex
    const multiArray = this.data.multiArray

    if (column === 0) {
      // 第一列（分组）变化，更新第二列数据
      const selectedGroup = this.data.groups[value]
      const secondColumnData = selectedGroup.classes.map(c => c.class_name)

      multiArray[1] = secondColumnData
      multiIndex[0] = value
      multiIndex[1] = 0 // 重置第二列为第一项
    } else if (column === 1) {
      // 第二列（具体大类）变化
      multiIndex[1] = value
    }

    this.setData({
      multiArray,
      multiIndex
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
      multiIndex = [newGroupIndex, 0] // 重置第二列为第一项

      console.log(`[设置] 第二列更新为: ${secondColumnData.join(', ')}`)
    }

    this.setData({
      multiArray,
      multiIndex
    })
  },

  /**
   * 更新用户专业大类
   * 1. 更新本地显示
   * 2. 更新全局变量
   * 3. 更新缓存
   * 4. 更新 needMajorTest 状态和分数显示
   * 5. 同步到云端
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
      const userInfo = userInfoStr ? JSON.parse(userInfoStr) : {}
      userInfo.userClassName = className
      tt.setStorageSync('userInfo', JSON.stringify(userInfo))
      console.log('[设置] 用户信息缓存已更新')
    } catch (err) {
      console.error('[设置] 更新缓存失败:', err)
    }

    // 4. 更新 needMajorTest 状态和分数显示
    this.loadMajorTestConfigSync()
    this.formatScoreDisplay()

    // 5. 同步到云端
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
          openId,
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
  },

  /**
   * 清除缓存并重启应用
   */
  clearCache() {
    tt.showModal({
      title: '清除缓存',
      content: '清除缓存后将重新启动应用，加载最新数据，是否继续？',
      success: (res) => {
        if (res.confirm) {
          tt.showLoading({ title: '清理中...' })

          try {
            // 1. 清除所有本地缓存
            tt.clearStorageSync()
            console.log('[设置] 本地缓存已清除')

            // 更新缓存大小显示
            this.setData({
              cacheSize: '0KB'
            })

            // 2. 重置全局数据
            const appInstance = getApp()
            appInstance.globalData.schools = []
            appInstance.globalData.majorClasses = []
            appInstance.globalData.appConfig = {}
            console.log('[设置] 全局数据已重置')

            tt.hideLoading()

            // 3. 显示清理成功提示
            tt.showToast({
              title: '缓存清理成功',
              icon: 'success',
              duration: 1500
            })

            // 4. 延迟后重启应用（重新加载首页）
            setTimeout(() => {
              // 使用 switchTab 跳转到首页，触发 app.js 的重新初始化
              tt.switchTab({
                url: '/pages/index/index',
                success: () => {
                  console.log('[设置] 已跳转到首页，应用将重新初始化')
                  // 触发 App 的 onLaunch 重新执行
                  appInstance.onLaunch()
                },
                fail: (err) => {
                  console.error('[设置] 跳转首页失败:', err)
                }
              })
            }, 1500)

          } catch (err) {
            tt.hideLoading()
            console.error('[设置] 清除缓存失败:', err)
            tt.showToast({ title: '清理失败', icon: 'none' })
          }
        }
      }
    })
  },

  /**
   * 点击考试分数选项，打开分数设置弹窗
   */
  openScoreModal() {
    // 检查是否已选择专业大类
    if (this.data.userClassName === '未选择') {
      tt.showToast({
        title: '请先选择专业大类',
        icon: 'none'
      })
      return
    }

    // 获取当前专业大类的 major_test 配置
    this.loadMajorTestConfig()

    // 加载用户已有分数
    this.loadUserScores()

    this.setData({
      showScoreModal: true
    })
    console.log('[设置] 打开考试分数设置弹窗')
  },

  /**
   * 关闭分数设置弹窗
   */
  closeScoreModal() {
    this.setData({
      showScoreModal: false
    })
    console.log('[设置] 关闭考试分数设置弹窗')
  },

  /**
   * 加载当前专业大类的 major_test 配置
   */
  loadMajorTestConfig() {
    const className = this.data.userClassName
    const majorClasses = this.data.majorClasses

    if (!majorClasses || majorClasses.length === 0) {
      console.log('[设置] 专业大类数据为空，默认不需要专业测试')
      this.setData({
        needMajorTest: false
      })
      return
    }

    const currentClass = majorClasses.find(item => item.class_name === className)
    const needMajorTest = currentClass && currentClass.major_test === true

    console.log(`[设置] 当前专业大类 "${className}" 的 major_test: ${needMajorTest}`)

    this.setData({
      needMajorTest
    })
  },

  /**
   * 加载用户已有分数
   */
  loadUserScores() {
    const userInfo = app.globalData.userInfo || {}
    const eduScore = userInfo.eduScore || ''
    const majorBasicScore = userInfo.majorBasicScore || ''
    const majorTestScore = userInfo.majorTestScore || ''

    console.log(`[设置] 加载用户分数: eduScore=${eduScore}, majorBasicScore=${majorBasicScore}, majorTestScore=${majorTestScore}`)

    this.setData({
      eduScore: eduScore.toString(),
      majorBasicScore: majorBasicScore.toString(),
      majorTestScore: majorTestScore.toString(),
      // 保存原始分数用于比较是否有修改
      originalEduScore: eduScore.toString(),
      originalMajorBasicScore: majorBasicScore.toString(),
      originalMajorTestScore: majorTestScore.toString()
    })
  },

  /**
   * 公共基础分数输入变化
   */
  onEduScoreInput(e) {
    const value = e.detail.value
    // 限制输入为数字，且不超过150
    const numValue = parseInt(value) || 0
    const validValue = Math.min(Math.max(0, numValue), 150)
    this.setData({
      eduScore: validValue.toString()
    })
  },

  /**
   * 专业基础分数输入变化
   */
  onMajorBasicScoreInput(e) {
    const value = e.detail.value
    const numValue = parseInt(value) || 0
    const validValue = Math.min(Math.max(0, numValue), 150)
    this.setData({
      majorBasicScore: validValue.toString()
    })
  },

  /**
   * 专业测试分数输入变化（允许最多两位小数，满分100）
   */
  onMajorTestScoreInput(e) {
    let value = e.detail.value
    
    // 只保留数字和小数点
    value = value.replace(/[^\d.]/g, '')
    
    // 只保留第一个小数点
    const parts = value.split('.')
    if (parts.length > 2) {
      value = parts[0] + '.' + parts.slice(1).join('')
    }
    
    // 限制小数点后最多两位
    if (parts.length === 2 && parts[1].length > 2) {
      value = parts[0] + '.' + parts[1].substring(0, 2)
    }
    
    // 转换为数字并限制范围
    const numValue = parseFloat(value) || 0
    const validValue = Math.min(Math.max(0, numValue), 100)
    
    // 保持原始输入格式（如果是小数则保留，否则转为整数）
    let displayValue = value
    if (!value.includes('.') && value !== '') {
      displayValue = validValue.toString()
    }
    
    this.setData({
      majorTestScore: displayValue
    })
  },

  /**
   * 保存考试分数
   */
  saveScores() {
    const { eduScore, majorBasicScore, majorTestScore, needMajorTest, 
            originalEduScore, originalMajorBasicScore, originalMajorTestScore } = this.data

    // 检查是否有修改
    const hasChanges = eduScore !== originalEduScore ||
                       majorBasicScore !== originalMajorBasicScore ||
                       (needMajorTest && majorTestScore !== originalMajorTestScore)

    if (!hasChanges) {
      tt.showToast({ title: '未修改分数', icon: 'none' })
      return
    }

    // 验证必填项
    if (!eduScore || !majorBasicScore) {
      tt.showToast({
        title: '请填写公共基础和专业基础分数',
        icon: 'none'
      })
      return
    }

    // 如果需要专业测试，验证专业测试分数
    if (needMajorTest && !majorTestScore) {
      tt.showToast({
        title: '请填写专业测试分数',
        icon: 'none'
      })
      return
    }

    // 验证分数范围
    const eduNum = parseInt(eduScore)
    const majorBasicNum = parseInt(majorBasicScore)
    const majorTestNum = parseFloat(majorTestScore) || 0

    if (eduNum < 0 || eduNum > 150) {
      tt.showToast({
        title: '公共基础分数必须在0-150之间',
        icon: 'none'
      })
      return
    }

    if (majorBasicNum < 0 || majorBasicNum > 150) {
      tt.showToast({
        title: '专业基础分数必须在0-150之间',
        icon: 'none'
      })
      return
    }

    if (needMajorTest && (majorTestNum < 0 || majorTestNum > 100)) {
      tt.showToast({
        title: '专业测试分数必须在0-100之间',
        icon: 'none'
      })
      return
    }

    tt.showLoading({ title: '保存中...' })

    // 更新本地缓存
    this.updateLocalScores(eduNum, majorBasicNum, majorTestNum)

    // 同步到云端
    this.syncScoresToCloud(eduNum, majorBasicNum, majorTestNum)
  },

  /**
   * 更新本地缓存中的分数
   */
  updateLocalScores(eduScore, majorBasicScore, majorTestScore) {
    try {
      // 更新全局数据
      if (!app.globalData.userInfo) {
        app.globalData.userInfo = {}
      }
      app.globalData.userInfo.eduScore = eduScore
      app.globalData.userInfo.majorBasicScore = majorBasicScore
      app.globalData.userInfo.majorTestScore = majorTestScore

      // 更新本地缓存
      const userInfoStr = tt.getStorageSync('userInfo')
      const userInfo = userInfoStr ? JSON.parse(userInfoStr) : {}
      userInfo.eduScore = eduScore
      userInfo.majorBasicScore = majorBasicScore
      userInfo.majorTestScore = majorTestScore
      tt.setStorageSync('userInfo', JSON.stringify(userInfo))

      // 更新分数显示
      this.formatScoreDisplay()

      console.log('[设置] 本地分数缓存已更新:', { eduScore, majorBasicScore, majorTestScore })
    } catch (err) {
      console.error('[设置] 更新本地缓存失败:', err)
    }
  },

  /**
   * 同步分数到云端
   */
  syncScoresToCloud(eduScore, majorBasicScore, majorTestScore) {
    const cloud = app.globalData.cloud
    const openId = app.globalData.openId

    if (!cloud || !openId) {
      tt.hideLoading()
      console.error('[设置] cloud 或 openId 未初始化')
      tt.showToast({
        title: '本地保存成功',
        icon: 'success'
      })
      this.closeScoreModal()
      return
    }

    console.log('[设置] 同步分数到云端...')

    cloud.callContainer({
      path: '/updateUserInfo',
      init: {
        method: 'POST',
        timeout: 30000,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          openId,
          userClassName: this.data.userClassName,
          eduScore,
          majorBasicScore,
          majorTestScore
        })
      },
      success: ({ statusCode, data }) => {
        tt.hideLoading()
        if (statusCode === 200) {
          try {
            const result = typeof data === 'string' ? JSON.parse(data) : data
            if (result && result.code === 0) {
              console.log('[设置] 分数云端同步成功')
              tt.showToast({
                title: '保存成功',
                icon: 'success'
              })
              this.closeScoreModal()
            } else {
              console.error('[设置] 云端同步失败:', result.message)
              tt.showToast({
                title: '云端同步失败',
                icon: 'none'
              })
            }
          } catch (err) {
            console.error('[设置] 解析云端响应失败:', err)
            tt.showToast({
              title: '保存成功',
              icon: 'success'
            })
            this.closeScoreModal()
          }
        } else {
          console.error('[设置] 云端接口失败，状态码:', statusCode)
          tt.showToast({
            title: '保存成功',
            icon: 'success'
          })
          this.closeScoreModal()
        }
      },
      fail: (err) => {
        tt.hideLoading()
        console.error('[设置] 云端同步异常:', err)
        tt.showToast({
          title: '本地保存成功',
          icon: 'success'
        })
        this.closeScoreModal()
      }
    })
  }
})
