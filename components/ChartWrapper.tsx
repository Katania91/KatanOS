import React, { useEffect, useRef } from 'react';
import Chart from 'chart.js/auto';

interface ChartWrapperProps {
  type: 'bar' | 'line' | 'pie' | 'doughnut' | 'radar' | 'polarArea' | 'bubble' | 'scatter';
  data: any;
  options?: any;
  className?: string;
}

const ChartWrapper: React.FC<ChartWrapperProps> = ({ type, data, options, className }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartInstance = useRef<Chart | null>(null);

  useEffect(() => {
    // Set global defaults for fonts
    if (Chart.defaults) {
        Chart.defaults.font.family = "'Outfit', sans-serif";
        Chart.defaults.color = '#94a3b8';
    }
  }, []);

  useEffect(() => {
    if (!canvasRef.current) return;

    // Destroy existing chart if it exists to prevent canvas reuse errors
    if (chartInstance.current) {
        chartInstance.current.destroy();
    }

    const ctx = canvasRef.current.getContext('2d');
    if (ctx) {
        // Create new chart instance
        chartInstance.current = new Chart(ctx, {
            type,
            data,
            options: {
                ...options,
                responsive: true,
                maintainAspectRatio: false,
            }
        });
    }

    return () => {
        if (chartInstance.current) {
            chartInstance.current.destroy();
            chartInstance.current = null;
        }
    };
  }, [type]); // Re-create only if type changes. Data updates are handled below.

  // Handle data/options updates without destroying the chart (better for animations)
  useEffect(() => {
      if (chartInstance.current) {
          chartInstance.current.data = data;
          if (options) {
            chartInstance.current.options = { 
                ...options, 
                responsive: true, 
                maintainAspectRatio: false 
            };
          }
          chartInstance.current.update();
      }
  }, [data, options]);

  return (
    <div className={`relative w-full h-full ${className || ''}`}>
        <canvas ref={canvasRef} />
    </div>
  );
};

export default ChartWrapper;