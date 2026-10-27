/* src/screens/ControlScreen.tsx —— 连接与档位控制 */
import React, { useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, FlatList, ScrollView,
  StyleSheet, Alert, TextInput
} from 'react-native';
import { Device } from 'react-native-ble-plx';
import { WingBle, WingStatus } from '../ble';
import { colors } from '../theme';

interface DevItem {
  device: Device;
  name: string;
  rssi: number;
  isJdy: boolean;
}

export default function ControlScreen({ ble }: { ble: WingBle }) {
  const [connected, setConnected] = useState(false);
  const [deviceName, setDeviceName] = useState('');
  const [scanning, setScanning] = useState(false);
  const [devices, setDevices] = useState<DevItem[]>([]);
  const [status, setStatus] = useState<WingStatus | null>(null);
  const [step, setStep] = useState(5);
  const [stepInput, setStepInput] = useState('5');
  const [log, setLog] = useState<string[]>([]);
  const [showList, setShowList] = useState(false);

  useEffect(() => {
    ble.onLog = (m) =>
      setLog((prev) => [...prev.slice(-7), `${new Date().toLocaleTimeString('zh-CN', { hour12: false })} ${m}`]);
    ble.onStatus = (st) => {
      setStatus(st);
      if (st.step !== undefined) {
        setStep(st.step);
        setStepInput(String(st.step));
      }
    };
    ble.init();
    return () => { ble.onLog = null; ble.onStatus = null; };
  }, [ble]);

  const search = async () => {
    setLog([]);
    await ble.init();
    setDevices([]);
    setShowList(true);
    setScanning(true);
    ble.scan((d) => {
      const name = d.name || d.localName || '';
      if (!name) return;
      setDevices((prev) => {
        if (prev.some((x) => x.device.id === d.id)) return prev;
        const item: DevItem = {
          device: d, name, rssi: typeof d.rssi === 'number' ? d.rssi : 0,
          isJdy: /JDY/i.test(name)
        };
        return item.isJdy ? [item, ...prev] : [...prev, item];
      });
    });
    setTimeout(() => {
      ble.stopScan();
      setScanning(false);
    }, 8000);
  };

  const connect = async (item: DevItem) => {
    setScanning(false);
    ble.stopScan();
    try {
      await ble.connect(item.device);
      setConnected(true);
      setDeviceName(item.name);
      setShowList(false);
    } catch (e: any) {
      Alert.alert('连接失败', e?.message || String(e));
    }
  };

  const disconnect = () => {
    ble.disconnect();
    setConnected(false);
    setDeviceName('');
    setStatus(null);
  };

  const run = async (fn: () => Promise<unknown>) => {
    if (!connected) { Alert.alert('提示', '请先连接设备'); return; }
    try { await fn(); } catch (e: any) { Alert.alert('发送失败', e?.message || String(e)); }
  };

  const setGear = (n: number) => run(() => ble.gear(n));

  const renderItem = ({ item }: { item: DevItem }) => (
    <TouchableOpacity style={s.devItem} onPress={() => connect(item)}>
      <Text style={s.devName}>{item.name}</Text>
      {item.isJdy && <Text style={s.devTag}>尾翼设备</Text>}
      <Text style={s.devRssi}>{item.rssi} dBm</Text>
    </TouchableOpacity>
  );

  return (
    <ScrollView style={s.page} contentContainerStyle={{ paddingBottom: 40 }}>
      {/* 连接栏 */}
      <View style={s.cardRow}>
        <View style={[s.dot, { backgroundColor: connected ? colors.lime : colors.dim }]} />
        <Text style={s.connText}>{connected ? '已连接: ' + deviceName : '未连接'}</Text>
        <View style={{ flex: 1 }} />
        {!connected ? (
          <TouchableOpacity style={[s.btnPrimary, s.btnSm]} onPress={search} disabled={scanning}>
            <Text style={s.btnPrimaryText}>{scanning ? '搜索中…' : '搜索设备'}</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={[s.btnDanger, s.btnSm]} onPress={disconnect}>
            <Text style={s.btnDangerText}>断开</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* 设备列表 */}
      {showList && (
        <View style={s.card}>
          <Text style={s.cardTitle}>发现的设备</Text>
          <FlatList
            data={devices}
            renderItem={renderItem}
            keyExtractor={(x) => x.device.id}
            style={{ maxHeight: 300 }}
            ListEmptyComponent={
              <Text style={s.dimText}>未发现设备，请确认尾翼通电且蓝牙广播中</Text>
            }
          />
        </View>
      )}

      {/* 状态卡 */}
      <View style={s.card}>
        <Text style={s.cardTitle}>尾翼状态</Text>
        <View style={s.statusGrid}>
          <StatusCell label="当前档位" value={status ? String(status.step) : '--'} mono />
          <StatusCell
            label="自动模式"
            value={status ? (status.auto === 2 ? '开启' : '关闭') : '--'}
            lime={status?.auto === 2}
          />
          <StatusCell label="车速" value={status ? `${status.speed} km/h` : '--'} mono />
          <StatusCell
            label="阈值(降/升)"
            value={status ? `${status.downNum}/${status.upNum}` : '--'}
            mono
          />
        </View>
      </View>

      {/* 一键控制 */}
      <View style={s.card}>
        <Text style={s.cardTitle}>一键控制</Text>
        <View style={s.row}>
          <TouchableOpacity style={[s.bigBtn, s.btnPrimary]} onPress={() => run(() => ble.up())}>
            <Text style={s.bigBtnText}>▲ 升起</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.bigBtn, s.btnSecondary]} onPress={() => run(() => ble.down())}>
            <Text style={s.bigBtnText2}>▼ 收起</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* 三档快捷 */}
      <View style={s.card}>
        <Text style={s.cardTitle}>三档快捷（最小 / 中间 / 最大）</Text>
        <View style={s.row}>
          {[3, 4, 5].map((n, idx) => (
            <TouchableOpacity
              key={n}
              style={[
                s.gearBtn,
                step === n && s.gearActive
              ]}
              onPress={() => setGear(n)}
            >
              <Text style={[s.gearText, step === n && s.gearTextActive]}>
                {['最小', '中间', '最大'][idx]}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* 精确档位 */}
      <View style={s.card}>
        <Text style={s.cardTitle}>精确档位（0-15）</Text>
        <View style={s.row}>
          <TouchableOpacity style={s.stepBtn} onPress={() => setGear(Math.max(0, step - 1))}>
            <Text style={s.stepText}>−</Text>
          </TouchableOpacity>
          <TextInput
            style={s.stepInput}
            keyboardType="number-pad"
            value={stepInput}
            onChangeText={(t) => setStepInput(t)}
            onEndEditing={() => {
              const n = parseInt(stepInput, 10);
              if (isNaN(n) || n < 0 || n > 15) {
                Alert.alert('提示', '档位 0-15'); return;
              }
              setStep(n); setGear(n);
            }}
          />
          <TouchableOpacity style={s.stepBtn} onPress={() => setGear(Math.min(15, step + 1))}>
            <Text style={s.stepText}>＋</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* 日志 */}
      <View style={s.card}>
        <Text style={s.cardTitle}>通信日志</Text>
        <View style={s.logBox}>
          {log.length === 0 ? (
            <Text style={s.dimText}>暂无日志</Text>
          ) : (
            log.map((l, i) => (
              <Text key={i} style={s.logLine}>{l}</Text>
            ))
          )}
        </View>
      </View>
    </ScrollView>
  );
}

function StatusCell({ label, value, lime, mono }: {
  label: string; value: string; lime?: boolean; mono?: boolean;
}) {
  return (
    <View style={s.statusCell}>
      <Text style={s.statusLabel}>{label}</Text>
      <Text style={[s.statusValue, lime && { color: colors.lime }, mono && { fontFamily: colors.mono }]}>
        {value}
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.bg },
  cardRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.card, borderRadius: 16,
    paddingHorizontal: 16, paddingVertical: 14, margin: 12
  },
  dot: { width: 10, height: 10, borderRadius: 5, marginRight: 8 },
  connText: { color: colors.text, fontSize: 15 },
  card: {
    backgroundColor: colors.card, borderRadius: 16,
    padding: 16, marginHorizontal: 12, marginBottom: 12
  },
  cardTitle: { color: colors.dim, fontSize: 12, letterSpacing: 2, marginBottom: 10 },
  btnPrimary: {
    backgroundColor: colors.limeDark, borderRadius: 12,
    paddingHorizontal: 18, paddingVertical: 10
  },
  btnPrimaryText: { color: colors.bg, fontWeight: '700' },
  btnSecondary: {
    backgroundColor: colors.cardBorder, borderRadius: 12,
    paddingHorizontal: 18, paddingVertical: 10
  },
  btnDanger: { backgroundColor: colors.dangerBg, borderRadius: 12, paddingHorizontal: 18, paddingVertical: 10 },
  btnDangerText: { color: colors.danger },
  btnSm: { paddingVertical: 8, paddingHorizontal: 14 },
  devItem: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.cardBorder
  },
  devName: { flex: 1, color: colors.text, fontSize: 15 },
  devTag: {
    color: colors.bg, backgroundColor: colors.lime,
    fontSize: 11, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2,
    marginRight: 10
  },
  devRssi: { color: colors.dim, fontSize: 12, fontFamily: colors.mono },
  dimText: { color: colors.dim, paddingVertical: 8 },
  statusGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  statusCell: { width: '50%', paddingVertical: 8 },
  statusLabel: { color: colors.dim, fontSize: 11, marginBottom: 4 },
  statusValue: { color: colors.text, fontSize: 22, fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'center' },
  bigBtn: { flex: 1, borderRadius: 14, paddingVertical: 26, marginHorizontal: 4, alignItems: 'center' },
  bigBtnText: { color: colors.bg, fontSize: 20, fontWeight: '700' },
  bigBtnText2: { color: colors.lime, fontSize: 20, fontWeight: '700' },
  gearBtn: {
    flex: 1, borderRadius: 12, paddingVertical: 16, marginHorizontal: 4,
    backgroundColor: colors.cardBorder, borderWidth: 1, borderColor: colors.cardBorder,
    alignItems: 'center'
  },
  gearActive: { backgroundColor: colors.lime, borderColor: colors.lime },
  gearText: { color: colors.lime, fontSize: 15 },
  gearTextActive: { color: colors.bg, fontWeight: '700' },
  stepBtn: {
    width: 52, borderRadius: 12, paddingVertical: 12,
    backgroundColor: colors.cardBorder, alignItems: 'center', marginHorizontal: 4
  },
  stepText: { color: colors.lime, fontSize: 22 },
  stepInput: {
    flex: 1, backgroundColor: colors.bg, borderRadius: 12,
    borderWidth: 1, borderColor: colors.cardBorder,
    color: colors.lime, fontSize: 20, textAlign: 'center',
    paddingVertical: 10, marginHorizontal: 4, fontFamily: colors.mono
  },
  logBox: {
    backgroundColor: colors.bg, borderRadius: 10,
    padding: 10, minHeight: 80
  },
  logLine: { color: colors.sub, fontSize: 11, fontFamily: colors.mono, lineHeight: 16 }
});
