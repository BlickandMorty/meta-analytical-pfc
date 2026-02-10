'use client';

import { memo, useMemo, useEffect, useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { usePFCStore } from '@/lib/store/use-pfc-store';
import type { ThoughtNode, ThoughtGraph } from '@/lib/research/types';

// ═══════════════════════════════════════════════════════════════════
// Thought Visualizer — Mind-Map of Reasoning Chains
// ═══════════════════════════════════════════════════════════════════

interface ThoughtVisualizerProps {
  isDark: boolean;
}

const NODE_COLORS: Record<ThoughtNode['type'], string> = {
  query: '#E07850',
  reasoning: '#C4956A',
  evidence: '#34D399',
  conclusion: '#22D3EE',
  counter: '#F87171',
  branch: '#FBBF24',
};

const NODE_LABELS: Record<ThoughtNode['type'], string> = {
  query: 'Query',
  reasoning: 'Reasoning',
  evidence: 'Evidence',
  conclusion: 'Conclusion',
  counter: 'Counter',
  branch: 'Branch',
};

/** Build a thought graph from the current pipeline + messages */
function buildThoughtGraph(
  messages: { id: string; role: string; text: string; concepts?: string[]; confidence?: number; dualMessage?: { rawAnalysis: string; uncertaintyTags: { claim: string; tag: string }[]; reflection: { selfCriticalQuestions: string[]; leastDefensibleClaim: string } } }[],
  pipelineStages: { stage: string; status: string; summary: string; detail?: string }[],
): ThoughtGraph | null {
  if (messages.length === 0) return null;

  const nodes: ThoughtNode[] = [];
  const edges: ThoughtGraph['edges'] = [];

  // Find last user message and system response pair
  let lastUserMsg = null;
  let lastSystemMsg = null;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === 'system' && !lastSystemMsg) lastSystemMsg = messages[i];
    if (messages[i].role === 'user' && !lastUserMsg) lastUserMsg = messages[i];
    if (lastUserMsg && lastSystemMsg) break;
  }

  if (!lastUserMsg) return null;

  // Root: Query node
  const rootId = 'node-query';
  nodes.push({
    id: rootId,
    label: lastUserMsg.text.slice(0, 80) + (lastUserMsg.text.length > 80 ? '...' : ''),
    type: 'query',
    children: [],
    depth: 0,
  });

  // Pipeline stages as reasoning nodes
  const completedStages = pipelineStages.filter((s) => s.status === 'complete');
  completedStages.forEach((stage, i) => {
    const stageId = `node-stage-${stage.stage}`;
    nodes.push({
      id: stageId,
      label: stage.summary,
      type: 'reasoning',
      parentId: rootId,
      children: [],
      depth: 1,
      detail: stage.detail,
    });
    nodes[0].children.push(stageId);
    edges.push({ from: rootId, to: stageId, label: `Stage ${i + 1}` });
  });

  // Evidence from concepts
  if (lastUserMsg.concepts || (lastSystemMsg && lastSystemMsg.concepts)) {
    const concepts = lastSystemMsg?.concepts ?? lastUserMsg.concepts ?? [];
    concepts.forEach((concept, i) => {
      const conceptId = `node-concept-${i}`;
      const parentStage = completedStages.length > 0 ? `node-stage-${completedStages[Math.min(i, completedStages.length - 1)].stage}` : rootId;
      nodes.push({
        id: conceptId,
        label: concept,
        type: 'evidence',
        parentId: parentStage,
        children: [],
        depth: 2,
      });
      const parent = nodes.find((n) => n.id === parentStage);
      if (parent) parent.children.push(conceptId);
      edges.push({ from: parentStage, to: conceptId, label: 'concept' });
    });
  }

  // Counter-arguments from reflection
  if (lastSystemMsg?.dualMessage?.reflection) {
    const reflection = lastSystemMsg.dualMessage.reflection;
    if (reflection.leastDefensibleClaim) {
      const counterId = 'node-counter-0';
      nodes.push({
        id: counterId,
        label: reflection.leastDefensibleClaim.slice(0, 60) + '...',
        type: 'counter',
        parentId: rootId,
        children: [],
        depth: 1,
        detail: reflection.leastDefensibleClaim,
      });
      nodes[0].children.push(counterId);
      edges.push({ from: rootId, to: counterId, label: 'weakness' });
    }

    reflection.selfCriticalQuestions?.slice(0, 3).forEach((q, i) => {
      const qId = `node-question-${i}`;
      nodes.push({
        id: qId,
        label: q.slice(0, 50) + (q.length > 50 ? '...' : ''),
        type: 'branch',
        parentId: rootId,
        children: [],
        depth: 1,
        detail: q,
      });
      nodes[0].children.push(qId);
      edges.push({ from: rootId, to: qId, label: 'critical question' });
    });
  }

  // Conclusion node
  if (lastSystemMsg) {
    const conclusionId = 'node-conclusion';
    nodes.push({
      id: conclusionId,
      label: `Confidence: ${((lastSystemMsg.confidence ?? 0.5) * 100).toFixed(0)}%`,
      type: 'conclusion',
      parentId: rootId,
      children: [],
      depth: 1,
      confidence: lastSystemMsg.confidence,
      detail: lastSystemMsg.text.slice(0, 200),
    });
    nodes[0].children.push(conclusionId);
    edges.push({ from: rootId, to: conclusionId, label: 'conclusion', weight: lastSystemMsg.confidence });
  }

  return { nodes, edges, rootId };
}

export const ThoughtVisualizer = memo(function ThoughtVisualizer({ isDark }: ThoughtVisualizerProps) {
  const messages = usePFCStore((s) => s.messages);
  const pipelineStages = usePFCStore((s) => s.pipelineStages);
  const currentThoughtGraph = usePFCStore((s) => s.currentThoughtGraph);
  const setCurrentThoughtGraph = usePFCStore((s) => s.setCurrentThoughtGraph);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const graph = useMemo(() => {
    if (currentThoughtGraph) return currentThoughtGraph;
    return buildThoughtGraph(messages as any, pipelineStages);
  }, [messages, pipelineStages, currentThoughtGraph]);

  useEffect(() => {
    if (graph && !currentThoughtGraph) {
      setCurrentThoughtGraph(graph);
    }
  }, [graph, currentThoughtGraph, setCurrentThoughtGraph]);

  if (!graph || graph.nodes.length === 0) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          minHeight: '24rem',
          color: isDark ? 'rgba(155,150,137,0.4)' : 'rgba(0,0,0,0.2)',
        }}
      >
        <p style={{ fontSize: '0.8125rem' }}>Send a query to visualize the thought process</p>
      </div>
    );
  }

  // Layout: radial from center
  const centerX = 400;
  const centerY = 300;
  const ringRadius = [0, 160, 280];

  // Position nodes by depth in rings
  const nodePositions: Record<string, { x: number; y: number }> = {};
  const nodesByDepth: Record<number, ThoughtNode[]> = {};
  graph.nodes.forEach((n) => {
    if (!nodesByDepth[n.depth]) nodesByDepth[n.depth] = [];
    nodesByDepth[n.depth].push(n);
  });

  Object.entries(nodesByDepth).forEach(([depthStr, nodesAtDepth]) => {
    const depth = parseInt(depthStr);
    const radius = ringRadius[Math.min(depth, ringRadius.length - 1)];
    nodesAtDepth.forEach((node, i) => {
      const angle = (2 * Math.PI * i) / nodesAtDepth.length - Math.PI / 2;
      nodePositions[node.id] = {
        x: centerX + radius * Math.cos(angle),
        y: centerY + radius * Math.sin(angle),
      };
    });
  });

  const hoveredNodeData = hoveredNode ? graph.nodes.find((n) => n.id === hoveredNode) : null;

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        minHeight: '28rem',
        overflow: 'hidden',
      }}
    >
      <svg
        viewBox="0 0 800 600"
        style={{ width: '100%', height: '100%' }}
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Edges */}
        {graph.edges.map((edge, i) => {
          const from = nodePositions[edge.from];
          const to = nodePositions[edge.to];
          if (!from || !to) return null;
          const isHighlighted = hoveredNode === edge.from || hoveredNode === edge.to;
          return (
            <line
              key={`edge-${i}`}
              x1={from.x}
              y1={from.y}
              x2={to.x}
              y2={to.y}
              stroke={isHighlighted ? '#C4956A' : (isDark ? 'rgba(50,49,45,0.3)' : 'rgba(0,0,0,0.08)')}
              strokeWidth={isHighlighted ? 2 : 1}
              strokeDasharray={edge.label === 'weakness' ? '4 4' : undefined}
              style={{ transition: 'stroke 0.2s, stroke-width 0.2s' }}
            />
          );
        })}

        {/* Nodes */}
        {graph.nodes.map((node) => {
          const pos = nodePositions[node.id];
          if (!pos) return null;
          const color = NODE_COLORS[node.type];
          const isHovered = hoveredNode === node.id;
          const nodeRadius = node.type === 'query' ? 28 : 20;

          return (
            <g
              key={node.id}
              onMouseEnter={() => setHoveredNode(node.id)}
              onMouseLeave={() => setHoveredNode(null)}
              style={{ cursor: 'pointer' }}
            >
              {/* Glow */}
              {isHovered && (
                <circle
                  cx={pos.x}
                  cy={pos.y}
                  r={nodeRadius + 8}
                  fill={`${color}15`}
                  style={{ transition: 'r 0.2s' }}
                />
              )}
              {/* Node circle */}
              <circle
                cx={pos.x}
                cy={pos.y}
                r={nodeRadius}
                fill={isDark ? 'rgba(28,27,25,0.9)' : 'rgba(255,255,255,0.9)'}
                stroke={color}
                strokeWidth={isHovered ? 2.5 : 1.5}
                style={{ transition: 'stroke-width 0.2s' }}
              />
              {/* Type badge */}
              <text
                x={pos.x}
                y={pos.y - 3}
                textAnchor="middle"
                fill={color}
                fontSize="7"
                fontWeight="600"
                fontFamily="var(--font-mono)"
                style={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}
              >
                {NODE_LABELS[node.type]}
              </text>
              {/* Label */}
              <text
                x={pos.x}
                y={pos.y + 8}
                textAnchor="middle"
                fill={isDark ? 'rgba(232,228,222,0.7)' : 'rgba(0,0,0,0.5)'}
                fontSize="6.5"
                fontFamily="var(--font-sans)"
              >
                {node.label.length > 25 ? node.label.slice(0, 25) + '...' : node.label}
              </text>
              {/* Confidence indicator */}
              {node.confidence !== undefined && (
                <text
                  x={pos.x}
                  y={pos.y + 16}
                  textAnchor="middle"
                  fill={node.confidence > 0.7 ? '#34D399' : node.confidence > 0.4 ? '#FBBF24' : '#F87171'}
                  fontSize="6"
                  fontFamily="var(--font-mono)"
                  fontWeight="600"
                >
                  {(node.confidence * 100).toFixed(0)}%
                </text>
              )}
            </g>
          );
        })}
      </svg>

      {/* Legend */}
      <div
        style={{
          position: 'absolute',
          bottom: '0.75rem',
          left: '0.75rem',
          display: 'flex',
          gap: '0.5rem',
          flexWrap: 'wrap',
        }}
      >
        {Object.entries(NODE_COLORS).map(([type, color]) => (
          <div
            key={type}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.25rem',
              fontSize: '0.5625rem',
              color: isDark ? 'rgba(155,150,137,0.5)' : 'rgba(0,0,0,0.3)',
            }}
          >
            <div
              style={{
                width: '0.5rem',
                height: '0.5rem',
                borderRadius: '50%',
                background: color,
              }}
            />
            {NODE_LABELS[type as ThoughtNode['type']]}
          </div>
        ))}
      </div>

      {/* Hover tooltip */}
      {hoveredNodeData?.detail && (
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            position: 'absolute',
            top: '0.75rem',
            right: '0.75rem',
            maxWidth: '16rem',
            padding: '0.75rem',
            borderRadius: '0.625rem',
            background: isDark ? 'rgba(28,27,25,0.95)' : 'rgba(255,255,255,0.95)',
            border: isDark ? '1px solid rgba(50,49,45,0.3)' : '1px solid rgba(0,0,0,0.08)',
            backdropFilter: 'blur(12px)',
            fontSize: '0.6875rem',
            lineHeight: 1.5,
            color: isDark ? 'rgba(232,228,222,0.8)' : 'rgba(0,0,0,0.6)',
          }}
        >
          <p
            style={{
              fontSize: '0.5625rem',
              fontWeight: 600,
              color: NODE_COLORS[hoveredNodeData.type],
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              marginBottom: '0.25rem',
            }}
          >
            {NODE_LABELS[hoveredNodeData.type]}
          </p>
          {hoveredNodeData.detail}
        </motion.div>
      )}
    </div>
  );
});
