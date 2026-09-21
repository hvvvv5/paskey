// Capacitor configuration for the PasKey native Android build.
//
// The @capacitor packages are installed during the Android Native phase
// (`npm install @capacitor/core @capacitor/cli @capacitor/android` then
// `npx cap add android`). This config is the contract consumed by Capacitor.
// The webDir points at the Vite build output (`dist`), produced by `npm run build`.
//
// Docs: https://capacitorjs.com/docs/config

const config = {
  appId: 'com.paskey.vault',
  appName: 'PasKey',
  webDir: 'dist',
};

export default config;