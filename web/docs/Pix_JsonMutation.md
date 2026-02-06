# JSON 编辑器

**JSON Mutation** 是一个功能强大的 JSON 结构化编辑工具，专为处理复杂的数据流设计。它支持通过点号路径（Dot Notation）对 JSON 对象或列表进行批量的增、删、改操作。

## 核心功能

- **批量编辑**：支持多行路径（Paths）与多行值（Values）的一一对应修改。
- **通配符支持**：使用  批量操作列表中的所有项或字典中的所有值（例如 `items.*.status`）。
- **广播模式**：使用 `@` 前缀，将同一个值应用到所有目标路径。
- **混合删除**：通过  前缀强制删除特定路径的元素。

## 输入参数说明

- **json_data** (`JSON/List/Dict`)
    - 需要编辑的原始 JSON 数据。支持字符串格式的 JSON，节点会自动解析。
- **target** (`Option`)
    - **Value**: 修改键对应的值。
    - **Key**: 修改键名。
- **mode** (`Option`)
    - **Replace**: 替换（默认）。
    - **Prepend**: 在字符串头部拼接或列表头部插入。
    - **Append**: 在字符串尾部拼接或列表尾部追加。
- **target_paths** (`String`, 多行)
    - 目标路径列表，每行一个。支持 `key.0.subkey` 格式。
    - **特殊语法**：
        - : 通配符，匹配当前层级所有元素。
        - `path`: 路径前加  表示**强制删除**该元素（忽略 Mode）。
- **new_values** (`String`, 多行)
    - 新值列表，每行对应一个路径。
    - **特殊语法**：
        - `@value`: **广播模式**，将 `value` 应用于所有路径。
        - `@@value`: 转义，表示文本 "@value"。

## 不同数据类型的操作指南

### 1. 当输入是列表 (List) `[A, B, C]`

列表使用**数字索引**进行定位。

- **修改特定项**：
    
    ```
    Path: 0
    # 说明: 修改第1项
    
    Path: 2
    # 说明: 修改第3项
    
    ```
    
- **修改所有项**：
    
    ```
    Path: *
    # 说明: 配合 Target=Value 可统一修改列表内所有元素的值
    
    ```
    
- **追加元素**：
    
    ```
    Mode: Append
    Path: (留空)
    Value: 新元素
    # 说明: 将直接追加到列表末尾
    
    ```
    

### 2. 当输入是对象 (Dict) `{"key": "value"}`

对象使用**键名**进行定位。

- **修改特定键**：
    
    ```
    Path: config
    # 说明: 定位到 config 键
    
    ```
    
- **嵌套定位**：
    
    ```
    Path: config.resolution.width
    
    ```
    
- **新增键值对**：
    
    ```
    Mode: Replace
    Path: new_key_name
    Value: 新值
    # 说明: 如果键不存在，会自动创建
    
    ```
    

### 3. 当输入是混合结构 (List of Objects) `[{"id":1}, {"id":2}]`

这是 API 响应中常见的数据结构，结合了索引和键名。

- **修改特定对象的属性**：
    
    ```
    Path: 0.id
    # 说明: 修改第1个对象的 id
    
    ```
    
- **批量修改所有对象的属性**：
    
    ```
    Path: *.id
    # 说明: 修改列表中所有对象的 id 字段
    
    Path: *.status
    # 说明: 修改列表中所有对象的 status 字段
    
    ```
    
- **删除所有对象的某个属性**：
    
    ```
    Path: -*.temp_cache
    # 说明: 删除列表中每个对象里的 temp_cache 字段
    
    ```
    

## 使用示例

### 场景 1：批量修改状态 (广播模式)

假设有一个包含多个任务的列表，想把所有任务的状态改为 `done`。

- **Target Paths**: `.status`
- **New Values**: `@done` （使用 @ 广播）

### 场景 2：为文件名添加前缀 (Prepend 模式)

假设路径指向一个图片文件名字符串 `"image.png"`，想改为 `"prefix_image.png"`。

- **Mode**: `Prepend`
- **Target Paths**: `filename`
- **New Values**: `prefix_`
- **结果**: `"prefix_image.png"`

### 场景 3：混合修改与删除

同时修改标题并删除临时字段。

- **Target Paths**:
    
    ```
    title
    -temp_cache
    
    ```
    
- **New Values**:
    
    ```
    新标题
    (此处留空即可，因为是删除操作)
    
    ```
    

### 场景 4：修改键名

将对象中的 `id` 键重命名为 `user_id`。

- **Target**: `Key`
- **Target Paths**: `id`
- **New Values**: `user_id`

## 输出

- **json_data**: 修改完成后的 JSON 对象。