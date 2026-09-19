import { react as bindCallbacks } from 'auto-bind';
import Dialog, { ButtonSet } from 'components/dialog/Dialog';
import {
  createEmptyRow,
  duplicateNames,
  initializeForm,
  isEmptyRow,
  ResultRow,
  resultAsset,
  SetRunResultsFormState,
  stateToAction
} from 'components/flow/actions/setrunresults/helpers';
import { ActionFormProps } from 'components/flow/props';
import { SelectOption } from 'components/form/select/SelectElement';
import TextInputElement from 'components/form/textinput/TextInputElement';
import TypeList from 'components/nodeeditor/TypeList';
import i18n from 'config/i18n';
import * as React from 'react';
import { Asset } from 'store/flowContext';
import { Alphanumeric, shouldRequireIf, StartIsNonNumeric, validate } from 'store/validators';
import TembaSelectElement from 'temba/TembaSelectElement';

import { hasErrors, renderIssues } from '../helpers';
import styles from './SetRunResultsForm.module.scss';

export default class SetRunResultsForm extends React.Component<
  ActionFormProps,
  SetRunResultsFormState
> {
  options: SelectOption[] = [];

  constructor(props: ActionFormProps) {
    super(props);

    this.state = initializeForm(this.props.nodeSettings);

    bindCallbacks(this, {
      include: [/^get/, /^on/, /^handle/]
    });
  }

  public componentDidMount(): void {
    const items = this.props.assetStore.results.items;
    this.options = Object.keys(items).map((key: string) => {
      return { name: items[key].name, value: key };
    });
  }

  /**
   * Keeps exactly one trailing empty row so there is always somewhere to add a result.
   * Only the row already at the end is reused, so its React key is stable and a value
   * typed there survives; taking the first empty row instead would move an emptied
   * middle row to the bottom and discard whatever was in the real trailing row.
   */
  private setRows(rows: ResultRow[]): void {
    const filled = rows.filter(row => !isEmptyRow(row));
    const last = rows[rows.length - 1];
    const trailing = last && isEmptyRow(last) ? last : createEmptyRow();

    this.setState({
      rows: [...filled, trailing],
      valid: filled.length > 0
    });
  }

  private handleNameChanged(uuid: string, selection: Asset): void {
    this.setRows(
      this.state.rows.map(row =>
        row.uuid === uuid ? { ...row, name: { value: selection || null } } : row
      )
    );
  }

  private handleValueChanged(uuid: string, value: string): void {
    this.setState({
      rows: this.state.rows.map(row => (row.uuid === uuid ? { ...row, value: { value } } : row))
    });
  }

  private handleCategoryChanged(uuid: string, category: string): void {
    this.setState({
      rows: this.state.rows.map(row =>
        row.uuid === uuid ? { ...row, category: { value: category } } : row
      )
    });
  }

  private handleRemoveRow(uuid: string): void {
    this.setRows(this.state.rows.filter(row => row.uuid !== uuid));
  }

  public handleCreateAssetFromInput(input: string): Asset {
    // workaround for the lack of a length limit on the form itself
    return resultAsset(input.substring(0, 64));
  }

  /**
   * Re-runs each filled row's name through the same validators the single result
   * form uses on save, so a bulk row cannot name a result the single node would reject.
   */
  private validateRows(): boolean {
    let valid = false;

    const rows = this.state.rows.map((row: ResultRow) => {
      if (isEmptyRow(row)) {
        return row;
      }

      const name = validate(i18n.t('forms.name', 'Name'), row.name.value, [
        shouldRequireIf(true),
        Alphanumeric,
        StartIsNonNumeric
      ]);

      valid = valid || !hasErrors(name);

      return { ...row, name };
    });

    this.setState({ rows, valid });

    return valid && rows.every((row: ResultRow) => isEmptyRow(row) || !hasErrors(row.name));
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

  private renderRow(row: ResultRow, index: number): JSX.Element {
    return (
      <div className={styles.row} key={row.uuid} data-testid={'result-row-' + index}>
        <div className={styles.result_select}>
          <TembaSelectElement
            key={'result_select_' + row.uuid}
            name={i18n.t('forms.result', 'Result')}
            placeholder={i18n.t('forms.select_result', 'Select Result')}
            entry={row.name}
            searchable={true}
            createPrefix={i18n.t('forms.create_prefix', 'New: ')}
            createArbitraryOption={this.handleCreateAssetFromInput}
            onChange={(selection: Asset) => this.handleNameChanged(row.uuid, selection)}
            valueKey="value"
            nameKey="name"
            options={this.options}
          />
        </div>
        <div className={styles.result_value}>
          <TextInputElement
            name={i18n.t('forms.value', 'Value')}
            placeholder={i18n.t('forms.enter_result_value_short', 'Value')}
            onChange={(value: string) => this.handleValueChanged(row.uuid, value)}
            entry={row.value}
            autocomplete={true}
          />
        </div>
        <div className={styles.result_category}>
          <TextInputElement
            name={i18n.t('forms.category', 'Category')}
            placeholder={i18n.t('forms.optional', 'Optional')}
            onChange={(category: string) => this.handleCategoryChanged(row.uuid, category)}
            entry={row.category}
            autocomplete={false}
            maxLength={36}
          />
        </div>
        <div className={styles.remove_icon}>
          {isEmptyRow(row) ? null : (
            <temba-icon
              data-testid={'remove-result-' + index}
              name="delete_small"
              onClick={() => this.handleRemoveRow(row.uuid)}
            ></temba-icon>
          )}
        </div>
      </div>
    );
  }

  private renderDuplicateWarning(): JSX.Element {
    const dupes = duplicateNames(this.state.rows);

    if (!dupes.length) {
      return null;
    }

    return (
      <div className={styles.duplicate_warning} data-testid="duplicate-warning">
        {i18n.t('forms.duplicate_results', {
          defaultValue: 'Only the last value will be saved for: {{results}}',
          results: dupes.join(', ')
        })}
      </div>
    );
  }

  public render(): JSX.Element {
    const typeConfig = this.props.typeConfig;

    return (
      <Dialog title={typeConfig.name} headerClass={typeConfig.type} buttons={this.getButtons()}>
        <TypeList __className="" initialType={typeConfig} onChange={this.props.onTypeChange} />

        <p>{i18n.t('forms.select_results_to_save', 'Select the results to save for this flow')}</p>

        <div className={styles.rows}>
          {this.state.rows.map((row: ResultRow, index: number) => this.renderRow(row, index))}
        </div>

        {this.renderDuplicateWarning()}
        {renderIssues(this.props)}
      </Dialog>
    );
  }
}
