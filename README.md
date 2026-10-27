# 克拉尾翼控制器 · iOS 独立 App（React Native / Expo）

把官方微信小程序的尾翼控制能力做成独立 iPhone App：**不依赖微信**，BLE 协议完整移植（逆向自官方小程序，已破译）。

## 一、工程结构

```
kela-wing-ios/
├── App.tsx                  # 主入口：控制/设置 双 Tab
├── app.json                 # Expo 配置（已含 iOS 蓝牙权限声明）
├── eas.json                 # EAS 云构建配置
├── babel.config.js
├── tsconfig.json
├── package.json
└── src/
    ├── ble.ts               # ★ 核心：BLE 协议层（react-native-ble-plx）
    ├── theme.ts             # 深色车载仪表主题
    └── screens/
        ├── ControlScreen.tsx    # 控制页：连接/档位/一键升降/日志
        └── SettingsScreen.tsx   # 设置页：自动阈值/赛道/点火
```

## 二、开发环境（Windows 即可，无需 Mac）

1. 安装 Node.js LTS：https://nodejs.org
2. 解压本工程，进入目录：
   ```bash
   cd kela-wing-ios
   npm install
   ```
   若版本有兼容性提示，执行校正：`npx expo install --fix`
3. 本地预览（Expo Go 跑不了原生蓝牙模块，仅看 UI 可以；蓝牙功能需构建安装版）：
   ```bash
   npx expo start
   ```

## 三、构建 ipa（EAS 云构建，Windows 直接构建，不用 Mac）

1. 安装 EAS CLI 并登录（Expo 账号，免费注册）：
   ```bash
   npm i -g eas-cli
   eas login
   ```
2. 初始化项目（会往 app.json 写入 projectId）：
   ```bash
   eas init
   ```
3. 构建 iOS 预览包（**本工程 app.json 已声明蓝牙权限，无需再改**）：
   ```bash
   eas build -p ios --profile preview
   ```
   - 首次会要求**登录你的免费 Apple ID**（与签名工具同一个即可）
   - 按提示**注册你的 iPhone UDID**（EAS 有引导，或 `eas device:create` 通过手机扫码/装描述文件完成）
   - 构建约 10-20 分钟，完成后在 `https://expo.dev` 项目页或终端拿到 **.ipa 下载链接**

> 没有 Apple ID 的：注册一个免费 Apple ID 即可（appleid.apple.com），不需要 99 美元付费账号。

## 四、安装到 iPhone（免费 Apple ID + 签名工具）

1. iPhone 开启**开发者模式**（iOS 16+）：设置 → 隐私与安全性 → 开发者模式 → 打开 → 重启
2. 电脑装 **Sideloadly**（免费，Windows）：https://sideloadly.io
3. iPhone 用数据线连电脑，Sideloadly 里：
   - 选 .ipa 文件（EAS 下载的）
   - 填免费 Apple ID 和密码
   - 点 Start → 自动签名安装
4. 安装后去 设置 → 通用 → VPN与设备管理 → 信任你的 Apple ID 描述文件
5. 打开 App → 允许蓝牙权限 → 搜索连接 JDY-10M

**7 天有效期**：免费签名 7 天后 App 失效，用 Sideloadly 对同一个 ipa 重新签名安装即可（不用重新构建）。也可以直接用 **AltStore**（支持无线重签，但首次仍需电脑）。

## 五、使用说明

- **控制页**：搜索设备（JDY-10M 排最前）→ 连接 → 一键升起/收起、三档快捷（最小3/中间4/最大5）、精确档位 0-15、实时状态
- **设置页**：自动升降阈值滑条（下发后控制器独立执行）、赛道模式 1/2/3、点火升降开关

## 六、指令协议（与微信小程序版一致）

帧格式：`BB [设备地址] 80 [命令] [数据] [00]`，服务 `0xFFE0`，特征 `0xFFE1`（写入+通知）

| 功能 | 指令 |
|---|---|
| 设档位 N (0-15) | `BB 1C 80 01 0N 00` |
| 一键升起（最大） | `BB 1C 80 06 01 00` |
| 一键收起（最小） | `BB 1C 80 06 02 00` |
| 开自动 + 阈值（降/升 各1字节hex） | `BB 1C 80 02 [降] [升]` |
| 关自动 | `BB 1C 80 03 00 00` |
| 赛道 1/2/3 | `BB 1C 80 04 0[1-3] 00` |
| 点火开关（0/1） | `BB 1C 80 05 0[0-1] 00` |

回报帧：`BB [地址] 20 [auto] [step] [speed] [降阈值] [升阈值] [赛道] [点火] [就绪]`
（设备地址 `1C` 由回报帧自动获取并回填）

## 七、常见问题

- **Expo Go 打开后搜索没反应**：Expo Go 不包含原生蓝牙模块，必须用上面 EAS 构建的安装版
- **搜索不到设备**：确认尾翼通电、蓝牙广播中；App 已允许蓝牙权限（设置→隐私→蓝牙）
- **连接后不动**：看"通信日志"回报帧是否 `BB 1C 20 ...`；若指令不生效发回报帧给我核对协议
- **7 天过期**：重新用 Sideloadly 签名，重复安装即可
- **提示"开发者模式未开启"**：按第四节第 1 步开启

## 八、与微信小程序版关系

- 微信小程序（`wx509ee806b24faf23`）：微信里直接用，走微信审核
- 本 ipa App：独立安装、不依赖微信，适合长期放车里备用
- 两者协议互通，后续 ESP32 触摸屏方案也复用同一协议
