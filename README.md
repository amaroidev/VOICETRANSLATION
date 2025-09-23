# Voice Translation Companion

An instant speech-to-text translation app for multilingual conversations, built with React Native and Expo.

## Features

- Real-time speech-to-text using Google Gemini AI
- Instant translation between languages
- Cultural nuance tips for better communication
- Offline-ready architecture (basic implementation)

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Get a Google Gemini API key from [Google AI Studio](https://makersuite.google.com/app/apikey).

3. Create a `.env` file in the root directory:
   ```
   EXPO_PUBLIC_GEMINI_API_KEY=your_api_key_here
   ```

## Running the App

- For web: `npm run web`
- For mobile: `npx expo start` and scan the QR code with Expo Go app
- For Android: `npm run android`
- For iOS: `npm run ios` (requires macOS)

## Usage

1. Enter source and target languages (e.g., 'en' for English, 'es' for Spanish).
2. Tap "Start Recording" and speak.
3. Tap "Stop Recording" to process.
4. View transcribed text, translation, and cultural tips.

## Permissions

The app requires microphone permission for recording audio.

## Technologies

- React Native
- Expo
- Google Generative AI (Gemini)
- Expo AV for audio handling
