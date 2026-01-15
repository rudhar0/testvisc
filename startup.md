# Project Startup Guide

This guide provides instructions on how to set up, run, and deploy the C/C++ code visualizer application.

## 1. Project Setup (Moving to a new machine)

Follow these steps to set up the project on a new development machine.

### Prerequisites

*   **Git:** For cloning the repository.
*   **Node.js:** A recent LTS version.
*   **Docker & Docker Compose:** For running the backend services.

### Steps

1.  **Clone the Repository**
    ```bash
    git clone <your-repository-url>
    cd <repository-folder>
    ```

2.  **Backend Setup**
    *   Navigate to the `backend` directory:
        ```bash
        cd backend
        ```
    *   Create a `.env` file by copying the example:
        ```bash
        cp .env.example .env
        ```
    *   **Crucially, you must open the `.env` file and set secure, unique values for the following variables:**
        *   `AES_KEY`: A 32-character secret for encryption.
        *   `SERVER_SECRET`: A long, random string for signing server-side tokens.
        *   `SESSION_SECRET`: A long, random string for session management.
    *   Install dependencies:
        ```bash
        npm install
        ```

3.  **Frontend Setup**
    *   Navigate to the `frontend` directory:
        ```bash
        cd ../frontend
        ```
    *   This project uses Vite for the frontend. If there are environment variables needed, create a `.env.local` file in this directory. Common variables might include:
        *   `VITE_API_URL`: The URL of the backend API (e.g., `http://localhost:3000/api`)
    *   Install dependencies:
        ```bash
        npm install
        ```

---

## 2. Running in Development Mode

This setup is for local development and testing.

1.  **Start the Backend**
    *   In the `backend` directory, run:
        ```bash
        npm run dev
        ```
    *   This starts the backend server with `nodemon`, which will automatically restart on file changes. The API will be available at `http://localhost:3000`.

2.  **Start the Frontend**
    *   In the `frontend` directory, run:
        ```bash
        npm run dev
        ```
    *   This starts the Vite development server.
    *   The application will be accessible in your browser at `http://localhost:5173`.

---

## 3. Production Deployment

For production, the recommended approach is to use Docker for the backend and serve a static build of the frontend.

### Backend (Docker)

The `docker-compose.yml` file is configured to run the backend gateway and a Redis instance.

1.  **Build the Docker Images**
    *   From the `backend` directory:
        ```bash
        docker-compose build
        ```

2.  **Start the Services**
    *   Run the services in detached mode:
        ```bash
        docker-compose up -d
        ```
    *   This will start the `gateway` and `redis` containers. You can check their status with `docker-compose ps`.

### Frontend (Static Build)

1.  **Build the Frontend**
    *   In the `frontend` directory, run the build command:
        ```bash
        npm run build
        ```
    *   This creates a `dist` directory containing the optimized, static frontend assets.

2.  **Serve the Static Files**
    *   The contents of the `frontend/dist` directory should be served by a web server like Nginx, Apache, or any static file hosting service.
    *   It is highly recommended to use a reverse proxy (like Nginx) to serve both the frontend static files and the backend API under the same domain. This avoids CORS issues and simplifies SSL/TLS termination.
