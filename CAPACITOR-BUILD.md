# Capacitor build setup

The existing PWA files stay at the repository root. GitHub Actions creates a clean `www/` package during each build, downloads the QR scanner and QR generator into that package, and then builds the native app.

## Workflows

- `.github/workflows/build-android.yml` → Android debug APK artifact `attendance-android-apk`
- `.github/workflows/build-ios.yml` → unsigned IPA artifact `attendance-ios-ipa`

The native package does not need the QR libraries from a CDN at runtime: the workflows vendor them into `www/` before Capacitor packages the app. The iOS IPA is unsigned and must be signed before installation.

## Important

This ZIP is a prepared project for the GitHub repository. It does not contain generated `android/` or `ios/` directories because the workflows create those on the GitHub runners.
