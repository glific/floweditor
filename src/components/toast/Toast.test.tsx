import { Toast } from 'components/toast/Toast';
import React from 'react';
import { render } from 'test/utils';

describe(Toast.name, () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('renders the message', () => {
    const { getByText } = render(
      <Toast message="Node copied. Ctrl+V to paste." duration={5000} onDismiss={jest.fn()} />
    );
    expect(getByText('Node copied. Ctrl+V to paste.')).toBeTruthy();
  });

  it('calls onDismiss after duration ms', () => {
    const onDismiss = jest.fn();
    render(<Toast message="Copied!" duration={5000} onDismiss={onDismiss} />);

    expect(onDismiss).not.toHaveBeenCalled();
    jest.advanceTimersByTime(5000);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('calls onDismiss when clicked', () => {
    const onDismiss = jest.fn();
    const { getByText } = render(<Toast message="Copied!" duration={5000} onDismiss={onDismiss} />);
    getByText('Copied!').click();
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('uses 3000ms default when duration is not provided', () => {
    const onDismiss = jest.fn();
    render(<Toast message="Copied!" onDismiss={onDismiss} />);

    jest.advanceTimersByTime(2999);
    expect(onDismiss).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
