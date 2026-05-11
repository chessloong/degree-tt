import uCharts from '../../common/u-charts.min.js';

Page({
  data: {
    // 城市选择器
    cities: ['北京', '上海', '广州', '深圳', '杭州'],
    cityIndex: 0,
    
    // 多列选择器（年月）
    dateRange: [
      ['2024', '2025', '2026', '2027'],
      ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12']
    ],
    dateIndex: [0, 0],
    
    // 多列选择器（省市）
    regionRange: [
      ['广东省', '浙江省', '江苏省', '四川省'],
      ['广州市', '深圳市', '杭州市', '南京市', '成都市']
    ],
    regionIndex: [0, 0],
    
    // 省市联动数据
    regionData: {
      '广东省': ['广州市', '深圳市', '珠海市', '汕头市'],
      '浙江省': ['杭州市', '宁波市', '温州市', '嘉兴市'],
      '江苏省': ['南京市', '苏州市', '无锡市', '常州市'],
      '四川省': ['成都市', '绵阳市', '德阳市', '乐山市']
    },
    
    // 时间选择器
    timeValue: '09:00'
  },
  
  // 城市选择
  onCityChange(e) {
    this.setData({
      cityIndex: e.detail.value
    });
  },
  
  // 日期选择
  onDateChange(e) {
    this.setData({
      dateIndex: e.detail.value
    });
  },
  
  // 地区选择
  onRegionChange(e) {
    this.setData({
      regionIndex: e.detail.value
    });
  },
  
  // 地区列变化（联动）
  onRegionColumnChange(e) {
    const column = e.detail.column; // 改变了第几列
    const value = e.detail.value; // 选择的下标
    
    // 如果改变的是第一列（省份）
    if (column === 0) {
      const province = this.data.regionRange[0][value];
      const cities = this.data.regionData[province];
      
      this.setData({
        'regionRange[1]': cities, // 更新第二列数据
        'regionIndex[0]': value, // 更新第一列选中项
        'regionIndex[1]': 0 // 重置第二列选中项
      });
    } else if (column === 1) {
      // 改变第二列
      this.setData({
        'regionIndex[1]': value
      });
    }
  },
  
  // 时间选择
  onTimeChange(e) {
    this.setData({
      timeValue: e.detail.value
    });
  },
  
  onReady() {
    // 获取系统信息
    const systemInfo = tt.getSystemInfoSync();
    const pixelRatio = systemInfo.pixelRatio;
    
    // 获取节点信息
    const query = tt.createSelectorQuery();
    query.select('#myChart').boundingClientRect((rect) => {
      if (!rect) return;
      
      const canvasWidth = rect.width;
      const canvasHeight = 300;
      
      // 获取 canvas 绘图上下文
      const ctx = tt.createCanvasContext('myChart', this);
      
      // 动态计算柱宽
      const categoryCount = 5; // X坐标数量
      const seriesCount = 3; // 数据组数
      const padding = 30; // 左右内边距
      const groupSpacing = 20; // 组间距
      const availableWidth = canvasWidth - padding;
      const groupWidth = availableWidth / categoryCount;
      const columnWidth = (groupWidth - groupSpacing) / seriesCount;
      
      // 创建 uCharts 实例
      new uCharts({
        $this: this,
        canvasId: 'myChart',
        context: ctx, // 传入绘图上下文
        type: 'column', // 柱状图
        fontSize: 11,
        legend: false,
        pixelRatio: 1, // 不使用像素比，直接使用实际像素
        animation: true,
        width: canvasWidth, // 直接使用容器宽度
        height: canvasHeight, // 直接使用容器高度
        dataLabel: true, // 显示数据标签
        categories: ['周一', '周二', '周三', '周四', '周五'],
        series: [
          {
            name: '销售额',
            data: [12, 20, 15, 28, 18],
            color: '#0081ff'
          },
          {
            name: '利润',
            data: [8, 15, 12, 22, 14],
            color: '#39b54a'
          },
          {
            name: '成本',
            data: [4, 5, 3, 6, 4],
            color: '#f37b1d'
          }
        ],
        padding: [15, 15, 0, 15],
        xAxis: {
          disableGrid: false, // 启用网格线
        },
        yAxis: {
          gridType: 'dash',
          dashLength: 2,
          data: [{
            min: 0 // 确保从0开始
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
            width: columnWidth, // 动态计算柱宽
            activeType: 'hilight'
          }
        }
      });
    }).exec();
    
    // 初始化平滑折线图
    const lineQuery = tt.createSelectorQuery();
    lineQuery.select('#lineChart').boundingClientRect((rect) => {
      if (!rect) return;
      
      const canvasWidth = rect.width;
      const canvasHeight = 300;
      const ctx = tt.createCanvasContext('lineChart', this);
      
      new uCharts({
        $this: this,
        canvasId: 'lineChart',
        context: ctx,
        type: 'line', // 折线图
        fontSize: 11,
        legend: false,
        pixelRatio: 1,
        animation: true,
        width: canvasWidth,
        height: canvasHeight,
        dataLabel: true,
        categories: ['1月', '2月', '3月', '4月', '5月', '6月'],
        series: [
          {
            name: '用户增长',
            data: [120, 180, 250, 320, 450, 580],
            color: '#0081ff'
          },
          {
            name: '活跃度',
            data: [80, 120, 180, 220, 320, 420],
            color: '#e54d42'
          }
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
        extra: {
          line: {
            type: 'curve', // 平滑曲线
            width: 3 // 线条粗细
          }
        }
      });
    }).exec();
  },
})
