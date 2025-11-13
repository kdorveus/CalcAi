export default {
  expo: {
    name: 'CalcAI',
    slug: 'CalcAI',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/images/icon.png',
    scheme: 'calcai',
    userInterfaceStyle: 'automatic',
    newArchEnabled: true,
    splash: {
      image: './assets/images/splash-icon.png',
      resizeMode: 'contain',
      backgroundColor: '#121212',
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: 'com.calculator.calcai',
    },
    android: {
      adaptiveIcon: {
        foregroundImage: './assets/images/adaptive-icon.png',
        backgroundColor: '#121212',
      },
      package: 'com.calculator.calcai',
      versionCode: 2,
      allowBackup: false,
      permissions: ['RECORD_AUDIO', 'VIBRATE'],
      intentFilters: [
        {
          action: 'VIEW',
          data: [
            {
              scheme: 'calcai',
            },
          ],
          category: ['BROWSABLE', 'DEFAULT'],
        },
      ],
    },
    androidStatusBar: {
      backgroundColor: '#121212',
      barStyle: 'light-content',
    },
    web: {
      bundler: 'metro',
      output: 'static',
      favicon: './assets/images/favicon.png',
      // Performance optimizations
      build: {
        babel: {
          include: ['@babel/plugin-transform-react-jsx'],
        },
      },
    },
    plugins: [
      'expo-router',
      'expo-secure-store',
      'expo-speech-recognition',
      [
        'expo-build-properties',
        {
          android: {
            compileSdkVersion: 34,
            targetSdkVersion: 34,
            minSdkVersion: 24,
          },
        },
      ],
    ],
    experiments: {
      typedRoutes: true,
    },
    updates: {
      enabled: true,
      fallbackToCacheTimeout: 0,
      checkAutomatically: 'ON_LOAD',
      url: 'https://u.expo.dev/15331794-5196-4ddd-880c-0770b3de9e09',
    },
    runtimeVersion: '1.0.0',
    extra: {
      eas: {
        projectId: '15331794-5196-4ddd-880c-0770b3de9e09',
      },
      router: {
        origin: false,
      },
      googleClientId:
        process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID ||
        '696929660362-3g17582veuu9u1cs3ele6e4j0po57rva.apps.googleusercontent.com',
    },
    owner: 'kingalexander',
  },
};
