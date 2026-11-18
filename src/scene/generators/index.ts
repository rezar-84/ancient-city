import type { Group } from 'three';
import { createTheatre, type TheatreOptions } from './theatre';
import { createFrontinusGate, createByzantineGate, type FrontinusGateOptions, type ByzantineGateOptions } from './gate';
import { createColonnadedStreet, type ColonnadedStreetOptions } from './colonnade';
import { createTemple, type TempleOptions } from './temple';
import { createAgora, type AgoraOptions } from './agora';
import { createMartyrium, type MartyriumOptions } from './martyrium';
import { createBaths, type BathsOptions } from './baths';
import { createNymphaeum, type NymphaeumOptions } from './nymphaeum';
import { createNecropolis, type NecropolisOptions } from './necropolis';
import { createWall, type WallOptions } from './walls';
import { createLatrine, type LatrineOptions } from './latrine';
import { createChurch, type ChurchOptions } from './church';
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
export type BuilderInput = Record<string, unknown>;
/** Wall adapter accepts {points, ...WallOptions}; all other entries use their generator options. */
export const BUILDERS: Record<string, (o?: BuilderInput) => Group> = {
  theatre: (o) => createTheatre(o as TheatreOptions),
  frontinusGate: (o) => createFrontinusGate(o as FrontinusGateOptions),
  byzantineGate: (o) => createByzantineGate(o as ByzantineGateOptions),
  colonnadedStreet: (o) => createColonnadedStreet(o as ColonnadedStreetOptions),
  temple: (o) => createTemple(o as TempleOptions),
  agora: (o) => createAgora(o as AgoraOptions),
  martyrium: (o) => createMartyrium(o as MartyriumOptions),
  baths: (o) => createBaths(o as BathsOptions),
  nymphaeum: (o) => createNymphaeum(o as NymphaeumOptions),
  necropolis: (o) => createNecropolis(o as NecropolisOptions),
  wall: (o: BuilderInput = {}) => {
    const wo = o as WallOptions & { points?: Array<[number, number]> };
    return createWall(wo.points ?? [[-60, 0], [60, 0]], wo);
  },
  latrine: (o) => createLatrine(o as LatrineOptions),
  church: (o) => createChurch(o as ChurchOptions),
};
