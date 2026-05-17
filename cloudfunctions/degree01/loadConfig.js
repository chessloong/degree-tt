/** 
 * 加载应用配置云函数
 * 从 degree_app_configs 表中查询所有配置项，序列化为 key-value 对象返回
 * @param params 调用参数
 * @param context 调用上下文
 * @return 返回配置对象
 */
let { dySDK } = require("@open-dy/node-server-sdk");

module.exports = async function (params, context) {
  try {
    // 获取数据库实例
    const db = dySDK.database();
    
    // 从 degree_app_configs 表中查询所有配置项
    const res = await db.collection('degree_app_configs').get();
    
    // 将配置数组序列化为 key-value 对象
    const configObject = {};
    if (res.data && Array.isArray(res.data)) {
      res.data.forEach(item => {
        if (item.key && item.value !== undefined) {
          // 尝试解析 value 为 JSON，否则保持原值
          try {
            configObject[item.key] = JSON.parse(item.value);
          } catch {
            configObject[item.key] = item.value;
          }
        }
      });
    }
    
    return {
      code: 0,
      message: 'success',
      data: configObject
    };

  } catch (err) {
    context.log('加载配置失败:', err.message);
    return {
      code: 500,
      message: '加载配置失败',
      error: err.message
    };
  }
};
