const app = getApp()

Page({
  data: {
    title: '一分一段'
  },

  onLoad: function(options) {
    console.log('一分一段页面加载:', options)
  },

  onReady: function() {
    console.log('一分一段页面渲染完成')
  },

  onShow: function() {
    console.log('一分一段页面显示')
  },

  onHide: function() {
    console.log('一分一段页面隐藏')
  },

  onUnload: function() {
    console.log('一分一段页面卸载')
  }
})
