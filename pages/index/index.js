const app = getApp()
import uCharts from '../../common/u-charts.min.js'

Page({
  data: {
    chartWidth: 0,
    chartHeight: 0,
    chartWidth2: 0,
    chartHeight2: 0,
    chartWidth3: 0,
    chartHeight3: 0
  },
  
  onLoad: function() {
    console.log('Welcome to Mini Code')
  },
  
  onReady() {
    // 获取系统信息
    const systemInfo = tt.getSystemInfoSync();
    const pixelRatio = systemInfo.pixelRatio;
    
    // 获取卡片内容区尺寸
    tt.createSelectorQuery()
      .select('.de-card-content')
      .boundingClientRect(rect => {
        if (!rect) return;
        
        const canvasWidth = rect.width;
        const canvasHeight = Math.round(rect.width * 46 / 75); // 75:46 比例
        
        // 设置数据
        this.setData({
          chartWidth: canvasWidth,
          chartHeight: canvasHeight
        });
        
        // 等待渲染完成后绘制图表
        setTimeout(() => {
          // 获取 canvas 绘图上下文
          const ctx = tt.createCanvasContext('homeChart', this);
        
        // 动态计算柱宽
        const categoryCount = 7;
        const seriesCount = 2;
        const padding = 30;
        const groupSpacing = 20;
        const availableWidth = canvasWidth - padding;
        const groupWidth = availableWidth / categoryCount;
        const columnWidth = (groupWidth - groupSpacing) / seriesCount;
        
        // 创建 uCharts 实例
        new uCharts({
          $this: this,
          canvasId: 'homeChart',
          context: ctx,
          type: 'column',
          pixelRatio: 1,
          width: canvasWidth,
          height: canvasHeight,
          categories: ['周一', '周二', '周三', '周四', '周五', '周六', '周日'],
          series: [
            { name: '学习时长', data: [2, 3, 2.5, 4, 3.5, 5, 4.5], color: '#0081ff' },
            { name: '做题数量', data: [20, 30, 25, 40, 35, 50, 45], color: '#39b54a' }
          ],
          padding: [15, 15, 0, 15],
          xAxis: {
            disableGrid: false,
          },
          yAxis: {
            gridType: 'dash',
            dashLength: 2,
            data: [{
              min: 0
            }]
          },
          legend: {
            show: true,
            position: 'bottom',
            lineHeight: 25
          },
          extra: {
            column: {
              type: 'group',
              width: columnWidth,
              activeType: 'hilight'
            }
          }
        });
        }, 300); // 延迟300ms等待渲染
      })
      .exec();
    
    // 初始化第二个图表
    tt.createSelectorQuery()
      .selectAll('.de-card-content')
      .boundingClientRect(rects => {
        if (!rects || rects.length < 2) return;
        
        const rect = rects[1]; // 第二个卡片内容区
        const canvasWidth = rect.width;
        const canvasHeight = Math.round(rect.width * 46 / 75);
        
        this.setData({
          chartWidth2: canvasWidth,
          chartHeight2: canvasHeight
        });
        
        setTimeout(() => {
          const ctx = tt.createCanvasContext('homeChart2', this);
          
          const categoryCount = 6;
          const seriesCount = 1;
          const padding = 30;
          const groupSpacing = 20;
          const availableWidth = canvasWidth - padding;
          const groupWidth = availableWidth / categoryCount;
          const columnWidth = (groupWidth - groupSpacing) / seriesCount;
          
          new uCharts({
            $this: this,
            canvasId: 'homeChart2',
            context: ctx,
            type: 'column',
            pixelRatio: 1,
            width: canvasWidth,
            height: canvasHeight,
            categories: ['语文', '数学', '英语', '政治', '物理', '化学'],
            series: [
              { name: '平均分', data: [85, 78, 92, 88, 76, 82], color: '#0081ff' }
            ],
            padding: [15, 15, 0, 15],
            xAxis: {
              disableGrid: false,
            },
            yAxis: {
              gridType: 'dash',
              dashLength: 2,
              data: [{
                min: 0
              }]
            },
            legend: {
              show: true,
              position: 'bottom',
              lineHeight: 25
            },
            extra: {
              column: {
                type: 'group',
                width: columnWidth,
                activeType: 'hilight'
              }
            }
          });
        }, 300);
      })
      .exec();
    
    // 初始化第三个图表
    tt.createSelectorQuery()
      .selectAll('.de-card-content')
      .boundingClientRect(rects => {
        if (!rects || rects.length < 3) return;
        
        const rect = rects[2]; // 第三个卡片内容区
        const canvasWidth = rect.width;
        const canvasHeight = Math.round(rect.width * 46 / 75);
        
        this.setData({
          chartWidth3: canvasWidth,
          chartHeight3: canvasHeight
        });
        
        setTimeout(() => {
          const ctx = tt.createCanvasContext('homeChart3', this);
          
          const categoryCount = 5;
          const seriesCount = 2;
          const padding = 30;
          const groupSpacing = 20;
          const availableWidth = canvasWidth - padding;
          const groupWidth = availableWidth / categoryCount;
          const columnWidth = (groupWidth - groupSpacing) / seriesCount;
          
          new uCharts({
            $this: this,
            canvasId: 'homeChart3',
            context: ctx,
            type: 'column',
            pixelRatio: 1,
            width: canvasWidth,
            height: canvasHeight,
            categories: ['第1周', '第2周', '第3周', '第4周', '第5周'],
            series: [
              { name: '计划进度', data: [20, 40, 60, 80, 100], color: '#0081ff' },
              { name: '实际进度', data: [18, 35, 58, 75, 92], color: '#39b54a' }
            ],
            padding: [15, 15, 0, 15],
            xAxis: {
              disableGrid: false,
            },
            yAxis: {
              gridType: 'dash',
              dashLength: 2,
              data: [{
                min: 0
              }]
            },
            legend: {
              show: true,
              position: 'bottom',
              lineHeight: 25
            },
            extra: {
              column: {
                type: 'group',
                width: columnWidth,
                activeType: 'hilight'
              }
            }
          });
        }, 300);
      })
      .exec();
  },
  
  // 跳转到测试页
  goToTest: function() {
    tt.navigateTo({
      url: '/pages/test/test'
    });
  }
})
