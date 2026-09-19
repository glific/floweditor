import {
  createEmptyRow,
  duplicateNames,
  initializeForm,
  isEmptyRow,
  resultAsset,
  stateToAction
} from 'components/flow/actions/setrunresults/helpers';
import { Types } from 'config/interfaces';
import { AssetType } from 'store/flowContext';
import { NodeEditorSettings } from 'store/nodeEditor';
import { mock } from 'testUtils';
import { createSetRunResultsAction } from 'testUtils/assetCreators';
import * as utils from 'utils';

mock(utils, 'createUUID', utils.seededUUIDs());

describe('setrunresults helpers', () => {
  it('initializes a row per existing entry, plus an empty one', () => {
    const action = createSetRunResultsAction();
    const state = initializeForm({
      originalNode: null,
      originalAction: action
    } as NodeEditorSettings);

    expect(state.rows.length).toEqual(3);
    expect(state.rows[0].name.value.name).toEqual('Name');
    expect(state.rows[0].value.value).toEqual('Grace');
    expect(state.rows[1].category.value).toEqual('Young Adult');
    expect(isEmptyRow(state.rows[2])).toBeTruthy();
    expect(state.valid).toBeTruthy();
  });

  it('starts with a single empty row for a new action', () => {
    const state = initializeForm({
      originalNode: null,
      originalAction: null
    } as NodeEditorSettings);

    expect(state.rows.length).toEqual(1);
    expect(isEmptyRow(state.rows[0])).toBeTruthy();
    expect(state.valid).toBeFalsy();
  });

  it('round trips through stateToAction, dropping empty rows', () => {
    const action = createSetRunResultsAction();
    const settings: NodeEditorSettings = { originalNode: null, originalAction: action };
    const state = initializeForm(settings);

    const result = stateToAction(settings, state);

    expect(result.type).toEqual(Types.set_run_results);
    expect(result.results).toEqual([
      { name: 'Name', value: 'Grace', category: '' },
      { name: 'Age', value: '25', category: 'Young Adult' }
    ]);
  });

  it('snakifies the result name into the asset id, as the single node does', () => {
    expect(resultAsset('Video Code')).toEqual({
      id: 'video_code',
      name: 'Video Code',
      type: AssetType.Result
    });
  });

  it('reports repeated result names', () => {
    const rows = [
      { ...createEmptyRow(), name: { value: resultAsset('Video Code') } },
      { ...createEmptyRow(), name: { value: resultAsset('Video Code') } },
      { ...createEmptyRow(), name: { value: resultAsset('Age') } },
      createEmptyRow()
    ];

    expect(duplicateNames(rows as any)).toEqual(['video_code']);
  });

  it('treats names that snakify alike as duplicates', () => {
    const rows = [
      { ...createEmptyRow(), name: { value: resultAsset('Video Code') } },
      { ...createEmptyRow(), name: { value: resultAsset('video code') } },
      createEmptyRow()
    ];

    expect(duplicateNames(rows as any)).toEqual(['video_code']);
  });

  it('reports no duplicates for distinct names', () => {
    const rows = [
      { ...createEmptyRow(), name: { value: resultAsset('Video Code') } },
      { ...createEmptyRow(), name: { value: resultAsset('Age') } },
      createEmptyRow()
    ];

    expect(duplicateNames(rows as any)).toEqual([]);
  });
});
