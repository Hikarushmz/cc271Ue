# Gunakan Node.js versi 22 sebagai base image
FROM node:22.12.0

# Install Python3, venv, dan pipx
RUN apt-get update && apt-get install -y python3 python3-venv pipx

# Buat virtual environment untuk Python
RUN python3 -m venv /app/venv

# Aktifkan virtual environment dan install yt-dlp di dalamnya
RUN /app/venv/bin/pip install -U yt-dlp

# Set working directory di dalam container
WORKDIR /app

# Copy semua file proyek ke dalam container
COPY . .

# Install dependensi Node.js
RUN npm install

# Tentukan PATH agar virtual environment dikenali
ENV PATH="/app/venv/bin:$PATH"

# Perintah untuk menjalankan bot
CMD ["node", "bot.js"]
