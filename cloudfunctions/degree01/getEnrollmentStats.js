/**
 * 获取历年招生统计数据（院校数量和专业数量）
 * 高性能版：使用双层Group实现去重计数，无addToSet内存压力
 */
let { dySDK } = require("@open-dy/node-server-sdk");

module.exports = async function (params, context) {
  try {
    const db = dySDK.database();
    const $ = db.command.aggregate;
    const coll = db.collection('degree_plans');

    // ========== 1. 按年份统计【不重复院校数】（双层Group，无addToSet） ==========
    const schoolStats = await coll
      .aggregate()
      .match({
        year: { $gte: 2022, $lte: 2026 },
        school_name: { $exists: true, $ne: "", $ne: null }
      })
      // 第一层：按 年份+院校名 分组 → 天然去重
      .group({
        _id: {
          year: "$year",
          school_name: "$school_name"
        }
      })
      // 第二层：按年份分组求和 → 得到院校总数
      .group({
        _id: "$_id.year",
        count: $.sum(1)
      })
      .sort({ _id: 1 })
      .end();

    // ========== 2. 按年份统计【不重复专业数】（双层Group，无addToSet） ==========
    const majorStats = await coll
      .aggregate()
      .match({
        year: { $gte: 2022, $lte: 2026 },
        major_name: { $exists: true, $ne: "", $ne: null }
      })
      // 第一层：按 年份+专业名 分组 → 天然去重
      .group({
        _id: {
          year: "$year",
          major_name: "$major_name"
        }
      })
      // 第二层：按年份分组求和 → 得到专业总数
      .group({
        _id: "$_id.year",
        count: $.sum(1)
      })
      .sort({ _id: 1 })
      .end();

    // ========== 3. 合并数据 ==========
    const schoolList = schoolStats.data || [];
    const majorList = majorStats.data || [];

    // 获取所有年份并去重排序
    const allYears = [
      ...new Set([
        ...schoolList.map(item => item._id),
        ...majorList.map(item => item._id)
      ])
    ].sort((a, b) => a - b);

    // 组装最终结果
    const result = allYears.map(year => {
      const schoolItem = schoolList.find(item => item._id === year);
      const majorItem = majorList.find(item => item._id === year);
      return {
        year: year,
        schoolCount: schoolItem ? schoolItem.count : 0,
        majorCount: majorItem ? majorItem.count : 0
      };
    });

    context.log(`统计成功: ${JSON.stringify(result)}`);

    // 返回结果
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