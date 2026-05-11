/** 
 * @param params 调用参数，HTTP 请求下为请求体
 * @param context 调用上下文
 *
 * @return 函数的返回数据，HTTP 场景下会作为 Response Body
 *
 */
let { dySDK } = require("@open-dy/node-server-sdk");
module.exports = async function (params, context) {
  // 云函数 params、context 使用介绍：云函数Api_开发者平台_抖音开放平台
  const serviceContext = dySDK.context(context);

  // @open-dy/node-server-sdk 提供 3 个能力：获取用户信息、免鉴权云调用OpenApi、服务间调用，详情见 云函数开发指南_抖音开放平台
  const contextInfo = serviceContext.getContext();
  context.log(params,contextInfo);

  return {
    source: contextInfo.source, // 调用来源
    ip: contextInfo.ip, // 调用来源的IP地址
    appId: contextInfo.appId,
    envId: contextInfo.envId,
    openId: contextInfo.openId, // 用户的openId，在调试环境下为空，
    unionId: contextInfo.unionId, // 用户的unionId，在调试环境下为空，
    anonymousOpenid: contextInfo.anonymousOpenid // 用户的匿名openId，在调试环境下为空。 
  }
};