import ffmpeg from 'fluent-ffmpeg';
import ffmpegStatic from 'ffmpeg-static';
import ffprobeStatic from 'ffprobe-static';
import fs from 'fs/promises';

// Set FFmpeg and FFprobe paths with fallback
try {
  if (ffmpegStatic) {
    // Normalize the path for Windows
    const normalizedFfmpegPath = ffmpegStatic.replace(/\\/g, '/');
    ffmpeg.setFfmpegPath(normalizedFfmpegPath);
    console.log('FFmpeg path set to:', normalizedFfmpegPath);
  } else {
    console.warn('ffmpeg-static not found, using system FFmpeg');
  }

  if (ffprobeStatic && ffprobeStatic.path) {
    // Normalize the path for Windows
    const normalizedFfprobePath = ffprobeStatic.path.replace(/\\/g, '/');
    ffmpeg.setFfprobePath(normalizedFfprobePath);
    console.log('FFprobe path set to:', normalizedFfprobePath);
  } else {
    console.warn('ffprobe-static not found, using system FFprobe');
  }
} catch (error) {
  console.warn('Failed to set FFmpeg/FFprobe paths:', error);
}

export interface VideoEditOptions {
  startTime: number; // in seconds
  endTime: number; // in seconds
  volume: number; // 0-200 (percentage)
  fadeIn: number; // in seconds
  fadeOut: number; // in seconds
  speed: number; // 0.5-2.0
  quality: 'low' | 'medium' | 'high';
  filters?: string[]; // Custom FFmpeg filters
}

export interface VideoInfo {
  duration: number;
  width: number;
  height: number;
  fps: number;
  bitrate: number;
  codec: string;
}

export class FFmpegVideoEditor {
  private tempDir: string;

  constructor(tempDir: string = './temp') {
    this.tempDir = tempDir;
  }

  /**
   * Get video information using FFprobe with fallback
   */
  async getVideoInfo(inputPath: string): Promise<VideoInfo> {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(inputPath, (err, metadata) => {
        if (err) {
          console.warn('FFprobe failed, using fallback:', err.message);
          // Fallback: return basic info
          resolve({
            duration: 0, // Will be set by HTML5 video
            width: 1920,
            height: 1080,
            fps: 30,
            bitrate: 1000000,
            codec: 'unknown'
          });
          return;
        }

        const videoStream = metadata.streams.find(stream => stream.codec_type === 'video');
        if (!videoStream) {
          reject(new Error('No video stream found'));
          return;
        }

        resolve({
          duration: metadata.format.duration || 0,
          width: videoStream.width || 0,
          height: videoStream.height || 0,
          fps: eval(videoStream.r_frame_rate || '0'),
          bitrate: parseInt(String(metadata.format.bit_rate || '0')),
          codec: videoStream.codec_name || 'unknown'
        });
      });
    });
  }

  /**
   * Trim video to specified time range
   */
  async trimVideo(
    inputPath: string,
    outputPath: string,
    startTime: number,
    endTime: number
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .seekInput(startTime)
        .duration(endTime - startTime)
        .output(outputPath)
        .on('end', () => resolve())
        .on('error', (err) => reject(err))
        .run();
    });
  }

  /**
   * Apply volume adjustment
   */
  async adjustVolume(
    inputPath: string,
    outputPath: string,
    volume: number
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const volumeMultiplier = volume / 100;
      
      ffmpeg(inputPath)
        .audioFilters(`volume=${volumeMultiplier}`)
        .output(outputPath)
        .on('end', () => resolve())
        .on('error', (err) => reject(err))
        .run();
    });
  }

  /**
   * Apply fade in/out effects
   */
  async applyFadeEffects(
    inputPath: string,
    outputPath: string,
    fadeIn: number,
    fadeOut: number,
    duration: number
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const filters = [];
      
      if (fadeIn > 0) {
        filters.push(`fade=t=in:st=0:d=${fadeIn}`);
      }
      
      if (fadeOut > 0) {
        const fadeOutStart = duration - fadeOut;
        filters.push(`fade=t=out:st=${fadeOutStart}:d=${fadeOut}`);
      }

      let command = ffmpeg(inputPath);
      
      if (filters.length > 0) {
        command = command.videoFilters(filters);
      }
      
      command
        .output(outputPath)
        .on('end', () => resolve())
        .on('error', (err) => reject(err))
        .run();
    });
  }

  /**
   * Change video speed
   */
  async changeSpeed(
    inputPath: string,
    outputPath: string,
    speed: number
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .videoFilters(`setpts=${1/speed}*PTS`)
        .audioFilters(`atempo=${speed}`)
        .output(outputPath)
        .on('end', () => resolve())
        .on('error', (err) => reject(err))
        .run();
    });
  }

  /**
   * Apply quality settings
   */
  async applyQuality(
    inputPath: string,
    outputPath: string,
    quality: 'low' | 'medium' | 'high'
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const qualitySettings = {
        low: { crf: 28, preset: 'fast' },
        medium: { crf: 23, preset: 'medium' },
        high: { crf: 18, preset: 'slow' }
      };

      const settings = qualitySettings[quality];

      ffmpeg(inputPath)
        .videoCodec('libx264')
        .addOptions([
          `-crf ${settings.crf}`,
          `-preset ${settings.preset}`,
          '-movflags +faststart'
        ])
        .output(outputPath)
        .on('end', () => resolve())
        .on('error', (err) => reject(err))
        .run();
    });
  }

  /**
   * Apply all edits in one operation
   */
  async processVideo(
    inputPath: string,
    outputPath: string,
    options: VideoEditOptions
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      let command = ffmpeg(inputPath);

      // Apply trimming
      if (options.startTime > 0 || options.endTime > 0) {
        command = command.seekInput(options.startTime);
        if (options.endTime > options.startTime) {
          command = command.duration(options.endTime - options.startTime);
        }
      }

      // Apply volume adjustment
      if (options.volume !== 100) {
        const volumeMultiplier = options.volume / 100;
        command = command.audioFilters(`volume=${volumeMultiplier}`);
      }

      // Apply fade effects
      const filters = [];
      if (options.fadeIn > 0) {
        filters.push(`fade=t=in:st=0:d=${options.fadeIn}`);
      }
      if (options.fadeOut > 0) {
        // We need to get duration first, but for now use a large number
        filters.push(`fade=t=out:st=0:d=${options.fadeOut}`);
      }

      if (filters.length > 0) {
        command = command.videoFilters(filters);
      }

      // Apply speed change
      if (options.speed !== 1) {
        command = command
          .videoFilters(`setpts=${1/options.speed}*PTS`)
          .audioFilters(`atempo=${options.speed}`);
      }

      // Apply quality settings
      const qualitySettings = {
        low: { crf: 28, preset: 'fast' },
        medium: { crf: 23, preset: 'medium' },
        high: { crf: 18, preset: 'slow' }
      };

      const settings = qualitySettings[options.quality];

      command
        .videoCodec('libx264')
        .addOptions([
          `-crf ${settings.crf}`,
          `-preset ${settings.preset}`,
          '-movflags +faststart'
        ])
        .output(outputPath)
        .on('end', () => resolve())
        .on('error', (err) => reject(err))
        .run();
    });
  }

  /**
   * Generate video thumbnail
   */
  async generateThumbnail(
    inputPath: string,
    outputPath: string,
    timeOffset: number = 1
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .seekInput(timeOffset)
        .frames(1)
        .output(outputPath)
        .on('end', () => resolve())
        .on('error', (err) => reject(err))
        .run();
    });
  }

  /**
   * Convert video format
   */
  async convertFormat(
    inputPath: string,
    outputPath: string,
    format: 'mp4' | 'webm' | 'avi' | 'mov'
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .format(format)
        .output(outputPath)
        .on('end', () => resolve())
        .on('error', (err) => reject(err))
        .run();
    });
  }

  /**
   * Clean up temporary files
   */
  async cleanup(files: string[]): Promise<void> {
    for (const file of files) {
      try {
        await fs.unlink(file);
      } catch (error) {
        console.warn(`Failed to delete file ${file}:`, error);
      }
    }
  }
}

export default FFmpegVideoEditor;
