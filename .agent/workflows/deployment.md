---
description: Zero-Config Deployment Guide (Render Free Tier)
---

# 🚀 Ultimate Deployment Guide: SMG Hostel ERP

This guide uses the `render.yaml` Blueprint to automatically provision and deploy the entire stack (Backend, Frontend, Database) on Render's Free Tier with minimal manual steps.

## ✅ Phase 1: Preparation (Do This First)

1.  **Clone & Verify**
    Ensure you are on the `main` branch with the latest code.

    ```bash
    git checkout main
    git pull origin main
    ```

2.  **Create External Services (Free)**
    - **Upstash Redis:**
      - Go to [console.upstash.com](https://console.upstash.com).
      - Create a new Database (Free).
      - **Copy the `REDIS_URL`** (starts with `redis://default:password@...`).
      - _Save this for later._

3.  **Ensure `render.yaml` Exists**
    - Confirm `render.yaml` is in the root of your repository.
    - Push any changes to GitHub.

## 🚀 Phase 2: One-Click Deploy (Render Blueprint)

1.  **Go to Render Dashboard:** [dashboard.render.com](https://dashboard.render.com)
2.  **Click "New +" -> "Blueprint"**
3.  **Connect Your Repository.**
4.  **Service Name:** Give it a name like `smg-hostel-erp`.
5.  **Environment Variables Prompt:**
    Render might ask for `REDIS_URL` immediately if it detects it in `render.yaml`.
    - Paste the **Upstash Redis URL** you copied in Phase 1.
    - For `ALLOWED_HOSTS` and `CORS_ALLOWED_ORIGINS`, leave them as `*` for the initial deployment. We will tighten them later.
6.  **Click "Apply Blueprint"**

🎉 **Render will now:**

- Create a PostgreSQL Database (Free).
- Build and Deploy the Django Backend.
- Build and Deploy the React Frontend (pointing to the Backend automatically).

## 🔧 Phase 3: Post-Deploy Configuration (Security)

Once the deployment finishes (green checkmarks):

1.  **Get Your URLs:**
    - Go to Dashboard.
    - Copy the URL for **hostelconnect-web** (e.g., `https://hostelconnect-web.onrender.com`).
    - Copy the URL for **hostelconnect-api** (e.g., `https://hostelconnect-api.onrender.com`).

2.  **Secure the Backend (Environment Variables):**
    - Go to **hostelconnect-api** -> **Environment**.
    - Edit `CORS_ALLOWED_ORIGINS`: Set to your **Frontend URL** (no trailing slash).
      - Example: `https://hostelconnect-web.onrender.com`
    - Edit `ALLOWED_HOSTS`: Set to your **Backend Hostname** (no https://).
      - Example: `hostelconnect-api.onrender.com`
    - _Save Changes (Service will redeploy)._

3.  **Initialize the Database:**
    - Go to **hostelconnect-api** -> **Shell**.
    - Run the following commands to set up the admin user:
      ```bash
      # Create Superuser (Follow prompts)
      python manage.py createsuperuser
      ```

## 🧪 Phase 4: Final Verification

1.  **Open Frontend URL:** `https://hostelconnect-web.onrender.com`
2.  **Login:** Use the superuser credentials you just created.
3.  **Test WebSocket:**
    - Create a Notice or Gate Pass.
    - Open the app in another browser/incognito window.
    - Verify the update appears instantly without refreshing.

## 📝 Troubleshooting

- **WS Connection Failed:**
  - Check Browser Console.
  - Ensure `VITE_API_URL` in **hostelconnect-web** is correct (Render usually sets this automatically via Blueprint).
  - If `wss://` errors occur, verify your Backend is running on HTTPS (Render forces HTTPS by default).

- **Database Error:**
  - Check **hostelconnect-api** Logs.
  - Ensure `DATABASE_URL` is set (Render does this automatically).
