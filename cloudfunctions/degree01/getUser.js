/** 
 * 获取或创建用户信息云函数
 * @param params 调用参数，包含openid、avatarUrl、nickName
 * @param context 调用上下文
 * @return 返回用户信息
 */
let { dySDK } = require("@open-dy/node-server-sdk");
let dayjs = require('dayjs');

module.exports = async function (params, context) {
  const db = dySDK.database(context);
  const collection = db.collection('degree_users');
  
  // 记录日志
  context.log('获取或创建用户信息，参数:', params);
  
  const openid = params.openid;
  const avatarUrl = params.avatarUrl || '';  // 抖音头像URL
  const nickName = params.nickName || '';    // 抖音昵称
  
  if (!openid) {
    return {
      code: -1,
      message: 'openid不能为空',
      data: null
    };
  }
  
  try {
    // 1. 查找是否已有用户
    const queryResult = await collection.where({
      openid: openid
    }).get();
    
    context.log('查询用户结果:', queryResult);
    
    if (queryResult.data && queryResult.data.length > 0) {
      // 用户已存在
      let user = queryResult.data[0];
      context.log('用户已存在:', user);
      
      // 如果有抖音头像或昵称，更新用户信息
      if (avatarUrl || nickName) {
        const updateData = {
          updatedAt: dayjs().format('YYYY-MM-DD HH:mm:ss')
        };
        
        if (avatarUrl) {
          updateData.avatarUrl = avatarUrl;
        }
        if (nickName) {
          updateData.nickname = nickName;
        }
        
        context.log('getUser - 更新用户信息:', updateData);
        
        try {
          const updateResult = await collection.where({
            openid: openid
          }).update(updateData);
          
          context.log('getUser - 更新结果:', updateResult);
          
          // 获取更新后的用户信息
          const updatedResult = await collection.where({
            openid: openid
          }).get();
          
          if (updatedResult.data && updatedResult.data.length > 0) {
            user = updatedResult.data[0];
            context.log('getUser - 用户信息已更新:', user);
          } else {
            context.log('getUser - 更新后查询失败');
          }
        } catch (updateErr) {
          context.log('getUser - 更新失败:', updateErr);
        }
      } else {
        context.log('getUser - 没有需要更新的抖音信息');
      }
      
      // 确保返回的数据包含最新的抖音头像昵称
      if (avatarUrl) {
        user.avatarUrl = avatarUrl;
      }
      if (nickName) {
        user.nickname = nickName;
      }
      
      return {
        code: 0,
        message: '用户已存在',
        data: user
      };
    } else {
      // 用户不存在，创建新用户
      const now = dayjs().format('YYYY-MM-DD HH:mm:ss');
      
      // 使用抖音昵称或生成默认昵称
      const nickname = nickName || ('用户' + openid.substring(0, 8));
      
      const newUser = {
        openid: openid,
        nickname: nickname,
        avatarUrl: avatarUrl,  // 存储抖音头像
        level: 1,              // 默认级别为1
        userClassName: '管理类', // 默认用户类别为管理类
        createdAt: now,
        updatedAt: now
      };
      
      const addResult = await collection.add(newUser);
      context.log('创建新用户成功:', addResult);
      
      return {
        code: 0,
        message: '用户创建成功',
        data: {
          _id: addResult.insertedId,
          ...newUser
        }
      };
    }
  } catch (err) {
    context.log('用户操作失败:', err);
    return {
      code: -2,
      message: '用户操作失败: ' + err.message,
      data: null
    };
  }
};