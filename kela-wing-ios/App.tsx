/* App.tsx —— 主入口：控制 / 设置 双 Tab */
import React, { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, StatusBar } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { WingBle } from './src/ble';
import ControlScreen from './src/screens/ControlScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import { colors } from './src/theme';

type Tab = 'control' | 'settings';

export default function App() {
  const ble = useMemo(() => new WingBle(), []);
  const [tab, setTab] = useState<Tab>('control');

  return (
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
