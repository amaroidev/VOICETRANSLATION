# Voice Translation Companion 🗣️🌍

> **Production-Ready Mobile Translation App**  
> Instant multilingual communication with AI-powered features and advanced translation capabilities

## 🎯 Overview

A comprehensive React Native Expo application that revolutionizes cross-language communication through advanced AI technology. Features real-time voice translation, OCR text recognition, intelligent conversations, and seamless multilingual interactions powered by Google Gemini AI.

## ✨ Complete Feature Set (All 7 Implemented)

### **1. 🔊 Text-to-Speech (TTS)**
- High-quality audio playback of translations
- Optimized volume, pitch, and speech rate
- Enhanced audibility for better user experience
- Automatic pronunciation assistance

### **2. 💬 Live Conversation Mode**
- Real-time two-way translation between speakers
- AI-powered automated conversation responses
- Context-aware dialogue continuation
- Speaker toggle (A ↔ B) with conversation history
- Chat-style interface with message bubbles

### **3. 📸 OCR (Optical Character Recognition)**
- Camera integration for live text capture
- Gallery image text extraction
- Gemini Vision AI for accurate text recognition
- Automatic translation of extracted text
- Support for multiple image formats

### **4. ⌨️ Text Input Mode**
- Manual text entry and translation
- Multi-line text support
- Instant translation without microphone
- Full keyboard integration

### **5. ⭐ Favorites System**
- Save important translations
- Persistent storage across sessions
- Star/unstar toggle functionality
- Easy access to frequently used translations

### **6. 🔍 Language Auto-Detection**
- Automatic source language identification
- Smart language recognition using Gemini AI
- "Auto-Detect" option in language selector
- Seamless multilingual input handling

### **7. 📱 Share Functionality**
- Native sharing to other apps
- Complete translation packages (original + translation + cultural tips)
- Social media, messaging, and email integration
- Cross-platform sharing support

## 🌟 Additional Premium Features

### **🤖 AI Conversation Assistant**
- Toggle-enabled AI responses (ON/OFF)
- Natural conversation flow maintenance
- Context-aware response generation
- Multilingual conversation support

### **📚 Cultural Context Tips**
- AI-generated cultural communication guidance
- Context-specific advice for different languages
- Cultural nuance explanations
- Enhanced cross-cultural understanding

### **🌐 Advanced Capabilities**
- **Offline Mode**: Local storage with offline-ready architecture
- **Network Detection**: Automatic connectivity monitoring
- **iOS Optimization**: Safe area handling for all iPhone models
- **Professional UI**: Clean, modern iOS-style interface
- **Bottom Navigation**: Mobile-optimized navigation
- **Real-time Processing**: Instant translation feedback

## 🛠️ Technical Architecture

### **Core Technologies**
```typescript
Framework: React Native + Expo SDK 54+ (TypeScript)
AI Engine: Google Gemini 1.5 Flash (Speech + Vision + Text)
Audio Processing: expo-av + expo-speech
Image Processing: expo-image-picker + Gemini Vision
Storage: AsyncStorage (persistent data)
Networking: NetInfo (connectivity)
UI Framework: Native components + custom styling
PWA: Service Worker + Web Manifest + Offline Support
```

### **🌐 Progressive Web App (PWA)**
- **Installable**: Add to home screen on any device
- **Offline Capable**: Works without internet connection
- **Native Experience**: Full-screen app-like interface
- **Fast Loading**: Cached resources for instant startup
- **Push Notifications**: Background sync and alerts
- **Cross-Platform**: Single codebase for mobile, desktop, and web

### **Key Dependencies**
```json
{
  "@google/generative-ai": "^0.17.1",
  "expo-av": "~14.0.7", 
  "expo-speech": "~12.0.2",
  "expo-image-picker": "~15.0.7",
  "@react-native-async-storage/async-storage": "1.23.1",
  "@react-native-community/netinfo": "11.3.1",
  "react-native-safe-area-context": "4.10.5"
}
```

## 🚀 Installation & Setup

### **Prerequisites**
- Node.js (v18+ recommended)
- Expo CLI (`npm install -g @expo/cli`)
- Expo Go app on mobile device
- Google Gemini API key ([Get one here](https://makersuite.google.com/app/apikey))

### **1. Project Setup**
```bash
# Clone the repository
git clone https://github.com/amaroidev/VOICETRANSLATION.git
cd VOICETRANSLATION

# Install dependencies
npm install
cd VOICETRANSLATION
npm install
```

### 2. API Configuration
1. Get your Google Gemini API key from [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Create `.env` file in project root:
```env
EXPO_PUBLIC_GEMINI_API_KEY=your_gemini_api_key_here
```

### 3. Launch Development Server
```bash
npx expo start
```

### 4. Test on Device
- **Mobile**: Scan QR code with Expo Go app
- **PWA Web**: Press `w` to open as Progressive Web App
- **Android Emulator**: Press `a`
- **iOS Simulator**: Press `i` (macOS only)

### 5. Build PWA for Production
```bash
# Build optimized PWA
npm run build:pwa

# Test PWA locally  
npm run serve:pwa
```

## 📱 How to Use

### 🎤 **Voice Translation Mode**
1. Select source and target languages
2. Tap the microphone button
3. Speak clearly into your device
4. Release to process and get instant translation
5. Tap speaker icon to hear pronunciation

### ⌨️ **Text Input Mode**
1. Toggle to "Text" mode
2. Type or paste text to translate
3. Tap "Translate" button
4. View results with cultural tips

### 📸 **OCR Mode**
1. Toggle to "OCR" mode  
2. Tap "Take Photo or Select Image"
3. Choose camera or gallery
4. Capture/select image with text
5. AI extracts and translates text automatically

### 💬 **Live Conversation Mode**
1. Navigate to "Chat" tab (bottom navigation)
2. Toggle "AI ON" for automated responses
3. Set Speaker A and B languages
4. Take turns speaking - AI responds contextually
5. View conversation history in chat bubbles

### ⭐ **Favorites & History**
- **Star translations**: Tap star icon on any translation card
- **View history**: Navigate to "History" tab
- **Share results**: Tap share icon on translation cards
- **Offline access**: All history saved locally

## 🔧 Configuration Options

### Language Selection
- **100+ Languages supported** including Twi (Akan) and Ga (Adangme)
- **Auto-Detection**: Let AI identify source language automatically
- **Full language names**: Search by full language name (not just codes)

### AI Conversation Settings
- **Toggle AI Mode**: Enable/disable automated AI responses
- **Conversation Context**: AI remembers last 4 messages
- **Speaker Assignment**: Flexible A/B speaker language assignment

### Audio Settings
- **Optimized TTS**: Enhanced volume, pitch, and rate for clarity
- **iOS Audio Mode**: Proper audio handling for iPhone silent mode
- **Multiple Language Voices**: Native pronunciation for each language

## 📁 Project Structure

```
VOICETRANSLATION/
├── App.tsx              # Main application component
├── languages.ts         # Language definitions and mappings
├── .env                 # API keys (create this file)
├── package.json         # Dependencies and scripts
├── app.json            # Expo configuration
└── README.md           # This documentation
```

## 🔐 Permissions Required

The app automatically requests these permissions:

- **🎤 Microphone**: For voice recording and speech-to-text
- **📷 Camera**: For OCR photo capture
- **📱 Photo Library**: For selecting existing images for OCR
- **🔊 Audio Playback**: For text-to-speech functionality

## 🌐 Supported Languages

**Auto-Detection** + 100+ languages including:
- English, Spanish, French, German, Italian, Portuguese
- Chinese (Simplified/Traditional), Japanese, Korean
- Arabic, Hindi, Russian, Polish, Dutch, Swedish
- **African Languages**: Twi (Akan), Ga (Adangme), Swahili, Zulu
- And many more...

## 🎨 UI/UX Features

### Mobile-Optimized Design
- **Bottom Navigation**: Thumb-friendly navigation bar
- **iOS Safe Areas**: Proper notch handling for iPhone X+
- **Clean Modern UI**: Light theme with iOS-style components
- **Responsive Layout**: Adapts to different screen sizes

### Visual Feedback
- **Loading Indicators**: Clear processing status
- **Active States**: Visual feedback for all interactions
- **Error Handling**: User-friendly error messages
- **Offline Indicators**: Network status awareness

## 🔧 Development

### Available Scripts
```bash
npm start          # Start Expo development server
npm run android    # Run on Android emulator
npm run ios        # Run on iOS simulator (macOS only)  
npm run web        # Run in web browser
```

### Building for Production
```bash
# Build for Android (APK)
expo build:android

# Build for iOS (requires Apple Developer account)
expo build:ios

# Create production build
eas build --platform all
```

## 🐛 Troubleshooting

### Common Issues

**🎤 Audio Recording Issues**
- Ensure microphone permissions are granted
- Check device audio settings and volume
- Try restarting the app if recording fails

**📡 Network Connection**
- Verify internet connection for AI processing
- Check API key is correctly set in `.env` file
- Ensure Gemini AI service is accessible

**📸 OCR Not Working**
- Grant camera and photo library permissions
- Ensure clear, well-lit images with readable text
- Try different image angles or lighting

**🔊 TTS Volume Low**
- Check device volume settings
- Ensure phone is not in silent mode (iOS)
- Try different languages for voice synthesis

### Performance Tips
- **Clear History**: Regularly clear old translations to improve performance
- **Restart App**: If experiencing slowdowns, restart the app
- **Update Expo**: Keep Expo Go app updated to latest version

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request


## 🙏 Acknowledgments

- **Google Gemini AI** - For powerful speech, vision, and text processing
- **Expo Team** - For excellent React Native development tools
- **React Native Community** - For comprehensive mobile development framework

## 📞 Support

For support, questions, or feature requests:
- Create an issue in the GitHub repository
- Check the troubleshooting section above
- Ensure you have the latest version of the app

---

**Made with ❤️ for global communication** 🌍✨
