'use client';

import { useState, useRef, useEffect } from 'react';
import { Video, VideoEditOptions } from '@/types/video';

interface FFmpegVideoEditorProps {
  video: Video;
  onComplete: () => void;
  onCancel: () => void;
}

interface VideoInfo {
  duration: number;
  width: number;
  height: number;
  fps: number;
  bitrate: number;
  codec: string;
}

export default function FFmpegVideoEditor({ video, onComplete, onCancel }: FFmpegVideoEditorProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [loading, setLoading] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string>('');
  const [videoInfo, setVideoInfo] = useState<VideoInfo | null>(null);
  const [editOptions, setEditOptions] = useState<VideoEditOptions>({
    startTime: 0,
    endTime: 100,
    volume: 100,
    fadeIn: 0,
    fadeOut: 0,
    speed: 1,
    quality: 'medium'
  });
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    loadVideo();
    return () => {
      if (videoUrl) {
        URL.revokeObjectURL(videoUrl);
      }
    };
  }, [video.id]);

  const loadVideo = async () => {
    try {
      setLoading(true);
      console.log('Loading video:', video.id);
      
      // Download video for preview
      const response = await fetch(`/api/videos/${video.id}/download`);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      setVideoUrl(url);

      // Get video info using FFmpeg
      const infoResponse = await fetch(`/api/videos/${video.id}/process`);
      const infoData = await infoResponse.json();
      
      if (infoData.success) {
        setVideoInfo(infoData.videoInfo);
        setDuration(infoData.videoInfo.duration);
        setEditOptions(prev => ({
          ...prev,
          endTime: 100
        }));
      }
    } catch (error) {
      console.error('Failed to load video:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleVideoLoaded = () => {
    if (videoRef.current && !videoInfo) {
      const videoElement = videoRef.current;
      const duration = videoElement.duration;
      
      if (isFinite(duration) && duration > 0) {
        setDuration(duration);
        setEditOptions(prev => ({
          ...prev,
          endTime: 100
        }));
      }
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


  const handleOptionChange = (option: keyof VideoEditOptions, value: number | string) => {
    setEditOptions(prev => ({
      ...prev,
      [option]: value
    }));

    // Apply changes in real-time for preview
    if (videoRef.current) {
      switch (option) {
        case 'volume':
          videoRef.current.volume = (value as number) / 100;
          break;
        case 'speed':
          videoRef.current.playbackRate = value as number;
          break;
        case 'startTime':
        case 'endTime':
          const startTime = (editOptions.startTime / 100) * duration;
          const endTime = (editOptions.endTime / 100) * duration;
          if (videoRef.current.currentTime < startTime || videoRef.current.currentTime > endTime) {
            videoRef.current.currentTime = startTime;
          }
          break;
      }
    }
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

  const handleProcessVideo = async () => {
    try {
      setProcessing(true);
      setProgress(0);
      
      // Convert percentage-based times to seconds
      const startTime = (editOptions.startTime / 100) * duration;
      const endTime = (editOptions.endTime / 100) * duration;
      
      const processOptions = {
        ...editOptions,
        startTime,
        endTime
      };

      console.log('Processing video with options:', processOptions);
      
      const response = await fetch(`/api/videos/${video.id}/process`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(processOptions),
      });
      
      const data = await response.json();
      
      if (data.success) {
        console.log('Video processed successfully:', data);
        onComplete();
      } else {
        console.error('Failed to process video:', data.error);
        alert(`Failed to process video: ${data.error}`);
      }
    } catch (error) {
      console.error('Failed to process video:', error);
      alert('Failed to process video. Please try again.');
    } finally {
      setProcessing(false);
      setProgress(0);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto mb-4"></div>
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
              FFmpeg Video Editor: {video.name}
            </h2>
            <div className="flex gap-2">
              <button
                onClick={onCancel}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 transition duration-200"
              >
                Cancel
              </button>
              <button
                onClick={handleProcessVideo}
                disabled={processing}
                className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white px-4 py-2 rounded-lg transition duration-200"
              >
                {processing ? `Processing... ${progress}%` : 'Process Video'}
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 p-6">
          {/* Video Player */}
          <div className="lg:col-span-2">
            <div className="aspect-video bg-black rounded-lg overflow-hidden mb-4">
              {videoUrl ? (
                <video
                  ref={videoRef}
                  src={videoUrl}
                  controls
                  className="w-full h-full"
                  onLoadedMetadata={handleVideoLoaded}
                  onPlay={() => setIsPlaying(true)}
                  onPause={() => setIsPlaying(false)}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-white">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-4"></div>
                    <p>Loading video...</p>
                  </div>
                </div>
              )}
            </div>
            
            {/* Video Info */}
            {videoInfo && (
              <div className="bg-gray-50 p-4 rounded-lg mb-4">
                <h3 className="font-medium text-gray-900 mb-2">Video Information</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">Duration:</span> {formatTime(videoInfo.duration)}
                  </div>
                  <div>
                    <span className="text-gray-600">Resolution:</span> {videoInfo.width}x{videoInfo.height}
                  </div>
                  <div>
                    <span className="text-gray-600">FPS:</span> {videoInfo.fps.toFixed(2)}
                  </div>
                  <div>
                    <span className="text-gray-600">Codec:</span> {videoInfo.codec}
                  </div>
                  <div>
                    <span className="text-gray-600">Bitrate:</span> {formatFileSize(videoInfo.bitrate)}/s
                  </div>
                </div>
              </div>
            )}
            
            {/* Timeline */}
            <div className="space-y-4">
              <h3 className="font-medium text-gray-900">Timeline</h3>
              
              <div className="space-y-2">
                <div className="flex items-center gap-4">
                  <label className="text-sm text-gray-600 w-20">Start:</label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={editOptions.startTime}
                    onChange={(e) => handleOptionChange('startTime', parseInt(e.target.value))}
                    className="flex-1"
                  />
                  <span className="text-sm text-gray-600 w-16">
                    {formatTime((editOptions.startTime / 100) * duration)}
                  </span>
                </div>
                
                <div className="flex items-center gap-4">
                  <label className="text-sm text-gray-600 w-20">End:</label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={editOptions.endTime}
                    onChange={(e) => handleOptionChange('endTime', parseInt(e.target.value))}
                    className="flex-1"
                  />
                  <span className="text-sm text-gray-600 w-16">
                    {formatTime((editOptions.endTime / 100) * duration)}
                  </span>
                </div>
              </div>
              
              <button
                onClick={handlePreview}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition duration-200"
              >
                Preview Selection
              </button>
            </div>
          </div>

          {/* Controls */}
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
                    onChange={(e) => handleOptionChange('volume', parseInt(e.target.value))}
                    className="w-full"
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
                    onChange={(e) => handleOptionChange('fadeIn', parseFloat(e.target.value))}
                    className="w-full"
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
                    onChange={(e) => handleOptionChange('fadeOut', parseFloat(e.target.value))}
                    className="w-full"
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
                    onChange={(e) => handleOptionChange('speed', parseFloat(e.target.value))}
                    className="w-full"
                  />
                </div>
                
                <div>
                  <label className="block text-sm text-gray-600 mb-2">
                    Quality
                  </label>
                  <select
                    value={editOptions.quality}
                    onChange={(e) => handleOptionChange('quality', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  >
                    <option value="low">Low (CRF 28)</option>
                    <option value="medium">Medium (CRF 23)</option>
                    <option value="high">High (CRF 18)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Processing Status */}
            {processing && (
              <div className="bg-blue-50 p-4 rounded-lg">
                <h4 className="font-medium text-blue-900 mb-2">Processing Video</h4>
                <div className="w-full bg-blue-200 rounded-full h-2 mb-2">
                  <div 
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  ></div>
                </div>
                <p className="text-sm text-blue-700">This may take a few minutes...</p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="space-y-2">
              <button
                onClick={handlePlayPause}
                className="w-full bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition duration-200"
              >
                {isPlaying ? 'Pause' : 'Play'}
              </button>
              
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
                className="w-full bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg transition duration-200"
              >
                Reset
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
