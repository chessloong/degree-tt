/**
 * 获取历年报考及录取人数统计数据
 * 从 degree_score_segments 和 degree_plans 集合统计各年份数据
 */
let { dySDK } = require("@open-dy/node-server-sdk");

module.exports = async function (params, context) {
  try {
    const db = dySDK.database();
    const $ = db.command.aggregate;

    // ========== 1. 获取考试总人数统计（按年份分组） ==========
    // 只统计 score_type 为 edu 的记录，避免重复统计
    const examStats = await db.collection('degree_score_segments')
      .aggregate()
      .match({
        score_type: 'edu'
      })
      .group({
        _id: '$year',
        totalCount: $.sum('$count')
      })
      .sort({
        _id: 1
      })
      .end();

    // ========== 2. 获取录取总人数统计（按年份分组） ==========
    const admissionStats = await db.collection('degree_plans')
      .aggregate()
      .group({
        _id: '$year',
        totalCount: $.sum('$total')
      })
      .sort({
        _id: 1
      })
      .end();

    // ========== 3. 整合数据 ==========
    const examList = examStats.data || [];
    const admissionList = admissionStats.data || [];

    // 获取所有年份并去重排序
    const years = [
      ...new Set([
        ...examList.map(item => item._id),
        ...admissionList.map(item => item._id)
      ])
    ].sort((a, b) => a - b);

    // 组装最终结果
    const result = years.map(year => {
      const examItem = examList.find(item => item._id === year);
      const admissionItem = admissionList.find(item => item._id === year);

      return {
        year: year,
        examTotal: examItem ? examItem.totalCount : 0,
        admissionTotal: admissionItem ? admissionItem.totalCount : 0
      };
    });

    context.log(`统计成功: ${JSON.stringify(result)}`);

    return {
      code: 0,
      message: "success",
      data: result
    };

  } catch (err) {
    context.log("统计失败：", err);
    return {
      code: 500,
      message: "统计失败",
      error: err.message
    };
  }
};
