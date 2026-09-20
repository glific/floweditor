import { react as bindCallbacks } from 'auto-bind';
import Dialog, { ButtonSet } from 'components/dialog/Dialog';
import {
  BULK_CONTACT_PROPERTIES,
  createEmptyRow,
  duplicateKeys,
  FieldRow,
  initializeForm,
  isConsentRow,
  isEmptyRow,
  isLanguageRow,
  stateToAction,
  UpdateContactFieldsFormState
} from 'components/flow/actions/updatecontactfields/helpers';
import {
  getLanguageForCode,
  sortFieldsAndProperties
} from 'components/flow/actions/updatecontact/helpers';
import { CONTACT_CONSENT_OPTIONS } from 'components/flow/actions/updatecontact/UpdateContactForm';
import SelectElement, { SelectOption } from 'components/form/select/SelectElement';
import { ActionFormProps } from 'components/flow/props';
import TextInputElement from 'components/form/textinput/TextInputElement';
import TypeList from 'components/nodeeditor/TypeList';
import { shouldRequireIf, validate } from 'store/validators';
import { fakePropType } from 'config/ConfigProvider';
import i18n from 'config/i18n';
import * as React from 'react';
import { Asset } from 'store/flowContext';
import { FormEntry } from 'store/nodeEditor';
import TembaSelectElement from 'temba/TembaSelectElement';

import { hasErrors, renderIssues } from '../helpers';
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

  /**
   * Keeps exactly one trailing empty row so there is always somewhere to add a field.
   * Only the row already at the end is reused, so its React key is stable and a value
   * typed there survives; taking the first empty row instead would move an emptied
   * middle row to the bottom and discard whatever was in the real trailing row.
   */
  private setRows(rows: FieldRow[]): void {
    const filled = rows.filter(row => !isEmptyRow(row));
    const last = rows[rows.length - 1];
    const trailing = last && isEmptyRow(last) ? last : createEmptyRow();

    this.setState({
      rows: [...filled, trailing],
      valid: filled.length > 0
    });
  }

  private handleFieldChanged(uuid: string, selection: Asset): void {
    this.setRows(
      this.state.rows.map(row => {
        if (row.uuid !== uuid) {
          return row;
        }

        const updated = { ...row, field: { value: selection } };

        // a free text value is not a valid consent option, so fall back to the first one
        if (isConsentRow(updated) && !this.consentOption(updated.value.value)) {
          return { ...updated, value: { value: CONTACT_CONSENT_OPTIONS[0].value } };
        }

        return updated;
      })
    );
  }

  private consentOption(value: string): SelectOption {
    return CONTACT_CONSENT_OPTIONS.find((option: SelectOption) => option.value === value);
  }

  private handleConsentChanged(uuid: string, option: SelectOption): void {
    this.handleValueChanged(uuid, option.value);
  }

  private handleValueChanged(uuid: string, value: string): void {
    this.setState({
      rows: this.state.rows.map(row => (row.uuid === uuid ? { ...row, value: { value } } : row))
    });
  }

  private handleRemoveRow(uuid: string): void {
    this.setRows(this.state.rows.filter(row => row.uuid !== uuid));
  }

  public handleCreateAssetFromInput(input: string): any {
    return { label: input, value_type: 'text' };
  }

  /**
   * Re-runs the rows through the validators with submitting set, the same way the single
   * field form checks its language entry on save. Only language and consent need a value:
   * leaving an ordinary field empty clears it, as it does on the single field node.
   *
   * Neither of those can be cleared. An empty language is ignored by the backend, and an
   * empty consent is worse than ignored - it resets whatever preferences the contact
   * already has, so it must never reach a saved action.
   */
  private validateRows(): boolean {
    const rows = this.state.rows.map((row: FieldRow) => {
      const required = isLanguageRow(row)
        ? i18n.t('forms.language', 'Language')
        : isConsentRow(row)
        ? i18n.t('forms.settings', 'Consent Status')
        : null;

      if (isEmptyRow(row) || !required) {
        // drop any failure left over from when the row was a language or consent row
        return { ...row, value: { value: row.value.value } };
      }

      return {
        ...row,
        value: validate(required, row.value.value, [shouldRequireIf(true)])
      };
    });

    const valid =
      rows.some((row: FieldRow) => !isEmptyRow(row)) &&
      rows.every((row: FieldRow) => !hasErrors(row.value));

    this.setState({ rows, valid });

    return valid;
  }

  private handleSave(): void {
    if (!this.validateRows()) {
      return;
    }

    this.props.updateAction(stateToAction(this.props.nodeSettings, this.state));
    this.props.onClose(false);
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
            sortFunction={sortFieldsAndProperties}
            options={BULK_CONTACT_PROPERTIES}
            allowCreate={true}
            createPrefix={i18n.t('create_field', 'Create Field') + ': '}
            createArbitraryOption={this.handleCreateAssetFromInput}
          />
        </div>
        <div className={styles.field_value}>{this.renderValueWidget(row)}</div>
        <div className={styles.remove_icon}>
          {isEmptyRow(row) ? null : (
            <temba-icon
              data-testid={'remove-field-' + index}
              name="delete_small"
              onClick={() => this.handleRemoveRow(row.uuid)}
            ></temba-icon>
          )}
        </div>
      </div>
    );
  }

  /**
   * The select wants the language asset rather than the iso code the row stores, so the
   * entry is rebuilt around it - the failures are carried over so an empty language
   * still reports itself the way the single field form does.
   */
  private languageEntry(row: FieldRow): FormEntry {
    const iso = row.value.value;

    return {
      value: iso
        ? { iso, name: getLanguageForCode(iso, this.props.assetStore.languages.items) }
        : null,
      validationFailures: row.value.validationFailures
    };
  }

  /** The value widget varies for the field - consent and language are fixed sets */
  private renderValueWidget(row: FieldRow): JSX.Element {
    if (isLanguageRow(row)) {
      return (
        <TembaSelectElement
          key={'language_select_' + row.uuid}
          name={i18n.t('forms.language', 'Language')}
          placeholder={i18n.t(
            'forms.select_language',
            'Select the language to use for this contact'
          )}
          endpoint={this.context.config.endpoints.languages}
          entry={this.languageEntry(row)}
          valueKey="iso"
          shouldExclude={(language: any) => language.iso === 'base'}
          onChange={(language: any) => this.handleValueChanged(row.uuid, language.iso)}
        />
      );
    }

    if (isConsentRow(row)) {
      return (
        <SelectElement
          key={'consent_select_' + row.uuid}
          name={i18n.t('forms.settings', 'Consent Status')}
          entry={{
            value: this.consentOption(row.value.value),
            validationFailures: row.value.validationFailures
          }}
          onChange={(option: SelectOption) => this.handleConsentChanged(row.uuid, option)}
          options={CONTACT_CONSENT_OPTIONS}
        />
      );
    }

    return (
      <TextInputElement
        name={i18n.t('forms.field_value', 'Field Value')}
        placeholder={i18n.t('forms.enter_field_value_short', 'Value')}
        onChange={(value: string) => this.handleValueChanged(row.uuid, value)}
        entry={row.value}
        autocomplete={true}
      />
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

        <div className={styles.hint} data-testid="clear-hint">
          {i18n.t('forms.clear_contact_field_hint', 'Leave a value empty to clear that field')}
        </div>

        {this.renderDuplicateWarning()}
        {renderIssues(this.props)}
      </Dialog>
    );
  }
}
