# 二次元集市 · 动漫周边二手交易平台

全栈的动漫周边闲置交易应用：注册登录 → 发布闲置（照片、物品名、IP、角色、新旧程度、价格、交换意向）→ 首页瀑布流浏览与搜索筛选 → 立即购买 / 发起交换 → 卖家确认/发货 → 买家收货 → 双方互评，评价展示在个人主页。

## 技术栈

- 前端：React 18 + TypeScript + Vite + Tailwind CSS + Zustand + React Router + axios
- 后端：Express + TypeScript（tsx 运行）+ better-sqlite3 + JWT + bcryptjs
- 数据库：SQLite（`data/anime-market.db`，WAL 模式，启动时自动建表/迁移）

## 启动方式

```bash
npm install
npm run dev
```

- 前端：http://localhost:8201（Vite，`/api` 代理到后端）
- 后端：http://localhost:8202

也可分别启动：`npm run client:dev` / `npm run server:dev`（nodemon 热重载）。

其他脚本：

- `npm run build` 类型检查 + 生产构建
- `npm run check` 仅 TypeScript 检查
- `npm run lint` ESLint

> better-sqlite3 使用本机预编译二进制；Node 20（arm64）请使用 `better-sqlite3@11.x`（12.x 不再提供该组合的预编译包）。

## 交易状态机

每个商品在数据库层有部分唯一索引保证**最多只有一个进行中的交易**，所有状态流转都在事务内用条件 UPDATE 完成，重复点击/并发请求不会产生冲突订单。

```
买家下单(buy)                 ──▶ pending ──卖家发货──▶ shipped ──买家收货──▶ completed
买家发起交换(exchange)        ──▶ exchange_pending
                                   ├─ 卖家接受 ──▶ pending（同上）
                                   ├─ 卖家拒绝 ──▶ rejected（商品重新上架）
                                   ├─ 卖家/买家取消 ─▶ cancelled（商品重新上架）
pending 阶段买家可取消 ────────▶ cancelled（商品重新上架）
completed 后买卖双方各可评价对方一次
```

商品状态：`active` 在售（首页可见）→ `reserved` 交易中（首页隐藏、不可再下单）→ `sold` 已售出；卖家也可在无进行中交易时手动 `offline` 下架 / 重新上架。

## 权限与一致性

- 发货仅卖家、收货仅买家、接受/拒绝交换仅卖家、取消按状态限定身份
- 评价仅交易参与者、且只能评价对方，同一订单每人只能评一次（DB 唯一索引兜底）
- 所有二次操作都做状态校验，非法跳转返回 400/403/409

## 主要 API

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| POST | `/api/auth/register` `/login` `/logout` | 注册/登录/登出 |
| GET | `/api/auth/profile` `/api/auth/user/:id` | 本人资料 / 公开主页信息 |
| GET | `/api/products` | 列表，参数 `search`（IP/角色/商品名）、`category`、`ip`、`character` |
| GET | `/api/products/:id` | 详情，附带进行中订单摘要与 `is_owner` |
| POST | `/api/products` | 发布（1–6 张 base64 照片） |
| GET | `/api/products/user/my` `/seller/:userId` | 我的发布 / 某卖家的发布 |
| PUT | `/api/products/:id/status` | 上架/下架 |
| POST | `/api/orders` | 创建交易 `type: buy|exchange`（可带 `exchange_offer`） |
| PUT | `/api/orders/:id/accept` `/reject` `/cancel` `/ship` `/receive` | 状态推进 |
| GET | `/api/orders/buyer` `/seller` `/product/:pid/mine` `/:id` | 订单查询 |
| POST | `/api/reviews` | 评价（rating 1–5 + comment） |
| GET | `/api/reviews/user/:userId` `/by-orders?ids=` `/order/:id` | 收到的评价/批量查询本人评价 |

## 页面

- `/` 首页：搜索框（IP/角色/商品名，防抖）+ 品类筛选（手办/吧唧/卡牌/海报/漫画/服饰/其他）+ 商品卡片瀑布流
- `/product/:id` 详情：照片轮播、描述、标价、交换意向、卖家信息；底部操作栏按身份与交易状态动态渲染
- `/publish` 发布闲置
- `/profile` 个人中心：我买到的 / 我卖出的 / 我的发布 三个 Tab，含发货、收货、接受/拒绝交换、取消、评价、上下架
- `/user/:id` 公开个人主页：收到的评价（星级+内容+对应交易商品）与 TA 的发布
