import React, { useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View, TouchableOpacity, TextInput, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { Audio } from 'expo-av';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';

const genAI = new GoogleGenerativeAI(process.env.EXPO_PUBLIC_GEMINI_API_KEY || 'YOUR_API_KEY');

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

    } catch (err) {
      console.error('Processing error', err);
      Alert.alert('Error', 'Failed to process audio. Check your API key and network.');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <LinearGradient
      colors={['#8E2DE2', '#4A00E0']}
      style={styles.safeArea}
    >
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.container}>
          <View style={styles.header}>
            <Text style={styles.title}>Voice Translation</Text>
            <Text style={styles.subtitle}>Companion</Text>
          </View>

          <View style={styles.langContainer}>
            <View style={styles.inputGroup}>
              <Feather name="globe" size={20} color="#fff" style={styles.icon} />
              <TextInput
                style={styles.input}
                value={sourceLang}
                onChangeText={setSourceLang}
                placeholder="Source Language (e.g., en)"
                placeholderTextColor="#ccc"
              />
            </View>
            <View style={styles.inputGroup}>
              <Feather name="flag" size={20} color="#fff" style={styles.icon} />
              <TextInput
                style={styles.input}
                value={targetLang}
                onChangeText={setTargetLang}
                placeholder="Target Language (e.g., es)"
                placeholderTextColor="#ccc"
              />
            </View>
          </View>

          <TouchableOpacity
            style={[styles.button, recording && styles.buttonRecording]}
            onPress={recording ? stopRecording : startRecording}
          >
            <Feather name={recording ? "stop-circle" : "mic"} size={24} color="#fff" />
            <Text style={styles.buttonText}>
              {recording ? 'Stop Recording' : 'Start Recording'}
            </Text>
          </TouchableOpacity>

          {isLoading && <ActivityIndicator size="large" color="#fff" style={{ marginVertical: 20 }} />}

          {transcribedText ? (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Feather name="mic" size={20} color="#333" />
                <Text style={styles.cardTitle}>Transcribed Text</Text>
              </View>
              <Text style={styles.cardText}>{transcribedText}</Text>
            </View>
          ) : null}

          {translatedText ? (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Feather name="globe" size={20} color="#333" />
                <Text style={styles.cardTitle}>Translated Text</Text>
              </View>
              <Text style={styles.cardText}>{translatedText}</Text>
            </View>
          ) : null}

          {culturalTips.length > 0 ? (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Feather name="info" size={20} color="#333" />
                <Text style={styles.cardTitle}>Cultural Nuances</Text>
              </View>
              {culturalTips.map((tip, index) => (
                <Text key={`${tip}-${index}`} style={styles.tipText}>- {tip}</Text>
              ))}
            </View>
          ) : null}

          <StatusBar style="light" />
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
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
    fontSize: 36,
    fontWeight: 'bold',
    color: '#fff',
  },
  subtitle: {
    fontSize: 20,
    color: '#eee',
  },
  langContainer: {
    marginBottom: 30,
  },
  inputGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 12,
    marginBottom: 15,
    paddingHorizontal: 15,
  },
  icon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    paddingVertical: 15,
    fontSize: 16,
    color: '#fff',
  },
  button: {
    backgroundColor: '#fff',
    padding: 18,
    borderRadius: 25,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 5,
  },
  buttonRecording: {
    backgroundColor: '#FF3B30',
  },
  buttonText: {
    color: '#4A00E0',
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 10,
  },
  card: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginLeft: 10,
  },
  cardText: {
    fontSize: 16,
    lineHeight: 24,
    color: '#555',
  },
  tipText: {
    fontSize: 16,
    lineHeight: 24,
    color: '#555',
    marginBottom: 5,
  },
});
