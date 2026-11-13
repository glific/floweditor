import TypeList, { TypeListProps } from 'components/nodeeditor/TypeList';
import { Type, Types } from 'config/interfaces';
import { getTypeConfig } from 'config/typeConfigs';
import { composeComponentTestUtils } from 'testUtils';

const setupWith = (initialType: Type) =>
  composeComponentTestUtils<TypeListProps>(TypeList, {
    __className: '',
    initialType,
    onChange: jest.fn()
  }).setup();

const optionTypes = (wrapper: any): string[] =>
  wrapper
    .find('TembaSelect')
    .prop('options')
    .map((config: Type) => config.type);

describe(TypeList.name, () => {
  it('keeps a hidden type in the options for a node that already has it', () => {
    const { wrapper } = setupWith(getTypeConfig(Types.set_contact_field));

    expect(optionTypes(wrapper)).toContain(Types.set_contact_field);
  });

  it('leaves hidden types out of the options for other nodes', () => {
    const { wrapper } = setupWith(getTypeConfig(Types.send_msg));

    expect(optionTypes(wrapper)).not.toContain(Types.set_contact_field);
  });

  it('ignores an empty selection', () => {
    const { instance, props } = setupWith(getTypeConfig(Types.send_msg));

    (instance as any).handleChangeType(undefined);

    expect(props.onChange).not.toHaveBeenCalled();
  });
});
