# While 循环结束

## While Loop End (Pix_WhileLoopEnd)

**功能**：定义条件循环的终点，并决定是否继续。

### 输入参数

- **flow**: 来自 Start 节点。
- **condition (BOOLEAN)**:
    - **核心参数**: 决定是否继续下一次循环。
    - **用法**: 必须连接一个布尔值（例如通过 `Compare` 节点计算得出）。如果为 True，继续循环；如果为 False，结束循环。
- **initial_value_0**: 本次迭代后的数据，将传回 Start 节点。