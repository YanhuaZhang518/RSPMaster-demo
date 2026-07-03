# 石头剪刀布 · 卡牌对战 Demo

> 1V1 快节奏联机卡牌对战 Demo — Vite + React + TypeScript + Firebase Realtime Database

---

## 游戏规则速览

| 项目 | 说明 |
|------|------|
| 初始生命 | 5 点 |
| 每回合时长 | 5 秒 |
| 猜拳胜利伤害 | 1 点 |
| 碎卡极速猜拳 | 1.5 秒，仅能出拳 |

### 卡牌一览

| 卡牌 | 效果 |
|------|------|
| 白1【重拳】 | 猜拳胜利 → 额外 +1 伤害 |
| 白2【格挡】 | 本回合受到的伤害 -1（最低 0）|
| 白3【反击】 | 猜拳失败 → 对方也受 1 点伤害 |
| 蓝1【封印】 | 使对方本回合卡牌失效 |
| 蓝2【迷惑】 | 结算时随机修改对方本回合的猜拳选择 |
| 紫1【规则逆转】 | 本回合克制关系完全反转 |

### 碎卡条件

双方使用**同色 + 同等级**卡牌时触发碎卡：
- 双方卡牌效果均无效
- 进入 1.5 秒极速猜拳（不可使用卡牌）
- 极速猜拳胜者造成 1 点伤害

---

## 技术栈

- **前端**：Vite 6 + React 19 + TypeScript 5
- **实时同步**：Firebase Realtime Database
- **路由**：React Router v7
- **部署**：Vercel（一键部署）

---

## 第一步：安装依赖

```bash
cd rockscissorpapper
npm install
```

---

## 第二步：配置 Firebase

### 2.1 创建 Firebase 项目

1. 打开 [Firebase Console](https://console.firebase.google.com/)
2. 点击"**添加项目**"，填写项目名称（如 `rps-card-battle`）
3. 可关闭 Google Analytics，点击"**创建项目**"

### 2.2 启用 Realtime Database

1. 左侧菜单 → **构建** → **Realtime Database**
2. 点击"**创建数据库**"
3. 选择位置（推荐**新加坡** `asia-southeast1`，延迟低）
4. 模式选择"**以测试模式启动**"（30 天内任何人可读写，Demo 用）
5. 点击"**启用**"

> ⚠️ 正式上线前请在 Firebase Console → Realtime Database → 规则 中设置更严格的安全规则。

### 2.3 获取 Firebase 配置

1. Firebase Console → 项目设置（左上角⚙️图标）
2. 向下滚动到"**您的应用**"区域
3. 点击"**</> Web**"图标注册 Web 应用
4. 填写应用名称（如 `rps-web`），**不需要勾选 Firebase Hosting**
5. 复制显示的 `firebaseConfig` 对象中的各项值

### 2.4 创建环境变量文件

在项目根目录创建 `.env.local` 文件（**不要提交到 Git**）：

```env
VITE_FIREBASE_API_KEY=AIzaSy...
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_DATABASE_URL=https://your-project-default-rtdb.asia-southeast1.firebasedatabase.app
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abc123
```

> **重点**：`VITE_FIREBASE_DATABASE_URL` 要填 Realtime Database 的 URL（不是 Firestore），
> 格式类似 `https://xxx-default-rtdb.firebaseio.com` 或 `https://xxx-default-rtdb.asia-southeast1.firebasedatabase.app`

---

## 第三步：本地运行

```bash
npm run dev
```

浏览器打开 [http://localhost:5173](http://localhost:5173)

---

## 第四步：本地测试双人联机

1. 在浏览器 A 打开 `http://localhost:5173`，输入昵称，点击"**创建房间**"
2. 复制页面上显示的**房间链接**
3. 在浏览器 B（或无痕窗口）打开该链接，输入不同昵称，自动加入房间
4. 浏览器 A 点击"**开始游戏**"
5. 两个窗口同时对战！

---

## 第五步：部署到 Vercel

### 5.1 推送到 GitHub

```bash
git add .
git commit -m "init: rps card battle demo"
git remote add origin https://github.com/你的用户名/rps-card-battle.git
git push -u origin main
```

### 5.2 在 Vercel 上导入项目

1. 打开 [vercel.com](https://vercel.com)，用 GitHub 账号登录
2. 点击"**Add New Project**"→ 选择刚推送的仓库
3. Framework Preset 会自动识别为 **Vite**，无需修改
4. 展开"**Environment Variables**"，把 `.env.local` 里的所有变量逐一填入
5. 点击"**Deploy**"

部署完成后 Vercel 会给你一个 `https://xxx.vercel.app` 的链接。

### 5.3 发给朋友测试

1. 打开你的 Vercel 链接
2. 创建房间，复制房间链接（如 `https://xxx.vercel.app/room/AB1234`）
3. 把链接发给朋友
4. 朋友点开链接自动进入房间
5. 房主点击"开始游戏"，开始 1V1 对战！

---

## 项目结构

```
src/
├── components/
│   ├── HomePage.tsx      # 首页：创建/加入房间
│   ├── RoomPage.tsx      # 房间等待页
│   ├── BattlePage.tsx    # 对战页（出拳 + 卡牌）
│   ├── ResultModal.tsx   # 回合结算弹窗
│   ├── EndPage.tsx       # 游戏结束页
│   └── Layout.tsx        # 通用布局
├── data/
│   └── cards.ts          # 卡牌定义 & 工具函数
├── hooks/
│   ├── useRoom.ts        # Firebase 实时订阅
│   └── useCountdown.ts   # 倒计时 Hook
├── services/
│   └── roomService.ts    # Firebase 读写操作
├── types/
│   └── game.ts           # TypeScript 类型定义
├── utils/
│   ├── gameLogic.ts      # 游戏核心逻辑（纯函数）
│   └── storage.ts        # localStorage 工具
├── firebase.ts           # Firebase 初始化
├── App.tsx               # 路由
├── main.tsx              # 入口
└── index.css             # 全局样式
```

---

## 数据库结构

```
rooms/{roomId}
  ├── status          "waiting" | "playing" | "clash" | "result" | "finished"
  ├── hostId          string
  ├── round           number
  ├── timerEndsAt     timestamp (ms)
  ├── winner          "player1" | "player2" | null
  ├── lastResult      RoundResult | null
  ├── clashMode
  │   ├── active      boolean
  │   └── timerEndsAt timestamp (ms)
  └── players
      ├── player1
      │   ├── id, name, hp
      │   ├── handCards       HandCard[]
      │   ├── selectedMove    "rock" | "scissors" | "paper" | null
      │   ├── selectedCardId  string | null
      │   ├── locked          boolean
      │   ├── clashMove       Move | null
      │   └── clashLocked     boolean
      └── player2 (同上)
```

---

## 刷新重连机制

- 玩家 ID 和房间 ID 保存在 `localStorage`
- 刷新页面后自动恢复身份，重新加入当前房间
- 不依赖登录账号，只需同一浏览器即可

---

## 后续扩展方向

- [ ] 更多卡牌（目前 6 张）
- [ ] 卡牌动画效果
- [ ] 玩家昵称头像
- [ ] 音效
- [ ] 房间密码
- [ ] 观战模式（spectator）
- [ ] Firebase Security Rules 加固
- [ ] 持久化账号 & 战绩系统
