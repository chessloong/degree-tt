const { postCloud, getCloud } = require('./cloud.js')

class AuthService {
  constructor() {
    this.openId = ''
    this.unionId = ''
    this.userInfo = {}
    this.isLogin = false
  }

  handleLogin() {
    return new Promise((resolve) => {
      tt.login({
        success: (res) => {
          resolve({ isLogin: true, ...res })
        },
        fail: (err) => {
          console.error('[认证] 登录失败:', err.errMsg)
          resolve({
            isLogin: false,
            errMsg: err.errMsg
          })
        }
      })
    })
  }

  handleCheckSession() {
    return new Promise((resolve, reject) => {
      tt.checkSession({
        success: (res) => {
          resolve(res)
        },
        fail: (err) => {
          reject(err)
        }
      })
    })
  }

  async getUserOpenId() {
    try {
      const result = await getCloud('/getOpenid')
      if (result && result.data) {
        this.openId = result.data.openId || ''
        this.unionId = result.data.unionId || ''
        console.log('[认证] OpenID 获取成功')

        try {
          const cachedUserInfo = tt.getStorageSync('userInfo')
          if (cachedUserInfo) {
            this.userInfo = JSON.parse(cachedUserInfo)
            console.log('[认证] 从缓存恢复用户信息')
          }
        } catch (err) {
          console.error('[认证] 恢复缓存用户信息失败:', err)
        }

        await this.getUserInfo(this.openId)
      }
      return this.openId
    } catch (err) {
      console.error('[认证] 获取OpenID失败:', err)
      return ''
    }
  }

  async getUserInfo(openid, douyinInfo = {}) {
    if (!openid) {
      console.error('[认证] openid为空，无法获取用户信息')
      return null
    }

    try {
      const requestBody = { openid }

      if (douyinInfo.avatarUrl) {
        requestBody.avatarUrl = douyinInfo.avatarUrl
      }
      if (douyinInfo.nickName) {
        requestBody.nickName = douyinInfo.nickName
      }

      console.log('[认证] 请求用户信息:', requestBody)

      const result = await postCloud('/getUser', requestBody)

      if (result && result.data) {
        const userInfo = result.data

        if (douyinInfo.avatarUrl && !userInfo.avatarUrl) {
          userInfo.avatarUrl = douyinInfo.avatarUrl
        }
        if (douyinInfo.nickName && !userInfo.nickname) {
          userInfo.nickname = douyinInfo.nickName
        }

        this.userInfo = userInfo
        tt.setStorageSync('userInfo', JSON.stringify(userInfo))
        console.log('[认证] 用户信息获取成功')

        return userInfo
      }
      return null
    } catch (err) {
      console.error('[认证] 获取用户信息失败:', err)
      return null
    }
  }

  async doLogin() {
    console.log('[认证] 开始统一登录流程')

    try {
      await this.handleCheckSession()
      console.log('[认证] Session有效')
    } catch {
      console.log('[认证] Session过期，重新登录')
      const loginRes = await this.handleLogin()
      if (loginRes.isLogin === false) {
        console.error('[认证] 登录失败')
        return false
      }
      console.log('[认证] 重新登录成功')
    }

    if (!this.openId) {
      console.log('[认证] OpenId不存在，开始获取')
      await this.getUserOpenId()
    }

    if (this.openId) {
      console.log('[认证] 获取用户信息')
      await this.getUserInfo(this.openId)
    }

    this.isLogin = !!(this.openId && Object.keys(this.userInfo).length > 0)
    console.log(`[认证] 登录完成，状态: ${this.isLogin}`)

    return this.isLogin
  }

  logout() {
    console.log('[认证] 开始退出登录')

    this.isLogin = false
    this.userInfo = {}
    this.openId = ''
    this.unionId = ''

    try {
      tt.removeStorageSync('userInfo')
      tt.removeStorageSync('openId')
      tt.removeStorageSync('unionId')
      console.log('[认证] 用户缓存已清除')
    } catch (err) {
      console.error('[认证] 清除用户缓存失败:', err)
    }

    console.log('[认证] 退出登录完成')
  }

  getDouyinUserProfile() {
    return new Promise((resolve) => {
      tt.getUserProfile({
        desc: '用于完善用户资料',
        success: (res) => {
          console.log('[认证] 获取抖音用户信息成功:', res.userInfo)
          resolve({
            avatarUrl: res.userInfo.avatarUrl || '',
            nickName: res.userInfo.nickName || ''
          })
        },
        fail: (err) => {
          console.error('[认证] 获取抖音用户信息失败:', err)
          resolve({
            avatarUrl: '',
            nickName: ''
          })
        }
      })
    })
  }

  isLoggedIn() {
    return this.isLogin && !!(this.openId && Object.keys(this.userInfo).length > 0)
  }

  getOpenId() {
    return this.openId
  }

  getUnionId() {
    return this.unionId
  }

  getUserInfoData() {
    return this.userInfo
  }

  getUserNickname() {
    if (this.userInfo && this.userInfo.nickname) {
      return this.userInfo.nickname
    }
    try {
      const userInfoStr = tt.getStorageSync('userInfo')
      if (userInfoStr) {
        const userInfo = JSON.parse(userInfoStr)
        return userInfo.nickname || '未登录'
      }
    } catch (err) {
      console.error('[认证] 读取昵称失败:', err)
    }
    return '未登录'
  }

  getUserLevel() {
    if (this.userInfo && this.userInfo.level) {
      return this.userInfo.level
    }
    try {
      const userInfoStr = tt.getStorageSync('userInfo')
      if (userInfoStr) {
        const userInfo = JSON.parse(userInfoStr)
        return userInfo.level || 0
      }
    } catch (err) {
      console.error('[认证] 读取等级失败:', err)
    }
    return 0
  }

  getUserAvatar() {
    if (this.userInfo && this.userInfo.avatarUrl) {
      return this.userInfo.avatarUrl
    }
    try {
      const userInfoStr = tt.getStorageSync('userInfo')
      if (userInfoStr) {
        const userInfo = JSON.parse(userInfoStr)
        return userInfo.avatarUrl || ''
      }
    } catch (err) {
      console.error('[认证] 读取头像失败:', err)
    }
    return ''
  }

  getUserClassName() {
    if (this.userInfo && this.userInfo.userClassName) {
      return this.userInfo.userClassName
    }
    try {
      const userInfoStr = tt.getStorageSync('userInfo')
      if (userInfoStr) {
        const userInfo = JSON.parse(userInfoStr)
        if (userInfo.userClassName) {
          return userInfo.userClassName
        }
      }
    } catch (err) {
      console.error('[认证] 读取用户类别失败:', err)
    }
    return null
  }
}

const authService = new AuthService()

module.exports = {
  AuthService,
  authService,
  login: () => authService.doLogin(),
  logout: () => authService.logout(),
  isLoggedIn: () => authService.isLoggedIn(),
  getOpenId: () => authService.getOpenId(),
  getUserInfo: (openid, douyinInfo) => authService.getUserInfo(openid, douyinInfo),
  getUserNickname: () => authService.getUserNickname(),
  getUserLevel: () => authService.getUserLevel(),
  getUserAvatar: () => authService.getUserAvatar(),
  getUserClassName: () => authService.getUserClassName(),
  getDouyinUserProfile: () => authService.getDouyinUserProfile()
}
