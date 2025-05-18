// bot.js
const crypto = require('crypto');
const fs = require('fs');
const baileys = require('@whiskeysockets/baileys');
const express = require('express');
const LRU = require('lru-cache');

const {
  downloadYouTubeVideo,
  downloadFacebookVideo,
  downloadInstagramMedia,
  downloadTikTokVideo,
  downloadAllFormats
} = require('./downloaders');

const { default: makeWASocket, useMultiFileAuthState } = baileys;

const BOT_NUMBER = '6283160034028@s.whatsapp.net';
const PORT = process.env.PORT || 3000;

// 1) Simple HTTP server untuk keep-alive di Railway
const app = express();
app.get('/', (_req, res) => res.send('Bot is alive'));
app.listen(PORT, () => console.log(`🌐 Express listening on port ${PORT}`));

// 2) LRU cache untuk processedMessages (max umur 10 menit)
const processedMessages = new LRU({
  max: 5000,
  ttl: 1000 * 60 * 10,    // 10 menit
});

let reconnectAttempts = 0;

async function startBot() {
  try {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info');
    const sock = makeWASocket({
      auth: state,
      printQRInTerminal: true,
      browser: ['MyBot', 'Chrome', '1.0.0'],
      // override default reconnect logic; kita handle sendiri
      shouldReconnect: () => false,
    });

    // Simpan kredensial otomatis
    sock.ev.on('creds.update', saveCreds);

    // 3) Tangani sinyal dari Railway / Docker
    process.once('SIGTERM', async () => {
      console.log('📌 SIGTERM diterima, menyimpan kredensial dan shutdown...');
      await saveCreds();
      process.exit(0);
    });

    // 4) Connection update & reconnect dengan back-off
    sock.ev.on('connection.update', (update) => {
      const { connection, lastDisconnect, qr } = update;
      if (qr) console.log('🔄 Scan QR di terminal untuk login');
      if (connection === 'open') {
        console.log('✅ Bot terhubung');
        reconnectAttempts = 0; // reset counter
      }
      if (connection === 'close') {
        const code = lastDisconnect?.error?.output?.statusCode;
        console.log(`❌ Koneksi terputus (code ${code}), reconnect in ${Math.min(30, 2 ** reconnectAttempts)}s...`);
        const delay = Math.min(30000, 1000 * 2 ** reconnectAttempts);
        reconnectAttempts++;
        setTimeout(startBot, delay);
      }
    });

    // 5) Message handler
    sock.ev.on('messages.upsert', async ({ messages }) => {
      const msg = messages[0];
      if (!msg.message || !msg.key.remoteJid) return;

      const msgId = msg.key.id;
      if (processedMessages.has(msgId)) return;
      processedMessages.set(msgId, true);

      const messageTime = msg.messageTimestamp * 1000;
      if (Date.now() - messageTime > 10000) return; // skip old

      try {
        const from = msg.key.remoteJid;
        const sender = msg.key.participant || from;
        if (sender === BOT_NUMBER) return;

        const text = msg.message.conversation
          || msg.message.extendedTextMessage?.text
          || "";
        const args = text.trim().split(' ');
        const cmd = args[0]?.toLowerCase();

        if (cmd === '!dl') {
          if (args.length < 3) {
            return sock.sendMessage(from, { text: '❌ Gunakan: `!dl <all|fb|ig|yt|tt> <url>`' });
          }
          const [, platform, url] = args;
          await sock.sendMessage(from, { text: '⏳ Downloading...' });

          let result;
          try {
            switch (platform) {
              case 'fb': result = await downloadFacebookVideo(url); break;
              case 'ig': result = await downloadInstagramMedia(url); break;
              case 'yt': result = await downloadYouTubeVideo(url); break;
              case 'tt': result = await downloadTikTokVideo(url); break;
              case 'all': result = await downloadAllFormats(url); break;
              default:
                return sock.sendMessage(from, { text: '❌ Platform tidak didukung.' });
            }
            if (!result?.success) throw new Error('Download gagal');
            const buffer = fs.readFileSync(result.filePath);
            await sock.sendMessage(from, {
              video: buffer,
              mimetype: 'video/mp4',
              caption: '✅ Selesai!'
            });
            fs.unlinkSync(result.filePath);
          } catch (e) {
            console.error('Download error:', e);
            await sock.sendMessage(from, { text: `❌ Error: ${e.message}` });
          }
        }
      } catch (e) {
        console.error('Handler error:', e);
      }
    });

    console.log('🚀 startBot() executed');
  } catch (e) {
    console.error('Fatal error in startBot():', e);
    const delay = Math.min(30000, 1000 * 2 ** reconnectAttempts);
    reconnectAttempts++;
    setTimeout(startBot, delay);
  }
}

startBot();
