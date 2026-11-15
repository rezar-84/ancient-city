import type { Group } from 'three';
import { createTheatre } from './theatre';
import { createFrontinusGate, createByzantineGate } from './gate';
import { createColonnadedStreet } from './colonnade';
import { createTemple } from './temple';
import { createAgora } from './agora';
import { createMartyrium } from './martyrium';
import { createBaths } from './baths';
import { createNymphaeum } from './nymphaeum';
import { createNecropolis } from './necropolis';
import { createWall } from './walls';
import type { WallOptions } from './walls';
import { createLatrine } from './latrine';
import { createChurch } from './church';
export * from './theatre';
export * from './gate';
export * from './colonnade';
export * from './temple';
export * from './agora';
export * from './martyrium';
export * from './baths';
export * from './nymphaeum';
export * from './necropolis';
export * from './walls';
export * from './latrine';
export * from './church';
/** Wall adapter accepts {points, ...WallOptions}; all other entries use their generator options. */
export const BUILDERS: Record<string, (o?: any) => Group> = {
  theatre: createTheatre, frontinusGate: createFrontinusGate, byzantineGate: createByzantineGate,
  colonnadedStreet: createColonnadedStreet, temple: createTemple, agora: createAgora,
  martyrium: createMartyrium, baths: createBaths, nymphaeum: createNymphaeum,
  necropolis: createNecropolis,
  wall: (o: (WallOptions & { points?: Array<[number, number]> }) = {}) => createWall(o.points ?? [[-60, 0], [60, 0]], o),
  latrine: createLatrine, church: createChurch,
};
