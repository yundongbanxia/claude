# 生化危机4 重制版 · 村庄篇（同人复刻）

浏览器里的越肩视角动作恐怖游戏，复刻《生化危机4 重制版》村庄章节的玩法与节奏。
所有模型、贴图、声音都由代码实时生成，整个游戏打包成**一个 HTML 文件**，下载后双击即可离线游玩。

> 开发中。完整说明将在发布版本中补充。

## 开发

```bash
npm install
npm run dev        # 本地开发 http://localhost:5173
npm run build      # 生成 dist/index.html（单文件）
npm run release    # 构建并复制到 release/RE4-Village.html
npm test           # 单元测试
npm run e2e        # 浏览器冒烟测试（需先 build）
```

调试参数：`?area=test&enemies=3` 直接进入测试场地，`?debug=god` 无敌 + 帧率显示。
