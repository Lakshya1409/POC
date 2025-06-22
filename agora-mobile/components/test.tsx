// import React, { useState, useRef, useEffect } from 'react';
// import {
//   SafeAreaView,
//   Text,
//   View,
//   TouchableOpacity,
//   Alert,
//   Dimensions,
//   StyleSheet,
// } from 'react-native';
// import {
//   ClientRoleType,
//   createAgoraRtcEngine,
//   ChannelProfileType,
//   RtcSurfaceView,
// } from 'react-native-agora';

// interface VideoRoomScreenProps {
//   user: { id: number; name: string; enrolledMeetings: string[] };
//   channelName: string;
//   onLeave: () => void;
// }

// const VideoRoomScreen = ({
//   user,
//   channelName,
//   onLeave,
// }: VideoRoomScreenProps) => {
//   const [isJoined, setIsJoined] = useState(false);
//   const [remoteUids, setRemoteUids] = useState<number[]>([]);
//   const [isEngineReady, setIsEngineReady] = useState(false);
//   const [isCameraEnabled, setIsCameraEnabled] = useState(true);
//   const [isMicEnabled, setIsMicEnabled] = useState(true);
//   const [showParticipants, setShowParticipants] = useState(false);
//   const [connectionStatus, setConnectionStatus] = useState<
//     'good' | 'poor' | 'lost' | null
//   >(null);
//   const agoraEngineRef = useRef<any>(null);

//   useEffect(() => {
//     const setup = async () => {
//       agoraEngineRef.current = createAgoraRtcEngine();
//       const agoraEngine = agoraEngineRef.current;
//       agoraEngine.addListener('onJoinChannelSuccess', () => setIsJoined(true));
//       agoraEngine.addListener('onUserJoined', (_: any, remoteUid: number) =>
//         setRemoteUids((prev: number[]) =>
//           prev.includes(remoteUid) ? prev : [...prev, remoteUid],
//         ),
//       );
//       agoraEngine.addListener('onUserOffline', (_: any, remoteUid: number) =>
//         setRemoteUids((prev: number[]) =>
//           prev.filter((uid: number) => uid !== remoteUid),
//         ),
//       );
//       agoraEngine.addListener('onLeaveChannel', () => {
//         setIsJoined(false);
//         setRemoteUids([]);
//       });
//       agoraEngine.addListener('onConnectionStateChanged', (state: number) => {
//         if (state === 3) setConnectionStatus('good');
//         else if (state === 5) setConnectionStatus('lost');
//         else if (state === 2) setConnectionStatus('poor');
//         else setConnectionStatus(null);
//       });
//       await agoraEngine.initialize({
//         appId: '4a75f775a2a6427792d534a048ae00a2',
//       });
//       await agoraEngine.enableVideo();
//       await agoraEngine.enableAudio();
//       await agoraEngine.setChannelProfile(
//         ChannelProfileType.ChannelProfileLiveBroadcasting,
//       );
//       await agoraEngine.startPreview();
//       setIsEngineReady(true);
//     };
//     setup();
//     return () => {
//       agoraEngineRef.current?.release && agoraEngineRef.current.release();
//     };
//   }, []);

//   useEffect(() => {
//     if (isEngineReady && !isJoined) {
//       join();
//     }
//     // eslint-disable-next-line react-hooks/exhaustive-deps
//   }, [isEngineReady]);

//   const join = async () => {
//     try {
//       const response = await fetch(
//         `http://10.0.2.2:3000/rtcToken?channelName=${encodeURIComponent(
//           channelName,
//         )}&uid=${user.id}&role=publisher`,
//       );
//       if (!response.ok) throw new Error('Failed to fetch token from backend');
//       const data = await response.json();
//       const token = data.token;
//       if (!token) throw new Error('No token received from backend');
//       await agoraEngineRef.current.setClientRole(
//         ClientRoleType.ClientRoleBroadcaster,
//       );
//       await agoraEngineRef.current.joinChannel(token, channelName, user.id, {});
//     } catch (e: unknown) {
//       const msg = e instanceof Error ? e.message : String(e);
//       Alert.alert('Join Failed', msg);
//       onLeave();
//     }
//   };

//   const leave = async () => {
//     if (!isJoined || !agoraEngineRef.current) return;
//     try {
//       await agoraEngineRef.current.leaveChannel();
//       onLeave();
//     } catch (error) {
//       Alert.alert('Leave Error', String(error));
//     }
//   };

//   const switchCamera = async () => {
//     if (!agoraEngineRef.current) return;
//     try {
//       await agoraEngineRef.current.switchCamera();
//     } catch (error) {
//       Alert.alert('Switch Camera Error', String(error));
//     }
//   };

//   const toggleCamera = async () => {
//     if (!agoraEngineRef.current) return;
//     try {
//       await agoraEngineRef.current.enableLocalVideo(!isCameraEnabled);
//       setIsCameraEnabled((prev: boolean) => !prev);
//     } catch (error) {
//       Alert.alert('Camera Error', String(error));
//     }
//   };

//   const toggleMic = async () => {
//     if (!agoraEngineRef.current) return;
//     try {
//       await agoraEngineRef.current.enableLocalAudio(!isMicEnabled);
//       setIsMicEnabled((prev: boolean) => !prev);
//     } catch (error) {
//       Alert.alert('Mic Error', String(error));
//     }
//   };

//   const allVideoUids = [0, ...remoteUids];
//   const numColumns = Math.max(2, Math.ceil(Math.sqrt(allVideoUids.length)));
//   const videoWidth = (Dimensions.get('window').width - 40) / numColumns;

//   const participants = [
//     {
//       uid: 0,
//       name: user.name,
//       isLocal: true,
//       mic: isMicEnabled,
//       cam: isCameraEnabled,
//     },
//     ...remoteUids.map(uid => ({
//       uid,
//       name: `User ${uid}`,
//       isLocal: false,
//       mic: true,
//       cam: true,
//     })),
//   ];

//   return (
//     <SafeAreaView style={styles.main}>
//       {/* Top Bar */}
//       <View style={styles.topBar}>
//         <Text style={styles.meetingTitle}>{channelName}</Text>
//         <View style={styles.statusDotContainer}>
//           {connectionStatus === 'good' && (
//             <Text style={styles.statusDotGood}>●</Text>
//           )}
//           {connectionStatus === 'poor' && (
//             <Text style={styles.statusDotPoor}>●</Text>
//           )}
//           {connectionStatus === 'lost' && (
//             <Text style={styles.statusDotLost}>●</Text>
//           )}
//         </View>
//       </View>
//       {/* Connection Status Banner */}
//       {connectionStatus && (
//         <View style={styles.banner}>
//           <Text style={styles.bannerText}>
//             {connectionStatus === 'good' && 'Connected'}
//             {connectionStatus === 'poor' && 'Connecting...'}
//             {connectionStatus === 'lost' && 'Reconnecting...'}
//           </Text>
//         </View>
//       )}
//       {/* Video Grid */}
//       <View style={styles.gridContainer}>
//         {allVideoUids.map(uid => (
//           <View
//             key={uid}
//             style={[
//               styles.videoContainer,
//               { width: videoWidth, height: videoWidth * 1.3 },
//               uid === 0 ? styles.localBorder : null,
//             ]}
//           >
//             {isEngineReady && (
//               <RtcSurfaceView style={styles.videoView} canvas={{ uid }} />
//             )}
//             <View style={styles.overlayTop}>
//               <Text style={styles.overlayText}>
//                 {uid === 0 ? 'You' : `User ${uid}`}
//               </Text>
//             </View>
//             {uid === 0 && (
//               <View style={styles.overlayBottom}>
//                 <Text
//                   style={{
//                     color: isCameraEnabled ? '#0f0' : '#f00',
//                     marginRight: 8,
//                   }}
//                 >
//                   {isCameraEnabled ? '📹' : '🚫'}
//                 </Text>
//                 <Text style={{ color: isMicEnabled ? '#0f0' : '#f00' }}>
//                   {isMicEnabled ? '🎤' : '🔇'}
//                 </Text>
//               </View>
//             )}
//           </View>
//         ))}
//       </View>
//       {/* Bottom Floating Controls */}
//       <View style={styles.fabBar}>
//         <TouchableOpacity style={styles.fab} onPress={toggleMic}>
//           <Text style={styles.fabIcon}>{isMicEnabled ? '🎤' : '🔇'}</Text>
//         </TouchableOpacity>
//         <TouchableOpacity style={styles.fab} onPress={toggleCamera}>
//           <Text style={styles.fabIcon}>{isCameraEnabled ? '📹' : '🚫'}</Text>
//         </TouchableOpacity>
//         <TouchableOpacity style={styles.fab} onPress={switchCamera}>
//           <Text style={styles.fabIcon}>🔄</Text>
//         </TouchableOpacity>
//         <TouchableOpacity
//           style={styles.fab}
//           onPress={() => setShowParticipants(true)}
//         >
//           <Text style={styles.fabIcon}>👥</Text>
//         </TouchableOpacity>
//         <TouchableOpacity
//           style={[styles.fab, { backgroundColor: '#dc3545' }]}
//           onPress={leave}
//         >
//           <Text style={styles.fabIcon}>🚪</Text>
//         </TouchableOpacity>
//       </View>
//       {/* Participants Modal */}
//       {showParticipants && (
//         <View style={styles.participantModalOverlay}>
//           <View style={styles.participantModal}>
//             <Text style={styles.participantTitle}>Participants</Text>
//             {participants.map(p => (
//               <View key={p.uid} style={styles.participantRow}>
//                 <Text style={{ fontWeight: p.isLocal ? 'bold' : 'normal' }}>
//                   {p.name}
//                 </Text>
//                 <Text style={{ marginLeft: 8 }}>{p.mic ? '🎤' : '🔇'}</Text>
//                 <Text style={{ marginLeft: 8 }}>{p.cam ? '📹' : '🚫'}</Text>
//               </View>
//             ))}
//             <TouchableOpacity
//               style={styles.closeModalBtn}
//               onPress={() => setShowParticipants(false)}
//             >
//               <Text style={{ color: '#fff' }}>Close</Text>
//             </TouchableOpacity>
//           </View>
//         </View>
//       )}
//     </SafeAreaView>
//   );
// };

// const styles = StyleSheet.create({
//   main: { flex: 1, backgroundColor: '#F7F7F7' },
//   topBar: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     padding: 10,
//   },
//   meetingTitle: {
//     fontSize: 18,
//     fontWeight: 'bold',
//     flex: 1,
//   },
//   statusDotContainer: {
//     flexDirection: 'row',
//     alignItems: 'center',
//   },
//   statusDotGood: {
//     width: 10,
//     height: 10,
//     borderRadius: 5,
//     backgroundColor: '#28a745',
//     marginLeft: 5,
//   },
//   statusDotPoor: {
//     width: 10,
//     height: 10,
//     borderRadius: 5,
//     backgroundColor: '#ffc107',
//     marginLeft: 5,
//   },
//   statusDotLost: {
//     width: 10,
//     height: 10,
//     borderRadius: 5,
//     backgroundColor: '#dc3545',
//     marginLeft: 5,
//   },
//   banner: {
//     backgroundColor: '#f0f0f0',
//     padding: 10,
//     alignItems: 'center',
//   },
//   bannerText: {
//     fontSize: 14,
//     fontWeight: 'bold',
//   },
//   gridContainer: {
//     flexDirection: 'row',
//     flexWrap: 'wrap',
//     justifyContent: 'center',
//     padding: 10,
//     minHeight: 200,
//   },
//   videoContainer: {
//     backgroundColor: '#000',
//     borderRadius: 8,
//     margin: 6,
//     overflow: 'hidden',
//     borderWidth: 1,
//     borderColor: '#ddd',
//     position: 'relative',
//   },
//   localBorder: {
//     borderWidth: 2,
//     borderColor: '#007bff',
//   },
//   videoView: { width: '100%', height: '100%' },
//   overlayTop: {
//     position: 'absolute',
//     top: 4,
//     left: 4,
//     backgroundColor: 'rgba(0,0,0,0.5)',
//     borderRadius: 6,
//     paddingHorizontal: 8,
//     paddingVertical: 2,
//   },
//   overlayText: { color: '#fff', fontSize: 12 },
//   overlayBottom: {
//     position: 'absolute',
//     bottom: 4,
//     left: 4,
//     flexDirection: 'row',
//     backgroundColor: 'rgba(0,0,0,0.5)',
//     borderRadius: 6,
//     paddingHorizontal: 8,
//     paddingVertical: 2,
//     alignItems: 'center',
//   },
//   fabBar: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     padding: 10,
//   },
//   fab: {
//     backgroundColor: '#007bff',
//     width: 54,
//     height: 54,
//     borderRadius: 27,
//     alignItems: 'center',
//     justifyContent: 'center',
//     marginVertical: 8,
//     marginHorizontal: 8,
//     elevation: 4,
//   },
//   fabIcon: { fontSize: 26, color: '#fff' },
//   participantModalOverlay: {
//     position: 'absolute',
//     top: 0,
//     left: 0,
//     right: 0,
//     bottom: 0,
//     backgroundColor: 'rgba(0,0,0,0.5)',
//     justifyContent: 'center',
//     alignItems: 'center',
//   },
//   participantModal: {
//     backgroundColor: '#fff',
//     padding: 20,
//     borderRadius: 10,
//     width: '80%',
//     maxHeight: '80%',
//   },
//   participantTitle: {
//     fontSize: 18,
//     fontWeight: 'bold',
//     marginBottom: 10,
//   },
//   participantRow: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     marginBottom: 5,
//   },
//   closeModalBtn: {
//     backgroundColor: '#dc3545',
//     padding: 10,
//     borderRadius: 5,
//     alignItems: 'center',
//     marginTop: 10,
//   },
// });

// export default VideoRoomScreen;

// ----------------------------------------------------------------------------------------------------------------------------------------------------

//using Agora Ui Kit

// import AgoraUIKit from 'agora-rn-uikit';
// import { useEffect, useState } from 'react';

// interface VideoRoomScreenProps {
//   user: { id: number; name: string; enrolledMeeting: string[] };
//   channelName: string;
//   onLeave: () => void;
// }

// function VideoRoomScreen({ user, channelName, onLeave }: VideoRoomScreenProps) {
//   const [videoCall, setVideoCall] = useState(true);
//   const [token, setToken] = useState<string | null>(null);

//   useEffect(() => {
//     // Fetch token from backend
//     fetch(
//       `http://172.16.11.52:3000/rtcToken?channelName=${encodeURIComponent(
//         channelName,
//       )}&uid=${user.id}&role=publisher`,
//     )
//       .then(res => res.json())
//       .then(data => setToken(data.token));
//   }, [channelName, user.id]);

//   const connectionData = {
//     appId: '4a75f775a2a6427792d534a048ae00a2',
//     channel: channelName,
//     token: token,
//     uid: user.id,
//   };

//   return videoCall && token ? (
//     <AgoraUIKit
//       connectionData={connectionData}
//       rtcCallbacks={{
//         EndCall: () => {
//           setVideoCall(false);
//           onLeave();
//         },
//       }}
//       settings={{
//         layout: 0, // Grid
//         activeSpeaker: true,
//         displayUsername: true,
//       }}
//       styleProps={{
//         usernameText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
//       }}
//     />
//   ) : null;
// }
// export default VideoRoomScreen;
