const { dySDK } = require("@open-dy/node-server-sdk");

/**
 * 更新用户信息
 * @param {Object} params - 请求参数
 * @param {string} params.openId - 用户OpenID
 * @param {string} params.userClassName - 用户专业大类
 * @param {Object} context - 调用上下文
 */
module.exports = async function (params, context) {
  try {
    const { openId, userClassName } = params
    
    // 参数验证
    if (!openId) {
      return {
        code: 1,
        message: '缺少 openId 参数',
        data: null
      }
    }
    
    if (!userClassName) {
      return {
        code: 1,
        message: '缺少 userClassName 参数',
        data: null
      }
    }
    
    context.log(`[updateUserInfo] 更新用户 ${openId} 的专业大类为: ${userClassName}`)
    
    // 获取数据库实例
    const database = dySDK.database()
    const collection = database.collection('degree_users')  // ✅ 使用正确的集合名
    const now = new Date().toISOString()
    
    // ✅ 查询用户是否存在（使用 openid 小写，与 getUser.js 保持一致）
    const queryResult = await collection.where({ openid: openId }).get()
    
    if (queryResult.data && queryResult.data.length > 0) {
      // ✅ 用户存在，执行更新（使用 where().update()）
      context.log(`[updateUserInfo] 用户已存在，执行更新操作`)
      
      await collection.where({ openid: openId }).update({
        userClassName: userClassName,
        updatedAt: now
      })
      
      context.log(`[updateUserInfo] 更新成功`)
      
      return {
        code: 0,
        message: '用户信息更新成功',
        data: {
          openid: openId,
          userClassName: userClassName,
          updatedAt: now,
          isNew: false
        }
      }
    } else {
      // ✅ 用户不存在，创建新用户
      context.log(`[updateUserInfo] 用户不存在，创建新用户`)
      
      const addResult = await collection.add({
        openid: openId,  // ✅ 使用 openid 小写
        userClassName: userClassName,
        createdAt: now,
        updatedAt: now
      })
      
      const newDocId = addResult.insertedId || addResult._id || addResult.id
      context.log(`[updateUserInfo] 新用户创建成功，ID: ${newDocId}`)
      
      return {
        code: 0,
        message: '新用户创建成功',
        data: {
          _id: newDocId,
          openid: openId,
          userClassName: userClassName,
          createdAt: now,
          isNew: true
        }
      }
    }
    
  } catch (err) {
    context.error(`[updateUserInfo] 更新失败:`, err)
    
    return {
      code: 1,
      message: '更新用户信息失败',
      data: null,
      error: err.message
    }
  }
}
