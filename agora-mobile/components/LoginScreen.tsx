import React from 'react';
import { SafeAreaView, Text, TouchableOpacity, StyleSheet } from 'react-native';

interface LoginScreenProps {
  onLogin: (user: {
    id: number;
    name: string;
    enrolledMeetings: string[];
  }) => void;
  users: { id: number; name: string; enrolledMeetings: string[] }[];
}

const LoginScreen = ({ onLogin, users }: LoginScreenProps) => (
  <SafeAreaView style={styles.centered}>
    <Text style={styles.head}>Select User</Text>
    {users.map(user => (
      <TouchableOpacity
        key={user.id}
        style={styles.button}
        onPress={() => onLogin(user)}
      >
        <Text style={styles.buttonText}>{user.name}</Text>
      </TouchableOpacity>
    ))}
  </SafeAreaView>
);

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F7F7F7',
  },
  head: { fontSize: 24, fontWeight: 'bold', textAlign: 'center', padding: 20 },
  button: {
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#007bff',
    borderRadius: 8,
    marginVertical: 8,
    alignItems: 'center',
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});

export default LoginScreen;
