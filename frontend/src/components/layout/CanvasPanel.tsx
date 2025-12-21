import VisualizationCanvas from '@components/canvas/VisualizationCanvas';
import { ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';
import { useCanvasStore } from '@store/slices/canvasSlice';

export default function CanvasPanel() {
  const { zoom, resetView, zoomIn, zoomOut } = useCanvasStore();

  return (
    <div className="flex h-full flex-col bg-slate-950">
      {/* Canvas Header */}
      <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900 px-4 py-2">
        <span className="text-sm font-medium text-slate-300">Visualization Canvas</span>
        
        {/* Canvas Controls */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 mr-2">
            {Math.round(zoom * 100)}%
          </span>
          
          <button
            onClick={zoomOut}
            className="rounded p-1.5 hover:bg-slate-800 transition-colors"
            title="Zoom Out"
          >
            <ZoomOut className="h-4 w-4 text-slate-400" />
          </button>
          
          <button
            onClick={zoomIn}
            className="rounded p-1.5 hover:bg-slate-800 transition-colors"
            title="Zoom In"
          >
            <ZoomIn className="h-4 w-4 text-slate-400" />
          </button>
          
          <button
            onClick={resetView}
            className="rounded p-1.5 hover:bg-slate-800 transition-colors"
            title="Reset View"
          >
            <Maximize2 className="h-4 w-4 text-slate-400" />
          </button>
        </div>
      </div>

      {/* Canvas Area */}
      <div className="flex-1 overflow-hidden">
        <VisualizationCanvas />
      </div>
    </div>
  );
}