import { Tabs } from 'expo-router';
import { Ionicons } from "@expo/vector-icons";
import React from 'react';

export default function TabLayout() {

  return (

    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: "#071B2E"
        },
        tabBarActiveTintColor: "#1DB954"
      }}
    >

      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home" size={size} color={color} />
          )
        }}
      />

      <Tabs.Screen
        name="history"
        options={{
          title: "History",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="analytics" size={size} color={color} />
          )
        }}
      />

    </Tabs>
  );
}