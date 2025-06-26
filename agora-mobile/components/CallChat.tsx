import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  TouchableOpacity,
  Text,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { GiftedChat, IMessage } from 'react-native-gifted-chat';
import RtmEngine from 'agora-react-native-rtm';

interface CallChatProps {
  userId: string | number;
  userName: string;
  channelName: string;
  visible: boolean;
  onClose: () => void;
  backendUrl: string; // e.g. 'http://192.168.0.105:8001'
}

const APP_ID = '4a75f775a2a6427792d534a048ae00a2'; // Or import from config

const CallChat: React.FC<CallChatProps> = ({
  userId,
  userName,
  channelName,
  visible,
  onClose,
  backendUrl,
}) => {
  const [messages, setMessages] = useState<IMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const rtmEngineRef = useRef<RtmEngine | null>(null);

  useEffect(() => {
    if (!visible) return;
    let isMounted = true;
    const setupRtm = async () => {
      setLoading(true);
      try {
        const rtmEngine = new RtmEngine();
        rtmEngineRef.current = rtmEngine;
        await rtmEngine.createInstance(APP_ID);

        // Fetch chat token from backend
        // const res = await fetch(`${backendUrl}/chattoken/${userId}`);
        const chatToken =
          '007eJxTYKj/WSS28/x6g6ch0za38k9vFTcq/Bk2/7n4HdW683v6XasVGEwSzU3TzM1NE40SzUyMzM0tjVJMjU0SDUwsElMNDBKNEtZEZzQEMjJsqZZkYGRgBWJGBhBfhcEiOS3N0DLRQNfU0NJS19AwzUA3KdXISNfc0MAk2TDFJDHJ3BIAov0nJQ==';

        await rtmEngine.loginV2(userId.toString(), chatToken);
        await rtmEngine.joinChannel('284625555488771');
        // await rtmEngine.joinChannel(channelName);

        rtmEngine.on('ChannelMessageReceived' as any, (evt: any) => {
          if (!isMounted) return;
          setMessages(prev => [
            {
              _id: Date.now() + Math.random(),
              text: evt.text,
              createdAt: new Date(),
              user: { _id: evt.uid, name: `User ${evt.uid}` },
            },
            ...prev,
          ]);
        });

        setLoading(false);
      } catch (err) {
        setLoading(false);
        Alert.alert(
          'Chat Error',
          'Failed to connect to chat. Please try again.',
        );
        onClose();
      }
    };

    setupRtm();

    return () => {
      isMounted = false;
      rtmEngineRef.current?.logout();
      rtmEngineRef.current = null;
    };
  }, [visible, userId, channelName, backendUrl, onClose]);

  const onSend = async (newMessages: IMessage[] = []) => {
    const text = newMessages[0]?.text;
    if (!text) return;
    await rtmEngineRef.current?.sendMessageByChannelId(channelName, text);
    setMessages(prev =>
      GiftedChat.append(prev, [
        {
          ...newMessages[0],
          user: { _id: userId, name: userName },
          createdAt: new Date(),
        },
      ]),
    );
  };

  if (!visible) return null;

  return (
    <View
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: '#111c',
        zIndex: 200,
        justifyContent: 'center',
      }}
    >
      <TouchableOpacity
        onPress={onClose}
        style={{ position: 'absolute', top: 40, right: 20, zIndex: 201 }}
      >
        <Text style={{ color: '#fff', fontSize: 28 }}>✕</Text>
      </TouchableOpacity>
      {loading ? (
        <ActivityIndicator size="large" color="#007AFF" style={{ flex: 1 }} />
      ) : (
        <GiftedChat
          messages={messages}
          onSend={msgs => onSend(msgs)}
          user={{ _id: userId, name: userName }}
          renderUsernameOnMessage
          placeholder="Type a message..."
          alwaysShowSend
        />
      )}
    </View>
  );
};

export default CallChat;
