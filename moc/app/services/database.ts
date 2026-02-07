// app/services/database.ts
// Generic shim so Expo Router is happy.
// Actual implementations are in database.native.ts (Android/iOS)
// and database.web.ts (web/debug).

export * from './database.native';

