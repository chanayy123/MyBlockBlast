export type GridCell = string | 0; // 0 for empty, color string for filled
export type Grid = GridCell[][];

export interface Shape {
  id: string;
  cells: number[][]; // 2D array representing the shape (1 for block, 0 for empty)
  color: string;
  size: 'small' | 'medium' | 'large';
}

export interface Position {
  x: number;
  y: number;
}
