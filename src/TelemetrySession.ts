import CsvParser, { CsvData } from './CsvParse';
import Lap from './Lap';

enum SUPPORTED_FORMATS {
  AiM_CSV_File = 'AiM CSV File',
}

type Headers = {
  Vehicle?: string;
  Racer?: string;
  Track?: string;
  Date?: string;
  Time?: string;
  Duration?: number;
  LapTimestamps?: number[];
};

export default class TelemetrySession {
  private readonly _headers: Headers = {};
  private _laps: Lap[] = [];
  private _channels: string[] = [];

  get headers(): Headers {
    return { ...this._headers };
  }
  get laps(): Lap[] {
    return [...this._laps];
  }
  get channels(): string[] {
    return [...this._channels];
  }

  /**
   * @param data - CSV data
   * @param referenceLap - Reference lap to compare against, if not specified, will use the best available lap
   */
  constructor(data: string, referenceLap?: Lap) {
    const parsedData = CsvParser.parse(data);

    const format = TelemetrySession.getFormat(parsedData);
    switch (format) {
      case SUPPORTED_FORMATS.AiM_CSV_File:
        this.parseAiMCSVFile(parsedData, referenceLap);
        break;
    }
  }

  private parseAiMCSVFile(data: CsvData, referenceLap?: Lap): void {
    for (let i = 0; i < data.length; i++) {
      const line = data[i];
      if (line === null) {
        if (this._headers.LapTimestamps === undefined) {
          throw new Error('Missing lap timestamps');
        }
        const { laps, channels } = Lap.parse(
          data.slice(i + 1),
          this._headers.LapTimestamps,
          referenceLap,
        );
        this._laps = laps;
        this._channels = channels;
        break;
      }

      switch (line[0]) {
        case 'Vehicle':
          this._headers.Vehicle = line[1] as string;
          break;
        case 'Racer':
          this._headers.Racer = line[1] as string;
          break;
        case 'Session':
          this._headers.Track = line[1] as string;
          break;
        case 'Date':
          this._headers.Date = line[1] as string;
          break;
        case 'Time':
          this._headers.Time = line[1] as string;
          break;
        case 'Duration':
          this._headers.Duration = line[1] as number;
          break;
        case 'Beacon Markers':
          this._headers.LapTimestamps = line
            .slice(1)
            .map((value) => value as number);
          break;
      }
    }
  }

  private static getFormat(data: CsvData): string {
    if (data[0]?.[0] === 'Format') {
      return data[0][1] as string;
    }
    throw new Error('Invalid data format');
  }
}
