# Container Setup & Supabase Integration

This guide explains how to run the application in a container and connect it to a local Supabase instance.

## Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/)
- [Node.js](https://nodejs.org/) (for local tools)
- [Supabase CLI](https://supabase.com/docs/guides/cli)

## 1. Local Supabase Setup (Recommended)

Instead of manually containerizing Supabase, we use the official Supabase CLI which runs the full stack in Docker for you.

1.  **Install Supabase CLI:**
    ```bash
    npm install -g supabase
    ```

2.  **Start Supabase:**
    Inside the project root:
    ```bash
    npx supabase start
    ```
    This will spin up the database, auth, storage, and studio locally.
    
    **Output should show:**
    - Studio URL: `http://127.0.0.1:54323`
    - API URL: `http://127.0.0.1:54321`
    - `service_role` key and `anon` key.

3.  **Configure Environment:**
    Copy `.env.example` to `.env.local` (or update existing) and set:
    ```env
    NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
    NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key-from-step-2>
    SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key-from-step-2>
    ```

## 2. Running the App in Docker

We have a `docker-compose.yml` configured to interface with the host's Supabase instance.

1.  **Build and Run:**
    ```bash
    docker-compose up --build
    ```

2.  **Access the App:**
    - Open [http://localhost:3000](http://localhost:3000)

### How it Works
- The `docker-compose.yml` sets `NEXT_PUBLIC_SUPABASE_URL` to `http://host.docker.internal:54321`.
- `host.docker.internal` allows the container to talk to services running on your host machine (like the Supabase CLI).

## Troubleshooting

- **Supabase Connection Failed:**
    - Ensure Supabase is running (`npx supabase status`).
    - Verify `host.docker.internal` works on your OS (supported on Windows/Mac Docker Desktop).
    - If on Linux, you may need to map the IP address manually.

- **Hot Reloading:**
    - Volume mapping in `docker-compose.yml` enables hot reloading. Changes to files locally will reflect in the container.
