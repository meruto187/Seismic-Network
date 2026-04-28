import React from 'react';
import { useColorScheme } from 'react-native';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { PaperProvider, MD3DarkTheme, MD3LightTheme, adaptNavigationTheme } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
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
              screenOptions={{
                tabBarActiveTintColor: paperTheme.colors.primary,
                tabBarStyle: { paddingBottom: 4 },
                headerStyle: { backgroundColor: paperTheme.colors.surface },
                headerTintColor: paperTheme.colors.onSurface,
              }}
            >
              <Tab.Screen
                name="Uyarılar"
                component={AlertsScreen}
                options={{ tabBarIcon: ({ color }) => tabIcon('🔔', color) }}
              />
              <Tab.Screen
                name="Depremler"
                component={QuakeListScreen}
                options={{ tabBarIcon: ({ color }) => tabIcon('🌍', color) }}
              />
              <Tab.Screen
                name="Rapor"
                component={ReportScreen}
                options={{ tabBarIcon: ({ color }) => tabIcon('📢', color) }}
              />
              <Tab.Screen
                name="Sohbet"
                component={ChatScreen}
                options={{ tabBarIcon: ({ color }) => tabIcon('💬', color) }}
              />
              <Tab.Screen
                name="Ayarlar"
                component={SettingsScreen}
                options={{ tabBarIcon: ({ color }) => tabIcon('⚙️', color) }}
              />
            </Tab.Navigator>
          </NavigationContainer>
        </SeismicProvider>
      </PaperProvider>
    </SafeAreaProvider>
  );
};

const tabIcon = (emoji: string, _color: string) => {
  const { Text } = require('react-native');
  return <Text style={{ fontSize: 20 }}>{emoji}</Text>;
};

export default App;
