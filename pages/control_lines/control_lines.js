const app = getApp()

Page({
  data: {
    title: '省控线'
  },

  onLoad: function(options) {
    console.log('省控线页面加载:', options)
  },

  onReady: function() {
    console.log('省控线页面渲染完成')
  },

  onShow: function() {
    console.log('省控线页面显示')
  },

  onHide: function() {
    console.log('省控线页面隐藏')
  },

  onUnload: function() {
    console.log('省控线页面卸载')
  }
})
