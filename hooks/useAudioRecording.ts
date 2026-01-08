import { useState, useCallback, useEffect, useRef } from 'react';
import { useAudioRecorder, RecordingPresets } from 'expo-audio';
import { audioService } from '@/services';

/**
 * useAudioRecording: Hook for managing audio recording with real waveform capture
 * Integrates expo-audio's useAudioRecorder with the audio service
 * Optimized with throttling to prevent excessive re-renders during recording
 */
export function useAudioRecording() {
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentWaveform, setCurrentWaveform] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);
  
  const durationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const lastUpdateRef = useRef<number>(0);

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

  // Update duration and waveform while recording (throttled with RAF)
  useEffect(() => {
    if (!isRecording) {
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
        durationIntervalRef.current = null;
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      return;
    }

    // Update duration every 100ms
    durationIntervalRef.current = setInterval(() => {
      setDuration(audioService.getCurrentDuration());
    }, 100);

    // Update waveform with requestAnimationFrame (throttled to ~60fps)
    const updateWaveform = () => {
      const now = Date.now();
      // Throttle to max 15 updates per second to avoid excessive renders
      if (now - lastUpdateRef.current > 66) {
        const waveform = audioService.getCurrentWaveform();
        setCurrentWaveform(waveform);
        lastUpdateRef.current = now;
      }
      
      if (isRecording) {
        animationFrameRef.current = requestAnimationFrame(updateWaveform);
      }
    };

    animationFrameRef.current = requestAnimationFrame(updateWaveform);

    return () => {
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
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
