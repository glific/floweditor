import * as React from 'react';

import styles from './Toast.module.scss';

export interface ToastProps {
  message: string;
  duration?: number;
  onDismiss: () => void;
}

export class Toast extends React.PureComponent<ToastProps> {
  private timer: number;

  public componentDidMount(): void {
    this.timer = window.setTimeout(this.props.onDismiss, this.props.duration || 3000);
  }

  public componentWillUnmount(): void {
    window.clearTimeout(this.timer);
  }

  public render(): JSX.Element {
    return (
      <div className={styles.toast} onClick={this.props.onDismiss}>
        {this.props.message}
      </div>
    );
  }
}

export default Toast;
