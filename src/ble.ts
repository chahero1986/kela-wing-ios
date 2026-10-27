/**
 * src/ble.ts —— 克拉电动尾翼控制器 BLE 协议层（iOS / react-native-ble-plx）
 * 服务 0xFFE0 / UART 特征 0xFFE1（写入 + 通知同特征）
 * 指令帧: BB [设备地址] 80 [命令] [数据] [00]
 */
import { BleManager, Device, Subscription } from 'react-native-ble-plx';

export const SERVICE_UUID = '0000FFE0-0000-1000-8000-00805F9B34FB';
export const CHAR_UUID = '0000FFE1-0000-1000-8000-00805F9B34FB';

export interface WingStatus {
  auto: number;        // 1=关 2=开
  step: number;        // 当前档位
  speed: number;       // 车速 km/h
  downNum: number;     // 下降阈值
  upNum: number;       // 上升阈值
  trackType?: number;  // 赛道模式
  isIgnition?: number;
  isReadyIgnition?: number;
}

/* ---------- hex / base64 互转（无 Buffer 依赖） ---------- */
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function hexToBytes(hex: string): number[] {
  const out: number[] = [];
  const s = String(hex || '').replace(/[^0-9a-fA-F]/g, '');
  for (let i = 0; i + 1 < s.length; i += 2) out.push(parseInt(s.substr(i, 2), 16));
  return out;
}

function bytesToBase64(bytes: number[]): string {
  let out = '';
  let i = 0;
  while (i < bytes.length) {
    const a = bytes[i++] & 0xff;
    const b = i < bytes.length ? bytes[i++] : NaN;
    const c = i < bytes.length ? bytes[i++] : NaN;
    out += B64[a >> 2] + B64[((a & 3) << 4) | ((b >> 4) & 0xf)];
    out += isNaN(b) ? '=' : B64[((b & 0xf) << 2) | ((c >> 6) & 3)];
    out += isNaN(c) ? '=' : B64[c & 0x3f];
  }
  return out;
}

function base64ToBytes(b64: string): number[] {
  const clean = String(b64 || '').replace(/=+$/, '');
  const bytes: number[] = [];
  for (let i = 0; i < clean.length; i += 4) {
    const chunk = clean.slice(i, i + 4).padEnd(4, 'A');
    const n =
      (B64.indexOf(chunk[0]) << 18) |
      (B64.indexOf(chunk[1]) << 12) |
      (B64.indexOf(chunk[2]) << 6) |
      B64.indexOf(chunk[3]);
    bytes.push((n >> 16) & 255, (n >> 8) & 255, n & 255);
  }
  return bytes;
}

export function hexToBase64(hex: string): string {
  return bytesToBase64(hexToBytes(hex));
}

export function bufToHex(base64: string): string {
  return base64ToBytes(base64)
    .map((b) => (b < 16 ? '0' : '') + b.toString(16))
    .join('');
}

const pad2 = (n: number) => (n < 16 ? '0' : '') + n.toString(16).toUpperCase();

/* ---------- BLE 封装 ---------- */
export class WingBle {
  private manager = new BleManager();
  private device: Device | null = null;
  private sub: Subscription | null = null;
  private charUUID: string | null = null;

  connected = false;
  did = '1C'; // 设备地址（首次回报帧自动获取，默认 1C）

  onLog: ((msg: string) => void) | null = null;
  onStatus: ((st: WingStatus) => void) | null = null;

  private log(msg: string) {
    this.onLog?.(msg);
  }

  /* 初始化 / 请求蓝牙权限（iOS 13+） */
  async init(): Promise<void> {
    try {
      await this.manager.enable();
    } catch {
      /* 已启用则忽略 */
    }
  }

  /* 扫描设备（回调过滤） */
  scan(cb: (d: Device) => void): void {
    this.manager.stopDeviceScan();
    this.manager.startDeviceScan(null, null, (err, d) => {
      if (err) {
        this.log('扫描错误: ' + err.message);
        return;
      }
      if (d && (d.name || d.localName)) cb(d);
    });
  }

  stopScan(): void {
    this.manager.stopDeviceScan();
  }

  /* 连接 + 发现服务特征 + 订阅通知 */
  async connect(device: Device): Promise<void> {
    this.log('连接 ' + (device.name || device.id) + ' …');
    await device.connect();
    this.device = device;
    await device.discoverAllServicesAndCharacteristics();

    const chars = await device.characteristicsForService(SERVICE_UUID);
    const ch = chars.find(
      (c) =>
        c.uuid.toUpperCase().indexOf('FFE1') >= 0 &&
        c.isWritableWithResponse
    );
    if (!ch) throw new Error('未找到可写特征 FFE1');
    this.charUUID = ch.uuid;
    this.connected = true;
    this.log('已连接，特征 ' + ch.uuid);

    this.sub = device.monitorCharacteristicForService(
      SERVICE_UUID,
      ch.uuid,
      (err, updated) => {
        if (err) {
          this.log('通知错误: ' + err.message);
          return;
        }
        if (updated?.value) this.onNotify(updated.value);
      }
    );
    this.log('已开启状态通知');
  }

  /* 回报帧解析（兼容 8 字节基础帧 / 12 字节扩展帧） */
  private onNotify(b64: string) {
    const hex = bufToHex(b64);
    if (hex.length < 16) return;
    const s = hex.toUpperCase();
    if (s.substr(0, 2) !== 'BB' || s.substr(4, 2) !== '20') return;
    this.did = s.substr(2, 2) || this.did;

    const st: WingStatus = {
      auto: parseInt(s.substr(6, 2), 16),
      step: parseInt(s.substr(8, 2), 16),
      speed: parseInt(s.substr(10, 2), 16),
      downNum: parseInt(s.substr(12, 2), 16),
      upNum: parseInt(s.substr(14, 2), 16)
    };
    if (s.length >= 24) {
      st.trackType = parseInt(s.substr(16, 2), 16);
      st.isIgnition = parseInt(s.substr(18, 2), 16);
      st.isReadyIgnition = parseInt(s.substr(20, 2), 16);
    }
    this.log('回报: ' + s);
    this.onStatus?.(st);
  }

  /* 发送指令：cmd 形如 '80060100'（自动拼接 BB + did） */
  async send(cmd: string): Promise<string> {
    if (!this.device || !this.connected || !this.charUUID) {
      throw new Error('未连接设备');
    }
    const frame = 'BB' + this.did + cmd.toUpperCase();
    await this.device.writeCharacteristicWithResponseForService(
      SERVICE_UUID,
      this.charUUID,
      hexToBase64(frame)
    );
    this.log('发送: ' + frame);
    return frame;
  }

  /* 便捷指令 */
  gear(n: number) {
    return this.send('8001' + pad2(n) + '00');
  }
  up() {
    return this.send('80060100');
  }
  down() {
    return this.send('80060200');
  }
  autoOn(down: number, up: number) {
    return this.send('8002' + pad2(down) + pad2(up));
  }
  autoOff() {
    return this.send('80030000');
  }
  track(type: number) {
    return this.send('80040' + type + '00');
  }
  ignition(on: boolean) {
    return this.send('80050' + (on ? '1' : '0') + '00');
  }

  /* 断开清理 */
  disconnect(): void {
    this.sub?.remove();
    this.sub = null;
    if (this.device) {
      this.device.cancelConnection().catch(() => {});
    }
    this.device = null;
    this.charUUID = null;
    this.connected = false;
  }
}
