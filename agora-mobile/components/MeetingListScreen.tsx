import React from 'react';
import {
  SafeAreaView,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
} from 'react-native';

interface Meeting {
  channel: string;
  title: string;
}

interface MeetingListScreenProps {
  user: { id: number; name: string; enrolledMeetings: string[] };
  meetings: Meeting[];
  onSelectMeeting: (channel: string) => void;
  onJoinByChannel: () => void;
  onLogout: () => void;
}

const MeetingListScreen = ({
  user,
  meetings,
  onSelectMeeting,
  onJoinByChannel,
  onLogout,
}: MeetingListScreenProps) => {
  const userMeetings = meetings.filter(m =>
    user.enrolledMeetings.includes(m.channel),
  );
  return (
    <SafeAreaView style={styles.main}>
      <Text style={styles.head}>Welcome, {user.name}</Text>
      <Text style={styles.infoText}>Your Meetings:</Text>
      <FlatList
        data={userMeetings}
        keyExtractor={item => item.channel}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.button}
            onPress={() => onSelectMeeting(item.channel)}
          >
            <Text style={styles.buttonText}>{item.title}</Text>
          </TouchableOpacity>
        )}
      />
      <TouchableOpacity
        style={[styles.button, { marginTop: 30, backgroundColor: '#28a745' }]}
        onPress={onJoinByChannel}
      >
        <Text style={styles.buttonText}>Join by Channel Name</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.button, { marginTop: 10, backgroundColor: '#6c757d' }]}
        onPress={onLogout}
      >
        <Text style={styles.buttonText}>Logout</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  main: { flex: 1, backgroundColor: '#F7F7F7' },
  head: { fontSize: 24, fontWeight: 'bold', textAlign: 'center', padding: 20 },
  infoText: { textAlign: 'center', fontSize: 16, padding: 10 },
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

export default MeetingListScreen;
