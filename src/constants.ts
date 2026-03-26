import { Shape } from './types';

export const GRID_SIZE = 8;

export const SHAPES: Shape[] = [
  // 1x1
  { id: '1x1', cells: [[1]], color: 'bg-blue-500', size: 'small' },
  // 1x2
  { id: '1x2-h', cells: [[1, 1]], color: 'bg-cyan-500', size: 'small' },
  { id: '1x2-v', cells: [[1], [1]], color: 'bg-cyan-500', size: 'small' },
  // 1x3
  { id: '1x3-h', cells: [[1, 1, 1]], color: 'bg-teal-500', size: 'medium' },
  { id: '1x3-v', cells: [[1], [1], [1]], color: 'bg-teal-500', size: 'medium' },
  // 1x4
  { id: '1x4-h', cells: [[1, 1, 1, 1]], color: 'bg-emerald-500', size: 'medium' },
  { id: '1x4-v', cells: [[1], [1], [1], [1]], color: 'bg-emerald-500', size: 'medium' },
  // 2x2
  { id: '2x2', cells: [[1, 1], [1, 1]], color: 'bg-yellow-500', size: 'medium' },
  // 3x3
  { id: '3x3', cells: [[1, 1, 1], [1, 1, 1], [1, 1, 1]], color: 'bg-orange-500', size: 'large' },
  // L-shapes 2x2
  { id: 'L2-1', cells: [[1, 0], [1, 1]], color: 'bg-red-500', size: 'medium' },
  { id: 'L2-2', cells: [[1, 1], [1, 0]], color: 'bg-red-500', size: 'medium' },
  { id: 'L2-3', cells: [[0, 1], [1, 1]], color: 'bg-red-500', size: 'medium' },
  { id: 'L2-4', cells: [[1, 1], [0, 1]], color: 'bg-red-500', size: 'medium' },
  // L-shapes 3x3
  { id: 'L3-1', cells: [[1, 0, 0], [1, 0, 0], [1, 1, 1]], color: 'bg-purple-500', size: 'large' },
  { id: 'L3-2', cells: [[0, 0, 1], [0, 0, 1], [1, 1, 1]], color: 'bg-purple-500', size: 'large' },
  { id: 'L3-3', cells: [[1, 1, 1], [1, 0, 0], [1, 0, 0]], color: 'bg-purple-500', size: 'large' },
  { id: 'L3-4', cells: [[1, 1, 1], [0, 0, 1], [0, 0, 1]], color: 'bg-purple-500', size: 'large' },
];

export const COLORS = [
  'bg-blue-500',
  'bg-cyan-500',
  'bg-teal-500',
  'bg-emerald-500',
  'bg-yellow-500',
  'bg-orange-500',
  'bg-red-500',
  'bg-purple-500',
  'bg-pink-500',
  'bg-indigo-500',
];
