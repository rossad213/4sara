# 4Sara Web App

A deployable React/Vite version of the 4Sara period and cycle tracking prototype.

## What works

- Add, edit, and delete cycle entries
- Calendar view
- Period prediction
- Fertile window and ovulation estimates
- Symptom and mood tracking
- Local browser storage
- PIN lock for the local browser
- JSON backup/export and import
- CSV export
- Printable report that can be saved as PDF

## Important privacy note

This version stores data in the user's browser with localStorage. It does not have real cloud accounts, encrypted database storage, or synced data across devices yet. For a public health-related app, add secure authentication, a real privacy policy, data deletion/export tools, and secure database storage before collecting real user data.

## Run locally

```bash
npm install
npm run dev
```

## Build for publishing

```bash
npm run build
```

## Publish on Vercel

1. Create a GitHub repository and upload this folder.
2. Go to Vercel and choose New Project.
3. Import the GitHub repository.
4. Framework preset: Vite.
5. Build command: `npm run build`.
6. Output directory: `dist`.
7. Deploy.

## Publish on Netlify

1. Create a GitHub repository and upload this folder.
2. Go to Netlify and choose Add new site.
3. Import the GitHub repository.
4. Build command: `npm run build`.
5. Publish directory: `dist`.
6. Deploy.
