import * as React from 'react';
import styles from './Toast.module.scss';

export interface ToastProps {
  message: string;
  duration: number;
  onDismiss: () => void;
}

const Toast: React.FC<ToastProps> = ({ message, duration, onDismiss }) => {
  React.useEffect(() => {
    const timer = window.setTimeout(onDismiss, duration);
    return () => window.clearTimeout(timer);
  }, [message, duration, onDismiss]);

  return <div className={styles.toast}>{message}</div>;
};

export default Toast;
