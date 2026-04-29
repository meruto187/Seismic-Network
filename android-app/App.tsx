import React from 'react';
import { useColorScheme } from 'react-native';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { PaperProvider, MD3DarkTheme, MD3LightTheme, adaptNavigationTheme } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { SeismicProvider } from './context/SeismicContext';
import AlertsScreen from './screens/AlertsScreen';
import QuakeListScreen from './screens/QuakeListScreen';
import ReportScreen from './screens/ReportScreen';
import SettingsScreen from './screens/SettingsScreen';
import ChatScreen from './screens/ChatScreen';

const Tab = createBottomTabNavigator();

const { LightTheme: NavLight, DarkTheme: NavDark } = adaptNavigationTheme({
  reactNavigationLight: DefaultTheme,
  reactNavigationDark: DarkTheme,
});

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

const TAB_ICONS: Record<string, { active: IoniconName; inactive: IoniconName }> = {
  'Uyarılar':  { active: 'radio',           inactive: 'radio-outline' },
  'Depremler': { active: 'list',             inactive: 'list-outline' },
  'Rapor':     { active: 'megaphone',        inactive: 'megaphone-outline' },
  'Sohbet':    { active: 'chatbubbles',      inactive: 'chatbubbles-outline' },
  'Ayarlar':   { active: 'settings',         inactive: 'settings-outline' },
};

const App = () => {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const paperTheme = isDark ? MD3DarkTheme : MD3LightTheme;
  const navTheme = isDark ? NavDark : NavLight;

  return (
    <SafeAreaProvider>
      <PaperProvider theme={paperTheme}>
        <SeismicProvider>
          <NavigationContainer theme={navTheme}>
            <Tab.Navigator
              screenOptions={({ route }) => ({
                tabBarActiveTintColor: paperTheme.colors.primary,
                tabBarInactiveTintColor: isDark ? '#6b7280' : '#9ca3af',
                tabBarStyle: {
                  paddingBottom: 6,
                  paddingTop: 4,
                  height: 60,
                  backgroundColor: paperTheme.colors.surface,
                  borderTopColor: isDark ? '#1e293b' : '#e2e8f0',
                },
                tabBarLabelStyle: { fontSize: 10, fontWeight: '600' },
                headerStyle: { backgroundColor: paperTheme.colors.surface },
                headerTintColor: paperTheme.colors.onSurface,
                headerTitleStyle: { fontWeight: '700', fontSize: 16 },
                tabBarIcon: ({ focused, color, size }) => {
                  const icons = TAB_ICONS[route.name];
                  const name = focused ? icons?.active : icons?.inactive;
                  return <Ionicons name={name ?? 'ellipse-outline'} size={size - 2} color={color} />;
                },
              })}
            >
              <Tab.Screen name="Uyarılar"  component={AlertsScreen} />
              <Tab.Screen name="Depremler" component={QuakeListScreen} />
              <Tab.Screen name="Rapor"     component={ReportScreen} />
              <Tab.Screen name="Sohbet"    component={ChatScreen} />
              <Tab.Screen name="Ayarlar"   component={SettingsScreen} />
            </Tab.Navigator>
          </NavigationContainer>
        </SeismicProvider>
      </PaperProvider>
    </SafeAreaProvider>
  );
};

export default App;
