import uCharts from '../../common/u-charts.min.js'
const app = getApp()
const { pinyinSort } = require('../../utils/pinyinSort.js')

Page({
  data: {
    title: '投档线',
    admissionLines: [],
    collectVolunteers: [],
    currentClassName: '',
    loading: true,
    loadingText: '加载中...',

    admissionChart: {
      data: [],
      visible: false,
      width: 0,
      height: 0
    },

    admissionTableData: {
      visible: false,
      types: [],
      data: []
    },

    filterOptions: {
      years: [],
      batches: []
    },

    yearLabels: [],
    batchLabels: [],

    filterValues: {
      yearIndex: 0,
      batchIndex: 0
    },

    detailTableData: [],

    sortConfig: {
      field: 'min_score',
      order: 'desc'
    }
  },

  onLoad: function (_options) {
    console.log('[投档线] 页面加载')
  },

  onReady: function () {},

  onShow: function () {
    this.loadAdmissionLinesData()
  },

  onHide: function () {},

  onUnload: function () {},

  waitForCanvas(selector, interval = 50, maxTimes = 40) {
    return new Promise((resolve) => {
      let times = 0
      const check = () => {
        tt.createSelectorQuery()
          .select(selector)
          .boundingClientRect((rect) => {
            if (rect) {
              resolve(rect)
            } else if (times < maxTimes) {
              times++
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

  async loadAdmissionLinesData() {
    this.setData({
      loading: true,
      loadingText: '加载中...'
    })

    try {
      const className = app.getUserClassName() || '管理类'
      console.log(`[投档线] 当前用户大类: ${className}`)

      const [batchData, schools] = await Promise.all([
        app.loadPageDataBatch([
          {
            cacheKey: 'admission_lines',
            collection: 'degree_admission_lines',
            filter: { class_name: className },
            type: 'array',
            itemKey: 'class_name',
            itemValue: className,
            defaultValue: []
          },
          {
            cacheKey: 'collect_volunteer',
            collection: 'degree_collect_volunteer',
            filter: { class_name: className },
            type: 'array',
            itemKey: 'class_name',
            itemValue: className,
            defaultValue: []
          }
        ]),
        app.loadSchoolsData()
      ])

      this.setData({
        admissionLines: batchData.admission_lines,
        collectVolunteers: batchData.collect_volunteer,
        currentClassName: className,
        loading: false,
        loadingText: ''
      })

      console.log(`[投档线] 加载完成，投档线 ${batchData.admission_lines.length} 条，征集志愿 ${batchData.collect_volunteer.length} 条，院校 ${schools.length} 所`)

      this.generateFilterOptions(batchData.admission_lines, schools)
      this.renderAdmissionChart(batchData.admission_lines, schools)
    } catch (err) {
      console.error('[投档线] 加载失败:', err)
      tt.showToast({
        title: '加载失败，请重试',
        icon: 'none'
      })
      this.setData({
        loading: false,
        loadingText: '',
        admissionLines: [],
        collectVolunteers: []
      })
    }
  },

  async renderAdmissionChart(admissionData, schools) {
    if (!admissionData || admissionData.length === 0) {
      console.log('[投档线] 数据为空，不渲染图表')
      return
    }

    const schoolTypeMap = {}
    if (schools && schools.length > 0) {
      schools.forEach(school => {
        schoolTypeMap[school.school_name] = school.level || '其他'
      })
    }

    const typeMap = {}
    admissionData.forEach(item => {
      let schoolType = item.school_type
      if (!schoolType && item.school_name) {
        schoolType = schoolTypeMap[item.school_name] || '其他'
      }
      schoolType = schoolType || '其他'

      if (!typeMap[schoolType]) {
        typeMap[schoolType] = {}
      }

      const year = item.year
      const score = Math.round(item.min_score)
      if (!typeMap[schoolType][year] || score < typeMap[schoolType][year]) {
        typeMap[schoolType][year] = score
      }
    })

    console.log('[投档线] 院校类型分布:', Object.keys(typeMap))

    const allYears = [...new Set(admissionData.map(item => item.year))].sort((a, b) => a - b)
    const categories = allYears.map(year => year)

    const series = []
    const typeColors = {
      '2B': '#FF8C00',
      '2C': '#9370DB'
    }

    Object.keys(typeMap).forEach(type => {
      const yearData = typeMap[type]
      const data = allYears.map(year => yearData[year] || null)

      if (data.every(v => v === null)) return

      const color = typeColors[type] || '#0081ff'

      series.push({
        name: type + '院校',
        data,
        color,
        lineType: 'straight',
        width: 3,
        showPoint: true,
        pointShape: 'circle',
        pointSize: 6,
        label: { show: true, fontSize: 10, fontWeight: 'bold', color }
      })
    })

    if (series.length === 0) {
      console.log('[投档线] 处理后数据为空')
      return
    }

    const tableTypes = Object.keys(typeMap).filter(type => {
      const yearData = typeMap[type]
      return !allYears.every(year => !yearData[year])
    })

    const tableData = allYears.sort((a, b) => b - a).map(year => {
      const row = { year }
      tableTypes.forEach(type => {
        row[type] = typeMap[type][year] || '-'
      })
      return row
    })

    this.setData({
      'admissionChart.data': series,
      'admissionChart.visible': true,
      'admissionTableData.visible': true,
      'admissionTableData.types': tableTypes,
      'admissionTableData.data': tableData
    })

    await new Promise(resolve => setTimeout(resolve, 200))

    const rect = await this.waitForCanvas('#admissionChart', 50, 40)
    if (!rect) {
      console.error('[投档线] 获取 canvas 失败')
      return
    }

    const canvasWidth = rect.width
    const canvasHeight = Math.round(rect.width * 46 / 75)

    this.setData({
      'admissionChart.width': canvasWidth,
      'admissionChart.height': canvasHeight
    })

    await new Promise(resolve => setTimeout(resolve, 50))

    const ctx = tt.createCanvasContext('admissionChart', this)

    const allScores = series.flatMap(s => s.data.filter(v => v !== null))
    const maxScore = Math.max(...allScores)

    const yAxisMin = 0
    const yAxisMax = Math.ceil((maxScore + 20) / 10) * 10

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
        categories,
        series,
        xAxis: {
          disableGrid: true,
          axisLine: true,
          axisLabel: { fontSize: 10 }
        },
        yAxis: {
          disableGrid: true,
          disabled: true,
          axisLabel: { show: false },
          data: [{
            min: yAxisMin,
            max: yAxisMax
          }]
        },
        legend: {
          show: true,
          position: 'bottom',
          labelColor: '#666',
          fontSize: 12
        },
        extra: {
          line: {
            type: 'straight'
          }
        }
      })
      console.log('[投档线] 图表绘制完成')
    } catch (err) {
      console.error('[投档线] 图表绘制失败:', err)
    }
  },

  generateFilterOptions(admissionData, schools) {
    const years = [...new Set(admissionData.map(item => item.year))].sort((a, b) => b - a)
    const yearOptions = [{ label: '请选择年份', value: '' }, ...years.map(year => ({ label: year + '年', value: year }))]

    const batches = [...new Set(admissionData.map(item => item.batch))].filter(Boolean)
    const batchOptions = [{ label: '请选择批次', value: '' }, ...batches.map(batch => ({ label: batch, value: batch }))]

    const schoolTypeMap = {}
    if (schools && schools.length > 0) {
      schools.forEach(school => {
        schoolTypeMap[school.school_name] = school.level || ''
      })
    }

    const fullData = admissionData.map(item => ({
      id: item._id,
      school_name: item.school_name,
      major_name: item.major_name,
      min_score: item.min_score,
      year: item.year,
      batch: item.batch,
      level: item.school_type || schoolTypeMap[item.school_name] || ''
    }))

    const yearLabels = yearOptions.map(item => item.label)
    const batchLabels = batchOptions.map(item => item.label)

    this.setData({
      'filterOptions.years': yearOptions,
      'filterOptions.batches': batchOptions,
      yearLabels,
      batchLabels,
      'filterValues.yearIndex': 1,
      'filterValues.batchIndex': 1,
      fullAdmissionData: fullData
    })

    this.filterAdmissionData()
  },

  onYearChange(e) {
    const yearIndex = parseInt(e.detail.value)
    this.setData({
      'filterValues.yearIndex': yearIndex
    })
    this.filterAdmissionData()
  },

  onBatchChange(e) {
    const batchIndex = parseInt(e.detail.value)
    this.setData({
      'filterValues.batchIndex': batchIndex
    })
    this.filterAdmissionData()
  },

  filterAdmissionData() {
    const { filterOptions, filterValues, fullAdmissionData } = this.data

    const selectedYear = filterOptions.years[filterValues.yearIndex]?.value
    const selectedBatch = filterOptions.batches[filterValues.batchIndex]?.value

    let filteredData = [...fullAdmissionData]

    if (selectedYear) {
      filteredData = filteredData.filter(item => item.year === selectedYear)
    }

    if (selectedBatch) {
      filteredData = filteredData.filter(item => item.batch === selectedBatch)
    }

    filteredData = this.sortData(filteredData)

    this.setData({
      detailTableData: filteredData
    })
  },

  onSortChange(e) {
    const field = e.currentTarget.dataset.field
    const { sortConfig } = this.data

    let newOrder = 'desc'
    if (sortConfig.field === field && sortConfig.order === 'desc') {
      newOrder = 'asc'
    }

    this.setData({
      'sortConfig.field': field,
      'sortConfig.order': newOrder
    })

    this.filterAdmissionData()
  },

  sortData(data) {
    const { sortConfig } = this.data
    const { field, order } = sortConfig

    const sorted = [...data]

    if (field === 'school_name') {
      const pinyinSorted = pinyinSort(sorted, 'school_name')
      return order === 'asc' ? pinyinSorted : pinyinSorted.reverse()
    } else if (field === 'major_name') {
      const pinyinSorted = pinyinSort(sorted, 'major_name')
      return order === 'asc' ? pinyinSorted : pinyinSorted.reverse()
    } else {
      sorted.sort((a, b) => {
        if (order === 'asc') {
          return a[field] - b[field]
        } else {
          return b[field] - a[field]
        }
      })
      return sorted
    }
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
