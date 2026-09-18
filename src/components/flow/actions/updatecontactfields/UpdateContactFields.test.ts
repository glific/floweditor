import UpdateContactFieldsComp, {
  MAX_TO_SHOW
} from 'components/flow/actions/updatecontactfields/UpdateContactFields';
import { SetContactFields } from 'flowTypes';
import { composeComponentTestUtils } from 'testUtils';
import { createSetContactFieldsAction } from 'testUtils/assetCreators';

const fieldsAction = (count: number): SetContactFields => {
  const action = createSetContactFieldsAction();

  action.fields = Array.from({ length: count }, (_, index) => ({
    field: { key: `field_${index}`, name: `Field ${index}` },
    value: `value ${index}`
  }));

  return action;
};

describe(UpdateContactFieldsComp.name, () => {
  const { setup } = composeComponentTestUtils(
    UpdateContactFieldsComp,
    createSetContactFieldsAction()
  );

  describe('render', () => {
    it('should render every field when under the cap', () => {
      const { wrapper } = setup(true);
      expect(wrapper.find('.field').length).toEqual(2);
      expect(wrapper.find('.more').length).toEqual(0);
      expect(wrapper).toMatchSnapshot();
    });

    it('should render nothing with no fields', () => {
      const action = createSetContactFieldsAction();
      action.fields = [];

      const { wrapper } = setup(true, { $set: action });
      expect(wrapper.children().length).toEqual(0);
    });

    it('should render nothing when fields is missing', () => {
      const action = createSetContactFieldsAction();
      delete (action as any).fields;

      const { wrapper } = setup(true, { $set: action });
      expect(wrapper.children().length).toEqual(0);
    });

    it('should cap the rows and count the remainder', () => {
      const { wrapper } = setup(true, { $set: fieldsAction(MAX_TO_SHOW + 7) });

      expect(wrapper.find('.field').length).toEqual(MAX_TO_SHOW);
      expect(wrapper.find('.more').text()).toEqual('+7 more');
      expect(wrapper).toMatchSnapshot();
    });

    it('should render exactly the cap without a remainder', () => {
      const { wrapper } = setup(true, { $set: fieldsAction(MAX_TO_SHOW) });

      expect(wrapper.find('.field').length).toEqual(MAX_TO_SHOW);
      expect(wrapper.find('.more').length).toEqual(0);
    });

    it('should render an empty value as clearing the field', () => {
      const action = createSetContactFieldsAction();
      action.fields = [{ field: { key: 'age', name: 'Age' }, value: '' }];

      const { wrapper } = setup(true, { $set: action });
      expect(wrapper.find('.field').text()).toContain('Clear');
      expect(wrapper).toMatchSnapshot();
    });

    it('should render repeated field keys without colliding', () => {
      const action = createSetContactFieldsAction();
      action.fields = [
        { field: { key: 'second', name: 'second' }, value: 'a' },
        { field: { key: 'second', name: 'second' }, value: 'b' },
        { field: { key: 'second', name: 'second' }, value: 'c' }
      ];

      const { wrapper } = setup(true, { $set: action });
      expect(wrapper.find('.field').length).toEqual(3);
    });
  });
});
