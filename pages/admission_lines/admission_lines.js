import uCharts from '../../common/u-charts.min.js'
const app = getApp()

Page({
  data: {
    title: '投档线',
    admissionLines: [],     // 投档线数据列表
    collectVolunteers: [],  // 征集志愿数据列表
    currentClassName: '',   // 当前专业大类
    loading: true,
    loadingText: '加载中...',
    
    // 投档分趋势图表
    admissionChart: {
      data: [],
      visible: false,
      width: 0,
      height: 0
    },
    
    // 投档分表格数据
    admissionTableData: {
      visible: false,
      types: [],
      data: []
    }
  },

  onLoad: function(options) {
    console.log('[投档线] 页面加载')
  },

  onReady: function() {},

  onShow: function() {
    // 每次显示时加载/刷新数据（内部已有缓存保护）
    this.loadAdmissionLinesData()
  },

  onHide: function() {},

  onUnload: function() {},

  /**
   * 等待 Canvas 元素出现
   */
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

  /**
   * 加载投档线数据
   */
  async loadAdmissionLinesData() {
    this.setData({
      loading: true,
      loadingText: '加载中...'
    })

    try {
      // 获取用户的专业大类
      const className = app.getUserClassName() || '管理类'
      console.log(`[投档线] 当前用户大类: ${className}`)

      // 并行加载投档线数据和院校数据
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

      // 渲染投档分趋势图表（传入院校数据用于匹配学校类型）
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

  /**
   * 渲染投档分趋势图表
   */
  async renderAdmissionChart(admissionData, schools) {
    if (!admissionData || admissionData.length === 0) {
      console.log('[投档线] 数据为空，不渲染图表')
      return
    }

    // 创建院校名称到类型的映射
    const schoolTypeMap = {}
    if (schools && schools.length > 0) {
      schools.forEach(school => {
        schoolTypeMap[school.school_name] = school.level || '其他'
      })
    }
    console.log('[投档线] 院校类型映射创建完成，共', Object.keys(schoolTypeMap).length, '所')

    // 按院校类型（2B/2C）分组
    const typeMap = {}
    admissionData.forEach(item => {
      // 优先从投档线数据获取类型，否则从院校数据匹配
      let schoolType = item.school_type
      if (!schoolType && item.school_name) {
        schoolType = schoolTypeMap[item.school_name] || '其他'
      }
      schoolType = schoolType || '其他'
      
      if (!typeMap[schoolType]) {
        typeMap[schoolType] = {}
      }
      
      const year = item.year
      // 取最低分（保留整数）
      const score = Math.round(item.min_score)
      if (!typeMap[schoolType][year] || score < typeMap[schoolType][year]) {
        typeMap[schoolType][year] = score
      }
    })

    console.log('[投档线] 院校类型分布:', Object.keys(typeMap))

    // 获取所有年份并排序
    const allYears = [...new Set(admissionData.map(item => item.year))].sort((a, b) => a - b)
    const categories = allYears.map(year => year)

    // 构建系列数据
    const series = []
    const typeColors = {
      '2B': '#FF8C00',              // 橙色
      '2C': '#9370DB'               // 紫色
    }

    Object.keys(typeMap).forEach(type => {
      const yearData = typeMap[type]
      const data = allYears.map(year => yearData[year] || null)

      // 如果该类型没有数据，跳过
      if (data.every(v => v === null)) return

      const color = typeColors[type] || '#0081ff'
      console.log(`[投档线] 类型: ${type}, 颜色: ${color}`)

      series.push({
        name: type + '院校',
        data: data,
        color: color,
        lineType: 'straight',
        width: 3,
        showPoint: true,
        pointShape: 'circle',
        pointSize: 6,
        label: { show: true, fontSize: 10, fontWeight: 'bold', color: color }
      })
    })

    if (series.length === 0) {
      console.log('[投档线] 处理后数据为空')
      return
    }

    // 生成表格数据（按年份降序排列）
    const tableTypes = Object.keys(typeMap).filter(type => {
      const yearData = typeMap[type]
      return !allYears.every(year => !yearData[year])
    })
    
    const tableData = allYears.sort((a, b) => b - a).map(year => {
      const row = { year: year }
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

    // 等待 DOM 更新
    await new Promise(resolve => setTimeout(resolve, 200))

    // 获取 Canvas 尺寸
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

    // 再等待一下确保 setData 生效
    await new Promise(resolve => setTimeout(resolve, 50))

    const ctx = tt.createCanvasContext('admissionChart', this)

    // 动态计算 Y 轴范围
    const allScores = series.flatMap(s => s.data.filter(v => v !== null))
    const maxScore = Math.max(...allScores)
    
    // 最小值固定为0
    const yAxisMin = 0
    // 最大值：比最大分数大20的整10倍数
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
        categories: categories,
        series: series,
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
  }
})
