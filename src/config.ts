// Backend base URL, e.g. "https://your-deployed-backend.example.com".
// Set via an EXPO_PUBLIC_ env var so Expo inlines it into the JS bundle at
// build time — see backend/README.md for deployment, and .env.example at
// the project root for local dev against `npm run dev` in backend/.
//
// Left unset, the app runs entirely offline against the bundled seed data
// in src/data/updates.ts — this is a deliberate fallback, not an error
// state, so the app works out of the box with zero backend setup.
export const API_BASE_URL = (process.env.EXPO_PUBLIC_API_BASE_URL || '').replace(/\/+$/, '');

export const HAS_BACKEND = API_BASE_URL.length > 0;
