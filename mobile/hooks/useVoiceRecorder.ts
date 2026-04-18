import { useState, useCallback } from 'react';
import { Audio } from 'expo-av';
import { Alert } from 'react-native';

export interface VoiceRecorderHook {
  isRecording: boolean;
  duration: number;
  recordingUri: string | null;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<string | null>;
  resetRecorder: () => void;
}

export function useVoiceRecorder(): VoiceRecorderHook {
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [recordingUri, setRecordingUri] = useState<string | null>(null);
  const [timerInterval, setTimerInterval] = useState<ReturnType<typeof setInterval> | null>(null);

  const startRecording = useCallback(async () => {
    try {
      const permission = await Audio.requestPermissionsAsync();
      
      if (permission.status !== 'granted') {
        Alert.alert('Permission Rejected', 'Microphone access is required to record voice notes.');
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      console.log('Starting recording..');
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      
      setRecording(recording);
      setIsRecording(true);
      setRecordingUri(null);
      setDuration(0);

      // Start duration timer
      const interval = setInterval(() => {
        setDuration(prev => prev + 1);
      }, 1000);
      setTimerInterval(interval);

    } catch (err) {
      console.error('Failed to start recording', err);
      Alert.alert('Error', 'Failed to start recording.');
    }
  }, []);

  const stopRecording = useCallback(async () => {
    if (!recording) return null;

    console.log('Stopping recording..');
    setIsRecording(false);
    if (timerInterval) clearInterval(timerInterval);
    
    try {
      await recording.stopAndUnloadAsync();
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
      });
      const uri = recording.getURI();
      console.log('Recording stopped and stored at', uri);
      setRecordingUri(uri);
      setRecording(null);
      return uri;
    } catch (err) {
      console.error('Failed to stop recording', err);
      return null;
    }
  }, [recording, timerInterval]);

  const resetRecorder = useCallback(() => {
    setRecordingUri(null);
    setDuration(0);
  }, []);

  return {
    isRecording,
    duration,
    recordingUri,
    startRecording,
    stopRecording,
    resetRecorder,
  };
}
