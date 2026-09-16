import type { ExpoConfig } from 'expo/config';

/**
 * Revora — Know Your Bike.
 *
 * Firebase client configuration is read from EXPO_PUBLIC_FIREBASE_* variables and
 * from google-services.json. Those values are public by design (Firebase client
 * keys identify the project, they do not authorise access) — every access rule is
 * enforced server-side by firestore.rules / storage.rules. No admin credential,
 * service account or server secret is ever bundled into the app.
 */

const IS_DEV = process.env.APP_VARIANT === 'development';

const packageName = process.env.EXPO_PUBLIC_ANDROID_PACKAGE ?? 'app.revora.android.dev';

const config: ExpoConfig = {
  name: IS_DEV ? 'Revora (dev)' : 'Revora',
  slug: 'revora',
  scheme: 'revora',
  version: '2.6',
  orientation: 'portrait',
  userInterfaceStyle: 'automatic',
  icon: './assets/icon.png',
  assetBundlePatterns: ['**/*'],
  android: {
    package: packageName,
    versionCode: 17,
    googleServicesFile: process.env.GOOGLE_SERVICES_JSON ?? './google-services.json',
    adaptiveIcon: {
      // The mark sits on transparent inside Android's 66% safe zone; the plate
      // is this colour, not baked into the image, so Android's own mask is the
      // only rounding applied. A pre-rounded icon reads as a sticker.
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#101214',
    },
    softwareKeyboardLayoutMode: 'pan',
    permissions: ['android.permission.POST_NOTIFICATIONS'],
    blockedPermissions: [
      // React Native core declares this for the dev-menu overlay; a release
      // build has no dev menu, and Play flags the permission.
      'android.permission.SYSTEM_ALERT_WINDOW',
      'android.permission.READ_EXTERNAL_STORAGE',
      'android.permission.WRITE_EXTERNAL_STORAGE',
      'android.permission.RECORD_AUDIO',
      'android.permission.ACCESS_COARSE_LOCATION',
      'android.permission.ACCESS_FINE_LOCATION',
    ],
  },
  ios: {
    bundleIdentifier: packageName,
    supportsTablet: false,
    buildNumber: '2',
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
      UIBackgroundModes: ['remote-notification'],
    },
  },
  web: {
    favicon: './assets/favicon.png',
    bundler: 'metro',
  },
  plugins: [
    'expo-router',
    '@react-native-firebase/app',
    '@react-native-firebase/auth',
    [
      'react-native-google-mobile-ads',
      {
        // AdMob application id — an identifier, not a secret. A wrong or missing
        // value here crashes the app at startup, which is why it lives in config
        // rather than code.
        androidAppId: 'ca-app-pub-6481334810994565~4441581490',
        // Ads start only after the app calls initialize(), post-consent.
        delayAppMeasurementInit: true,
        userTrackingUsageDescription:
          'This identifier is used to show you ads that are more relevant to you.',
      },
    ],
    [
      'expo-build-properties',
      {
        android: {
          minSdkVersion: 24,
          compileSdkVersion: 36,
          targetSdkVersion: 36,
          // play-services-ads 25.x ships Kotlin 2.3 metadata; Kotlin 2.2 is the
          // earliest compiler that reads it (N reads metadata up to N+1).
          kotlinVersion: '2.2.20',
          /**
           * R8 shrinks and obfuscates the release build. The mapping file it
           * produces is embedded in the AAB automatically, which is what turns
           * Play Console stack traces back into readable ones. Every library
           * below ships its own consumer rules; the explicit keeps are a
           * conservative belt-and-braces for the reflection-heavy ones.
           */
          enableProguardInReleaseBuilds: true,
          enableShrinkResourcesInReleaseBuilds: true,
          extraProguardRules: [
            '-keep class io.invertase.firebase.** { *; }',
            '-keep class com.google.firebase.** { *; }',
            '-keep class com.google.android.gms.** { *; }',
            '-keep class com.facebook.hermes.** { *; }',
            '-keep class com.facebook.jni.** { *; }',
            '-keep class com.facebook.react.turbomodule.** { *; }',
            '-keep class expo.modules.** { *; }',
            '-keep class com.swmansion.** { *; }',
            '-keep class com.horcrux.svg.** { *; }',
            '-dontwarn com.google.firebase.**',
            '-dontwarn io.invertase.firebase.**',
          ].join('\n'),
        },
        ios: {
          useFrameworks: 'static',
          deploymentTarget: '16.4',
        },
      },
    ],
    [
      'expo-splash-screen',
      {
        // Android 12+ allows only a centred icon on a colour — no full-bleed
        // splash art. The two marks differ solely in ink so each reads on its
        // own ground.
        image: './assets/splash-icon-light.png',
        imageWidth: 220,
        resizeMode: 'contain',
        backgroundColor: '#F5F6F8',
        dark: { image: './assets/splash-icon.png', backgroundColor: '#101214' },
      },
    ],
    [
      'expo-image-picker',
      {
        photosPermission:
          'Revora needs access to your photos so you can attach a receipt, document or bike photo to a record.',
        cameraPermission:
          'Revora needs the camera so you can photograph a pump receipt, document or part.',
      },
    ],
    [
      'expo-notifications',
      {
        icon: './assets/notification-icon.png',
        color: '#F4511E',
      },
    ],
    'expo-font',
    'expo-system-ui',
    './plugins/withGradleMemory',
    './plugins/withReleaseSigning',
    './plugins/withKotlin22',
    './plugins/withGooglePlayBilling',
  ],
  experiments: {
    typedRoutes: true,
  },
  extra: {
    eas: {
      projectId: process.env.EAS_PROJECT_ID,
    },
  },
};

export default config;
