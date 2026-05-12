/** 
 * 获取用户openid云函数
 * @param params 调用参数
 * @param context 调用上下文
 * @return 返回用户的openid等信息
 */
let { dySDK } = require("@open-dy/node-server-sdk");

module.exports = async function (params, context) {
  const serviceContext = dySDK.context(context);
  const contextInfo = serviceContext.getContext();
  
  // 记录日志
  context.log('获取用户信息:', contextInfo);

  return {
    code: 0,
    message: 'success',
    data: {
      openId: contextInfo.openId,           // 用户的openId
      unionId: contextInfo.unionId,         // 用户的unionId
      anonymousOpenid: contextInfo.anonymousOpenid, // 匿名openid
      appId: contextInfo.appId,             // 小程序appId
      envId: contextInfo.envId              // 环境ID
    }
  };
};
