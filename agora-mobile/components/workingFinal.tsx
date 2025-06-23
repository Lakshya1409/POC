import React, { useState, useRef, useEffect } from 'react';
import {
  SafeAreaView,
  Text,
  View,
  TouchableOpacity,
  Alert,
  Dimensions,
  StyleSheet,
  FlatList,
  Platform,
} from 'react-native';
import {
  ClientRoleType,
  createAgoraRtcEngine,
  ChannelProfileType,
  RtcSurfaceView,
} from 'react-native-agora';

interface VideoRoomScreenProps {
  user: { id: number; name: string; enrolledMeetings: string[] };
  channelName: string;
  onLeave: () => void;
}

const VideoRoomScreen = ({
  user,
  channelName,
  onLeave,
}: VideoRoomScreenProps) => {
  const [isJoined, setIsJoined] = useState(false);
  const [remoteUids, setRemoteUids] = useState<number[]>([]);
  const [isEngineReady, setIsEngineReady] = useState(false);
  const [isCameraEnabled, setIsCameraEnabled] = useState(true);
  const [isMicEnabled, setIsMicEnabled] = useState(true);
  const [showParticipants, setShowParticipants] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<
    'good' | 'poor' | 'lost' | null
  >(null);
  const agoraEngineRef = useRef<any>(null);
  const [currentPage, setCurrentPage] = useState(0);

  useEffect(() => {
    const setup = async () => {
      agoraEngineRef.current = createAgoraRtcEngine();
      const agoraEngine = agoraEngineRef.current;
      agoraEngine.addListener('onJoinChannelSuccess', () => setIsJoined(true));
      agoraEngine.addListener('onUserJoined', (_: any, remoteUid: number) =>
        setRemoteUids((prev: number[]) =>
          prev.includes(remoteUid) ? prev : [...prev, remoteUid],
        ),
      );
      agoraEngine.addListener('onUserOffline', (_: any, remoteUid: number) =>
        setRemoteUids((prev: number[]) =>
          prev.filter((uid: number) => uid !== remoteUid),
        ),
      );
      agoraEngine.addListener('onLeaveChannel', () => {
        setIsJoined(false);
        setRemoteUids([]);
      });
      agoraEngine.addListener('onConnectionStateChanged', (state: number) => {
        if (state === 3) setConnectionStatus('good');
        else if (state === 5) setConnectionStatus('lost');
        else if (state === 2) setConnectionStatus('poor');
        else setConnectionStatus(null);
      });
      await agoraEngine.initialize({
        appId: '4a75f775a2a6427792d534a048ae00a2',
      });
      await agoraEngine.enableVideo();
      await agoraEngine.enableAudio();
      await agoraEngine.setChannelProfile(
        ChannelProfileType.ChannelProfileLiveBroadcasting,
      );
      await agoraEngine.startPreview();
      setIsEngineReady(true);
    };
    setup();
    return () => {
      agoraEngineRef.current?.release && agoraEngineRef.current.release();
    };
  }, []);

  useEffect(() => {
    if (isEngineReady && !isJoined) {
      join();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEngineReady]);

  const join = async () => {
    try {
      const response = await fetch(
        `http://172.16.7.112:3000/rtcToken?channelName=${encodeURIComponent(
          channelName,
        )}&uid=${user.id}&role=publisher`,
      );
      if (!response.ok) throw new Error('Failed to fetch token from backend');
      const data = await response.json();
      const token = data.token;
      if (!token) throw new Error('No token received from backend');
      await agoraEngineRef.current.setClientRole(
        ClientRoleType.ClientRoleBroadcaster,
      );
      await agoraEngineRef.current.joinChannel(token, channelName, user.id, {});
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      Alert.alert('Join Failed', msg);
      onLeave();
    }
  };

  const leave = async () => {
    if (!isJoined || !agoraEngineRef.current) return;
    try {
      await agoraEngineRef.current.leaveChannel();
      onLeave();
    } catch (error) {
      Alert.alert('Leave Error', String(error));
    }
  };

  const switchCamera = async () => {
    if (!agoraEngineRef.current) return;
    try {
      await agoraEngineRef.current.switchCamera();
    } catch (error) {
      Alert.alert('Switch Camera Error', String(error));
    }
  };

  const toggleCamera = async () => {
    if (!agoraEngineRef.current) return;
    try {
      await agoraEngineRef.current.enableLocalVideo(!isCameraEnabled);
      setIsCameraEnabled((prev: boolean) => !prev);
    } catch (error) {
      Alert.alert('Camera Error', String(error));
    }
  };

  const toggleMic = async () => {
    if (!agoraEngineRef.current) return;
    try {
      await agoraEngineRef.current.enableLocalAudio(!isMicEnabled);
      setIsMicEnabled((prev: boolean) => !prev);
    } catch (error) {
      Alert.alert('Mic Error', String(error));
    }
  };

  const allVideoUids = [0, ...remoteUids];
  const usersPerPage = 4;
  const totalPages = Math.ceil(allVideoUids.length / usersPerPage);
  // Split UIDs into pages of 4
  const pagedUids: number[][] = [];
  for (let i = 0; i < allVideoUids.length; i += usersPerPage) {
    pagedUids.push(allVideoUids.slice(i, i + usersPerPage));
  }

  const participants = [
    {
      uid: 0,
      name: user.name,
      isLocal: true,
      mic: isMicEnabled,
      cam: isCameraEnabled,
    },
    ...remoteUids.map(uid => ({
      uid,
      name: `User ${uid}`,
      isLocal: false,
      mic: true,
      cam: true,
    })),
  ];

  // --- Render Video Tiles for a Page ---
  const renderVideoPage = ({ item: uids }: { item: number[] }) => {
    const numTiles = uids.length;
    const { width, height } = Dimensions.get('window');
    // Calculate available height: minus top bar and bottom controls
    const topBarHeight = 56 + (Platform.OS === 'ios' ? 44 : 24);
    const bottomBarHeight = 90;
    const availableHeight = height - topBarHeight - bottomBarHeight;
    let gridStyle: any = {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      width,
    };
    let tileStyle: any = { width: width - 32, height: availableHeight };
    if (numTiles === 2) {
      gridStyle = {
        flex: 1,
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        width,
      };
      tileStyle = { width: width - 32, height: availableHeight / 2 - 8 };
    } else if (numTiles > 2) {
      gridStyle = {
        flex: 1,
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'center',
        alignItems: 'center',
        width,
      };
      tileStyle = {
        width: (width - 40) / 2,
        height: (availableHeight - 16) / 2,
      };
    }
    return (
      <View style={gridStyle}>
        {uids.map((uid: number, _: number) => (
          <View
            key={uid}
            style={[
              styles.videoContainer,
              tileStyle,
              uid === 0 ? styles.localBorder : null,
            ]}
          >
            {isEngineReady && (
              <RtcSurfaceView style={styles.videoView} canvas={{ uid }} />
            )}
            <View style={styles.overlayTop}>
              <Text style={styles.overlayText}>
                {uid === 0 ? 'You' : `User ${uid}`}
              </Text>
            </View>
            {uid === 0 && (
              <View style={styles.overlayBottom}>
                <Text
                  style={{
                    color: isCameraEnabled ? '#0f0' : '#f00',
                    marginRight: 8,
                  }}
                >
                  {isCameraEnabled ? '📹' : '🚫'}
                </Text>
                <Text style={{ color: isMicEnabled ? '#0f0' : '#f00' }}>
                  {isMicEnabled ? '🎤' : '🔇'}
                </Text>
              </View>
            )}
          </View>
        ))}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.main}>
      {/* Top Bar */}
      <View style={styles.topBar}>
        <Text style={styles.meetingTitle}>{channelName}</Text>
        <View style={styles.statusDotContainer}>
          {connectionStatus === 'good' && (
            <Text style={styles.statusDotGood}>●</Text>
          )}
          {connectionStatus === 'poor' && (
            <Text style={styles.statusDotPoor}>●</Text>
          )}
          {connectionStatus === 'lost' && (
            <Text style={styles.statusDotLost}>●</Text>
          )}
        </View>
      </View>
      {/* Connection Status Banner */}
      {connectionStatus && (
        <View style={styles.banner}>
          <Text style={styles.bannerText}>
            {connectionStatus === 'good' && 'Connected'}
            {connectionStatus === 'poor' && 'Connecting...'}
            {connectionStatus === 'lost' && 'Reconnecting...'}
          </Text>
        </View>
      )}
      {/* Video Grid with Pagination */}
      <FlatList
        data={pagedUids}
        renderItem={renderVideoPage}
        keyExtractor={(_, idx) => `page-${idx}`}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={e => {
          const page = Math.round(
            e.nativeEvent.contentOffset.x / Dimensions.get('window').width,
          );
          setCurrentPage(page);
        }}
        style={{ flex: 1 }}
      />
      {/* Page Indicator (dots) */}
      {totalPages > 1 && (
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'center',
            alignItems: 'center',
            paddingVertical: 8,
          }}
        >
          {Array.from({ length: totalPages }, (_, i) => (
            <View
              key={i}
              style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor:
                  i === currentPage ? '#007AFF' : 'rgba(255,255,255,0.3)',
                marginHorizontal: 4,
              }}
            />
          ))}
        </View>
      )}
      {/* Bottom Floating Controls */}
      <View style={styles.fabBarFixed}>
        <TouchableOpacity style={styles.fab} onPress={toggleMic}>
          <Text style={styles.fabIcon}>{isMicEnabled ? '🎤' : '🔇'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.fab} onPress={toggleCamera}>
          <Text style={styles.fabIcon}>{isCameraEnabled ? '📹' : '🚫'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.fab} onPress={switchCamera}>
          <Text style={styles.fabIcon}>🔄</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.fab}
          onPress={() => setShowParticipants(true)}
        >
          <Text style={styles.fabIcon}>👥</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.fab, { backgroundColor: '#dc3545' }]}
          onPress={leave}
        >
          <Text style={styles.fabIcon}>🚪</Text>
        </TouchableOpacity>
      </View>
      {/* Participants Modal */}
      {showParticipants && (
        <View style={styles.participantModalOverlay}>
          <View style={styles.participantModal}>
            <Text style={styles.participantTitle}>Participants</Text>
            {participants.map(p => (
              <View key={p.uid} style={styles.participantRow}>
                <Text style={{ fontWeight: p.isLocal ? 'bold' : 'normal' }}>
                  {p.name}
                </Text>
                <Text style={{ marginLeft: 8 }}>{p.mic ? '🎤' : '🔇'}</Text>
                <Text style={{ marginLeft: 8 }}>{p.cam ? '📹' : '🚫'}</Text>
              </View>
            ))}
            <TouchableOpacity
              style={styles.closeModalBtn}
              onPress={() => setShowParticipants(false)}
            >
              <Text style={{ color: '#fff' }}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  main: { flex: 1, backgroundColor: '#0a0a0a' },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: 'rgba(20,20,20,0.95)',
    borderBottomWidth: 1,
    borderBottomColor: '#232323',
    zIndex: 10,
  },
  meetingTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    flex: 1,
    letterSpacing: 0.5,
  },
  statusDotContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDotGood: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#34C759',
    marginLeft: 8,
  },
  statusDotPoor: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#FF9500',
    marginLeft: 8,
  },
  statusDotLost: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#FF3B30',
    marginLeft: 8,
  },
  banner: {
    backgroundColor: '#232323',
    padding: 10,
    alignItems: 'center',
  },
  bannerText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#fff',
    letterSpacing: 0.2,
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    padding: 10,
    minHeight: 200,
  },
  videoContainer: {
    backgroundColor: '#18181a',
    borderRadius: 16,
    margin: 8,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.08)',
    position: 'relative',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 2,
  },
  localBorder: {
    borderColor: '#007AFF',
    borderWidth: 2,
  },
  videoView: { width: '100%', height: '100%' },
  overlayTop: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    zIndex: 2,
  },
  overlayText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  overlayBottom: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    flexDirection: 'row',
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignItems: 'center',
    zIndex: 2,
  },
  fabBarFixed: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(20,20,20,0.95)',
    borderTopWidth: 1,
    borderTopColor: '#232323',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 16,
    paddingTop: 8,
    zIndex: 100,
  },
  fab: {
    backgroundColor: '#007AFF',
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 10,
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 8,
  },
  fabIcon: { fontSize: 26, color: '#fff' },
  participantModalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  participantModal: {
    backgroundColor: '#232323',
    padding: 24,
    borderRadius: 16,
    width: '85%',
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  participantTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 14,
    letterSpacing: 0.3,
  },
  participantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  closeModalBtn: {
    backgroundColor: '#FF3B30',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 18,
  },
});

export default VideoRoomScreen;
