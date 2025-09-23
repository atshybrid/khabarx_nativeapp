// Minimal shim to prevent import-time crash when Metro preloads expo-image-picker.
// We only expose the methods we call defensively, delegating to the native module if available.
const { NativeModulesProxy } = require('expo-modules-core');

const Native = (NativeModulesProxy && (NativeModulesProxy.ExpoImagePicker || NativeModulesProxy.ExponentImagePicker)) || null;

module.exports = {
  getMediaLibraryPermissionsAsync: Native && Native.getMediaLibraryPermissionsAsync
    ? (...args) => Native.getMediaLibraryPermissionsAsync(...args)
    : async () => ({ granted: false, canAskAgain: true }),
  requestMediaLibraryPermissionsAsync: Native && Native.requestMediaLibraryPermissionsAsync
    ? (...args) => Native.requestMediaLibraryPermissionsAsync(...args)
    : async () => ({ granted: false, canAskAgain: true }),
  launchImageLibraryAsync: Native && Native.launchImageLibraryAsync
    ? (...args) => Native.launchImageLibraryAsync(...args)
    : async () => ({ canceled: true, assets: [] }),
  MediaTypeOptions: { All: 'All' },
};