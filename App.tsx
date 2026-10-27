/* App.tsx —— 主入口：控制 / 设置 双 Tab（含错误显示层，黑屏排查用） */
import React, { useMemo, useState, useEffect, Component } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, StatusBar, ScrollView
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { WingBle } from './src/ble';
import ControlScreen from './src/screens/ControlScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import { colors } from './src/theme';

type Tab = 'control' | 'settings';

/* 全局 JS 错误 → 显示到屏幕（不黑屏） */
function useGlobalErrorHandler(onError: (msg: string) => void) {
  useEffect(() => {
    const EU = (global as any).ErrorUtils;
    if (EU && EU.getGlobalHandler) {
      const prev = EU.getGlobalHandler();
      EU.setGlobalHandler((e: any, isFatal?: boolean) => {
        const msg = (e && e.message ? e.message : String(e)) + '\n\n' + ((e && e.stack) || '');
        onError(msg);
        if (prev) prev(e, isFatal);
      });
    }
  }, []);
}

/* 渲染错误边界 */
class ErrorBoundary extends Component<{ children: React.ReactNode; onError: (m: string) => void }, {}> {
  componentDidCatch(e: any) {
    this.props.onError((e && e.message ? e.message : String(e)) + '\n\n' + ((e && e.stack) || ''));
  }
  render() { return this.props.children as React.ReactElement; }
}

/* 错误显示页 */
function FatalScreen({ msg }: { msg: string }) {
  return (
    <View style={{ flex: 1, backgroundColor: '#200505', padding: 20, paddingTop: 60 }}>
      <Text style={{ color: '#ff6b6b', fontSize: 18, fontWeight: '700', marginBottom: 12 }}>
        App 启动出错
      </Text>
      <ScrollView style={{ flex: 1 }}>
        <Text selectable style={{ color: '#ffd7d7', fontSize: 12, fontFamily: 'Menlo', lineHeight: 18 }}>
          {msg}
        </Text>
      </ScrollView>
    </View>
  );
}

export default function App() {
  const ble = useMemo(() => new WingBle(), []);
  const [tab, setTab] = useState<Tab>('control');
  const [fatal, setFatal] = useState<string | null>(null);
  useGlobalErrorHandler(setFatal);

  if (fatal) return <FatalScreen msg={fatal} />;

  return (
    <ErrorBoundary onError={setFatal}>
      <SafeAreaProvider>
        <SafeAreaView style={s.root}>
          <StatusBar barStyle="light-content" backgroundColor={colors.bg} />
          <View style={s.header}>
            <Text style={s.title}>克拉尾翼控制器</Text>
            <Text style={s.subtitle}>KELA WING BLE</Text>
          </View>
          {tab === 'control' ? <ControlScreen ble={ble} /> : <SettingsScreen ble={ble} />}
          <View style={s.tabBar}>
            <TouchableOpacity style={[s.tabItem, tab === 'control' && s.tabActive]} onPress={() => setTab('control')}>
              <Text style={[s.tabText, tab === 'control' && s.tabTextActive]}>控制</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.tabItem, tab === 'settings' && s.tabActive]} onPress={() => setTab('settings')}>
              <Text style={[s.tabText, tab === 'settings' && s.tabTextActive]}>设置</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: {
    paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.cardBorder
  },
  title: { color: colors.text, fontSize: 20, fontWeight: '700' },
  subtitle: { color: colors.dim, fontSize: 10, letterSpacing: 3, marginTop: 2 },
  tabBar: {
    flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.cardBorder, backgroundColor: colors.card
  },
  tabItem: { flex: 1, alignItems: 'center', paddingVertical: 12 },
  tabActive: { backgroundColor: colors.bg },
  tabText: { color: colors.dim, fontSize: 14 },
  tabTextActive: { color: colors.lime, fontWeight: '700' }
});
