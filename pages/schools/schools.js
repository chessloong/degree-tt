const app = getApp()

Page({
  data: {
    title: '招生院校'
  },

  onLoad: function(options) {
    console.log('招生院校页面加载:', options)
  },

  onReady: function() {
    console.log('招生院校页面渲染完成')
  },

  onShow: function() {
    console.log('招生院校页面显示')
  },

  onHide: function() {
    console.log('招生院校页面隐藏')
  },

  onUnload: function() {
    console.log('招生院校页面卸载')
  }
})
