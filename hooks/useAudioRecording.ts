import { useState, useCallback, useEffect, useRef } from 'react';
import { useAudioRecorder, RecordingPresets } from 'expo-audio';
import { audioService } from '@/lib';
import { useAudioStore } from '@/stores';

/**
 * useAudioRecording: Hook for managing audio recording
 * Integrates expo-audio's useAudioRecorder with the audio service
 */
export function useAudioRecording() {
  const [isRecording, setIsRecordingLocal] = useState(false);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const setIsRecording = useAudioStore((s) => s.setIsRecording);

  const durationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Create recorder using expo-audio hook
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);

  // Initialize audio service and link recorder on mount
  useEffect(() => {
    const init = async () => {
      try {
        await audioService.initialize();
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

  // Update duration while recording
  useEffect(() => {
    if (!isRecording) {
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
        durationIntervalRef.current = null;
      }
      return;
    }

    // Update duration every 100ms
    durationIntervalRef.current = setInterval(() => {
      setDuration(audioService.getCurrentDuration());
    }, 100);

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

      // Prepare recorder if not already prepared
      try {
        const status = recorder.getStatus();
        if (!status.canRecord) {
          await recorder.prepareToRecordAsync();
        }
      } catch (prepareErr) {
        await recorder.prepareToRecordAsync();
      }

      await audioService.startRecording();
      setIsRecordingLocal(true);
      setIsRecording(true); // sync global indicator
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Recording failed';
      console.error('Recording start error:', message);
      setError(message);
      setIsRecordingLocal(false);
      setIsRecording(false);
    }
  }, [recorder, setIsRecording]);

  const stopRecording = useCallback(async () => {
    try {
      setIsRecordingLocal(false);
      setIsRecording(false); // sync global indicator
      const result = await audioService.stopRecording();
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Stop recording failed';
      setError(message);
      throw err;
    }
  }, [setIsRecording]);

  const cancelRecording = useCallback(async () => {
    try {
      setIsRecordingLocal(false);
      setIsRecording(false); // sync global indicator
      setDuration(0);
      await audioService.cancelRecording();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Cancel failed';
      setError(message);
    }
  }, [setIsRecording]);

  return {
    isRecording,
    duration,
    error,
    startRecording,
    stopRecording,
    cancelRecording,
  };
}
