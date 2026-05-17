# 抖音小程序开发完全指南

---

## 第一部分：抖音云开发实战

## 一、项目概述

这是一个使用抖音云开发的小程序范例项目，展示了如何使用抖音云的核心能力：
- **函数服务** - Node.js云函数部署与调用
- **云数据库** - 文档型数据库的读写操作
- **对象存储** - 文件上传能力
- **云调用** - 免鉴权调用抖音开放平台API

---

## 二、项目结构

```
test-cf/
├── cloudfunctions/           # 云函数目录
│   └── quickstart/           # 函数服务
├── images/                   # 图片资源
├── pages/                    # 页面目录
│   ├── index/                # 首页-快速开始
│   ├── examples/             # 基础能力列表页
│   ├── exampleDetail/        # 示例详情页
│   ├── updateRecord/         # 更新记录页
│   ├── updateRecordResult/   # 更新结果页
│   └── updateRecordSuccess/  # 更新成功页
├── utils/                    # 工具函数
├── app.js                    # 小程序入口
├── app.json                  # 小程序配置
├── app.ttss                  # 全局样式
├── project.config.json       # 项目配置
└── project.private.config.json # 私有配置
```

---

## 三、核心配置文件详解

### 3.1 project.config.json - 项目配置

```json
{
    "setting": {
        "urlCheck": true,          // URL安全检测
        "es6": true,              // ES6转ES5
        "postcss": true,          // PostCSS样式处理
        "minified": true,         // 代码压缩
        "newFeature": true,       // 新特性支持
        "autoCompile": true,      // 自动编译
        "compileHotReLoad": true, // 热重载
        "nativeCompile": true     // 原生编译
    },
    "appid": "ttab77ddca3510275d01",
    "projectname": "test-cf",
    "douyinProjectType": "native",
    "cloudfunctionRoot": "cloudfunctions/"  // 云函数根目录
}
```

### 3.2 app.json - 小程序配置

```json
{
  "pages": [...],                    // 页面路由列表
  "window": {                        // 全局窗口配置
    "backgroundTextStyle": "light",
    "navigationBarBackgroundColor": "#fff",
    "navigationBarTitleText": "Mini Program",
    "navigationBarTextStyle": "black"
  },
  "tabBar": {                        // 底部导航栏
    "color": "#A2A9B0",
    "selectedColor": "#3C89FF",
    "backgroundColor": "#ffffff",
    "list": [...]
  },
  "usePrivacyCheck": true            // 隐私协议检查
}
```

**关键知识点：**
- `tabBar` 配置底部导航，最多5个tab
- `usePrivacyCheck` 启用隐私协议检查，涉及用户隐私的API需要配置

---

## 四、小程序入口 app.js

### 4.1 抖音云初始化

```javascript
const cloud = tt.createCloud({
  envID: "xxx",      // 抖音云环境ID
  serviceID: "xxx",  // 抖音云服务ID
});
```

**知识点：**
- `tt.createCloud()` 是抖音云SDK的初始化方法
- 需要在开发者控制台获取 `envID` 和 `serviceID`
- 初始化应在 `onLaunch` 生命周期中完成

### 4.2 登录状态管理

#### 基础版本

```javascript
onLaunch: async function () {
  let isLogin = false;
  try {
    await this.handleCheckSession();  // 先检查session是否有效
    isLogin = true;
  } catch (err) {
    const res = await this.handleLogin();  // session过期则重新登录
    isLogin = res.isLogin;
  }
  this.globalData = { cloud, isLogin };
}
```

#### 完整版本（Promise封装）

```javascript
App({
  onLaunch: async function () {
    const cloud = tt.createCloud({
      envID: "env-xxx",
      serviceID: "svc-xxx",
    });

    let isLogin = false;
    try {
      await this.handleCheckSession();
      isLogin = true;
    } catch (err) {
      console.log(`session 已过期，需要重新登录`, err);
      const res = await this.handleLogin();
      isLogin = res.isLogin;
    }

    this.globalData = {
      cloud,
      isLogin,
    };
  },

  // 登录方法（Promise封装）
  handleLogin() {
    return new Promise((resolve) => {
      return tt.login({
        success: (res) => {
          console.log("login success", res);
          resolve(res);
        },
        fail: (err) => {
          console.log("login err", err);
          resolve({
            isLogin: false,
            errMsg: err.errMsg,
          });
        },
      });
    });
  },

  // 检查session（Promise封装）
  handleCheckSession() {
    return new Promise((resolve, reject) => {
      return tt.checkSession({
        success: (res) => {
          console.log("checkSession success", res);
          resolve(res);
        },
        fail: (err) => {
          console.log("checkSession fail", err);
          reject(err);
        },
      });
    });
  }
});
```

**登录流程：**
1. `tt.checkSession()` 检查登录态是否有效
2. 有效则直接使用，无效则调用 `tt.login()` 获取新的登录凭证
3. 将 `cloud` 和 `isLogin` 存入 `globalData` 供全局使用

**知识点：**
- 使用 Promise 封装异步操作，便于使用 async/await
- `tt.checkSession()` 成功表示登录态有效，失败表示已过期
- `tt.login()` 会获取新的登录凭证code

---

## 五、工具函数 utils/index.js

### 5.1 JSON解析封装

```javascript
function parseJson(jsonString) {
    try {
        const parsedObject = JSON.parse(jsonString);
        return parsedObject;
    } catch (error) {
        console.error("解析错误:", error.message);
        return null;
    }
}
```

### 5.2 统一错误提示

```javascript
function toastError(code, message) {
    if (code === 404) {
        return tt.showToast({ icon: "none", title: "路径不存在，请检查" });
    }
    if (code === 500) {
        return tt.showToast({ icon: "none", title: "服务器内部错误" });
    }
    return tt.showToast({ icon: "none", title: message });
}
```

**设计思路：**
- 统一错误处理，避免重复代码
- 根据HTTP状态码给出友好提示

---

## 六、页面开发详解

### 6.1 首页 pages/index/index.js

#### 核心功能：
- 展示快速开始教程
- 代码复制功能
- 链接复制功能
- 页面跳转

#### 复制功能实现

```javascript
copyCode(e) {
  const code = e.target?.dataset?.code || "";
  tt.setClipboardData({
    data: code,
    success: (res) => {
      tt.showToast({ title: "已复制" });
    },
    fail: (err) => {
      if (err.errNo === 10202) {  // 隐私协议未配置
        return tt.showToast({ icon: "none", title: "复制失败，请先配置隐私协议" });
      }
      tt.showToast({ icon: "fail", title: "复制失败" });
    },
  });
}
```

**知识点：**
- `tt.setClipboardData()` 用于复制文本到剪贴板
- 错误码 `10202` 表示隐私协议未配置，需要在开发者后台配置

### 6.2 基础能力页 pages/examples/examples.js

#### 数据结构设计

```javascript
powerList: [{
  title: "函数服务",
  tip: "支持在线编辑、调试、发布",
  showItem: false,
  item: [{
    type: "getOpenId",
    title: "免登录获取OpenID",
  }, {
    type: "getTextAntidirt",
    title: "免鉴权检测内容安全",
  }]
}]
```

#### 页面跳转逻辑

```javascript
jumpPage(e) {
  const { type, page, category } = e.currentTarget.dataset;
  if (type) {
    tt.navigateTo({ url: `/pages/exampleDetail/exampleDetail?type=${type}` });
  } else {
    tt.navigateTo({ url: `/pages/${page}/${page}?category=${category}` });
  }
}
```

### 6.3 示例详情页 pages/exampleDetail/exampleDetail.js

#### 获取云实例

```javascript
const cloud = getApp().globalData.cloud;
const isLogin = getApp().globalData.isLogin;
```

#### 调用云函数 - 获取OpenID

```javascript
getOpenId() {
  tt.showLoading({ title: "加载中" });
  cloud.callContainer({
    path: "/get_open_id",
    init: {
      method: "GET",
      timeout: 60000,
    },
    success: ({ statusCode, data }) => {
      tt.hideLoading();
      const parsedData = parseJson(data);
      if (statusCode !== 200) {
        return toastError(statusCode, parsedData.message || parsedData.error);
      }
      if (parsedData?.code !== 0) {
        return tt.showToast({ icon: "none", title: parsedData.message });
      }
      this.setData({ haveGetOpenId: true, openId: parsedData.data });
    },
    fail: (response) => {
      tt.hideLoading();
      // 错误处理
    },
  });
}
```

**知识点：**
- `cloud.callContainer()` 是调用云函数的核心方法
- `path` 对应云函数的访问路径
- `init` 配置请求参数（method, header, body, timeout）
- 响应包含 `statusCode`, `header`, `data`

#### 内容安全检测

```javascript
getTextAntidirt() {
  cloud.callContainer({
    path: "/antidirt",
    init: {
      method: "POST",
      header: { "content-type": "application/json" },
      body: {
        tasks: [{ content: this.data.text }]
      },
      timeout: 60000,
    },
    success: ({ statusCode, data }) => {
      // 解析响应，获取检测结果
      const parsedData = parseJson(data);
      this.setData({
        haveGetTextAntidirt: true,
        hit: parsedData.data[0].predicts[0].hit,
      });
    }
  });
}
```

#### 文件上传

```javascript
uploadImg() {
  if (!isLogin) {
    return tt.showToast({ icon: "none", title: "上传文件前,请先登录" });
  }
  
  tt.chooseImage({
    count: 1,
    success: (res) => {
      const cloudPath = `my-photon-${Date.now()}.png`;
      cloud.uploadFile({
        cloudPath: cloudPath,
        filePath: res.tempFilePaths[0],
        timeout: 80000,
        success: (uploadRes) => {
          this.setData({
            imgSrc: res.tempFilePaths[0],
            filePath: cloudPath,
            haveGetImgSrc: true,
          });
        }
      });
    }
  });
}
```

**知识点：**
- `tt.chooseImage()` 选择图片
- `cloud.uploadFile()` 上传到云存储
- `cloudPath` 是云端存储路径

---

## 七、云函数开发

### 7.1 云函数基础结构

```javascript
const { dySDK } = require("@open-dy/node-server-sdk");

module.exports = async function (params, context) {
  // params: 请求参数（HTTP请求体）
  // context: 调用上下文
  return {
    code: 0,
    message: "",
    data: result
  };
};
```

**知识点：**
- 云函数使用 `@open-dy/node-server-sdk` SDK
- 导出一个异步函数，接收 `params` 和 `context` 参数
- 返回统一格式：`{ code, message, data }`

### 7.2 获取OpenID - get_open_id.js

```javascript
module.exports = async function (params, context) {
  const serviceContext = dySDK.context(context);
  const reqContext = serviceContext.getContext();
  context.log("openId", reqContext?.openId);
  return {
    code: 0,
    message: "",
    data: reqContext?.openId,
  };
};
```

**知识点：**
- `dySDK.context(context)` 创建服务上下文
- `getContext()` 获取请求上下文，包含用户信息（openId等）
- `context.log()` 用于日志输出

### 7.3 查询记录 - select_record.js

```javascript
module.exports = async function (params, context) {
  try {
    const database = dySDK.database();
    const demo = await database
      .collection("demo")
      .aggregate()
      .sort({ serverDate: -1 })
      .limit(5)
      .end();
    return { data: demo, code: 0, message: "" };
  } catch (err) {
    return { data: [], code: 1, message: "云数据库查询失败" };
  }
};
```

**知识点：**
- `dySDK.database()` 获取数据库实例
- `collection("demo")` 指定集合
- `aggregate()` 聚合查询
- `sort({ serverDate: -1 })` 按时间倒序
- `limit(5)` 限制返回数量

### 7.4 插入记录 - insert_record.js

```javascript
module.exports = async function (params, context) {
  try {
    const database = dySDK.database();
    const res = await database
      .collection("demo")
      .add({ ...params, serverDate: database.serverDate() });
    return { data: res, code: 0, message: "" };
  } catch (_) {
    return { data: [], code: 1, message: "云数据库插入失败" };
  }
};
```

**知识点：**
- `add()` 方法插入文档
- `database.serverDate()` 获取服务器时间

### 7.5 更新记录 - update_record.js

```javascript
module.exports = async function (params, context) {
  try {
    const database = dySDK.database();
    const data = params.data || [];
    if (!data.length) {
      return { data: [], code: 1, message: "请传入需要更新的集合" };
    }
    for (let i = 0; i < data.length; i++) {
      await database
        .collection("demo")
        .where({ _id: data[i]._id })
        .update({ sales: data[i].sales });
    }
    return { data: [], code: 0, message: "" };
  } catch (e) {
    return { data: [], code: 1, message: "云数据库更新失败" };
  }
};
```

**知识点：**
- `where()` 条件查询
- `update()` 更新操作
- 批量更新需要遍历处理

### 7.6 内容安全检测 - antidirt.js

```javascript
module.exports = async function (params, context) {
  const serviceContext = dySDK.context(context);
  const res = await serviceContext.openApiInvoke({
    url: "http://developer-toutiao-com.openapi.dyc.ivolces.com/api/v2/tags/text/antidirt",
    method: "POST",
    data: params
  });
  return res;
};
```

**知识点：**
- `openApiInvoke()` 免鉴权调用抖音开放平台API
- 使用内网专线域名调用，无需手动处理access_token
- 支持多种开放平台接口调用

---

## 八、抖音云核心能力总结

### 8.1 容器服务 vs 函数服务

| 对比维度 | 容器服务 | 函数服务 |
|---------|---------|---------|  
| 路径映射规则 | 路径对应容器内 Web 服务的路由（如 `/api/user`） | 路径对应函数文件路径 + 函数名（如 `/index/main`）或控制台配置的 HTTP 路径 |
| 部署形态 | 完整容器镜像，支持任意语言/框架 | Serverless 函数，仅支持 Node.js/Python |
| 开发模式 | 本地编写 Dockerfile 构建镜像 | 在线编辑器或本地开发后上传 |
| 资源控制 | 可配置 CPU/内存/实例数 | 平台自动分配资源，有执行时长/内存上限 |
| 冷启动 | 实例缩容至 0 时需重新启动 | 毫秒级冷启动 |
| 适用场景 | 复杂业务、完整后端系统 | 简单接口、数据处理、事件触发 |

### 8.2 函数服务

| 特性 | 说明 |
|------|------|
| 运行环境 | Node.js |
| 部署模式 | dev开发环境 / prod生产环境 |
| 调用方式 | 小程序SDK调用 / 域名调用 |
| 日志查看 | 通过控制台查看 |
| 文件限制 | 最多10个文件夹和50个js/ts文件 |
| 配置方式 | 整个服务共用一个package.json |

### 8.3 callContainer 调用方式

#### 写法1：初始化时指定 serviceID（推荐）

```javascript
const cloud = tt.createCloud({
  envID: 'env-xxx',       // 环境ID
  serviceID: 'svc-xxx'    // 服务ID
});

cloud.callContainer({
  path: '/getOpenid',     // 服务内接口路径
  init: { method: 'GET' },
  success: (res) => console.log(res),
  fail: (err) => console.error(err)
});
```

#### 写法2：调用时单独指定 serviceID

```javascript
const cloud = tt.createCloud({
  envID: 'env-xxx'       // 只初始化环境
});

cloud.callContainer({
  serviceID: 'svc-xxx',  // 每次调用明确指定
  path: '/getOpenid',
  init: { method: 'GET' }
});
```

#### 写法3：多服务切换场景

```javascript
const cloud = tt.createCloud({
  envID: 'env-xxx'
});

// 调用服务A
cloud.callContainer({
  serviceID: 'svc-serviceA',
  path: '/api/a'
});

// 调用服务B
cloud.callContainer({
  serviceID: 'svc-serviceB',
  path: '/api/b'
});
```

### 8.4 关键参数说明

#### serviceID（服务标识）

**作用**：定位到具体的云服务

**获取方法**：
1. 打开抖音云控制台 → 进入目标服务
2. 查看浏览器地址栏，找到 `service=svc-xxx` 部分
3. 复制 `svc-xxx` 这串字符

**注意事项**：
- serviceID 是平台生成的唯一随机字符串（格式如 `svc-abcdefg`）
- **不是**服务名（如 quickstart），服务名只是给人看的
- 调用时必须有有效的 serviceID（初始化默认值 或 调用时显式传入）

#### path（接口路径）

**作用**：定位服务内部的具体接口/函数

**规则**：
- 仅用于服务内部路径定位
- **不支持**通过 path 拼接服务名定位服务
- 不包含服务名、域名等外部标识

**两种函数类型的 path 规则**：

| 函数类型 | 创建方式 | path 格式 | 示例 |
|---------|---------|----------|------|
| HTTP 函数 | 控制台快速创建 | 控制台配置的路径 | `/get_open_id` |
| 标准函数 | 文件+导出函数 | `/[文件名]/[导出名]` | `/index/main` |

### 8.5 常见错误与解决方案

| 错误类型 | 失败原因 | 解决方案 |
|---------|---------|---------|
| `path: "/quickstart/get_open_id"` | path 不支持拼接服务名 | path 改为 `/get_open_id`，通过 serviceID 定位服务 |
| 缺少 serviceID | 平台无法识别服务 | 初始化时传入或调用时显式传入 serviceID |
| 路径 404（函数服务） | 函数文件名/导出名与路径不匹配 | 检查控制台配置的函数访问路径 |
| 路径 404（容器服务） | 容器未监听 8080 端口或路由错误 | 检查容器配置和路由定义 |

### 8.6 云数据库

| 操作 | 方法 |
|------|------|
| 查询 | `collection.aggregate()` / `collection.get()` |
| 插入 | `collection.add()` |
| 更新 | `collection.where().update()` |
| 删除 | `collection.where().remove()` |

### 8.7 对象存储

| 操作 | 方法 |
|------|------|
| 上传 | `cloud.uploadFile()` |
| 下载 | `cloud.downloadFile()` |
| 删除 | `cloud.deleteFile()` |

### 8.8 云调用

| 特性 | 说明 |
|------|------|
| 鉴权方式 | 免鉴权，自动获取access_token |
| 调用方式 | `serviceContext.openApiInvoke()` |
| 支持接口 | 内容安全检测、小程序码生成等 |

### 8.9 抖音云函数 vs 微信云函数对比

| 对比维度 | 微信云函数 | 抖音云函数 |
|---------|-----------|-----------|
| 部署单元 | 每个函数独立部署（目录即函数名） | 一个函数服务包含多个函数，统一部署 |
| 配置文件 | 每个函数目录下有独立的 package.json | 整个函数服务共用一个 package.json |
| 入口文件 | 每个函数目录必须有独立的 index.js 入口 | 一个服务内可创建多个 js/ts 文件作为不同入口 |
| 目录结构 | 多函数多目录，相互隔离 | 单服务单目录，可含子文件夹管理代码 |
| 依赖管理 | 函数间依赖需通过公共模块单独部署 | 服务内文件可直接通过 require 引用 |
| 适用场景 | 高度独立、低耦合的函数 | 业务关联紧密的多个函数 |

**设计理念差异**：
- **微信云函数**：强调函数隔离性，适合需要单独维护与扩缩容的场景
- **抖音云函数**：强调服务整体性与开发效率，适合业务关联紧密的场景

---

## 九、开发流程

### 9.1 开发环境部署

1. **开通抖音云服务**
   - 进入开发者工具「抖音云」控制台
   - 申请开通函数服务（白名单）
   - 申请开通云数据库（白名单）

2. **部署函数服务**
   - 点击「新建服务-通过模板一键部署」
   - 选择JavaScript或TypeScript模板
   - 部署成功后获取 `envID` 和 `serviceID`

3. **配置小程序**
   - 修改 `app.js` 中的 `envID` 和 `serviceID`

### 9.2 生产环境发布

1. **复制到prod环境**
   - 在服务详情页点击「发布到生产环境」
   - 仅支持选择已部署到dev的版本

2. **更新小程序配置**
   - 使用prod环境的 `envID` 和 `serviceID`

3. **配置权限**
   - 在「访问控制」添加授权外网访问路径
   - 配置云数据库权限

---

## 十、常见问题与解决方案

### 10.1 错误码对照表

| 错误码 | 说明 | 解决方案 |
|--------|------|----------|
| 10202 | 隐私协议未配置 | 在开发者后台配置隐私协议 |
| 404 | 路径不存在 | 检查云函数路径配置 |
| 500 | 服务器内部错误 | 查看云函数日志排查 |
| route info not found | 路由未配置 | 检查服务访问控制配置 |
| invalid session | session过期 | 重新登录 |

### 10.2 调试技巧

1. **查看云函数日志**
   - 在抖音云控制台进入函数详情页
   - 点击「日志」查看执行日志

2. **本地调试**
   - 使用开发者工具的调试功能
   - 在云函数代码中添加 `context.log()`

3. **真机调试**
   - 确保已配置外网访问权限
   - 使用真机预览功能测试

---

## 十一、学习路径建议

1. **基础阶段**
   - 理解项目结构和配置文件
   - 学习页面路由和生命周期
   - 掌握小程序基础API（tt.showToast, tt.navigateTo等）

2. **进阶阶段**
   - 学习云函数开发模式
   - 掌握云数据库CRUD操作
   - 理解登录态管理机制

3. **高级阶段**
   - 学习云调用能力
   - 掌握文件上传下载
   - 了解dev/prod环境隔离机制

---

---

## 第二部分：抖音小程序核心API详解

## 十二、基础API

### 12.1 环境信息

```javascript
// 获取小程序环境变量
tt.env

// 获取启动参数
const options = tt.getLaunchOptionsSync();
console.log(options.path);        // 打开小程序的路径
console.log(options.query);       // 打开小程序的query参数

// 获取进入小程序的场景参数
const enterOptions = tt.getEnterOptionsSync();
```

### 12.2 定时器

```javascript
// 一次性定时器
const timer = setTimeout(() => {
console.log('执行');
}, 1000);
clearTimeout(timer);

// 周期性定时器
const interval = setInterval(() => {
console.log('执行');
}, 1000);
clearInterval(interval);
```

### 12.3 应用生命周期监听

```javascript
// 监听App启动
tt.onAppLaunch((res) => {
console.log('App Launch:', res);
});

// 监听App显示
tt.onAppShow((res) => {
console.log('App Show:', res);
});

// 监听App隐藏
tt.onAppHide(() => {
console.log('App Hide');
});

// 监听错误
tt.onError((err) => {
console.error('Error:', err);
});
```

---

## 十三、开放接口

### 13.1 用户登录

```javascript
// 登录获取临时凭证
tt.login({
force: true,
success(res) {
    const { code, anonymousCode, isLogin } = res;
    console.log('登录成功:', code);
    // code: 临时登录凭证，有效期3分钟
    // anonymousCode: 设备标识，无论登录与否都会返回
    // isLogin: 判断当前APP是否处于登录状态
},
fail(err) {
    console.error('登录失败:', err);
}
});

// 检查登录状态
tt.checkSession({
success() {
    console.log('登录态有效');
},
fail() {
    console.log('登录态过期，需要重新登录');
}
});
```

### 13.2 获取用户信息

```javascript
// 获取用户信息（需要授权）
tt.getUserInfo({
success(res) {
    console.log('用户信息:', res.userInfo);
},
fail(err) {
    console.error('获取用户信息失败:', err);
}
});

// 新版获取用户信息
tt.getUserProfile({
desc: '用于完善会员资料',
success(res) {
    console.log('用户信息:', res.userInfo);
},
fail(err) {
    console.error('获取用户信息失败:', err);
}
});
```

### 13.3 支付功能

```javascript
// 支付流程
tt.pay({
orderInfo: '支付订单信息',
service: 5,  // 支付服务类型
success(res) {
    tt.showToast({ title: '支付成功' });
},
fail(res) {
    tt.showToast({ title: '支付失败' });
}
});
```

### 13.4 权限授权

```javascript
// 请求授权
tt.authorize({
scope: 'scope.camera',  // 授权范围
success() {
    console.log('授权成功');
},
fail(err) {
    console.error('授权失败:', err);
}
});

// 获取已授权配置
tt.getSetting({
success(res) {
    console.log('授权设置:', res.authSetting);
}
});
```

---

## 十四、网络API

### 14.1 HTTP请求

```javascript
const task = tt.request({
url: 'https://api.example.com/data',
method: 'POST',
data: { name: 'bytedance' },
header: { 'content-type': 'application/json' },
dataType: 'json',
timeout: 60000,
success(res) {
    console.log('请求成功:', res.data);
},
fail(res) {
    console.error('请求失败:', res.errMsg);
},
complete(res) {
    console.log('请求完成');
}
});

// 中断请求
task.abort();
```

### 14.2 文件上传

```javascript
tt.uploadFile({
url: 'https://api.example.com/upload',
filePath: '文件路径',
name: 'file',
formData: { user: 'test' },
success(res) {
    console.log('上传成功:', res.data);
},
fail(err) {
    console.error('上传失败:', err);
}
});
```

### 14.3 文件下载

```javascript
tt.downloadFile({
url: 'https://example.com/file.pdf',
success(res) {
    console.log('下载成功:', res.tempFilePath);
},
fail(err) {
    console.error('下载失败:', err);
}
});
```

### 14.4 WebSocket

```javascript
// 建立连接
const socket = tt.connectSocket({
url: 'wss://api.example.com/ws',
success() {
    console.log('连接成功');
}
});

// 监听事件
socket.onOpen(() => {
console.log('WebSocket连接已打开');
socket.send({ data: 'Hello' });
});

socket.onMessage((res) => {
console.log('收到消息:', res.data);
});

socket.onClose(() => {
console.log('WebSocket连接已关闭');
});

socket.onError((err) => {
console.error('WebSocket错误:', err);
});

// 关闭连接
socket.close();
```

---

## 十五、媒体API

### 15.1 图片操作

```javascript
// 选择图片
tt.chooseImage({
count: 9,
success(res) {
    console.log('选择的图片:', res.tempFilePaths);
}
});

// 预览图片
tt.previewImage({
current: '当前图片路径',
urls: ['图片1', '图片2', '图片3']
});

// 获取图片信息
tt.getImageInfo({
src: '图片路径',
success(res) {
    console.log('图片宽度:', res.width);
    console.log('图片高度:', res.height);
}
});

// 保存图片到相册
tt.saveImageToPhotosAlbum({
filePath: '图片路径',
success() {
    tt.showToast({ title: '保存成功' });
}
});

// 压缩图片
tt.compressImage({
src: '原图路径',
quality: 80,
success(res) {
    console.log('压缩后:', res.tempFilePath);
}
});
```

### 15.2 音频播放

```javascript
// 创建音频上下文
const audio = tt.createInnerAudioContext();
audio.src = '音频地址';
audio.autoplay = true;

// 播放控制
audio.play();
audio.pause();
audio.stop();
audio.seek(10);  // 跳转到第10秒

// 事件监听
audio.onPlay(() => console.log('开始播放'));
audio.onPause(() => console.log('暂停播放'));
audio.onEnded(() => console.log('播放结束'));
audio.onError((err) => console.error('播放错误:', err));

// 销毁音频实例
audio.destroy();
```

### 15.3 背景音频

```javascript
// 获取背景音频管理器（全局唯一）
const bgAudio = tt.getBackgroundAudioManager();
bgAudio.title = '歌曲名称';
bgAudio.singer = '歌手名称';
bgAudio.coverImgUrl = '封面图片';
bgAudio.src = '音频地址';

bgAudio.play();
bgAudio.pause();
bgAudio.stop();
bgAudio.seek(10);
```

### 15.4 视频操作

```javascript
// 创建视频上下文
const videoCtx = tt.createVideoContext('video-id');

videoCtx.play();
videoCtx.pause();
videoCtx.stop();
videoCtx.seek(10);
videoCtx.requestFullScreen();
videoCtx.exitFullScreen();
```

### 15.5 录音功能

```javascript
// 获取录音管理器
const recorder = tt.getRecorderManager();

// 开始录音
recorder.start({
duration: 60000,  // 最长录音时间
sampleRate: 44100,
numberOfChannels: 1,
encodeBitRate: 48000,
format: 'mp3'
});

// 监听录音状态
recorder.onStart(() => console.log('开始录音'));
recorder.onPause(() => console.log('暂停录音'));
recorder.onResume(() => console.log('继续录音'));
recorder.onStop((res) => {
console.log('录音结束:', res.tempFilePath);
});

// 暂停录音
recorder.pause();

// 恢复录音
recorder.resume();

// 停止录音
recorder.stop();
```

### 15.6 相机操作

```javascript
// 创建相机上下文
const cameraCtx = tt.createCameraContext();

// 设置缩放
cameraCtx.setZoom({
zoom: 8,
success(res) {
    console.log('缩放设置:', res.zoom);
}
});

// 拍照
cameraCtx.takePhoto({
quality: 'high',
success(res) {
    console.log('照片路径:', res.tempImagePath);
}
});

// 开始录像
cameraCtx.startRecord({
success() {
    console.log('开始录像');
}
});

// 停止录像
cameraCtx.stopRecord({
success(res) {
    console.log('视频路径:', res.tempVideoPath);
}
});

// 监听相机帧数据
const listener = cameraCtx.onCameraFrame((frame) => {
console.log('帧数据:', frame.data);
});
listener.start();
listener.stop();
```

---

## 十六、数据缓存API

```javascript
// 设置缓存（异步）
tt.setStorage({
key: 'user',
data: { name: '张三' },
success() {
    console.log('缓存设置成功');
}
});

// 设置缓存（同步）
tt.setStorageSync('user', { name: '张三' });

// 获取缓存（异步）
tt.getStorage({
key: 'user',
success(res) {
    console.log('缓存数据:', res.data);
}
});

// 获取缓存（同步）
const user = tt.getStorageSync('user');

// 移除缓存
tt.removeStorage({ key: 'user' });
tt.removeStorageSync('user');

// 清空所有缓存
tt.clearStorage();
tt.clearStorageSync();

// 获取缓存信息
tt.getStorageInfo({
success(res) {
    console.log('缓存键:', res.keys);
    console.log('当前大小:', res.currentSize);
    console.log('限制大小:', res.limitSize);
}
});
```

---

## 十七、位置API

```javascript
// 获取当前位置
tt.getLocation({
type: 'gcj02',  // 坐标系：wgs84/gcj02
isHighAccuracy: true,  // 高精度定位
success(res) {
    console.log('经度:', res.longitude);
    console.log('纬度:', res.latitude);
    console.log('速度:', res.speed);
    console.log('精度:', res.accuracy);
}
});

// 打开地图查看位置
tt.openLocation({
latitude: 39.908860,
longitude: 116.397390,
name: '天安门',
address: '北京市东城区天安门广场'
});

// 选择位置
tt.chooseLocation({
success(res) {
    console.log('选择的位置:', res.name, res.address);
}
});

// 持续定位监听
tt.startLocationUpdate();
tt.onLocationChange((res) => {
console.log('位置变化:', res);
});
tt.stopLocationUpdate();
```

---

## 十八、设备API

### 18.1 系统信息

```javascript
// 获取系统信息（异步）
tt.getSystemInfo({
success(res) {
    console.log('手机型号:', res.model);
    console.log('操作系统:', res.system);
    console.log('屏幕宽度:', res.windowWidth);
    console.log('屏幕高度:', res.windowHeight);
    console.log('像素比:', res.pixelRatio);
}
});

// 获取系统信息（同步）
const sysInfo = tt.getSystemInfoSync();
```

### 18.2 网络状态

```javascript
// 获取网络类型
tt.getNetworkType({
success(res) {
    console.log('网络类型:', res.networkType);  // wifi/4g/3g/2g/unknown/none
}
});

// 监听网络状态变化
tt.onNetworkStatusChange((res) => {
console.log('网络是否连接:', res.isConnected);
console.log('网络类型:', res.networkType);
});
```

### 18.3 传感器

```javascript
// 加速度计
tt.startAccelerometer({
interval: 'game'  // game/ui/normal
});
tt.onAccelerometerChange((res) => {
console.log('X:', res.x, 'Y:', res.y, 'Z:', res.z);
});
tt.stopAccelerometer();

// 罗盘
tt.startCompass();
tt.onCompassChange((res) => {
console.log('方向:', res.direction);
});
tt.stopCompass();
```

### 18.4 设备功能

```javascript
// 扫码
tt.scanCode({
success(res) {
    console.log('扫描结果:', res.result);
}
});

// 振动
tt.vibrateShort();  // 短振动
tt.vibrateLong();   // 长振动

// 打电话
tt.makePhoneCall({
phoneNumber: '10086'
});

// 剪贴板
tt.setClipboardData({ data: 'Hello' });
tt.getClipboardData({
success(res) {
    console.log('剪贴板内容:', res.data);
}
});

// 屏幕常亮
tt.setKeepScreenOn({ keepScreenOn: true });
```

---

## 十九、文件系统API

```javascript
// 获取文件管理器
const fs = tt.getFileSystemManager();

// 读取文件
fs.readFile({
filePath: '文件路径',
encoding: 'utf8',
success(res) {
    console.log('文件内容:', res.data);
}
});

// 写入文件
fs.writeFile({
filePath: '文件路径',
data: 'Hello World',
success() {
    console.log('写入成功');
}
});

// 创建目录
fs.mkdir({
dirPath: '目录路径',
recursive: true,
success() {
    console.log('创建成功');
}
});

// 获取文件信息
fs.getFileInfo({
filePath: '文件路径',
success(res) {
    console.log('文件大小:', res.size);
    console.log('修改时间:', res.lastModifiedTime);
}
});

// 删除文件
fs.unlink({
filePath: '文件路径',
success() {
    console.log('删除成功');
}
});
```

---

## 二十、页面生命周期

```javascript
Page({
data: {
    text: []
},

// 页面加载时触发，只会执行一次
onLoad(options) {
    console.log('页面加载:', options);
},

// 页面初次渲染完成时触发
onReady() {
    console.log('页面渲染完成');
},

// 页面显示时触发（每次打开页面都会执行）
onShow() {
    console.log('页面显示');
},

// 页面隐藏时触发
onHide() {
    console.log('页面隐藏');
},

// 页面卸载时触发
onUnload() {
    console.log('页面卸载');
},

// 页面下拉刷新时触发
onPullDownRefresh() {
    console.log('下拉刷新');
    tt.stopPullDownRefresh();
},

// 页面上拉触底时触发
onReachBottom() {
    console.log('上拉触底');
},

// 页面滚动时触发
onPageScroll(res) {
    console.log('滚动位置:', res.scrollTop);
},

// 页面分享时触发
onShareAppMessage() {
    return {
    title: '分享标题',
    path: '/pages/index/index'
    };
}
});
```

---

## 二十一、页面路由

### 21.1 路由方式对比

| 方法 | 功能 | 是否保留当前页面 | 是否能返回 | 适用场景 |
|------|------|----------------|-----------|---------|
| `tt.navigateTo` | 打开新页面 | 是 | 是 | 层级页面跳转 |
| `tt.navigateBack` | 返回上一页 | - | - | 返回操作 |
| `tt.redirectTo` | 重定向页面 | 否 | 否 | 替换当前页面 |
| `tt.switchTab` | 切换TabBar | - | - | Tab页切换 |
| `tt.reLaunch` | 重启小程序 | 否 | 否 | 首页重启 |

### 21.2 路由示例

```javascript
// 打开新页面（保留当前页面）
tt.navigateTo({
url: '/pages/detail/detail?id=123',
success() {
    console.log('跳转成功');
}
});

// 返回上一页
tt.navigateBack({
delta: 1  // 返回的页数
});

// 重定向（不保留当前页面）
tt.redirectTo({
url: '/pages/login/login'
});

// 切换TabBar
tt.switchTab({
url: '/pages/index/index'
});

// 重启小程序
tt.reLaunch({
url: '/pages/index/index'
});
```

---

## 二十二、UI交互反馈

### 22.1 Toast提示

```javascript
// 基础用法
tt.showToast({
title: '操作成功',
icon: 'success',  // success/loading/none
duration: 2000
});

// 自定义图标
tt.showToast({
title: '自定义图标',
image: '/images/icon.png'
});
```

### 22.2 Modal弹窗

```javascript
// 基础弹窗
tt.showModal({
title: '提示',
content: '确定要删除吗？',
showCancel: true,
success(res) {
    if (res.confirm) {
    console.log('用户点击确定');
    } else if (res.cancel) {
    console.log('用户点击取消');
    }
}
});

// 可输入弹窗
tt.showModal({
title: '输入内容',
editable: true,
placeholderText: '请输入...',
success(res) {
    if (res.confirm) {
    console.log('输入内容:', res.content);
    }
}
});
```

### 22.3 Loading提示

```javascript
// 显示loading
tt.showLoading({
title: '加载中...'
});

// 隐藏loading
tt.hideLoading();
```

---

## 二十三、抖音特殊能力

### 23.1 抖音拍摄器

```javascript
Page({
onShareAppMessage: function() {
return {
    channel: 'video',
    title: '测试分享视频',
    desc: '测试描述',
    extra: {
    videoTopics: ['话题一', '话题二'],  // 抖音话题标签
    },
    success(res) {
    console.log('分享成功:', res);
    },
    fail(res) {
    console.log('分享失败:', res);
    }
};
}
});
```

### 23.2 抖音贴纸

```javascript
Page({
onShareAppMessage: function() {
return {
    channel: 'video',
    title: '测试分享视频',
    extra: {
    sticker_id: "6864836269466191885",  // 贴纸ID
    abortWhenStickIdUnavailable: false
    },
    success(res) {
    console.log('分享成功:', res.videoId);
    console.log('是否使用贴纸:', res.shareWithStickId);
    }
};
}
});
```

---

## 二十四、Canvas绘图

### 24.1 基础Canvas

```javascript
Page({
onReady() {
    // 创建Canvas上下文
    const ctx = tt.createCanvasContext('myCanvas');
    
    // 绘制圆形
    ctx.beginPath();
    ctx.arc(50, 50, 30, 0, Math.PI * 2);
    ctx.setFillStyle('red');
    ctx.fill();
    
    // 绘制矩形
    ctx.setFillStyle('blue');
    ctx.fillRect(100, 20, 40, 40);
    
    // 绘制文字
    ctx.setFontSize(16);
    ctx.setFillStyle('black');
    ctx.fillText('Hello World', 20, 120);
    
    // 绘制路径
    ctx.beginPath();
    ctx.moveTo(20, 150);
    ctx.lineTo(100, 150);
    ctx.lineTo(60, 200);
    ctx.closePath();
    ctx.setStrokeStyle('green');
    ctx.stroke();
    
    // 应用绘制
    ctx.draw();
}
});
```

### 24.2 Native Canvas（2D/WebGL）

```javascript
Page({
onReady() {
    // 获取Canvas节点
    tt.createSelectorQuery()
    .select('#nativeCanvas')
    .node()
    .exec((res) => {
        const canvas = res[0].node;
        const ctx = canvas.getContext('2d');
        
        // 使用requestAnimationFrame绘制
        canvas.requestAnimationFrame(() => {
        ctx.fillStyle = 'red';
        ctx.fillRect(0, 0, 100, 100);
        });
    });
}
});
```

---

## 二十五、性能监控

```javascript
// 创建性能观察者
const observer = tt.performance.createObserver((entryList) => {
entryList.getEntries().forEach((entry) => {
    console.log('性能数据:', entry);
});
});

// 订阅性能指标
observer.observe({ entryTypes: ['measure', 'navigation'] });

// 设置缓冲区大小
tt.performance.setBufferSize(100);

// 获取性能条目
const entries = tt.performance.getEntries();
const namedEntries = tt.performance.getEntriesByName('entryName');
const typedEntries = tt.performance.getEntriesByType('measure');

// 创建自定义性能标记
tt.performance.mark('start');
// ... 执行某些操作
tt.performance.mark('end');
tt.performance.measure('duration', 'start', 'end');
```

---

## 二十六、小程序更新机制

```javascript
// 获取更新管理器
const updateManager = tt.getUpdateManager();

// 监听更新检查
updateManager.onCheckForUpdate((res) => {
if (res.hasUpdate) {
    console.log('有新版本可用');
}
});

// 监听更新准备完成
updateManager.onUpdateReady(() => {
tt.showModal({
    title: '更新提示',
    content: '新版本已下载完成，是否重启应用？',
    success(res) {
    if (res.confirm) {
        updateManager.applyUpdate();
    }
    }
});
});

// 监听更新失败
updateManager.onUpdateFailed(() => {
console.log('更新失败');
});
```

---

## 二十七、最佳实践总结

### 27.1 性能优化

1. **减少不必要的渲染**：合理使用 `setData`，避免频繁更新数据
2. **图片优化**：使用合适尺寸的图片，避免大图加载
3. **懒加载**：列表数据采用分页加载，首屏数据优先
4. **缓存策略**：合理使用 `Storage` 缓存静态数据
5. **避免阻塞**：耗时操作放在后台线程（Worker）执行

### 27.2 用户体验

1. **加载状态**：数据加载时显示 Loading 提示
2. **错误处理**：网络请求失败时给予友好提示
3. **操作反馈**：用户操作后给出明确的 Toast 提示
4. **权限管理**：申请权限时说明用途，尊重用户隐私

### 27.3 安全规范

1. **数据加密**：敏感数据传输使用 HTTPS
2. **输入校验**：对用户输入进行严格校验
3. **权限控制**：按需申请权限，不滥用系统权限
4. **代码安全**：避免 XSS 攻击和代码注入

---

## 二十八、项目开发整体约定

### 28.1 UI组件规范

1. **优先使用抖音小程序内置UI组件**：在实现功能时，优先使用抖音小程序原生组件（如 `view`、`text`、`button`、`input` 等），遵循 TTSS（Tiny TypeScript Style）样式规范。
2. 避免引入第三方UI库，以减少包体积和提升性能。

### 28.2 颜色规范

项目预设颜色如下，开发时优先使用：

| 颜色名称 | 色值 | 用途 |
|---------|------|------|
| blueMain | #0081ff | 主色调-蓝色 |
| blueLight | #cce6ff | 蓝色浅色 |
| orangeMain | #f37b1d | 主色调-橙色 |
| orangeLight | #fde6d2 | 橙色浅色 |
| greenMain | #39b54a | 主色调-绿色 |
| greenLight | #d7f0db | 绿色浅色 |
| redMain | #e54d42 | 主色调-红色 |
| redLight | #fadbd9 | 红色浅色 |

### 28.3 代码风格

1. **命名规范**：
   - 变量和函数使用小驼峰命名（camelCase）
   - 常量使用全大写+下划线（UPPER_SNAKE_CASE）
   - 组件/页面文件使用小写+横杠命名（kebab-case，如 `user-info.js`）
2. **缩进**：使用 2 空格缩进

---

## 第三部分：抖音云数据库集合字段文档

本文档记录了抖音云数据库中所有数据集合及其字段定义，供小程序开发时参考。

### 目录

1. [征集志愿 - collect_volunteer](#1-征集志愿---collect_volunteer)
2. [招生计划 - degree_plans](#2-招生计划---degree_plans)
3. [一分一段表 - degree_score_segments](#3-一分一段表---degree_score_segments)
4. [省控线 - degree_control_lines](#4-省控线---degree_control_lines)
5. [投档线 - degree_admission_lines](#5-投档线---degree_admission_lines)
6. [预告计划 - degree_preview_plans](#6-预告计划---degree_preview_plans)
7. [升本日历 - degree_calendar_events](#7-升本日历---degree_calendar_events)
8. [院校列表 - degree_schools](#8-院校列表---degree_schools)
9. [专业大类 - degree_major_classes](#9-专业大类---degree_major_classes)
10. [专业 - degree_majors](#10-专业---degree_majors)

### 1. 征集志愿 - collect_volunteer

| 字段名 | 类型 | 说明 |
|--------|------|------|
| year | Number | 年份 |
| batch | String | 批次 |
| round | Number | 轮次（默认为0） |
| school_name | String | 学校名称 |
| school_code | String | 学校代码 |
| major_name | String | 专业名称 |
| major_code | String | 专业代码 |
| class_name | String | 专业大类名称 |
| class_code | String | 专业大类代码 |
| plan_count | Number | 计划人数 |
| culture_score | String | 文化课分数线 |
| major_score | String | 专业课分数线 |
| source_url | String | 来源链接 |
| source_title | String | 来源标题 |
| created_at | String (ISO) | 创建时间 |
| updated_at | String (ISO) | 更新时间 |

### 2. 招生计划 - degree_plans

| 字段名 | 类型 | 说明 |
|--------|------|------|
| id | String | 唯一标识 |
| year | Number | 年份 |
| school_id | String | 学校ID |
| school_name | String | 学校名称 |
| class_name | String | 专业大类名称 |
| major_id | String | 专业ID |
| major_name | String | 专业名称 |
| tuition | Number | 学费 |
| total | Number | 招生人数 |
| remarks | String | 备注 |
| full_years | Number | 学制年限 |
| is_true | Boolean | 是否真实计划 |
| major_test | Boolean | 是否需要专业课考试 |
| created_at | String (ISO) | 创建时间 |
| updated_at | String (ISO) | 更新时间 |
| sync_timestamp | String (ISO) | 同步时间戳 |

### 3. 一分一段表 - degree_score_segments

| 字段名 | 类型 | 说明 |
|--------|------|------|
| id | String | 唯一标识 |
| year | Number | 年份 |
| score | Number | 分数 |
| rank | Number | 位次 |
| cumulative_count | Number | 累计人数 |
| class_name | String | 专业大类名称 |
| created_at | String (ISO) | 创建时间 |
| updated_at | String (ISO) | 更新时间 |
| sync_timestamp | String (ISO) | 同步时间戳 |

### 4. 省控线 - degree_control_lines

| 字段名 | 类型 | 说明 |
|--------|------|------|
| id | String | 唯一标识 |
| year | Number | 年份 |
| batch | String | 批次 |
| category | String | 类别（理科/文科等） |
| major_category | String | 专业类别 |
| min_score | Number | 最低控制分数线 |
| source_url | String | 来源链接 |
| created_at | String (ISO) | 创建时间 |
| updated_at | String (ISO) | 更新时间 |
| sync_timestamp | String (ISO) | 同步时间戳 |

### 5. 投档线 - degree_admission_lines

| 字段名 | 类型 | 说明 |
|--------|------|------|
| id | String | 唯一标识 |
| year | Number | 年份 |
| school_id | String | 学校ID |
| school_name | String | 学校名称 |
| batch | String | 批次 |
| category | String | 类别 |
| major_category | String | 专业类别 |
| major_id | String | 专业ID |
| major_name | String | 专业名称 |
| min_score | Number | 最低投档分数线 |
| source_url | String | 来源链接 |
| created_at | String (ISO) | 创建时间 |
| updated_at | String (ISO) | 更新时间 |
| sync_timestamp | String (ISO) | 同步时间戳 |

### 6. 预告计划 - degree_preview_plans

| 字段名 | 类型 | 说明 |
|--------|------|------|
| id | String | 唯一标识 |
| year | Number | 年份 |
| school_id | String | 学校ID |
| school_name | String | 学校名称 |
| major_class_id | String | 专业大类ID |
| major_category | String | 专业类别 |
| major_name | String | 专业名称 |
| full_years | Number | 学制年限 |
| volunteer_order | Number | 志愿顺序 |
| source_url | String | 来源链接 |
| created_at | String (ISO) | 创建时间 |
| updated_at | String (ISO) | 更新时间 |
| sync_timestamp | String (ISO) | 同步时间戳 |

### 7. 升本日历 - degree_calendar_events

| 字段名 | 类型 | 说明 |
|--------|------|------|
| id | String | 唯一标识 |
| name | String | 事件名称 |
| start_datetime | String (ISO) | 开始时间 |
| end_datetime | String (ISO) | 结束时间 |
| content | String | 事件内容/描述 |
| year | Number | 年份 |
| is_forecast | Boolean | 是否为预测事件 |
| event_type | String | 事件类型 |
| show_in_home | Boolean | 是否在首页展示 |
| created_at | String (ISO) | 创建时间 |
| updated_at | String (ISO) | 更新时间 |
| sync_timestamp | String (ISO) | 同步时间戳 |

### 8. 院校列表 - degree_schools

| 字段名 | 类型 | 说明 |
|--------|------|------|
| id | String | 唯一标识 |
| school_name | String | 学校名称 |
| address | String | 学校地址 |
| city | String | 所在城市 |
| city_level | String | 城市级别 |
| contact_phone | String | 联系电话 |
| description | String | 学校描述 |
| former_name | String | 曾用名 |
| level | String | 学校层次 |
| latitude | Number | 纬度 |
| longitude | Number | 经度 |
| logo_url | String | Logo链接 |
| school_url | String | 学校官网链接 |
| created_at | String (ISO) | 创建时间 |
| updated_at | String (ISO) | 更新时间 |
| sync_timestamp | String (ISO) | 同步时间戳 |

### 9. 专业大类 - degree_major_classes

| 字段名 | 类型 | 说明 |
|--------|------|------|
| id | String | 唯一标识 |
| class_name | String | 专业大类名称 |
| major_test | Boolean | 是否需要专业课考试 |
| created_at | String (ISO) | 创建时间 |
| updated_at | String (ISO) | 更新时间 |
| sync_timestamp | String (ISO) | 同步时间戳 |

### 10. 专业 - degree_majors

| 字段名 | 类型 | 说明 |
|--------|------|------|
| id | String | 唯一标识 |
| name | String | 专业名称 |
| major_class_id | String | 所属专业大类ID |
| major_class_name | String | 所属专业大类名称 |
| employment_score | Number | 就业前景评分 |
| salary_score | Number | 薪资水平评分 |
| difficulty_score | Number | 学习难度评分 |
| development_score | Number | 发展前景评分 |
| practicality_score | Number | 实用性评分 |
| created_at | String (ISO) | 创建时间 |
| updated_at | String (ISO) | 更新时间 |
| sync_timestamp | String (ISO) | 同步时间戳 |

### 通用字段说明

#### 时间字段格式
所有时间字段（`created_at`, `updated_at`, `sync_timestamp`）均采用 ISO 8601 格式：
```
YYYY-MM-DDTHH:mm:ss.sssZ
```

#### 字段命名规范
- 使用小写字母和下划线分隔（snake_case）
- 避免使用中文字段名
- 保持与微信云数据库字段一致

### 集合汇总表

| 序号 | 栏目 | 集合名称 |
|------|------|----------|
| 1 | 征集志愿 | `collect_volunteer` |
| 2 | 招生计划 | `degree_plans` |
| 3 | 一分一段表 | `degree_score_segments` |
| 4 | 省控线 | `degree_control_lines` |
| 5 | 投档线 | `degree_admission_lines` |
| 6 | 预告计划 | `degree_preview_plans` |
| 7 | 升本日历 | `degree_calendar_events` |
| 8 | 院校列表 | `degree_schools` |
| 9 | 专业大类 | `degree_major_classes` |
| 10 | 专业 | `degree_majors` |

---

*文档生成时间：2026年5月*
*版本：1.0*
3. **注释**：重要逻辑块添加中文注释说明

### 28.4 API文档查询规范

1. **编写抖音小程序相关代码前，必须先查阅官方文档**
2. 不确定 API 用法时，通过搜索抖音开放平台文档确认后再编写

### 28.5 文件结构

1. 页面文件放在 `pages/` 目录下，每个页面一个独立文件夹
2. 云函数放在 `cloudfunctions/` 目录下
3. 公共样式可提取到 `app.ttss` 或独立样式文件中

### 28.6 Git提交规范

1. 提交信息使用中文描述，格式：`[类型] 简短描述`
   - 类型：新增、修复、优化、删除等
2. 示例：`[新增] 添加用户登录页面` `[优化] 简化首页渲染逻辑`

### 28.7 API请求

1. 所有云函数调用统一封装，便于管理
2. 请求参数和返回数据结构需保持一致

### 28.8 注意事项

- 敏感信息（如密钥、Token）不得硬编码在代码中
- 及时清理无用的注释代码和调试日志

### 28.9 图标使用约定

#### 28.9.1 图标存储位置
- 所有SVG图标统一放置在 `assets/svg/` 目录下
- 原生TabBar图标（仅支持PNG/JPG）放置在 `assets/` 目录下

#### 28.9.2 页面内图标使用方式
- **统一使用 `<image>` 组件直接引用SVG文件**，不使用 `<icon>` 组件和base64编码
- 使用方式：
  ```html
  &lt;image class="de-card-icon-item" src="/assets/svg/更多.svg" mode="aspectFit" /&gt;
  &lt;image class="de-list-arrow" src="/assets/svg/arrow-right.svg" mode="aspectFit" /&gt;
  ```

#### 28.9.3 现有SVG图标清单
| 图标文件 | 用途建议 |
|---------|---------|
| arrow-right.svg | 右箭头/进入列表项 |
| avatar.svg | 头像图标 |
| caution.svg | 警告/提示功能 |
| class.svg | 分类/专业/学科功能 |
| clear.svg | 清除/清理功能 |
| free.svg | 免费/获取功能 |
| logout.svg | 退出登录功能 |
| money.svg | 金钱/积分/余额功能 |
| more.svg | 更多操作/菜单功能 |
| redo.svg | 刷新/重试功能 |
| right.svg | 正确/成功状态 |
| score.svg | 分数/成绩功能 |
| supermanager.svg | 超级管理/管理功能 |
| voice.svg | 语音功能 |
| volume.svg | 音量/音效功能 |

#### 28.9.4 TabBar图标特殊说明
- 抖音小程序原生TabBar**仅支持PNG/JPG格式**，不支持SVG
- TabBar图标必须使用位图格式

---

## 附录：API分类速查表

| 分类 | 主要API |
|------|---------|
| **基础** | `tt.env`, `tt.canIUse`, `tt.exitMiniProgram`, 定时器 |
| **开放接口** | `tt.login`, `tt.getUserInfo`, `tt.pay`, `tt.authorize` |
| **网络** | `tt.request`, `tt.uploadFile`, `tt.downloadFile`, WebSocket |
| **媒体** | `tt.chooseImage`, `tt.createInnerAudioContext`, `tt.createVideoContext`, 录音、相机 |
| **地图** | `tt.createMapContext`, `tt.getLocation`, `tt.openLocation` |
| **文件** | `tt.getFileSystemManager`, 文件读写操作 |
| **缓存** | `tt.setStorage`, `tt.getStorage`, `tt.clearStorage` |
| **设备** | `tt.getSystemInfo`, `tt.getNetworkType`, 传感器、扫码 |
| **界面** | `tt.showToast`, `tt.showModal`, `tt.showLoading` |
| **路由** | `tt.navigateTo`, `tt.redirectTo`, `tt.switchTab` |

---

## 参考文档

- [抖音云函数开发指南](https://developer.open-douyin.com/docs/resource/zh-CN/developer/tools/cloud/guide/cloud-function-service-manage/cloud-function-guide)
- [云数据库服务端SDK](https://developer.open-douyin.com/docs/resource/zh-CN/developer/tools/cloud/develop-guide/cloud-database/server/guide)
- [云数据库客户端SDK](https://developer.open-douyin.com/docs/resource/zh-CN/developer/tools/cloud/develop-guide/cloud-database/client/guide)
- [内容安全检测API](https://developer.open-douyin.com/docs/resource/zh-CN/mini-app/develop/server/content-security/content-security-detect)

---

> 本文档整合了抖音云开发实战、抖音小程序核心API和项目开发约定三大模块，涵盖了抖音小程序开发的完整知识体系和规范标准。
