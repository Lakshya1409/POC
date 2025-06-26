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
  ScrollView,
} from 'react-native';
import {
  ClientRoleType,
  createAgoraRtcEngine,
  ChannelProfileType,
  RtcSurfaceView,
  VideoSourceType,
} from 'react-native-agora';
// import CallChat from './CallChat';

const backendUrl = 'http://172.16.11.52:8001';
// const backendUrl='http://192.168.0.105:8001'

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
  const [chatVisible, setChatVisible] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  // Track remote users' video states
  const [remoteVideoStates, setRemoteVideoStates] = useState<{
    [uid: number]: boolean;
  }>({});

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
        `${backendUrl}/rtcToken?channelName=${encodeURIComponent(
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

  // --- Screen Sharing Logic ---
  const startScreenShare = async () => {
    if (!agoraEngineRef.current) return;
    try {
      await agoraEngineRef.current.startScreenCapture({
        captureAudio: true,
        captureVideo: true,
        videoCaptureParameters: {
          dimensions: { width: 1280, height: 720 },
          frameRate: 15,
          bitrate: 2000,
        },
        audioCaptureParameters: {
          sampleRate: 44100,
          channel: 2,
          captureSignalVolume: 100,
        },
      });
      await agoraEngineRef.current.updateChannelMediaOptions({
        publishCameraTrack: false,
        publishScreenCaptureVideo: true,
        publishScreenCaptureAudio: true,
      });
      setIsScreenSharing(true);
    } catch (error) {
      Alert.alert('Screen Share Error', String(error));
    }
  };

  const stopScreenShare = async () => {
    if (!agoraEngineRef.current) return;
    try {
      await agoraEngineRef.current.stopScreenCapture();
      await agoraEngineRef.current.updateChannelMediaOptions({
        publishCameraTrack: true,
        publishScreenCaptureVideo: false,
        publishScreenCaptureAudio: false,
      });
      setIsScreenSharing(false);
    } catch (error) {
      Alert.alert('Screen Share Error', String(error));
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

  // Helper function to get user display name
  const getUserDisplayName = (uid: number) => {
    if (uid === 0) {
      return user.name || `User ${user.id}`;
    }
    // You can extend this to fetch actual names from your backend
    return `User ${uid}`;
  };

  // Helper function to get user initials for placeholder
  const getUserInitials = (name: string) => {
    if (!name) return 'TU'; // Default user name initials if no name present
    return name
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  // Helper function to check if video should be shown
  const shouldShowVideo = (uid: number) => {
    if (uid === 0) {
      return isCameraEnabled;
    }
    return remoteVideoStates[uid] !== false; // Show video by default until we know it's off
  };

  // Render video tile with placeholder and name overlay
  const renderVideoTile = (uid: number, style: any) => {
    const showVideo = shouldShowVideo(uid);
    const displayName = getUserDisplayName(uid);
    const initials = getUserInitials(displayName);

    return (
      <View style={[style, { position: 'relative' }]}>
        {showVideo && isEngineReady ? (
          <RtcSurfaceView style={styles.videoView} canvas={{ uid }} />
        ) : (
          // Placeholder when camera is off
          <View style={styles.placeholderBg}>
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarText}>{initials}</Text>
            </View>
          </View>
        )}
        {/* Name overlay - always visible */}
        <View style={styles.simpleNameOverlay}>
          <Text style={styles.simpleNameText}>{displayName}</Text>
        </View>
      </View>
    );
  };

  // --- Render Video Tiles for a Page ---
  const renderVideoPage = ({ item: uids }: { item: number[] }) => {
    const numTiles = uids.length;
    const { width, height } = Dimensions.get('window');
    // Calculate available height: minus top bar and bottom controls
    const topBarHeight = 56 + 24; // Approximate for Android/iOS
    const bottomBarHeight = 106; // Matches paddingBottom
    const availableHeight = height - topBarHeight - bottomBarHeight;
    const gap = 8;

    if (numTiles === 1) {
      // Single user: full tile
      return (
        <View
          style={{
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            width,
          }}
        >
          {renderVideoTile(uids[0], {
            width: width - 32,
            height: availableHeight,
            borderRadius: 16,
            overflow: 'hidden',
          })}
        </View>
      );
    } else if (numTiles === 2) {
      // Two users: vertical split
      return (
        <View
          style={{
            flex: 1,
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            width,
          }}
        >
          {[0, 1].map(i =>
            renderVideoTile(uids[i], {
              width: width - 32,
              height: (availableHeight - gap) / 2,
              marginBottom: i === 0 ? gap : 0,
              borderRadius: 16,
              overflow: 'hidden',
            }),
          )}
        </View>
      );
    } else if (numTiles === 3) {
      // Three users: two tiles on top row, one tile on bottom row
      const tileHeight = (availableHeight - gap) / 2;
      const tileWidth = (width - 32 - gap) / 2;
      return (
        <View
          style={{
            flex: 1,
            width,
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              width: width - 32,
              height: tileHeight,
              marginBottom: gap,
            }}
          >
            {[0, 1].map(i =>
              renderVideoTile(uids[i], {
                width: tileWidth,
                height: tileHeight,
                marginRight: i === 0 ? gap : 0,
                borderRadius: 16,
                overflow: 'hidden',
              }),
            )}
          </View>
          <View
            style={{
              width: width - 32,
              height: tileHeight,
              borderRadius: 16,
              overflow: 'hidden',
            }}
          >
            {renderVideoTile(uids[2], {
              width: width - 32,
              height: tileHeight,
              borderRadius: 16,
              overflow: 'hidden',
            })}
          </View>
        </View>
      );
    } else if (numTiles === 4) {
      // Four users: 2x2 grid of squares
      const tileHeight = (availableHeight - gap) / 2;
      const tileWidth = (width - 32 - gap) / 2;
      return (
        <View
          style={{
            flex: 1,
            width,
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              width: width - 32,
              height: tileHeight,
              marginBottom: gap,
            }}
          >
            {[0, 1].map(i =>
              renderVideoTile(uids[i], {
                width: tileWidth,
                height: tileHeight,
                marginRight: i === 0 ? gap : 0,
                borderRadius: 16,
                overflow: 'hidden',
              }),
            )}
          </View>
          <View
            style={{
              flexDirection: 'row',
              width: width - 32,
              height: tileHeight,
            }}
          >
            {[2, 3].map(i =>
              renderVideoTile(uids[i], {
                width: tileWidth,
                height: tileHeight,
                marginRight: i === 2 ? gap : 0,
                borderRadius: 16,
                overflow: 'hidden',
              }),
            )}
          </View>
        </View>
      );
    } else {
      // Fallback: default to vertical list
      return (
        <View
          style={{
            flex: 1,
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            width,
          }}
        >
          {uids.map(uid =>
            renderVideoTile(uid, {
              width: width - 32,
              height: 120,
              marginBottom: gap,
              borderRadius: 16,
              overflow: 'hidden',
            }),
          )}
        </View>
      );
    }
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
      {/* Video Grid with Pagination (add wrapper with paddingBottom) */}
      <View style={{ flex: 1, paddingBottom: 106 }}>
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
      </View>
      {/* Page Indicator (dots) - absolutely above the control bar */}
      {totalPages > 1 && (
        <View
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 80, // just above the control bar (fabBarFixed)
            flexDirection: 'row',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 150,
            paddingVertical: 4,
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
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.fabBarScroll}
        >
          <TouchableOpacity style={styles.iconBtn} onPress={toggleMic}>
            <Text style={styles.iconText}>{isMicEnabled ? '🎤' : '🔇'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconBtn} onPress={toggleCamera}>
            <Text style={styles.iconText}>{isCameraEnabled ? '📹' : '🚫'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconBtn} onPress={switchCamera}>
            <Text style={styles.iconText}>🔄</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.iconBtn,
              isScreenSharing && { backgroundColor: '#007AFF' },
            ]}
            onPress={isScreenSharing ? stopScreenShare : startScreenShare}
          >
            <Text style={styles.iconText}>{isScreenSharing ? '🛑' : '🖥️'}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => setShowParticipants(true)}
          >
            <Text style={styles.iconText}>👥</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconBtn} onPress={leave}>
            <Text style={styles.iconText}>🚪</Text>
          </TouchableOpacity>
          {/* <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => setChatVisible(true)}
          >
            <Text style={styles.iconText}>💬</Text>
          </TouchableOpacity> */}
        </ScrollView>
      </View>
      {/* Screen Sharing Banner */}
      {isScreenSharing && (
        <View
          style={{
            position: 'absolute',
            top: 60,
            left: 0,
            right: 0,
            backgroundColor: '#007AFF',
            padding: 8,
            zIndex: 200,
            alignItems: 'center',
          }}
        >
          <Text style={{ color: '#fff', fontWeight: 'bold' }}>
            You are sharing your screen
          </Text>
        </View>
      )}
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
      {/* <CallChat
        userId={user.id}
        userName={user.name}
        channelName={channelName}
        visible={chatVisible}
        onClose={() => setChatVisible(false)}
        backendUrl={backendUrl}
      /> */}
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
    paddingBottom: 12,
    paddingTop: 8,
    zIndex: 100,
  },
  fabBarScroll: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingHorizontal: 8,
  },
  iconBtn: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 18,
    marginHorizontal: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconText: {
    fontSize: 28,
    color: '#fff',
  },
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
  placeholderBg: {
    flex: 1,
    backgroundColor: '#2d3748',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 16,
  },
  placeholderText: {
    color: '#fff',
    fontSize: 36,
    fontWeight: '700',
    letterSpacing: 1,
  },
  simpleNameOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingVertical: 6,
    alignItems: 'center',
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
  },
  simpleNameText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  avatarCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatarText: {
    color: '#fff',
    fontSize: 28,
    fontWeight: 'bold',
  },
});

export default VideoRoomScreen;
