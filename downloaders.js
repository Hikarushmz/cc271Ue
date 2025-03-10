const axios = require('axios');
const ytdl = require('@distube/ytdl-core');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const crypto = require('crypto');

// Fungsi validasi URL
function isValidUrl(string) {
    try {
        return typeof string === 'string' && Boolean(new URL(string));
    } catch (err) {
        return false;
    }
}

// Fungsi debugging
function debugUrl(url) {
    console.log(`Type of URL: ${typeof url}`);
    console.log(`Raw URL Value:`, url);
    if (typeof url === 'object') {
        console.log('Object URL (stringify):', JSON.stringify(url, null, 2));
    }
}

// Normalisasi URL YouTube
function normalizeYouTubeUrl(url) {
    try {
        const parsedUrl = new URL(url);
        if (parsedUrl.hostname === 'youtu.be') {
            return `https://www.youtube.com/watch?v=${parsedUrl.pathname.substring(1)}`;
        }
        return url;
    } catch (err) {
        return url; // Jika gagal parse, biarkan default
    }
}

// Pastikan direktori videos ada
function ensureDirectoryExists(directory) {
    if (!fs.existsSync(directory)) {
        fs.mkdirSync(directory, { recursive: true });
        console.log(`Created directory: ${directory}`);
    }
}

// Fungsi untuk mendapatkan User-Agent acak
function getRandomUserAgent() {
    const userAgents = [
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.212 Safari/537.36',
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.107 Safari/537.36',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:90.0) Gecko/20100101 Firefox/90.0',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:89.0) Gecko/20100101 Firefox/89.0',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.131 Safari/537.36 Edg/92.0.902.67'
    ];
    return userAgents[Math.floor(Math.random() * userAgents.length)];
}

// Fungsi untuk membuat nama file unik
function generateUniqueFilename(prefix, extension) {
    const timestamp = Date.now();
    const randomStr = crypto.randomBytes(4).toString('hex');
    return `${prefix}_${timestamp}_${randomStr}.${extension}`;
}

// Download YouTube Video menggunakan ytdl
async function downloadYouTubeVideo(url) {
    try {
        if (!url || typeof url !== 'string') {
            throw new Error('URL is required and must be a string');
        }

        if (!isValidUrl(url)) {
            throw new Error(`Invalid YouTube URL: ${url}`);
        }

        console.log(`Downloading YouTube video: ${url}`);

        const videoDir = path.join(__dirname, 'videos');
        ensureDirectoryExists(videoDir);

        const filename = generateUniqueFilename('yt', 'mkv');
        const outputPath = path.join(videoDir, filename);

        // Unduh video dengan resolusi maksimal 480p
        const downloadCommand = `yt-dlp -f "bv*+ba/best" "${url}" -o "${outputPath}" --merge-output-format mkv --no-warnings`;

        return new Promise((resolve, reject) => {
            exec(downloadCommand, (error, stdout, stderr) => {
                if (error) {
                    console.error(`yt-dlp error: ${error}`);
                    reject(error);
                    return;
                }

                console.log(`Download selesai! Mengonversi ke MP4...`);

                // Ubah ke MP4 agar bisa dikirim ke WhatsApp
                const mp4Output = outputPath.replace('.mkv', '.mp4');
                const convertCommand = `ffmpeg -i "${outputPath}" -c:v libx264 -c:a aac -strict experimental "${mp4Output}"`;

                exec(convertCommand, (error, stdout, stderr) => {
                    if (error) {
                        console.error(`FFmpeg error: ${error}`);
                        reject(error);
                        return;
                    }

                    // Hapus file asli (DASH/MKV) setelah konversi selesai
                    fs.unlink(outputPath, (err) => {
                        if (err) console.warn(`Gagal menghapus file asli: ${outputPath}`);
                    });

                    console.log(`Konversi selesai! File siap dikirim ke WhatsApp.`);

                    resolve({
                        filePath: mp4Output,
                        title: path.basename(mp4Output),
                        success: true
                    });
                });
            });
        });
    } catch (error) {
        console.error('Error downloading YouTube video:', error);
        throw error;
    }
}

// Alternative YouTube download menggunakan youtube-dl-exec
async function downloadYouTubeVideoAlt(url) {
    try {
        if (!url || typeof url !== 'string') {
            throw new Error('URL is required and must be a string');
        }
        
        if (!isValidUrl(url)) {
            throw new Error(`Invalid YouTube URL: ${url}`);
        }
        
        url = normalizeYouTubeUrl(url);
        console.log(`Attempting to download YouTube video (alt method): ${url}`);

        const videoDir = path.join(__dirname, 'videos');
        ensureDirectoryExists(videoDir);
        
        const filename = generateUniqueFilename('yt', 'mp4');
        const outputPath = path.join(videoDir, filename);
        
        // Buat command untuk youtube-dl (pastikan youtube-dl atau yt-dlp terinstall di sistem)
        // Gunakan yt-dlp jika tersedia karena lebih sering diupdate
        const downloadCommand = `yt-dlp -f "bv*+ba/best" "${url}" -o "${outputPath}" --merge-output-format mkv --no-warnings`;
        
        return new Promise((resolve, reject) => {
            exec(command, (error, stdout, stderr) => {
                if (error) {
                    console.error(`youtube-dl error: ${error}`);
                    // Fallback ke youtube-dl jika yt-dlp tidak tersedia
                    const fallbackCommand = `youtube-dl -f "best[ext=mp4]" "${url}" -o "${outputPath}" --no-warnings`;
                    
                    exec(fallbackCommand, (err2, stdout2, stderr2) => {
                        if (err2) {
                            console.error(`Fallback error: ${err2}`);
                            reject(err2);
                            return;
                        }
                        
                        resolve({
                            filePath: outputPath,
                            title: path.basename(outputPath),
                            success: true
                        });
                    });
                    return;
                }
                
                resolve({
                    filePath: outputPath,
                    title: path.basename(outputPath),
                    success: true
                });
            });
        });
    } catch (error) {
        console.error('Error in YouTube alternative download:', error);
        throw error;
    }
}

// Download Facebook Video menggunakan youtube-dl/yt-dlp
async function downloadFacebookVideo(url) {
    try {
        if (!url || typeof url !== 'string') {
            throw new Error('URL is required and must be a string');
        }

        if (!isValidUrl(url)) {
            throw new Error(`Invalid Facebook URL: ${url}`);
        }

        console.log(`Downloading Facebook video: ${url}`);

        const videoDir = path.join(__dirname, 'videos');
        ensureDirectoryExists(videoDir);

        const filename = generateUniqueFilename('fb', 'mkv');
        const outputPath = path.join(videoDir, filename);

        // Unduh video dengan resolusi maksimal 480p
         const downloadCommand = `yt-dlp -f "bv*+ba/best" "${url}" -o "${outputPath}" --merge-output-format mkv --no-warnings`;

        return new Promise((resolve, reject) => {
            exec(downloadCommand, (error, stdout, stderr) => {
                if (error) {
                    console.error(`yt-dlp error: ${error}`);
                    reject(error);
                    return;
                }

                console.log(`Download selesai! Mengonversi ke MP4...`);

               // Ubah ke MP4 agar bisa dikirim ke WhatsApp
                const mp4Output = outputPath.replace('.mkv', '.mp4');
                const convertCommand = `ffmpeg -i "${outputPath}" -c:v libx264 -c:a aac -strict experimental "${mp4Output}"`;

                exec(convertCommand, (error, stdout, stderr) => {
                    if (error) {
                        console.error(`FFmpeg error: ${error}`);
                        reject(error);
                        return;
                    }

                    // Hapus file asli (DASH/MKV) setelah konversi selesai
                    fs.unlink(outputPath, (err) => {
                        if (err) console.warn(`Gagal menghapus file asli: ${outputPath}`);
                    });

                    console.log(`Konversi selesai! File siap dikirim ke WhatsApp.`);

                    resolve({
                        filePath: mp4Output,
                        title: path.basename(mp4Output),
                        success: true
                    });
                });
            });
        });
    } catch (error) {
        console.error('Error downloading Facebook video:', error);
        throw error;
    }
}

// Download Instagram Media menggunakan youtube-dl/yt-dlp
async function downloadInstagramMedia(url) {
    try {
        if (!url || typeof url !== 'string') {
            throw new Error('URL is required and must be a string');
        }

        if (!isValidUrl(url)) {
            throw new Error(`Invalid Instagram URL: ${url}`);
        }

        console.log(`Downloading Instagram media: ${url}`);

        const videoDir = path.join(__dirname, 'videos');
        ensureDirectoryExists(videoDir);

        const filename = generateUniqueFilename('ig', 'mkv');  // Simpan sebagai MKV dulu
        const outputPath = path.join(videoDir, filename);

        // Unduh video dalam DASH format
        const downloadCommand = `yt-dlp -f "bv*+ba/best" "${url}" -o "${outputPath}" --merge-output-format mkv --no-warnings`;

        return new Promise((resolve, reject) => {
            exec(downloadCommand, (error, stdout, stderr) => {
                if (error) {
                    console.error(`yt-dlp error: ${error}`);
                    reject(error);
                    return;
                }

                console.log(`Download selesai! Mengonversi ke MP4...`);

                // Ubah ke MP4 agar bisa dikirim ke WhatsApp
                const mp4Output = outputPath.replace('.mkv', '.mp4');
                const convertCommand = `ffmpeg -i "${outputPath}" -c:v libx264 -c:a aac -strict experimental "${mp4Output}"`;

                exec(convertCommand, (error, stdout, stderr) => {
                    if (error) {
                        console.error(`FFmpeg error: ${error}`);
                        reject(error);
                        return;
                    }

                    // Hapus file asli (DASH/MKV) setelah konversi selesai
                    fs.unlink(outputPath, (err) => {
                        if (err) console.warn(`Gagal menghapus file asli: ${outputPath}`);
                    });

                    console.log(`Konversi selesai! File siap dikirim ke WhatsApp.`);

                    resolve({
                        filePath: mp4Output,
                        title: path.basename(mp4Output),
                        success: true
                    });
                });
            });
        });
    } catch (error) {
        console.error('Error downloading Instagram media:', error);
        throw error;
    }
}


// Download TikTok Video menggunakan youtube-dl/yt-dlp
async function downloadTikTokVideo(url) {
    try {
        if (!url || typeof url !== 'string') {
            throw new Error('URL is required and must be a string');
        }

        if (!isValidUrl(url)) {
            throw new Error(`Invalid TikTok URL: ${url}`);
        }

        console.log(`Downloading TikTok video: ${url}`);

        const videoDir = path.join(__dirname, 'videos');
        ensureDirectoryExists(videoDir);

        const filename = generateUniqueFilename('tt', 'mkv');
        const outputPath = path.join(videoDir, filename);

        // Unduh video dengan resolusi maksimal 480p
        const downloadCommand = `yt-dlp -f "bv*+ba/best" "${url}" -o "${outputPath}" --merge-output-format mkv --no-warnings`;

        return new Promise((resolve, reject) => {
            exec(downloadCommand, (error, stdout, stderr) => {
                if (error) {
                    console.error(`yt-dlp error: ${error}`);
                    reject(error);
                    return;
                }

                console.log(`Download selesai! Mengonversi ke MP4...`);

                // Ubah ke MP4 agar bisa dikirim ke WhatsApp
                const mp4Output = outputPath.replace('.mkv', '.mp4');
                const convertCommand = `ffmpeg -i "${outputPath}" -c:v libx264 -c:a aac -strict experimental "${mp4Output}"`;

                exec(convertCommand, (error, stdout, stderr) => {
                    if (error) {
                        console.error(`FFmpeg error: ${error}`);
                        reject(error);
                        return;
                    }

                    // Hapus file asli (DASH/MKV) setelah konversi selesai
                    fs.unlink(outputPath, (err) => {
                        if (err) console.warn(`Gagal menghapus file asli: ${outputPath}`);
                    });

                    console.log(`Konversi selesai! File siap dikirim ke WhatsApp.`);

                    resolve({
                        filePath: mp4Output,
                        title: path.basename(mp4Output),
                        success: true
                    });
                });
            });
        });
    } catch (error) {
        console.error('Error downloading TikTok video:', error);
        throw error;
    }
}


// Coba semua metode YouTube secara berurutan
async function tryAllYouTubeMethods(url) {
    try {
        try {
            return await downloadYouTubeVideo(url);
        } catch (error) {
            console.log('Primary YouTube method failed, trying alternative...');
            return await downloadYouTubeVideoAlt(url);
        }
    } catch (error) {
        throw new Error(`All YouTube download methods failed: ${error.message}`);
    }
}

// Download semua format yang didukung yt-dlp
async function downloadAllFormats(url) {
    try {
        if (!url || typeof url !== 'string') {
            throw new Error('URL is required and must be a string');
        }

        if (!isValidUrl(url)) {
            throw new Error(`Invalid All URL: ${url}`);
        }

        const blockedSites = [
    'pornhub.com', 'xvideos.com', 'xnxx.com', 'redtube.com', 'youporn.com', 
    'spankbang.com', 'tnaflix.com', 'hclips.com', 'youjizz.com', 'tube8.com',
    'fapster.xxx', 'rule34.xxx', 'e-hentai.org', 'gelbooru.com', 'danbooru.donmai.us',
    'hentaihaven.xxx', 'hentai-foundry.com', 'nhentai.net', 'javhd.com', 'erome.com',
    'ashemaletube.com', 'gaymaletube.com', 'xhamster.com', 'motherless.com', 
    'cam4.com', 'camsoda.com', 'chaturbate.com', 'livejasmin.com', 'stripchat.com',
    'thothub.lol', 'onlyfans.com'
];


        const isBlocked = blockedSites.some(site => url.includes(site));
        if (isBlocked) {
            throw new Error('media berisi konten seksual');
        }

        console.log(`Attempting to download All media: ${url}`);

        const videoDir = path.join(__dirname, 'videos');
        ensureDirectoryExists(videoDir);

        const filename = generateUniqueFilename('all', 'mp4');
        const outputPath = path.join(videoDir, filename);

        // Gunakan yt-dlp
        const downloadCommand = `yt-dlp -f "bv*[vcodec=h264]+ba[acodec=aac]/best" --recode-video mp4 --no-warnings --ignore-errors "${url}" -o "${outputPath}"`;

        return new Promise((resolve, reject) => {
            exec(downloadCommand, (error, stdout, stderr) => {
                if (error) {
                    console.error(`yt-dlp error: ${error}`);
                    reject(new Error('Gagal mendownload media menggunakan yt-dlp'));
                    return;
                }

                // Periksa apakah file berhasil dibuat dan tidak kosong
                if (!fs.existsSync(outputPath) || fs.statSync(outputPath).size === 0) {
                    reject(new Error('File tidak valid atau kosong'));
                    return;
                }

                resolve({
                    success: true,
                    filePath: outputPath,
                    title: path.basename(outputPath)
                });
            });
        });
    } catch (error) {
        console.error('Error downloading All media:', error);
        throw error;
    }
}


module.exports = {
    downloadYouTubeVideo: tryAllYouTubeMethods,
    downloadFacebookVideo,
    downloadInstagramMedia,
    downloadTikTokVideo, // Pastikan ini ada
    downloadAllFormats,
    isValidUrl
};