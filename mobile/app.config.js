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

  expo.extra = {
    ...expo.extra,
    push: {
      googleServicesFilePresent: hasGoogleServices,
      projectId: expo.extra?.eas?.projectId ?? null,
    },
  }

  return { expo }
}
