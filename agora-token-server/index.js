const express = require("express");
const cors = require("cors");
const { RtcTokenBuilder, RtcRole } = require("agora-access-token");
const {
  ChatTokenBuilder, // Correct builder for Agora Chat tokens
} = require("agora-token");
require("dotenv").config(); // Load environment variables from .env file
const axios = require("axios");

console.log("Environment Variables Loaded:");
console.log("APP_ID:", process.env.APP_ID);
console.log("APP_CERTIFICATE:", process.env.APP_CERTIFICATE);
console.log("AGORA_CHAT_APP_KEY:", process.env.AGora_CHAT_APP_KEY);
console.log(
  "AGORA_CHAT_APP_CERTIFICATE:",
  process.env.AGORA_CHAT_APP_CERTIFICATE
);
console.log("PORT:", process.env.PORT);

const app = express();
const PORT = process.env.PORT || 8001;

// Add CORS middleware
app.use(
  cors({
    origin: "*", // WARNING: For development only. In production, specify your frontend URL(s)
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type"],
  })
);

// --- Agora RTC (Video) Credentials ---
const APP_ID = process.env.APP_ID;
const APP_CERTIFICATE = process.env.APP_CERTIFICATE;

// --- Agora Chat (RTM) Credentials ---
// IMPORTANT: These should also be in your .env file.
// The AGORA_CHAT_APP_KEY is the "App Key" from your Agora Console's Chat Service.
// The AGORA_CHAT_APP_CERTIFICATE is usually the same as your RTC APP_CERTIFICATE.
const AGORA_CHAT_APP_KEY = process.env.AGORA_CHAT_APP_KEY;
const AGORA_CHAT_APP_CERTIFICATE = process.env.AGORA_CHAT_APP_CERTIFICATE;

// --- Agora Chat RESTful API Config ---
// Ensure CHAT_REST_API_DOMAIN, CHAT_ORG_NAME, CHAT_APP_NAME are correct for your Agora Chat project
const CHAT_REST_API_DOMAIN = "https://a61.chat.agora.io";
const CHAT_ORG_NAME = "611355943";
const CHAT_APP_NAME = "1562492";
const CHAT_TOKEN_EXPIRATION = 3600; // 1 hour

// --- Input Validation ---
if (!APP_ID || !APP_CERTIFICATE) {
  console.error(
    "Missing APP_ID or APP_CERTIFICATE for RTC in environment variables."
  );
  process.exit(1);
}

if (!AGORA_CHAT_APP_KEY || !AGORA_CHAT_APP_CERTIFICATE) {
  console.error(
    "Missing AGORA_CHAT_APP_KEY or AGORA_CHAT_APP_CERTIFICATE for Chat in environment variables."
  );
  process.exit(1);
}

// Helper: Register user in Agora Chat if not exists
async function registerChatUserIfNotExists(username, password, nickname) {
  const chatRegisterURL = `${CHAT_REST_API_DOMAIN}/${CHAT_ORG_NAME}/${CHAT_APP_NAME}/users`;
  const appToken = ChatTokenBuilder.buildAppToken(
    APP_ID, // Use APP_ID for building app token for REST API calls
    AGORA_CHAT_APP_CERTIFICATE,
    CHAT_TOKEN_EXPIRATION
  );

  try {
    console.log(`Registering user '${username}' in Agora Chat...`);
    const response = await axios.post(
      chatRegisterURL,
      { username, password, nickname },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${appToken}`,
        },
      }
    );
    console.log(`User '${username}' registered successfully in Agora Chat.`);
    return true;
  } catch (error) {
    if (
      error.response &&
      error.response.data &&
      error.response.data.error &&
      error.response.data.error.includes("duplicate_unique_property_exists")
    ) {
      console.log(`User '${username}' already exists. Skipping registration.`);
      return true; // User already exists, consider it successful
    }
    console.error(
      `Error registering chat user '${username}':`,
      error.response?.data || error
    );
    throw error;
  }
}

// Helper: Create Chat Room in Agora Chat if not exists
async function createChatRoomIfNotExists(
  roomId,
  roomName,
  owner, // This is the user ID/name who will own the chat room
  description = "Video call chat room"
) {
  const chatRoomCreationURL = `${CHAT_REST_API_DOMAIN}/${CHAT_ORG_NAME}/${CHAT_APP_NAME}/chatrooms`;
  const appToken = ChatTokenBuilder.buildAppToken(
    APP_ID, // Use APP_ID for building app token for REST API calls
    AGORA_CHAT_APP_CERTIFICATE,
    CHAT_TOKEN_EXPIRATION
  );

  try {
    console.log(
      `Checking/Creating chat room '${roomName}' (ID: ${roomId}) in Agora Chat...`
    );
    const response = await axios.post(
      chatRoomCreationURL,
      {
        name: roomName,
        description: description,
        owner: owner, // This user must exist in Agora Chat
        public: true, // Allows anyone with token to join
        maxusers: 500, // High limit for scalable chat rooms
      },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${appToken}`,
        },
      }
    );
    console.log(response.data?.data?.id);
    console.log(
      `Chat room '${roomName}' (ID: ${roomId}) created successfully.`
    );
    return response.data;
  } catch (error) {
    console.log(
      `Error creating chat room '${roomName}' (ID: ${roomId}):`,
      error
    );
    if (
      error.response &&
      error.response.data &&
      error.response.data.error &&
      error.response.data.error.includes("duplicate_unique_property_exists")
    ) {
      console.log(
        `Chat room '${roomName}' (ID: ${roomId}) already exists. Skipping creation.`
      );
      return true; // Room already exists, consider it successful
    }
    console.error(
      `Error creating chat room '${roomName}' (ID: ${roomId}):`,
      error.response?.data || error
    );
    throw error;
  }
}

// --- RTC Token Generation Endpoint ---
app.get("/rtcToken", async (req, res) => {
  // Made async to await createChatRoomIfNotExists
  console.log("[RTC Token] Request received:", req.query);

  const channelName = req.query.channelName;
  const uid = req.query.uid; // uid from frontend
  const role =
    req.query.role === "publisher" ? RtcRole.PUBLISHER : RtcRole.SUBSCRIBER;

  if (!channelName || !uid) {
    console.log("[RTC Token] Missing channelName or uid in request.");
    return res.status(400).json({ error: "channelName and uid are required" });
  }

  const expireTime = 3600; // Token valid for 1 hour
  const currentTimestamp = Math.floor(Date.now() / 1000);
  const privilegeExpireTs = currentTimestamp + expireTime;

  try {
    // --- IMPORTANT CHANGE: Use the `uid` from the request as the chat room owner ---
    // This ensures the owner is a user that is being authenticated by /chattoken
    // The `uid` in RTC is a number, but in Chat, user IDs are strings.
    // Ensure this `uid` (string) matches a user registered with Agora Chat.
    const chatRoomOwner = "Super";
    await createChatRoomIfNotExists(channelName, channelName, chatRoomOwner);

    const token = RtcTokenBuilder.buildTokenWithUid(
      APP_ID,
      APP_CERTIFICATE,
      channelName,
      parseInt(uid, 10), // UID for RTC can be an integer
      role,
      privilegeExpireTs
    );

    console.log(
      `[RTC Token] Generated successfully for channel: ${channelName}, uid: ${uid}`
    );
    res.json({ token });
  } catch (error) {
    console.error(
      "[RTC Token] Error generating token or creating chat room:",
      error.response?.data || error
    ); // More detailed error logging
    res
      .status(500)
      .json({ error: "Failed to generate RTC token or create chat room" });
  }
});

// --- Chat Token Endpoint (registers user if needed) ---
app.get("/chattoken/:username", async (req, res) => {
  console.log("[Chat Token] Request received for user:", req.params.username);
  const { username } = req.params;
  const password = "default_password"; // In production, use a secure password management
  const nickname = username;
  try {
    // Register user if not exists
    await registerChatUserIfNotExists(username, password, nickname);

    // Generate chat token
    const userToken = ChatTokenBuilder.buildUserToken(
      APP_ID,
      AGORA_CHAT_APP_CERTIFICATE,
      username,
      CHAT_TOKEN_EXPIRATION
    );
    console.log(`Generated chat token for user '${username}'`);
    res.json({ chatToken: userToken });
  } catch (error) {
    console.error("Error in /chattoken:", error?.response?.data || error);
    res
      .status(500)
      .json({ error: "Failed to register user or generate token" });
  }
});

// Add this to your backend if not already present
app.get("/rtmToken", (req, res) => {
  const userId = req.query.userId;
  if (!userId) {
    return res.status(400).json({ error: "userId is required" });
  }

  const expireTime = 3600;
  const currentTimestamp = Math.floor(Date.now() / 1000);
  const privilegeExpireTs = currentTimestamp + expireTime;

  const token = RtmTokenBuilder.buildToken(
    APP_ID,
    APP_CERTIFICATE,
    userId,
    RtmRole.Rtm_User,
    privilegeExpireTs
  );

  res.json({ token });
});

// --- Root Endpoint ---
app.get("/", (req, res) => {
  res.send("Agora Token Server is running. Endpoints: /rtcToken, /chatToken");
});

// --- Server Start ---
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Agora Token Server listening on port ${PORT}`);
  console.log(`RTC APP_ID: ${APP_ID ? "Loaded" : "NOT LOADED"}`);
  console.log(`Chat APP_KEY: ${AGORA_CHAT_APP_KEY ? "Loaded" : "NOT LOADED"}`);
  console.log(`Ensure these are correctly set in your .env file.`);
});
