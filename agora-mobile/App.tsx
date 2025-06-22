import React, { useState } from 'react';
import LoginScreen from './components/LoginScreen';
import MeetingListScreen from './components/MeetingListScreen';
import JoinMeetingScreen from './components/JoinMeetingScreen';
import VideoRoomScreen from './components/VideoRoomScreen';

// --- Mock Data ---
const MOCK_USERS = [
  { id: 1, name: 'Alice', enrolledMeetings: ['math101', 'science202'] },
  { id: 2, name: 'Bob', enrolledMeetings: ['math101', 'history303'] },
  { id: 3, name: 'Charlie', enrolledMeetings: ['math101', 'history303'] },
  { id: 4, name: 'David', enrolledMeetings: ['math101', 'history303'] },
];
const MOCK_MEETINGS = [
  { channel: 'math101', title: 'Math 101 Class' },
  { channel: 'science202', title: 'Science 202 Class' },
  { channel: 'history303', title: 'History 303 Class' },
  { channel: 'english404', title: 'English 404 Class' },
  { channel: 'science505', title: 'Science 505 Class' },
  { channel: 'math606', title: 'Math 606 Class' },
  { channel: 'history707', title: 'History 707 Class' },
];

// --- App Root ---
export default function App() {
  const [user, setUser] = useState<(typeof MOCK_USERS)[0] | null>(null);
  const [screen, setScreen] = useState<
    'login' | 'meetingList' | 'joinMeeting' | 'videoRoom'
  >('login');
  const [selectedChannel, setSelectedChannel] = useState('');

  // Navigation handlers
  const handleLogin = (userObj: (typeof MOCK_USERS)[0]) => {
    setUser(userObj);
    setScreen('meetingList');
  };
  const handleLogout = () => {
    setUser(null);
    setScreen('login');
    setSelectedChannel('');
  };
  const handleSelectMeeting = (channel: string) => {
    setSelectedChannel(channel);
    setScreen('videoRoom');
  };
  const handleJoinByChannel = () => {
    setSelectedChannel('');
    setScreen('joinMeeting');
  };
  const handleJoinMeeting = async (
    channel: string,
    setError: (msg: string) => void,
    setJoining: (b: boolean) => void,
  ) => {
    if (!channel) {
      setError('Channel name required');
      setJoining(false);
      return;
    }
    setSelectedChannel(channel);
    setScreen('videoRoom');
    setJoining(false);
  };
  const handleBackToMeetings = () => {
    setScreen('meetingList');
    setSelectedChannel('');
  };

  return (
    <>
      {screen === 'login' && (
        <LoginScreen onLogin={handleLogin} users={MOCK_USERS} />
      )}
      {screen === 'meetingList' && user && (
        <MeetingListScreen
          user={user}
          meetings={MOCK_MEETINGS}
          onSelectMeeting={handleSelectMeeting}
          onJoinByChannel={handleJoinByChannel}
          onLogout={handleLogout}
        />
      )}
      {screen === 'joinMeeting' && user && (
        <JoinMeetingScreen
          initialChannel={selectedChannel}
          onJoin={handleJoinMeeting}
          onBack={handleBackToMeetings}
        />
      )}
      {screen === 'videoRoom' && user && selectedChannel && (
        <VideoRoomScreen
          user={user}
          channelName={selectedChannel}
          onLeave={handleBackToMeetings}
        />
      )}
    </>
  );
}
