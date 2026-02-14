import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/server.ts'],
  format: ['cjs', 'esm'],
  // DTS（.d.ts 类型声明文件）已禁用
  // 原因：本项目是 MCP 可执行服务器，不是供第三方 import 的 npm 库，无需生成类型声明
  // DTS 构建会在 Worker 线程中启动完整的 TypeScript 编译器，
  // 对 ~10k 行源码 + 189MB node_modules 进行类型解析，峰值内存需 800MB-1.2GB，
  // 在低内存环境（如 CI 或开发虚拟机）中容易触发 OOM
  // 如需恢复，设置 dts: true 并确保 Node.js 堆内存 >= 2GB:
  //   NODE_OPTIONS='--max-old-space-size=2048' yarn build
  dts: false,
  clean: true,
  outDir: "lib",
  sourcemap: true,
  target: 'node16',
});