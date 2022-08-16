import { react as bindCallbacks } from 'auto-bind';
import CheckboxElement from 'components/form/checkbox/CheckboxElement';
import * as React from 'react';
import { renderIf } from 'utils';

import styles from './DelayControl.module.scss';
import i18n from 'config/i18n';
import TembaSelect, { TembaSelectStyle } from 'temba/TembaSelect';
import { SelectOption } from '../select/SelectElement';

export const DELAY_OPTIONS: SelectOption[] = [
  { value: '2', name: i18n.t('forms.timeout_2 second', '2 second') },
  { value: '4', name: i18n.t('forms.timeout_4 seconds', '4 seconds') },
  { value: '6', name: i18n.t('forms.timeout_6 seconds', '6 seconds') },
  { value: '8', name: i18n.t('forms.timeout_8 seconds', '8 seconds') },
  { value: '10', name: i18n.t('forms.timeout_10 seconds', '10 seconds') },
  { value: '15', name: i18n.t('forms.timeout_15 seconds', '15 seconds') },
  { value: '20', name: i18n.t('forms.timeout_20 seconds', '20 seconds') }
];

export const DEFAULT_TIMEOUT = DELAY_OPTIONS[4];

export const ellipsize = (str: string) => `${str}...`;

export interface DelayControlProps {
  delay: number;
  onChanged(delay: number): void;
}

export default class DelayControl extends React.Component<DelayControlProps> {
  constructor(props: DelayControlProps) {
    super(props);
    bindCallbacks(this, {
      include: [/^handle/]
    });
  }

  private getSelected(delay: number): any {
    for (const [idx, { value }] of DELAY_OPTIONS.entries()) {
      if (value === '' + delay) {
        return DELAY_OPTIONS[idx];
      }
    }
    return null;
  }

  private isChecked(): boolean {
    return this.props.delay > -1;
  }

  private getInstructions(): string {
    const base = i18n.t('forms.add_delay', 'Add delay');
    return this.isChecked() ? `${base} for` : ellipsize(base);
  }

  private handleChecked(): void {
    if (this.props.delay > -1) {
      this.props.onChanged(-1);
    } else {
      this.props.onChanged(parseInt(DEFAULT_TIMEOUT.value));
    }
  }

  private handleTimeoutChanged(selected: any): void {
    this.props.onChanged(parseInt(selected.value));
  }

  public render(): JSX.Element {
    return (
      <>
        <div className={styles.timeout_control_container}>
          <div className={styles.left_section}>
            <CheckboxElement
              name={i18n.t('forms.delay', 'Delay')}
              checked={this.isChecked()}
              description={this.getInstructions()}
              checkboxClassName={styles.checkbox}
              onChange={this.handleChecked}
            />
          </div>
          {renderIf(this.isChecked())(
            <div className={styles.drop_down}>
              <TembaSelect
                name={i18n.t('forms.delay', 'Delay')}
                style={TembaSelectStyle.small}
                value={this.getSelected(this.props.delay)}
                options={DELAY_OPTIONS}
                onChange={this.handleTimeoutChanged}
              ></TembaSelect>
            </div>
          )}
        </div>
      </>
    );
  }
}
