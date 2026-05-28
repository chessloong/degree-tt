const config = require('../config.js')

class CloudService {
  constructor() {
    this.cloud = null
    this.isInitialized = false
  }

  init() {
    return new Promise((resolve, reject) => {
      if (this.isInitialized && this.cloud) {
        resolve(this.cloud)
        return
      }

      try {
        this.cloud = tt.createCloud({
          envID: config.env,
          serviceID: config.serviceId
        })
        this.isInitialized = true
        console.log('[云服务] 初始化成功')
        resolve(this.cloud)
      } catch (err) {
        console.error('[云服务] 初始化失败:', err)
        reject(err)
      }
    })
  }

  async callContainer(options) {
    const {
      path,
      method = 'GET',
      data = null,
      timeout = 60000,
      headers = {}
    } = options

    await this.init()

    return new Promise((resolve, reject) => {
      const init = {
        method: method.toUpperCase(),
        timeout,
        headers: {
          'Content-Type': 'application/json',
          ...headers
        }
      }

      if (data && (method.toUpperCase() === 'POST' || method.toUpperCase() === 'PUT')) {
        init.body = typeof data === 'string' ? data : JSON.stringify(data)
      }

      this.cloud.callContainer({
        path,
        init,
        success: ({ statusCode, data: responseData }) => {
          try {
            const result = typeof responseData === 'string' ? JSON.parse(responseData) : responseData
            if (statusCode === 200) {
              if (result && result.code === 0) {
                resolve(result)
              } else {
                reject(new Error(result?.message || '请求失败'))
              }
            } else {
              reject(new Error(`请求失败，状态码: ${statusCode}`))
            }
          } catch (parseErr) {
            console.error('[云服务] 数据解析失败:', parseErr)
            reject(new Error('数据解析失败'))
          }
        },
        fail: (err) => {
          console.error('[云服务] 请求异常:', err)
          reject(err)
        }
      })
    })
  }

  async get(path, params = {}, options = {}) {
    const queryString = new URLSearchParams(params).toString()
    const fullPath = queryString ? `${path}?${queryString}` : path
    return this.callContainer({
      path: fullPath,
      method: 'GET',
      ...options
    })
  }

  async post(path, data = {}, options = {}) {
    return this.callContainer({
      path,
      method: 'POST',
      data,
      ...options
    })
  }

  async put(path, data = {}, options = {}) {
    return this.callContainer({
      path,
      method: 'PUT',
      data,
      ...options
    })
  }

  async delete(path, options = {}) {
    return this.callContainer({
      path,
      method: 'DELETE',
      ...options
    })
  }

  getCloudInstance() {
    return this.cloud
  }
}

const cloudService = new CloudService()

module.exports = {
  CloudService,
  cloudService,
  getCloudInstance: () => cloudService.getCloudInstance(),
  initCloud: () => cloudService.init(),
  callCloud: (options) => cloudService.callContainer(options),
  getCloud: (path, params, options) => cloudService.get(path, params, options),
  postCloud: (path, data, options) => cloudService.post(path, data, options)
}
