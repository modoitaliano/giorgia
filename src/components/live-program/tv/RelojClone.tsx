import { useEffect, useRef } from 'react';
import './RelojClone.css';
import type { GlobalTimeOverride } from './broadcastTime.js';
import { getOverrideClockParts } from './broadcastTime.js';

interface RelojCloneProps {
  timezone?: string;
  timeOverride?: GlobalTimeOverride | null;
}

export default function RelojClone({
  timezone = 'America/Argentina/Buenos_Aires',
  timeOverride = null,
}: RelojCloneProps) {
  const hourHandRef = useRef<HTMLDivElement | null>(null);
  const minuteHandRef = useRef<HTMLDivElement | null>(null);
  const secondHandRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const getClockTimeParts = (date: Date, timeZone: string) => {
      try {
        const parts = new Intl.DateTimeFormat('en-US', {
          hour12: false,
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          timeZone,
        }).formatToParts(date);

        const values = Object.fromEntries(
          parts.map((part) => [part.type, part.value]),
        );

        // formatToParts always returns the hour, minute and second asked for.
        return {
          hours: Number(values.hour),
          minutes: Number(values.minute),
          seconds: Number(values.second),
        };
      } catch {
        return {
          hours: date.getHours(),
          minutes: date.getMinutes(),
          seconds: date.getSeconds(),
        };
      }
    };

    const setDate = () => {
      const now = new Date();
      const overrideParts = timeOverride
        ? getOverrideClockParts(timeOverride, now)
        : null;
      const { hours, minutes, seconds } =
        overrideParts ?? getClockTimeParts(now, timezone);

      const secondsDegrees = (seconds / 60) * 360 + 90;
      // The hands are mounted for as long as this effect runs.
      secondHandRef.current!.style.transform = `rotate(${secondsDegrees}deg)`;

      const minutesDegrees = (minutes / 60) * 360 + (seconds / 60) * 6 + 90;
      minuteHandRef.current!.style.transform = `rotate(${minutesDegrees}deg)`;

      const hoursDegrees = (hours / 12) * 360 + (minutes / 60) * 30 + 90;
      hourHandRef.current!.style.transform = `rotate(${hoursDegrees}deg)`;
    };

    const intervalId = window.setInterval(setDate, 1000);
    setDate();

    return () => {
      window.clearInterval(intervalId);
    };
  }, [timezone, timeOverride?.startTime, timeOverride?.startedAt]);

  return (
    <div className='reloj-clone-root'>
      <div className='clockwrapper'>
        <div className='clock'>
          <div className='clock-face'>
            <div className='number number3'>3</div>
            <div className='number number6'>6</div>
            <div className='number number9'>9</div>
            <div className='number number12'>12</div>
            <div ref={hourHandRef} className='hand hour-hand'></div>
            <div ref={minuteHandRef} className='hand minute-hand'></div>
            <div ref={secondHandRef} className='hand second-hand'></div>
          </div>
        </div>
        <img style={{ width: '640px' }} src='/reloj-modoradio_full_negro.svg' alt='Modo Radio' />
      </div>
    </div>
  );
}
