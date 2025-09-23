import React, { useState, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView, Alert, ActivityIndicator, Modal, FlatList, TextInput } from 'react-native';
import { Audio } from 'expo-av';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
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
  const [view, setView] = useState<'main' | 'history'>('main');
  const [modalVisible, setModalVisible] = useState(false);
  const [editingLang, setEditingLang] = useState<'source' | 'target' | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

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
      const translated = translateResult.response.text().trim();
      setTranslatedText(translated);

      // Cultural tips
      const tipsPrompt = `Provide 3-5 concise cultural nuance tips for speaking ${targetLang} in a conversation, considering the context of the translated text: "${translated}". Format as a numbered list.`;
      const tipsResult = await model.generateContent(tipsPrompt);
      const tips = tipsResult.response.text().trim().split('\n').filter(tip => tip.length > 0);
      setCulturalTips(tips);

      // Save to history
      await saveTranslation({
        transcribedText: text,
        translatedText: translated,
        culturalTips: tips,
        sourceLang,
        targetLang,
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

  const filteredLanguages = languages.filter(lang =>
    lang.label.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
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

        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => setView('main')} style={styles.topBarButton} activeOpacity={0.7}>
            <Feather name="home" size={24} color={view === 'main' ? '#007AFF' : '#8E8E93'} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setView('history')} style={styles.topBarButton} activeOpacity={0.7}>
            <Feather name="archive" size={24} color={view === 'history' ? '#007AFF' : '#8E8E93'} />
          </TouchableOpacity>
        </View>
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

            <View style={styles.langContainer}>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>From:</Text>
                <TextInput
                  style={styles.input}
                  value={sourceLang}
                  onChangeText={setSourceLang}
                  placeholder="Source Language"
                  placeholderTextColor="#8E8E93"
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
                />
                <TouchableOpacity onPress={() => openLangModal('target')} activeOpacity={0.7}>
                  <Feather name="chevron-down" size={24} color="#007AFF" />
                </TouchableOpacity>
              </View>
            </View>

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

            <StatusBar style="light" />
          </ScrollView>
        ) : (
          <ScrollView contentContainerStyle={styles.container}>
            <View style={styles.header}>
              <Text style={styles.title}>History</Text>
            </View>
            {history.length > 0 ? (
              history.map(item => (
                <View key={item.id} style={styles.card}>
                  <Text style={styles.historyTimestamp}>{new Date(item.timestamp).toLocaleString()}</Text>
                  <Text style={styles.cardText}><Text style={styles.bold}>From ({item.sourceLang}):</Text> {item.transcribedText}</Text>
                  <Text style={styles.cardText}><Text style={styles.bold}>To ({item.targetLang}):</Text> {item.translatedText}</Text>
                </View>
              ))
            ) : (
              <Text style={styles.noHistoryText}>No translations saved yet.</Text>
            )}
          </ScrollView>
        )}
      </SafeAreaView>
    </View>
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
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
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
});
