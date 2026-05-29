const { dySDK } = require("@open-dy/node-server-sdk");

/**
 * 更新用户信息
 * @param {Object} params - 请求参数
 * @param {string} params.openId - 用户OpenID
 * @param {string} params.userClassName - 用户专业大类（可选）
 * @param {number} params.eduScore - 公共基础分数（可选）
 * @param {number} params.majorBasicScore - 专业基础分数（可选）
 * @param {number} params.majorTestScore - 专业测试分数（可选）
 * @param {Object} context - 调用上下文
 */
module.exports = async function (params, context) {
  try {
    const { openId, userClassName, eduScore, majorBasicScore, majorTestScore } = params
    
    // 参数验证
    if (!openId) {
      return {
        code: 1,
        message: '缺少 openId 参数',
        data: null
      }
    }
    
    // 检查是否有任何更新字段
    const hasUpdateData = userClassName !== undefined || 
                         eduScore !== undefined || 
                         majorBasicScore !== undefined || 
                         majorTestScore !== undefined
    
    if (!hasUpdateData) {
      return {
        code: 1,
        message: '缺少更新数据',
        data: null
      }
    }
    
    context.log(`[updateUserInfo] 更新用户 ${openId} 的信息:`, { userClassName, eduScore, majorBasicScore, majorTestScore })
    
    // 获取数据库实例
    const database = dySDK.database()
    const collection = database.collection('degree_users')
    const now = new Date().toISOString()
    
    // 构建更新数据
    const updateData = { updatedAt: now }
    if (userClassName !== undefined) {
      updateData.userClassName = userClassName
    }
    if (eduScore !== undefined) {
      updateData.eduScore = eduScore
    }
    if (majorBasicScore !== undefined) {
      updateData.majorBasicScore = majorBasicScore
    }
    if (majorTestScore !== undefined) {
      updateData.majorTestScore = majorTestScore
    }
    
    // 查询用户是否存在
    const queryResult = await collection.where({ openid: openId }).get()
    
    if (queryResult.data && queryResult.data.length > 0) {
      // 用户存在，执行更新
      context.log(`[updateUserInfo] 用户已存在，执行更新操作`)
      
      await collection.where({ openid: openId }).update(updateData)
      
      context.log(`[updateUserInfo] 更新成功`)
      
      return {
        code: 0,
        message: '用户信息更新成功',
        data: {
          openid: openId,
          ...updateData,
          isNew: false
        }
      }
    } else {
      // 用户不存在，创建新用户（使用默认值）
      context.log(`[updateUserInfo] 用户不存在，创建新用户`)
      
      const newUser = {
        openid: openId,
        userClassName: userClassName || '管理类',
        eduScore: eduScore || null,
        majorBasicScore: majorBasicScore || null,
        majorTestScore: majorTestScore || null,
        level: 1,
        createdAt: now,
        updatedAt: now
      }
      
      const addResult = await collection.add(newUser)
      
      const newDocId = addResult.insertedId || addResult._id || addResult.id
      context.log(`[updateUserInfo] 新用户创建成功，ID: ${newDocId}`)
      
      return {
        code: 0,
        message: '新用户创建成功',
        data: {
          _id: newDocId,
          openid: openId,
          ...newUser,
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
