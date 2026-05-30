const app = getApp()

Page({
  data: {
    title: '志愿规划',
    currentClassName: '',
    loading: true,
    loadingText: '加载中...',
    volunteerList: [],
    schoolLevelMap: {},
    schoolRegionMap: {}
  },

  onLoad: function (_options) {
    console.log('[志愿规划] 页面加载')
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
      console.log(`[志愿规划] 当前用户大类: ${className}`)

      const schools = await app.loadSchoolsData()

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
          cacheKey: 'admission_lines',
          collection: 'degree_admission_lines',
          filter: { class_name: className },
          type: 'array',
          itemKey: 'class_name',
          itemValue: className,
          defaultValue: []
        }
      ])

      const plansData = data.plans || []
      const admissionData = data.admission_lines || []

      const schoolLevelMap = {}
      const schoolRegionMap = {}
      if (schools && schools.length > 0) {
        schools.forEach(school => {
          schoolLevelMap[school.school_name] = school.level || '其他'
          schoolRegionMap[school.school_name] = school.city || '未知'
        })
      }

      const volunteerList = this.processVolunteerData(plansData, admissionData, schoolLevelMap, schoolRegionMap)

      this.setData({
        currentClassName: className,
        volunteerList,
        schoolLevelMap,
        schoolRegionMap,
        loading: false,
        loadingText: ''
      })

      console.log(`[志愿规划] 加载完成，招生计划 ${plansData.length} 条，投档线 ${admissionData.length} 条，志愿项目 ${volunteerList.length} 个`)
    } catch (err) {
      console.error('[志愿规划] 加载失败:', err)
      tt.showToast({
        title: '加载失败，请重试',
        icon: 'none'
      })
      this.setData({
        loading: false,
        loadingText: '',
        volunteerList: []
      })
    }
  },

  processVolunteerData(plansData, admissionData, schoolLevelMap, schoolRegionMap) {
    if (!plansData || plansData.length === 0) {
      console.log('[志愿规划] 招生计划数据为空')
      return []
    }

    const years = [...new Set(plansData.map(p => p.year).filter(Boolean))].sort((a, b) => b - a)
    console.log(`[志愿规划] 可用年份: ${years.join(', ')}`)

    if (years.length === 0) {
      return []
    }

    const lastYear = years[0]
    const secondLastYear = years.length > 1 ? years[1] : null

    console.log(`[志愿规划] 最后一年: ${lastYear}, 次最后年: ${secondLastYear}`)

    const lastYearPlans = plansData.filter(p => p.year === lastYear)
    console.log(`[志愿规划] 最后一年招生计划: ${lastYearPlans.length} 条`)

    const mergedPlans = this.mergePlansBySchoolAndMajor(lastYearPlans)
    console.log(`[志愿规划] 合并后志愿项目: ${mergedPlans.length} 个`)

    const scoreMap = this.buildScoreMap(admissionData, secondLastYear)

    const volunteerList = mergedPlans.map(plan => {
      const scoreKey = `${plan.school_name}|${plan.major_name}`
      const scoreData = scoreMap[scoreKey]

      const totalCount = (plan.normalCount || 0) + (plan.jdCount || 0)

      return {
        schoolName: plan.school_name || '未知院校',
        majorName: plan.major_name || '未知专业',
        normalCount: plan.normalCount || 0,
        jdCount: plan.jdCount || 0,
        totalCount: totalCount,
        minScoreNum: scoreData ? parseFloat(scoreData.min_score) : null,
        minScore: scoreData ? scoreData.min_score : null,
        level: schoolLevelMap[plan.school_name] || '其他',
        region: schoolRegionMap[plan.school_name] || '未知'
      }
    })

    volunteerList.sort((a, b) => {
      const levelOrder = { '2B': 0, '2C': 1, '其他': 2 }
      const levelA = levelOrder[a.level] !== undefined ? levelOrder[a.level] : 2
      const levelB = levelOrder[b.level] !== undefined ? levelOrder[b.level] : 2

      if (levelA !== levelB) {
        return levelA - levelB
      }

      if (a.minScoreNum === null && b.minScoreNum === null) {
        return 0
      }
      if (a.minScoreNum === null) {
        return 1
      }
      if (b.minScoreNum === null) {
        return -1
      }

      return b.minScoreNum - a.minScoreNum
    })

    let cumulativeCount = 0
    volunteerList.forEach(item => {
      cumulativeCount += item.totalCount
      item.cumulativeCount = cumulativeCount
    })

    console.log(`[志愿规划] 排序完成，有效投档分项目: ${volunteerList.filter(v => v.minScoreNum !== null).length} 个`)

    return volunteerList
  },

  mergePlansBySchoolAndMajor(plans) {
    const mergedMap = {}

    plans.forEach(plan => {
      const schoolName = plan.school_name || ''
      const majorName = plan.major_name || ''
      const batch = plan.batch || '普通批'
      const total = parseFloat(plan.total) || 0

      const key = `${schoolName}|${majorName}`

      if (!mergedMap[key]) {
        mergedMap[key] = {
          school_name: schoolName,
          major_name: majorName,
          normalCount: 0,
          jdCount: 0
        }
      }

      if (batch === '普通批' || batch === '普通' || batch === '物理类普通批' || batch === '历史类普通批') {
        mergedMap[key].normalCount += total
      } else if (batch.includes('建档立卡') || batch.includes('专项')) {
        mergedMap[key].jdCount += total
      } else {
        mergedMap[key].normalCount += total
      }
    })

    return Object.values(mergedMap)
  },

  buildScoreMap(admissionData, year) {
    const scoreMap = {}

    if (!admissionData || admissionData.length === 0) {
      console.log('[志愿规划] 投档线数据为空')
      return scoreMap
    }

    const yearData = year ? admissionData.filter(d => d.year === year) : admissionData
    console.log(`[志愿规划] 筛选投档线数据(${year || '全部'}): ${yearData.length} 条`)

    yearData.forEach(item => {
      const schoolName = item.school_name || ''
      const majorName = item.major_name || ''
      const minScore = item.min_score
      const key = `${schoolName}|${majorName}`

      if (!scoreMap[key] || parseFloat(minScore) < parseFloat(scoreMap[key].min_score)) {
        scoreMap[key] = { min_score: minScore }
      }
    })

    return scoreMap
  },

  goToSettings() {
    tt.navigateTo({ url: '/pages/settings/settings' })
  }
})