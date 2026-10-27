import React from 'react';
import { Html } from '@react-three/drei';
import { ComponentId } from '../engine/types';
import { useLabStore } from '../store/useLabStore';

interface ComponentTooltipProps {
  id: ComponentId;
  position: [number, number, number];
  title: string;
  valueText: string;
  subtitle?: string;
  warningText?: string;
}

export const ComponentTooltip: React.FC<ComponentTooltipProps> = ({
  id,
  position,
  title,
  valueText,
  subtitle,
  warningText,
}) => {
  const hovered = useLabStore((s) => s.hoveredComponent === id);
  const selected = useLabStore((s) => s.selectedComponent === id);

  if (!hovered && !selected) return null;

  return (
    <Html position={position} center distanceFactor={18} zIndexRange={[20, 0]}>
      <div
        className={`pointer-events-none whitespace-nowrap rounded-lg border px-2.5 py-1.5 text-xs shadow-xl backdrop-blur-md transition-all ${
          warningText
            ? 'border-red-500/80 bg-slate-950/95 text-red-100'
            : selected
            ? 'border-cyan-400/90 bg-slate-900/95 text-slate-100'
            : 'border-slate-600/90 bg-slate-900/90 text-slate-100'
        }`}
      >
        <div className="flex items-center gap-2">
          <span className="font-semibold text-cyan-300">{title}</span>
          <span className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-[11px] text-amber-300">
            {valueText}
          </span>
        </div>
        {subtitle && (
          <div className="mt-0.5 text-[10px] text-slate-400">{subtitle}</div>
        )}
        {warningText && (
          <div className="mt-0.5 font-medium text-[10px] text-red-400">
            ⚠ {warningText}
          </div>
        )}
        {hovered && !selected && (
          <div className="mt-0.5 text-[9px] uppercase tracking-wider text-cyan-400/80">
            Click to edit properties
          </div>
        )}
      </div>
    </Html>
  );
};

export function useComponentInteraction(id: ComponentId) {
  const hovered = useLabStore((s) => s.hoveredComponent === id);
  const selected = useLabStore((s) => s.selectedComponent === id);
  const hoverComponent = useLabStore((s) => s.hoverComponent);
  const selectComponent = useLabStore((s) => s.selectComponent);

  return {
    hovered,
    selected,
    highlighted: hovered || selected,
    handlers: {
      onPointerOver: (e: { stopPropagation: () => void }) => {
        e.stopPropagation();
        document.body.style.cursor = 'pointer';
        hoverComponent(id);
      },
      onPointerOut: (e: { stopPropagation: () => void }) => {
        e.stopPropagation();
        document.body.style.cursor = 'auto';
        if (useLabStore.getState().hoveredComponent === id) {
          hoverComponent(null);
        }
      },
      onClick: (e: { stopPropagation: () => void }) => {
        e.stopPropagation();
        selectComponent(id);
      },
    },
  };
}
