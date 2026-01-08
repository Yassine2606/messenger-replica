import { useState, useCallback, useEffect, useRef } from 'react';
import { useAudioRecorder, RecordingPresets } from 'expo-audio';
import { audioService } from '@/services';

/**
 * useAudioRecording: Hook for managing audio recording with real waveform capture
 * Integrates expo-audio's useAudioRecorder with the audio service
 */
export function useAudioRecording() {
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentWaveform, setCurrentWaveform] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);
  const durationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Create recorder using expo-audio hook
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);

  // Initialize audio service and link recorder on mount
  useEffect(() => {
    const init = async () => {
      try {
        // Initialize audio session
        await audioService.initialize();
        // Link the recorder to the service
        audioService.setRecorder(recorder);
      } catch (err) {
        console.error('Audio init error:', err);
        setError('Failed to initialize audio');
      }
    };

    init();

    return () => {
      audioService.cleanup();
    };
  }, [recorder]);

  // Update duration and waveform while recording
  useEffect(() => {
    if (!isRecording) {
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
        durationIntervalRef.current = null;
      }
      return;
    }

    durationIntervalRef.current = setInterval(() => {
      setDuration(audioService.getCurrentDuration());
      setCurrentWaveform([...audioService.getCurrentWaveform()]);
    }, 50);

    return () => {
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
      }
    };
  }, [isRecording]);

  const startRecording = useCallback(async () => {
    try {
      setError(null);
      setDuration(0);
      setCurrentWaveform([]);
      
      // Prepare recorder if not already prepared
      try {
        const status = recorder.getStatus();
        if (!status.canRecord) {
          await recorder.prepareToRecordAsync();
        }
      } catch (prepareErr) {
        // If getStatus fails, try to prepare anyway
        await recorder.prepareToRecordAsync();
      }
      
      await audioService.startRecording();
      setIsRecording(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Recording failed';
      console.error('Recording start error:', message);
      setError(message);
      setIsRecording(false);
    }
  }, [recorder]);

  const stopRecording = useCallback(async () => {
    try {
      setIsRecording(false);
      const result = await audioService.stopRecording();
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Stop recording failed';
      setError(message);
      throw err;
    }
  }, []);

  const cancelRecording = useCallback(async () => {
    try {
      setIsRecording(false);
      setDuration(0);
      setCurrentWaveform([]);
      await audioService.cancelRecording();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Cancel failed';
      setError(message);
    }
  }, []);

  return {
    isRecording,
    duration,
    currentWaveform,
    error,
    startRecording,
    stopRecording,
    cancelRecording,
  };
}
