import { getActionUUID } from 'components/flow/actions/helpers';
import { Types } from 'config/interfaces';
import { RunResultEntry, SetRunResults } from 'flowTypes';
import { Asset, AssetType } from 'store/flowContext';
import { AssetEntry, FormState, NodeEditorSettings, StringEntry } from 'store/nodeEditor';
import { createUUID, snakify } from 'utils';

export interface ResultRow {
  uuid: string;
  name: AssetEntry;
  value: StringEntry;
  category: StringEntry;
}

export interface SetRunResultsFormState extends FormState {
  rows: ResultRow[];
}

export const createEmptyRow = (): ResultRow => ({
  uuid: createUUID(),
  name: { value: null },
  value: { value: '' },
  category: { value: '' }
});

/** A row the author has not named a result for - the trailing row is always one of these */
export const isEmptyRow = (row: ResultRow): boolean => !row.name.value;

/** The result asset shape the single result node stores, reused here per row */
export const resultAsset = (name: string): Asset => ({
  id: snakify(name),
  name,
  type: AssetType.Result
});

export const initializeForm = (settings: NodeEditorSettings): SetRunResultsFormState => {
  const rows: ResultRow[] = [];

  if (settings.originalAction && settings.originalAction.type === Types.set_run_results) {
    const action = settings.originalAction as SetRunResults;

    (action.results || []).forEach((entry: RunResultEntry) => {
      rows.push({
        uuid: createUUID(),
        name: { value: resultAsset(entry.name) },
        value: { value: entry.value },
        category: { value: entry.category || '' }
      });
    });
  }

  rows.push(createEmptyRow());

  return { rows, valid: rows.some(row => !isEmptyRow(row)) };
};

export const stateToAction = (
  settings: NodeEditorSettings,
  state: SetRunResultsFormState
): SetRunResults => ({
  uuid: getActionUUID(settings, Types.set_run_results),
  type: Types.set_run_results,
  results: state.rows.filter(row => !isEmptyRow(row)).map(rowToEntry)
});

const rowToEntry = (row: ResultRow): RunResultEntry => ({
  name: row.name.value.name,
  value: row.value.value,
  category: row.category.value
});

/** Result names used more than once - the backend keeps only the last of them */
export const duplicateNames = (rows: ResultRow[]): string[] => {
  const seen: string[] = [];
  const dupes: string[] = [];

  rows
    .filter(row => !isEmptyRow(row))
    .forEach(row => {
      const key = snakify(row.name.value.name);

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
