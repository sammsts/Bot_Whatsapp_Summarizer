FROM node:20-slim

# Instala dependências do Chrome
RUN apt-get update && apt-get install -y \
  wget \
  fonts-liberation \
  libappindicator3-1 \
  libasound2 \
  libatk-bridge2.0-0 \
  libatk1.0-0 \
  libcups2 \
  libdbus-1-3 \
  libgdk-pixbuf2.0-0 \
  libnspr4 \
  libnss3 \
  libx11-xcb1 \
  libxcomposite1 \
  libxdamage1 \
  libxrandr2 \
  xdg-utils \
  libu2f-udev \
  libvulkan1 \
  ca-certificates \
  --no-install-recommends && \
  rm -rf /var/lib/apt/lists/*

# Instala o Google Chrome com dependências
RUN apt-get update && \
    apt-get install -y wget gnupg ca-certificates fonts-liberation libasound2 libatk-bridge2.0-0 libatk1.0-0 \
    libcups2 libdbus-1-3 libgdk-pixbuf2.0-0 libnspr4 libnss3 libx11-xcb1 libxcomposite1 libxdamage1 \
    libxrandr2 xdg-utils libu2f-udev libvulkan1 && \
    wget https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb && \
    apt install -y ./google-chrome-stable_current_amd64.deb && \
    rm google-chrome-stable_current_amd64.deb


# Define diretório de trabalho
WORKDIR /app

# Copia os arquivos
COPY . .

# Instala dependências do projeto
RUN npm install

# Define o path do Chrome via variável de ambiente
ENV CHROME_PATH=/usr/bin/google-chrome

# Porta padrão da aplicação
EXPOSE 3000

# Inicia a aplicação
CMD ["npm", "start"]
