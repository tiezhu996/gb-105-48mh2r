# 二次元集市 · 动漫周边二手交易平台

全栈实践项目：注册登录后发布闲置动漫周边（照片、物品名、所属 IP、角色、新旧程度、价格、交换意向），
首页按 IP/角色/物品名搜索、按手办·吧唧·卡牌等品类筛选、商品卡片瀑布流浏览；
详情页可立即购买或发起交换；订单严格按身份与状态推进（交换确认 → 发货 → 收货 → 互评），
同一商品同一时间只允许一个进行中的交易，重复/并发请求不会产生冲突订单。

## 技术栈

- 前端：React 18 + TypeScript + Vite + Tailwind CSS + Zustand + React Router
- 后端：Express + better-sqlite3 + JWT + bcrypt
- 数据库：SQLite（`data/anime-market.db`，首次启动自动建表）

## 启动方式

```bash
npm install
npm run dev        # 同时启动前后端（concurrently）
```

- 前端：http://localhost:8201
- 后端：http://localhost:8202

也可以分开启动：

```bash
npm run client:dev   # Vite, 8201, /api 代理到 8202
npm run server:dev   # Express + tsx watch, 8202
```

## 交易状态机

```
购买：  active ──下单──▶ pending(待发货) ──卖家发货──▶ shipped ──买家收货──▶ completed
交换：  active ──发起交换(含交换方案)──▶ exchanging ──卖家接受──▶ pending ──发货──▶ shipped ──▶ completed
取消：  exchanging / pending ──任一方取消/拒绝──▶ cancelled（商品自动重新上架）
完成后：买卖双方各可评价对方一次，评分聚合展示在个人主页
```

并发安全由三层保证：

1. 下单在数据库事务内执行，并对商品行做 `active → reserved` 条件更新（抢占锁）；
2. 部分唯一索引保证每个商品最多存在一条进行中订单；
3. 所有状态流转都校验操作身份与当前状态，重复请求幂等拒绝。
