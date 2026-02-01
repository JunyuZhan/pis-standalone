# PIS JSDoc 注释规范

本文档基于 [JSDoc 官方文档](https://jsdoc.app/) 和 [Google JavaScript Style Guide](https://google.github.io/styleguide/jsguide.html) 制定。

## 基本格式

### JSDoc 块注释

```typescript
/**
 * 简短描述（一行）
 *
 * 详细描述（多行，可选）
 * @param {Type} paramName 参数说明
 * @returns {Type} 返回值说明
 */
```

### 单行注释

```typescript
/** @const {Type} 简短描述的常量 */
```

## 文件头注释

```typescript
/**
 * @fileoverview 文件用途描述
 *
 * @description 更详细的模块说明
 * @module moduleName
 */
```

## 函数注释

```typescript
/**
 * 函数简短描述
 *
 * @param {string} param1 参数1说明
 * @param {number} param2 参数2说明
 * @returns {boolean} 返回值说明
 *
 * @example
 * ```typescript
 * const result = functionName('value', 123)
 * ```
 */
export function functionName(param1: string, param2: number): boolean {
  // ...
}
```

## 接口/类型注释

```typescript
/**
 * 接口描述
 * @interface
 */
export interface User {
  /** 属性描述 */
  id: string
  /** 邮箱地址 */
  email: string
}
```

## 类注释

```typescript
/**
 * 类描述
 * @class
 * @template T
 * @implements {InterfaceName}
 */
export class MyClass {
  /**
   * 方法描述
   * @param {Type} param 参数说明
   * @returns {Type} 返回值说明
   */
  myMethod(param: Type): Type {
    // ...
  }
}
```

## TypeScript 特有注释

由于项目使用 TypeScript，以下标签需要注意：

| 标签 | 说明 | TS 支持 |
|------|------|---------|
| `@type {Type}` | 类型标注 | ✅ |
| `@typedef` | 类型定义 | ✅ |
| `@template T` | 泛型参数 | ✅ |
| `@param {Type}` | 参数类型 | ✅ |
| `@returns {Type}` | 返回类型 | ✅ |
| `@private` / `@protected` / `@public` | 可见性 | ⚠️  用 TS 代替 |
| `@internal` | 内部标识 | ✅ TS 编译器支持 |

## 注释原则

1. **必要性**：只添加有价值的注释
2. **准确性**：保持注释与代码同步
3. **完整性**：公共 API 必须有完整注释
4. **格式统一**：遵循本文档规定的格式

## 参考资料

- [JSDoc 官方文档](https://jsdoc.app/)
- [TypeScript JSDoc 参考](https://www.typescriptlang.org/docs/handbook/jsdoc-supported-types.html)
- [Google JavaScript Style Guide - JSDoc](https://google.github.io/styleguide/jsguide.html#jsdoc-comments)
