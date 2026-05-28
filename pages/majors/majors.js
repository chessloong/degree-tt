import uCharts from '../../common/u-charts.min.js'
const app = getApp()

Page({
  data: {
    title: '招生专业',
    currentClassName: '',
    loading: true,
    loadingText: '加载中...',
    previewPlans: [],
    years: [],
    year1: null,
    year2: null,
    year1Options: [],
    year2Options: [],
    compareTable: [],
    showChangedOnly: false,
    filteredTable: [],
    yearStats: [],
    trendChart: {
      width: 0,
      height: 0,
      visible: false,
      data: null
    }
  },

  onLoad: function (_options) {
    console.log('[招生专业] 页面加载')
  },

  onReady: function () {},

  onShow: function () {
    this.loadData()
  },

  onHide: function () {},

  onUnload: function () {},

  async loadData() {
    this.setData({
      loading: true,
      loadingText: '加载中...'
    })

    try {
      const className = app.getUserClassName() || '管理类'
      console.log(`[招生专业] 当前用户大类: ${className}`)

      const data = await app.loadPageDataBatch([
        {
          cacheKey: 'preview_plans',
          collection: 'degree_preview_plans',
          filter: { class_name: className },
          type: 'array',
          itemKey: 'class_name',
          itemValue: className,
          defaultValue: []
        }
      ])

      const previewPlans = data.preview_plans || []
      const years = this.extractYears(previewPlans)
      const { year1, year2, year1Options, year2Options } = this.initYearSelectors(years)
      const compareTable = this.generateCompareTable(previewPlans, year1, year2)
      const filteredTable = this.filterTable(compareTable, false)
      const yearStats = this.generateYearStats(previewPlans)
      const maxSchoolCount = yearStats.length > 0 ? Math.max(...yearStats.map(s => s.schoolCount)) : 1
      const maxMajorCount = yearStats.length > 0 ? Math.max(...yearStats.map(s => s.majorCount)) : 1
      const maxCount = Math.max(maxSchoolCount, maxMajorCount, 1)

      this.setData({
        previewPlans,
        currentClassName: className,
        years,
        year1,
        year2,
        year1Options,
        year2Options,
        compareTable,
        filteredTable,
        yearStats,
        maxSchoolCount,
        maxMajorCount,
        maxCount,
        loading: false,
        loadingText: ''
      })

      console.log(`[招生专业] 加载完成，预告计划 ${previewPlans.length} 条，年份 ${years.join(', ')}`)

      this.renderTrendChart()
    } catch (err) {
      console.error('[招生专业] 加载失败:', err)
      tt.showToast({
        title: '加载失败，请重试',
        icon: 'none'
      })
      this.setData({
        loading: false,
        loadingText: '',
        previewPlans: [],
        years: [],
        compareTable: [],
        filteredTable: []
      })
    }
  },

  extractYears(plans) {
    const yearSet = new Set()
    plans.forEach(item => {
      if (item.year) {
        yearSet.add(item.year)
      }
    })
    return Array.from(yearSet).sort((a, b) => a - b)
  },

  initYearSelectors(years) {
    if (years.length < 2) {
      return {
        year1: null,
        year2: null,
        year1Options: [],
        year2Options: []
      }
    }

    const minYear = years[0]
    const maxYear = years[years.length - 1]

    const year1Options = years.filter(y => y !== maxYear)
    const year2Options = years.filter(y => y !== minYear)

    const year1 = year1Options[year1Options.length - 1]
    const year2 = year2Options[year2Options.length - 1]

    return { year1, year2, year1Options, year2Options }
  },

  generateCompareTable(plans, year1, year2) {
    if (!year1 || !year2 || !plans || plans.length === 0) {
      return []
    }

    const year1Data = new Map()
    const year2Data = new Map()

    plans.forEach(item => {
      if (item.year === year1 && item.major_name && item.school_name) {
        const key = `${item.school_name}_${item.major_name}`
        year1Data.set(key, {
          schoolName: item.school_name,
          majorName: item.major_name
        })
      }
      if (item.year === year2 && item.major_name && item.school_name) {
        const key = `${item.school_name}_${item.major_name}`
        year2Data.set(key, {
          schoolName: item.school_name,
          majorName: item.major_name
        })
      }
    })

    const allKeys = new Set([...year1Data.keys(), ...year2Data.keys()])
    const table = []

    allKeys.forEach(key => {
      const inYear1 = year1Data.has(key)
      const inYear2 = year2Data.has(key)
      const data = year1Data.get(key) || year2Data.get(key)

      table.push({
        schoolName: data.schoolName,
        majorName: data.majorName,
        inYear1,
        inYear2
      })
    })

    table.sort((a, b) => {
      if (a.schoolName !== b.schoolName) {
        return a.schoolName.localeCompare(b.schoolName, 'zh-CN')
      }
      return a.majorName.localeCompare(b.majorName, 'zh-CN')
    })

    return table
  },

  filterTable(table, showChangedOnly) {
    if (!table || table.length === 0) {
      return []
    }
    if (!showChangedOnly) {
      return table
    }
    return table.filter(item => item.inYear1 !== item.inYear2)
  },

  generateYearStats(previewPlans) {
    if (!previewPlans || previewPlans.length === 0) {
      return []
    }

    const yearMap = {}

    previewPlans.forEach(item => {
      const year = item.year
      if (!yearMap[year]) {
        yearMap[year] = {
          year,
          schools: new Set(),
          majors: new Set()
        }
      }
      if (item.school_name) {
        yearMap[year].schools.add(item.school_name)
      }
      if (item.major_name) {
        yearMap[year].majors.add(item.major_name)
      }
    })

    const stats = Object.values(yearMap).map(item => ({
      year: item.year,
      schoolCount: item.schools.size,
      majorCount: item.majors.size
    }))

    stats.sort((a, b) => b.year - a.year)

    return stats
  },

  waitForCanvas(selector, maxRetries = 50, interval = 40) {
    return new Promise((resolve) => {
      let retries = 0
      const check = () => {
        tt.createSelectorQuery()
          .select(selector)
          .boundingClientRect()
          .exec((res) => {
            if (res && res[0] && res[0].width > 0) {
              resolve(res[0])
            } else if (retries < maxRetries) {
              retries++
              setTimeout(check, interval)
            } else {
              resolve(null)
            }
          })
      }
      check()
    })
  },

  async renderTrendChart() {
    const { yearStats } = this.data
    if (!yearStats || yearStats.length === 0) {
      console.log('[招生专业] 统计数据为空，不渲染图表')
      return
    }

    // 先显示图表容器
    this.setData({
      'trendChart.visible': true
    })

    await new Promise(resolve => setTimeout(resolve, 200))

    const rect = await this.waitForCanvas('#trendChart', 50, 40)
    if (!rect) {
      console.error('[招生专业] 获取 canvas 失败')
      return
    }

    const canvasWidth = rect.width
    const canvasHeight = Math.round(rect.width * 46 / 75)

    this.setData({
      'trendChart.width': canvasWidth,
      'trendChart.height': canvasHeight
    })

    await new Promise(resolve => setTimeout(resolve, 50))

    const ctx = tt.createCanvasContext('trendChart', this)

    const allValues = yearStats.flatMap(s => [s.schoolCount, s.majorCount])
    const minValue = Math.min(...allValues)
    const maxValue = Math.max(...allValues)

    // 最大值+5，最小值-5
    const yAxisMin = Math.max(0, minValue - 5)
    const yAxisMax = maxValue + 5

    // 图表使用升序排列，复制数据并排序
    const chartYearStats = [...yearStats].sort((a, b) => a.year - b.year)

    const categories = chartYearStats.map(s => s.year)

    console.log('[招生专业] categories:', categories)
    console.log('[招生专业] yearStats:', yearStats)

    const schoolData = chartYearStats.map(s => s.schoolCount)
    const majorData = chartYearStats.map(s => s.majorCount)

    console.log('[招生专业] schoolData:', schoolData)
    console.log('[招生专业] majorData:', majorData)

    const series = [
      {
        name: '院校数',
        data: schoolData,
        color: '#0081ff',
        lineType: 'straight',
        width: 3,
        showPoint: true,
        pointShape: 'circle',
        pointSize: 6,
        label: { show: true, fontSize: 10, fontWeight: 'bold', color: '#0081ff' }
      },
      {
        name: '专业数',
        data: majorData,
        color: '#52c41a',
        lineType: 'straight',
        width: 3,
        showPoint: true,
        pointShape: 'circle',
        pointSize: 6,
        label: { show: true, fontSize: 10, fontWeight: 'bold', color: '#52c41a' }
      }
    ]

    console.log('[招生专业] series:', JSON.stringify(series))

    try {
      new uCharts({
        $this: this,
        canvasId: 'trendChart',
        context: ctx,
        type: 'line',
        pixelRatio: 1,
        width: canvasWidth,
        height: canvasHeight,
        animation: true,
        timing: 'easeInOut',
        duration: 1000,
        categories,
        series,
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
            type: 'straight',
            width: 3,
            activeType: 'hilight'
          }
        }
      })
      console.log('[招生专业] 图表绘制完成')
    } catch (err) {
      console.error('[招生专业] 图表绘制失败:', err)
    }
  },

  onYear1Change(e) {
    const index = e.detail.value
    const newYear1 = this.data.year1Options[index]
    let newYear2 = this.data.year2

    if (newYear2 <= newYear1) {
      const year2Options = this.data.year2Options.filter(y => y > newYear1)
      if (year2Options.length > 0) {
        newYear2 = year2Options[0]
      }
    }

    const compareTable = this.generateCompareTable(this.data.previewPlans, newYear1, newYear2)
    const filteredTable = this.filterTable(compareTable, this.data.showChangedOnly)

    this.setData({
      year1: newYear1,
      year2: newYear2,
      compareTable,
      filteredTable
    })

    console.log(`[招生专业] 年份1切换为 ${newYear1}，年份2为 ${newYear2}`)
  },

  onYear2Change(e) {
    const index = e.detail.value
    const newYear2 = this.data.year2Options[index]
    let newYear1 = this.data.year1

    if (newYear1 >= newYear2) {
      const year1Options = this.data.year1Options.filter(y => y < newYear2)
      if (year1Options.length > 0) {
        newYear1 = year1Options[year1Options.length - 1]
      }
    }

    const compareTable = this.generateCompareTable(this.data.previewPlans, newYear1, newYear2)
    const filteredTable = this.filterTable(compareTable, this.data.showChangedOnly)

    this.setData({
      year1: newYear1,
      year2: newYear2,
      compareTable,
      filteredTable
    })

    console.log(`[招生专业] 年份2切换为 ${newYear2}，年份1为 ${newYear1}`)
  },

  onToggleShowMode() {
    const showChangedOnly = !this.data.showChangedOnly
    const filteredTable = this.filterTable(this.data.compareTable, showChangedOnly)

    this.setData({
      showChangedOnly,
      filteredTable
    })
    console.log(`[招生专业] 显示模式切换为: ${showChangedOnly ? '仅变动' : '全部'}`)
  },

  goToSettings() {
    tt.setStorageSync('openPicker', 'true')
    tt.switchTab({
      url: '/pages/settings/settings'
    })
  }
})
