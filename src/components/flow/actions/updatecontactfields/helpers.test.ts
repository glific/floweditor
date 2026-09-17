import {
  createEmptyRow,
  duplicateKeys,
  initializeForm,
  isEmptyRow,
  stateToAction
} from 'components/flow/actions/updatecontactfields/helpers';
import { Types } from 'config/interfaces';
import { mock } from 'testUtils';
import { createSetContactFieldsAction } from 'testUtils/assetCreators';
import * as utils from 'utils';

mock(utils, 'createUUID', utils.seededUUIDs());

describe('updatecontactfields helpers', () => {
  it('initializes a row per existing entry, plus an empty one', () => {
    const action = createSetContactFieldsAction();
    const state = initializeForm({ originalNode: null, originalAction: action });

    expect(state.rows.length).toEqual(3);
    expect(state.rows[0].field.value.key).toEqual('age');
    expect(state.rows[0].value.value).toEqual('25');
    expect(isEmptyRow(state.rows[2])).toBeTruthy();
    expect(state.valid).toBeTruthy();
  });

  it('round trips through stateToAction, dropping empty rows', () => {
    const action = createSetContactFieldsAction();
    const settings = { originalNode: null, originalAction: action };
    const state = initializeForm(settings);

    const result = stateToAction(settings, state);

    expect(result.type).toEqual(Types.set_contact_fields);
    expect(result.fields).toEqual([
      { field: { key: 'age', name: 'Age' }, value: '25' },
      { field: { key: 'district', name: 'District' }, value: 'Pune' }
    ]);
  });

  it('reports repeated field keys', () => {
    const rows = [
      { ...createEmptyRow(), field: { value: { key: 'age', label: 'Age' } } },
      { ...createEmptyRow(), field: { value: { key: 'age', label: 'Age' } } },
      { ...createEmptyRow(), field: { value: { key: 'district', label: 'District' } } },
      createEmptyRow()
    ];

    expect(duplicateKeys(rows as any)).toEqual(['age']);
  });

  it('reports no duplicates for distinct keys', () => {
    const rows = [
      { ...createEmptyRow(), field: { value: { key: 'age', label: 'Age' } } },
      { ...createEmptyRow(), field: { value: { key: 'district', label: 'District' } } },
      createEmptyRow()
    ];

    expect(duplicateKeys(rows as any)).toEqual([]);
  });
});
