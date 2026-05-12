const config = require('./config.js')

App({
  globalData: {
    cloud: null,
    openId: '',
    unionId: '',
    isLogin: false
  },
  
  onLaunch: async function () {
    // 1. 初始化抖音云
    const cloud = tt.createCloud({
      envID: config.env,
      serviceID: config.serviceId,
    })
    
    // 2. 检查登录状态
    let isLogin = false
    try {
      await this.handleCheckSession()
      isLogin = true
      console.log('session 有效')
    } catch (err) {
      console.log('session 已过期，需要重新登录', err)
      const res = await this.handleLogin()
      isLogin = res.isLogin
    }
    
    // 3. 保存全局数据
    this.globalData.cloud = cloud
    this.globalData.isLogin = isLogin
    
    // 4. 如果登录成功，获取用户openid
    if (isLogin) {
      this.getUserOpenId()
    }
  },
  
  // 登录方法（Promise封装）
  handleLogin() {
    return new Promise((resolve) => {
      tt.login({
        success: (res) => {
          console.log('login success', res)
          resolve(res)
        },
        fail: (err) => {
          console.log('login err', err)
          resolve({
            isLogin: false,
            errMsg: err.errMsg
          })
        }
      })
    })
  },
  
  // 检查session（Promise封装）
  handleCheckSession() {
    return new Promise((resolve, reject) => {
      tt.checkSession({
        success: (res) => {
          console.log('checkSession success', res)
          resolve(res)
        },
        fail: (err) => {
          console.log('checkSession fail', err)
          reject(err)
        }
      })
    })
  },
  
  // 获取用户openid
  getUserOpenId() {
    this.globalData.cloud.callContainer({
      path: '/getOpenid',
      init: {
        method: 'GET',
        timeout: 60000
      },
      success: ({ statusCode, data }) => {
        console.log('云函数响应:', statusCode, data)
        if (statusCode === 200) {
          const result = typeof data === 'string' ? JSON.parse(data) : data
          if (result && result.code === 0) {
            // 保存到全局变量
            this.globalData.openId = result.data.openId || ''
            this.globalData.unionId = result.data.unionId || ''
            console.log('获取openid成功:', this.globalData.openId)
          } else {
            console.error('获取openid失败:', result?.message || '未知错误')
          }
        } else {
          console.error('云函数调用失败，状态码:', statusCode)
        }
      },
      fail: (err) => {
        console.error('云函数调用失败:', err)
      }
    })
  }
})
