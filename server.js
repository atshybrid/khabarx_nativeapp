// server.js (minimal - do not use in production as-is)
const express = require('express');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const admin = require('firebase-admin');

const app = express();
app.use(bodyParser.json());

const JWT_SECRET = 'very-secret-key-change-me';
const REFRESH_STORE = {}; // in-memory map refreshToken -> { deviceId, expiresAt }
const DEV_STORE = {}; // deviceId -> { languageId }
const COMMENTS = {}; // articleId -> [ { id, user, text, createdAt, likes, replies: [] } ]
const USERS = {}; // userId -> { id, name, email, phoneNumber, userType, createdAt }
const MPIN_STORE = {}; // phoneNumber -> { mpin, attempts, lockedUntil, userId }

app.get('/languages', (req, res) => {
  res.json([{ id: 'te', name: 'Telugu' }, { id: 'en', name: 'English' }, { id: 'hi', name: 'Hindi' }]);
});

app.post('/devices', (req, res) => {
  const { deviceId, languageId, platform, deviceMake, deviceModel } = req.body;
  if (!deviceId) return res.status(400).json({ error: 'deviceId required' });
  DEV_STORE[deviceId] = { languageId, platform, deviceMake, deviceModel };
  return res.status(201).json({ success: true, deviceId });
});

app.post('/auth/guest', (req, res) => {
  const { deviceId, languageId } = req.body;
  if (!deviceId) return res.status(400).json({ error: 'deviceId required' });

  // create JWT
  const token = jwt.sign({ sub: deviceId, type: 'guest', languageId }, JWT_SECRET, { expiresIn: '30d' });
  const refresh = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 30*24*3600*1000).toISOString();
  REFRESH_STORE[refresh] = { deviceId, expiresAt };
  res.status(201).json({ token, refreshToken: refresh, expiresAt, userType: 'guest', deviceId });
});

app.post('/auth/refresh', (req, res) => {
  const { refreshToken } = req.body;
  const r = REFRESH_STORE[refreshToken];
  if (!r) return res.status(401).json({ error: 'invalid refresh' });
  // rotate
  delete REFRESH_STORE[refreshToken];
  const token = jwt.sign({ sub: r.deviceId, type: 'guest' }, JWT_SECRET, { expiresIn: '30d' });
  const newRefresh = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 30*24*3600*1000).toISOString();
  REFRESH_STORE[newRefresh] = { deviceId: r.deviceId, expiresAt };
  res.json({ token, refreshToken: newRefresh, expiresAt });
});

app.post('/fcm/register', (req, res) => {
  const { deviceId, fcmToken } = req.body;
  // store mapping in DB
  console.log('register fcm', deviceId, fcmToken);
  res.status(201).json({ success: true });
});

app.post('/location', (req, res) => {
  const { deviceId, lat, lng } = req.body;
  console.log('loc', deviceId, lat, lng);
  res.status(201).json({ success: true });
});

app.get('/news', (req, res) => {
  const sample = [{ id: 'a1', title: 'Farmers Celebrate Irrigation Success', summary: 'First 60 words ...', body: 'Full body', image: null, author: { name: 'Ravi' }, createdAt: new Date().toISOString(), isRead: false }];
  res.json({ page: 1, pageSize: 10, total: 1, data: sample });
});

// Android App Links: serve Digital Asset Links from env configuration
// Env vars:
//   ANDROID_APP_PACKAGE        e.g., com.amoghnya.khabarx
//   ANDROID_SHA256_DEBUG       e.g., FA:C6:...:9C
//   ANDROID_SHA256_RELEASE     e.g., <your release fingerprint>
app.get('/.well-known/assetlinks.json', (req, res) => {
  try {
    const pkg = process.env.ANDROID_APP_PACKAGE || 'com.amoghnya.khabarx';
    // Collect fingerprints from env (support comma-separated or multiple vars)
    const fps = [];
    const d = process.env.ANDROID_SHA256_DEBUG;
    const r = process.env.ANDROID_SHA256_RELEASE;
    if (d && d.trim()) fps.push(...d.split(',').map(s => s.trim()).filter(Boolean));
    if (r && r.trim()) fps.push(...r.split(',').map(s => s.trim()).filter(Boolean));
    if (fps.length === 0) {
      return res.status(500).json({ error: 'Missing ANDROID_SHA256_* environment variables' });
    }
    const body = [
      {
        relation: ["delegate_permission/common.handle_all_urls"],
        target: {
          namespace: "android_app",
          package_name: pkg,
          sha256_cert_fingerprints: fps,
        },
      },
    ];
    res.set('Content-Type', 'application/json');
    res.set('Cache-Control', 'public, max-age=600');
    res.send(JSON.stringify(body));
  } catch (e) {
    res.status(500).json({ error: 'assetlinks generation failed' });
  }
});

// Comments API (demo only; in-memory)
app.get('/comments', (req, res) => {
  const { articleId } = req.query;
  if (!articleId) return res.status(400).json({ error: 'articleId required' });
  const data = COMMENTS[articleId] || [];
  res.json({ data });
});

app.post('/comments', (req, res) => {
  const { articleId, text, parentId, user } = req.body;
  if (!articleId || !text) return res.status(400).json({ error: 'articleId and text required' });
  const newNode = {
    id: crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(8).toString('hex'),
    user: user || { id: 'guest', name: 'Guest', avatar: 'https://i.pravatar.cc/100' },
    text,
    createdAt: new Date().toISOString(),
    likes: 0,
    replies: [],
  };
  COMMENTS[articleId] = COMMENTS[articleId] || [];
  const insert = (list, pid) => {
    for (const item of list) {
      if (item.id === pid) {
        item.replies = item.replies || [];
        item.replies.push(newNode);
        return true;
      }
      if (item.replies && insert(item.replies, pid)) return true;
    }
    return false;
  };
  if (parentId) {
    const ok = insert(COMMENTS[articleId], parentId);
    if (!ok) return res.status(404).json({ error: 'parentId not found' });
  } else {
    COMMENTS[articleId].unshift(newNode);
  }
  res.status(201).json({ data: newNode });
});

app.listen(3000, () => console.log('API running on http://localhost:3000'));