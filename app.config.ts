import type { ExpoConfig } from "expo/config";
const config: ExpoConfig = {
  name: "Zelo",
  slug: "zelo",
  scheme: "zelo",
  version: "2.0.0",
  orientation: "portrait",
  userInterfaceStyle: "automatic",
  icon: "./assets/icon.png",
  android: {
    package: "br.com.zelo.reactnative",
    versionCode: 2,
    permissions: ["ACCESS_COARSE_LOCATION", "ACCESS_FINE_LOCATION"],
    allowBackup: false,
  },
  plugins: [
    [
      "expo-location",
      {
        isAndroidBackgroundLocationEnabled: false,
        isAndroidForegroundServiceEnabled: false,
      },
    ],
    [
      "expo-image-picker",
      {
        photosPermission: "Selecione uma foto para ilustrar a ocorrência.",
        cameraPermission: false,
        microphonePermission: false,
      },
    ],
    "expo-system-ui",
    [
      "expo-font",
      {
        android: {
          fonts: [
            {
              fontFamily: "material",
              fontDefinitions: [
                {
                  path: "node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/MaterialIcons.ttf",
                  weight: 400,
                },
              ],
            },
          ],
        },
      },
    ],
    "expo-router",
  ],
};
export default config;
