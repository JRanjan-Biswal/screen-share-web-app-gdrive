'use client';

import { useState, useRef, useEffect } from 'react';
import { Video, VideoEditOptions } from '@/types/video';

interface VideoEditorProps {
  video: Video;
  onComplete: () => void;
  onCancel: () => void;
}

export default function VideoEditor({ video, onComplete, onCancel }: VideoEditorProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loading, setLoading] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string>('');
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

  useEffect(() => {
    loadVideo();
    // Set duration from video prop if available
    if (video.durationInMs) {
      setDuration(video.durationInMs / 1000); // Convert milliseconds to seconds
    }
    return () => {
      if (videoUrl) {
        URL.revokeObjectURL(videoUrl);
      }
    };
  }, [video.id, video.durationInMs]);

  const loadVideo = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/videos/${video.id}/download`);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      setVideoUrl(url);
    } catch (error) {
      console.error('Failed to load video:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleVideoLoaded = async() => {
    if (videoRef.current) {
      // Use duration from video prop if available, otherwise get from video element
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

  const handleApplyChanges = async () => {
    try {
      setLoading(true);

      const response = await fetch(`/api/videos/${video.id}/edit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(editOptions),
      });

      if (response.ok) {
        onComplete();
      } else {
        console.error('Failed to apply changes');
      }
    } catch (error) {
      console.error('Failed to apply changes:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (loading || !videoUrl) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
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
              <button
                onClick={handleApplyChanges}
                disabled={loading}
                className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white px-4 py-2 rounded-lg transition duration-200"
              >
                {loading ? 'Applying...' : 'Apply Changes'}
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 p-6">
          {/* Video Player */}
          <div className="lg:col-span-2">
            {
              videoUrl ? (
                <div className="aspect-video bg-black rounded-lg overflow-hidden mb-4">
                  <video
                    ref={videoRef}
                    src={videoUrl}
                    muted
                    controls
                    className="w-full h-full"
                    onLoadedMetadata={handleVideoLoaded}
                    onPlay={() => setIsPlaying(true)}
                    onPause={() => setIsPlaying(false)}
                  />
                </div>
              ) : (
                <div className="w-full h-full flex items-center justify-center text-white">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-4"></div>
                    <p>Loading video...</p>
                  </div>
                </div>
              )
            }

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
                    <option value="low">Low (480p)</option>
                    <option value="medium">Medium (720p)</option>
                    <option value="high">High (1080p)</option>
                  </select>
                </div>
              </div>
            </div>

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
