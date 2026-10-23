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

/** Adds a row through the button handler and returns it */
const addRow = (instance: any): any => {
  instance.handleAddRow();
  return instance.state.rows[instance.state.rows.length - 1];
};

describe(UpdateContactFieldsForm.name, () => {
  describe('render', () => {
    it('should render only the existing rows', () => {
      const { wrapper, instance } = setup(true);
      expect(instance.state.rows.length).toEqual(2);
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
    it('should render on every row', () => {
      const { wrapper } = setup(true);

      expect(wrapper.find('[data-testid="remove-field-0"]').length).toEqual(1);
      expect(wrapper.find('[data-testid="remove-field-1"]').length).toEqual(1);
    });

    it('should render on a lone empty row and clear it', () => {
      const { wrapper, instance } = setup(true, {
        $merge: { nodeSettings: { originalNode: null, originalAction: null } }
      });

      expect(wrapper.find('[data-testid="remove-field-0"]').length).toEqual(1);

      const row = instance.state.rows[0];
      instance.handleFieldChanged(row.uuid, { key: 'gender', label: 'Gender' });
      instance.handleValueChanged(row.uuid, 'female');
      instance.handleRemoveRow(row.uuid);

      expect(instance.state.rows.length).toEqual(1);
      expect(instance.state.rows[0].field.value).toBeNull();
      expect(instance.state.rows[0].value.value).toEqual('');
    });
  });

  describe('add button', () => {
    it('should not add rows on its own when a field is picked', () => {
      const { instance } = setup(true, {
        $merge: { nodeSettings: { originalNode: null, originalAction: null } }
      });

      instance.handleFieldChanged(instance.state.rows[0].uuid, { key: 'gender', label: 'Gender' });

      expect(instance.state.rows.length).toEqual(1);
      expect(instance.state.valid).toBeTruthy();
    });

    it('should append one empty row', () => {
      const { instance } = setup(true);

      addRow(instance);

      expect(instance.state.rows.length).toEqual(3);
      expect(instance.state.rows[2].field.value).toBeNull();
    });

    it('should be disabled while a row has no field', () => {
      const { wrapper, instance } = setup(true);

      expect(wrapper.find('[data-testid="add-field-row"]').prop('disabled')).toBeFalsy();

      addRow(instance);
      addRow(instance);
      wrapper.update();

      // the second add is ignored, so only one incomplete row exists
      expect(instance.state.rows.length).toEqual(3);
      expect(wrapper.find('[data-testid="add-field-row"]').prop('disabled')).toBeTruthy();
    });
  });

  describe('updates', () => {
    let form: any;

    beforeEach(() => {
      form = setup(true, { $merge: { updateAction: jest.fn(), onClose: jest.fn() } });
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

      expect(form.instance.state.rows.length).toEqual(1);

      form.instance.handleSave();
      expect(form.props.updateAction).toMatchCallSnapshot();
    });

    it('should not save a row without a field', () => {
      addRow(form.instance);

      form.props.updateAction.mockClear();
      form.props.onClose.mockClear();
      form.instance.handleSave();
      form.wrapper.update();

      expect(form.instance.state.valid).toBeFalsy();
      expect(form.props.updateAction).not.toBeCalled();
      expect(form.props.onClose).not.toBeCalled();
      expect(form.wrapper.find('[data-testid="row-error-2"]').text()).toEqual(
        'Choose a field or remove this row.'
      );
    });

    it('should save once the row without a field is removed', () => {
      const row = addRow(form.instance);

      form.instance.handleSave();
      form.instance.handleRemoveRow(row.uuid);
      form.instance.handleSave();

      expect(form.props.updateAction).toBeCalled();
    });

    it('should flag a repeated field on the later row and not save', () => {
      const row = addRow(form.instance);

      form.instance.handleFieldChanged(row.uuid, { key: 'age', label: 'Age' });
      form.wrapper.update();

      expect(form.wrapper.find('[data-testid="row-error-0"]').length).toEqual(0);
      expect(form.wrapper.find('[data-testid="row-error-2"]').text()).toEqual(
        'Age is already selected above'
      );

      form.props.updateAction.mockClear();
      form.instance.handleSave();

      expect(form.props.updateAction).not.toBeCalled();
    });

    it('should default a consent row to the first option', () => {
      const emptyRow = addRow(form.instance);

      form.instance.handleFieldChanged(emptyRow.uuid, { key: 'settings', label: 'Consent status' });

      const consentRow = form.instance.state.rows.find(
        (row: any) => row.field.value && row.field.value.key === 'settings'
      );

      expect(consentRow.value.value).toEqual('optin');
    });

    it('should save the chosen consent value', () => {
      const emptyRow = addRow(form.instance);

      form.instance.handleFieldChanged(emptyRow.uuid, { key: 'settings', label: 'Consent status' });

      const consentRow = form.instance.state.rows.find(
        (row: any) => row.field.value && row.field.value.key === 'settings'
      );

      form.instance.handleConsentChanged(consentRow.uuid, { name: 'Opt out', value: 'optout' });
      form.instance.handleSave();

      expect(form.props.updateAction).toMatchCallSnapshot();
    });

    it('should keep a valid consent value when the row is re-picked', () => {
      const emptyRow = addRow(form.instance);

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

    it('should save a row whose value is blank so the field is cleared', () => {
      const firstRow = form.instance.state.rows[0];
      form.instance.handleValueChanged(firstRow.uuid, '');

      form.props.updateAction.mockClear();
      form.props.onClose.mockClear();
      form.instance.handleSave();

      expect(form.instance.state.valid).toBeTruthy();
      expect(form.props.updateAction).toMatchCallSnapshot();
      expect(form.props.onClose).toBeCalled();
    });

    it('should not save a language row without a value', () => {
      const emptyRow = addRow(form.instance);

      form.instance.handleFieldChanged(emptyRow.uuid, {
        id: 'language',
        key: 'language',
        name: 'Language',
        type: 'property'
      });

      form.props.updateAction.mockClear();
      form.props.onClose.mockClear();
      form.instance.handleSave();

      const languageRow = form.instance.state.rows.find(
        (row: any) => row.field.value && row.field.value.id === 'language'
      );

      // language cannot be cleared, so an empty one is flagged instead
      expect(languageRow.value.validationFailures.length).toBeGreaterThan(0);
      expect(form.props.updateAction).not.toBeCalled();
      expect(form.props.onClose).not.toBeCalled();

      // and the failure reaches the select rather than silently blocking the save
      form.wrapper.update();

      const languageSelect = form.wrapper
        .find('TembaSelectElement')
        .filterWhere((node: any) => node.prop('name') === 'Language');

      expect(languageSelect.length).toEqual(1);
      expect(languageSelect.prop('entry').validationFailures.length).toBeGreaterThan(0);
    });

    it('should not save a consent row loaded without a value', () => {
      // the picker always defaults a fresh consent row, so an empty one can only arrive
      // from an already saved action - it must not reach the backend, where an empty
      // consent resets whatever preferences the contact already has
      const loaded = setup(true, {
        $merge: {
          updateAction: jest.fn(),
          onClose: jest.fn(),
          nodeSettings: {
            originalNode: null,
            originalAction: createSetContactFieldsAction({
              fields: [{ field: { key: 'settings', name: 'Consent status' }, value: '' }]
            })
          }
        }
      });

      loaded.instance.handleSave();

      const consentRow = loaded.instance.state.rows[0];

      expect(consentRow.value.validationFailures.length).toBeGreaterThan(0);
      expect(loaded.props.updateAction).not.toBeCalled();
      expect(loaded.props.onClose).not.toBeCalled();

      // and the failure reaches the select rather than silently blocking the save
      loaded.wrapper.update();

      const consentSelect = loaded.wrapper
        .find('SelectElement')
        .filterWhere((node: any) => node.prop('name') === 'Consent Status');

      expect(consentSelect.length).toEqual(1);
      expect(consentSelect.prop('entry').validationFailures.length).toBeGreaterThan(0);
    });

    it('should save a language row with its property type', () => {
      const added = addRow(form.instance);

      form.instance.handleFieldChanged(added.uuid, {
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
