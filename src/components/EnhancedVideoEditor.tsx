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
  const [processedQuality, setProcessedQuality] = useState<string>('');
  const [showSaveOptions, setShowSaveOptions] = useState(false);
  const [customFileName, setCustomFileName] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<{ type: 'success' | 'error' | null; message: string }>({ type: null, message: '' });
  const [googleDriveFolderId, setGoogleDriveFolderId] = useState<string>('');
  const [showSuccessPopup, setShowSuccessPopup] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [successType, setSuccessType] = useState<'download' | 'google-drive'>('download');
  
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
      const currentVideoTime = videoRef.current.currentTime;
      const startTime = (editOptions.startTime / 100) * duration;
      const endTime = (editOptions.endTime / 100) * duration;
      
      // Constrain current time to stay exactly within trim range
      const constrainedTime = Math.max(startTime, Math.min(currentVideoTime, endTime));
      
      // If video has gone beyond the end time, pause it
      if (currentVideoTime >= endTime) {
        videoRef.current.pause();
        setIsPlaying(false);
      }
      
      setCurrentTime(constrainedTime);
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
      // Constrain the seek time to be within the trim range
      const startTime = (editOptions.startTime / 100) * duration;
      const endTime = (editOptions.endTime / 100) * duration;
      const constrainedTime = Math.max(startTime, Math.min(time, endTime));
      
      videoRef.current.currentTime = constrainedTime;
      setCurrentTime(constrainedTime); // Update the state to move the red line
    }
  };

  const handleStartTimeChange = (time: number) => {
    const percentage = (time / duration) * 100;
    const constrainedPercentage = Math.max(0, Math.min(percentage, editOptions.endTime - 1));
    
    setEditOptions(prev => ({
      ...prev,
      startTime: constrainedPercentage
    }));
    
    // If current time is before the new start time, move it to the start
    if (videoRef.current && videoRef.current.currentTime < time) {
      videoRef.current.currentTime = time;
    }
  };

  const handleEndTimeChange = (time: number) => {
    const percentage = (time / duration) * 100;
    const constrainedPercentage = Math.max(editOptions.startTime + 1, Math.min(percentage, 100));
    
    setEditOptions(prev => ({
      ...prev,
      endTime: constrainedPercentage
    }));
    
    // If current time is after the new end time, move it to the end
    if (videoRef.current && videoRef.current.currentTime > time) {
      videoRef.current.currentTime = time;
    }
  };

  const handlePreview = () => {
    if (videoRef.current) {
      const startTime = (editOptions.startTime / 100) * duration;
      const endTime = (editOptions.endTime / 100) * duration;

      videoRef.current.currentTime = startTime;
      setCurrentTime(startTime); // Update the state to position the red line
      videoRef.current.play();
      setIsPlaying(true); // Update the playing state

      const stopAtEnd = () => {
        if (videoRef.current && videoRef.current.currentTime >= endTime) {
          videoRef.current.pause();
          setIsPlaying(false); // Update the playing state
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
      setProcessing(prev => ({ ...prev, stage: 'Video loaded, starting processing...', progress: 15 }));

      // Build FFmpeg command
      const args = [
        '-i', inputFileName,
        '-ss', startTime.toString(),
        '-t', trimDuration.toString(),
        '-c:v', 'libx264',
        '-c:a', 'aac',
        '-avoid_negative_ts', 'make_zero'
      ];

      // Add quality settings based on selection
      if (editOptions.quality === 'low') {
        args.push('-crf', '28', '-preset', 'fast');
      } else if (editOptions.quality === 'medium') {
        args.push('-crf', '23', '-preset', 'medium');
      } else if (editOptions.quality === 'high') {
        args.push('-crf', '18', '-preset', 'slow');
      }

      args.push('output.mp4');

      console.log('FFmpeg command:', args);

      // Set up progress tracking
      let progressInterval: NodeJS.Timeout;
      let currentProgress = 20;
      
      ffmpeg.on('progress', ({ progress, time }) => {
        console.log('FFmpeg progress:', { progress, time });
        const progressPercent = Math.round(progress * 100);
        currentProgress = Math.max(currentProgress, progressPercent);
        setProcessing(prev => ({
          ...prev,
          progress: Math.round(currentProgress),
          stage: `Processing video... ${Math.round(currentProgress)}%`
        }));
      });

      // Fallback progress mechanism
      progressInterval = setInterval(() => {
        if (currentProgress < 85) {
          currentProgress += Math.random() * 5; // Increment by 0-5%
          const roundedProgress = Math.min(Math.round(currentProgress), 85);
          setProcessing(prev => ({
            ...prev,
            progress: roundedProgress,
            stage: `Processing video... ${roundedProgress}%`
          }));
        }
      }, 1000);

      setProcessing(prev => ({ ...prev, stage: 'Processing video...', progress: 20 }));

      // Run FFmpeg command
      console.log('Executing FFmpeg command...');
      await ffmpeg.exec(args);
      console.log('FFmpeg command completed');
      
      // Clear the fallback progress interval
      if (progressInterval) {
        clearInterval(progressInterval);
      }

      // Read output file
      setProcessing(prev => ({ ...prev, stage: 'Finalizing...', progress: 90 }));
      const data = await ffmpeg.readFile('output.mp4');
      const uint8Array = new Uint8Array(data as unknown as ArrayBuffer);
      const blob = new Blob([uint8Array], { type: 'video/mp4' });
      const url = URL.createObjectURL(blob);
      console.log('Output video created, URL:', url);
      setOutputUrl(url);
      setProcessedQuality(editOptions.quality);

      // Clean up FFmpeg files
      await ffmpeg.deleteFile(inputFileName);
      await ffmpeg.deleteFile('output.mp4');

      setProcessing(prev => ({ ...prev, stage: 'Complete!', progress: 100 }));
      
      // Small delay to show completion
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Reset processing state
      setProcessing({
        isProcessing: false,
        progress: 0,
        stage: ''
      });

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

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const downloadTrimmedVideo = () => {
    if (outputUrl) {
      const fileName = customFileName || `trimmed_${video.name}`;
      const a = document.createElement('a');
      a.href = outputUrl;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      
      // Show success popup
      setSuccessType('download');
      setSuccessMessage(`Video downloaded successfully as "${fileName}.mp4"`);
      setShowSuccessPopup(true);
      setShowSaveOptions(false);
    }
  };

  const loadGoogleDriveFolder = async () => {
    try {
      const response = await fetch('/api/videos/folders');
      const data = await response.json();
      
      if (data.success && data.folderId) {
        setGoogleDriveFolderId(data.folderId);
      }
    } catch (error) {
      console.error('Failed to load Google Drive folder:', error);
    }
  };

  const saveToGoogleDrive = async () => {
    if (!outputUrl || !googleDriveFolderId) return;

    setSaving(true);
    setSaveStatus({ type: null, message: '' });

    try {
      // Fetch the video blob
      const response = await fetch(outputUrl);
      const blob = await response.blob();
      
      // Create form data
      const formData = new FormData();
      formData.append('file', blob, `${customFileName || `trimmed_${video.name}`}.mp4`);
      formData.append('fileName', `${customFileName || `trimmed_${video.name}`}.mp4`);
      formData.append('folderId', googleDriveFolderId);

      // Upload to Google Drive
      const uploadResponse = await fetch('/api/videos/upload', {
        method: 'POST',
        body: formData
      });

      const uploadData = await uploadResponse.json();

      if (uploadData.success) {
        // Show success popup
        setSuccessType('google-drive');
        setSuccessMessage(`Video saved successfully to Google Drive!`);
        setShowSuccessPopup(true);
        setShowSaveOptions(false);
      } else {
        setSaveStatus({ 
          type: 'error', 
          message: uploadData.error || 'Failed to save video to Google Drive' 
        });
      }
    } catch (error) {
      console.error('Save to Google Drive failed:', error);
      setSaveStatus({ 
        type: 'error', 
        message: 'Failed to save video to Google Drive' 
      });
    } finally {
      setSaving(false);
    }
  };

  const handleShowSaveOptions = () => {
    setCustomFileName(`trimmed_${video.name.replace(/\.[^/.]+$/, '')}`);
    setShowSaveOptions(true);
    setSaveStatus({ type: null, message: '' });
    loadGoogleDriveFolder();
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
            <div className="flex items-center gap-4">
              <button
                onClick={() => window.location.href = '/'}
                className="flex items-center gap-2 px-3 py-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition duration-200"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                <span className="font-medium">Back to Videos</span>
              </button>
              <h2 className="text-xl font-semibold text-gray-900">
                Edit: {video.name}
              </h2>
            </div>
            <div className="flex gap-2">
              <button
                onClick={onCancel}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 transition duration-200"
              >
                Cancel
              </button>
              {outputUrl && (
                <div className="flex gap-2">
                  <button
                    onClick={handleShowSaveOptions}
                    className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition duration-200 flex items-center gap-2"
                  >
                    <span>💾</span>
                    Save Video ({editOptions.quality === 'low' ? '480p' : editOptions.quality === 'medium' ? '720p' : '1080p'})
                  </button>
                  <button
                    onClick={trimVideo}
                    disabled={processing.isProcessing || !ffmpegRef.current}
                    className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg transition duration-200 flex items-center gap-2"
                  >
                    <span>🔄</span>
                    Re-process Video
                  </button>
                </div>
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
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-gray-900 text-lg">Timeline</h3>
                <div className="text-sm text-gray-500">
                  Total Duration: <span className="font-mono font-medium">{formatTime(duration)}</span>
                </div>
              </div>
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
            <div className="flex flex-wrap gap-3">
              <button
                onClick={handlePlayPause}
                disabled={processing.isProcessing}
                className="flex items-center gap-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg transition duration-200 font-medium"
              >
                <span className="text-lg">{isPlaying ? '⏸️' : '▶️'}</span>
                {isPlaying ? 'Pause' : 'Play'}
              </button>
              <button
                onClick={handlePreview}
                disabled={processing.isProcessing}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg transition duration-200 font-medium"
              >
                <span className="text-lg">👁️</span>
                Preview Selection
              </button>
              <button
                onClick={trimVideo}
                disabled={processing.isProcessing || !ffmpegRef.current}
                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg transition duration-200 font-medium"
              >
                <span className="text-lg">✂️</span>
                {processing.isProcessing ? 'Processing...' : 'Trim Video'}
              </button>
            </div>

            {/* Processing Progress */}
            {processing.isProcessing && (
              <div className="space-y-3 p-4 bg-gray-50 rounded-lg border">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-indigo-600"></div>
                    <span className="text-sm font-medium text-gray-700">{processing.stage}</span>
                  </div>
                  <span className="text-sm font-mono font-medium text-indigo-600">{processing.progress}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-indigo-500 to-indigo-600 h-3 rounded-full transition-all duration-300 ease-out"
                    style={{ width: `${processing.progress}%` }}
                  />
                </div>
              </div>
            )}

            {/* Output Video */}
            {outputUrl && (
              <div className="space-y-4 p-4 bg-green-50 rounded-lg border border-green-200">
                <div className="flex items-center gap-2">
                  <span className="text-lg">✅</span>
                  <h3 className="font-semibold text-gray-900">Trimmed Video Ready!</h3>
                </div>
                <div className="aspect-video bg-black rounded-lg overflow-hidden shadow-lg">
                  <video
                    src={outputUrl}
                    controls
                    className="w-full h-full"
                  />
                </div>
                <div className="text-sm text-gray-600 text-center">
                  Your trimmed video is ready for download
                </div>
              </div>
            )}
          </div>

          {/* Controls Panel */}
          <div className="space-y-6">
            {/* Video Quality Control */}
            <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
              <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <span className="text-lg">🎥</span>
                Video Quality
              </h3>
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-3">
                  {[
                    { value: 'low', label: 'Low Quality', resolution: '480p', description: 'Smaller file size, faster processing', color: 'bg-blue-50 border-blue-200 text-blue-700' },
                    { value: 'medium', label: 'Medium Quality', resolution: '720p', description: 'Balanced quality and file size', color: 'bg-green-50 border-green-200 text-green-700' },
                    { value: 'high', label: 'High Quality', resolution: '1080p', description: 'Best quality, larger file size', color: 'bg-purple-50 border-purple-200 text-purple-700' }
                  ].map((option) => (
                    <label
                      key={option.value}
                      className={`relative flex items-center p-4 rounded-lg border-2 cursor-pointer transition-all duration-200 ${
                        editOptions.quality === option.value
                          ? `${option.color} ring-2 ring-offset-2 ring-indigo-500`
                          : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                      }`}
                    >
                      <input
                        type="radio"
                        name="quality"
                        value={option.value}
                        checked={editOptions.quality === option.value}
                        onChange={(e) => setEditOptions(prev => ({
                          ...prev,
                          quality: e.target.value as 'low' | 'medium' | 'high'
                        }))}
                        className="sr-only"
                        disabled={processing.isProcessing}
                      />
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-gray-900">{option.label}</span>
                          <span className="text-sm font-mono bg-gray-100 px-2 py-1 rounded">{option.resolution}</span>
                        </div>
                        <p className="text-sm text-gray-600 mt-1">{option.description}</p>
                      </div>
                      <div className={`ml-3 w-4 h-4 rounded-full border-2 ${
                        editOptions.quality === option.value
                          ? 'border-indigo-500 bg-indigo-500'
                          : 'border-gray-300'
                      }`}>
                        {editOptions.quality === option.value && (
                          <div className="w-2 h-2 bg-white rounded-full m-0.5"></div>
                        )}
                      </div>
                    </label>
                  ))}
                </div>
                
                {outputUrl && processedQuality && editOptions.quality !== processedQuality && (
                  <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                    <div className="flex items-start gap-2">
                      <span className="text-amber-600 text-sm">ℹ️</span>
                      <div className="text-sm text-amber-700">
                        <p className="font-medium">Quality Change Detected</p>
                        <p>Current: {processedQuality === 'low' ? '480p' : processedQuality === 'medium' ? '720p' : '1080p'} → New: {editOptions.quality === 'low' ? '480p' : editOptions.quality === 'medium' ? '720p' : '1080p'}</p>
                        <p className="mt-1">Click "Re-process Video" to apply the new quality settings.</p>
                      </div>
                    </div>
                  </div>
                )}
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
                Reset Trim
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Save Options Modal */}
      {showSaveOptions && (
        <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto border border-gray-100">
            {/* Header with gradient */}
            <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-t-2xl p-6 text-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white bg-opacity-20 rounded-full flex items-center justify-center">
                    <span className="text-xl">💾</span>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold">Save Video</h3>
                    <p className="text-indigo-100 text-sm">Choose your preferred save option</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowSaveOptions(false)}
                  className="w-8 h-8 bg-gray-800 bg-opacity-80 hover:bg-opacity-100 rounded-full flex items-center justify-center transition duration-200 border border-gray-700"
                >
                  <span className="text-white text-xl font-bold">×</span>
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* File Name Input */}
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-gray-800">
                  File Name
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={customFileName}
                    onChange={(e) => setCustomFileName(e.target.value)}
                    placeholder="Enter custom file name"
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition duration-200 bg-white text-gray-900 placeholder-gray-500"
                  />
                  <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                    <span className="text-gray-500 text-sm font-medium">.mp4</span>
                  </div>
                </div>
                <p className="text-xs text-gray-500 bg-gray-50 px-3 py-2 rounded-lg">
                  <span className="font-medium">Preview:</span> {customFileName || `trimmed_${video.name}`}.mp4
                </p>
              </div>

              {/* Video Info Card */}
              <div className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl p-4 border border-gray-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-indigo-100 rounded-lg flex items-center justify-center">
                      <span className="text-indigo-600 text-sm">🎥</span>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-gray-700">Quality:</span>
                      <span className="ml-2 px-3 py-1 bg-indigo-500 text-white rounded-full text-xs font-bold">
                        {editOptions.quality === 'low' ? '480p' : editOptions.quality === 'medium' ? '720p' : '1080p'}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-gray-500">Duration</div>
                    <div className="text-sm font-mono text-gray-700">
                      {formatTime((editOptions.endTime - editOptions.startTime) / 100 * duration)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Save Options */}
              <div className="space-y-4">
                <h4 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                  <span className="w-2 h-2 bg-indigo-500 rounded-full"></span>
                  Choose where to save:
                </h4>
                
                {/* Download Option */}
                <button
                  onClick={downloadTrimmedVideo}
                  className="w-full group relative overflow-hidden bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-200 rounded-xl p-5 hover:border-green-400 hover:shadow-lg transition-all duration-300 transform hover:scale-[1.02]"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-green-500 rounded-xl flex items-center justify-center group-hover:bg-green-600 transition duration-200">
                      <span className="text-white text-xl">📥</span>
                    </div>
                    <div className="flex-1 text-left">
                      <div className="font-semibold text-gray-900 group-hover:text-green-700 transition duration-200">
                        Download to Device
                      </div>
                      <div className="text-sm text-gray-600 group-hover:text-green-600 transition duration-200">
                        Save directly to your computer
                      </div>
                    </div>
                    <div className="text-green-500 group-hover:text-green-600 transition duration-200">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                    </div>
                  </div>
                </button>

                {/* Google Drive Option */}
                <button
                  onClick={saveToGoogleDrive}
                  disabled={saving || !googleDriveFolderId}
                  className="w-full group relative overflow-hidden bg-gradient-to-r from-blue-50 to-cyan-50 border-2 border-blue-200 rounded-xl p-5 hover:border-blue-400 hover:shadow-lg transition-all duration-300 transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-blue-500 rounded-xl flex items-center justify-center group-hover:bg-blue-600 transition duration-200">
                      {saving ? (
                        <div className="animate-spin rounded-full h-6 w-6 border-2 border-white border-t-transparent"></div>
                      ) : (
                        <span className="text-white text-xl">☁️</span>
                      )}
                    </div>
                    <div className="flex-1 text-left">
                      <div className="font-semibold text-gray-900 group-hover:text-blue-700 transition duration-200">
                        {saving ? 'Saving to Google Drive...' : 'Save to Google Drive'}
                      </div>
                      <div className="text-sm text-gray-600 group-hover:text-blue-600 transition duration-200">
                        {googleDriveFolderId ? 'Save to Screen Recordings folder' : 'Loading folder...'}
                      </div>
                    </div>
                    <div className="text-blue-500 group-hover:text-blue-600 transition duration-200">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
                      </svg>
                    </div>
                  </div>
                </button>
              </div>

              {/* Status Messages */}
              {saveStatus.type && (
                <div className={`p-4 rounded-xl border-2 ${
                  saveStatus.type === 'success' 
                    ? 'bg-green-50 border-green-200 text-green-800' 
                    : 'bg-red-50 border-red-200 text-red-800'
                }`}>
                  <div className="flex items-start gap-3">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                      saveStatus.type === 'success' ? 'bg-green-500' : 'bg-red-500'
                    }`}>
                      <span className="text-white text-sm">
                        {saveStatus.type === 'success' ? '✓' : '✕'}
                      </span>
                    </div>
                    <div className="text-sm font-medium">
                      {saveStatus.message}
                    </div>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowSaveOptions(false)}
                  className="flex-1 px-6 py-3 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-xl transition duration-200 font-medium"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Success Popup */}
      {showSuccessPopup && (
        <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full border border-gray-100 transform transition-all duration-300 scale-100">
            <div className="p-8 text-center">
              {/* Success Icon */}
              <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-green-100 flex items-center justify-center">
                {successType === 'download' ? (
                  <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                ) : (
                  <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
                  </svg>
                )}
              </div>

              {/* Success Message */}
              <h3 className="text-2xl font-bold text-gray-900 mb-2">
                {successType === 'download' ? 'Download Complete!' : 'Saved to Google Drive!'}
              </h3>
              <p className="text-gray-600 mb-6">
                {successMessage}
              </p>

              {/* Action Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={() => setShowSuccessPopup(false)}
                  className="flex-1 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition duration-200 font-medium"
                >
                  Continue Editing
                </button>
                {successType === 'google-drive' && (
                  <button
                    onClick={() => {
                      window.location.href = '/';
                      setShowSuccessPopup(false);
                    }}
                    className="flex-1 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition duration-200 font-medium"
                  >
                    View All Videos
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
