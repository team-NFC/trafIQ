import React from 'react';
import { GodViewNode, GodViewLink } from '../../api/godview';
import { AlertTriangle, Siren } from 'lucide-react';

interface GodViewMapProps {
  nodes: GodViewNode[];
  links: GodViewLink[];
  activeScenario: string;
  onSelectNode: (node: GodViewNode) => void;
  selectedNodeId: string | null;
}

export const GodViewMap: React.FC<GodViewMapProps> = ({
  nodes,
  links,
  activeScenario,
  onSelectNode,
  selectedNodeId,
}) => {
  // SVG Viewport coordinate dimensions: 1040 x 620
  const width = 1040;
  const height = 620;

  const getNodeColor = (node: GodViewNode) => {
    if (node.is_missing) return '#eab308'; // Yellow for missing
    if (node.is_ambulance && activeScenario === 'ambulance') return '#ef4444'; // Red for ambulance
    if (node.signal === 'GREEN') return '#22c55e';
    if (node.signal === 'YELLOW') return '#f59e0b';
    if (node.signal === 'RED') return '#ef4444';
    if (node.signal === 'TRANSIT') return '#06b6d4';
    return '#64748b';
  };

  const isZoneActive = (zone: GodViewNode['zone']) => {
    if (activeScenario === 'normal' && zone === 'NORMAL') return true;
    if (activeScenario === 'ambulance' && (zone === 'AMBULANCE' || zone === 'NORMAL')) return true;
    if (activeScenario === 'anpr_missing' && zone === 'ANPR_MISSING') return true;
    if (activeScenario === 'anpr_continuous' && zone === 'ANPR_CONTINUOUS') return true;
    return false;
  };

  // Node lookup map
  const nodeMap = new Map<string, GodViewNode>();
  nodes.forEach(n => nodeMap.set(n.id, n));

  return (
    <div className="relative w-full rounded-2xl border border-slate-800 bg-[#070b14] overflow-hidden shadow-2xl">
      {/* Map Header Overlay */}
      <div className="absolute top-4 left-4 z-10 flex items-center gap-3">
        <div className="px-3 py-1.5 rounded-lg bg-slate-900/90 border border-slate-700/80 backdrop-blur-md flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping" />
          <span className="font-mono text-xs font-bold text-white tracking-wider">
            TRICHY METROPOLITAN TRAFFIC GRID
          </span>
          <span className="text-[10px] text-slate-400 font-mono px-1.5 py-0.5 rounded bg-slate-800">
            16 NODES
          </span>
        </div>
      </div>

      {/* Legend Top-Right */}
      <div className="absolute top-4 right-4 z-10 hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900/90 border border-slate-700/80 backdrop-blur-md text-[11px] font-mono text-slate-300">
        <div className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-green-500" /> Green
        </div>
        <div className="flex items-center gap-1 ml-2">
          <span className="w-2 h-2 rounded-full bg-red-500" /> Red
        </div>
        <div className="flex items-center gap-1 ml-2">
          <span className="w-2 h-2 rounded-full bg-amber-500" /> Missing Node
        </div>
        <div className="flex items-center gap-1 ml-2">
          <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" /> EVP Active
        </div>
      </div>

      {/* SVG Canvas Map */}
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-auto select-none"
        style={{ minHeight: '440px', maxHeight: '680px' }}
      >
        <defs>
          {/* Subtle Grid pattern */}
          <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#141c2e" strokeWidth="0.8" />
          </pattern>

          {/* Glow Filters */}
          <filter id="glow-cyan" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>

          <filter id="glow-red" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="5" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>

          <filter id="glow-amber" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="5" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>

          {/* Linear Gradients for Road Links */}
          <linearGradient id="grad-arterial" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#0891b2" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#2563eb" stopOpacity="0.6" />
          </linearGradient>
        </defs>

        {/* Map Background Grid */}
        <rect width={width} height={height} fill="#070b14" />
        <rect width={width} height={height} fill="url(#grid)" />

        {/* Zone Demarcation Boundaries */}
        {/* Zone 1: Normal 4-Way */}
        <rect
          x="30"
          y="40"
          width="340"
          height="270"
          rx="16"
          fill="#0c162d"
          fillOpacity={isZoneActive('NORMAL') ? '0.45' : '0.15'}
          stroke={isZoneActive('NORMAL') ? '#06b6d4' : '#1e293b'}
          strokeWidth={isZoneActive('NORMAL') ? '2' : '1'}
          strokeDasharray={isZoneActive('NORMAL') ? 'none' : '4 4'}
        />

        {/* Zone 2: Ambulance */}
        <rect
          x="30"
          y="325"
          width="340"
          height="270"
          rx="16"
          fill="#1f1118"
          fillOpacity={isZoneActive('AMBULANCE') ? '0.5' : '0.15'}
          stroke={isZoneActive('AMBULANCE') ? '#ef4444' : '#1e293b'}
          strokeWidth={isZoneActive('AMBULANCE') ? '2' : '1'}
          strokeDasharray={isZoneActive('AMBULANCE') ? 'none' : '4 4'}
        />

        {/* Zone 3: Missing Node */}
        <rect
          x="440"
          y="40"
          width="570"
          height="270"
          rx="16"
          fill="#1c1912"
          fillOpacity={isZoneActive('ANPR_MISSING') ? '0.5' : '0.15'}
          stroke={isZoneActive('ANPR_MISSING') ? '#eab308' : '#1e293b'}
          strokeWidth={isZoneActive('ANPR_MISSING') ? '2' : '1'}
          strokeDasharray={isZoneActive('ANPR_MISSING') ? 'none' : '4 4'}
        />

        {/* Zone 4: Continuous */}
        <rect
          x="440"
          y="325"
          width="570"
          height="270"
          rx="16"
          fill="#0c1d1a"
          fillOpacity={isZoneActive('ANPR_CONTINUOUS') ? '0.5' : '0.15'}
          stroke={isZoneActive('ANPR_CONTINUOUS') ? '#10b981' : '#1e293b'}
          strokeWidth={isZoneActive('ANPR_CONTINUOUS') ? '2' : '1'}
          strokeDasharray={isZoneActive('ANPR_CONTINUOUS') ? 'none' : '4 4'}
        />

        {/* Zone Title Badges */}
        <text x="50" y="70" fill="#38bdf8" fontSize="12" fontWeight="bold" fontFamily="monospace">
          ZONE 1: NORMAL 4-WAY JUNCTION (ANNA NAGAR)
        </text>
        <text x="50" y="355" fill="#f87171" fontSize="12" fontWeight="bold" fontFamily="monospace">
          ZONE 2: EMERGENCY CORRIDOR (GOVT HOSPITAL)
        </text>
        <text x="460" y="70" fill="#facc15" fontSize="12" fontWeight="bold" fontFamily="monospace">
          ZONE 3: ANPR + MISSING NODE (BHARATHIDASAN SALAI)
        </text>
        <text x="460" y="355" fill="#34d399" fontSize="12" fontWeight="bold" fontFamily="monospace">
          ZONE 4: ANPR + CONTINUOUS TRAJECTORY (THILLAI NAGAR)
        </text>

        {/* Road Links & Highway Corridors */}
        {links.map((link, idx) => {
          const fromNode = nodeMap.get(link.from);
          const toNode = nodeMap.get(link.to);
          if (!fromNode || !toNode) return null;

          const isDashed = link.type === 'dashed';
          const isHighlighted =
            (activeScenario === 'anpr_missing' && isDashed) ||
            (activeScenario === 'anpr_continuous' && link.type === 'solid' && fromNode.zone === 'ANPR_CONTINUOUS') ||
            (activeScenario === 'ambulance' && fromNode.zone === 'AMBULANCE');

          return (
            <g key={`link-${idx}`}>
              {/* Road Asphalt Base */}
              <line
                x1={fromNode.x}
                y1={fromNode.y}
                x2={toNode.x}
                y2={toNode.y}
                stroke="#1b2438"
                strokeWidth={isDashed ? '8' : '12'}
                strokeLinecap="round"
              />

              {/* Road Centerline / Flow Line */}
              <line
                x1={fromNode.x}
                y1={fromNode.y}
                x2={toNode.x}
                y2={toNode.y}
                stroke={
                  isDashed
                    ? '#eab308'
                    : isHighlighted
                    ? '#06b6d4'
                    : '#334155'
                }
                strokeWidth={isDashed ? '3' : '2'}
                strokeDasharray={isDashed ? '8 6' : 'none'}
                strokeOpacity={isHighlighted ? 0.9 : 0.6}
              />

              {/* Trajectory Pulse Animation on Active Scenario */}
              {isHighlighted && (
                <circle r="4" fill={isDashed ? '#facc15' : '#38bdf8'}>
                  <animateMotion
                    path={`M ${fromNode.x} ${fromNode.y} L ${toNode.x} ${toNode.y}`}
                    dur={isDashed ? '3.5s' : '2.2s'}
                    repeatCount="indefinite"
                  />
                </circle>
              )}
            </g>
          );
        })}

        {/* Reconstructed Path Banner Annotation on Zone 3 */}
        {activeScenario === 'anpr_missing' && (
          <g transform="translate(680, 205)">
            <rect
              x="-110"
              y="-14"
              width="220"
              height="26"
              rx="6"
              fill="#27200a"
              stroke="#eab308"
              strokeWidth="1.5"
            />
            <text
              x="0"
              y="3"
              fill="#fef08a"
              fontSize="10"
              fontWeight="bold"
              fontFamily="monospace"
              textAnchor="middle"
            >
              ESTIMATED / RECONSTRUCTED (87.4%)
            </text>
          </g>
        )}

        {/* 16 Camera Nodes */}
        {nodes.map((node) => {
          const isSelected = selectedNodeId === node.id;
          const nodeCol = getNodeColor(node);
          const isMissing = node.is_missing;
          const isAmbulance = node.is_ambulance && activeScenario === 'ambulance';

          return (
            <g
              key={node.id}
              transform={`translate(${node.x}, ${node.y})`}
              className="cursor-pointer transition-transform duration-200"
              onClick={() => onSelectNode(node)}
            >
              {/* Outer Pulse Rings */}
              {isAmbulance && (
                <circle
                  r="24"
                  fill="none"
                  stroke="#ef4444"
                  strokeWidth="2"
                  className="animate-ping opacity-75"
                />
              )}
              {isMissing && (
                <circle
                  r="24"
                  fill="none"
                  stroke="#eab308"
                  strokeWidth="2"
                  strokeDasharray="4 4"
                  className="animate-spin opacity-75"
                />
              )}

              {/* Node Outer Ring */}
              <circle
                r="18"
                fill="#0f172a"
                stroke={isSelected ? '#38bdf8' : nodeCol}
                strokeWidth={isSelected ? '3.5' : '2.5'}
                filter={isAmbulance ? 'url(#glow-red)' : isMissing ? 'url(#glow-amber)' : 'none'}
              />

              {/* Signal Indicator Core */}
              <circle r="7" fill={nodeCol} />

              {/* Icon Overlay inside Node */}
              {isAmbulance ? (
                <g transform="translate(-6, -6)">
                  <Siren className="w-3 h-3 text-white" />
                </g>
              ) : isMissing ? (
                <g transform="translate(-6, -6)">
                  <AlertTriangle className="w-3 h-3 text-amber-950" />
                </g>
              ) : null}

              {/* Node Camera ID Badge Above */}
              <g transform="translate(0, -26)">
                <rect
                  x="-32"
                  y="-12"
                  width="64"
                  height="16"
                  rx="4"
                  fill={isMissing ? '#78350f' : isAmbulance ? '#881337' : '#090d18'}
                  stroke={nodeCol}
                  strokeWidth="1"
                />
                <text
                  x="0"
                  y="0"
                  fill="#ffffff"
                  fontSize="9.5"
                  fontWeight="bold"
                  fontFamily="monospace"
                  textAnchor="middle"
                >
                  {node.id}
                </text>
              </g>

              {/* Node Name & Approach Label Below */}
              <text
                x="0"
                y="30"
                fill="#cbd5e1"
                fontSize="9"
                fontWeight="bold"
                fontFamily="sans-serif"
                textAnchor="middle"
              >
                {node.name}
              </text>
              <text
                x="0"
                y="41"
                fill="#64748b"
                fontSize="8"
                fontFamily="sans-serif"
                textAnchor="middle"
              >
                {node.approach} • {node.signal}
              </text>

              {/* Plate / EVP Badge if present */}
              {node.plate && (
                <g transform="translate(0, 52)">
                  <rect
                    x="-42"
                    y="-9"
                    width="84"
                    height="14"
                    rx="3"
                    fill={node.is_missing ? '#451a03' : '#1e293b'}
                    stroke={node.is_missing ? '#eab308' : '#38bdf8'}
                    strokeWidth="0.8"
                  />
                  <text
                    x="0"
                    y="2"
                    fill={node.is_missing ? '#fde047' : '#e0f2fe'}
                    fontSize="7.5"
                    fontWeight="bold"
                    fontFamily="monospace"
                    textAnchor="middle"
                  >
                    {node.plate}
                  </text>
                </g>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
};
