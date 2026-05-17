/** 
 * 通用数据拉取云函数
 * 通过传递表名获取该表的所有数据
 * 自动处理抖音云数据库单次查询数量限制（默认100条，最大1000条）
 * 采用并行分批拉取策略实现全部数据获取，提升效率
 * 
 * @param params 调用参数
 * @param params.collectionName 表名（必填）
 * @param params.limit 单次拉取数量（可选，默认1000，最大1000）
 * @param params.parallel 并行请求数量（可选，默认5，最大10）
 * @param context 调用上下文
 * @return 返回表中所有数据
 */
let { dySDK } = require("@open-dy/node-server-sdk");

module.exports = async function (params, context) {
  try {
    // 参数校验
    const { collectionName, limit = 1000, parallel = 5 } = params;
    
    if (!collectionName) {
      return {
        code: 400,
        message: '参数错误：collectionName 必填',
        error: 'collectionName is required'
      };
    }

    // 记录日志
    context.log(`开始拉取表 ${collectionName} 的数据，单次拉取数量: ${limit}，并行数: ${parallel}`);

    // 获取数据库实例
    const db = dySDK.database();
    
    // 限制单次拉取数量（抖音云数据库最大1000条）
    const batchLimit = Math.min(limit, 1000);
    
    // 限制并行数量（避免过多并发请求）
    const parallelLimit = Math.min(parallel, 10);

    // 第一步：获取数据总数
    const countRes = await db.collection(collectionName).count();
    const total = countRes.total || 0;
    
    context.log(`表 ${collectionName} 共有 ${total} 条数据`);
    
    // 如果没有数据，直接返回
    if (total === 0) {
      return {
        code: 0,
        message: 'success',
        data: [],
        total: 0
      };
    }

    // 计算需要的批次数
    const totalBatches = Math.ceil(total / batchLimit);
    
    context.log(`需要拉取 ${totalBatches} 批数据`);

    // 如果只有一批，直接拉取，无需并行
    if (totalBatches <= 1) {
      const res = await db.collection(collectionName).limit(batchLimit).get();
      const data = res.data || [];
      context.log(`表 ${collectionName} 数据拉取完成，共 ${data.length} 条`);
      return {
        code: 0,
        message: 'success',
        data: data,
        total: data.length
      };
    }

    // 第二步：并行分批拉取数据
    // 策略：使用 _id 排序，然后按范围分批
    // 先获取第一批数据的最小和最大 _id
    const firstBatch = await db.collection(collectionName)
      .orderBy('_id', 'asc')
      .limit(batchLimit)
      .get();

    if (!firstBatch.data || firstBatch.data.length === 0) {
      context.log(`表 ${collectionName} 数据拉取完成，共 0 条`);
      return {
        code: 0,
        message: 'success',
        data: [],
        total: 0
      };
    }

    const firstId = firstBatch.data[0]._id;
    const lastId = firstBatch.data[firstBatch.data.length - 1]._id;

    // 收集所有数据
    const allData = [...firstBatch.data];
    
    // 如果只有第一批有数据
    if (firstBatch.data.length < batchLimit) {
      context.log(`表 ${collectionName} 数据拉取完成，共 ${allData.length} 条`);
      return {
        code: 0,
        message: 'success',
        data: allData,
        total: allData.length
      };
    }

    // 计算需要并行拉取的批次
    // 使用 lastId 作为起点，并行拉取后续数据
    const fetchBatch = async (batchIndex) => {
      const skip = batchIndex * batchLimit;
      context.log(`开始拉取第 ${batchIndex + 1} 批数据，跳过 ${skip} 条`);
      
      const res = await db.collection(collectionName)
        .orderBy('_id', 'asc')
        .skip(skip)
        .limit(batchLimit)
        .get();
      
      return res.data || [];
    };

    // 创建并行请求队列
    const promises = [];
    for (let i = 1; i < totalBatches; i++) {
      promises.push(fetchBatch(i));
    }

    // 限制并发数，分批执行
    const executeInParallel = async (promisesArray, maxParallel) => {
      const results = [];
      const executing = [];
      
      for (const promise of promisesArray) {
        // 创建一个包装的 promise，完成后从执行队列移除
        const wrappedPromise = promise.then((result) => {
          const index = executing.indexOf(wrappedPromise);
          if (index !== -1) {
            executing.splice(index, 1);
          }
          return result;
        });
        
        executing.push(wrappedPromise);
        
        // 如果达到最大并行数，等待一个完成
        if (executing.length >= maxParallel) {
          await Promise.race(executing);
        }
        
        results.push(wrappedPromise);
      }
      
      // 等待所有请求完成
      return Promise.all(results);
    };

    // 执行并行请求
    const batchResults = await executeInParallel(promises, parallelLimit);

    // 合并所有结果
    batchResults.forEach((batchData) => {
      if (batchData && batchData.length > 0) {
        allData.push(...batchData);
      }
    });

    context.log(`表 ${collectionName} 数据拉取完成，共 ${allData.length} 条`);

    return {
      code: 0,
      message: 'success',
      data: allData,
      total: allData.length
    };

  } catch (err) {
    context.log(`拉取表 ${params.collectionName} 数据失败:`, err.message);
    return {
      code: 500,
      message: '拉取数据失败',
      error: err.message
    };
  }
};
