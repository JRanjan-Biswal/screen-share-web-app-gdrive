'use client';

import { useState, useRef, useEffect, useCallback } from 'react';

interface TimelineProps {
  duration: number;
  startTime: number;
  endTime: number;
  currentTime: number;
  onStartTimeChange: (time: number) => void;
  onEndTimeChange: (time: number) => void;
  onSeek: (time: number) => void;
  disabled?: boolean;
}

export default function Timeline({
  duration,
  startTime,
  endTime,
  currentTime,
  onStartTimeChange,
  onEndTimeChange,
  onSeek,
  disabled = false
}: TimelineProps) {
  const timelineRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState<'start' | 'end' | 'current' | null>(null);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 100);
    return `${mins}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
  };

  const getPositionFromTime = (time: number) => {
    return (time / duration) * 100;
  };

  const getTimeFromPosition = useCallback((position: number) => {
    return (position / 100) * duration;
  }, [duration]);

  const handleMouseDown = (e: React.MouseEvent, handle: 'start' | 'end' | 'current') => {
    if (disabled) return;
    
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(handle);
  };

  const handleDocumentMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging || !timelineRef.current) return;

    const rect = timelineRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const position = (mouseX / rect.width) * 100;
    const time = (position / 100) * duration; // Direct calculation instead of function call

    if (isDragging === 'start') {
      // Throttle updates for trim handles to prevent performance issues
      requestAnimationFrame(() => {
        if (isDragging === 'start' && timelineRef.current) {
          const newTime = Math.max(0, Math.min(time, endTime - 0.1));
          onStartTimeChange(newTime);
        }
      });
    } else if (isDragging === 'end') {
      // Throttle updates for trim handles to prevent performance issues
      requestAnimationFrame(() => {
        if (isDragging === 'end' && timelineRef.current) {
          const newTime = Math.max(startTime + 0.1, Math.min(time, duration));
          onEndTimeChange(newTime);
        }
      });
      } else if (isDragging === 'current') {
        // No throttling for current time to make it smooth
        const newTime = Math.max(startTime, Math.min(time, endTime));
        onSeek(newTime);
      }
  }, [isDragging, endTime, startTime, duration, onStartTimeChange, onEndTimeChange, onSeek]);

  const handleMouseMove = (e: React.MouseEvent) => {
    handleDocumentMouseMove(e.nativeEvent);
  };

  const handleMouseUp = () => {
    setIsDragging(null);
  };

  const handleTimelineClick = (e: React.MouseEvent) => {
    if (disabled || isDragging) return;

    // Don't seek if clicking on handles or current time indicator
    const target = e.target as HTMLElement;
    if (target.closest('[data-handle]') || target.closest('[data-current-time]')) return;

    const rect = timelineRef.current?.getBoundingClientRect();
    if (rect) {
      const clickX = e.clientX - rect.left;
      const position = (clickX / rect.width) * 100;
      const time = getTimeFromPosition(position);
      onSeek(time);
    }
  };

  useEffect(() => {
            const handleGlobalMouseUp = () => {
              if (isDragging) {
                setIsDragging(null);
              }
            };

    if (isDragging) {
      document.addEventListener('mousemove', handleDocumentMouseMove);
      document.addEventListener('mouseup', handleGlobalMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleDocumentMouseMove);
      document.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [isDragging, handleDocumentMouseMove]);

  const startPosition = getPositionFromTime(startTime);
  const endPosition = getPositionFromTime(endTime);
  const currentPosition = getPositionFromTime(currentTime);
  
  // Calculate handle width as percentage of timeline
  // For a 4px handle on a 400px timeline: (4/400) * 100 = 1%
  // But we'll use a more conservative estimate to ensure proper alignment
  const handleWidthPercent = 1.5; // Slightly larger to account for different screen sizes

  return (
    <div className="w-full space-y-3">
      {/* Time Labels */}
      <div className="flex justify-between items-center text-sm">
        <div className="flex items-center gap-2">
          <span className="font-medium text-gray-700">Start:</span>
          <span className="px-2 py-1 bg-indigo-100 text-indigo-700 rounded text-xs font-mono">
            {formatTime(startTime)}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-medium text-gray-700">Duration:</span>
          <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-mono">
            {formatTime(endTime - startTime)}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-medium text-gray-700">End:</span>
          <span className="px-2 py-1 bg-indigo-100 text-indigo-700 rounded text-xs font-mono">
            {formatTime(endTime)}
          </span>
        </div>
      </div>
      
      {/* Current Time Indicator */}
      <div className="flex justify-center items-center text-sm">
        <div className="flex items-center gap-2">
          <span className="font-medium text-gray-700">Current:</span>
          <span className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs font-mono">
            {formatTime(currentTime)}
          </span>
        </div>
      </div>

      {/* Timeline Track */}
      <div className="relative">
        <div
          ref={timelineRef}
          className="relative h-16 bg-gray-100 rounded-xl cursor-pointer select-none border-2 border-gray-200 hover:border-gray-300 transition-colors"
          onMouseDown={handleTimelineClick}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
        >
          {/* Background Track with subtle pattern */}
          <div className="absolute inset-0 bg-gradient-to-r from-gray-100 to-gray-200 rounded-xl" />
          
          {/* Trimmed Range with gradient */}
          <div
            className="absolute top-0 h-full bg-gradient-to-r from-indigo-500 to-indigo-600 rounded-xl shadow-lg"
            style={{
              left: `${startPosition}%`,
              width: `${endPosition - startPosition}%`,
            }}
          />
          
          {/* Current Time Indicator with pulse animation */}
          <div
            data-current-time="true"
            className="absolute top-0 w-2 h-full bg-red-500 cursor-ew-resize rounded-full shadow-lg hover:bg-red-600 transition-colors duration-200 z-10"
            style={{ left: `${currentPosition}%` }}
            onMouseDown={(e) => handleMouseDown(e, 'current')}
          />
          
          {/* Start Handle */}
          <div
            data-handle="start"
            className={`absolute top-0 w-4 h-full rounded-l-lg cursor-ew-resize flex items-center justify-center shadow-lg z-10 transition-colors duration-200 ${
              disabled 
                ? 'opacity-50 cursor-not-allowed' 
                : ''
            }`}
            style={{ 
              left: `${startPosition}%`,
              background: 'linear-gradient(135deg, #3730a3 0%, #5b21b6 100%)'
            }}
            onMouseDown={(e) => handleMouseDown(e, 'start')}
            onMouseEnter={(e) => {
              if (!disabled) {
                e.currentTarget.style.background = 'linear-gradient(135deg, #1e1b4b 0%, #4c1d95 100%)';
              }
            }}
            onMouseLeave={(e) => {
              if (!disabled) {
                e.currentTarget.style.background = 'linear-gradient(135deg, #3730a3 0%, #5b21b6 100%)';
              }
            }}
          >
            <div className="w-1 h-6 bg-white rounded-full shadow-sm" />
          </div>
          
          {/* End Handle */}
          <div
            data-handle="end"
            className={`absolute top-0 w-4 h-full rounded-r-lg cursor-ew-resize flex items-center justify-center shadow-lg z-10 transition-colors duration-200 ${
              disabled 
                ? 'opacity-50 cursor-not-allowed' 
                : ''
            }`}
            style={{ 
              left: `${endPosition - handleWidthPercent}%`,
              background: 'linear-gradient(135deg, #3730a3 0%, #5b21b6 100%)'
            }}
            onMouseDown={(e) => handleMouseDown(e, 'end')}
            onMouseEnter={(e) => {
              if (!disabled) {
                e.currentTarget.style.background = 'linear-gradient(135deg, #1e1b4b 0%, #4c1d95 100%)';
              }
            }}
            onMouseLeave={(e) => {
              if (!disabled) {
                e.currentTarget.style.background = 'linear-gradient(135deg, #3730a3 0%, #5b21b6 100%)';
              }
            }}
          >
            <div className="w-1 h-6 bg-white rounded-full shadow-sm" />
          </div>

          {/* Timeline markers */}
          <div className="absolute inset-0 flex items-center">
            {Array.from({ length: 9 }, (_, i) => {
              const position = (i / 8) * 100;
              return (
                <div
                  key={i}
                  className="absolute w-px h-4 bg-gray-300"
                  style={{ left: `${position}%` }}
                />
              );
            })}
          </div>
        </div>
      </div>

      {/* Time Markers */}
      <div className="flex justify-between text-xs text-gray-500 font-mono">
        {Array.from({ length: 5 }, (_, i) => {
          const time = (duration / 4) * i;
          return (
            <span key={i} className="text-center">
              {formatTime(time)}
            </span>
          );
        })}
      </div>

      {/* Instructions */}
      <div className="text-xs text-gray-400 text-center">
        Drag handles to trim • Click timeline to seek
      </div>
    </div>
  );
}
