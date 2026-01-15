import dotenv from 'dotenv';

dotenv.config();

const dockerConfig = {
  // On Windows the Docker socket path is not available by default; allow disabling Docker worker mode.
  enabled: process.env.DOCKER_ENABLED ? process.env.DOCKER_ENABLED === 'true' : (process.platform !== 'win32'),
  socketPath: process.env.DOCKER_SOCKET_PATH || '/var/run/docker.sock',
  workerImage: process.env.DOCKER_WORKER_IMAGE || 'ubuntu:22.04',
  poolSize: parseInt(process.env.DOCKER_POOL_SIZE, 10) || 10,
  maxPoolSize: parseInt(process.env.DOCKER_MAX_POOL_SIZE, 10) || 20,
  busyThreshold: parseFloat(process.env.DOCKER_BUSY_THRESHOLD) || 0.8,
  healthCheckInterval: parseInt(process.env.DOCKER_HEALTH_CHECK_INTERVAL, 10) || 30000, // 30 seconds
  container: {
    cpu: parseInt(process.env.DOCKER_CONTAINER_CPU_SHARES, 10) || 1024, // 1 CPU share
    memory: parseInt(process.env.DOCKER_CONTAINER_MEMORY_MB, 10) || 512, // 512MB
  }
};

export default dockerConfig;