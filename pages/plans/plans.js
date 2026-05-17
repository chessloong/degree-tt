const app = getApp()

Page({
  data: {
    title: '招生计划'
  },

  onLoad: function(options) {
    console.log('招生计划页面加载:', options)
  },

  onReady: function() {
    console.log('招生计划页面渲染完成')
  },

  onShow: function() {
    console.log('招生计划页面显示')
  },

  onHide: function() {
    console.log('招生计划页面隐藏')
  },

  onUnload: function() {
    console.log('招生计划页面卸载')
  }
})
