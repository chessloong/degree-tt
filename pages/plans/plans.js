const app = getApp()
import uCharts from '../../common/u-charts.min.js'

Page({
  data: {
    title: '招生计划',
    currentClassName: '',
    loading: true,
    loadingText: '加载中...',
    rawPlansData: [],
    rawScoreSegmentsData: [],
    schools: [],

    admissionChart: {
      data: null,
      visible: false,
      width: 0,
      height: 0
    },

    tableData: [],
    majorPieChart: {
      data: [],
      visible: false,
      width: 0,
      height: 0
    },
    majorPieTableData: [],
    schoolBarChart: {
      data: [],
      visible: false,
      width: 0,
      height: 0
    },
    schoolBarTableData: [],
    yearLabels: [],
    filterValues: {
      yearIndex: 0,
      selectedYear: ''
    }
  },

  onLoad: function(options) {
    console.log('[计划] 页面加载')
  },

  onReady: function() {},

  onShow: function() {
    this.loadData()
  },

  onHide: function() {},

  onUnload: function() {},

  async loadData() {
    this.setData({
      loading: true,
      loadingText: '加载中...'
    })

    try {
      const className = app.getUserClassName() || '管理类'
      console.log(`[计划] 当前用户大类: ${className}`)

      const data = await app.loadPageDataBatch([
        {
          cacheKey: 'plans',
          collection: 'degree_plans',
          filter: { class_name: className },
          type: 'array',
          itemKey: 'class_name',
          itemValue: className,
          defaultValue: []
        },
        {
          cacheKey: 'score_segments',
          collection: 'degree_score_segments',
          filter: { class_name: className },
          type: 'array',
          itemKey: 'class_name',
          itemValue: className,
          defaultValue: []
        },
        {
          cacheKey: 'schools',
          collection: 'degree_schools',
          type: 'object',
          defaultValue: []
        }
      ])

      const years = [...new Set((data.plans || []).map(plan => plan.year).filter(Boolean))].sort((a, b) => b - a)
      const yearLabels = years.map(y => `${y}年`)
      
      this.setData({
        currentClassName: className,
        rawPlansData: data.plans || [],
        rawScoreSegmentsData: data.score_segments || [],
        schools: data.schools || [],
        yearLabels: yearLabels,
        filterValues: {
          yearIndex: 0,
          selectedYear: years[0] || ''
        },
        loading: false,
        loadingText: ''
      })

      console.log(`[计划] 数据加载完成，招生计划 ${data.plans?.length || 0} 条，一分一段 ${data.score_segments?.length || 0} 条，院校 ${data.schools?.length || 0} 条`)

      this.renderAdmissionChart()
      this.renderMajorPieChart()
      this.renderSchoolBarChart()

    } catch (err) {
      console.error('[计划] 加载失败:', err)
      tt.showToast({
        title: '加载失败，请重试',
        icon: 'none'
      })
      this.setData({
        loading: false,
        loadingText: ''
      })
    }
  },

  waitForCanvas(selector, interval = 50, maxRetries = 40) {
    return new Promise((resolve) => {
      let retries = 0
      const check = () => {
        tt.createSelectorQuery()
          .select(selector)
          .boundingClientRect((rect) => {
            if (rect) {
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

  renderAdmissionChart() {
    const plansData = this.data.rawPlansData
    const scoreSegmentsData = this.data.rawScoreSegmentsData
    const schools = this.data.schools

    if ((!plansData || plansData.length === 0) && (!scoreSegmentsData || scoreSegmentsData.length === 0)) {
      console.log('[计划-图表] 数据为空，不渲染')
      return
    }

    const schoolLevelMap = {}
    if (schools && schools.length > 0) {
      schools.forEach(school => {
        schoolLevelMap[school.school_name] = school.level || '其他'
      })
    }

    const eduMaxCumulativeCount = {}
    scoreSegmentsData.forEach(item => {
      if (item.score_type === 'edu') {
        const year = item.year
        const cumulativeCount = item.cumulative_count || 0
        if (!eduMaxCumulativeCount[year] || cumulativeCount > eduMaxCumulativeCount[year]) {
          eduMaxCumulativeCount[year] = cumulativeCount
        }
      }
    })

    const plan2BSum = {}
    const plan2CSum = {}
    plansData.forEach(item => {
      const year = item.year
      const schoolName = item.school_name || ''
      const total = parseFloat(item.total) || 0
      let level = item.level

      if (!level && schoolName) {
        level = schoolLevelMap[schoolName] || '其他'
      }

      if (level === '2B') {
        plan2BSum[year] = (plan2BSum[year] || 0) + total
      } else if (level === '2C') {
        plan2CSum[year] = (plan2CSum[year] || 0) + total
      }
    })

    const allYears = [...new Set([
      ...Object.keys(eduMaxCumulativeCount),
      ...Object.keys(plan2BSum),
      ...Object.keys(plan2CSum)
    ])].sort((a, b) => a - b)

    const allYearsDesc = [...allYears].reverse()

    if (allYears.length === 0) {
      console.log('[计划-图表] 无有效年份数据')
      return
    }

    const categories = allYears

    const eduData = allYears.map(year => eduMaxCumulativeCount[year] || null)
    const data2B = allYears.map(year => plan2BSum[year] || null)
    const data2C = allYears.map(year => plan2CSum[year] || null)
    const dataTotal = allYears.map(year => (plan2BSum[year] || 0) + (plan2CSum[year] || 0))

    const series = [
      {
        name: '报考人数',
        data: eduData,
        color: '#FF8C00'
      },
      {
        name: '2B招生',
        data: data2B,
        color: '#0081ff'
      },
      {
        name: '2C招生',
        data: data2C,
        color: '#39b54a'
      },
      {
        name: '总招生',
        data: dataTotal,
        color: '#8B4513'
      }
    ]

    const tableData = allYearsDesc.map(year => {
      const edu = eduMaxCumulativeCount[year] || 0
      const plan2b = plan2BSum[year] || 0
      const plan2c = plan2CSum[year] || 0
      const total = plan2b + plan2c
      const ratio2b = edu > 0 ? Math.round((plan2b / edu) * 100) : 0
      const ratio2c = edu > 0 ? Math.round((plan2c / edu) * 100) : 0
      const ratioTotal = edu > 0 ? Math.round((total / edu) * 100) : 0

      return {
        year,
        edu,
        plan2b,
        plan2c,
        total,
        ratio2b,
        ratio2c,
        ratioTotal,
        ratioText2b: `${ratio2b}%`,
        ratioText2c: `${ratio2c}%`,
        ratioTextTotal: `${ratioTotal}%`
      }
    })

    console.log('[计划-图表] 图表数据:', { categories, series })

    this.setData({
      'admissionChart.data': series,
      'admissionChart.visible': true,
      tableData: tableData
    })

    setTimeout(() => {
      this.drawAdmissionChart(categories)
    }, 200)
  },

  async drawAdmissionChart(categories) {
    const chart = this.data.admissionChart
    if (!chart.visible || !chart.data) {
      return
    }

    const rect = await this.waitForCanvas('#admissionChart', 50, 40)
    if (!rect) {
      console.error('[计划-图表] 获取 canvas 失败')
      return
    }

    const canvasWidth = rect.width
    const canvasHeight = Math.round(rect.width * 46 / 75)

    this.setData({
      'admissionChart.width': canvasWidth,
      'admissionChart.height': canvasHeight
    })

    await new Promise(resolve => setTimeout(resolve, 100))

    const ctx = tt.createCanvasContext('admissionChart', this)

    try {
      new uCharts({
        $this: this,
        canvasId: 'admissionChart',
        context: ctx,
        type: 'line',
        pixelRatio: 1,
        width: canvasWidth,
        height: canvasHeight,
        animation: true,
        timing: 'easeInOut',
        duration: 1000,
        categories: categories,
        series: chart.data,
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
          axisLabel: { show: false }
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
      console.log('[计划-图表] 绘制完成')
    } catch (err) {
      console.error('[计划-图表] 绘制失败:', err)
    }
  },

  renderMajorPieChart() {
    const { rawPlansData, filterValues, currentClassName } = this.data
    const { selectedYear } = filterValues
    const majorTotalMap = {}

    console.log(`[计划-饼图] 当前专业大类: ${currentClassName}, 选中年份: ${selectedYear}, 原始数据条数: ${rawPlansData.length}`)

    rawPlansData.forEach(plan => {
      if (selectedYear && plan.year !== selectedYear) {
        return
      }
      const majorName = plan.major_name || '未知专业'
      const total = parseInt(plan.total) || 0
      if (!majorTotalMap[majorName]) {
        majorTotalMap[majorName] = 0
      }
      majorTotalMap[majorName] += total
    })

    console.log(`[计划-饼图] 统计结果:`, majorTotalMap)

    let pieData = Object.keys(majorTotalMap).map(major => ({
      name: major,
      data: majorTotalMap[major]
    }))

    if (pieData.length === 0) {
      pieData = [
        { name: '暂无数据', data: 1 }
      ]
    }

    pieData.sort((a, b) => b.data - a.data)

    console.log('[计划-饼图] 专业招生比例数据:', pieData)

    // 生成表格数据
    const total = pieData.reduce((sum, item) => sum + item.data, 0)
    const tableData = pieData.map(item => ({
      name: item.name,
      count: item.data,
      ratio: total > 0 ? Math.round((item.data / total) * 100) : 0
    }))

    this.setData({
      'majorPieChart.data': pieData,
      'majorPieChart.visible': pieData.length > 0,
      'majorPieTableData': tableData
    })

    setTimeout(() => {
      this.drawMajorPieChart()
    }, 200)
  },

  async drawMajorPieChart() {
    const chart = this.data.majorPieChart
    if (!chart.visible || !chart.data || chart.data.length === 0) {
      return
    }

    const rect = await this.waitForCanvas('#majorPieChart', 50, 40)
    if (!rect) {
      console.error('[计划-饼图] 获取 canvas 失败')
      return
    }

    const canvasWidth = rect.width
    const canvasHeight = Math.round(rect.width * 0.8)

    this.setData({
      'majorPieChart.width': canvasWidth,
      'majorPieChart.height': canvasHeight
    })

    await new Promise(resolve => setTimeout(resolve, 100))

    const ctx = tt.createCanvasContext('majorPieChart', this)

    try {
      new uCharts({
        $this: this,
        canvasId: 'majorPieChart',
        context: ctx,
        type: 'pie',
        pixelRatio: 1,
        width: canvasWidth,
        height: canvasHeight,
        animation: true,
        series: chart.data,
        padding: [10, 10, 10, 10],
        legend: {
          show: true,
          position: 'bottom'
        },
        extra: {
          pie: {
            labelWidth: 15
          }
        }
      })
      console.log('[计划-饼图] 绘制完成')
    } catch (err) {
      console.error('[计划-饼图] 绘制失败:', err)
    }
  },

  renderSchoolBarChart() {
    const { rawPlansData, filterValues, schools } = this.data
    const { selectedYear } = filterValues
    const schoolTotalMap = {}
    const schoolLevelMap = {}

    if (schools && schools.length > 0) {
      schools.forEach(school => {
        schoolLevelMap[school.school_name] = school.level || '其他'
      })
    }

    console.log(`[计划-院校柱状图] 选中年份: ${selectedYear}, 原始数据条数: ${rawPlansData.length}`)

    rawPlansData.forEach(plan => {
      if (selectedYear && plan.year !== selectedYear) {
        return
      }
      const schoolName = plan.school_name || '未知院校'
      const total = parseInt(plan.total) || 0
      if (!schoolTotalMap[schoolName]) {
        schoolTotalMap[schoolName] = 0
      }
      schoolTotalMap[schoolName] += total
    })

    console.log(`[计划-院校柱状图] 统计结果:`, schoolTotalMap)

    let barData = Object.keys(schoolTotalMap).map(school => ({
      name: school,
      data: schoolTotalMap[school],
      level: schoolLevelMap[school] || '其他'
    }))

    if (barData.length === 0) {
      barData = [
        { name: '暂无数据', data: 1, level: '其他' }
      ]
    }

    barData.sort((a, b) => b.data - a.data)

    console.log('[计划-院校柱状图] 院校招生人数数据:', barData)

    const total = barData.reduce((sum, item) => sum + item.data, 0)
    const tableData = barData.map(item => ({
      name: item.name,
      level: item.level,
      count: item.data,
      ratio: total > 0 ? Math.round((item.data / total) * 100) : 0
    }))

    this.setData({
      'schoolBarChart.data': barData,
      'schoolBarChart.visible': barData.length > 0,
      'schoolBarTableData': tableData
    })

    setTimeout(() => {
      this.drawSchoolBarChart()
    }, 200)
  },

  async drawSchoolBarChart() {
    const chart = this.data.schoolBarChart
    if (!chart.visible || !chart.data || chart.data.length === 0) {
      return
    }

    const rect = await this.waitForCanvas('#schoolBarChart', 50, 40)
    if (!rect) {
      console.error('[计划-院校饼图] 获取 canvas 失败')
      return
    }

    const canvasWidth = rect.width
    const canvasHeight = Math.round(rect.width * 0.8)

    this.setData({
      'schoolBarChart.width': canvasWidth,
      'schoolBarChart.height': canvasHeight
    })

    await new Promise(resolve => setTimeout(resolve, 100))

    const ctx = tt.createCanvasContext('schoolBarChart', this)

    const series = chart.data.map(item => ({
      name: item.name,
      data: item.data
    }))

    try {
      new uCharts({
        $this: this,
        canvasId: 'schoolBarChart',
        context: ctx,
        type: 'pie',
        pixelRatio: 1,
        width: canvasWidth,
        height: canvasHeight,
        animation: true,
        series: series,
        padding: [10, 10, 10, 10],
        legend: {
          show: true,
          position: 'bottom'
        },
        extra: {
          pie: {
            labelWidth: 15
          }
        }
      })
      console.log('[计划-院校饼图] 绘制完成')
    } catch (err) {
      console.error('[计划-院校饼图] 绘制失败:', err)
    }
  },

  onYearChange(e) {
    const yearIndex = parseInt(e.detail.value)
    const years = this.data.yearLabels.map(label => parseInt(label.replace('年', '')))
    const selectedYear = years[yearIndex] || ''
    
    this.setData({
      filterValues: {
        yearIndex: yearIndex,
        selectedYear: selectedYear
      }
    })

    this.renderMajorPieChart()
    this.renderSchoolBarChart()
  },

  /**
   * 跳转到设置页面并打开专业大类选择器
   */
  goToSettings() {
    tt.setStorageSync('openPicker', 'true')
    tt.switchTab({
      url: '/pages/settings/settings'
    })
  }
})