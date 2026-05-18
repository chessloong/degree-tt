/** 
 * 更新应用配置云函数（通用）
 * 支持更新 degree_app_configs 表中的任意配置项
 * @param params 调用参数
 * @param params.configKey 配置键名（如 'expireMinute', 'icpBeian' 等）
 * @param params.configValue 配置值（对象、字符串、数字等，会自动序列化为 JSON 字符串）
 * @param context 调用上下文
 * @return 返回更新结果
 */
let { dySDK } = require("@open-dy/node-server-sdk");

module.exports = async function (params, context) {
  try {
    // 解析参数
    let configKey;
    let configValue;
    
    // 方式1: 直接从 params 获取（抖音云标准方式）
    if (params && params.configKey && params.configValue !== undefined) {
      configKey = params.configKey;
      configValue = params.configValue;
    }
    // 方式2: 兼容旧的 expireMinute 参数
    else if (params && params.expireMinute) {
      configKey = 'expireMinute';
      configValue = params.expireMinute;
    }
    // 方式3: 如果 params 是字符串，尝试解析
    else if (typeof params === 'string') {
      try {
        const parsed = JSON.parse(params);
        if (parsed.configKey && parsed.configValue !== undefined) {
          configKey = parsed.configKey;
          configValue = parsed.configValue;
        } else if (parsed.expireMinute) {
          configKey = 'expireMinute';
          configValue = parsed.expireMinute;
        }
      } catch (e) {
        context.error('[updateConfig] 参数解析失败:', e);
      }
    }
    // 方式4: 从 context.event.body 获取
    else if (context && context.event && context.event.body) {
      try {
        const body = typeof context.event.body === 'string' 
          ? JSON.parse(context.event.body) 
          : context.event.body;
        
        if (body.configKey && body.configValue !== undefined) {
          configKey = body.configKey;
          configValue = body.configValue;
        } else if (body.expireMinute) {
          configKey = 'expireMinute';
          configValue = body.expireMinute;
        }
      } catch (e) {
        context.error('[updateConfig] body 解析失败:', e);
      }
    }
    
    context.log('[updateConfig] 接收到的参数:', JSON.stringify(params));
    context.log('[updateConfig] 解析后的 configKey:', configKey);
    context.log('[updateConfig] 解析后的 configValue:', JSON.stringify(configValue));
    
    // 参数验证
    if (!configKey) {
      return {
        code: 400,
        message: '参数错误：configKey 不能为空',
        data: null
      };
    }
    
    if (configValue === undefined || configValue === null) {
      return {
        code: 400,
        message: '参数错误：configValue 不能为空',
        data: null
      };
    }
    
    context.log(`[updateConfig] 开始更新配置项: ${configKey}`);
    
    // 获取数据库实例
    const db = dySDK.database();
    const collection = db.collection('degree_app_configs');
    
    // 将配置值序列化为 JSON 字符串
    const valueStr = typeof configValue === 'string' ? configValue : JSON.stringify(configValue);
    
    // 查询 key 对应的记录
    const queryResult = await collection.where({ key: configKey }).get();
    
    if (queryResult.data && queryResult.data.length > 0) {
      // 记录存在，执行更新
      const docId = queryResult.data[0]._id;
      await collection.doc(docId).update({
        value: valueStr,
        updatedAt: new Date().toISOString()
      });
      context.log(`[updateConfig] 更新成功，key: ${configKey}, 文档ID: ${docId}`);
      
      return {
        code: 0,
        message: 'success',
        data: {
          action: 'update',
          key: configKey,
          docId: docId,
          configValue: configValue
        }
      };
    } else {
      // 记录不存在，创建新记录
      const addResult = await collection.add({
        key: configKey,
        value: valueStr,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      
      const newDocId = addResult.insertedId || addResult._id;
      context.log(`[updateConfig] 创建成功，key: ${configKey}, 文档ID: ${newDocId}`);
      
      return {
        code: 0,
        message: 'success',
        data: {
          action: 'create',
          key: configKey,
          docId: newDocId,
          configValue: configValue
        }
      };
    }

  } catch (err) {
    context.error('[updateConfig] 云函数异常:', err.message);
    return {
      code: 500,
      message: '更新配置失败',
      error: err.message
    };
  }
};
