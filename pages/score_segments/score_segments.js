const app = getApp()
import uCharts from '../../common/u-charts.min.js'

Page({
  data: {
    title: '一分一段',
    scoreSegments: [],     // 一分一段数据列表
    currentClassName: '',  // 当前专业大类
    loading: true,
    loadingText: '加载中...',

    majChart: {
      data: null,
      visible: false,
      width: 0,
      height: 0
    },
    majTableData: [],
    eduChart: {
      data: null,
      visible: false,
      width: 0,
      height: 0
    },
    eduTableData: [],
    queryData: {
      scoreType: 'edu',
      inputScore: '150',
      results: []
    },
    hasMajData: false
  },

  onLoad: function(options) {
    console.log('[分段] 页面加载')
  },

  onReady: function() {},

  onShow: function() {
    // 每次显示时加载/刷新数据（内部已有缓存保护）
    this.loadScoreSegmentsData()
  },

  onHide: function() {},

  onUnload: function() {},

  /**
   * 加载一分一段数据
   */
  async loadScoreSegmentsData() {
    this.setData({
      loading: true,
      loadingText: '加载中...'
    })

    try {
      // 获取用户的专业大类
      const className = app.getUserClassName() || '管理类'
      console.log(`[分段] 当前用户大类: ${className}`)

      // 检查缓存
      const cachedData = app.getArrayCacheItem('score_segments', 'class_name', className)
      if (cachedData) {
        console.log(`[分段] 使用缓存数据，共 ${cachedData.length} 条`)
        const hasMajData = cachedData.some(item => item.score_type === 'maj')
        this.setData({
          scoreSegments: cachedData,
          currentClassName: className,
          loading: false,
          loadingText: '',
          hasMajData: hasMajData
        })
        this.renderCharts()
        return
      }

      // 缓存无效或不存在，从云端拉取
      console.log('[分段] 缓存无效，从云端加载')
      const data = await app.loadDataFromCloud('degree_score_segments', { class_name: className })

      if (data && data.length > 0) {
        // 存入数组型缓存
        app.setArrayCacheItem('score_segments', 'class_name', className, data)
        const hasMajData = data.some(item => item.score_type === 'maj')
        
        this.setData({
          scoreSegments: data,
          currentClassName: className,
          loading: false,
          loadingText: '',
          hasMajData: hasMajData
        })
        console.log(`[分段] 加载成功，共 ${data.length} 条`)
        this.renderCharts()
      } else {
        console.log(`[分段] 未找到 ${className} 的一分一段数据`)
        this.setData({
          scoreSegments: [],
          currentClassName: className,
          loading: false,
          loadingText: '',
          hasMajData: false
        })
      }

    } catch (err) {
      console.error('[分段] 加载失败:', err)
      tt.showToast({
        title: '加载失败，请重试',
        icon: 'none'
      })
      this.setData({
        loading: false,
        loadingText: '',
        scoreSegments: []
      })
    }
  },

  renderCharts() {
    this.renderMajChart()
    this.renderEduChart()
  },

  renderMajChart() {
    const { scoreSegments } = this.data
    const majData = scoreSegments.filter(item => item.score_type === 'maj')
    
    console.log(`[分段-专业测试] 筛选后数据条数: ${majData.length}`)

    const yearMap = {}
    majData.forEach(item => {
      const year = item.year
      const score = parseFloat(item.score) || 0
      const count = parseInt(item.count) || 0
      
      if (!yearMap[year]) {
        yearMap[year] = { scores: [], counts: [] }
      }
      yearMap[year].scores.push(score)
      yearMap[year].counts.push(count)
    })

    const years = Object.keys(yearMap).sort((a, b) => b - a)
    const tableData = years.map(year => {
      const scores = yearMap[year].scores
      const counts = yearMap[year].counts
      const maxScore = scores.length > 0 ? Math.max(...scores) : 0
      
      const totalScore = scores.reduce((sum, score, index) => sum + score * (counts[index] || 0), 0)
      const totalCount = counts.reduce((sum, count) => sum + count, 0)
      const avgScore = totalCount > 0 ? Math.round(totalScore / totalCount) : 0
      
      return {
        year: parseInt(year),
        avgScore,
        maxScore
      }
    })

    const categories = years.reverse()
    const series = [
      {
        name: '平均分',
        data: [...tableData.map(item => item.avgScore)].reverse(),
        color: '#FF8C00'
      },
      {
        name: '最高分',
        data: [...tableData.map(item => item.maxScore)].reverse(),
        color: '#0081ff'
      }
    ]

    this.setData({
      'majChart.data': series,
      'majChart.visible': tableData.length > 0,
      'majTableData': tableData
    })

    setTimeout(() => {
      this.drawChart('majChart', categories, 'maj')
    }, 200)
  },

  renderEduChart() {
    const { scoreSegments } = this.data
    const eduData = scoreSegments.filter(item => item.score_type === 'edu')
    
    console.log(`[分段-文化考试] 筛选后数据条数: ${eduData.length}`)

    const yearMap = {}
    eduData.forEach(item => {
      const year = item.year
      const score = parseFloat(item.score) || 0
      const count = parseInt(item.count) || 0
      
      if (!yearMap[year]) {
        yearMap[year] = { scores: [], counts: [] }
      }
      yearMap[year].scores.push(score)
      yearMap[year].counts.push(count)
    })

    const years = Object.keys(yearMap).sort((a, b) => b - a)
    const tableData = years.map(year => {
      const scores = yearMap[year].scores
      const counts = yearMap[year].counts
      const maxScore = scores.length > 0 ? Math.max(...scores) : 0
      
      const totalScore = scores.reduce((sum, score, index) => sum + score * (counts[index] || 0), 0)
      const totalCount = counts.reduce((sum, count) => sum + count, 0)
      const avgScore = totalCount > 0 ? Math.round(totalScore / totalCount) : 0
      
      return {
        year: parseInt(year),
        avgScore,
        maxScore
      }
    })

    const categories = years.reverse()
    const series = [
      {
        name: '平均分',
        data: [...tableData.map(item => item.avgScore)].reverse(),
        color: '#39b54a'
      },
      {
        name: '最高分',
        data: [...tableData.map(item => item.maxScore)].reverse(),
        color: '#8B4513'
      }
    ]

    this.setData({
      'eduChart.data': series,
      'eduChart.visible': tableData.length > 0,
      'eduTableData': tableData
    })

    setTimeout(() => {
      this.drawChart('eduChart', categories, 'edu')
    }, 200)
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

  async drawChart(chartName, categories, chartType) {
    const chart = this.data[chartName]
    if (!chart.visible || !chart.data) {
      return
    }

    const selector = `#${chartType}Chart`
    const rect = await this.waitForCanvas(selector, 50, 40)
    if (!rect) {
      console.error(`[分段-${chartType}] 获取 canvas 失败`)
      return
    }

    const canvasWidth = rect.width
    const canvasHeight = Math.round(rect.width * 46 / 75)

    this.setData({
      [`${chartName}.width`]: canvasWidth,
      [`${chartName}.height`]: canvasHeight
    })

    await new Promise(resolve => setTimeout(resolve, 100))

    const ctx = tt.createCanvasContext(`${chartType}Chart`, this)
    const yMaxValue = chartType === 'maj' ? 100 : 300
    console.log(`[分段-${chartType}] Y轴配置: minValue=0, maxValue=${yMaxValue}`)

    try {
      new uCharts({
        $this: this,
        canvasId: `${chartType}Chart`,
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
          disableGrid: false,
          gridType: 'dash',
          dashLength: 2,
          axisLabel: { fontSize: 10 },
          data: [{
            min: 0,
            max: yMaxValue
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
      console.log(`[分段-${chartType}] 绘制完成`)
    } catch (err) {
      console.error(`[分段-${chartType}] 绘制失败:`, err)
    }
  },

  onScoreTypeToggle() {
    const { scoreType } = this.data.queryData
    const { hasMajData } = this.data
    
    if (scoreType === 'edu' && !hasMajData) {
      tt.showToast({
        title: '当前大类没有专业测试数据',
        icon: 'none'
      })
      return
    }
    
    const newScoreType = scoreType === 'edu' ? 'maj' : 'edu'
    this.setData({
      'queryData.scoreType': newScoreType,
      'queryData.results': []
    })
  },

  onScoreInput(e) {
    this.setData({
      'queryData.inputScore': e.detail.value
    })
  },

  onQueryRank() {
    const { scoreSegments, queryData } = this.data
    const scoreType = queryData.scoreType
    const inputScore = parseFloat(queryData.inputScore)
    
    if (isNaN(inputScore)) {
      tt.showToast({
        title: '请输入有效的分数',
        icon: 'none'
      })
      return
    }

    const filteredData = scoreSegments.filter(item => item.score_type === scoreType)
    
    const yearMap = {}
    filteredData.forEach(item => {
      const year = item.year
      const score = parseFloat(item.score) || 0
      const count = parseInt(item.count) || 0
      const cumulativeCount = parseInt(item.cumulative_count) || 0
      
      if (!yearMap[year]) {
        yearMap[year] = []
      }
      yearMap[year].push({ score, count, cumulativeCount })
    })

    const years = Object.keys(yearMap).sort((a, b) => b - a)
    const results = years.map(year => {
      const yearData = yearMap[year]
      const exactMatch = yearData.find(item => item.score === inputScore)
      
      if (exactMatch) {
        const startRank = exactMatch.cumulativeCount - exactMatch.count + 1
        const endRank = exactMatch.cumulativeCount
        const rankRange = exactMatch.count === 1 ? `${startRank}` : `${startRank}-${endRank}`
        return {
          year: parseInt(year),
          displayScore: inputScore,
          isApproximate: false,
          count: exactMatch.count,
          rankRange: rankRange
        }
      } else {
        let closestItem = null
        let minDiff = Infinity
        
        yearData.forEach(item => {
          const diff = Math.abs(item.score - inputScore)
          if (diff < minDiff) {
            minDiff = diff
            closestItem = item
          }
        })
        
        if (closestItem) {
          const startRank = closestItem.cumulativeCount - closestItem.count + 1
          const endRank = closestItem.cumulativeCount
          const rankRange = closestItem.count === 1 ? `${startRank}` : `${startRank}-${endRank}`
          return {
            year: parseInt(year),
            displayScore: closestItem.score,
            isApproximate: true,
            count: closestItem.count,
            rankRange: rankRange
          }
        }
        
        return {
          year: parseInt(year),
          displayScore: '-',
          isApproximate: false,
          count: 0,
          rankRange: '-'
        }
      }
    })

    this.setData({
      'queryData.results': results
    })
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
