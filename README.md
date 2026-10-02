# GameOps Kit｜游戏运营分析与复盘工作台

一个可放进 GitHub 作品集的通用游戏运营项目：导入事件数据，查看活跃与留存，按版本/渠道/设备定位问题，标注运营动作，导出复盘。示例包含两类虚构小游戏，使用同一套分析流程。

## 快速运行

需要 Node.js 18 或更新版本。无第三方依赖，无需 `npm install`。

```bash
npm start
```

浏览器打开 `http://127.0.0.1:4173`。测试运行：

```bash
npm test
```

## 功能

- 两套由固定随机种子生成的模拟数据：关卡型小游戏、休闲街机小游戏。
- 区间新增、DAU、D1/D7 留存、收入与关键流程漏斗。
- 渠道、设备、版本筛选和人群对比。
- 本地导入 CSV，映射字段后计算同一套指标；文件不会上传服务器。
- 记录运营动作，在活跃趋势中查看节点；标注保存在当前浏览器。
- 填写发现、假设、行动和结论，导出 Markdown 复盘。

## CSV 数据格式

必填字段：`game_id`、`player_id`、`event_date`、`event_name`。导入界面可将自己的列名映射到这些字段。`event_date` 使用 `YYYY-MM-DD`；活跃与留存依赖 `session_start` 事件。

可选字段：`channel`、`platform`、`version`、`stage`、`revenue_type`、`revenue`。收入使用同一币种、非负数。建议包含 `install` 事件；缺失时以玩家首次事件日期近似安装日期。

```csv
game_id,player_id,event_date,event_name,channel,platform,version,stage,revenue_type,revenue
demo,p001,2026-09-01,install,organic,Android,1.0,,,0
demo,p001,2026-09-01,session_start,organic,Android,1.0,,,0
demo,p001,2026-09-02,session_start,organic,Android,1.0,,,0
```

CSV 上限 10 MB。导入数据只在页面内存中处理，刷新后恢复示例数据；运营动作保存在当前浏览器的本地存储。请勿把公司真实玩家数据、密钥或内部报表提交到公开仓库。

## 指标与案例

- [指标口径](docs/metrics.md)
- [关卡型小游戏案例](docs/case-study.md)

## 项目结构

```text
gameops-kit/
├── index.html          # 页面结构
├── styles.css          # 响应式样式
├── src/core.js         # CSV、指标、分群、漏斗
├── src/sample-data.js  # 可复现模拟数据
├── src/app.js          # 页面交互与复盘导出
├── tests/              # 核心指标测试
├── docs/               # 口径、案例、界面截图
└── server.js           # 本地静态服务
```

## 后续路线

第一版聚焦分析和复盘。后续可增加自定义事件漏斗、周报模板、多币种处理和真实数据源适配。活动结果的因果评估需要额外的实验设计与数据采集。

## 许可

MIT。示例数据和游戏名称均为虚构。
