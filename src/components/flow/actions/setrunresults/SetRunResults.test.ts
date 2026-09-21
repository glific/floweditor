import SetRunResultsComp, {
  MAX_TO_SHOW
} from 'components/flow/actions/setrunresults/SetRunResults';
import { SetRunResults } from 'flowTypes';
import { composeComponentTestUtils } from 'testUtils';
import { createSetRunResultsAction } from 'testUtils/assetCreators';

const resultsAction = (count: number): SetRunResults => {
  const action = createSetRunResultsAction();

  action.results = Array.from({ length: count }, (_, index) => ({
    name: `result_${index}`,
    value: `value ${index}`,
    category: ''
  }));

  return action;
};

describe(SetRunResultsComp.name, () => {
  const { setup } = composeComponentTestUtils(SetRunResultsComp, createSetRunResultsAction());

  describe('render', () => {
    it('should render every result when under the cap', () => {
      const { wrapper } = setup(true);
      expect(wrapper.find('.result').length).toEqual(2);
      expect(wrapper.find('.more').length).toEqual(0);
      expect(wrapper).toMatchSnapshot();
    });

    it('should render nothing with no results', () => {
      const action = createSetRunResultsAction();
      action.results = [];

      const { wrapper } = setup(true, { $set: action });
      expect(wrapper.children().length).toEqual(0);
    });

    it('should render nothing when results is missing', () => {
      const action = createSetRunResultsAction();
      delete (action as any).results;

      const { wrapper } = setup(true, { $set: action });
      expect(wrapper.children().length).toEqual(0);
    });

    it('should cap the rows and count the remainder', () => {
      const { wrapper } = setup(true, { $set: resultsAction(MAX_TO_SHOW + 7) });

      expect(wrapper.find('.result').length).toEqual(MAX_TO_SHOW);
      expect(wrapper.find('.more').text()).toEqual('+7 more');
      expect(wrapper).toMatchSnapshot();
    });

    it('should render exactly the cap without a remainder', () => {
      const { wrapper } = setup(true, { $set: resultsAction(MAX_TO_SHOW) });

      expect(wrapper.find('.result').length).toEqual(MAX_TO_SHOW);
      expect(wrapper.find('.more').length).toEqual(0);
    });

    it('should render an empty value as clearing the result', () => {
      const action = createSetRunResultsAction();
      action.results = [{ name: 'Name', value: '', category: '' }];

      const { wrapper } = setup(true, { $set: action });
      expect(wrapper.find('.result').text()).toContain('Clear');
      expect(wrapper).toMatchSnapshot();
    });

    it('should render repeated result names without colliding', () => {
      const action = createSetRunResultsAction();
      action.results = [
        { name: 'second', value: 'a', category: '' },
        { name: 'second', value: 'b', category: '' },
        { name: 'second', value: 'c', category: '' }
      ];

      const { wrapper } = setup(true, { $set: action });
      expect(wrapper.find('.result').length).toEqual(3);
    });
  });
});
