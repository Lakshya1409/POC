import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  SafeAreaView,
  Text,
  View,
  TouchableOpacity,
  Alert,
  Dimensions,
  StyleSheet,
  StatusBar,
  Animated,
  Platform,
  ScrollView,
} from 'react-native';
import {
  ClientRoleType,
  createAgoraRtcEngine,
  ChannelProfileType,
  RtcSurfaceView,
  VideoSourceType,
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
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [maximizedUid, setMaximizedUid] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [connectionStatus, setConnectionStatus] = useState<
    'good' | 'poor' | 'lost' | null
  >(null);

  const agoraEngineRef = useRef<any>(null);
  const controlsOpacity = useRef(new Animated.Value(1)).current;
  const controlsTimer = useRef<NodeJS.Timeout | null>(null);

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
      if (controlsTimer.current) {
        clearTimeout(controlsTimer.current);
      }
      agoraEngineRef.current?.release && agoraEngineRef.current.release();
    };
  }, []);

  const join = useCallback(async () => {
    try {
      const response = await fetch(
        `http://10.0.2.2:3000/rtcToken?channelName=${encodeURIComponent(
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
  }, [channelName, user.id, onLeave]);

  useEffect(() => {
    if (isEngineReady && !isJoined) {
      join();
    }
  }, [isEngineReady, isJoined, join]);

  const hideControls = useCallback(() => {
    Animated.timing(controlsOpacity, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start(() => setShowControls(false));
  }, [controlsOpacity]);

  // Auto-hide controls after 3 seconds
  useEffect(() => {
    if (showControls) {
      if (controlsTimer.current) {
        clearTimeout(controlsTimer.current);
      }
      controlsTimer.current = setTimeout(() => {
        hideControls();
      }, 3000);
    }
    return () => {
      if (controlsTimer.current) {
        clearTimeout(controlsTimer.current);
      }
    };
  }, [showControls, hideControls]);

  const showControlsTemp = () => {
    if (!showControls) {
      setShowControls(true);
      Animated.timing(controlsOpacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  };

  const leave = async () => {
    if (!isJoined || !agoraEngineRef.current) return;
    try {
      if (isScreenSharing) {
        await stopScreenShare();
      }
      await agoraEngineRef.current.leaveChannel();
      onLeave();
    } catch (error) {
      Alert.alert('Leave Error', String(error));
    }
  };

  const switchCamera = async () => {
    if (!agoraEngineRef.current || isScreenSharing) return;
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

  const startScreenShare = async () => {
    if (!agoraEngineRef.current) return;
    try {
      await agoraEngineRef.current.enableLocalVideo(false);

      await agoraEngineRef.current.startScreenCapture({
        videoCaptureParameters: {
          dimensions: { width: 1280, height: 720 },
          frameRate: 15,
          bitrate: 2000,
        },
        audioParameters: {
          sampleRate: 44100,
          channel: 2,
          captureSignalVolume: 100,
        },
        captureAudio: true,
        captureVideo: true,
      });

      setIsScreenSharing(true);
      setIsCameraEnabled(false);

      Alert.alert('Screen Sharing', 'Screen sharing started successfully');
    } catch (error) {
      Alert.alert('Screen Share Error', String(error));
    }
  };

  const stopScreenShare = async () => {
    if (!agoraEngineRef.current) return;
    try {
      await agoraEngineRef.current.stopScreenCapture();
      await agoraEngineRef.current.enableLocalVideo(true);

      setIsScreenSharing(false);
      setIsCameraEnabled(true);

      Alert.alert('Screen Sharing', 'Screen sharing stopped');
    } catch (error) {
      Alert.alert('Stop Screen Share Error', String(error));
    }
  };

  const toggleMaximize = (uid: number) => {
    setMaximizedUid(maximizedUid === uid ? null : uid);
  };

  const allVideoUids = [0, ...remoteUids];
  const { width, height } = Dimensions.get('window');

  // Calculate pages for navigation (4 users per page)
  const usersPerPage = 4;
  const totalPages = Math.ceil(allVideoUids.length / usersPerPage);
  const startIndex = currentPage * usersPerPage;
  const endIndex = Math.min(startIndex + usersPerPage, allVideoUids.length);
  const currentPageUsers = allVideoUids.slice(startIndex, endIndex);

  // Dynamic layout calculation
  const getLayoutConfig = (userCount: number) => {
    const availableHeight = height - 200; // Account for controls
    const availableWidth = width - 20; // Account for padding

    switch (userCount) {
      case 1:
        return {
          columns: 1,
          rows: 1,
          width: availableWidth,
          height: availableHeight,
          gap: 0,
        };
      case 2:
        return {
          columns: 1,
          rows: 2,
          width: availableWidth,
          height: (availableHeight - 10) / 2,
          gap: 10,
        };
      case 3:
        return {
          columns: 2,
          rows: 2,
          width: (availableWidth - 10) / 2,
          height: (availableHeight - 10) / 2,
          gap: 10,
        };
      case 4:
        return {
          columns: 2,
          rows: 2,
          width: (availableWidth - 10) / 2,
          height: (availableHeight - 10) / 2,
          gap: 10,
        };
      default:
        return {
          columns: 2,
          rows: 2,
          width: (availableWidth - 10) / 2,
          height: (availableHeight - 10) / 2,
          gap: 10,
        };
    }
  };

  const layoutConfig = getLayoutConfig(currentPageUsers.length);

  const getVideoStyle = (index: number) => {
    if (layoutConfig.columns === 1) {
      return {
        width: layoutConfig.width,
        height: layoutConfig.height,
        marginBottom:
          index < currentPageUsers.length - 1 ? layoutConfig.gap : 0,
      };
    } else {
      const isLastRowOdd =
        currentPageUsers.length % 2 === 1 &&
        index === currentPageUsers.length - 1;
      return {
        width:
          isLastRowOdd && currentPageUsers.length === 3
            ? layoutConfig.width
            : layoutConfig.width,
        height: layoutConfig.height,
        marginRight: index % 2 === 0 ? layoutConfig.gap : 0,
        marginBottom:
          index < currentPageUsers.length - 2 ? layoutConfig.gap : 0,
      };
    }
  };

  const participants = [
    {
      uid: 0,
      name: user.name,
      isLocal: true,
      mic: isMicEnabled,
      cam: isCameraEnabled && !isScreenSharing,
      isScreenSharing,
    },
    ...remoteUids.map(uid => ({
      uid,
      name: `User ${uid}`,
      isLocal: false,
      mic: true,
      cam: true,
      isScreenSharing: false,
    })),
  ];

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0a0a0a" />

      {/* Maximized Video Modal */}
      {maximizedUid !== null && (
        <View style={styles.maximizedVideoContainer}>
          <TouchableOpacity
            style={styles.maximizedVideoClose}
            onPress={() => setMaximizedUid(null)}
          >
            <Text style={styles.maximizedVideoCloseText}>✕</Text>
          </TouchableOpacity>

          <View style={styles.maximizedVideo}>
            {isEngineReady && (
              <RtcSurfaceView
                style={styles.maximizedVideoView}
                canvas={{
                  uid: maximizedUid,
                  sourceType:
                    maximizedUid === 0 && isScreenSharing
                      ? VideoSourceType.VideoSourceScreen
                      : VideoSourceType.VideoSourceCamera,
                }}
              />
            )}

            <View style={styles.maximizedVideoOverlay}>
              <Text style={styles.maximizedVideoName}>
                {maximizedUid === 0 ? 'You' : `User ${maximizedUid}`}
                {maximizedUid === 0 && isScreenSharing && ' (Screen)'}
              </Text>
            </View>
          </View>
        </View>
      )}

      {/* Main Video Container */}
      <TouchableOpacity
        style={styles.videoContainer}
        activeOpacity={1}
        onPress={showControlsTemp}
      >
        <View style={styles.videoGrid}>
          {currentPageUsers.map((uid, index) => {
            const videoStyle = getVideoStyle(index);
            const isSpecialLayout =
              currentPageUsers.length === 3 && index === 2;

            return (
              <View
                key={uid}
                style={[
                  styles.videoTile,
                  videoStyle,
                  uid === 0 ? styles.localVideoTile : styles.remoteVideoTile,
                  isSpecialLayout && styles.centerVideoTile,
                ]}
              >
                {isEngineReady && (
                  <RtcSurfaceView
                    style={styles.videoView}
                    canvas={{
                      uid,
                      sourceType:
                        uid === 0 && isScreenSharing
                          ? VideoSourceType.VideoSourceScreen
                          : VideoSourceType.VideoSourceCamera,
                    }}
                  />
                )}

                {/* Video Controls Overlay */}
                <View style={styles.videoOverlay}>
                  {/* Top Section - Name and Maximize */}
                  <View style={styles.videoTopSection}>
                    <View style={styles.nameTag}>
                      <Text style={styles.nameText}>
                        {uid === 0 ? 'You' : `User ${uid}`}
                        {uid === 0 && isScreenSharing && ' 🖥️'}
                      </Text>
                    </View>

                    <TouchableOpacity
                      style={styles.maximizeButton}
                      onPress={() => toggleMaximize(uid)}
                    >
                      <Text style={styles.maximizeIcon}>⛶</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Bottom Section - Status Icons */}
                  <View style={styles.videoBottomSection}>
                    {uid === 0 && (
                      <View style={styles.statusIcons}>
                        <View
                          style={[
                            styles.statusIcon,
                            {
                              backgroundColor: isMicEnabled
                                ? 'rgba(0, 0, 0, 0.6)'
                                : 'rgba(220, 53, 69, 0.9)',
                            },
                          ]}
                        >
                          <Text style={styles.iconText}>
                            {isMicEnabled ? '🎤' : '🔇'}
                          </Text>
                        </View>
                        {!isScreenSharing && (
                          <View
                            style={[
                              styles.statusIcon,
                              {
                                backgroundColor: isCameraEnabled
                                  ? 'rgba(0, 0, 0, 0.6)'
                                  : 'rgba(220, 53, 69, 0.9)',
                              },
                            ]}
                          >
                            <Text style={styles.iconText}>
                              {isCameraEnabled ? '📹' : '🚫'}
                            </Text>
                          </View>
                        )}
                      </View>
                    )}

                    {/* Connection Quality Indicator */}
                    <View style={styles.connectionQuality}>
                      <View
                        style={[
                          styles.qualityDot,
                          {
                            backgroundColor:
                              connectionStatus === 'good'
                                ? '#34C759'
                                : connectionStatus === 'poor'
                                ? '#FF9500'
                                : connectionStatus === 'lost'
                                ? '#FF3B30'
                                : '#8E8E93',
                          },
                        ]}
                      />
                    </View>
                  </View>
                </View>
              </View>
            );
          })}
        </View>
      </TouchableOpacity>

      {/* Page Navigation */}
      {totalPages > 1 && (
        <Animated.View
          style={[styles.pageNavigation, { opacity: controlsOpacity }]}
        >
          <TouchableOpacity
            style={[
              styles.navButton,
              currentPage === 0 && styles.navButtonDisabled,
            ]}
            onPress={() => setCurrentPage(Math.max(0, currentPage - 1))}
            disabled={currentPage === 0}
          >
            <Text style={styles.navButtonText}>‹</Text>
          </TouchableOpacity>

          <View style={styles.pageIndicator}>
            {Array.from({ length: totalPages }, (_, i) => (
              <View
                key={i}
                style={[
                  styles.pageDot,
                  i === currentPage && styles.pageDotActive,
                ]}
              />
            ))}
          </View>

          <TouchableOpacity
            style={[
              styles.navButton,
              currentPage === totalPages - 1 && styles.navButtonDisabled,
            ]}
            onPress={() =>
              setCurrentPage(Math.min(totalPages - 1, currentPage + 1))
            }
            disabled={currentPage === totalPages - 1}
          >
            <Text style={styles.navButtonText}>›</Text>
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* Top Bar */}
      <Animated.View style={[styles.topBar, { opacity: controlsOpacity }]}>
        <View style={styles.meetingInfo}>
          <Text style={styles.meetingTitle}>{channelName}</Text>
          <View style={styles.connectionIndicator}>
            <View
              style={[
                styles.connectionDot,
                {
                  backgroundColor:
                    connectionStatus === 'good'
                      ? '#34C759'
                      : connectionStatus === 'poor'
                      ? '#FF9500'
                      : connectionStatus === 'lost'
                      ? '#FF3B30'
                      : '#8E8E93',
                },
              ]}
            />
            <Text style={styles.connectionText}>
              {connectionStatus === 'good' && 'HD'}
              {connectionStatus === 'poor' && 'Low quality'}
              {connectionStatus === 'lost' && 'Reconnecting...'}
              {!connectionStatus && 'Connecting...'}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.participantsButton}
          onPress={() => setShowParticipants(true)}
        >
          <Text style={styles.participantsCount}>{participants.length}</Text>
          <Text style={styles.participantsIcon}>👥</Text>
        </TouchableOpacity>
      </Animated.View>

      {/* Bottom Controls */}
      <Animated.View
        style={[styles.bottomControls, { opacity: controlsOpacity }]}
      >
        <View style={styles.controlsRow}>
          <TouchableOpacity
            style={[
              styles.controlButton,
              !isMicEnabled && styles.controlButtonDisabled,
            ]}
            onPress={toggleMic}
          >
            <Text style={styles.controlIcon}>{isMicEnabled ? '🎤' : '🔇'}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.controlButton,
              (!isCameraEnabled || isScreenSharing) &&
                styles.controlButtonDisabled,
            ]}
            onPress={toggleCamera}
            disabled={isScreenSharing}
          >
            <Text style={styles.controlIcon}>
              {isCameraEnabled && !isScreenSharing ? '📹' : '🚫'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.controlButton,
              isScreenSharing && styles.controlButtonActive,
            ]}
            onPress={isScreenSharing ? stopScreenShare : startScreenShare}
          >
            <Text style={styles.controlIcon}>🖥️</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.controlButton,
              isScreenSharing && styles.controlButtonDisabled,
            ]}
            onPress={switchCamera}
            disabled={isScreenSharing}
          >
            <Text style={styles.controlIcon}>🔄</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.controlButton, styles.endCallButton]}
            onPress={leave}
          >
            <Text style={styles.controlIcon}>📞</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>

      {/* Participants Modal */}
      {showParticipants && (
        <View style={styles.modalOverlay}>
          <View style={styles.participantsModal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                Participants ({participants.length})
              </Text>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setShowParticipants(false)}
              >
                <Text style={styles.closeButtonText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.participantsList}>
              {participants.map(participant => (
                <View key={participant.uid} style={styles.participantItem}>
                  <View style={styles.participantAvatar}>
                    <Text style={styles.avatarText}>
                      {participant.name.charAt(0).toUpperCase()}
                    </Text>
                  </View>

                  <View style={styles.participantInfo}>
                    <Text style={styles.participantName}>
                      {participant.name}
                      {participant.isLocal && ' (You)'}
                    </Text>
                    {participant.isScreenSharing && (
                      <Text style={styles.screenShareLabel}>
                        Screen sharing
                      </Text>
                    )}
                  </View>

                  <View style={styles.participantControls}>
                    <View
                      style={[
                        styles.miniIcon,
                        { opacity: participant.mic ? 1 : 0.3 },
                      ]}
                    >
                      <Text style={styles.miniIconText}>🎤</Text>
                    </View>
                    <View
                      style={[
                        styles.miniIcon,
                        {
                          opacity:
                            participant.cam && !participant.isScreenSharing
                              ? 1
                              : 0.3,
                        },
                      ]}
                    >
                      <Text style={styles.miniIconText}>📹</Text>
                    </View>
                  </View>
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  videoContainer: {
    flex: 1,
    padding: 10,
  },
  videoGrid: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoTile: {
    backgroundColor: '#1c1c1e',
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  localVideoTile: {
    borderColor: '#007AFF',
  },
  remoteVideoTile: {
    borderColor: '#2c2c2e',
  },
  centerVideoTile: {
    alignSelf: 'center',
  },
  videoView: {
    width: '100%',
    height: '100%',
  },
  videoOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'space-between',
    padding: 12,
  },
  videoTopSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  nameTag: {
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    maxWidth: '70%',
  },
  nameText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  maximizeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  maximizeIcon: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  videoBottomSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  statusIcons: {
    flexDirection: 'row',
    gap: 6,
  },
  statusIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconText: {
    fontSize: 14,
  },
  connectionQuality: {
    alignItems: 'center',
  },
  qualityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  pageNavigation: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 20,
  },
  navButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  navButtonDisabled: {
    opacity: 0.3,
  },
  navButtonText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: 'bold',
  },
  pageIndicator: {
    flexDirection: 'row',
    gap: 6,
  },
  pageDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  pageDotActive: {
    backgroundColor: '#007AFF',
  },
  maximizedVideoContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#000000',
    zIndex: 3000,
  },
  maximizedVideoClose: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 40,
    right: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 3001,
  },
  maximizedVideoCloseText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: 'bold',
  },
  maximizedVideo: {
    flex: 1,
    position: 'relative',
  },
  maximizedVideoView: {
    width: '100%',
    height: '100%',
  },
  maximizedVideoOverlay: {
    position: 'absolute',
    bottom: 40,
    left: 20,
    right: 20,
    alignItems: 'center',
  },
  maximizedVideoName: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
  },
  topBar: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 20,
    left: 20,
    right: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 1000,
  },
  meetingInfo: {
    flex: 1,
  },
  meetingTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  connectionIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  connectionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  connectionText: {
    color: '#FFFFFF',
    fontSize: 12,
    opacity: 0.8,
  },
  participantsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 4,
  },
  participantsCount: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  participantsIcon: {
    fontSize: 16,
  },
  bottomControls: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 40 : 20,
    left: 20,
    right: 20,
    zIndex: 1000,
  },
  controlsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
  },
  controlButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  controlButtonDisabled: {
    backgroundColor: 'rgba(220, 53, 69, 0.8)',
  },
  controlButtonActive: {
    backgroundColor: '#007AFF',
  },
  endCallButton: {
    backgroundColor: '#FF3B30',
  },
  controlIcon: {
    fontSize: 24,
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2000,
  },
  participantsModal: {
    backgroundColor: '#2c2c2e',
    borderRadius: 16,
    width: '90%',
    maxHeight: '80%',
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#3a3a3c',
  },
  modalTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  participantsList: {
    padding: 20,
  },
  participantItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  participantAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  participantInfo: {
    flex: 1,
  },
  participantName: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '500',
  },
  screenShareLabel: {
    color: '#34C759',
    fontSize: 12,
    marginTop: 2,
  },
  participantControls: {
    flexDirection: 'row',
    gap: 8,
  },
  miniIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  miniIconText: {
    fontSize: 12,
  },
});

export default VideoRoomScreen;
