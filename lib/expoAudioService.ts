import {
  setAudioModeAsync,
  requestRecordingPermissionsAsync,
  getRecordingPermissionsAsync,
  type AudioRecorder,
  type RecorderState,
} from 'expo-audio';

/**
 * Audio recording result
 */
export interface RecordingResult {
  uri: string;
  duration: number; // milliseconds
  mimeType: string;
}

/**
 * ExpoAudioService: Manages audio recording
 * - Simple recording and playback control
 * - Duration tracking
 * - Permission management
 */
export class ExpoAudioService {
  private recorder: AudioRecorder | null = null;
  private recordingStartTime: number = 0;
  private isRecording = false;

  /**
   * Initialize audio session
   */
  async initialize(): Promise<void> {
    try {
      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });
    } catch (error) {
      console.error('Audio mode init error:', error);
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
   * Set the recorder instance
   */
  setRecorder(recorder: AudioRecorder): void {
    this.recorder = recorder;
  }

  /**
   * Start recording
   */
  async startRecording(): Promise<void> {
    try {
      if (!this.recorder) {
        throw new Error('Recorder not initialized. Call setRecorder first.');
      }

      const hasPermission = await this.requestPermissions();
      if (!hasPermission) {
        throw new Error('Microphone permission denied');
      }

      try {
        await setAudioModeAsync({
          allowsRecording: true,
          playsInSilentMode: true,
          interruptionMode: 'duckOthers',
        });
      } catch (audioModeError) {
        console.warn('Failed to set audio mode:', audioModeError);
      }

      try {
        const status = this.recorder.getStatus();
        if (!status.canRecord) {
          await this.recorder.prepareToRecordAsync();
        }
      } catch (prepareErr) {
        console.warn('Prepare error, attempting record anyway:', prepareErr);
      }

      this.isRecording = true;
      this.recordingStartTime = Date.now();

      this.recorder.record();
    } catch (error) {
      console.error('Recording start error:', error);
      this.isRecording = false;
      throw error;
    }
  }

  /**
   * Stop recording and return result
   */
  async stopRecording(): Promise<RecordingResult> {
    if (!this.recorder || !this.isRecording) {
      throw new Error('No recording in progress');
    }

    try {
      this.isRecording = false;

      await this.recorder.stop();

      const uri = this.recorder.uri;
      const status = this.recorder.getStatus() as RecorderState;

      if (!uri) {
        throw new Error('Failed to get recording URI');
      }

      let duration =
        (status as any)?.durationMillis ||
        (status as any)?.duration ||
        Date.now() - this.recordingStartTime;

      const result: RecordingResult = {
        uri,
        duration: Math.max(duration, 0),
        mimeType: 'm4a',
      };

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
      await this.recorder.stop();
    } catch (error) {
      console.error('Recording cancel error:', error);
    }
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
    if (!this.isRecording) return 0;
    return Date.now() - this.recordingStartTime;
  }

  /**
   * Cleanup on unmount
   */
  async cleanup(): Promise<void> {
    try {
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
