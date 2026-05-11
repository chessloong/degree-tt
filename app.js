const config = require('./config.js')

App({
  onLaunch: function () {
    tt.login({
      success: () => {
        tt.createCloud({
          envID: config.env,
          serviceID: config.serviceId,
        })
      },
    })
  },
})
