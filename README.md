# Work Effort Tracker

Personal work tracker for logging tasks, hours and clients.

## Quick start (local, no Firebase)
Open `index.html` in a browser. The app runs in **dev mode** using `localStorage` — no sign-in required.

## Deploying with Firebase (recommended for online use)

### 1. Create a Firebase project
1. Go to [console.firebase.google.com](https://console.firebase.google.com)
2. Click **Add project** → give it a name → continue
3. Disable Google Analytics (optional) → **Create project**

### 2. Enable Authentication
1. Build → **Authentication** → Get started
2. Sign-in method → enable **Google** (set a support email)
3. Optionally enable **Email/Password**

### 3. Create Firestore database
1. Build → **Firestore Database** → Create database
2. Choose **Start in production mode** → pick a region → Enable
3. Go to **Rules** tab and paste:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

### 4. Get your config
Project Settings (⚙️) → Your apps → Web → Register app → copy the `firebaseConfig` object

### 5. Paste config into index.html
Replace the `"DEMO"` values in the `firebaseConfig` block near the top of `<script>`.

### 6. Deploy
- **GitHub Pages**: Settings → Pages → Deploy from branch `master`/`main`, root `/`
- **Netlify**: drag the folder onto [app.netlify.com](https://app.netlify.com)
- **Vercel**: `npx vercel` in this folder
