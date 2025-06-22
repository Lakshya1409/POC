import React, { useState } from 'react';
import {
  SafeAreaView,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';

interface JoinMeetingScreenProps {
  initialChannel: string;
  onJoin: (
    channel: string,
    setError: (msg: string) => void,
    setJoining: (b: boolean) => void,
  ) => Promise<void>;
  onBack: () => void;
}

const JoinMeetingScreen = ({
  initialChannel,
  onJoin,
  onBack,
}: JoinMeetingScreenProps) => {
  const [channel, setChannel] = useState(initialChannel || '');
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState('');
  return (
    <SafeAreaView style={styles.main}>
      <Text style={styles.head}>Join Meeting</Text>
      <TextInput
        style={styles.input}
        placeholder="Enter Channel Name"
        value={channel}
        onChangeText={setChannel}
        autoCapitalize="none"
      />
      {error ? <Text style={{ color: 'red', margin: 8 }}>{error}</Text> : null}
      <TouchableOpacity
        style={[styles.button, { marginTop: 20 }]}
        disabled={joining || !channel}
        onPress={async () => {
          if (!channel) {
            setError('Channel name required');
            setJoining(false);
            return;
          }
          setError('');
          setJoining(true);
          await onJoin(channel, setError, setJoining);
        }}
      >
        <Text style={styles.buttonText}>{joining ? 'Joining...' : 'Join'}</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.button, { marginTop: 10, backgroundColor: '#6c757d' }]}
        onPress={onBack}
      >
        <Text style={styles.buttonText}>Back</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  main: { flex: 1, backgroundColor: '#F7F7F7' },
  head: { fontSize: 24, fontWeight: 'bold', textAlign: 'center', padding: 20 },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 6,
    padding: 8,
    marginVertical: 6,
    width: 220,
    alignSelf: 'center',
  },
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

export default JoinMeetingScreen;
