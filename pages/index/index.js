const app = getApp()

Page({
  data: {

  },
  onLoad: function () {
    console.log('Welcome to Mini Code')
  },
  goToTest: function() {
    tt.navigateTo({
      url: '/pages/test/test'
    })
  },
})
