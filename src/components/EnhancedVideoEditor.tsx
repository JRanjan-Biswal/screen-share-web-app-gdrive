'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';
import { Video, VideoEditOptions } from '@/types/video';
import Timeline from './Timeline';

interface EnhancedVideoEditorProps {
  video: Video;
  onComplete: () => void;
  onCancel: () => void;
}

interface ProcessingState {
  isProcessing: boolean;
  progress: number;
  stage: string;
}

export default function EnhancedVideoEditor({ video, onCancel }: EnhancedVideoEditorProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const ffmpegRef = useRef<FFmpeg | null>(null);
  
  const [loading, setLoading] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string>('');
  const [videoBlob, setVideoBlob] = useState<Blob | null>(null);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [processing, setProcessing] = useState<ProcessingState>({
    isProcessing: false,
    progress: 0,
    stage: ''
  });
  const [outputUrl, setOutputUrl] = useState<string>('');
  
  const [editOptions, setEditOptions] = useState<VideoEditOptions>({
    startTime: 0,
    endTime: 100,
    volume: 100,
    fadeIn: 0,
    fadeOut: 0,
    speed: 1,
    quality: 'medium'
  });

  // Initialize FFmpeg
  useEffect(() => {
    const initFFmpeg = async () => {
      if (!ffmpegRef.current) {
        console.log('Initializing FFmpeg...');
        const ffmpeg = new FFmpeg();
        const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd';
        console.log('Loading FFmpeg core...');
        await ffmpeg.load({
          coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
          wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
        });
        ffmpegRef.current = ffmpeg;
        console.log('FFmpeg loaded successfully!');
      }
    };
    
    initFFmpeg().catch((error) => {
      console.error('Failed to initialize FFmpeg:', error);
    });
  }, []);

  const loadVideo = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/videos/${video.id}/download`);
      const blob = await response.blob();
      setVideoBlob(blob);
      const url = URL.createObjectURL(blob);
      setVideoUrl(url);
    } catch (error) {
      console.error('Failed to load video:', error);
    } finally {
      setLoading(false);
    }
  }, [video.id]);

  // Load video and set duration
  useEffect(() => {
    loadVideo();
    if (video.durationInMs) {
      setDuration(video.durationInMs / 1000);
    }
  }, [video.id, video.durationInMs, loadVideo]);

  // Cleanup URLs on unmount
  useEffect(() => {
    return () => {
      if (videoUrl) {
        URL.revokeObjectURL(videoUrl);
      }
      if (outputUrl) {
        URL.revokeObjectURL(outputUrl);
      }
    };
  }, [videoUrl, outputUrl]);

  const handleVideoLoaded = () => {
    if (videoRef.current) {
      const videoDuration = video.durationInMs ? video.durationInMs / 1000 : videoRef.current.duration;
      if (videoDuration && videoDuration !== duration) {
        setDuration(videoDuration);
        setEditOptions(prev => ({
          ...prev,
          endTime: 100
        }));
      }
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  const handlePlayPause = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleSeek = (time: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = time;
    }
  };

  const handleStartTimeChange = (time: number) => {
    const percentage = (time / duration) * 100;
    setEditOptions(prev => ({
      ...prev,
      startTime: Math.max(0, Math.min(percentage, prev.endTime - 1))
    }));
  };

  const handleEndTimeChange = (time: number) => {
    const percentage = (time / duration) * 100;
    setEditOptions(prev => ({
      ...prev,
      endTime: Math.max(prev.startTime + 1, Math.min(percentage, 100))
    }));
  };

  const handlePreview = () => {
    if (videoRef.current) {
      const startTime = (editOptions.startTime / 100) * duration;
      const endTime = (editOptions.endTime / 100) * duration;

      videoRef.current.currentTime = startTime;
      videoRef.current.play();

      const stopAtEnd = () => {
        if (videoRef.current && videoRef.current.currentTime >= endTime) {
          videoRef.current.pause();
          videoRef.current.removeEventListener('timeupdate', stopAtEnd);
        }
      };

      videoRef.current.addEventListener('timeupdate', stopAtEnd);
    }
  };

  const trimVideo = async () => {
    console.log('Starting video trim...');
    console.log('FFmpeg loaded:', !!ffmpegRef.current);
    console.log('Video blob available:', !!videoBlob);
    console.log('Edit options:', editOptions);
    console.log('Duration:', duration);
    
    if (!ffmpegRef.current || !videoBlob) {
      console.error('FFmpeg not loaded or video blob not available');
      return;
    }

    try {
      setProcessing({
        isProcessing: true,
        progress: 0,
        stage: 'Initializing...'
      });

      const ffmpeg = ffmpegRef.current;
      const startTime = (editOptions.startTime / 100) * duration;
      const endTime = (editOptions.endTime / 100) * duration;
      const trimDuration = endTime - startTime;
      
      console.log('Trim parameters:', {
        startTime,
        endTime,
        trimDuration,
        duration,
        videoName: video.name
      });

      // Write input file to FFmpeg file system
      setProcessing(prev => ({ ...prev, stage: 'Loading video...', progress: 10 }));
      const inputFileName = video.name.endsWith('.webm') ? 'input.webm' : 'input.mp4';
      await ffmpeg.writeFile(inputFileName, await fetchFile(videoBlob));

      // Build FFmpeg command
      const args = [
        '-i', inputFileName,
        '-ss', startTime.toString(),
        '-t', trimDuration.toString(),
        '-c:v', 'libx264',
        '-c:a', 'aac',
        '-avoid_negative_ts', 'make_zero'
      ];

      // Add audio effects if needed
      if (editOptions.volume !== 100) {
        args.push('-af', `volume=${editOptions.volume / 100}`);
      }

      if (editOptions.speed !== 1) {
        args.push('-filter:v', `setpts=${1 / editOptions.speed}*PTS`);
      }

      // Add fade effects
      if (editOptions.fadeIn > 0 || editOptions.fadeOut > 0) {
        const fadeFilter = [];
        if (editOptions.fadeIn > 0) {
          fadeFilter.push(`fade=t=in:st=0:d=${editOptions.fadeIn}`);
        }
        if (editOptions.fadeOut > 0) {
          fadeFilter.push(`fade=t=out:st=${trimDuration - editOptions.fadeOut}:d=${editOptions.fadeOut}`);
        }
        if (fadeFilter.length > 0) {
          args.push('-vf', fadeFilter.join(','));
        }
      }

      args.push('output.mp4');

      console.log('FFmpeg command:', args);

      // Set up progress tracking
      ffmpeg.on('progress', ({ progress }) => {
        setProcessing(prev => ({
          ...prev,
          progress: Math.round(progress * 100),
          stage: 'Processing video...'
        }));
      });

      setProcessing(prev => ({ ...prev, stage: 'Processing video...', progress: 20 }));

      // Run FFmpeg command
      console.log('Executing FFmpeg command...');
      await ffmpeg.exec(args);
      console.log('FFmpeg command completed');

      // Read output file
      setProcessing(prev => ({ ...prev, stage: 'Finalizing...', progress: 90 }));
      const data = await ffmpeg.readFile('output.mp4');
      const uint8Array = new Uint8Array(data as unknown as ArrayBuffer);
      const blob = new Blob([uint8Array], { type: 'video/mp4' });
      const url = URL.createObjectURL(blob);
      console.log('Output video created, URL:', url);
      setOutputUrl(url);

      // Clean up FFmpeg files
      await ffmpeg.deleteFile(inputFileName);
      await ffmpeg.deleteFile('output.mp4');

      setProcessing(prev => ({ ...prev, stage: 'Complete!', progress: 100 }));

    } catch (error) {
      console.error('Video processing failed:', error);
      console.error('Error details:', error);
      setProcessing({
        isProcessing: false,
        progress: 0,
        stage: 'Error occurred'
      });
    }
  };

  const downloadTrimmedVideo = () => {
    if (outputUrl) {
      const a = document.createElement('a');
      a.href = outputUrl;
      a.download = `trimmed_${video.name}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };


  if (loading || !videoUrl) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading video...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="bg-white rounded-lg shadow-lg overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold text-gray-900">
              Edit: {video.name}
            </h2>
            <div className="flex gap-2">
              <button
                onClick={onCancel}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 transition duration-200"
              >
                Cancel
              </button>
              {outputUrl && (
                <button
                  onClick={downloadTrimmedVideo}
                  className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition duration-200"
                >
                  Download
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 p-6">
          {/* Video Player */}
          <div className="lg:col-span-2 space-y-6">
            {/* Video Display */}
            <div className="aspect-video bg-black rounded-lg overflow-hidden">
              <video
                ref={videoRef}
                src={videoUrl}
                controls
                className="w-full h-full"
                onLoadedMetadata={handleVideoLoaded}
                onTimeUpdate={handleTimeUpdate}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
              />
            </div>

            {/* Timeline */}
            <div className="space-y-4">
              <h3 className="font-medium text-gray-900">Timeline</h3>
              <Timeline
                duration={duration}
                startTime={(editOptions.startTime / 100) * duration}
                endTime={(editOptions.endTime / 100) * duration}
                currentTime={currentTime}
                onStartTimeChange={handleStartTimeChange}
                onEndTimeChange={handleEndTimeChange}
                onSeek={handleSeek}
                disabled={processing.isProcessing}
              />
            </div>

            {/* Preview Controls */}
            <div className="flex gap-4">
              <button
                onClick={handlePlayPause}
                disabled={processing.isProcessing}
                className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white px-6 py-2 rounded-lg transition duration-200"
              >
                {isPlaying ? 'Pause' : 'Play'}
              </button>
              <button
                onClick={handlePreview}
                disabled={processing.isProcessing}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-6 py-2 rounded-lg transition duration-200"
              >
                Preview Selection
              </button>
              <button
                onClick={trimVideo}
                disabled={processing.isProcessing || !ffmpegRef.current}
                className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 text-white px-6 py-2 rounded-lg transition duration-200"
              >
                {processing.isProcessing ? 'Processing...' : 'Trim Video'}
              </button>
            </div>

            {/* Processing Progress */}
            {processing.isProcessing && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm text-gray-600">
                  <span>{processing.stage}</span>
                  <span>{processing.progress}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${processing.progress}%` }}
                  />
                </div>
              </div>
            )}

            {/* Output Video */}
            {outputUrl && (
              <div className="space-y-4">
                <h3 className="font-medium text-gray-900">Trimmed Video</h3>
                <div className="aspect-video bg-black rounded-lg overflow-hidden">
                  <video
                    src={outputUrl}
                    controls
                    className="w-full h-full"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Controls Panel */}
          <div className="space-y-6">
            {/* Audio Controls */}
            <div>
              <h3 className="font-medium text-gray-900 mb-4">Audio Controls</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-600 mb-2">
                    Volume: {editOptions.volume}%
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="200"
                    value={editOptions.volume}
                    onChange={(e) => setEditOptions(prev => ({
                      ...prev,
                      volume: parseInt(e.target.value)
                    }))}
                    className="w-full"
                    disabled={processing.isProcessing}
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-600 mb-2">
                    Fade In: {editOptions.fadeIn}s
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="10"
                    step="0.5"
                    value={editOptions.fadeIn}
                    onChange={(e) => setEditOptions(prev => ({
                      ...prev,
                      fadeIn: parseFloat(e.target.value)
                    }))}
                    className="w-full"
                    disabled={processing.isProcessing}
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-600 mb-2">
                    Fade Out: {editOptions.fadeOut}s
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="10"
                    step="0.5"
                    value={editOptions.fadeOut}
                    onChange={(e) => setEditOptions(prev => ({
                      ...prev,
                      fadeOut: parseFloat(e.target.value)
                    }))}
                    className="w-full"
                    disabled={processing.isProcessing}
                  />
                </div>
              </div>
            </div>

            {/* Video Controls */}
            <div>
              <h3 className="font-medium text-gray-900 mb-4">Video Controls</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-600 mb-2">
                    Speed: {editOptions.speed}x
                  </label>
                  <input
                    type="range"
                    min="0.5"
                    max="2"
                    step="0.1"
                    value={editOptions.speed}
                    onChange={(e) => setEditOptions(prev => ({
                      ...prev,
                      speed: parseFloat(e.target.value)
                    }))}
                    className="w-full"
                    disabled={processing.isProcessing}
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-600 mb-2">
                    Quality
                  </label>
                  <select
                    value={editOptions.quality}
                    onChange={(e) => setEditOptions(prev => ({
                      ...prev,
                      quality: e.target.value as 'low' | 'medium' | 'high'
                    }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    disabled={processing.isProcessing}
                  >
                    <option value="low">Low (480p)</option>
                    <option value="medium">Medium (720p)</option>
                    <option value="high">High (1080p)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Reset Button */}
            <div>
              <button
                onClick={() => setEditOptions({
                  startTime: 0,
                  endTime: 100,
                  volume: 100,
                  fadeIn: 0,
                  fadeOut: 0,
                  speed: 1,
                  quality: 'medium'
                })}
                disabled={processing.isProcessing}
                className="w-full bg-gray-600 hover:bg-gray-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg transition duration-200"
              >
                Reset All
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
