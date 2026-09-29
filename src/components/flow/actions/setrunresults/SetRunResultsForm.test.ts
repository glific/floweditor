import { hasErrors } from 'components/flow/actions/helpers';
import { resultAsset } from 'components/flow/actions/setrunresults/helpers';
import SetRunResultsForm from 'components/flow/actions/setrunresults/SetRunResultsForm';
import { ActionFormProps } from 'components/flow/props';
import { AssetType } from 'store/flowContext';
import { composeComponentTestUtils, mock } from 'testUtils';
import {
  createAddGroupsAction,
  createSetRunResultsAction,
  getActionFormProps
} from 'testUtils/assetCreators';
import * as utils from 'utils';

mock(utils, 'createUUID', utils.seededUUIDs());

const { setup } = composeComponentTestUtils<ActionFormProps>(
  SetRunResultsForm,
  getActionFormProps(createSetRunResultsAction())
);

describe(SetRunResultsForm.name, () => {
  describe('render', () => {
    it('should render existing rows plus a trailing empty one', () => {
      const { wrapper, instance } = setup(true);
      expect(instance.state.rows.length).toEqual(3);
      expect(instance.state.valid).toBeTruthy();
      expect(wrapper).toMatchSnapshot();
    });

    it('should render a single empty row with no action', () => {
      const { instance } = setup(true, {
        $merge: { nodeSettings: { originalNode: null, originalAction: null } }
      });
      expect(instance.state.rows.length).toEqual(1);
      expect(instance.state.valid).toBeFalsy();
    });

    it('should render a single empty row when switching from another action', () => {
      const { instance } = setup(true, {
        $merge: {
          nodeSettings: { originalNode: null, originalAction: createAddGroupsAction() }
        }
      });
      expect(instance.state.rows.length).toEqual(1);
      expect(instance.state.valid).toBeFalsy();
    });
  });

  describe('remove icon', () => {
    it('should not render on the trailing empty row', () => {
      const { wrapper, instance } = setup(true);

      // two filled rows plus the trailing empty one
      expect(instance.state.rows.length).toEqual(3);
      expect(wrapper.find('temba-icon').length).toEqual(2);
      expect(wrapper.find('[data-testid="remove-result-2"]').length).toEqual(0);
    });

    it('should render on every filled row', () => {
      const { wrapper } = setup(true);

      expect(wrapper.find('[data-testid="remove-result-0"]').length).toEqual(1);
      expect(wrapper.find('[data-testid="remove-result-1"]').length).toEqual(1);
    });
  });

  describe('result options', () => {
    const result = (name: string) => ({ id: utils.snakify(name), name, type: AssetType.Result });

    const setupWithResults = (...names: string[]) =>
      setup(true, {
        assetStore: {
          results: {
            items: {
              $set: names.reduce(
                (items: any, name: string) => ({ ...items, [utils.snakify(name)]: result(name) }),
                {}
              )
            }
          }
        }
      });

    it('should hand every select its options on the first render', () => {
      const { wrapper } = setupWithResults('Gender');

      const selects = wrapper.find('TembaSelectElement');

      expect(selects.length).toEqual(3);
      selects.forEach((select: any) =>
        expect(select.prop('options')).toEqual([{ name: 'Gender', value: 'gender' }])
      );
    });

    it('should leave out results the other rows already name', () => {
      const { instance } = setupWithResults('Name', 'Age', 'Gender');

      const trailing = instance.state.rows[instance.state.rows.length - 1];

      expect(instance.optionsFor(trailing).map((option: any) => option.name)).toEqual(['Gender']);
    });

    it('should keep the result the row itself names', () => {
      const { instance } = setupWithResults('Name', 'Age', 'Gender');

      const [first] = instance.state.rows;

      expect(instance.optionsFor(first).map((option: any) => option.name)).toEqual([
        'Name',
        'Gender'
      ]);
    });

    it('should offer a result again once the row naming it is removed', () => {
      const { instance } = setupWithResults('Name', 'Age', 'Gender');

      const [first] = instance.state.rows;
      instance.handleRemoveRow(first.uuid);

      const trailing = instance.state.rows[instance.state.rows.length - 1];

      expect(instance.optionsFor(trailing).map((option: any) => option.name)).toEqual([
        'Name',
        'Gender'
      ]);
    });
  });

  describe('updates', () => {
    let form: any;

    beforeEach(() => {
      form = setup(true, { $merge: { updateAction: jest.fn(), onClose: jest.fn() } });
    });

    it('should append a new empty row once a result is named', () => {
      const emptyRow = form.instance.state.rows[form.instance.state.rows.length - 1];

      form.instance.handleNameChanged(emptyRow.uuid, resultAsset('Gender'));

      expect(form.instance.state.rows.length).toEqual(4);
      expect(form.instance.state.valid).toBeTruthy();
    });

    it('should save one entry per filled row', () => {
      form.instance.handleSave();
      expect(form.props.updateAction).toMatchCallSnapshot();
    });

    it('should save an updated value and category', () => {
      const firstRow = form.instance.state.rows[0];
      form.instance.handleValueChanged(firstRow.uuid, '@results.age');
      form.instance.handleCategoryChanged(firstRow.uuid, 'Adult');
      form.instance.handleSave();
      expect(form.props.updateAction).toMatchCallSnapshot();
    });

    it('should save a blank value, which clears the result', () => {
      const firstRow = form.instance.state.rows[0];
      form.instance.handleValueChanged(firstRow.uuid, '');
      form.instance.handleSave();

      expect(form.props.updateAction).toBeCalled();
      expect(form.props.updateAction.mock.calls[0][0].results[0].value).toEqual('');
    });

    it('should drop a removed row', () => {
      const firstRow = form.instance.state.rows[0];
      form.instance.handleRemoveRow(firstRow.uuid);

      expect(form.instance.state.rows.length).toEqual(2);

      form.instance.handleSave();
      expect(form.props.updateAction).toMatchCallSnapshot();
    });

    it('should not save when every row is empty', () => {
      form.instance.state.rows.forEach((row: any) => form.instance.handleRemoveRow(row.uuid));

      form.props.updateAction.mockClear();
      form.props.onClose.mockClear();
      form.instance.handleSave();

      expect(form.instance.state.valid).toBeFalsy();
      expect(form.props.updateAction).not.toBeCalled();
      expect(form.props.onClose).not.toBeCalled();
    });

    it('should flag a bad name as soon as it is picked', () => {
      const trailing = form.instance.state.rows[form.instance.state.rows.length - 1];
      form.instance.handleNameChanged(trailing.uuid, resultAsset('1st place'));

      const flagged = form.instance.state.rows.find(
        (row: any) => row.name.value && row.name.value.name === '1st place'
      );

      expect(flagged.name.validationFailures.length).toBeGreaterThan(0);
      expect(form.instance.state.valid).toBeFalsy();
    });

    it('should clear the failure once a good name replaces it', () => {
      const trailing = form.instance.state.rows[form.instance.state.rows.length - 1];
      form.instance.handleNameChanged(trailing.uuid, resultAsset('1st place'));
      form.instance.handleNameChanged(trailing.uuid, resultAsset('First place'));

      const fixed = form.instance.state.rows.find((row: any) => row.uuid === trailing.uuid);

      expect(hasErrors(fixed.name)).toBeFalsy();
      expect(form.instance.state.valid).toBeTruthy();
    });

    it('should not report a missing name when a row is cleared', () => {
      const [first] = form.instance.state.rows;
      form.instance.handleNameChanged(first.uuid, null);

      expect(form.instance.state.rows.every((row: any) => !hasErrors(row.name))).toBeTruthy();
      expect(form.instance.state.valid).toBeTruthy();
    });

    it('should not save a result name that starts with a number', () => {
      const trailing = form.instance.state.rows[form.instance.state.rows.length - 1];
      form.instance.handleNameChanged(trailing.uuid, resultAsset('1st place'));

      form.props.updateAction.mockClear();
      form.props.onClose.mockClear();
      form.instance.handleSave();

      const flagged = form.instance.state.rows.find(
        (row: any) => row.name.value && row.name.value.name === '1st place'
      );

      expect(flagged.name.validationFailures.length).toBeGreaterThan(0);
      expect(form.props.updateAction).not.toBeCalled();
      expect(form.props.onClose).not.toBeCalled();
    });

    it('should not save a result name with punctuation', () => {
      const trailing = form.instance.state.rows[form.instance.state.rows.length - 1];
      form.instance.handleNameChanged(trailing.uuid, resultAsset('bad!name'));

      form.props.updateAction.mockClear();
      form.instance.handleSave();

      expect(form.props.updateAction).not.toBeCalled();
    });

    it('should keep a value typed into the trailing row when another row changes', () => {
      const trailing = form.instance.state.rows[form.instance.state.rows.length - 1];

      form.instance.handleValueChanged(trailing.uuid, 'typed early');
      form.instance.handleNameChanged(form.instance.state.rows[0].uuid, resultAsset('Gender'));

      const stillTrailing = form.instance.state.rows[form.instance.state.rows.length - 1];

      expect(stillTrailing.uuid).toEqual(trailing.uuid);
      expect(stillTrailing.value.value).toEqual('typed early');
    });

    it('should not reorder rows when a middle row is emptied', () => {
      const [first, second, trailing] = form.instance.state.rows;

      form.instance.handleValueChanged(trailing.uuid, 'typed in trailing');
      // clearing the name empties the row without touching the others
      form.instance.handleNameChanged(first.uuid, null);

      const rows = form.instance.state.rows;

      // the surviving filled row keeps its place, and the real trailing row is kept
      expect(rows.length).toEqual(2);
      expect(rows[0].uuid).toEqual(second.uuid);
      expect(rows[1].uuid).toEqual(trailing.uuid);
      expect(rows[1].value.value).toEqual('typed in trailing');
    });

    it('should not move an emptied middle row to the bottom', () => {
      const [first, second] = form.instance.state.rows;

      form.instance.handleNameChanged(second.uuid, null);

      const rows = form.instance.state.rows;

      expect(rows[0].uuid).toEqual(first.uuid);
      expect(rows.find((row: any) => row.uuid === second.uuid)).toBeUndefined();
    });

    it('should warn about repeated result names', () => {
      const trailing = form.instance.state.rows[form.instance.state.rows.length - 1];
      form.instance.handleNameChanged(trailing.uuid, resultAsset('Name'));

      const wrapper = form.instance.render();
      expect(JSON.stringify(wrapper)).toContain('duplicate-warning');
    });

    it('should cancel changes', () => {
      form.instance.getButtons().secondary.onClick();
      expect(form.props.updateAction).not.toBeCalled();
    });
  });
});
