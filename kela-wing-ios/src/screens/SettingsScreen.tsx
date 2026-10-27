/* src/screens/SettingsScreen.tsx —— 自动升降、赛道、点火设置 */
import React, { useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Switch, Alert
} from 'react-native';
import Slider from '@react-native-community/slider';
import { WingBle, WingStatus } from '../ble';
import { colors } from '../theme';

export default function SettingsScreen({ ble }: { ble: WingBle }) {
  const [connected, setConnected] = useState(false);
  const [auto, setAuto] = useState(false);
  const [downTmp, setDownTmp] = useState(60);
  const [upTmp, setUpTmp] = useState(90);
  const [trackType, setTrackType] = useState(2);
  const [ignition, setIgnition] = useState(false);

  useEffect(() => {
    const onStatus = (st: WingStatus) => {
      setAuto(st.auto === 2);
      setDownTmp(st.downNum);
      setUpTmp(st.upNum);
      if (st.trackType) setTrackType(st.trackType);
      setIgnition(st.isIgnition === 1);
    };
    const timer = setInterval(() => setConnected(ble.connected), 1500);
    ble.onStatus = onStatus;
    return () => { clearInterval(timer); ble.onStatus = null; };
  }, [ble]);

  const guard = (): boolean => {
    if (!ble.connected) {
      Alert.alert('提示', '请先到控制页连接设备');
      return false;
    }
    return true;
  };

  const onAutoChange = (v: boolean) => {
    setAuto(v);
    if (!guard()) return;
    if (v) {
      ble.autoOn(downTmp, upTmp)
        .then(() => Alert.alert('已开启', `自动模式开启（收起 ${downTmp} km/h / 升起 ${upTmp} km/h）`))
        .catch((e: any) => Alert.alert('发送失败', e?.message || String(e)));
    } else {
      ble.autoOff()
        .then(() => Alert.alert('已关闭', '自动模式已关闭'))
        .catch((e: any) => Alert.alert('发送失败', e?.message || String(e)));
    }
  };

  const applyThreshold = () => {
    if (upTmp <= downTmp + 20) {
      Alert.alert('提示', '上升阈值需比下降阈值大 20 以上');
      return;
    }
    if (!guard()) return;
    ble.autoOn(downTmp, upTmp)
      .then(() => Alert.alert('已下发', `阈值下发完成，自动模式开启（收起 ${downTmp} / 升起 ${upTmp}）`))
      .catch((e: any) => Alert.alert('发送失败', e?.message || String(e)));
  };

  const onTrack = (t: number) => {
    if (!guard()) return;
    setTrackType(t);
    ble.track(t)
      .then(() => Alert.alert('已切换', '赛道模式 ' + t))
      .catch((e: any) => Alert.alert('发送失败', e?.message || String(e)));
  };

  const onIgnition = (v: boolean) => {
    setIgnition(v);
    if (!guard()) return;
    ble.ignition(v)
      .then(() => Alert.alert(v ? '已开启' : '已关闭', '点火升降' + (v ? '已开启' : '已关闭')))
      .catch((e: any) => Alert.alert('发送失败', e?.message || String(e)));
  };

  return (
    <View style={s.page}>
      <View style={s.card}>
        <Text style={s.cardTitle}>自动升降（GPS 速度联动）</Text>
        <View style={s.switchRow}>
          <Text style={s.label}>自动模式</Text>
          <Switch value={auto} onValueChange={onAutoChange} trackColor={{ true: colors.limeDark }} thumbColor={colors.lime} />
        </View>

        <Text style={s.sliderLabel}>收起阈值（低于此速度收起）：{downTmp} km/h</Text>
        <Slider
          minimumValue={0} maximumValue={120} step={10} value={downTmp}
          onValueChange={setDownTmp}
          minimumTrackTintColor={colors.lime}
          maximumTrackTintColor={colors.cardBorder}
          thumbTintColor={colors.lime}
        />

        <Text style={s.sliderLabel}>升起阈值（高于此速度升起）：{upTmp} km/h</Text>
        <Slider
          minimumValue={0} maximumValue={120} step={10} value={upTmp}
          onValueChange={setUpTmp}
          minimumTrackTintColor={colors.lime}
          maximumTrackTintColor={colors.cardBorder}
          thumbTintColor={colors.lime}
        />

        <TouchableOpacity style={[s.applyBtn, s.btnPrimary]} onPress={applyThreshold}>
          <Text style={s.applyText}>下发阈值并开启自动</Text>
        </TouchableOpacity>
        <Text style={s.hint}>阈值下发后由控制器独立执行，无需保持 App 打开</Text>
      </View>

      <View style={s.card}>
        <Text style={s.cardTitle}>赛道模式（增加下压力）</Text>
        <View style={s.row}>
          {[1, 2, 3].map((t) => (
            <TouchableOpacity
              key={t}
              style={[s.trackBtn, trackType === t && s.gearActive]}
              onPress={() => onTrack(t)}
            >
              <Text style={[s.trackText, trackType === t && s.gearTextActive]}>赛道 {t}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={s.card}>
        <Text style={s.cardTitle}>点火升降（需配合车内按键）</Text>
        <View style={s.switchRow}>
          <Text style={s.label}>点火升降开关</Text>
          <Switch value={ignition} onValueChange={onIgnition} trackColor={{ true: colors.limeDark }} thumbColor={colors.lime} />
        </View>
        <Text style={s.hint}>开启后，点火/熄火时尾翼自动升降</Text>
      </View>

      <View style={s.card}>
        <View style={s.switchRow}>
          <Text style={s.label}>{connected ? '已连接设备' : '未连接（请到控制页连接）'}</Text>
          <View style={[s.dot, { backgroundColor: connected ? colors.lime : colors.dim }]} />
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.bg, paddingTop: 12 },
  card: {
    backgroundColor: colors.card, borderRadius: 16,
    padding: 16, marginHorizontal: 12, marginBottom: 12
  },
  cardTitle: { color: colors.dim, fontSize: 12, letterSpacing: 2, marginBottom: 10 },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  label: { color: colors.text, fontSize: 15 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  sliderLabel: { color: colors.sub, fontSize: 13, marginTop: 16, marginBottom: 4 },
  applyBtn: { borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginTop: 20 },
  applyText: { color: colors.bg, fontWeight: '700', fontSize: 16 },
  hint: { color: colors.dim, fontSize: 11, marginTop: 10, lineHeight: 16 },
  row: { flexDirection: 'row', alignItems: 'center' },
  trackBtn: {
    flex: 1, borderRadius: 12, paddingVertical: 16, marginHorizontal: 4,
    backgroundColor: colors.cardBorder, borderWidth: 1, borderColor: colors.cardBorder,
    alignItems: 'center'
  },
  gearActive: { backgroundColor: colors.lime, borderColor: colors.lime },
  trackText: { color: colors.lime, fontSize: 15 },
  gearTextActive: { color: colors.bg, fontWeight: '700' }
});
