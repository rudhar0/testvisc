# Base image with Clang, LLDB, and Python
FROM ubuntu:22.04

ENV DEBIAN_FRONTEND=noninteractive

# Install all required tools
RUN apt-get update && apt-get install -y \
    build-essential \
    gcc \
    g++ \
    clang \
    lldb \
    python3 \
    python3-pip \
    python3-lldb \
    nodejs \
    npm \
    curl \
    git \
    && rm -rf /var/lib/apt/lists/*

# Verify installations
RUN clang --version && \
    lldb --version && \
    python3 --version && \
    node --version

# Set up the application directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install Node.js dependencies
RUN npm install

# Copy the rest of the application
COPY . .

# Make Python script executable
RUN chmod +x src/python/lldb-tracer.py

# Create temp directory
RUN mkdir -p temp

# Expose port
EXPOSE 5000

CMD ["node", "src/server.js"]