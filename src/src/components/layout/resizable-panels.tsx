'use client';

import { useState, useRef, useCallback, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface ResizablePanelsProps {
  left: ReactNode;
  right: ReactNode;
  defaultLeftWidth?: number; // percentage, default 45
  minLeftWidth?: number;     // px, default 320
  minRightWidth?: number;    // px, default 400
}

export function ResizablePanels({
  left,
  right,
  defaultLeftWidth = 45,
  minLeftWidth = 320,
  minRightWidth = 400,
}: ResizablePanelsProps) {
  const [leftPercent, setLeftPercent] = useState(defaultLeftWidth);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = useCallback(() => {
    setIsDragging(true);

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const totalWidth = rect.width;
      const x = e.clientX - rect.left;
      const percent = (x / totalWidth) * 100;

      const minLeftPercent = (minLeftWidth / totalWidth) * 100;
      const maxLeftPercent = 100 - (minRightWidth / totalWidth) * 100;

      setLeftPercent(Math.min(Math.max(percent, minLeftPercent), maxLeftPercent));
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [minLeftWidth, minRightWidth]);

  return (
    <div ref={containerRef} className="flex h-full w-full overflow-hidden">
      <div
        className="h-full overflow-hidden"
        style={{ width: `${leftPercent}%` }}
      >
        {left}
      </div>

      <div
        onMouseDown={handleMouseDown}
        className={cn(
          'flex h-full w-1.5 cursor-col-resize items-center justify-center hover:bg-primary/10 transition-colors',
          isDragging && 'bg-primary/20'
        )}
      >
        <div className={cn(
          'h-8 w-0.5 rounded-full bg-outline-variant transition-colors',
          isDragging && 'bg-primary'
        )} />
      </div>

      <div className="h-full flex-1 overflow-hidden">
        {right}
      </div>

      {isDragging && (
        <div className="fixed inset-0 z-50 cursor-col-resize" />
      )}
    </div>
  );
}
