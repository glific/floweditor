import { react as bindCallbacks } from 'auto-bind';
import Dialog, { ButtonSet } from 'components/dialog/Dialog';
import {
  createEmptyRow,
  duplicateKeys,
  FieldRow,
  initializeForm,
  isEmptyRow,
  stateToAction,
  UpdateContactFieldsFormState
} from 'components/flow/actions/updatecontactfields/helpers';
import { ActionFormProps } from 'components/flow/props';
import TextInputElement from 'components/form/textinput/TextInputElement';
import TypeList from 'components/nodeeditor/TypeList';
import { fakePropType } from 'config/ConfigProvider';
import i18n from 'config/i18n';
import * as React from 'react';
import { Asset } from 'store/flowContext';
import TembaSelectElement from 'temba/TembaSelectElement';

import { renderIssues } from '../helpers';
import styles from './UpdateContactFieldsForm.module.scss';

export default class UpdateContactFieldsForm extends React.Component<
  ActionFormProps,
  UpdateContactFieldsFormState
> {
  public static contextTypes = {
    config: fakePropType
  };

  constructor(props: ActionFormProps) {
    super(props);

    this.state = initializeForm(this.props.nodeSettings);

    bindCallbacks(this, {
      include: [/^get/, /^on/, /^handle/]
    });
  }

  /** Keeps exactly one trailing empty row so there is always somewhere to add a field */
  private setRows(rows: FieldRow[]): void {
    const filled = rows.filter(row => !isEmptyRow(row));

    this.setState({
      rows: [...filled, createEmptyRow()],
      valid: filled.length > 0
    });
  }

  private handleFieldChanged(uuid: string, selection: Asset): void {
    this.setRows(
      this.state.rows.map(row =>
        row.uuid === uuid ? { ...row, field: { value: selection } } : row
      )
    );
  }

  private handleValueChanged(uuid: string, value: string): void {
    this.setState({
      rows: this.state.rows.map(row => (row.uuid === uuid ? { ...row, value: { value } } : row))
    });
  }

  private handleRemoveRow(uuid: string): void {
    this.setRows(this.state.rows.filter(row => row.uuid !== uuid));
  }

  public handleFieldAdded(field: Asset): void {
    this.props.addAsset('fields', field);
  }

  public handleCreateAssetFromInput(input: string): any {
    return { label: input, value_type: 'text' };
  }

  private handleSave(): void {
    if (this.state.valid) {
      this.props.updateAction(stateToAction(this.props.nodeSettings, this.state));
      this.props.onClose(false);
    }
  }

  private getButtons(): ButtonSet {
    return {
      primary: { name: i18n.t('buttons.ok', 'Ok'), onClick: this.handleSave },
      secondary: {
        name: i18n.t('buttons.cancel', 'Cancel'),
        onClick: () => this.props.onClose(true)
      }
    };
  }

  private renderRow(row: FieldRow, index: number): JSX.Element {
    return (
      <div className={styles.row} key={row.uuid} data-testid={'field-row-' + index}>
        <div className={styles.field_select}>
          <TembaSelectElement
            key={'field_select_' + row.uuid}
            name={i18n.t('forms.contact_field', 'Contact Field')}
            placeholder={i18n.t('forms.select_contact_field', 'Select a field')}
            endpoint={this.context.config.endpoints.fields}
            entry={row.field}
            valueKey="key"
            searchable={true}
            onChange={(selection: Asset) => this.handleFieldChanged(row.uuid, selection)}
            allowCreate={true}
            createPrefix={i18n.t('create_field', 'Create Field') + ': '}
            createArbitraryOption={this.handleCreateAssetFromInput}
          />
        </div>
        <div className={styles.field_value}>
          <TextInputElement
            name={i18n.t('forms.field_value', 'Field Value')}
            placeholder={i18n.t('forms.enter_field_value_short', 'Value')}
            onChange={(value: string) => this.handleValueChanged(row.uuid, value)}
            entry={row.value}
            autocomplete={true}
          />
        </div>
        <div className={styles.remove_icon}>
          <temba-icon
            data-testid={'remove-field-' + index}
            name="delete_small"
            onClick={() => this.handleRemoveRow(row.uuid)}
          ></temba-icon>
        </div>
      </div>
    );
  }

  private renderDuplicateWarning(): JSX.Element {
    const dupes = duplicateKeys(this.state.rows);

    if (!dupes.length) {
      return null;
    }

    return (
      <div className={styles.duplicate_warning} data-testid="duplicate-warning">
        {i18n.t('forms.duplicate_contact_fields', {
          defaultValue: 'Only the last value will be saved for: {{fields}}',
          fields: dupes.join(', ')
        })}
      </div>
    );
  }

  public render(): JSX.Element {
    const typeConfig = this.props.typeConfig;

    return (
      <Dialog title={typeConfig.name} headerClass={typeConfig.type} buttons={this.getButtons()}>
        <TypeList __className="" initialType={typeConfig} onChange={this.props.onTypeChange} />

        <p>
          {i18n.t('forms.select_contact_fields_to_update', 'Select the contact fields to update')}
        </p>

        <div className={styles.rows}>
          {this.state.rows.map((row: FieldRow, index: number) => this.renderRow(row, index))}
        </div>

        {this.renderDuplicateWarning()}
        {renderIssues(this.props)}
      </Dialog>
    );
  }
}
