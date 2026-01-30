# While 循环开始

## While Loop Start (Pix_WhileLoopStart)

**功能**：定义条件循环的起点。

### 输入参数

- **condition (BOOLEAN)**:
    - **含义**: 初始条件（通常默认为 True）。
    - **说明**: 决定是否开始第一次循环。
- **initial_value_0 (Any)**:
    - **注意**: While 循环从 0 号插槽开始，不同于 For 循环。
    - **用法**: 通常用于传入自定义的计数器或状态变量。

### 输出结果

- **flow**: 连接到 End 节点。
- **value_0**: 当前迭代的变量值。