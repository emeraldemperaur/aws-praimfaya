import React from 'react';
import '../styles/cube.scss';

export interface CubeIconProps {
  width?: number | string;
  height?: number | string;
  edgeColor?: string;
  darkMode?: boolean;
  animationDuration?: string;
}

export const CubeIcon: React.FC<CubeIconProps> = ({
  width = 250,
  height = 250,
  edgeColor,
  darkMode = false,
  animationDuration = '2s',
}) => {
  const w = typeof width === 'number' ? `${width}px` : width;
  const h = typeof height === 'number' ? `${height}px` : height;

  const activeEdgeColor = edgeColor || (darkMode ? '#ffffff' : 'black');
  const activeFaceBg = darkMode ? '#1b1c1d' : '#ffffff';

  const styles = {
    '--container-width': w,
    '--container-height': h,
    '--edge-color': activeEdgeColor,
    '--face-bg': activeFaceBg,
    '--anim-duration': animationDuration,
  } as React.CSSProperties;

  const cubes = Array.from({ length: 6 }, (_, i) => i + 1);

  return (
    <div className="cube-container" style={styles}>
      <div className="scene">
        {cubes.map((num) => (
          <div key={num} className={`cube cube_count_${num}`}>
            <div className="cube__face cube__face--front"></div>
            <div className="cube__face cube__face--back"></div>
            <div className="cube__face cube__face--right"></div>
            <div className="cube__face cube__face--left"></div>
            <div className="cube__face cube__face--top"></div>
            <div className="cube__face cube__face--bottom"></div>
          </div>
        ))}
      </div>
    </div>
  );
};