# GitHub Secrets Configuration

This project uses GitHub Actions for CI/CD. To enable automatic deployments, you need to configure the following secrets in your GitHub repository.

## Required Secrets

### For Render Deployment (backend-deploy.yml)

1. **RENDER_DEPLOY_HOOK**
   - **Description**: The deploy hook URL from Render.com for triggering automatic deployments
   - **How to get it**:
     1. Go to your Render dashboard
     2. Select your backend service
     3. Navigate to Settings → Deploy Hook
     4. Copy the deploy hook URL
   - **Format**: `https://api.render.com/deploy/srv-xxxxx?key=yyyyy`

2. **RENDER_SERVICE_URL**
   - **Description**: Your Render service URL (without https://)
   - **How to get it**:
     1. Go to your Render dashboard
     2. Select your backend service
     3. Copy the service URL (e.g., `your-app-name.onrender.com`)
   - **Format**: `your-app-name.onrender.com`

## How to Add Secrets to GitHub

1. Go to your GitHub repository
2. Click on **Settings**
3. In the left sidebar, click **Secrets and variables** → **Actions**
4. Click **New repository secret**
5. Add each secret:
   - Name: `RENDER_DEPLOY_HOOK`
   - Value: Your Render deploy hook URL
   - Click **Add secret**
6. Repeat for `RENDER_SERVICE_URL`

## Optional: Create Production Environment

For better security and organization, you can create a production environment:

1. Go to **Settings** → **Environments**
2. Click **New environment**
3. Name it `production`
4. Add the secrets to this environment instead
5. The workflow is already configured to use this environment

## Testing Without Secrets

The workflow is configured to gracefully skip deployment steps if secrets are not set:

- If `RENDER_DEPLOY_HOOK` is not set: Deployment step is skipped
- If `RENDER_SERVICE_URL` is not set: Health check step is skipped

This allows you to push code without triggering deployments until you're ready.

## Verifying Configuration

After adding secrets, you can verify they work by:

1. Making a commit to the `backend_django/` directory
2. Pushing to the `main` branch
3. Going to **Actions** tab in GitHub
4. Checking the "Deploy Backend to Render" workflow run

You should see:
- ✅ Deployment triggered successfully
- ✅ Service is healthy

## Security Best Practices

- ✅ Never commit secrets to the repository
- ✅ Use GitHub Environments for production secrets
- ✅ Rotate deploy hooks periodically
- ✅ Limit access to repository secrets
- ✅ Review Actions logs for sensitive information

## Troubleshooting

### "Context access might be invalid" Warning

This warning appears when:
- Secrets are referenced but not yet configured
- Running Actions in a fork

**Solution**: Add the secrets as described above. The warning will disappear once secrets are configured.

### Deployment Fails

Check the Actions log for:
- Network connectivity issues
- Invalid deploy hook URL
- Service not responding

### Health Check Fails

Possible causes:
- Service is still starting up (increase wait time)
- Health endpoint not configured correctly
- Service URL is incorrect

---

**Note**: Once you configure these secrets, automatic deployments will trigger on every push to `main` that includes changes in the `backend_django/` directory.
