# 资源文件目录

此目录用于存放应用所需的静态资源文件。

## 建议包含的文件：

1. **图标文件**：
   - `icon.png` - 应用图标（256x256像素）
   - `icon.ico` - Windows图标文件
   - `icon.icns` - macOS图标文件

2. **音频资源**：
   - `sounds/` - 音效文件目录
     - `connect.wav` - 连接成功音效
     - `disconnect.wav` - 断开连接音效
     - `message.wav` - 消息提示音效

3. **界面资源**：
   - `images/` - 图片资源目录
     - `background.png` - 背景图片
     - `logo.svg` - 应用Logo

4. **配置文件**：
   - `config.json` - 默认配置文件
   - `default-settings.json` - 默认设置文件

## 注意事项：

- 所有资源文件在打包时会被复制到应用的`resources`目录中
- 在代码中可以通过相对路径访问这些资源
- 建议使用绝对路径或`app.getAppPath()`来访问资源文件