/**
 * Expo config — merges app.json and wires Android FCM when google-services.json is present.
 * Quinton: download google-services.json from Firebase → place at mobile/google-services.json
 * (gitignored). Also upload FCM V1 + APNs to Expo Credentials (see docs/push-digest.md).
 */
const fs = require('fs')
const path = require('path')

const appJson = require('./app.json')

module.exports = () => {
  const expo = structuredClone(appJson.expo)
  const googleServicesPath = path.join(__dirname, 'google-services.json')
  const hasGoogleServices = fs.existsSync(googleServicesPath)

  if (hasGoogleServices) {
    expo.android = {
      ...expo.android,
      googleServicesFile: './google-services.json',
    }
  }

  // AdMob (rewarded videos). Real ids come from EAS env / mobile/.env; Google's public TEST
  // ids keep builds working until your AdMob account is approved (test ads never pay).
  const admobAndroid = process.env.EXPO_PUBLIC_ADMOB_ANDROID_APP_ID || 'ca-app-pub-3940256099942544~3347511713'
  const admobIos = process.env.EXPO_PUBLIC_ADMOB_IOS_APP_ID || 'ca-app-pub-3940256099942544~1458002511'
  expo.plugins = [
    ...(expo.plugins ?? []).filter((p) => (Array.isArray(p) ? p[0] : p) !== 'react-native-google-mobile-ads'),
    [
      'react-native-google-mobile-ads',
      {
        androidAppId: admobAndroid,
        iosAppId: admobIos,
        userTrackingUsageDescription:
          'Lets LoonieWins show you more relevant video ads, which pay you more points.',
      },
    ],
  ]
  // Personalized ads (much higher payouts) need the advertising id on Android.
  if (expo.android?.blockedPermissions) {
    expo.android.blockedPermissions = expo.android.blockedPermissions.filter(
      (perm) => perm !== 'com.google.android.gms.permission.AD_ID'
    )
  }

  expo.extra = {
    ...expo.extra,
    push: {
      googleServicesFilePresent: hasGoogleServices,
      projectId: expo.extra?.eas?.projectId ?? null,
    },
  }

  return { expo }
}
