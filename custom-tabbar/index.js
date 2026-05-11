Component({
  data: {
    currentIndex: 0,
    iconPath: ['/assets/home_normal.png', '/assets/settings_normal.png'],
    selectedIconPath: ['/assets/home_selected.png', '/assets/settings_selected.png']
  },
  
  methods: {
    switchTab(e) {
      const { url, index } = e.currentTarget.dataset;
      
      this.setData({
        currentIndex: parseInt(index)
      });
      
      tt.switchTab({
        url: url
      });
    },
    
    // 更新tabBar选中状态
    updateTabBar(index) {
      this.setData({
        currentIndex: index
      });
    }
  }
});
