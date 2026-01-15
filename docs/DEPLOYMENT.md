# Deployment Guide

This guide explains how to deploy the C/C++ code visualizer.

## Prerequisites

- Docker
- Docker Compose
- Node.js

## Steps

1. **Clone the repository.**

2. **Configure environment variables.**
   - Create a `.env` file in the `backend` directory.
   - See the `.env.example` file for the required variables. You will need to set secrets for `AES_KEY`, `SERVER_SECRET`, and `SESSION_SECRET`.

3. **Build the Docker images.**
   ```bash
   cd backend
   docker-compose build
   ```

4. **Start the services.**
   ```bash
   docker-compose up -d
   ```

5. **Install frontend dependencies.**
   ```bash
   cd ../frontend
   npm install
   ```
   
6. **Run the frontend development server.**
    ```bash
    npm run dev
    ```

The application will be available at `http://localhost:5173`.

## Production Deployment

For production, it is recommended to:

- Use a managed Redis service.
- Use a reverse proxy (e.g., Nginx) to handle SSL termination.
- Configure logging and monitoring.
- Adjust the worker pool size and resource limits based on expected load.
