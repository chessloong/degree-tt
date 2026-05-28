/**
 * 中文拼音排序工具
 * 使用 pinyin-pro 库实现准确的拼音排序
 */

const pinyinPro = require('../miniprogram_npm/pinyin-pro/index.js')

/**
 * 获取字符串的拼音（用于排序）
 * @param {string} str - 中文字符串
 * @returns {string} - 拼音字符串（不带声调）
 */
function getPinyin(str) {
  if (!str || typeof str !== 'string') {
    return ''
  }
  try {
    // 获取拼音，不带声调
    return pinyinPro.pinyin(str, {
      toneType: 'none',
      type: 'string'
    })
  } catch (err) {
    console.error('拼音转换失败:', err)
    return str
  }
}

/**
 * 按指定字段对数组进行拼音升序排序
 * @param {Array} arr - 待排序数组
 * @param {string} field - 排序字段名
 * @returns {Array} - 排序后的数组
 */
function pinyinSort(arr, field) {
  if (!Array.isArray(arr) || arr.length === 0) {
    return arr
  }

  return [...arr].sort((a, b) => {
    const pinyinA = getPinyin(a[field])
    const pinyinB = getPinyin(b[field])
    return pinyinA.localeCompare(pinyinB)
  })
}

module.exports = {
  pinyinSort,
  getPinyin
}
