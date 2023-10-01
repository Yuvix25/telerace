import React, { useEffect, useMemo } from 'react';
import TelemetrySession from './TelemetrySession';
import { formatDuration } from './utils';
import style from './scss/app.scss';
import { Scatter } from 'react-chartjs-2';
import {
  Chart,
  ChartData,
  ChartEvent,
  ChartOptions,
  Interaction,
  registerables,
} from 'chart.js';
import zoomPlugin from 'chartjs-plugin-zoom';
import Lap, { REQUIRED_CHANNELS } from './Lap';
import Tabs from './components/Tabs';
import { Restore } from '@mui/icons-material';
import ToggleList from './components/ToggleList';
Chart.register(...registerables, zoomPlugin);

function asRadians(degrees: number) {
  return (degrees * Math.PI) / 180;
}
function geoToMeters(
  relativeNullPoint: { latitude: number; longitude: number },
  p: { latitude: number; longitude: number },
) {
  const deltaLatitude = p.latitude - relativeNullPoint.latitude;
  const deltaLongitude = p.longitude - relativeNullPoint.longitude;
  const latitudeCircumference =
    40075160 * Math.cos(asRadians(relativeNullPoint.latitude));
  const resultX = (deltaLongitude * latitudeCircumference) / 360;
  const resultY = (deltaLatitude * 40008000) / 360;
  return { x: resultX, y: resultY };
}

const App = () => {
  const [session, setSession] = React.useState<TelemetrySession>();
  const [lapsChecked, setLapsChecked] = React.useState<number[]>([]);
  const [channelsChecked, setChannelsChecked] = React.useState<Set<string>>(
    new Set<string>(['GPS Speed']),
  );

  // these two need to be separate because otherwise both graphs get updated, which fires the interaction callback again, resulting in an infinite loop
  const [graphPointRadiuses, setGraphPointRadiuses] = React.useState<
    Record<number, number>
  >({});
  const [mapPointRadiuses, setMapPointRadiuses] = React.useState<
    Record<number, number>
  >({});

  const graphRef = React.useRef<Chart<'scatter'>>(null);
  const mapRef = React.useRef<Chart<'scatter'>>(null);

  const combinations = useMemo(() => {
    const combinations: { lap: Lap; channel: string }[] = [];
    for (const lap of lapsChecked) {
      for (const channel of channelsChecked) {
        combinations.push({
          lap: session!.laps[lap],
          channel,
        });
      }
    }
    return combinations;
  }, [lapsChecked, channelsChecked, session]);

  const mapData = useMemo<ChartData<'scatter'>>(
    () => ({
      datasets: lapsChecked.map((lapIndex, i) => {
        const lap = session!.laps[lapIndex];
        const data = lap.data.map((d) => {
          const res: any = geoToMeters(
            {
              latitude: 31.26817192,
              longitude: 34.72764003,
            },
            {
              latitude: d[REQUIRED_CHANNELS.Latitude],
              longitude: d[REQUIRED_CHANNELS.Longitude],
            },
          );
          res.Distance = d.Distance;
          return res;
        });
        return {
          label: `${formatDuration(lap.laptime)}`,
          data: data,
          fill: true,
          showLine: true,
          pointRadius: data.map((d) => mapPointRadiuses[d.Distance] ?? 0),
          pointHoverRadius: 5,
          pointHitRadius: 5,
          pointBackgroundColor: `hsl(${
            (i * 360) / lapsChecked.length
          }, 100%, 50%)`,
          borderColor: `hsl(${(i * 360) / lapsChecked.length}, 100%, 50%)`,
        };
      }),
    }),
    [lapsChecked, mapPointRadiuses, session],
  );

  const graphData = useMemo<ChartData<'scatter'>>(
    () => ({
      datasets: combinations.map(({ lap, channel }, i) => {
        const data = lap.data.map((d) => {
          return {
            x: d.Distance,
            y: d[channel],
            Distance: d.Distance,
          };
        });
        return {
          label: `${formatDuration(lap.laptime)} - ${channel}`,
          yAxisID: channel,
          data: data,
          fill: true,
          showLine: true,
          pointRadius: data.map((d) => graphPointRadiuses[d.x] ?? 0),
          pointHitRadius: 3,
          borderColor: `hsl(${(i * 360) / combinations.length}, 100%, 50%)`,
          pointBackgroundColor: `hsl(${
            (i * 360) / combinations.length
          }, 100%, 50%)`,
        };
      }),
    }),
    [combinations, graphPointRadiuses],
  );

  const originalXInteraction = useMemo(() => Interaction.modes.x, []);
  const originalNearestInteraction = useMemo(
    () => Interaction.modes.nearest,
    [],
  );
  useEffect(() => {
    const interactionProxy = (
      originalInteraction: any,
      setState: (pointRadiuses: Record<number, number>) => void,
      clearState: () => void,
    ) => {
      return (
        chart: Chart,
        e: ChartEvent,
        options: any,
        useFinalPosition?: boolean,
      ) => {
        const res = originalInteraction(chart, e, options, useFinalPosition);
        if (res == null || res.length === 0) {
          return [];
        }
        const distance = (
          chart.data.datasets[res[0].datasetIndex].data[res[0].index] as any
        )?.Distance;
        setState({ [distance]: 5 });
        clearState();
        return [res[0]];
      };
    };

    Interaction.modes.x = interactionProxy(
      originalXInteraction,
      setMapPointRadiuses,
      () => {
        if (Object.keys(graphPointRadiuses).length === 0) {
          return;
        }
        setGraphPointRadiuses({});
      },
    );
    Interaction.modes.nearest = interactionProxy(
      originalNearestInteraction,
      setGraphPointRadiuses,
      () => {
        if (Object.keys(mapPointRadiuses).length === 0) {
          return;
        }
        setMapPointRadiuses({});
      },
    );
  }, [graphPointRadiuses, mapPointRadiuses]);

  const graphOptions = useMemo<ChartOptions<'scatter'>>(
    () => ({
      maintainAspectRatio: false,
      interaction: {
        mode: 'x',
        intersect: false,
      },
      animation: false,
      scales: {
        x: {
          type: 'linear',
          position: 'bottom',
          ticks: {
            callback: (value: any) => {
              return `${value}m`;
            },
          },
        },
        y: {
          display: false,
        },
      },
      plugins: {
        // @ts-ignore
        zoom: {
          pan: {
            enabled: true,
          },
          zoom: {
            wheel: {
              enabled: true,
            },
            pinch: {
              enabled: true,
            },
          },
        },
        tooltip: {
          callbacks: {
            label: (context) => {
              return `${context.dataset.label}: ${context.parsed.y}`;
            },
          },
        },
      },
    }),
    [],
  );

  const mapOptions = useMemo<ChartOptions<'scatter'>>(
    () => ({
      hover: {
        mode: 'nearest',
        axis: 'xy',
        intersect: false,
      },
      maintainAspectRatio: true,
      aspectRatio: 1,
      animation: false,
      scales: {
        x: {
          display: false,
        },
        y: {
          display: false,
        },
      },
      plugins: {
        tooltip: {
          enabled: false,
        },
        zoom: {
          pan: {
            enabled: true,
          },
          zoom: {
            wheel: {
              enabled: true,
            },
            pinch: {
              enabled: true,
            },
          },
        },
      },
    }),
    [],
  );

  return (
    <div className={style.col} style={{ height: '100%', width: '100%' }}>
      <br />
      <input
        className={style.fileInput}
        type="file"
        onChange={(e) => {
          const file = e.target.files![0];
          const reader = new FileReader();
          reader.onload = (e) => {
            const data = e.target!.result;
            const session = new TelemetrySession(data as string);
            console.log(session);
            setSession(session);
            setLapsChecked([]);
          };
          reader.readAsText(file);
        }}
      />

      {session && (
        <div className={style.col} style={{ width: '100%', height: '100%' }}>
          <div style={{ flexShrink: 0 }}>
            <h2
              id={style.sessionInfoLabel}
              onClick={(e) => {
                const sessionInfo = (e.target as HTMLElement)
                  .nextElementSibling;
                if (sessionInfo) {
                  sessionInfo.classList.toggle(style.collapsed);
                  if (sessionInfo.classList.contains(style.collapsed)) {
                    (e.target as HTMLElement).innerText = '► Session Info';
                  } else {
                    (e.target as HTMLElement).innerText = '▼ Session Info';
                  }
                }
              }}
            >
              ▼ Session Info
            </h2>
            <div id={style.sessionInfo}>
              <p>Track: {session.headers.Track}</p>
              <p>Car: {session.headers.Vehicle}</p>
              <p>Driver: {session.headers.Racer}</p>
              <p>Session Date: {session.headers.Date}</p>
              <p>Session Time: {session.headers.Time}</p>
              <p>
                Session Duration:{' '}
                {formatDuration(session.headers.Duration, 'mm:ss')}
              </p>
            </div>
          </div>

          <div id={style.sessionDataContainer}>
            <h2>Session Data</h2>
            <div id={style.sessionData}>
              <div
                style={{
                  height: '100%',
                  width: '20%',
                  maxWidth: '250px',
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                <Tabs
                  tabs={['Laps', 'Channels']}
                  for={[style.lapChooser, style.channelChooser]}
                ></Tabs>
                <div style={{ overflowY: 'auto', height: '100%' }}>
                  <ToggleList
                    id={style.lapChooser}
                    list={session.laps.map((lap, i) => [
                      (i + 1).toString(),
                      formatDuration(lap.laptime, 'mm:ss.SSS'),
                    ])}
                    setChecked={(checked) => {
                      const newLapsChecked: number[] = [];
                      for (const lap of checked) {
                        newLapsChecked.push(parseInt(lap) - 1);
                      }
                      setLapsChecked(newLapsChecked);
                    }}
                  />
                  <ToggleList
                    id={style.channelChooser}
                    list={session.channels.map((channel) => [channel])}
                    default={channelsChecked}
                    setChecked={setChannelsChecked}
                  />
                </div>
              </div>
              <div id={style.lapData}>
                <Scatter
                  data={graphData}
                  options={graphOptions}
                  ref={graphRef}
                />
              </div>
              <div
                onClick={() => {
                  graphRef.current?.resetZoom();
                }}
                title="Reset zoom and pan"
              >
                <Restore
                  style={{
                    margin: '10px',
                    fontSize: '35px',
                    cursor: 'pointer',
                  }}
                />
              </div>
            </div>
          </div>

          <div
            style={{
              minHeight: '400px',
              flexGrow: 3,
              width: '100%',
              height: '100%',
            }}
          >
            <Scatter
              data={mapData}
              options={mapOptions}
              style={{ minHeight: 0, width: '100%', height: '100%' }}
              ref={mapRef}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
