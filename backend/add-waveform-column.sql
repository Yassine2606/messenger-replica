-- Add waveform column to messages table
ALTER TABLE messages ADD COLUMN waveform TEXT;
COMMENT ON COLUMN messages.waveform IS 'Compressed audio waveform data as JSON array';
