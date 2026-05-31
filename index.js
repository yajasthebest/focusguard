// App entry point. Expo/React Native loads this file (package.json "main").
// registerRootComponent imports react-native (which runs InitializeCore and
// sets up the bridge) and registers <App /> under the name "main" — the name
// MainActivity.getMainComponentName() returns. Without this, the native side
// throws "Could not get BatchedBridge, make sure your bundle is packaged
// correctly" on launch.
//
// The Cloudflare Worker backend that used to live here now lives in
// /worker/index.js (deployed separately, never bundled into the app).
import { registerRootComponent } from 'expo';

import App from './App';

registerRootComponent(App);
