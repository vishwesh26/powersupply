/**
 * Shared 3D Breadboard Coordinate System & Procedural Texture Helpers
 * Ensures all component leads, jumper wires, current particles, and meter probes
 * snap into electrically consistent breadboard holes.
 */

export const BOARD_TOP_Y = 0.3;
export const HOLE_PITCH = 0.4;
export const COL_COUNT = 36;

export type StripRow = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H' | 'I' | 'J';
export type RailRow = 'TOP_PLUS' | 'TOP_GND' | 'BOT_PLUS' | 'BOT_GND';
export type AnyRow = StripRow | RailRow;

const ROW_Z_MAP: Record<AnyRow, number> = {
  TOP_GND: -3.7,
  TOP_PLUS: -3.3,
  A: -2.3,
  B: -1.9,
  C: -1.5,
  D: -1.1,
  E: -0.7,
  F: 0.7,
  G: 1.1,
  H: 1.5,
  I: 1.9,
  J: 2.3,
  BOT_PLUS: 3.3,
  BOT_GND: 3.7,
};

/**
 * Converts 1-indexed breadboard column (1..36) to world X coordinate.
 */
export function colX(col: number): number {
  return -5.8 + (col - 1) * HOLE_PITCH;
}

/**
 * Converts breadboard row identifier ('A'..'J' or rail) to world Z coordinate.
 */
export function rowZ(row: AnyRow): number {
  return ROW_Z_MAP[row];
}

/**
 * Returns [x, BOARD_TOP_Y, z] tuple for a specific breadboard socket hole.
 */
export function holePos(col: number, row: AnyRow, yOffset = 0): [number, number, number] {
  return [colX(col), BOARD_TOP_Y + yOffset, rowZ(row)];
}

export const STRIP_ROWS: StripRow[] = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];
export const RAIL_ROWS: RailRow[] = ['TOP_GND', 'TOP_PLUS', 'BOT_PLUS', 'BOT_GND'];
