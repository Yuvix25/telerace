import { CsvData } from './CsvParse';
import { filterInPlace } from './utils';

export enum REQUIRED_CHANNELS {
  Time = 'Time',
  Latitude = 'GPS Latitude',
  Longitude = 'GPS Longitude',
}
export enum AUTO_GENERATED_CHANNELS {
  Distance = 'Distance',
  Speed = 'GPS Speed',
}

export default class Lap {
  private static readonly DISTANCE_THRESHOLD = 3; // metres (used when calculating distances)

  public readonly lapNumber: number;
  public readonly data: Record<string, number>[];
  public readonly laptime: number;
  private isReference = false;

  constructor(
    lapNumber: number,
    data: Record<string, number>[],
    laptime: number,
  ) {
    this.lapNumber = lapNumber;
    this.data = data;
    this.laptime = laptime;
  }

  public get isReferenceLap(): boolean {
    return this.isReference;
  }

  public setAsReference(): this {
    this.isReference = true;
    return this;
  }

  public static parse(
    data: CsvData,
    lapTimestamps: number[],
    referenceLap?: Lap,
  ): { laps: Lap[]; channels: string[] } {
    // line 1 is the channels, line 2 are units, line 3 is null and then the data starts
    const laps: Lap[] = [];

    const channels = data[0] as string[];
    Lap.verifyChannels(channels);

    // split data by lapTimestamps
    const lapData: Record<string, number>[][] = [];
    let currentLapData: Record<string, number>[] = [];
    let currentLap = 0;
    for (let i = 3; i < data.length; i++) {
      const line = data[i];
      if (line === null) {
        continue;
      }

      const time = line[channels.indexOf(REQUIRED_CHANNELS.Time)] as number;
      if (time >= lapTimestamps[currentLap]) {
        lapData.push(currentLapData);
        currentLapData = [];
        currentLap++;
      }

      const entry: Record<string, number> = {};
      for (const channel of channels) {
        entry[channel] = line[channels.indexOf(channel)] as number;
        if (channel == REQUIRED_CHANNELS.Time) {
          entry[channel] -= lapTimestamps[currentLap - 1] ?? 0;
        }
      }
      currentLapData.push(entry);
    }
    lapData.push(currentLapData);

    for (let i = 0; i < lapData.length; i++) {
      let end = lapTimestamps[i + 1];
      if (i === lapData.length - 1) {
        const last = lapData[i][lapData[i].length - 1];
        end = last[REQUIRED_CHANNELS.Time];
      }
      if (end > lapTimestamps[i]) {
        laps.push(new Lap(i, lapData[i], end - lapTimestamps[i]));
      }
    }

    if (!channels.includes(AUTO_GENERATED_CHANNELS.Distance)) {
      Lap.calculateDistances(laps, referenceLap);
    }
    if (!channels.includes(AUTO_GENERATED_CHANNELS.Speed)) {
      Lap.calculateSpeeds(laps);
    }

    return { laps, channels };
  }

  private static calculateDistances(laps: Lap[], referenceLap?: Lap): void {
    if (!referenceLap) {
      referenceLap = Lap.getBestLap(laps).setAsReference();
    }

    referenceLap.calculateDistancesAsReference();

    const toRemove: number[] = [];
    for (let i = 0; i < laps.length; i++) {
      if (laps[i].isReferenceLap) {
        continue;
      }
      try {
        laps[i].calculateDistances(referenceLap);
      } catch (e) {
        console.error(e);
        toRemove.push(i);
      }
    }

    filterInPlace(laps, (index, value) => !toRemove.includes(index));
  }

  private calculateDistancesAsReference(): void {
    this.data[0][AUTO_GENERATED_CHANNELS.Distance] = 0;

    let distance = 0;
    for (let i = 1; i < this.data.length; i++) {
      distance += Lap.geoDistance(
        this.data[i - 1][REQUIRED_CHANNELS.Latitude],
        this.data[i - 1][REQUIRED_CHANNELS.Longitude],
        this.data[i][REQUIRED_CHANNELS.Latitude],
        this.data[i][REQUIRED_CHANNELS.Longitude],
      );
      this.data[i][AUTO_GENERATED_CHANNELS.Distance] = distance;
    }
  }

  private calculateDistances(referenceLap: Lap): void {
    let distance = 0;
    for (const entry of this.data) {
      const closestIndex = referenceLap.getClosestIndex(
        entry[REQUIRED_CHANNELS.Latitude],
        entry[REQUIRED_CHANNELS.Longitude],
        distance,
      );
      distance = entry[AUTO_GENERATED_CHANNELS.Distance] =
        referenceLap.data[closestIndex][AUTO_GENERATED_CHANNELS.Distance];
    }
  }

  private static calculateSpeeds(laps: Lap[]): void {
    for (const lap of laps) {
      lap.calculateSpeeds();
    }
  }

  private calculateSpeeds(): void {
    for (let i = 1; i < this.data.length; i++) {
      const timeDifference =
        this.data[i][REQUIRED_CHANNELS.Time] -
        this.data[i - 1][REQUIRED_CHANNELS.Time];
      const distanceDifference = Lap.geoDistance(
        this.data[i - 1][REQUIRED_CHANNELS.Latitude],
        this.data[i - 1][REQUIRED_CHANNELS.Longitude],
        this.data[i][REQUIRED_CHANNELS.Latitude],
        this.data[i][REQUIRED_CHANNELS.Longitude],
      );
      this.data[i][AUTO_GENERATED_CHANNELS.Speed] =
        (distanceDifference / timeDifference) * 3.6;
    }

    if (this.data.length > 0) {
      this.data[0][AUTO_GENERATED_CHANNELS.Speed] =
        this.data[1][AUTO_GENERATED_CHANNELS.Speed];
    }
  }

  private getClosestIndex(
    latitude: number,
    longitude: number,
    distance: number,
  ): number {
    let closestIndex = -1;
    let closestDistance = Number.MAX_SAFE_INTEGER;
    for (let i = 0; i < this.data.length; i++) {
      const currentDistance = Lap.geoDistance(
        latitude,
        longitude,
        this.data[i][REQUIRED_CHANNELS.Latitude],
        this.data[i][REQUIRED_CHANNELS.Longitude],
      );

      if (
        currentDistance < closestDistance &&
        Math.abs(this.data[i][AUTO_GENERATED_CHANNELS.Distance] - distance) <
          Lap.DISTANCE_THRESHOLD
      ) {
        closestIndex = i;
        closestDistance = currentDistance;
      }
    }

    if (closestIndex === -1) {
      throw new Error('No closest index found');
    }
    return closestIndex;
  }

  private static getBestLap(laps: Lap[]): Lap {
    let bestLap: Lap | undefined;
    let bestLaptime = Number.MAX_SAFE_INTEGER;
    for (let i = 1; i < laps.length - 1; i++) {
      const lap = laps[i];
      if (lap.laptime < bestLaptime) {
        bestLap = lap;
        bestLaptime = lap.laptime;
      }
    }
    if (!bestLap) {
      throw new Error('No best lap found');
    }
    return bestLap;
  }

  public static geoDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ): number {
    const R = 6371e3; // metres
    const φ1 = (lat1 * Math.PI) / 180; // φ, λ in radians
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // in metres
  }

  private static verifyChannels(channels: string[]): void {
    for (const requiredChannel of Object.values(REQUIRED_CHANNELS)) {
      if (!channels.includes(requiredChannel)) {
        throw new Error(`Missing required channel: ${requiredChannel}`);
      }
    }
  }
}

(window as any).distance = Lap.geoDistance;
