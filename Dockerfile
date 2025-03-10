# Gunakan Node.js versi 22 sebagai base image
FROM node:22.12.0

# Install Python dan pip
RUN apt-get update && apt-get install -y python3 python3-pip

# Install yt-dlp
RUN pip3 install -U yt-dlp

# Set working directory di dalam container
WORKDIR /app

# Copy semua file proyek ke dalam container
COPY . .

# Install dependensi Node.js
RUN npm install

# Perintah untuk menjalankan bot
CMD ["node", "bot.js"]
