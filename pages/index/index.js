import uCharts from '../../common/u-charts.min.js'
const app = getApp()

Page({
  data: {
    // 历年招生统计图表
    enrollmentStatsChart: {
      width: 0,
      height: 0,
      loading: true, // 加载状态
      data: null
    },
    // 历年报考及录取人数比图表
    examAdmissionChart: {
      width: 0,
      height: 0,
      loading: true, // 加载状态
      data: null
    },
    img_pre: 'https://ttab77ddca3510275d01-env-qmbjip2dbt.tos-cn-beijing.volces.com/backimg/'
  },

  onLoad: function () {},

  onReady() {
    this.initCharts()
  },

  /**
   * 等待云实例初始化完成后再加载图表
   */
  async initCharts() {
    const app = getApp()

    // 等待 cloud 实例初始化完成
    await this.waitForCloudReady(app, 50, 100)

    // 云实例就绪后加载图表
    this.loadEnrollmentStatsChart()
    this.loadExamAdmissionChart()
  },

  /**
   * 等待云实例就绪
   * @param {Object} app - 应用实例
   * @param {number} interval - 检查间隔（毫秒）
   * @param {number} maxRetries - 最大重试次数
   */
  waitForCloudReady(app, interval = 50, maxRetries = 100) {
    return new Promise((resolve) => {
      let retries = 0
      const check = () => {
        if (app.globalData.cloud) {
          console.log('[首页] 云实例就绪')
          resolve()
        } else if (retries < maxRetries) {
          retries++
          setTimeout(check, interval)
        } else {
          console.error('[首页] 云实例初始化超时')
          resolve()
        }
      }
      check()
    })
  },

  /**
   * 加载历年招生统计图表数据
   */
  async loadEnrollmentStatsChart() {
    const CACHE_KEY = 'enrollment_stats_chart'

    // 检查缓存有效性
    console.log('[首页-招生统计] 开始检查缓存')
    const cachedData = app.getObjectCache(CACHE_KEY)

    if (cachedData) {
      // 获取缓存有效期配置
      const expireMinutes = app.getExpireMinutes(CACHE_KEY)
      console.log(`[首页-招生统计] ✅ 缓存有效 - 键名: ${CACHE_KEY}, 有效期: ${expireMinutes}分钟`)

      this.setData({
        'enrollmentStatsChart.data': cachedData,
        'enrollmentStatsChart.loading': false
      })
      // Canvas 已就绪，直接绘制
      this.renderEnrollmentStatsChart()
      return
    }

    console.log(`[首页-招生统计] ❌ 缓存无效或不存在 - 键名: ${CACHE_KEY}, 将从云端拉取`)

    const cloud = app.globalData.cloud
    if (!cloud) {
      console.error('[首页-招生统计] cloud 实例未初始化')
      this.setData({ 'enrollmentStatsChart.loading': false })
      return
    }

    try {
      const response = await new Promise((resolve, reject) => {
        cloud.callContainer({
          path: '/getEnrollmentStats',
          init: {
            method: 'POST',
            timeout: 60000,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({})
          },
          success: resolve,
          fail: reject
        })
      })

      if (response.statusCode !== 200) {
        console.error('[首页-招生统计] 接口失败，状态码:', response.statusCode)
        this.setData({ 'enrollmentStatsChart.loading': false })
        return
      }

      const result = typeof response.data === 'string' ? JSON.parse(response.data) : response.data

      if (result?.code === 0 && result?.data?.length > 0) {
        const validData = result.data.filter(item =>
          typeof item === 'object' &&
          typeof item.year === 'number' &&
          typeof item.schoolCount === 'number' &&
          typeof item.majorCount === 'number'
        )

        if (validData.length > 0) {
          app.setObjectCache(CACHE_KEY, validData)
          console.log(`[首页-招生统计] ✅ 云端数据已缓存 - 键名: ${CACHE_KEY}, 数据量: ${validData.length}条`)
          this.setData({
            'enrollmentStatsChart.data': validData,
            'enrollmentStatsChart.loading': false
          })
          // Canvas 已就绪，直接绘制
          this.renderEnrollmentStatsChart()
        } else {
          console.error('[首页-招生统计] 数据格式不正确')
        }
      } else {
        console.error('[首页-招生统计] 无有效数据')
        this.setData({ 'enrollmentStatsChart.loading': false })
      }
    } catch (err) {
      console.error('[首页-招生统计] 调用云函数失败:', err)
      this.setData({ 'enrollmentStatsChart.loading': false })
    }
  },

  /**
   * 加载历年报考及录取人数比图表数据
   */
  async loadExamAdmissionChart() {
    const CACHE_KEY = 'exam_admission_chart'

    // 检查缓存有效性
    console.log('[首页-报考录取] 开始检查缓存')
    const cachedData = app.getObjectCache(CACHE_KEY)

    if (cachedData) {
      // 获取缓存有效期配置
      const expireMinutes = app.getExpireMinutes(CACHE_KEY)
      console.log(`[首页-报考录取] ✅ 缓存有效 - 键名: ${CACHE_KEY}, 有效期: ${expireMinutes}分钟`)

      this.setData({
        'examAdmissionChart.data': cachedData,
        'examAdmissionChart.loading': false
      })
      // Canvas 已就绪，直接绘制
      this.renderExamAdmissionChart()
      return
    }

    console.log(`[首页-报考录取] ❌ 缓存无效或不存在 - 键名: ${CACHE_KEY}, 将从云端拉取`)

    const cloud = app.globalData.cloud
    if (!cloud) {
      console.error('[首页-报考录取] cloud 实例未初始化')
      this.setData({ 'examAdmissionChart.loading': false })
      return
    }

    try {
      const response = await new Promise((resolve, reject) => {
        cloud.callContainer({
          path: '/getExamAdmissionStats',
          init: {
            method: 'POST',
            timeout: 60000,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({})
          },
          success: resolve,
          fail: reject
        })
      })

      if (response.statusCode !== 200) {
        console.error('[首页-报考录取] 接口失败，状态码:', response.statusCode)
        this.setData({ 'examAdmissionChart.loading': false })
        return
      }

      const result = typeof response.data === 'string' ? JSON.parse(response.data) : response.data

      if (result?.code === 0 && result?.data?.length > 0) {
        const validData = result.data.filter(item =>
          typeof item === 'object' &&
          typeof item.year === 'number' &&
          typeof item.examTotal === 'number' &&
          typeof item.admissionTotal === 'number'
        )

        if (validData.length > 0) {
          app.setObjectCache(CACHE_KEY, validData)
          console.log(`[首页-报考录取] ✅ 云端数据已缓存 - 键名: ${CACHE_KEY}, 数据量: ${validData.length}条`)
          this.setData({
            'examAdmissionChart.data': validData,
            'examAdmissionChart.loading': false
          })
          // Canvas 已就绪，直接绘制
          this.renderExamAdmissionChart()
        } else {
          console.error('[首页-报考录取] 数据格式不正确')
          this.setData({ 'examAdmissionChart.loading': false })
        }
      } else {
        console.error('[首页-报考录取] 无有效数据')
        this.setData({ 'examAdmissionChart.loading': false })
      }
    } catch (err) {
      console.error('[首页-报考录取] 调用云函数失败:', err)
      this.setData({ 'examAdmissionChart.loading': false })
    }
  },

  /**
   * 渲染历年招生统计图表
   */
  async renderEnrollmentStatsChart() {
    const chart = this.data.enrollmentStatsChart
    if (!chart.data || chart.data.length === 0) {
      console.error('[首页-招生统计] 数据为空')
      return
    }

    // Canvas 已就绪，直接获取尺寸
    const rect = await this.waitForCanvas('#enrollmentStatsChart', 50, 40)
    if (!rect) {
      console.error('[首页-招生统计] 获取 canvas 失败')
      return
    }

    const canvasWidth = rect.width
    const canvasHeight = Math.round(rect.width * 46 / 75)

    this.setData({
      'enrollmentStatsChart.width': canvasWidth,
      'enrollmentStatsChart.height': canvasHeight
    })

    const ctx = tt.createCanvasContext('enrollmentStatsChart', this)
    const data = chart.data

    const categories = data.map(item => item.year)
    const schoolData = data.map(item => item.schoolCount)
    const majorData = data.map(item => item.majorCount)

    // 动态计算 Y 轴范围
    const maxMajor = Math.max(...majorData) // 最大专业数

    // 最小值：固定为 0
    const yAxisMin = 0
    // 最大值：比最大专业数大的 50 整倍数
    const yAxisMax = Math.ceil(maxMajor / 50) * 50

    try {
      new uCharts({
        $this: this,
        canvasId: 'enrollmentStatsChart',
        context: ctx,
        type: 'line',
        pixelRatio: 1,
        width: canvasWidth,
        height: canvasHeight,
        animation: true,
        timing: 'easeInOut',
        duration: 1000,
        categories,
        series: [
          {
            name: '院校数量',
            data: schoolData,
            color: '#0081ff',
            lineType: 'curve',
            width: 3,
            showPoint: true,
            pointShape: 'circle',
            pointSize: 6,
            label: { show: true, fontSize: 10, fontWeight: 'bold' }
          },
          {
            name: '专业数量',
            data: majorData,
            color: '#39b54a',
            lineType: 'curve',
            width: 3,
            showPoint: true,
            pointShape: 'circle',
            pointSize: 6,
            label: { show: true, fontSize: 10, fontWeight: 'bold' }
          }
        ],
        padding: [15, 20, 10, 15],
        xAxis: {
          disableGrid: true,
          axisLine: true,
          axisLabel: { fontSize: 10 }
        },
        yAxis: {
          disableGrid: true,
          disabled: true,
          gridType: 'dash',
          dashLength: 2,
          axisLabel: { show: false },
          data: [{
            min: yAxisMin,
            max: yAxisMax
          }]
        },
        legend: {
          show: true,
          position: 'bottom',
          lineHeight: 20,
          fontSize: 10
        },
        extra: {
          line: {
            type: 'curve',
            width: 3,
            activeType: 'hilight'
          }
        }
      })
      console.log('[首页-招生统计] 绘制完成')
    } catch (err) {
      console.error('[首页-招生统计] 绘制失败:', err)
    }
  },

  /**
   * 渲染历年报考及录取人数比图表
   */
  async renderExamAdmissionChart() {
    const chart = this.data.examAdmissionChart
    if (!chart.data || chart.data.length === 0) {
      console.error('[首页-报考录取] 数据为空')
      return
    }

    // Canvas 已就绪，直接获取尺寸
    const rect = await this.waitForCanvas('#examAdmissionChart', 50, 40)
    if (!rect) {
      console.error('[首页-报考录取] 获取 canvas 失败')
      return
    }

    const canvasWidth = rect.width
    const canvasHeight = Math.round(rect.width * 46 / 75)

    this.setData({
      'examAdmissionChart.width': canvasWidth,
      'examAdmissionChart.height': canvasHeight
    })

    const ctx = tt.createCanvasContext('examAdmissionChart', this)
    const data = chart.data

    const categories = data.map(item => item.year)
    const examData = data.map(item => item.examTotal)
    const admissionData = data.map(item => item.admissionTotal)

    // 动态计算 Y 轴范围（整万数）
    const minAdmission = Math.min(...admissionData) // 最小录取人数
    const maxExam = Math.max(...examData) // 最大报考人数

    // 最小值：比最小录取人数小的整万数
    const yAxisMin = Math.floor(minAdmission / 10000) * 10000
    // 最大值：比最大报考人数大的整万数
    const yAxisMax = Math.ceil(maxExam / 10000) * 10000

    try {
      new uCharts({
        $this: this,
        canvasId: 'examAdmissionChart',
        context: ctx,
        type: 'line',
        pixelRatio: 1,
        width: canvasWidth,
        height: canvasHeight,
        animation: true,
        timing: 'easeInOut',
        duration: 1000,
        categories,
        series: [
          {
            name: '报考人数',
            data: examData,
            color: '#ff6b6b',
            lineType: 'curve',
            width: 3,
            showPoint: true,
            pointShape: 'circle',
            pointSize: 6,
            label: { show: true, fontSize: 10, fontWeight: 'bold' }
          },
          {
            name: '录取人数',
            data: admissionData,
            color: '#4ecdc4',
            lineType: 'curve',
            width: 3,
            showPoint: true,
            pointShape: 'circle',
            pointSize: 6,
            label: { show: true, fontSize: 10, fontWeight: 'bold' }
          }
        ],
        padding: [15, 20, 10, 15],
        xAxis: {
          disableGrid: true,
          axisLine: true,
          axisLabel: { fontSize: 10 }
        },
        yAxis: {
          disableGrid: true,
          disabled: true,
          gridType: 'dash',
          dashLength: 2,
          axisLabel: { show: false },
          data: [{
            min: yAxisMin,
            max: yAxisMax
          }]
        },
        legend: {
          show: true,
          position: 'bottom',
          lineHeight: 20,
          fontSize: 10
        },
        extra: {
          line: {
            type: 'curve',
            width: 3,
            activeType: 'hilight'
          }
        }
      })
      console.log('[首页-报考录取] 绘制完成')
    } catch (err) {
      console.error('[首页-报考录取] 绘制失败:', err)
    }
  },

  waitForCanvas(selector, interval = 50, maxRetries = 40) {
    return new Promise((resolve) => {
      let retries = 0
      const check = () => {
        tt.createSelectorQuery()
          .select(selector)
          .boundingClientRect(rect => {
            if (rect && rect.width > 0) {
              resolve(rect)
            } else if (retries < maxRetries) {
              retries++
              setTimeout(check, interval)
            } else {
              resolve(null)
            }
          })
          .exec()
      }
      check()
    })
  },

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
  },

  /**
   * 刷新历年招生统计图表
   */
  refreshEnrollmentStatsChart() {
    console.log('[首页-招生统计] 刷新')

    const chart = this.data.enrollmentStatsChart
    if (!chart.data || chart.data.length === 0) {
      // 无数据，先加载
      this.setData({ 'enrollmentStatsChart.loading': true })
      tt.showLoading({ title: '加载中...' })
      this.loadEnrollmentStatsChart()
      setTimeout(() => tt.hideLoading(), 500)
      return
    }

    // 有数据，重新绘制（带动画）
    tt.showLoading({ title: '刷新中...' })
    this.renderEnrollmentStatsChart()
    setTimeout(() => {
      tt.hideLoading()
      tt.showToast({ title: '刷新成功', icon: 'success' })
    }, 200)
  },

  /**
   * 刷新历年报考及录取人数比图表
   */
  refreshExamAdmissionChart() {
    console.log('[首页-报考录取] 刷新')

    const chart = this.data.examAdmissionChart
    if (!chart.data || chart.data.length === 0) {
      // 无数据，先加载
      this.setData({ 'examAdmissionChart.loading': true })
      tt.showLoading({ title: '加载中...' })
      this.loadExamAdmissionChart()
      setTimeout(() => tt.hideLoading(), 500)
      return
    }

    // 有数据，重新绘制（带动画）
    tt.showLoading({ title: '刷新中...' })
    this.renderExamAdmissionChart()
    setTimeout(() => {
      tt.hideLoading()
      tt.showToast({ title: '刷新成功', icon: 'success' })
    }, 200)
  },

  goToTest: function () {
    tt.navigateTo({
      url: '/pages/test/test'
    })
  },

  goToPlans: function () {
    tt.navigateTo({
      url: '/pages/plans/plans'
    })
  },

  goToSchools: function () {
    tt.navigateTo({
      url: '/pages/schools/schools'
    })
  },

  goToMajors: function () {
    tt.navigateTo({
      url: '/pages/majors/majors'
    })
  },

  goToScoreSegments: function () {
    tt.navigateTo({
      url: '/pages/score_segments/score_segments'
    })
  },

  goToControlLines: function () {
    tt.navigateTo({
      url: '/pages/control_lines/control_lines'
    })
  },

  goToAdmissionLines: function () {
    tt.navigateTo({
      url: '/pages/admission_lines/admission_lines'
    })
  },

  goToVolunteer: function () {
    tt.navigateTo({
      url: '/pages/volunteer_planning/volunteer_planning'
    })
  }
})
