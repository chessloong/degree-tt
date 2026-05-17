const app = getApp()

Page({
  data: {
    title: '招生专业'
  },

  onLoad: function(options) {
    console.log('招生专业页面加载:', options)
  },

  onReady: function() {
    console.log('招生专业页面渲染完成')
  },

  onShow: function() {
    console.log('招生专业页面显示')
  },

  onHide: function() {
    console.log('招生专业页面隐藏')
  },

  onUnload: function() {
    console.log('招生专业页面卸载')
  }
})
