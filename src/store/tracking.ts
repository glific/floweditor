type TrackFn = (event: string, properties: Record<string, any>) => void;

const noop: TrackFn = () => {};

let _track: TrackFn = noop;

export const initTracking = (fn: TrackFn | undefined): void => {
  _track = fn || noop;
};

export const track = (event: string, properties: Record<string, any>): void =>
  _track(event, properties);
