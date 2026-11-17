// Maps an Alcantara scene onto the TV graphics components. The componentType
// names and the metadata each case reads are Alcantara's own (its program
// page's scene renderer, gaulatti/alcantara frontend/app/routes/program.tsx at
// b0e8f009, :2294-2295, :2361-2362 and :2585-2590), so a scene built in Alcantara's editor
// draws the same component here.
import React from 'react';
import { CronicaBackground } from './CronicaBackground.js';
import { CronicaChyron } from './CronicaChyron.js';
import { CronicaReiteramos } from './CronicaReiteramos.js';
import { LogoWidget } from './LogoWidget.js';
import RelojLoopClock from './RelojLoopClock.js';

export const LOGO_WIDGET = 'logo-widget';
export const RELOJ_LOOP_CLOCK = 'reloj-loop-clock';
export const CRONICA_BACKGROUND = 'cronica-background';
export const CRONICA_CHYRON = 'cronica-chyron';
export const CRONICA_REITERAMOS = 'cronica-reiteramos';

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

/** A string metadata value, or undefined so the component's own default applies. */
function optionalText(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

/** Each TV scene type and the component Alcantara draws for it, with the metadata it reads. */
const TV_RENDERERS: Record<string, (props: Record<string, unknown>) => React.ReactNode> = {
  // Alcantara: logoUrl={props.logoUrl} position={props.position} (program.tsx:2294-2295). Without a
  // logoUrl the Giorgia LogoWidget draws nothing (#48: the ModoRadio bugs are retired).
  [LOGO_WIDGET]: (props) => (
    <LogoWidget
      key={LOGO_WIDGET}
      logoUrl={optionalText(props.logoUrl)}
      position={props.position === 'top-right' || props.position === 'bottom-right' ? props.position : undefined}
    />
  ),
  // Alcantara: timezone={props.timezone || 'Europe/Madrid'} (program.tsx:2361-2362).
  [RELOJ_LOOP_CLOCK]: (props) => <RelojLoopClock key={RELOJ_LOOP_CLOCK} timezone={optionalText(props.timezone) || 'Europe/Madrid'} />,
  [CRONICA_BACKGROUND]: () => <CronicaBackground key={CRONICA_BACKGROUND} />,
  [CRONICA_CHYRON]: (props) => <CronicaChyron key={CRONICA_CHYRON} text={optionalText(props.text)} />,
  [CRONICA_REITERAMOS]: (props) => (
    <CronicaReiteramos key={CRONICA_REITERAMOS} text={optionalText(props.text)} show={typeof props.show === 'boolean' ? props.show : undefined} />
  ),
};

export const TV_COMPONENT_TYPES: readonly string[] = Object.keys(TV_RENDERERS);

export function isTvComponentType(componentType: string): boolean {
  return TV_COMPONENT_TYPES.includes(componentType);
}

export interface TvSceneLayersProps {
  componentTypes: string[];
  metadata: Record<string, unknown>;
}

/**
 * Draws the TV graphics the scene asks for, in the scene's order, inside one
 * full-frame box with no z-index, as Alcantara's scene container does
 * (program.tsx:2251): each component's own z-index then stacks against the
 * page's other layers, and an unpositioned component is not hidden by the
 * stage's black filler. Nothing is drawn when the scene lists no TV type.
 */
export function TvSceneLayers({ componentTypes, metadata }: TvSceneLayersProps) {
  const tvTypes = componentTypes.filter(isTvComponentType);
  if (tvTypes.length === 0) {
    return null;
  }
  return <div className='absolute inset-0'>{tvTypes.map((componentType) => TV_RENDERERS[componentType](record(metadata[componentType])))}</div>;
}
