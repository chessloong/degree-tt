const app = getApp()
import uCharts from '../../common/u-charts.min.js'

Page({
  data: {
    title: '省控线',
    controlLines: [],       // 省控线数据列表
    collectVolunteers: [],  // 征集志愿数据列表
    currentClassName: '',   // 当前专业大类
    loading: true,
    loadingText: '加载中...',
    // 文化分趋势图表
    cultureChart: {
      width: 0,
      height: 0,
      visible: false,
      data: null
    },
    // 专业测试趋势图表
    majorChart: {
      width: 0,
      height: 0,
      visible: false,
      data: null
    },
    // 文化分表格数据
    cultureTableData: {
      visible: false,
      years: [],
      batches: [],
      data: []
    },
    // 专业测试表格数据
    majorTableData: {
      visible: false,
      years: [],
      batches: [],
      data: []
    },
    // 征集志愿表格数据
    collectVolunteerTableData: {
      visible: false,
      tables: []
    }
  },

  onLoad: function(options) {
    console.log('[省控线] 页面加载')
  },

  onReady: function() {},

  onShow: function() {
    // 每次显示时加载/刷新数据（内部已有缓存保护）
    this.loadControlLinesData()
  },

  onHide: function() {},

  onUnload: function() {},

  /**
   * 加载省控线数据
   */
  async loadControlLinesData() {
    this.setData({
      loading: true,
      loadingText: '加载中...'
    })

    try {
      // 获取用户的专业大类
      const className = app.getUserClassName() || '管理类'
      console.log(`[省控线] 当前用户大类: ${className}`)

      // 批量加载所需数据（并行加载）
      const data = await app.loadPageDataBatch([
        {
          cacheKey: 'control_lines',
          collection: 'degree_control_lines',
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
      ])

      this.setData({
        controlLines: data.control_lines,
        collectVolunteers: data.collect_volunteer,
        currentClassName: className,
        loading: false,
        loadingText: ''
      })

      console.log(`[省控线] 加载完成，省控线 ${data.control_lines.length} 条，征集志愿 ${data.collect_volunteer.length} 条`)

      // 渲染趋势图表
      this.renderCultureChart()
      this.renderMajorChart()

      // 生成征集志愿表格
      this.generateCollectVolunteerTable(data.collect_volunteer, data.control_lines)

    } catch (err) {
      console.error('[省控线] 加载失败:', err)
      tt.showToast({
        title: '加载失败，请重试',
        icon: 'none'
      })
      this.setData({
        loading: false,
        loadingText: '',
        controlLines: [],
        collectVolunteers: []
      })
    }
  },

  /**
   * 等待 Canvas 就绪
   */
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

  /**
   * 渲染文化分趋势图表
   */
  async renderCultureChart() {
    const data = this.data.controlLines
    if (!data || data.length === 0) {
      console.log('[省控线-文化分] 数据为空，不渲染图表')
      return
    }

    // 筛选 score_type 为 'culture' 的数据
    const cultureData = data.filter(item => item.score_type === 'culture')
    if (cultureData.length === 0) {
      console.log('[省控线-文化分] 无文化分数据')
      return
    }

    // 按批次分组
    const batchMap = {}
    cultureData.forEach(item => {
      const batch = item.batch || '普通'
      if (!batchMap[batch]) {
        batchMap[batch] = {}
      }
      
      const year = item.year
      if (!batchMap[batch][year] || item.min_score < batchMap[batch][year]) {
        batchMap[batch][year] = item.min_score
      }
    })

    console.log('[省控线-文化分] 批次分布:', Object.keys(batchMap))

    console.log('[省控线-文化分] 批次分布:', Object.keys(batchMap))

    // 获取所有年份并排序
    const allYears = [...new Set(cultureData.map(item => item.year))].sort((a, b) => a - b)
    const categories = allYears.map(year => year)

    // 构建系列数据
    const series = []
    const batchColors = {
      '普通批': '#0081ff',              // 蓝色
      '建档立卡专项批': '#00C853',      // 绿色
      '专升本': '#0081ff',              // 蓝色
      '专接本': '#00C853',              // 绿色
      '专转本': '#0081ff'               // 蓝色
    }

    Object.keys(batchMap).forEach(batch => {
      const yearData = batchMap[batch]
      const data = allYears.map(year => yearData[year] || null)

      // 如果该批次没有数据，跳过
      if (data.every(v => v === null)) return

      const color = batchColors[batch] || '#0081ff'
      console.log(`[省控线-文化分] 批次: ${batch}, 颜色: ${color}`)

      series.push({
        name: batch,  // 直接使用批次名称，不添加"批次"二字
        data: data,
        color: color,
        lineType: 'straight',  // 直线，不平滑
        width: 3,
        showPoint: true,
        pointShape: 'circle',
        pointSize: 6,
        label: { show: true, fontSize: 10, fontWeight: 'bold', color: color }
      })
    })

    if (series.length === 0) {
      console.log('[省控线-文化分] 处理后数据为空')
      return
    }

    this.setData({
      'cultureChart.data': series,
      'cultureChart.visible': true
    })

    // 等待 DOM 更新
    await new Promise(resolve => setTimeout(resolve, 200))

    // 获取 Canvas 尺寸
    const rect = await this.waitForCanvas('#cultureChart', 50, 40)
    if (!rect) {
      console.error('[省控线-文化分] 获取 canvas 失败')
      return
    }

    const canvasWidth = rect.width
    const canvasHeight = Math.round(rect.width * 46 / 75)

    this.setData({
      'cultureChart.width': canvasWidth,
      'cultureChart.height': canvasHeight
    })

    // 再等待一下确保 setData 生效
    await new Promise(resolve => setTimeout(resolve, 50))

    const ctx = tt.createCanvasContext('cultureChart', this)

    // 动态计算 Y 轴范围
    const allScores = series.flatMap(s => s.data.filter(v => v !== null))
    const minScore = Math.min(...allScores)
    const maxScore = Math.max(...allScores)
    
    // 最小值：比最小分数小20的整10倍数
    const yAxisMin = Math.floor((minScore - 20) / 10) * 10
    // 最大值：比最大分数大20的整10倍数
    const yAxisMax = Math.ceil((maxScore + 20) / 10) * 10

    try {
      new uCharts({
        $this: this,
        canvasId: 'cultureChart',
        context: ctx,
        type: 'line',
        pixelRatio: 1,
        width: canvasWidth,
        height: canvasHeight,
        animation: true,
        timing: 'easeInOut',
        duration: 1000,
        categories: categories,
        series: series,
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
            type: 'straight',  // 直线类型
            width: 3,
            activeType: 'hilight'
          }
        }
      })
      console.log(`[省控线-文化分] 绘制完成，共 ${series.length} 条曲线`)
      
      // 生成表格数据
      this.generateCultureTable(cultureData)
    } catch (err) {
      console.error('[省控线-文化分] 绘制失败:', err)
    }
  },

  /**
   * 生成文化分表格数据
   */
  generateCultureTable(cultureData) {
    // 获取所有年份并按降序排序
    const years = [...new Set(cultureData.map(item => item.year))].sort((a, b) => b - a)
    
    // 获取所有批次
    const batches = [...new Set(cultureData.map(item => item.batch || '普通'))]
    
    // 按年份和批次组织数据
    const tableData = []
    years.forEach(year => {
      const row = { year: year }
      batches.forEach(batch => {
        const item = cultureData.find(d => d.year === year && d.batch === batch)
        row[batch] = item ? item.min_score : '-'
      })
      tableData.push(row)
    })
    
    this.setData({
      'cultureTableData.visible': true,
      'cultureTableData.years': years,
      'cultureTableData.batches': batches,
      'cultureTableData.data': tableData
    })
    console.log('[省控线-文化分] 表格数据生成完成')
  },

  /**
   * 渲染专业测试趋势图表
   */
  async renderMajorChart() {
    const data = this.data.controlLines
    if (!data || data.length === 0) {
      console.log('[省控线-专业测试] 数据为空，不渲染图表')
      return
    }

    // 筛选 score_type 为 'major' 的数据
    const majorData = data.filter(item => item.score_type === 'major')
    if (majorData.length === 0) {
      console.log('[省控线-专业测试] 无专业测试数据，隐藏图表')
      this.setData({
        'majorChart.visible': false
      })
      return
    }

    // 按批次分组
    const batchMap = {}
    majorData.forEach(item => {
      const batch = item.batch || '普通'
      if (!batchMap[batch]) {
        batchMap[batch] = {}
      }
      
      const year = item.year
      if (!batchMap[batch][year] || item.min_score < batchMap[batch][year]) {
        batchMap[batch][year] = item.min_score
      }
    })

    // 获取所有年份并排序
    const allYears = [...new Set(majorData.map(item => item.year))].sort((a, b) => a - b)
    const categories = allYears.map(year => year)

    // 构建系列数据
    const series = []
    const batchColors = {
      '普通批': '#FF8C00',              // 橙色
      '建档立卡专项批': '#9370DB',      // 紫色
      '专升本': '#FF8C00',              // 橙色
      '专接本': '#9370DB',              // 紫色
      '专转本': '#FF8C00'               // 橙色
    }

    Object.keys(batchMap).forEach(batch => {
      const yearData = batchMap[batch]
      const data = allYears.map(year => yearData[year] || null)

      // 如果该批次没有数据，跳过
      if (data.every(v => v === null)) return

      const color = batchColors[batch] || '#0081ff'
      console.log(`[省控线-专业测试] 批次: ${batch}, 颜色: ${color}`)

      series.push({
        name: batch,  // 直接使用批次名称，不添加"批次"二字
        data: data,
        color: color,
        lineType: 'straight',  // 直线，不平滑
        width: 3,
        showPoint: true,
        pointShape: 'circle',
        pointSize: 6,
        label: { show: true, fontSize: 10, fontWeight: 'bold', color: color }
      })
    })

    if (series.length === 0) {
      console.log('[省控线-专业测试] 处理后数据为空')
      return
    }

    this.setData({
      'majorChart.data': series,
      'majorChart.visible': true
    })

    // 等待 DOM 更新
    await new Promise(resolve => setTimeout(resolve, 200))

    // 获取 Canvas 尺寸
    const rect = await this.waitForCanvas('#majorChart', 50, 40)
    if (!rect) {
      console.error('[省控线-专业测试] 获取 canvas 失败')
      return
    }

    const canvasWidth = rect.width
    const canvasHeight = Math.round(rect.width * 46 / 75)

    this.setData({
      'majorChart.width': canvasWidth,
      'majorChart.height': canvasHeight
    })

    // 再等待一下确保 setData 生效
    await new Promise(resolve => setTimeout(resolve, 50))

    const ctx = tt.createCanvasContext('majorChart', this)

    // 动态计算 Y 轴范围（专业测试：上下各留10分）
    const allScores = series.flatMap(s => s.data.filter(v => v !== null))
    const minScore = Math.min(...allScores)
    const maxScore = Math.max(...allScores)
    
    // 最小值：比最小分数小10的整10倍数
    const yAxisMin = Math.floor((minScore - 10) / 10) * 10
    // 最大值：比最大分数大10的整10倍数
    const yAxisMax = Math.ceil((maxScore + 10) / 10) * 10

    try {
      new uCharts({
        $this: this,
        canvasId: 'majorChart',
        context: ctx,
        type: 'line',
        pixelRatio: 1,
        width: canvasWidth,
        height: canvasHeight,
        animation: true,
        timing: 'easeInOut',
        duration: 1000,
        categories: categories,
        series: series,
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
            type: 'straight',  // 直线类型
            width: 3,
            activeType: 'hilight'
          }
        }
      })
      console.log(`[省控线-专业测试] 绘制完成，共 ${series.length} 条曲线`)
      
      // 生成表格数据
      this.generateMajorTable(majorData)
    } catch (err) {
      console.error('[省控线-专业测试] 绘制失败:', err)
    }
  },

  /**
   * 生成专业测试表格数据
   */
  generateMajorTable(majorData) {
    // 获取所有年份并按降序排序
    const years = [...new Set(majorData.map(item => item.year))].sort((a, b) => b - a)
    
    // 获取所有批次
    const batches = [...new Set(majorData.map(item => item.batch || '普通'))]
    
    // 按年份和批次组织数据
    const tableData = []
    years.forEach(year => {
      const row = { year: year }
      batches.forEach(batch => {
        const item = majorData.find(d => d.year === year && d.batch === batch)
        row[batch] = item ? item.min_score : '-'
      })
      tableData.push(row)
    })
    
    this.setData({
      'majorTableData.visible': true,
      'majorTableData.years': years,
      'majorTableData.batches': batches,
      'majorTableData.data': tableData
    })
    console.log('[省控线-专业测试] 表格数据生成完成')
  },

  /**
   * 生成征集志愿表格数据
   */
  generateCollectVolunteerTable(collectVolunteers, controlLines) {
    if (!collectVolunteers || collectVolunteers.length === 0) {
      console.log('[省控线-征集志愿] 数据为空，不生成表格')
      return
    }

    // 获取所有年份并按降序排序
    const years = [...new Set(collectVolunteers.map(item => item.year))].sort((a, b) => b - a)

    // 获取所有轮次并排序
    const rounds = [...new Set(collectVolunteers.map(item => item.round))].sort((a, b) => a - b)

    // 获取所有批次并排序
    const batches = [...new Set(collectVolunteers.map(item => item.batch))].sort()

    // 按批次拆分为多个表格
    const tables = []
    batches.forEach(batch => {
      // 过滤出当前批次的数据
      const batchData = collectVolunteers.filter(cv => cv.batch === batch)
      if (batchData.length === 0) return

      // 构建表格数据：每行为一个年份+轮次组合
      const tableData = []
      let lastYear = null
      years.forEach(year => {
        // 查找当前年份、当前批次的省控线数据
        const majorControlItems = controlLines.filter(mc => 
          mc.year === year && mc.batch === batch
        )
        const cultureScoreItem = majorControlItems.find(mc => mc.score_type === 'culture')
        const majorScoreItem = majorControlItems.find(mc => mc.score_type === 'major')
        
        // 每年第一行显示省控线
        tableData.push({
          year: year,
          showYear: true,
          round: '省控线',
          cultureScore: cultureScoreItem ? cultureScoreItem.min_score : '-',
          majorScore: majorScoreItem ? majorScoreItem.min_score : '-'
        })
        
        // 再处理征集轮次数据
        rounds.forEach(round => {
          // 检查该年份+轮次是否有数据
          const roundItems = batchData.filter(cv => cv.year === year && cv.round === round)
          if (roundItems.length === 0) return

          // 获取文化线最小值
          const cultureScores = roundItems
            .map(item => parseFloat(item.culture_score))
            .filter(score => !isNaN(score))
          const minCulture = cultureScores.length > 0 ? Math.min(...cultureScores) : '-'

          // 获取专业线最小值
          const majorScores = roundItems
            .map(item => parseFloat(item.major_score))
            .filter(score => !isNaN(score))
          const minMajor = majorScores.length > 0 ? Math.min(...majorScores) : '-'

          tableData.push({
            year: year,
            showYear: false,
            round: round === 0 ? '征集' : (round === 99 ? '最后' : `征集${round}`),
            cultureScore: minCulture,
            majorScore: minMajor
          })
          lastYear = year
        })
      })

      if (tableData.length > 0) {
        tables.push({
          batch: batch,
          data: tableData
        })
      }
    })

    this.setData({
      'collectVolunteerTableData.visible': true,
      'collectVolunteerTableData.tables': tables
    })
    console.log('[省控线-征集志愿] 表格数据生成完成')
  }
})
