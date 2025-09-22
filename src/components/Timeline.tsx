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
  const [isDragging, setIsDragging] = useState<'start' | 'end' | null>(null);
  const [dragOffset, setDragOffset] = useState(0);

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

  const handleMouseDown = (e: React.MouseEvent, handle: 'start' | 'end') => {
    if (disabled) return;
    
    e.preventDefault();
    setIsDragging(handle);
    
    const rect = timelineRef.current?.getBoundingClientRect();
    if (rect) {
      const clickX = e.clientX - rect.left;
      const clickPosition = (clickX / rect.width) * 100;
      const clickTime = getTimeFromPosition(clickPosition);
      
      if (handle === 'start') {
        setDragOffset(clickTime - startTime);
        onStartTimeChange(Math.max(0, Math.min(clickTime, endTime - 0.1)));
      } else {
        setDragOffset(clickTime - endTime);
        onEndTimeChange(Math.max(startTime + 0.1, Math.min(clickTime, duration)));
      }
    }
  };

  const handleDocumentMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging || !timelineRef.current) return;

    const rect = timelineRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const position = (mouseX / rect.width) * 100;
    const time = getTimeFromPosition(position);

    if (isDragging === 'start') {
      const newTime = Math.max(0, Math.min(time - dragOffset, endTime - 0.1));
      onStartTimeChange(newTime);
    } else if (isDragging === 'end') {
      const newTime = Math.max(startTime + 0.1, Math.min(time - dragOffset, duration));
      onEndTimeChange(newTime);
    }
  }, [isDragging, dragOffset, endTime, startTime, duration, onStartTimeChange, onEndTimeChange, getTimeFromPosition]);

  const handleMouseMove = (e: React.MouseEvent) => {
    handleDocumentMouseMove(e.nativeEvent);
  };

  const handleMouseUp = () => {
    setIsDragging(null);
    setDragOffset(0);
  };

  const handleTimelineClick = (e: React.MouseEvent) => {
    if (disabled || isDragging) return;

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
        setDragOffset(0);
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
  }, [isDragging, dragOffset, handleDocumentMouseMove]);

  const startPosition = getPositionFromTime(startTime);
  const endPosition = getPositionFromTime(endTime);
  const currentPosition = getPositionFromTime(currentTime);

  return (
    <div className="w-full space-y-4">
      {/* Time Labels */}
      <div className="flex justify-between text-xs text-gray-500">
        <span>{formatTime(startTime)}</span>
        <span className="text-center">
          Duration: {formatTime(endTime - startTime)}
        </span>
        <span>{formatTime(endTime)}</span>
      </div>

      {/* Timeline Track */}
      <div className="relative">
        <div
          ref={timelineRef}
          className="relative h-12 bg-gray-200 rounded-lg cursor-pointer select-none"
          onMouseDown={handleTimelineClick}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
        >
          {/* Background Track */}
          <div className="absolute inset-0 bg-gray-200 rounded-lg" />
          
          {/* Trimmed Range */}
          <div
            className="absolute top-0 h-full bg-indigo-500 rounded-lg"
            style={{
              left: `${startPosition}%`,
              width: `${endPosition - startPosition}%`,
            }}
          />
          
          {/* Current Time Indicator */}
          <div
            className="absolute top-0 w-0.5 h-full bg-red-500 pointer-events-none"
            style={{ left: `${currentPosition}%` }}
          />
          
          {/* Start Handle */}
          <div
            className={`absolute top-0 w-4 h-full bg-indigo-600 rounded-l-lg cursor-ew-resize flex items-center justify-center ${
              disabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-indigo-700'
            }`}
            style={{ left: `${startPosition}%` }}
            onMouseDown={(e) => handleMouseDown(e, 'start')}
          >
            <div className="w-1 h-6 bg-white rounded" />
          </div>
          
          {/* End Handle */}
          <div
            className={`absolute top-0 w-4 h-full bg-indigo-600 rounded-r-lg cursor-ew-resize flex items-center justify-center ${
              disabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-indigo-700'
            }`}
            style={{ left: `${endPosition - 4}%` }}
            onMouseDown={(e) => handleMouseDown(e, 'end')}
          >
            <div className="w-1 h-6 bg-white rounded" />
          </div>
        </div>
      </div>

      {/* Time Markers */}
      <div className="flex justify-between text-xs text-gray-400">
        {Array.from({ length: 5 }, (_, i) => {
          const time = (duration / 4) * i;
          return (
            <span key={i} className="text-center">
              {formatTime(time)}
            </span>
          );
        })}
      </div>
    </div>
  );
}
