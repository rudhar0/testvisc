# ✅ NEW - Updated Dockerfile without Python/LLDB
FROM ubuntu:22.04

ENV DEBIAN_FRONTEND=noninteractive

# Install only what we need: GCC, Node.js, binutils
RUN apt-get update && apt-get install -y \
    build-essential \
    gcc \
    g++ \
    binutils \
    nodejs \
    npm \
    curl \
    git \
    && rm -rf /var/lib/apt/lists/*

# Verify installations
RUN gcc --version && \
    g++ --version && \
    addr2line --version && \
    node --version

# Set up the application directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install Node.js dependencies
RUN npm install

# Copy the rest of the application
COPY . .

# Create temp directory with proper permissions
RUN mkdir -p temp && chmod 755 temp

# Expose port
EXPOSE 5000

CMD ["node", "src/server.js"]