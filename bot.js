const crypto = require('crypto');
const fs = require('fs');
const baileys = require('@whiskeysockets/baileys');
const {
    downloadYouTubeVideo,
    downloadFacebookVideo,
    downloadInstagramMedia,
    downloadTikTokVideo,
    downloadAllFormats
} = require('./downloaders');

const { default: makeWASocket, useMultiFileAuthState, makeInMemoryStore } = baileys;

const processedMessages = new Set(); // Menyimpan pesan yang sudah diproses
const BOT_NUMBER = '6283160034028@s.whatsapp.net'; // Gantilah dengan nomor bot yang sesuai

// Simpan sesi agar tidak perlu scan QR lagi setelah pertama kali login
async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info');
    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: true, // Menampilkan QR di terminal
        browser: ['MyBot', 'Chrome', '1.0.0']
    });

    // Simpan sesi otomatis
    sock.ev.on('creds.update', saveCreds);

    // Menampilkan QR Code
    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            console.log('🔄 Scan QR Code ini dengan WhatsApp untuk login!');
        }

        if (connection === 'open') {
            console.log('✅ Bot berhasil terhubung ke WhatsApp!');
        }

        if (connection === 'close') {
            console.log('❌ Koneksi terputus, mencoba menghubungkan kembali...');
            startBot();
        }
    });

    sock.ev.on('messages.upsert', async ({ messages }) => {
        const msg = messages[0];
        if (!msg.message || !msg.key.remoteJid) return;

        // Cek apakah pesan sudah diproses sebelumnya
        if (processedMessages.has(msg.key.id)) {
            console.log('⏳ Pesan sudah diproses sebelumnya, diabaikan.');
            return;
        }

        processedMessages.add(msg.key.id);

        const messageTime = msg.messageTimestamp * 1000;
        const now = Date.now();
        if (now - messageTime > 10000) {
            console.log('⏳ Pesan lama, diabaikan.');
            return;
        }

        try {
            const from = msg.key.remoteJid;
            const sender = msg.key.participant || from;
            const text = msg.message.conversation || msg.message.extendedTextMessage?.text || "";

            // Abaikan pesan dari bot sendiri
            if (sender === BOT_NUMBER) {
                console.log('⏳ Pesan dari bot sendiri, diabaikan.');
                return;
            }

            const args = text.trim().split(' ');
            const command = args[0].toLowerCase();

            if (command === '!dl') {
                if (args.length < 3) {
                    await sock.sendMessage(from, { text: '❌ Format salah. Gunakan: `!dl <fb|ig|yt|tt|all(recomended)> <url>`' });
                    return;
                }

                const platform = args[1].toLowerCase();
                const url = args[2];

                if (!url) {
                    await sock.sendMessage(from, { text: '❌ URL tidak boleh kosong.' });
                    return;
                }

                await sock.sendMessage(from, { text: '⏳ Sedang mendownload media, mungkin ini akan memakan waktu, harap tunggu...' });

                try {
                    let downloadResult;

                    switch (platform) {
                        case 'fb':
                            downloadResult = await downloadFacebookVideo(url);
                            break;
                        case 'ig':
                            downloadResult = await downloadInstagramMedia(url);
                            break;
                        case 'yt':
                            downloadResult = await downloadYouTubeVideo(url);
                            break;
                        case 'tt':
                            downloadResult = await downloadTikTokVideo(url);
                            break;
                        case 'all':
                            downloadResult = await downloadAllFormats(url);
                            break;    
                        default:
                            await sock.sendMessage(from, { text: '❌ Platform tidak didukung. Gunakan: fb, ig, yt,tt atau all.' });
                            return;
                    }

                    if (!downloadResult || !downloadResult.success) {
                        throw new Error('Gagal mendownload media');
                    }

                    // Baca file langsung dari path
                    const fileContent = fs.readFileSync(downloadResult.filePath);
                    const mimeType = 'video/mp4';

                    await sock.sendMessage(from, {
                        video: fileContent,
                        mimetype: mimeType,
                        caption: `✅ Media dari ${platform.toUpperCase()} berhasil didownload!`
                    });

                    // Hapus file setelah dikirim
                    fs.unlinkSync(downloadResult.filePath);

                } catch (error) {
                    console.error('Error downloading media:', error);
                    await sock.sendMessage(from, { text: `❌ Gagal mendownload media: ${error.message}` });
                }
            }
        } catch (error) {
            console.error('❌ Error dalam pemrosesan pesan:', error);
        }
    });
}

// Jalankan bot
startBot().catch(err => console.error('Bot error:', err));
