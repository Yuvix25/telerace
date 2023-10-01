const NA = 'N/A';

export function filterInPlace(
  array: any[],
  fn: (index: number, value: any) => boolean = (value) => Boolean(value),
) {
  let from = 0,
    to = 0;
  while (from < array.length) {
    if (fn(from, array[from])) {
      array[to] = array[from];
      to++;
    }
    from++;
  }
  array.length = to;
}

/**
 * @param duration - Duration in seconds
 * @param format - Format to use
 * @returns
 */
export function formatDuration(
  duration: number | null | undefined,
  format: string = 'mm:ss.SSS',
) {
  if (duration === null || duration === undefined) {
    return NA;
  }

  let hours = Math.floor(duration / 3600);
  let minutes = Math.floor((duration - hours * 3600) / 60);
  let seconds = Math.floor(duration - hours * 3600 - minutes * 60);
  let milliseconds = Math.floor(
    (duration - hours * 3600 - minutes * 60 - seconds) * 1000,
  );

  if (format.includes('hh')) {
    format = format.replace('hh', hours.toString().padStart(2, '0'));
  } else {
    minutes += hours * 60;
  }
  if (format.includes('mm')) {
    format = format.replace('mm', minutes.toString().padStart(2, '0'));
  } else {
    seconds += minutes * 60;
  }
  if (format.includes('ss')) {
    format = format.replace('ss', seconds.toString().padStart(2, '0'));
  } else {
    milliseconds += seconds * 1000;
  }
  if (format.includes('SSS')) {
    format = format.replace('SSS', milliseconds.toString().padStart(3, '0'));
  }

  // remove leading zeros
  format = format.replace(/^[0:]*/, '');
  return format;
}
