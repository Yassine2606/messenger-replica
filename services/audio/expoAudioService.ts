import { RecordingPresets, setAudioModeAsync, requestRecordingPermissionsAsync, getRecordingPermissionsAsync, type AudioRecorder, type RecorderState } from 'expo-audio';

/**
 * Real audio waveform sample - normalized to 0-1 range
 */
export interface WaveformSample {
  amplitude: number; // 0-1, represents real audio level
  timestamp: number; // ms from recording start
}

/**
 * Audio recording result with waveform data
 */
export interface RecordingResult {
  uri: string;
  duration: number; // milliseconds
  waveform: number[]; // normalized 0-1 array for waveform display
  mimeType: string;
}

/**
 * ExpoAudioService: Manages audio recording with real waveform capture
 * - Uses expo-audio recorder with permission handling
 * - Captures real amplitude data during recording via metering
 * - Provides waveform as normalized numeric array
 * - Note: This service is meant to be used with the useAudioRecorder hook in React components
 */
export class ExpoAudioService {
  private recorder: AudioRecorder | null = null;
  private waveformSamples: WaveformSample[] = [];
  private recordingStartTime: number = 0;
  private meeteringInterval: ReturnType<typeof setInterval> | null = null;
  private isRecording = false;

  /**
   * Initialize audio session with proper settings for recording
   */
  async initialize(): Promise<void> {
    try {
      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });
    } catch (error) {
      console.error('setAudioModeAsync error:', error);
      throw error;
    }
  }

  /**
   * Request microphone permission
   */
  async requestPermissions(): Promise<boolean> {
    try {
      const permission = await getRecordingPermissionsAsync();
      if (permission.status !== 'granted') {
        const newPermission = await requestRecordingPermissionsAsync();
        return newPermission.status === 'granted';
      }
      return true;
    } catch (error) {
      console.error('Permission request error:', error);
      return false;
    }
  }

  /**
   * Set the recorder instance (called from useAudioRecorder hook)
   */
  setRecorder(recorder: AudioRecorder): void {
    this.recorder = recorder;
  }

  /**
   * Start recording with real waveform capture
   * Should be called after setRecorder() and with a prepared recorder
   */
  async startRecording(): Promise<void> {
    try {
      if (!this.recorder) {
        throw new Error('Recorder not initialized. Call setRecorder first.');
      }

      // Ensure permissions
      const hasPermission = await this.requestPermissions();
      if (!hasPermission) {
        throw new Error('Microphone permission denied');
      }

      this.recorder.record();

      this.isRecording = true;
      this.recordingStartTime = Date.now();
      this.waveformSamples = [];

      // Start capturing metering data every 50ms for smooth waveform
      this.startWaveformCapture();
    } catch (error) {
      console.error('Recording start error:', error);
      this.isRecording = false;
      throw error;
    }
  }

  /**
   * Capture real audio amplitude data from recording
   * Uses the metering value from recorder status normalized to 0-1
   */
  private startWaveformCapture(): void {
    if (this.meeteringInterval) {
      clearInterval(this.meeteringInterval);
    }

    // Sample metering every 50ms for ~20 samples per second
    this.meeteringInterval = setInterval(() => {
      if (!this.recorder || !this.isRecording) {
        return;
      }

      try {
        // Get real amplitude/metering data from recording
        const status = this.recorder!.getStatus() as RecorderState & { metering?: number };

        if (status && status.metering !== undefined && status.metering !== null) {
          // metering ranges from -160 to 0 dB, normalize to 0-1
          // Use dB -> linear conversion: 10^(dB/20)
          // Clamp between -160 and 0 for stability
          const dB = Math.max(-160, status.metering as number);
          const normalized = Math.pow(10, dB / 20); // dB to linear
          const amplitude = Math.max(0, Math.min(1, normalized));

          const timestamp = Date.now() - this.recordingStartTime;
          this.waveformSamples.push({
            amplitude,
            timestamp,
          });
        }
      } catch (error) {
        // Metering error - continue recording
        console.warn('Metering error:', error);
      }
    }, 50);
  }

  /**
   * Stop recording and return result with waveform
   */
  async stopRecording(): Promise<RecordingResult> {
    if (!this.recorder || !this.isRecording) {
      throw new Error('No recording in progress');
    }

    try {
      this.isRecording = false;
      this.stopWaveformCapture();

      await this.recorder.stop();

      const uri = this.recorder.uri;
      const status = this.recorder.getStatus() as RecorderState;

      if (!uri) {
        throw new Error('Failed to get recording URI');
      }

      // Build waveform array - compress to max 100 points for efficient storage
      const waveform = this.compressWaveform(this.waveformSamples, 100);

      const duration = status.durationMillis || 0;

      const result: RecordingResult = {
        uri,
        duration,
        waveform,
        mimeType: 'm4a', // iOS uses m4a by default
      };

      this.recorder = null;
      this.waveformSamples = [];

      return result;
    } catch (error) {
      console.error('Recording stop error:', error);
      throw error;
    }
  }

  /**
   * Cancel recording and cleanup
   */
  async cancelRecording(): Promise<void> {
    if (!this.recorder) {
      return;
    }

    try {
      this.isRecording = false;
      this.stopWaveformCapture();
      await this.recorder.stop();
      this.recorder = null;
      this.waveformSamples = [];
    } catch (error) {
      console.error('Recording cancel error:', error);
    }
  }

  /**
   * Stop waveform capture interval
   */
  private stopWaveformCapture(): void {
    if (this.meeteringInterval) {
      clearInterval(this.meeteringInterval);
      this.meeteringInterval = null;
    }
  }

  /**
   * Compress waveform samples to max points
   * Uses max-pooling for efficient compression while preserving peaks
   */
  private compressWaveform(samples: WaveformSample[], maxPoints: number): number[] {
    if (samples.length === 0) return [];
    if (samples.length <= maxPoints) {
      return samples.map((s) => s.amplitude);
    }

    // Max-pooling compression
    const compressed: number[] = [];
    const bucketSize = Math.ceil(samples.length / maxPoints);

    for (let i = 0; i < maxPoints; i++) {
      const start = i * bucketSize;
      const end = Math.min(start + bucketSize, samples.length);
      const bucket = samples.slice(start, end);

      // Take max amplitude in bucket for peak representation
      const maxAmplitude = Math.max(...bucket.map((s) => s.amplitude));
      compressed.push(maxAmplitude);
    }

    return compressed;
  }

  /**
   * Check if currently recording
   */
  isCurrentlyRecording(): boolean {
    return this.isRecording;
  }

  /**
   * Get current recording duration (ms)
   */
  getCurrentDuration(): number {
    if (!this.isRecording || !this.recorder) return 0;
    const status = this.recorder.getStatus() as RecorderState;
    return status.durationMillis || 0;
  }

  /**
   * Get current waveform samples for live display
   */
  getCurrentWaveform(): number[] {
    return this.waveformSamples.map((s) => s.amplitude);
  }

  /**
   * Cleanup on unmount
   */
  async cleanup(): Promise<void> {
    try {
      this.stopWaveformCapture();
      if (this.recorder && this.isRecording) {
        await this.cancelRecording();
      }
    } catch (error) {
      console.error('Cleanup error:', error);
    }
  }
}

// Singleton instance
export const audioService = new ExpoAudioService();
