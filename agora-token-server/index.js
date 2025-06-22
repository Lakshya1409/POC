const express = require("express");
const { RtcTokenBuilder, RtcRole } = require("agora-access-token");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;

const APP_ID = process.env.APP_ID;
const APP_CERTIFICATE = process.env.APP_CERTIFICATE;

if (!APP_ID || !APP_CERTIFICATE) {
  console.error("Missing APP_ID or APP_CERTIFICATE in environment variables.");
  process.exit(1);
}

app.get("/rtcToken", (req, res) => {
  const channelName = req.query.channelName;
  const uid = req.query.uid;
  const role =
    req.query.role === "publisher" ? RtcRole.PUBLISHER : RtcRole.SUBSCRIBER;
  if (!channelName || !uid) {
    return res.status(400).json({ error: "channelName and uid are required" });
  }
  const expireTime = 3600; // 1 hour
  const currentTimestamp = Math.floor(Date.now() / 1000);
  const privilegeExpireTs = currentTimestamp + expireTime;
  const token = RtcTokenBuilder.buildTokenWithUid(
    APP_ID,
    APP_CERTIFICATE,
    channelName,
    parseInt(uid, 10),
    role,
    privilegeExpireTs
  );
  res.json({ token });
});

app.get("/", (req, res) => {
  res.send("Agora Token Server is running.");
});

app.listen(PORT, () => {
  console.log(`Agora Token Server listening on port ${PORT}`);
});
