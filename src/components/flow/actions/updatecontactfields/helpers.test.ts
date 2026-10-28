import {
  createEmptyRow,
  duplicateRows,
  initializeForm,
  isEmptyRow,
  stateToAction
} from 'components/flow/actions/updatecontactfields/helpers';
import { Types } from 'config/interfaces';
import { NodeEditorSettings } from 'store/nodeEditor';
import { mock } from 'testUtils';
import { createSetContactFieldsAction } from 'testUtils/assetCreators';
import * as utils from 'utils';

mock(utils, 'createUUID', utils.seededUUIDs());

describe('updatecontactfields helpers', () => {
  it('initializes a row per existing entry', () => {
    const action = createSetContactFieldsAction();
    const state = initializeForm({
      originalNode: null,
      originalAction: action
    } as NodeEditorSettings);

    expect(state.rows.length).toEqual(2);
    expect(state.rows[0].field.value.key).toEqual('age');
    expect(state.rows[0].value.value).toEqual('25');
    expect(state.valid).toBeTruthy();
  });

  it('initializes a single empty row for a new node', () => {
    const settings: NodeEditorSettings = { originalNode: null };
    const state = initializeForm(settings);

    expect(state.rows.length).toEqual(1);
    expect(isEmptyRow(state.rows[0])).toBeTruthy();
    expect(state.valid).toBeFalsy();
  });

  it('round trips through stateToAction, dropping empty rows', () => {
    const action = createSetContactFieldsAction();
    const settings: NodeEditorSettings = { originalNode: null, originalAction: action };
    const state = initializeForm(settings);

    const result = stateToAction(settings, state);

    expect(result.type).toEqual(Types.set_contact_fields);
    expect(result.fields).toEqual([
      { field: { key: 'age', name: 'Age' }, value: '25' },
      { field: { key: 'district', name: 'District' }, value: 'Pune' }
    ]);
  });

  it('reports the later rows that repeat a field', () => {
    const rows = [
      { ...createEmptyRow(), field: { value: { key: 'age', label: 'Age' } } },
      { ...createEmptyRow(), uuid: 'repeat', field: { value: { key: 'age', label: 'Age' } } },
      { ...createEmptyRow(), field: { value: { key: 'district', label: 'District' } } },
      createEmptyRow()
    ];

    expect(duplicateRows(rows as any)).toEqual({ repeat: 'Age' });
  });

  it('reports no duplicates for distinct keys', () => {
    const rows = [
      { ...createEmptyRow(), field: { value: { key: 'age', label: 'Age' } } },
      { ...createEmptyRow(), field: { value: { key: 'district', label: 'District' } } },
      createEmptyRow()
    ];

    expect(duplicateRows(rows as any)).toEqual({});
  });
});
