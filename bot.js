const crypto = require('crypto');
const fs = require('fs');
const { execSync } = require('child_process');
const baileys = require('@whiskeysockets/baileys');
const express = require('express');
const { LRUCache } = require('lru-cache');

const {
  downloadYouTubeVideo,
  downloadFacebookVideo,
  downloadInstagramMedia,
  downloadTikTokVideo,
  downloadAllFormats
} = require('./downloaders');

const { default: makeWASocket, useMultiFileAuthState } = baileys;

const BOT_NUMBER = '6283160034028@s.whatsapp.net';
const DEVELOPER_NUMBER = '62895321624744@s.whatsapp.net'; // GANTI DENGAN NOMOR DEVELOPER
const PORT = process.env.PORT || 3000;

// 1) HTTP Server untuk keep-alive
const app = express();
app.get('/', (_req, res) => res.send('🤖 Bot Aktif'));
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));

// 2) Cache untuk pesan yang sudah diproses
const processedMessages = new LRUCache({
  max: 5000,
  ttl: 1000 * 60 * 10,
});

let reconnectAttempts = 0;

async function startBot() {
  try {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info');
    const sock = makeWASocket({
      auth: state,
      printQRInTerminal: true,
      browser: ['YT-DLP Bot', 'Chrome', '3.0.0'],
      shouldReconnect: () => false,
    });

    // Simpan kredensial otomatis
    sock.ev.on('creds.update', saveCreds);

    // Handle shutdown gracefully
    process.once('SIGTERM', async () => {
      console.log('🛑 Received SIGTERM');
      await saveCreds();
      process.exit(0);
    });

    // Handle koneksi
    sock.ev.on('connection.update', (update) => {
      const { connection, lastDisconnect, qr } = update;
      if (qr) console.log('🔑 Scan QR code above');
      if (connection === 'open') {
        console.log('✅ Connected to WhatsApp');
        reconnectAttempts = 0;
      }
      if (connection === 'close') {
        const code = lastDisconnect?.error?.output?.statusCode;
        console.log(`❌ Connection lost (${code}), reconnecting...`);
        const delay = Math.min(30000, 1000 * 2 ** reconnectAttempts);
        reconnectAttempts++;
        setTimeout(startBot, delay);
      }
    });

    // Handle pesan masuk
    sock.ev.on('messages.upsert', async ({ messages }) => {
      const msg = messages[0];
      if (!msg.message || !msg.key.remoteJid) return;

      const msgId = msg.key.id;
      if (processedMessages.has(msgId)) return;
      processedMessages.set(msgId, true);

      const messageTime = msg.messageTimestamp * 1000;
      if (Date.now() - messageTime > 10000) return;

      try {
        const from = msg.key.remoteJid;
        const sender = msg.key.participant || from;
        if (sender === BOT_NUMBER) return;

        const text = msg.message.conversation || 
          msg.message.extendedTextMessage?.text ||
          msg.message.videoMessage?.caption || 
          "";

        const args = text.trim().split(' ');
        const cmd = args[0]?.toLowerCase();

        // Command: !dl
        if (cmd === '!dl') {
          if (args.length < 3) {
            return sock.sendMessage(from, { 
              text: '⚠️ *Format Salah!*\nGunakan: ```!dl <platform> <url>```\nContoh: ```!dl yt https://youtube.com/...```'
            });
          }

          const [, platform, url] = args;
          await sock.sendMessage(from, { text: '⏳ Memproses permintaan...' });

          let result;
          try {
            switch (platform.toLowerCase()) {
              case 'fb':
                result = await downloadFacebookVideo(url);
                break;
              case 'ig':
                result = await downloadInstagramMedia(url);
                break;
              case 'yt':
                result = await downloadYouTubeVideo(url);
                break;
              case 'tt':
                result = await downloadTikTokVideo(url);
                break;
              case 'all':
                result = await downloadAllFormats(url);
                break;
              default:
                return sock.sendMessage(from, { 
                  text: `❌ Platform *${platform}* tidak didukung!\nDaftar platform: fb, ig, yt, tt, all`
                });
            }

            if (!result?.success) throw new Error(result?.error || 'Gagal mengunduh media');

            const fileBuffer = fs.readFileSync(result.filePath);
            const messageOptions = {
              caption: '✅ Download Selesai',
              fileName: result.fileName || 'video.mp4',
              mimetype: result.mimetype || 'video/mp4',
            };

            if (result.mimetype?.includes('video')) {
              await sock.sendMessage(from, { video: fileBuffer, ...messageOptions });
            } else if (result.mimetype?.includes('image')) {
              await sock.sendMessage(from, { image: fileBuffer, ...messageOptions });
            } else {
              await sock.sendMessage(from, { document: fileBuffer, ...messageOptions });
            }

            fs.unlinkSync(result.filePath);
          } catch (error) {
            console.error('Download error:', error);
            await sock.sendMessage(from, { 
              text: `❌ Gagal mengunduh:\n${error.message}\nPastikan link valid dan coba lagi.`
            });
          }
        }

        // Command: !update
        else if (cmd === '!update') {
          if (sender !== DEVELOPER_NUMBER) {
            return sock.sendMessage(from, { 
              text: '⛔ Akses Ditolak!\nHanya developer yang bisa menggunakan command ini.'
            });
          }

          try {
            await sock.sendMessage(from, { text: '🔄 Memulai update yt-dlp...' });
            
            // Update yt-dlp
            execSync('pip install --upgrade yt-dlp', { stdio: 'inherit' });
            
            // Kirim notifikasi sukses
            await sock.sendMessage(from, {
              text: '✅ Update berhasil!\nBot akan restart otomatis...\n\n⚠️ Jika ada masalah, hubungi Jxxy'
            });
            
            // Simpan kredensial dan restart
            await saveCreds();
            process.exit(1); // Exit dengan code 1 untuk trigger restart
          } catch (error) {
            console.error('Update failed:', error);
            await sock.sendMessage(from, {
              text: `❌ Gagal update yt-dlp:\n${error.message}\n\n🚨 Segera hubungi Jxxy!`
            });
          }
        }

      } catch (e) {
        console.error('Error processing message:', e);
        sock.sendMessage(from, { 
          text: '⚠️ Terjadi kesalahan internal. Coba beberapa saat lagi.'
        });
      }
    });

  } catch (e) {
    console.error('Fatal error:', e);
    setTimeout(startBot, 5000);
  }
}

// Jalankan bot
startBot();
