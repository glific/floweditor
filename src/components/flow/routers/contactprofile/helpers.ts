import { getActionUUID } from 'components/flow/actions/helpers';
import { createServiceCallSplitNode } from 'components/flow/routers/helpers';

import { Operators, Types } from 'config/interfaces';
import { ServiceCallExitNames, SetContactProfile } from 'flowTypes';
import { RenderNode } from 'store/flowContext';
import { NodeEditorSettings } from 'store/nodeEditor';

import { ContactProfileRouterFormState, profileOptionsList } from './ContactProfileRouterForm';
import { snakify } from 'utils';

export const nodeToState = (settings: NodeEditorSettings): ContactProfileRouterFormState => {
  let resulNode: ContactProfileRouterFormState = {
    valid: true,
    optionType: { value: profileOptionsList[0] },
    profileName: { value: '' },
    profileType: { value: '' }
  };

  if (settings.originalAction && settings.originalAction.type === Types.set_contact_profile) {
    const action = settings.originalAction as SetContactProfile;

    if (action.profile_type) {
      const option =
        profileOptionsList.find(value => value.name === action.profile_type) ||
        profileOptionsList[0];

      resulNode.optionType = {
        value: option.name
      };

      if (typeof action.value === 'string') {
        resulNode.profileName = { value: action.value };
      } else {
        resulNode.profileName = { value: action.value.name };
        resulNode.profileType = { value: action.value.type };
      }
    }
  }
  console.log(resulNode);
  return resulNode;
};

export const stateToNode = (
  settings: NodeEditorSettings,
  state: ContactProfileRouterFormState
): RenderNode => {
  const { optionType, profileName, profileType } = state;

  const newAction: SetContactProfile = {
    profile_type: optionType.value.name,
    result_name: profileName.value,
    value:
      optionType.value.name === 'Create Profile'
        ? { name: profileName.value, type: profileType.value }
        : profileName.value,
    type: Types.set_contact_profile,
    uuid: getActionUUID(settings, Types.set_contact_profile)
  };

  return createServiceCallSplitNode(
    newAction,
    settings.originalNode,
    '@results.' + snakify(state.profileName.value),
    Operators.has_category,
    [ServiceCallExitNames.Success]
  );
};
