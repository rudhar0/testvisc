# Base image
FROM ubuntu:22.04

# Avoid interactive prompts
ENV DEBIAN_FRONTEND=noninteractive

# Install dependencies
RUN apt-get update && apt-get install -y \
    gdb \
    gcc \
    g++ \
    clang \
    python3 \
    nodejs \
    npm \
    curl \
    unzip \
    && rm -rf /var/lib/apt/lists/*

# Install VS Code C/C++ tools (cpptools) DAP adapter
RUN mkdir -p /app/cpptools && \
    curl -L "https://github.com/microsoft/vscode-cpptools/releases/download/1.8.4/cpptools-linux.vsix" -o /tmp/cpptools.vsix && \
    unzip /tmp/cpptools.vsix -d /tmp/cpptools-vsix && \
    cp -r /tmp/cpptools-vsix/extension/debugAdapters/* /app/cpptools/ && \
    rm -rf /tmp/cpptools.vsix /tmp/cpptools-vsix

# Set up the application directory
WORKDIR /app

# Copy backend application code
COPY . .

# Install Node.js dependencies
RUN npm install

# This is the command that will be run by the worker-pool.service.js
# We are not using CMD or ENTRYPOINT because the container is started and managed by Dockerode.
# The worker service will be started by the main application.

# Expose a port for DAP communication if needed (though we use stdin/stdout by default)
EXPOSE 4711