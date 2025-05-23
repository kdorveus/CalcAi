export default {
  "expo": {
    "name": "CalcAI",
    "slug": "CalcAI",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/images/icon.png",
    "scheme": "calcai",
    "userInterfaceStyle": "automatic",
    "newArchEnabled": true,
    "splash": {
      "image": "./assets/images/splash-icon.png",
      "resizeMode": "contain",
      "backgroundColor": "#ffffff"
    },
    "ios": {
      "supportsTablet": true,
      "bundleIdentifier": "com.calculator.calcai"
    },
    "android": {
      "adaptiveIcon": {
        "foregroundImage": "./assets/images/adaptive-icon.png",
        "backgroundColor": "#ffffff"
      },
      "package": "com.calculator.calcai",
      "versionCode": 2,
      "allowBackup": false,
      "permissions": [
        "RECORD_AUDIO",
        "VIBRATE"
      ]
    },
    "androidStatusBar": {
      "backgroundColor": "#121212",
      "barStyle": "light-content"
    },
    "web": {
      "bundler": "metro",
      "output": "static",
      "favicon": "./assets/images/favicon.png"
    },
    "plugins": [
      "expo-router",
      "expo-secure-store",
      "expo-speech-recognition"
    ],
    "experiments": {
      "typedRoutes": true
    },
    "updates": {
      "enabled": true,
      "fallbackToCacheTimeout": 0,
      "checkAutomatically": "ON_LOAD",
      "url": "https://u.expo.dev/15331794-5196-4ddd-880c-0770b3de9e09"
    },
    "runtimeVersion": "1.0.0",
    "extra": {
      "eas": {
        "projectId": "15331794-5196-4ddd-880c-0770b3de9e09"
      },
      "router": {
        "origin": false
      }
    },
    "owner": "kingalexander"
  }
}; 