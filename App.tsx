import React, { useState, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView, Alert, ActivityIndicator, Modal, FlatList, TextInput, Share } from 'react-native';
import { Audio } from 'expo-av';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { SafeAreaView, SafeAreaProvider } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import * as Speech from 'expo-speech';
import * as ImagePicker from 'expo-image-picker';
import { languages } from './languages';

const genAI = new GoogleGenerativeAI(process.env.EXPO_PUBLIC_GEMINI_API_KEY || 'YOUR_API_KEY');

interface TranslationHistoryItem {
  id: string;
  transcribedText: string;
  translatedText: string;
  culturalTips: string[];
  sourceLang: string;
  targetLang: string;
  timestamp: number;
  isFavorite: boolean;
}

const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(',')[1]); // Remove data:mime;base64,
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

export default function App() {
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [transcribedText, setTranscribedText] = useState('');
  const [translatedText, setTranslatedText] = useState('');
  const [culturalTips, setCulturalTips] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [sourceLang, setSourceLang] = useState('en');
  const [targetLang, setTargetLang] = useState('es');
  const [isOffline, setIsOffline] = useState(false);
  const [history, setHistory] = useState<TranslationHistoryItem[]>([]);
  const [view, setView] = useState<'main' | 'history' | 'conversation'>('main');
  const [modalVisible, setModalVisible] = useState(false);
  const [editingLang, setEditingLang] = useState<'source' | 'target' | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [inputMode, setInputMode] = useState<'voice' | 'text' | 'ocr'>('voice');
  const [textToTranslate, setTextToTranslate] = useState('');
  const [conversationHistory, setConversationHistory] = useState<Array<{
    id: string;
    text: string;
    translation: string;
    speaker: 'A' | 'B';
    timestamp: number;
  }>>([]);
  const [activeConversationSpeaker, setActiveConversationSpeaker] = useState<'A' | 'B'>('A');
  const [aiConversationMode, setAiConversationMode] = useState(true);
  const [ocrImage, setOcrImage] = useState<string | null>(null);
  const [ocrText, setOcrText] = useState('');
  const [isProcessingOCR, setIsProcessingOCR] = useState(false);

  // PWA-specific initialization
  useEffect(() => {
    // Handle PWA URL parameters for shortcuts
    if (typeof window !== 'undefined' && window.location && window.location.search) {
      try {
        const urlParams = new URLSearchParams(window.location.search);
        const mode = urlParams.get('mode');
        
        if (mode === 'voice') {
          setInputMode('voice');
          setView('main');
        } else if (mode === 'ocr') {
          setInputMode('ocr');
          setView('main');
        } else if (mode === 'conversation') {
          setView('conversation');
        }
      } catch (error) {
        console.log('PWA URL parameter handling skipped:', error);
      }
    }
  }, []);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsOffline(!state.isConnected);
    });

    loadHistory();

    return () => {
      unsubscribe();
    };
  }, []);

  async function loadHistory() {
    try {
      const jsonValue = await AsyncStorage.getItem('@translation_history');
      if (jsonValue !== null) {
        setHistory(JSON.parse(jsonValue));
      }
    } catch (e) {
      console.error('Failed to load history.', e);
    }
  }

  async function saveTranslation(item: Omit<TranslationHistoryItem, 'id' | 'timestamp'>) {
    try {
      const newHistoryItem: TranslationHistoryItem = {
        ...item,
        id: Date.now().toString(),
        timestamp: Date.now(),
        isFavorite: false,
      };
      const newHistory = [newHistoryItem, ...history];
      setHistory(newHistory);
      const jsonValue = JSON.stringify(newHistory);
      await AsyncStorage.setItem('@translation_history', jsonValue);
    } catch (e) {
      console.error('Failed to save translation.', e);
    }
  }

  async function startRecording() {
    try {
      const permission = await Audio.requestPermissionsAsync();
      if (permission.status !== 'granted') {
        Alert.alert(
          'Microphone Permission Required', 
          'Please allow microphone access to use voice translation.'
        );
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      setRecording(recording);
    } catch (err) {
      console.error('Failed to start recording', err);
      Alert.alert('Error', 'Failed to start recording.');
    }
  }

  async function stopRecording() {
    if (!recording) return;

    setRecording(null);
    await recording.stopAndUnloadAsync();
    const uri = recording.getURI();

    if (!uri) {
      Alert.alert('Error', 'No audio recorded.');
      return;
    }

    setIsLoading(true);
    setTranscribedText('');
    setTranslatedText('');
    setCulturalTips([]);

    try {
      const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

      // Fetch audio file
      const audioResponse = await fetch(uri);
      const audioBlob = await audioResponse.blob();
      const base64Data = await blobToBase64(audioBlob);

      // Transcribe
      const transcribePrompt = `Transcribe this audio in ${sourceLang} language.`;
      const transcribeResult = await model.generateContent([
        transcribePrompt,
        { inlineData: { mimeType: audioResponse.headers.get('content-type') || 'audio/m4a', data: base64Data } }
      ]);
      const text = transcribeResult.response.text().trim();
      setTranscribedText(text);

      // Translate
      const translatePrompt = `Translate this text from ${sourceLang} to ${targetLang}: ${text}`;
      const translateResult = await model.generateContent(translatePrompt);
      const translated = translateResult.response.text().trim().replace(/\*+/g, '');
      setTranslatedText(translated);

      // Cultural tips
      const tipsPrompt = `Provide 3-5 concise cultural nuance tips for speaking ${targetLang} in a conversation, considering the context of the translated text: "${translated}". Format as a numbered list.`;
      const tipsResult = await model.generateContent(tipsPrompt);
      const tips = tipsResult.response.text().trim().replace(/\*+/g, '').split('\n').filter(tip => tip.length > 0);
      setCulturalTips(tips);

      // Save to history
      await saveTranslation({
        transcribedText: text,
        translatedText: translated,
        culturalTips: tips,
        sourceLang,
        targetLang,
        isFavorite: false,
      });

    } catch (err) {
      console.error('Processing error', err);
      Alert.alert('Error', 'Failed to process audio. Check your API key and network.');
    } finally {
      setIsLoading(false);
    }
  }

  const openLangModal = (type: 'source' | 'target') => {
    setEditingLang(type);
    setModalVisible(true);
    setSearchTerm('');
  };

  const onSelectLang = (langValue: string) => {
    if (editingLang === 'source') {
      setSourceLang(langValue);
    } else if (editingLang === 'target') {
      setTargetLang(langValue);
    }
    setModalVisible(false);
  };

  const speak = async (text: string, language: string) => {
    try {
      // Stop any previous speech first
      Speech.stop();
      
      // For web platform, try using Web Speech API directly for better language support
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        // Use Web Speech API on web
        const synth = window.speechSynthesis;
        synth.cancel(); // Stop any ongoing speech
        
        const languageMap: { [key: string]: string } = {
          'en': 'en-US',
          'es': 'es-ES',
          'fr': 'fr-FR',
          'de': 'de-DE',
          'it': 'it-IT',
          'pt': 'pt-BR',
          'nl': 'nl-NL',
          'ru': 'ru-RU',
          'ja': 'ja-JP',
          'zh-CN': 'zh-CN',
          'zh-TW': 'zh-TW',
          'ko': 'ko-KR',
          'ar': 'ar-SA',
          'hi': 'hi-IN',
          'bn': 'bn-BD',
          'ak': 'en-US',
          'gaa': 'en-US',
        };
        
        const speechLang = languageMap[language] || language;
        const utterance = new SpeechSynthesisUtterance(text);
        
        // Get available voices and find the best match
        const voices = synth.getVoices();
        console.log('Available web voices:', voices.map(v => `${v.lang} - ${v.name}`));
        
        // Try to find a voice that matches the target language
        let selectedVoice = voices.find(voice => 
          voice.lang.toLowerCase().startsWith(speechLang.toLowerCase()) ||
          voice.lang.toLowerCase().startsWith(language.toLowerCase())
        );
        
        // If no exact match, try broader match
        if (!selectedVoice && language === 'es') {
          selectedVoice = voices.find(voice => voice.lang.toLowerCase().startsWith('es'));
        }
        
        if (selectedVoice) {
          utterance.voice = selectedVoice;
          console.log(`Using web voice: ${selectedVoice.name} (${selectedVoice.lang}) for language: ${language}`);
        } else {
          console.log(`No specific voice found for ${language}, using default`);
        }
        
        utterance.lang = speechLang;
        utterance.rate = 0.75;
        utterance.pitch = 1.0;
        utterance.volume = 1.0;
        
        synth.speak(utterance);
        return;
      }
      
      // Fallback to Expo Speech for mobile
      const speechLanguageMap: { [key: string]: string[] } = {
        'en': ['en-US', 'en-GB', 'en-AU'],
        'es': ['es-ES', 'es-MX', 'es-US', 'es-AR'],
        'fr': ['fr-FR', 'fr-CA'],
        'de': ['de-DE', 'de-AT'],
        'it': ['it-IT'],
        'pt': ['pt-BR', 'pt-PT'],
        'nl': ['nl-NL', 'nl-BE'],
        'ru': ['ru-RU'],
        'ja': ['ja-JP'],
        'zh-CN': ['zh-CN', 'zh'],
        'zh-TW': ['zh-TW', 'zh-HK'],
        'ko': ['ko-KR'],
        'ar': ['ar-SA', 'ar-AE'],
        'hi': ['hi-IN'],
        'bn': ['bn-BD', 'bn-IN'],
        'ak': ['en-US'],
        'gaa': ['en-US'],
      };
      
      const availableVoices = await Speech.getAvailableVoicesAsync();
      const possibleLanguages = speechLanguageMap[language] || [language];
      let selectedLanguage = possibleLanguages[0];
      
      for (const lang of possibleLanguages) {
        const matchingVoice = availableVoices.find(voice => 
          voice.language.toLowerCase() === lang.toLowerCase()
        );
        if (matchingVoice) {
          selectedLanguage = lang;
          break;
        }
      }
      
      console.log(`Using Expo Speech: "${text}" in language: ${selectedLanguage} (original: ${language})`);
      
      await Speech.speak(text, { 
        language: selectedLanguage,
        rate: 0.75,       
        pitch: 1.0,
        volume: 1.0,
      });
    } catch (error) {
      console.error('Speech error:', error);
      Alert.alert('Speech Error', 'Unable to speak text. Please try again.');
    }
  };

  const onShare = async () => {
    try {
      const content = `Original: ${transcribedText}\n\nTranslation (${targetLang}): ${translatedText}`;
      await Share.share({
        message: content,
      });
    } catch (error: any) {
      Alert.alert(error.message);
    }
  };

  const toggleFavorite = async (id: string) => {
    try {
      const newHistory = history.map(item =>
        item.id === id ? { ...item, isFavorite: !item.isFavorite } : item
      );
      setHistory(newHistory);
      const jsonValue = JSON.stringify(newHistory);
      await AsyncStorage.setItem('@translation_history', jsonValue);
    } catch (e) {
      console.error('Failed to toggle favorite.', e);
    }
  };

  const translateText = async () => {
    if (!textToTranslate.trim()) {
      Alert.alert('Error', 'Please enter some text to translate.');
      return;
    }

    setIsLoading(true);
    setTranscribedText('');
    setTranslatedText('');
    setCulturalTips([]);

    try {
      const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
      let detectedLang = sourceLang;

      // Auto-detect language if needed
      if (sourceLang === 'auto') {
        const detectPrompt = `Detect the language of this text and respond with just the language code (e.g., "en" for English, "es" for Spanish): ${textToTranslate}`;
        const detectResult = await model.generateContent(detectPrompt);
        detectedLang = detectResult.response.text().trim().toLowerCase();
      }

      setTranscribedText(textToTranslate);

      // Translate
      const translatePrompt = `Translate this text from ${detectedLang} to ${targetLang}: ${textToTranslate}`;
      const translateResult = await model.generateContent(translatePrompt);
      const translated = translateResult.response.text().trim().replace(/\*+/g, '');
      setTranslatedText(translated);

      // Cultural tips
      const tipsPrompt = `Provide 3-5 concise cultural nuance tips for speaking ${targetLang} in a conversation, considering the context of the translated text: "${translated}". Format as a numbered list.`;
      const tipsResult = await model.generateContent(tipsPrompt);
      const tips = tipsResult.response.text().trim().replace(/\*+/g, '').split('\n').filter(tip => tip.length > 0);
      setCulturalTips(tips);

      // Save to history
      await saveTranslation({
        transcribedText: textToTranslate,
        translatedText: translated,
        culturalTips: tips,
        sourceLang: detectedLang,
        targetLang,
        isFavorite: false,
      });

      setTextToTranslate('');

    } catch (err) {
      console.error('Translation error', err);
      Alert.alert('Error', 'Failed to translate text. Check your API key and network.');
    } finally {
      setIsLoading(false);
    }
  };

  const startConversationRecording = async () => {
    try {
      const permission = await Audio.requestPermissionsAsync();
      if (permission.status !== 'granted') {
        Alert.alert('Permission required', 'Microphone permission is needed to record audio.');
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      setRecording(recording);
    } catch (err) {
      console.error('Failed to start recording', err);
      Alert.alert('Error', 'Failed to start recording.');
    }
  };

  const stopConversationRecording = async () => {
    if (!recording) return;

    setRecording(null);
    await recording.stopAndUnloadAsync();
    const uri = recording.getURI();

    if (!uri) {
      Alert.alert('Error', 'No audio recorded.');
      return;
    }

    setIsLoading(true);

    try {
      const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

      // Fetch audio file
      const audioResponse = await fetch(uri);
      const audioBlob = await audioResponse.blob();
      const base64Data = await blobToBase64(audioBlob);

      // Determine languages based on speaker
      const fromLang = activeConversationSpeaker === 'A' ? sourceLang : targetLang;
      const toLang = activeConversationSpeaker === 'A' ? targetLang : sourceLang;

      // Transcribe
      const transcribePrompt = `Transcribe this audio in ${fromLang} language.`;
      const transcribeResult = await model.generateContent([
        transcribePrompt,
        { inlineData: { mimeType: audioResponse.headers.get('content-type') || 'audio/m4a', data: base64Data } }
      ]);
      const text = transcribeResult.response.text().trim();

      // Translate
      const translatePrompt = `Translate this text from ${fromLang} to ${toLang}: ${text}`;
      const translateResult = await model.generateContent(translatePrompt);
      const translated = translateResult.response.text().trim();

      // Add user message to conversation history
      const newConversationItem = {
        id: Date.now().toString(),
        text,
        translation: translated,
        speaker: activeConversationSpeaker,
        timestamp: Date.now(),
      };

      setConversationHistory(prev => [...prev, newConversationItem]);

      // Generate AI response in the target language (if AI mode is enabled)
      if (aiConversationMode) {
        await generateAIResponse(translated, fromLang, toLang);
      }

    } catch (err) {
      console.error('Processing error', err);
      Alert.alert('Error', 'Failed to process audio. Check your API key and network.');
    } finally {
      setIsLoading(false);
    }
  };

  const generateAIResponse = async (userMessage: string, fromLang: string, toLang: string) => {
    try {
      const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
      
      // Get conversation context
      const conversationContext = conversationHistory.slice(-4).map(item => 
        `${item.speaker === 'A' ? 'User' : 'Assistant'}: ${item.translation}`
      ).join('\n');
      
      // Generate contextual response
      const responsePrompt = `You are having a natural conversation. The user just said: "${userMessage}"
      
Previous conversation context:
${conversationContext}

Generate a natural, helpful, and engaging response in ${toLang} language. Keep it conversational and relevant to what they said. Be friendly and helpful. Maximum 2 sentences.`;

      const responseResult = await model.generateContent(responsePrompt);
      const aiResponse = responseResult.response.text().trim().replace(/\*+/g, '');
      
      // Translate AI response back to user's language
      const translateBackPrompt = `Translate this text from ${toLang} to ${fromLang}: ${aiResponse}`;
      const translateBackResult = await model.generateContent(translateBackPrompt);
      const aiResponseTranslated = translateBackResult.response.text().trim().replace(/\*+/g, '');

      // Add AI response to conversation
      const aiConversationItem = {
        id: (Date.now() + 1).toString(),
        text: aiResponse,
        translation: aiResponseTranslated,
        speaker: (activeConversationSpeaker === 'A' ? 'B' : 'A') as 'A' | 'B', // Opposite speaker
        timestamp: Date.now() + 1,
      };

      setConversationHistory(prev => [...prev, aiConversationItem]);
      
      // Speak the AI response in the target language
      setTimeout(async () => {
        await speak(aiResponse, toLang);
      }, 500);

    } catch (err) {
      console.error('AI Response error', err);
      // Don't show alert for AI response errors to avoid interrupting conversation
    }
  };

  const clearConversation = () => {
    Alert.alert(
      'Clear Conversation',
      'Are you sure you want to clear the conversation history?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Clear', style: 'destructive', onPress: () => setConversationHistory([]) }
      ]
    );
  };

  const pickImageForOCR = async () => {
    try {
      // Request permissions
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission required', 'Camera roll permissions are needed to pick images.');
        return;
      }

      // Show options for camera or gallery
      Alert.alert(
        'Select Image Source',
        'Choose how you want to select an image:',
        [
          { text: 'Camera', onPress: () => openCamera() },
          { text: 'Gallery', onPress: () => openGallery() },
          { text: 'Cancel', style: 'cancel' }
        ]
      );
    } catch (error) {
      console.error('Error requesting permissions:', error);
      Alert.alert('Error', 'Failed to request permissions.');
    }
  };

  const openCamera = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Camera Permission Required', 
          'Please allow camera access to take photos for translation.'
        );
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        processImageForOCR(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error opening camera:', error);
      Alert.alert('Error', 'Failed to open camera.');
    }
  };

  const openGallery = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        processImageForOCR(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error opening gallery:', error);
      Alert.alert('Error', 'Failed to open gallery.');
    }
  };

  const processImageForOCR = async (imageUri: string) => {
    setIsProcessingOCR(true);
    setOcrImage(imageUri);
    setOcrText('');

    try {
      const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

      // Convert image to base64
      const response = await fetch(imageUri);
      const blob = await response.blob();
      const base64Data = await blobToBase64(blob);

      // Use Gemini Vision for OCR
      const prompt = `Extract all text from this image. Return only the text content, no additional explanations or formatting.`;
      
      const result = await model.generateContent([
        prompt,
        { inlineData: { mimeType: 'image/jpeg', data: base64Data } }
      ]);

      const extractedText = result.response.text().trim();
      setOcrText(extractedText);

      // Auto-translate the extracted text
      if (extractedText) {
        await translateExtractedText(extractedText);
      }
    } catch (error) {
      console.error('OCR processing error:', error);
      Alert.alert('Error', 'Failed to process image. Check your API key and network connection.');
    } finally {
      setIsProcessingOCR(false);
    }
  };

  const translateExtractedText = async (text: string) => {
    setIsLoading(true);
    try {
      const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
      
      // Auto-detect language if needed
      let detectedSourceLang = sourceLang;
      if (sourceLang === 'auto') {
        const detectPrompt = `Detect the language of this text and return only the language code (e.g., 'en', 'es', 'fr'): "${text}"`;
        const detectResult = await model.generateContent(detectPrompt);
        detectedSourceLang = detectResult.response.text().trim().toLowerCase();
      }

      // Translate text
      const translatePrompt = `Translate this text from ${detectedSourceLang} to ${targetLang}: "${text}"`;
      const translateResult = await model.generateContent(translatePrompt);
      const translated = translateResult.response.text().trim().replace(/\*+/g, '');

      // Get cultural tips
      const tipsPrompt = `Provide 2-3 brief cultural context tips for translating from ${detectedSourceLang} to ${targetLang}. Format as bullet points.`;
      const tipsResult = await model.generateContent(tipsPrompt);
      const tips = tipsResult.response.text().trim().replace(/\*+/g, '').split('\n').filter(tip => tip.trim());

      // Set results
      setTranscribedText(text);
      setTranslatedText(translated);
      setCulturalTips(tips);

      // Save to history
      const newHistoryItem: TranslationHistoryItem = {
        id: Date.now().toString(),
        transcribedText: text,
        translatedText: translated,
        culturalTips: tips,
        sourceLang: detectedSourceLang,
        targetLang,
        timestamp: Date.now(),
        isFavorite: false,
      };

      const updatedHistory = [newHistoryItem, ...history];
      setHistory(updatedHistory);
      await AsyncStorage.setItem('translationHistory', JSON.stringify(updatedHistory));

    } catch (error) {
      console.error('Translation error:', error);
      Alert.alert('Error', 'Failed to translate extracted text.');
    } finally {
      setIsLoading(false);
    }
  };

  const enhancedLanguages = [{ label: 'Auto-Detect', value: 'auto' }, ...languages];
  
  const filteredLanguages = (editingLang === 'source' ? enhancedLanguages : languages).filter(lang =>
    lang.label.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <SafeAreaProvider>
      <View style={styles.safeArea}>
        <SafeAreaView style={styles.safeArea}>
        <Modal
          animationType="slide"
          transparent={true}
          visible={modalVisible}
          onRequestClose={() => setModalVisible(false)}
        >
          <View style={styles.modalContainer}>
            <View style={styles.modalContent}>
              <TextInput
                style={styles.searchInput}
                placeholder="Search language..."
                placeholderTextColor="#8E8E93"
                value={searchTerm}
                onChangeText={setSearchTerm}
              />
              <FlatList
                data={filteredLanguages}
                keyExtractor={(item) => item.value}
                renderItem={({ item }) => (
                  <TouchableOpacity style={styles.langItem} onPress={() => onSelectLang(item.value)}>
                    <Text style={styles.langItemText}>{item.label}</Text>
                  </TouchableOpacity>
                )}
              />
              <TouchableOpacity style={styles.closeButton} onPress={() => setModalVisible(false)}>
                <Text style={styles.closeButtonText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>


        {view === 'main' ? (
          <ScrollView contentContainerStyle={styles.container}>
            <View style={styles.header}>
              <Text style={styles.title}>Voice Translation</Text>
              <Text style={styles.subtitle}>Companion</Text>
            </View>

            {isOffline && (
              <View style={styles.offlineBanner}>
                <Text style={styles.offlineText}>Offline Mode: Recording disabled.</Text>
              </View>
            )}

            <View style={styles.inputModeToggle}>
              <TouchableOpacity 
                style={[styles.toggleButton, inputMode === 'voice' && styles.toggleButtonActive]}
                onPress={() => setInputMode('voice')}
                activeOpacity={0.7}
              >
                <Feather name="mic" size={18} color={inputMode === 'voice' ? '#fff' : '#007AFF'} />
                <Text style={[styles.toggleText, inputMode === 'voice' && styles.toggleTextActive]}>Voice</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.toggleButton, inputMode === 'text' && styles.toggleButtonActive]}
                onPress={() => setInputMode('text')}
                activeOpacity={0.7}
              >
                <Feather name="type" size={18} color={inputMode === 'text' ? '#fff' : '#007AFF'} />
                <Text style={[styles.toggleText, inputMode === 'text' && styles.toggleTextActive]}>Text</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.toggleButton, inputMode === 'ocr' && styles.toggleButtonActive]}
                onPress={() => setInputMode('ocr')}
                activeOpacity={0.7}
              >
                <Feather name="camera" size={18} color={inputMode === 'ocr' ? '#fff' : '#007AFF'} />
                <Text style={[styles.toggleText, inputMode === 'ocr' && styles.toggleTextActive]}>OCR</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.langContainer}>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>From:</Text>
                <TextInput
                  style={styles.input}
                  value={sourceLang === 'auto' ? 'Auto-Detect' : sourceLang}
                  onChangeText={setSourceLang}
                  placeholder="Source Language"
                  placeholderTextColor="#8E8E93"
                  editable={false}
                />
                <TouchableOpacity onPress={() => openLangModal('source')} activeOpacity={0.7}>
                  <Feather name="chevron-down" size={24} color="#007AFF" />
                </TouchableOpacity>
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>To:</Text>
                <TextInput
                  style={styles.input}
                  value={targetLang}
                  onChangeText={setTargetLang}
                  placeholder="Target Language"
                  placeholderTextColor="#8E8E93"
                  editable={false}
                />
                <TouchableOpacity onPress={() => openLangModal('target')} activeOpacity={0.7}>
                  <Feather name="chevron-down" size={24} color="#007AFF" />
                </TouchableOpacity>
              </View>
            </View>

            {inputMode === 'voice' ? (
              <View style={styles.micButtonContainer}>
                <TouchableOpacity
                  style={[styles.micButton, (recording || isOffline) && styles.micButtonRecording]}
                  onPress={recording ? stopRecording : startRecording}
                  disabled={isOffline}
                  activeOpacity={0.7}
                >
                  <Feather name={recording ? "square" : "mic"} size={32} color="#fff" />
                </TouchableOpacity>
              </View>
            ) : inputMode === 'text' ? (
              <View style={styles.textInputContainer}>
                <TextInput
                  style={styles.textInput}
                  value={textToTranslate}
                  onChangeText={setTextToTranslate}
                  placeholder="Enter text to translate..."
                  placeholderTextColor="#8E8E93"
                  multiline
                  numberOfLines={4}
                />
                <TouchableOpacity
                  style={[styles.translateButton, isOffline && styles.translateButtonDisabled]}
                  onPress={translateText}
                  disabled={isOffline}
                  activeOpacity={0.7}
                >
                  <Text style={styles.translateButtonText}>Translate</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.ocrContainer}>
                <TouchableOpacity
                  style={[styles.ocrButton, isOffline && styles.translateButtonDisabled]}
                  onPress={pickImageForOCR}
                  disabled={isOffline}
                  activeOpacity={0.7}
                >
                  <Feather name="camera" size={24} color="#fff" />
                  <Text style={styles.ocrButtonText}>Take Photo or Select Image</Text>
                </TouchableOpacity>
                
                {ocrImage && (
                  <View style={styles.ocrImageContainer}>
                    <Text style={styles.ocrImageLabel}>Selected Image:</Text>
                    {/* Image preview would go here */}
                  </View>
                )}
                
                {isProcessingOCR && (
                  <View style={styles.ocrProcessing}>
                    <ActivityIndicator size="small" color="#007AFF" />
                    <Text style={styles.ocrProcessingText}>Extracting text from image...</Text>
                  </View>
                )}
                
                {!!ocrText && (
                  <View style={styles.ocrTextContainer}>
                    <Text style={styles.ocrTextLabel}>Extracted Text:</Text>
                    <Text style={styles.ocrTextContent}>{ocrText}</Text>
                  </View>
                )}
              </View>
            )}


            {isLoading && <ActivityIndicator size="large" color="#007AFF" style={{ marginVertical: 20 }} />}

            {transcribedText ? (
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <Feather name="mic" size={20} color="#1C1C1E" />
                  <Text style={styles.cardTitle}>Transcribed Text</Text>
                </View>
                <Text style={styles.cardText}>{transcribedText}</Text>
              </View>
            ) : null}

            {translatedText ? (
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <Feather name="globe" size={20} color="#1C1C1E" />
                  <Text style={styles.cardTitle}>Translated Text</Text>
                  <View style={styles.cardActions}>
                    <TouchableOpacity onPress={() => speak(translatedText, targetLang)} style={styles.cardActionButton}>
                      <Feather name="volume-2" size={22} color="#007AFF" />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={onShare} style={styles.cardActionButton}>
                      <Feather name="share" size={22} color="#007AFF" />
                    </TouchableOpacity>
                  </View>
                </View>
                <Text style={styles.cardText}>{translatedText}</Text>
              </View>
            ) : null}

            {culturalTips.length > 0 ? (
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <Feather name="info" size={20} color="#1C1C1E" />
                  <Text style={styles.cardTitle}>Cultural Nuances</Text>
                </View>
                {culturalTips.map((tip, index) => (
                  <Text key={`${tip}-${index}`} style={styles.tipText}>- {tip}</Text>
                ))}
              </View>
            ) : null}

            <StatusBar style="dark" />
          </ScrollView>
        ) : view === 'conversation' ? (
          <View style={styles.conversationContainer}>
            <View style={styles.conversationHeader}>
              <Text style={styles.conversationTitle}>Live Conversation</Text>
              <View style={styles.conversationHeaderControls}>
                <TouchableOpacity 
                  onPress={() => setAiConversationMode(!aiConversationMode)} 
                  style={[styles.aiToggleButton, aiConversationMode && styles.aiToggleButtonActive]}
                >
                  <Feather name="cpu" size={16} color={aiConversationMode ? '#FFFFFF' : '#007AFF'} />
                  <Text style={[styles.aiToggleText, aiConversationMode && styles.aiToggleTextActive]}>
                    AI {aiConversationMode ? 'ON' : 'OFF'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={clearConversation} style={styles.clearButton}>
                  <Feather name="trash-2" size={20} color="#FF3B30" />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.languageIndicators}>
              <View style={styles.langIndicator}>
                <Text style={styles.langIndicatorLabel}>Speaker A</Text>
                <Text style={styles.langIndicatorText}>{sourceLang.toUpperCase()}</Text>
              </View>
              <Feather name="refresh-cw" size={24} color="#8E8E93" />
              <View style={styles.langIndicator}>
                <Text style={styles.langIndicatorLabel}>Speaker B</Text>
                <Text style={styles.langIndicatorText}>{targetLang.toUpperCase()}</Text>
              </View>
            </View>

            {aiConversationMode && (
              <View style={styles.aiModeInfo}>
                <Feather name="info" size={14} color="#007AFF" />
                <Text style={styles.aiModeInfoText}>AI will respond automatically to continue the conversation</Text>
              </View>
            )}

            <ScrollView style={styles.conversationMessages} contentContainerStyle={{ flexGrow: 1 }}>
              {conversationHistory.map((item) => (
                <View key={item.id} style={[
                  styles.messageContainer,
                  item.speaker === 'A' ? styles.messageA : styles.messageB
                ]}>
                  <View style={[
                    styles.messageBubble,
                    item.speaker === 'A' ? styles.bubbleA : styles.bubbleB
                  ]}>
                    <Text style={[
                      styles.messageText,
                      item.speaker === 'A' ? styles.textA : styles.textB
                    ]}>
                      {item.text}
                    </Text>
                    <Text style={[
                      styles.translationText,
                      item.speaker === 'A' ? styles.translationA : styles.translationB
                    ]}>
                      {item.translation}
                    </Text>
                  </View>
                  <TouchableOpacity 
                    onPress={() => speak(item.translation, item.speaker === 'A' ? targetLang : sourceLang)}
                    style={styles.speakButton}
                  >
                    <Feather name="volume-2" size={16} color="#8E8E93" />
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>

            <View style={styles.conversationControls}>
              <View style={styles.speakerToggle}>
                <TouchableOpacity 
                  style={[styles.speakerButton, activeConversationSpeaker === 'A' && styles.speakerButtonActive]}
                  onPress={() => setActiveConversationSpeaker('A')}
                >
                  <Text style={[styles.speakerButtonText, activeConversationSpeaker === 'A' && styles.speakerButtonTextActive]}>
                    A ({sourceLang.toUpperCase()})
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.speakerButton, activeConversationSpeaker === 'B' && styles.speakerButtonActive]}
                  onPress={() => setActiveConversationSpeaker('B')}
                >
                  <Text style={[styles.speakerButtonText, activeConversationSpeaker === 'B' && styles.speakerButtonTextActive]}>
                    B ({targetLang.toUpperCase()})
                  </Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={[styles.conversationMicButton, recording && styles.conversationMicButtonActive]}
                onPress={recording ? stopConversationRecording : startConversationRecording}
                disabled={isOffline}
                activeOpacity={0.7}
              >
                <Feather name={recording ? "square" : "mic"} size={24} color="#fff" />
              </TouchableOpacity>
            </View>

            {isLoading && (
              <View style={styles.conversationLoading}>
                <ActivityIndicator size="small" color="#007AFF" />
              </View>
            )}
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.historyContainer}>
            <View style={styles.header}>
              <Text style={styles.title}>History</Text>
            </View>
            {history.length > 0 ? (
              history.map(item => (
                <View key={item.id} style={styles.card}>
                  <View style={styles.cardHeader}>
                    <Text style={styles.historyTimestamp}>{new Date(item.timestamp).toLocaleString()}</Text>
                    <View style={styles.cardActions}>
                      <TouchableOpacity onPress={() => toggleFavorite(item.id)} style={styles.cardActionButton}>
                        <Feather name="star" size={22} color={item.isFavorite ? '#FFCC00' : '#E5E5EA'} />
                      </TouchableOpacity>
                    </View>
                  </View>
                  <Text style={styles.cardText}><Text style={styles.bold}>From ({item.sourceLang}):</Text> {item.transcribedText}</Text>
                  <Text style={styles.cardText}><Text style={styles.bold}>To ({item.targetLang}):</Text> {item.translatedText}</Text>
                </View>
              ))
            ) : (
              <Text style={styles.noHistoryText}>No translations saved yet.</Text>
            )}
          </ScrollView>
        )}
        
        {/* Bottom Navigation Bar */}
        <View style={styles.bottomBar}>
          <TouchableOpacity onPress={() => setView('main')} style={styles.bottomBarButton} activeOpacity={0.7}>
            <Feather name="home" size={24} color={view === 'main' ? '#007AFF' : '#8E8E93'} />
            <Text style={[styles.bottomBarText, view === 'main' && styles.bottomBarTextActive]}>Home</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setView('conversation')} style={styles.bottomBarButton} activeOpacity={0.7}>
            <Feather name="message-circle" size={24} color={view === 'conversation' ? '#007AFF' : '#8E8E93'} />
            <Text style={[styles.bottomBarText, view === 'conversation' && styles.bottomBarTextActive]}>Chat</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setView('history')} style={styles.bottomBarButton} activeOpacity={0.7}>
            <Feather name="archive" size={24} color={view === 'history' ? '#007AFF' : '#8E8E93'} />
            <Text style={[styles.bottomBarText, view === 'history' && styles.bottomBarTextActive]}>History</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F2F2F7', // Light gray background
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  topBarButton: {
    marginHorizontal: 25,
  },
  bottomBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderTopWidth: 1,
    borderTopColor: '#E5E5EA',
    backgroundColor: '#F8F8F8',
  },
  bottomBarButton: {
    alignItems: 'center',
    paddingVertical: 5,
    flex: 1,
  },
  bottomBarText: {
    fontSize: 10,
    marginTop: 2,
    color: '#8E8E93',
    fontWeight: '500',
  },
  bottomBarTextActive: {
    color: '#007AFF',
  },
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
  },
  historyContainer: {
    flexGrow: 1,
    padding: 20,
    paddingTop: 40, // Extra padding for notch/status bar area
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  title: {
    fontSize: 34,
    fontWeight: 'bold',
    color: '#1C1C1E',
  },
  subtitle: {
    fontSize: 17,
    color: '#8E8E93',
  },
  langContainer: {
    marginBottom: 30,
  },
  inputGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 15,
    paddingHorizontal: 15,
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  label: {
    color: '#1C1C1E',
    fontSize: 16,
    marginRight: 10,
  },
  input: {
    flex: 1,
    paddingVertical: 15,
    fontSize: 16,
    color: '#1C1C1E',
  },
  micButtonContainer: {
    alignItems: 'center',
    marginBottom: 30,
  },
  micButton: {
    backgroundColor: '#007AFF',
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 5,
  },
  micButtonRecording: {
    backgroundColor: '#FF3B30',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1C1C1E',
    marginLeft: 10,
    flex: 1,
  },
  cardActions: {
    flexDirection: 'row',
  },
  cardActionButton: {
    marginLeft: 15,
  },
  cardText: {
    fontSize: 16,
    lineHeight: 24,
    color: '#3C3C43',
  },
  tipText: {
    fontSize: 16,
    lineHeight: 24,
    color: '#3C3C43',
    marginBottom: 5,
  },
  offlineBanner: {
    backgroundColor: '#FFCC00',
    padding: 10,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 20,
  },
  offlineText: {
    color: '#1C1C1E',
    fontWeight: '500',
  },
  noHistoryText: {
    color: '#8E8E93',
    textAlign: 'center',
    fontSize: 16,
  },
  historyTimestamp: {
    fontSize: 12,
    color: '#8E8E93',
    marginBottom: 10,
  },
  bold: {
    fontWeight: '600',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  modalContent: {
    backgroundColor: '#F2F2F7',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    width: '100%',
    height: '85%',
  },
  searchInput: {
    backgroundColor: '#E5E5EA',
    borderRadius: 10,
    padding: 15,
    marginBottom: 15,
    fontSize: 16,
  },
  langItem: {
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  langItemText: {
    fontSize: 18,
    color: '#1C1C1E',
  },
  closeButton: {
    marginTop: 20,
    backgroundColor: '#007AFF',
    borderRadius: 12,
    padding: 15,
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  inputModeToggle: {
    flexDirection: 'row',
    backgroundColor: '#E5E5EA',
    borderRadius: 8,
    padding: 4,
    marginBottom: 20,
  },
  toggleButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 6,
  },
  toggleButtonActive: {
    backgroundColor: '#007AFF',
  },
  toggleText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 6,
  },
  toggleTextActive: {
    color: '#fff',
  },
  textInputContainer: {
    marginBottom: 30,
  },
  textInput: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 15,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    textAlignVertical: 'top',
    marginBottom: 15,
    minHeight: 100,
  },
  translateButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: 'center',
  },
  translateButtonDisabled: {
    backgroundColor: '#E5E5EA',
  },
  translateButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  ocrContainer: {
    padding: 20,
    alignItems: 'center',
  },
  ocrButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#007AFF',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    marginBottom: 20,
  },
  ocrButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 10,
  },
  ocrImageContainer: {
    marginVertical: 15,
    padding: 15,
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    width: '100%',
  },
  ocrImageLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 5,
  },
  ocrProcessing: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F8FF',
    padding: 15,
    borderRadius: 12,
    marginVertical: 10,
  },
  ocrProcessingText: {
    marginLeft: 10,
    fontSize: 14,
    color: '#007AFF',
  },
  ocrTextContainer: {
    marginVertical: 15,
    padding: 15,
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    width: '100%',
  },
  ocrTextLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 10,
  },
  ocrTextContent: {
    fontSize: 16,
    color: '#1C1C1E',
    lineHeight: 24,
  },
  conversationContainer: {
    flex: 1,
    backgroundColor: '#F2F2F7',
    paddingTop: 20, // Extra padding for notch/status bar area
  },
  conversationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: 30, // Extra top padding for better visibility under notch
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  conversationTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1C1C1E',
  },
  clearButton: {
    padding: 8,
  },
  conversationHeaderControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  aiToggleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#007AFF',
    backgroundColor: 'transparent',
  },
  aiToggleButtonActive: {
    backgroundColor: '#007AFF',
  },
  aiToggleText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#007AFF',
    marginLeft: 4,
  },
  aiToggleTextActive: {
    color: '#FFFFFF',
  },
  aiModeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F8FF',
    marginHorizontal: 20,
    marginVertical: 8,
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#007AFF',
  },
  aiModeInfoText: {
    fontSize: 12,
    color: '#007AFF',
    marginLeft: 8,
    flex: 1,
  },
  languageIndicators: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    backgroundColor: '#fff',
    marginHorizontal: 20,
    marginVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  langIndicator: {
    alignItems: 'center',
  },
  langIndicatorLabel: {
    fontSize: 12,
    color: '#8E8E93',
    marginBottom: 4,
  },
  langIndicatorText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1C1C1E',
  },
  conversationMessages: {
    flex: 1,
    paddingHorizontal: 20,
  },
  messageContainer: {
    marginVertical: 8,
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  messageA: {
    justifyContent: 'flex-start',
  },
  messageB: {
    justifyContent: 'flex-end',
  },
  messageBubble: {
    maxWidth: '75%',
    padding: 12,
    borderRadius: 16,
  },
  bubbleA: {
    backgroundColor: '#E5E5EA',
    borderBottomLeftRadius: 4,
  },
  bubbleB: {
    backgroundColor: '#007AFF',
    borderBottomRightRadius: 4,
  },
  messageText: {
    fontSize: 16,
    marginBottom: 4,
  },
  textA: {
    color: '#1C1C1E',
  },
  textB: {
    color: '#fff',
  },
  translationText: {
    fontSize: 14,
    fontStyle: 'italic',
  },
  translationA: {
    color: '#8E8E93',
  },
  translationB: {
    color: 'rgba(255, 255, 255, 0.8)',
  },
  speakButton: {
    marginLeft: 8,
    padding: 4,
  },
  conversationControls: {
    padding: 20,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#E5E5EA',
  },
  speakerToggle: {
    flexDirection: 'row',
    backgroundColor: '#E5E5EA',
    borderRadius: 8,
    padding: 4,
    marginBottom: 15,
  },
  speakerButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 6,
  },
  speakerButtonActive: {
    backgroundColor: '#007AFF',
  },
  speakerButtonText: {
    color: '#007AFF',
    fontSize: 14,
    fontWeight: '600',
  },
  speakerButtonTextActive: {
    color: '#fff',
  },
  conversationMicButton: {
    backgroundColor: '#007AFF',
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
  },
  conversationMicButtonActive: {
    backgroundColor: '#FF3B30',
  },
  conversationLoading: {
    position: 'absolute',
    bottom: 100,
    alignSelf: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    padding: 10,
    borderRadius: 20,
  },
});
