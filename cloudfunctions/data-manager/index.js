/**
 * 抖音云函数：征集志愿数据上传接口（服务端SDK批量插入优化版）
 * 支持操作：insert(批量并发插入)、delete(清空全部)、count(统计数量)
 * 
 * 注意：@open-dy/node-server-sdk 的 add() 方法仅支持单条插入
 * 批量插入需通过 Promise.all() 并发调用实现
 */
let { dySDK } = require("@open-dy/node-server-sdk");

// 核心配置：控制单次并发数（建议50-100，避免触发云函数/数据库限制）
const CONCURRENT_LIMIT = 50;

module.exports = async function (params, context) {
  try {
    const { action, collection, data } = params;

    if (!collection) {
      return { code: 400, msg: '缺少 collection 参数' };
    }

    const db = dySDK.database();
    const coll = db.collection(collection);

    // ============== 1. 批量并发插入（服务端SDK唯一可行方案）==============
    if (action === 'insert') {
      if (!data || !Array.isArray(data) || data.length === 0) {
        return { code: 400, msg: 'data 必须为非空数组' };
      }

      // 分批处理，控制并发量
      const batches = [];
      for (let i = 0; i < data.length; i += CONCURRENT_LIMIT) {
        batches.push(data.slice(i, i + CONCURRENT_LIMIT));
      }

      const insertedIds = [];
      let insertedCount = 0;

      // 逐批处理
      for (const batch of batches) {
        // 单批内并发执行add()
        const promises = batch.map(item =>
          coll.add(item).then(res => res.insertedId || res._id || 'unknown')
        );
        
        const batchResults = await Promise.all(promises);
        insertedIds.push(...batchResults);
        insertedCount += batchResults.length;
      }

      return {
        code: 200,
        msg: '批量插入成功',
        insertedCount,
        insertedIds
      };
    }

    // ============== 2. 删除数据（支持按条件删除）==============
    if (action === 'delete') {
      // 支持按条件删除，如按年份删除
      const { year, batch } = params;
      let query = {};
      
      if (year !== undefined && year !== null) {
        query.year = year;
      }
      if (batch) {
        query.batch = batch;
      }
      
      const res = await coll.where(Object.keys(query).length > 0 ? query : {}).remove();
      return {
        code: 200,
        msg: year ? `删除${year}年数据成功` : '清空成功',
        deletedCount: res.deletedCount || 0
      };
    }

    // ============== 3. 统计数据数量 ==============
    if (action === 'count') {
      const res = await coll.count();
      return {
        code: 200,
        total: res.total
      };
    }

    return { code: 400, msg: `不支持的操作：${action}，支持 insert/delete/count` };

  } catch (err) {
    context.log('云函数异常:', err.message);
    return {
      code: 500,
      msg: '服务器异常',
      error: err.message
    };
  }
};
