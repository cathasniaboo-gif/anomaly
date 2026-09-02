import React from 'react';
import { View, Text, Platform } from 'react-native';
import { createNativeStackNavigator, NativeStackNavigationOptions } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  HomeStackParamList,
  AskStackParamList,
  UpdatesStackParamList,
  AboutStackParamList,
  MainTabParamList,
} from './types';
import { colors } from '../theme/theme';
import { useUpdates } from '../context/UpdatesContext';

import HomeScreen from '../screens/HomeScreen';
import CategoryScreen from '../screens/CategoryScreen';
import DetailScreen from '../screens/DetailScreen';
import SearchScreen from '../screens/SearchScreen';
import AskScreen from '../screens/AskScreen';
import UpdatesListScreen from '../screens/UpdatesListScreen';
import UpdateDetailScreen from '../screens/UpdateDetailScreen';
import AboutScreen from '../screens/AboutScreen';

const HomeStack = createNativeStackNavigator<HomeStackParamList>();
const AskStack = createNativeStackNavigator<AskStackParamList>();
const UpdatesStack = createNativeStackNavigator<UpdatesStackParamList>();
const AboutStack = createNativeStackNavigator<AboutStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

const headerOptions: NativeStackNavigationOptions = {
  headerStyle: { backgroundColor: colors.ink },
  headerTintColor: '#fff',
  headerTitleStyle: { fontWeight: '600' },
  headerShadowVisible: false,
};

function HomeStackNavigator() {
  return (
    <HomeStack.Navigator screenOptions={headerOptions}>
      <HomeStack.Screen name="Home" component={HomeScreen} options={{ title: 'UAE Reg' }} />
      <HomeStack.Screen name="Category" component={CategoryScreen} />
      <HomeStack.Screen name="Detail" component={DetailScreen} />
      <HomeStack.Screen name="Search" component={SearchScreen} options={{ title: 'Search' }} />
    </HomeStack.Navigator>
  );
}

function AskStackNavigator() {
  return (
    <AskStack.Navigator screenOptions={headerOptions}>
      <AskStack.Screen name="Ask" component={AskScreen} options={{ title: 'Ask a Consultant' }} />
    </AskStack.Navigator>
  );
}

function UpdatesStackNavigator() {
  return (
    <UpdatesStack.Navigator screenOptions={headerOptions}>
      <UpdatesStack.Screen name="UpdatesList" component={UpdatesListScreen} options={{ title: 'Updates' }} />
      <UpdatesStack.Screen name="UpdateDetail" component={UpdateDetailScreen} />
    </UpdatesStack.Navigator>
  );
}

function AboutStackNavigator() {
  return (
    <AboutStack.Navigator screenOptions={headerOptions}>
      <AboutStack.Screen name="About" component={AboutScreen} options={{ title: 'About & sources' }} />
    </AboutStack.Navigator>
  );
}

function UpdatesTabIcon({ color, size }: { color: string; size: number }) {
  const { unreadCount } = useUpdates();
  return (
    <View>
      <MaterialCommunityIcons name="bell-outline" size={size} color={color} />
      {unreadCount > 0 && (
        <View
          style={{
            position: 'absolute',
            top: -3,
            right: -8,
            minWidth: 15,
            height: 15,
            borderRadius: 8,
            backgroundColor: colors.danger,
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: 3,
          }}
        >
          <Text style={{ color: '#fff', fontSize: 9, fontWeight: '700' }}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </Text>
        </View>
      )}
    </View>
  );
}

export default function RootNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.goldDeep,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: {
          backgroundColor: colors.panel,
          borderTopColor: colors.border,
          height: Platform.OS === 'ios' ? 84 : 62,
          paddingTop: 6,
        },
        tabBarLabelStyle: { fontSize: 10.5 },
      }}
    >
      <Tab.Screen
        name="HomeTab"
        component={HomeStackNavigator}
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="home-variant-outline" size={size} color={color} />,
        }}
      />
      <Tab.Screen
        name="AskTab"
        component={AskStackNavigator}
        options={{
          title: 'Ask',
          tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="chat-question-outline" size={size} color={color} />,
        }}
      />
      <Tab.Screen
        name="UpdatesTab"
        component={UpdatesStackNavigator}
        options={{
          title: 'Updates',
          tabBarIcon: ({ color, size }) => <UpdatesTabIcon color={color} size={size} />,
        }}
      />
      <Tab.Screen
        name="AboutTab"
        component={AboutStackNavigator}
        options={{
          title: 'About',
          tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="information-outline" size={size} color={color} />,
        }}
      />
    </Tab.Navigator>
  );
}
