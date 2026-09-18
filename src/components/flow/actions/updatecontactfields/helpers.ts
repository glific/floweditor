import { getActionUUID } from 'components/flow/actions/helpers';
import { Types } from 'config/interfaces';
import { ContactFieldEntry, SetContactFields } from 'flowTypes';
import { FormState, NodeEditorSettings, StringEntry, FormEntry } from 'store/nodeEditor';
import { createUUID } from 'utils';

export interface FieldRow {
  uuid: string;
  field: FormEntry;
  value: StringEntry;
}

export interface UpdateContactFieldsFormState extends FormState {
  rows: FieldRow[];
}

export const createEmptyRow = (): FieldRow => ({
  uuid: createUUID(),
  field: { value: null },
  value: { value: '' }
});

/** A row the author has not picked a field for - the trailing row is always one of these */
export const isEmptyRow = (row: FieldRow): boolean => !row.field.value;

export const getFieldName = (asset: any): string => asset.label || asset.name || asset.key;

export const initializeForm = (settings: NodeEditorSettings): UpdateContactFieldsFormState => {
  const rows: FieldRow[] = [];

  if (settings.originalAction && settings.originalAction.type === Types.set_contact_fields) {
    const action = settings.originalAction as SetContactFields;

    (action.fields || []).forEach((entry: ContactFieldEntry) => {
      rows.push({
        uuid: createUUID(),
        field: { value: { key: entry.field.key, label: entry.field.name } },
        value: { value: entry.value }
      });
    });
  }

  rows.push(createEmptyRow());

  return { rows, valid: rows.some(row => !isEmptyRow(row)) };
};

export const stateToAction = (
  settings: NodeEditorSettings,
  state: UpdateContactFieldsFormState
): SetContactFields => ({
  uuid: getActionUUID(settings, Types.set_contact_fields),
  type: Types.set_contact_fields,
  fields: state.rows.filter(row => !isEmptyRow(row)).map(rowToEntry)
});

const rowToEntry = (row: FieldRow): ContactFieldEntry => ({
  field: { key: row.field.value.key, name: getFieldName(row.field.value) },
  value: row.value.value
});

export const CONSENT_FIELD_KEY = 'settings';

/** The consent field is not a real field - it drives opt in / opt out */
export const isConsentRow = (row: FieldRow): boolean =>
  !isEmptyRow(row) && row.field.value.key === CONSENT_FIELD_KEY;

/** Field keys used more than once - the backend keeps only the last of them */
export const duplicateKeys = (rows: FieldRow[]): string[] => {
  const seen: string[] = [];
  const dupes: string[] = [];

  rows
    .filter(row => !isEmptyRow(row))
    .forEach(row => {
      const key = row.field.value.key;

      if (seen.indexOf(key) > -1) {
        if (dupes.indexOf(key) === -1) {
          dupes.push(key);
        }
      } else {
        seen.push(key);
      }
    });

  return dupes;
};
