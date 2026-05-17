/**
 * 通用数据查询云函数
 * 支持按表名和筛选条件获取数据
 * 自动处理抖音云数据库单次查询数量限制（默认1000条，最大1000条）
 * 采用并行分批拉取策略实现全部数据获取，提升效率
 *
 * @param params 调用参数
 * @param params.collectionName 表名（必填）
 * @param params.limit 单次拉取数量（可选，默认1000，最大1000）
 * @param params.parallel 并行请求数量（可选，默认5，最大10）
 * @param params.filter 筛选条件对象（可选，用于按年份、专业大类等条件过滤）
 * @param context 调用上下文
 * @return 返回符合条件的所有数据
 */
let { dySDK } = require("@open-dy/node-server-sdk");

module.exports = async function (params, context) {
  try {
    const { collectionName, limit = 1000, parallel = 5, filter = {} } = params;

    if (!collectionName) {
      return {
        code: 400,
        message: '参数错误：collectionName 必填',
        error: 'collectionName is required'
      };
    }

    const db = dySDK.database();
    const batchLimit = Math.min(limit, 1000);
    const parallelLimit = Math.min(parallel, 10);

    let baseQuery = db.collection(collectionName);
    if (filter && Object.keys(filter).length > 0) {
      baseQuery = baseQuery.where(filter);
      context.log(`应用筛选条件: ${JSON.stringify(filter)}`);
    }

    context.log(`开始查询表 ${collectionName}，单次拉取数量: ${batchLimit}，并行数: ${parallelLimit}`);

    const countRes = await baseQuery.count();
    const total = countRes.total || 0;

    context.log(`表 ${collectionName} 符合条件的数据共 ${total} 条`);

    if (total === 0) {
      return {
        code: 0,
        message: 'success',
        data: [],
        total: 0
      };
    }

    const totalBatches = Math.ceil(total / batchLimit);
    context.log(`需要拉取 ${totalBatches} 批数据`);

    if (totalBatches <= 1) {
      const res = await baseQuery.limit(batchLimit).get();
      const data = res.data || [];
      context.log(`表 ${collectionName} 数据拉取完成，共 ${data.length} 条`);
      return {
        code: 0,
        message: 'success',
        data: data,
        total: data.length
      };
    }

    const firstBatch = await baseQuery
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

    const allData = [...firstBatch.data];

    if (firstBatch.data.length < batchLimit) {
      context.log(`表 ${collectionName} 数据拉取完成，共 ${allData.length} 条`);
      return {
        code: 0,
        message: 'success',
        data: allData,
        total: allData.length
      };
    }

    const fetchBatch = async (batchIndex) => {
      const skip = batchIndex * batchLimit;
      context.log(`开始拉取第 ${batchIndex + 1} 批数据，跳过 ${skip} 条`);

      let query = db.collection(collectionName);
      if (filter && Object.keys(filter).length > 0) {
        query = query.where(filter);
      }

      const res = await query
        .orderBy('_id', 'asc')
        .skip(skip)
        .limit(batchLimit)
        .get();

      return res.data || [];
    };

    const promises = [];
    for (let i = 1; i < totalBatches; i++) {
      promises.push(fetchBatch(i));
    }

    const executeInParallel = async (promisesArray, maxParallel) => {
      const results = [];
      const executing = [];

      for (const promise of promisesArray) {
        const wrappedPromise = promise.then((result) => {
          const index = executing.indexOf(wrappedPromise);
          if (index !== -1) {
            executing.splice(index, 1);
          }
          return result;
        });

        executing.push(wrappedPromise);

        if (executing.length >= maxParallel) {
          await Promise.race(executing);
        }

        results.push(wrappedPromise);
      }

      return Promise.all(results);
    };

    const batchResults = await executeInParallel(promises, parallelLimit);

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
    context.log(`查询表 ${params.collectionName} 数据失败:`, err.message);
    return {
      code: 500,
      message: '查询数据失败',
      error: err.message
    };
  }
};