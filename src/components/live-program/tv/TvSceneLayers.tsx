// Maps an Alcantara scene onto the TV graphics components. The componentType
// names and the metadata each case reads are Alcantara's own (its program
// page's scene renderer, gaulatti/alcantara frontend/app/routes/program.tsx at
// b0e8f009, :2294-2295, :2361-2362 and :2585-2590; the Giorgia clock and chyron
// at b4a51c7, :2460-2491), so a scene built in Alcantara's editor draws the same
// component here.
import React from 'react';
import { CronicaBackground } from './CronicaBackground.js';
import { CronicaChyron } from './CronicaChyron.js';
import { CronicaReiteramos } from './CronicaReiteramos.js';
import {
  GiorgiaProgramRow,
  MODOITALIANO_GIORGIA_CHYRON,
  MODOITALIANO_GIORGIA_CLOCK,
  giorgiaClockCommonProps,
  resolveGiorgiaProgramRow,
  toBoolean,
  type GiorgiaProgramContext
} from './giorgiaProgramRow.js';
import { LogoWidget } from './LogoWidget.js';
import RelojLoopClock from './RelojLoopClock.js';
import { ModoItalianoGiorgiaChyron } from './ModoItalianoGiorgiaChyron.js';
import { ModoItalianoGiorgiaClock } from './ModoItalianoGiorgiaClock.js';

export const LOGO_WIDGET = 'logo-widget';
export const RELOJ_LOOP_CLOCK = 'reloj-loop-clock';
export const CRONICA_BACKGROUND = 'cronica-background';
export const CRONICA_CHYRON = 'cronica-chyron';
export const CRONICA_REITERAMOS = 'cronica-reiteramos';
export { MODOITALIANO_GIORGIA_CHYRON, MODOITALIANO_GIORGIA_CLOCK };

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

/** A string metadata value, or undefined so the component's own default applies. */
function optionalText(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

/** Each TV scene type and the component Alcantara draws for it, with the metadata it reads. */
const TV_RENDERERS: Record<string, (props: Record<string, unknown>, context: GiorgiaProgramContext) => React.ReactNode> = {
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
  // Alcantara (b4a51c7, :2460-2479): the whole clock, header top-left and on-air block bottom-left.
  [MODOITALIANO_GIORGIA_CLOCK]: (props, context) => (
    <ModoItalianoGiorgiaClock
      key={MODOITALIANO_GIORGIA_CLOCK}
      {...giorgiaClockCommonProps(props, context)}
      keySafe={toBoolean(props.keySafe, false)}
    />
  ),
  // Alcantara (b4a51c7, :2481-2491): show is read only when it is a boolean.
  [MODOITALIANO_GIORGIA_CHYRON]: (props) => (
    <ModoItalianoGiorgiaChyron
      key={MODOITALIANO_GIORGIA_CHYRON}
      show={typeof props.show === 'boolean' ? props.show : true}
      textSequence={props.textSequence}
      ctaSequence={props.ctaSequence}
      keySafe={toBoolean(props.keySafe, false)}
    />
  ),
};

export const TV_COMPONENT_TYPES: readonly string[] = Object.keys(TV_RENDERERS);

export function isTvComponentType(componentType: string): boolean {
  return TV_COMPONENT_TYPES.includes(componentType);
}

export interface TvSceneLayersProps {
  componentTypes: string[];
  metadata: Record<string, unknown>;
  /** The program's bus key, time override and song sequence, for the Giorgia clock. */
  context: GiorgiaProgramContext;
}

/**
 * Draws the TV graphics the scene asks for, in the scene's order, inside one
 * full-frame box with no z-index, as Alcantara's scene container does
 * (program.tsx:2251): each component's own z-index then stacks against the
 * page's other layers, and an unpositioned component is not hidden by the
 * stage's black filler. A scene that lists both Giorgia types draws them in
 * the bottom row instead, after the other graphics (b4a51c7, :2206, :2461,
 * :2482, :2623). Nothing is drawn when the scene lists no TV type.
 */
export function TvSceneLayers({ componentTypes, metadata, context }: TvSceneLayersProps) {
  const tvTypes = componentTypes.filter(isTvComponentType);
  if (tvTypes.length === 0) {
    return null;
  }
  const row = resolveGiorgiaProgramRow(componentTypes);
  return (
    <div className='absolute inset-0'>
      {tvTypes
        .filter((componentType) => !row?.ownedTypes.has(componentType))
        .map((componentType) => TV_RENDERERS[componentType](record(metadata[componentType]), context))}
      {row && (
        <GiorgiaProgramRow
          clockProps={record(metadata[MODOITALIANO_GIORGIA_CLOCK])}
          chyronProps={record(metadata[MODOITALIANO_GIORGIA_CHYRON])}
          context={context}
        />
      )}
    </div>
  );
}
