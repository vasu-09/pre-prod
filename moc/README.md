# Welcome to your Expo app 👋

This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. Start the app

   ```bash
   npx expo start
   ```

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

You can start developing by editing the files inside the **app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

## Connecting to the Spring Boot API gateway

The Expo screens that send and verify OTPs now use a shared Axios client that targets the Spring Boot API gateway on port `8080`. Follow these steps to test end-to-end on Windows:

1. **Start the backend**
   - Launch the Spring microservices (including the API gateway on port `8080`) from IntelliJ IDEA or via Maven.
   - Confirm that `http://localhost:8080/auth/send-otp` and `http://localhost:8080/auth/verify-otp` respond as expected.

2. **Allow web clients through CORS**
   - The gateway and the authentication service now accept `http://localhost:19006` and `http://localhost:8081` by default, which covers Expo Web in development. Override the `CORS_ALLOWED_ORIGINS` environment variable if you serve the web client from a different origin.

3. **Expose the machine IP for Expo Go**
   - When you run `npx expo start --tunnel` or `--lan`, Expo prints the development host (for example `192.168.1.42`).
   - Ensure your phone is on the same network and that Windows Firewall allows inbound traffic on port `8080`.
   - If you prefer, set an explicit URL before starting Expo:

     ```powershell
     $env:EXPO_PUBLIC_API_URL = 'http://192.168.1.42:8080'
     npx expo start
     ```

     On macOS/Linux use `export EXPO_PUBLIC_API_URL=...` instead of the PowerShell command above.

4. **Verify from the app**
   - The login and OTP screens display the detected API base URL to help you confirm that the device points to the gateway.
   - Use the login screen to request an OTP and the OTP screen (navigated with the phone number in the route params) to validate it.

## Get a fresh project

When you're ready, run:

```bash
npm run reset-project
```

This command will move the starter code to the **app-example** directory and create a blank **app** directory where you can start developing.

## Learn more

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## Join the community

Join our community of developers creating universal apps.

- [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.


we have downloaded the required dependencies

PS C:\Users\Admin\OneDrive\Desktop\Moc\moc> npm ls --depth=0
moc@1.0.0 C:\Users\Admin\OneDrive\Desktop\Moc\moc
├── @babel/core@7.27.4
├── @expo/vector-icons@14.1.0
├── @react-native-async-storage/async-storage@2.1.2
├── @react-native-picker/picker@2.11.1
├── @react-navigation/bottom-tabs@7.3.14
├── @react-navigation/elements@2.5.2
├── @react-navigation/material-top-tabs@7.3.2
├── @react-navigation/native-stack@7.3.14
├── @react-navigation/native@7.1.14
├── @types/react@19.0.14
├── axios@1.9.0
├── eslint-config-expo@9.2.0
├── eslint@9.28.0
├── expo-blur@14.1.4
├── expo-constants@17.1.6
├── expo-contacts@14.2.5
├── expo-document-picker@13.1.6
├── expo-font@13.3.1
├── expo-haptics@14.1.4
├── expo-image@2.1.7
├── expo-linking@7.1.5
├── expo-location@18.1.6
├── expo-media-library@17.1.7
├── expo-router@5.0.7
├── expo-secure-store@14.2.3
├── expo-splash-screen@0.30.8
├── expo-status-bar@2.2.3
├── expo-symbols@0.4.4
├── expo-system-ui@5.0.7
├── expo-web-browser@14.1.6
├── expo@53.0.9
├── react-dom@19.0.0
├── react-native-gesture-handler@2.24.0
├── react-native-image-picker@8.2.1
├── react-native-pager-view@6.8.1
├── react-native-reanimated@3.17.5
├── react-native-safe-area-context@5.4.0
├── react-native-screens@4.10.0
├── react-native-tab-view@4.1.2
├── react-native-vector-icons@10.2.0
├── react-native-web@0.20.0
├── react-native-webview@13.13.5
├── react-native@0.79.2
├── react@19.0.0
└── typescript@5.8.3