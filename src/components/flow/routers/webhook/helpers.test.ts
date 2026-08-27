import {
  isWaitTimeWithinCap,
  WAIT_TIME_CAP_SECONDS
} from 'components/flow/routers/webhook/helpers';

const failuresFor = (body: string) => isWaitTimeWithinCap()('POST body', body).failures;
const messageFor = (body: string) => failuresFor(body)[0].message;

describe('isWaitTimeWithinCap', () => {
  it('accepts a wait_time inside the cap', () => {
    expect(failuresFor('{"speech": "", "wait_time": 240}')).toEqual([]);
    expect(failuresFor('{"wait_time": "240"}')).toEqual([]);
    expect(failuresFor(`{"wait_time": ${WAIT_TIME_CAP_SECONDS}}`)).toEqual([]);
  });

  it('accepts a body that says nothing about wait_time', () => {
    expect(failuresFor('{"speech": "@results.audio"}')).toEqual([]);
  });

  it('accepts the blank wait_time the body template ships', () => {
    expect(failuresFor('{"speech": "", "wait_time": ""}')).toEqual([]);
    expect(failuresFor('{"wait_time": "   "}')).toEqual([]);
    expect(failuresFor('{"wait_time": null}')).toEqual([]);
  });

  it('rejects a wait_time over the cap', () => {
    expect(messageFor('{"wait_time": 600}')).toContain('cannot be more than 300 seconds');
    expect(messageFor(`{"wait_time": ${WAIT_TIME_CAP_SECONDS + 1}}`)).toContain('5 minutes');
  });

  it('rejects a wait_time that is not a positive whole number', () => {
    ['0', '-30', '"abc"', '"60s"', '12.5'].forEach(value => {
      expect(messageFor(`{"wait_time": ${value}}`)).toContain('whole number');
    });
  });

  it('rejects a non-scalar wait_time', () => {
    ['{}', '[]', 'true'].forEach(value => {
      expect(failuresFor(`{"wait_time": ${value}}`).length).toBe(1);
    });
  });

  it('stays quiet on an undecodable body, which isValidJson already reports', () => {
    expect(failuresFor('not json at all')).toEqual([]);
    expect(failuresFor('')).toEqual([]);
  });

  it('stays quiet on json that is not an object', () => {
    expect(failuresFor('[1, 2]')).toEqual([]);
    expect(failuresFor('"a string"')).toEqual([]);
  });

  it('always returns the body unchanged as the entry value', () => {
    const body = '{"wait_time": 600}';
    expect(isWaitTimeWithinCap()('POST body', body).value).toBe(body);
  });
});
