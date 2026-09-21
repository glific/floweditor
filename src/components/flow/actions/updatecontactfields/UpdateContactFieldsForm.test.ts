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

  describe('remove icon', () => {
    it('should not render on the trailing empty row', () => {
      const { wrapper, instance } = setup(true);

      // two filled rows plus the trailing empty one
      expect(instance.state.rows.length).toEqual(3);
      expect(wrapper.find('temba-icon').length).toEqual(2);
      expect(wrapper.find('[data-testid="remove-field-2"]').length).toEqual(0);
    });

    it('should render on every filled row', () => {
      const { wrapper } = setup(true);

      expect(wrapper.find('[data-testid="remove-field-0"]').length).toEqual(1);
      expect(wrapper.find('[data-testid="remove-field-1"]').length).toEqual(1);
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

    it('should default a consent row to the first option', () => {
      const emptyRow = form.instance.state.rows[form.instance.state.rows.length - 1];

      form.instance.handleFieldChanged(emptyRow.uuid, { key: 'settings', label: 'Consent status' });

      const consentRow = form.instance.state.rows.find(
        (row: any) => row.field.value && row.field.value.key === 'settings'
      );

      expect(consentRow.value.value).toEqual('optin');
    });

    it('should save the chosen consent value', () => {
      const emptyRow = form.instance.state.rows[form.instance.state.rows.length - 1];

      form.instance.handleFieldChanged(emptyRow.uuid, { key: 'settings', label: 'Consent status' });

      const consentRow = form.instance.state.rows.find(
        (row: any) => row.field.value && row.field.value.key === 'settings'
      );

      form.instance.handleConsentChanged(consentRow.uuid, { name: 'Opt out', value: 'optout' });
      form.instance.handleSave();

      expect(form.props.updateAction).toMatchCallSnapshot();
    });

    it('should keep a valid consent value when the row is re-picked', () => {
      const emptyRow = form.instance.state.rows[form.instance.state.rows.length - 1];

      form.instance.handleFieldChanged(emptyRow.uuid, { key: 'settings', label: 'Consent status' });

      let consentRow = form.instance.state.rows.find(
        (row: any) => row.field.value && row.field.value.key === 'settings'
      );

      form.instance.handleConsentChanged(consentRow.uuid, { name: 'Opt out', value: 'optout' });
      form.instance.handleFieldChanged(consentRow.uuid, {
        key: 'settings',
        label: 'Consent status'
      });

      consentRow = form.instance.state.rows.find(
        (row: any) => row.field.value && row.field.value.key === 'settings'
      );

      expect(consentRow.value.value).toEqual('optout');
    });

    it('should not save a row whose value is blank', () => {
      const firstRow = form.instance.state.rows[0];
      form.instance.handleValueChanged(firstRow.uuid, '');

      form.props.updateAction.mockClear();
      form.props.onClose.mockClear();
      form.instance.handleSave();

      // the blank row is flagged rather than silently written as an empty value
      const flagged = form.instance.state.rows[0];
      expect(flagged.value.validationFailures.length).toBeGreaterThan(0);
      expect(form.props.updateAction).not.toBeCalled();
      expect(form.props.onClose).not.toBeCalled();
    });

    it('should keep a value typed into the trailing row when another row changes', () => {
      const trailing = form.instance.state.rows[form.instance.state.rows.length - 1];

      form.instance.handleValueChanged(trailing.uuid, 'typed early');
      form.instance.handleFieldChanged(form.instance.state.rows[0].uuid, {
        key: 'gender',
        label: 'Gender'
      });

      const stillTrailing = form.instance.state.rows[form.instance.state.rows.length - 1];

      expect(stillTrailing.uuid).toEqual(trailing.uuid);
      expect(stillTrailing.value.value).toEqual('typed early');
    });

    it('should not reorder rows when a middle row is emptied', () => {
      const [first, second, trailing] = form.instance.state.rows;

      form.instance.handleValueChanged(trailing.uuid, 'typed in trailing');
      // clearing the field empties the row without touching the others
      form.instance.handleFieldChanged(first.uuid, null);

      const rows = form.instance.state.rows;

      // the surviving filled row keeps its place, and the real trailing row is kept
      expect(rows.length).toEqual(2);
      expect(rows[0].uuid).toEqual(second.uuid);
      expect(rows[1].uuid).toEqual(trailing.uuid);
      expect(rows[1].value.value).toEqual('typed in trailing');
    });

    it('should not move an emptied middle row to the bottom', () => {
      const [first, second] = form.instance.state.rows;

      form.instance.handleFieldChanged(second.uuid, null);

      const rows = form.instance.state.rows;

      expect(rows[0].uuid).toEqual(first.uuid);
      expect(rows.find((row: any) => row.uuid === second.uuid)).toBeUndefined();
    });

    it('should save a language row with its property type', () => {
      const trailing = form.instance.state.rows[form.instance.state.rows.length - 1];

      form.instance.handleFieldChanged(trailing.uuid, {
        id: 'language',
        name: 'Language',
        type: 'property'
      });

      const languageRow = form.instance.state.rows.find(
        (row: any) => row.field.value && row.field.value.id === 'language'
      );

      form.instance.handleValueChanged(languageRow.uuid, 'hin');
      form.instance.handleSave();

      expect(form.props.updateAction).toMatchCallSnapshot();
    });

    it('should cancel changes', () => {
      form.instance.getButtons().secondary.onClick();
      expect(form.props.updateAction).not.toBeCalled();
    });
  });
});
