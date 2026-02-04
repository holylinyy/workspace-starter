import { resolve } from 'node:path';
import { readFileSync, existsSync } from 'node:fs';

import nodeResolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import typescript from '@rollup/plugin-typescript';
import json from '@rollup/plugin-json';
import terser from '@rollup/plugin-terser';
import dts from 'rollup-plugin-dts';
import babel from '@rollup/plugin-babel';
import filesize from 'rollup-plugin-filesize';
import { updateReadmePlugin } from './plugins/update-readme.js';

/**
 * 获取包的 package.json
 * @param {string} packageDir 包目录路径
 * @returns {object} package.json 内容
 */
function getPackageJson(packageDir) {
  const pkgPath = resolve(packageDir, 'package.json');
  if (!existsSync(pkgPath)) {
    throw new Error(`package.json not found in ${packageDir}`);
  }
  return JSON.parse(readFileSync(pkgPath, 'utf-8'));
}

/**
 * 获取 tsconfig 路径
 * @param {string} packageDir 包目录路径
 * @returns {string} tsconfig 文件路径
 */
function getTsConfigPath(packageDir) {
  // 优先使用包内的 tsconfig.build.json
  const buildTsConfig = resolve(packageDir, 'tsconfig.build.json');
  if (existsSync(buildTsConfig)) {
    return buildTsConfig;
  }

  // 其次使用包内的 tsconfig.json
  const pkgTsConfig = resolve(packageDir, 'tsconfig.json');
  if (existsSync(pkgTsConfig)) {
    return pkgTsConfig;
  }

  // 最后使用根目录的 tsconfig.json
  return resolve(packageDir, '../../tsconfig.json');
}

/**
 * 创建 Rollup 配置
 * @param {object} options 配置选项
 * @param {string} options.packageDir 包目录路径（必需）
 * @param {string} [options.input] 入口文件，默认 'src/index.ts'
 * @param {string} [options.outputDir] 输出目录，默认 'dist'
 * @param {string[]} [options.formats] 输出格式，默认 ['esm', 'cjs']
 * @param {boolean} [options.sourcemap] 是否生成 sourcemap，默认 true
 * @param {boolean} [options.minify] 是否压缩，默认 true
 * @param {boolean} [options.dts] 是否生成类型声明，默认 true
 * @param {boolean} [options.babel] 是否启用 Babel 转译，默认 true
 * @param {string[]} [options.browserslist] 自定义 browserslist 配置
 * @param {string[]} [options.external] 额外的外部依赖
 * @param {object} [options.globals] UMD 模式下的全局变量映射
 * @param {string} [options.name] UMD 模式下的全局变量名
 * @param {object} [options.tsconfig] 额外的 TypeScript 编译选项
 * @returns {import('rollup').RollupOptions[]} Rollup 配置数组
 */
export function createConfig(options) {
  const {
    packageDir,
    input = 'src/index.ts',
    outputDir = 'dist',
    formats = ['esm', 'cjs'],
    sourcemap = true,
    minify = true,
    dts: generateDts = true,
    babel: enableBabel = true,
    browserslist,
    external: additionalExternal = [],
    globals = {},
    name,
    tsconfig: additionalTsConfig = {}
  } = options;

  if (!packageDir) {
    throw new Error('packageDir is required');
  }

  const pkg = getPackageJson(packageDir);
  const tsConfigPath = getTsConfigPath(packageDir);

  // 入口文件完整路径
  const inputPath = resolve(packageDir, input);

  // 输出目录完整路径
  const outputPath = resolve(packageDir, outputDir);

  // 外部依赖：dependencies + peerDependencies + 额外指定的
  const externalDeps = [
    ...Object.keys(pkg.dependencies || {}),
    ...Object.keys(pkg.peerDependencies || {}),
    ...additionalExternal
  ];

  // 外部依赖判断函数
  const isExternal = (id) => {
    if (id.startsWith('.') || id.startsWith('/') || /^[a-zA-Z]:/.test(id)) {
      return false;
    }
    return externalDeps.some((dep) => id === dep || id.startsWith(`${dep}/`));
  };

  // 基础插件
  const basePlugins = [
    nodeResolve({
      extensions: ['.ts', '.tsx', '.js', '.jsx', '.json']
    }),
    commonjs(),
    json(),
    typescript({
      tsconfig: tsConfigPath,
      declaration: false,
      declarationMap: false,
      sourceMap: sourcemap,
      compilerOptions: {
        target: 'ESNext', // 让 Babel 处理语法降级
        outDir: outputPath,
        rootDir: resolve(packageDir, 'src'),
        ...additionalTsConfig
      }
    }),
    enableBabel &&
      babel({
        babelHelpers: 'bundled',
        extensions: ['.ts', '.tsx', '.js', '.jsx'],
        exclude: 'node_modules/**',
        presets: [
          [
            '@babel/preset-env',
            {
              targets: browserslist,
              modules: false,
              useBuiltIns: false
            }
          ]
        ]
      })
  ].filter(Boolean);

  // 压缩插件
  const minifyPlugin = minify
    ? terser({
        compress: {
          ecma: 2018,
          pure_getters: true
        },
        format: {
          ecma: 2018
        }
      })
    : null;

  const configs = [];

  // 生成各种格式的输出配置
  formats.forEach((format) => {
    const outputConfig = {
      dir: outputPath,
      format,
      sourcemap,
      preserveModules: format !== 'umd' && format !== 'iife',
      preserveModulesRoot: resolve(packageDir, 'src'),
      exports: 'named'
    };

    // 根据格式设置文件扩展名
    if (format === 'esm' || format === 'es') {
      outputConfig.entryFileNames = '[name].mjs';
      outputConfig.chunkFileNames = '[name]-[hash].mjs';
    } else if (format === 'cjs') {
      outputConfig.entryFileNames = '[name].cjs';
      outputConfig.chunkFileNames = '[name]-[hash].cjs';
    } else if (format === 'umd' || format === 'iife') {
      outputConfig.preserveModules = false;
      outputConfig.entryFileNames = undefined;
      outputConfig.chunkFileNames = undefined;
      outputConfig.file = resolve(outputPath, `index.${format === 'umd' ? 'umd' : 'iife'}.js`);
      delete outputConfig.dir;
      outputConfig.name = name || toPascalCase(pkg.name.replace(/^@.*\//, ''));
      outputConfig.globals = globals;
    }

    configs.push({
      input: inputPath,
      output: outputConfig,
      external: isExternal,
      plugins: [
        ...basePlugins,
        minifyPlugin,
        filesize({
          showMinifiedSize: false,
          showGzippedSize: false,
          reporter: (opt, bundle, { bundleSize, fileName }) => {
            return `${fileName}: ${bundleSize}`;
          }
        }),
        (format === 'esm' || format === 'es') &&
          !process.env.ROLLUP_WATCH &&
          updateReadmePlugin(packageDir)
      ].filter(Boolean)
    });
  });

  // 生成类型声明文件
  if (generateDts) {
    configs.push({
      input: inputPath,
      output: {
        file: resolve(outputPath, 'index.d.ts'),
        format: 'esm'
      },
      external: isExternal,
      plugins: [
        dts({
          tsconfig: tsConfigPath,
          compilerOptions: {
            preserveSymlinks: false
          }
        })
      ]
    });
  }

  return configs;
}

/**
 * 将字符串转换为 PascalCase
 * @param {string} str 输入字符串
 * @returns {string} PascalCase 字符串
 */
function toPascalCase(str) {
  return str
    .replace(/[-_](.)/g, (_, c) => c.toUpperCase())
    .replace(/^(.)/, (_, c) => c.toUpperCase());
}

/**
 * 创建简单配置（单一输出）
 * @param {object} options 配置选项
 * @returns {import('rollup').RollupOptions} 单个 Rollup 配置
 */
export function createSimpleConfig(options) {
  const configs = createConfig({
    ...options,
    formats: [options.format || 'esm'],
    dts: false
  });
  return configs[0];
}

export default createConfig;
