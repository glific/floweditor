import UpdateContactFieldsForm from 'components/flow/actions/updatecontactfields/UpdateContactFieldsForm';
import { ActionFormProps } from 'components/flow/props';
import { composeComponentTestUtils, mock } from 'testUtils';
import {
  createSetContactFieldsAction,
  createAddGroupsAction,
  getActionFormProps
} from 'testUtils/assetCreators';
import * as utils from 'utils';

mock(utils, 'createUUID', utils.seededUUIDs());

const { setup } = composeComponentTestUtils<ActionFormProps>(
  UpdateContactFieldsForm,
  getActionFormProps(createSetContactFieldsAction())
);

describe(UpdateContactFieldsForm.name, () => {
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

  describe('updates', () => {
    let form: any;

    beforeEach(() => {
      form = setup(true, { $merge: { updateAction: jest.fn(), onClose: jest.fn() } });
    });

    it('should append a new empty row once a field is picked', () => {
      const emptyRow = form.instance.state.rows[form.instance.state.rows.length - 1];

      form.instance.handleFieldChanged(emptyRow.uuid, { key: 'gender', label: 'Gender' });

      expect(form.instance.state.rows.length).toEqual(4);
      expect(form.instance.state.valid).toBeTruthy();
    });

    it('should save one entry per filled row', () => {
      form.instance.handleSave();
      expect(form.props.updateAction).toMatchCallSnapshot();
    });

    it('should save an updated value', () => {
      const firstRow = form.instance.state.rows[0];
      form.instance.handleValueChanged(firstRow.uuid, '@results.age');
      form.instance.handleSave();
      expect(form.props.updateAction).toMatchCallSnapshot();
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

    it('should cancel changes', () => {
      form.instance.getButtons().secondary.onClick();
      expect(form.props.updateAction).not.toBeCalled();
    });
  });
});
