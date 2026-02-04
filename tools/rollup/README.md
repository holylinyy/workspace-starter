# @uikit/rollup-config

UIKit Monorepo 标准 Rollup 打包工具。

## 特性

- ✅ 支持 TypeScript
- ✅ 自动生成 sourcemap
- ✅ 语法降级（默认降级到 ES2018，兼容大部分现代浏览器）
- ✅ 自动生成类型声明文件（`.d.ts`）
- ✅ 支持多种输出格式（ESM、CJS、UMD、IIFE）
- ✅ 自动识别外部依赖（dependencies + peerDependencies）
- ✅ 支持代码压缩
- ✅ 保留模块结构（tree-shaking 友好）

## 安装

在根目录的 `pnpm-workspace.yaml` 中已包含 tools 目录，子包可直接使用：

```yaml
packages:
  - 'packages/*'
  - 'tools/*'
```

## 使用方法

### 1. 在子包中创建 `rollup.config.js`

```js
import { createConfig } from '@uikit/rollup-config';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default createConfig({
  packageDir: __dirname
});
```

### 2. 在子包的 `package.json` 中配置

```json
{
  "name": "@uikit/your-package",
  "type": "module",
  "main": "dist/index.cjs",
  "module": "dist/index.mjs",
  "types": "dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.mjs",
      "require": "./dist/index.cjs",
      "types": "./dist/index.d.ts"
    }
  },
  "files": ["dist"],
  "scripts": {
    "build": "rollup -c",
    "clean": "rimraf dist"
  },
  "devDependencies": {
    "@uikit/rollup-config": "workspace:*",
    "rollup": "^4.28.0"
  }
}
```

### 3. 创建 `tsconfig.build.json`（可选）

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "rootDir": "src",
    "outDir": "dist"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "**/*.test.ts", "**/*.spec.ts"]
}
```

## 配置选项

| 选项         | 类型       | 默认值           | 说明                                  |
| ------------ | ---------- | ---------------- | ------------------------------------- |
| `packageDir` | `string`   | -                | **必需**，包目录路径                  |
| `input`      | `string`   | `'src/index.ts'` | 入口文件                              |
| `outputDir`  | `string`   | `'dist'`         | 输出目录                              |
| `formats`    | `string[]` | `['esm', 'cjs']` | 输出格式：`esm`、`cjs`、`umd`、`iife` |
| `sourcemap`  | `boolean`  | `true`           | 是否生成 sourcemap                    |
| `minify`     | `boolean`  | `true`           | 是否压缩代码                          |
| `dts`        | `boolean`  | `true`           | 是否生成类型声明                      |
| `target`     | `string`   | `'ES2018'`       | 语法降级目标                          |
| `external`   | `string[]` | `[]`             | 额外的外部依赖                        |
| `globals`    | `object`   | `{}`             | UMD 模式下的全局变量映射              |
| `name`       | `string`   | -                | UMD 模式下的全局变量名                |
| `tsconfig`   | `object`   | `{}`             | 额外的 TypeScript 编译选项            |

## 高级配置示例

### 输出 UMD 格式（用于 CDN）

```js
export default createConfig({
  packageDir: __dirname,
  formats: ['esm', 'cjs', 'umd'],
  name: 'MyLibrary',
  globals: {
    lodash: '_',
    axios: 'axios'
  }
});
```

### 自定义语法降级目标

```js
export default createConfig({
  packageDir: __dirname,
  target: 'ES2020' // 或 'ES5' 以获得更广泛的兼容性
});
```

### 禁用压缩（开发调试）

```js
export default createConfig({
  packageDir: __dirname,
  minify: false
});
```

### 多入口打包

```js
import { createConfig } from '@uikit/rollup-config';

// 为每个入口创建单独的配置
const mainConfig = createConfig({
  packageDir: __dirname,
  input: 'src/index.ts'
});

const utilsConfig = createConfig({
  packageDir: __dirname,
  input: 'src/utils/index.ts',
  outputDir: 'dist/utils',
  dts: false
});

export default [...mainConfig, ...utilsConfig];
```

## 输出结构

使用默认配置时，输出目录结构如下：

```
dist/
├── index.mjs        # ESM 格式
├── index.cjs        # CJS 格式
├── index.d.ts       # 类型声明
└── index.mjs.map    # sourcemap（如果启用）
```
