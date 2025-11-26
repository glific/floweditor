import { createServiceCallSplitNode } from 'components/flow/routers/helpers';
import { Operators, Types } from 'config/interfaces';
import { getType } from 'config/typeConfigs';
import { OpenTicket, SwitchRouter, Topic, User } from 'flowTypes';
import { RenderNode } from 'store/flowContext';
import { NodeEditorSettings, FormEntry } from 'store/nodeEditor';
import { createUUID } from 'utils';
import { TicketRouterFormState } from 'components/flow/routers/ticket/TicketRouterForm';

export const getUserName = (user: User): string => {
  console.log(user);
  if (!user.first_name && !user.last_name) {
    return user.email || '';
  }
  return `${user.first_name} ${user.last_name}`;
};

export const getOriginalAction = (settings: NodeEditorSettings): OpenTicket => {
  const action =
    settings.originalAction ||
    (settings.originalNode.node.actions.length > 0 && settings.originalNode.node.actions[0]);

  if (action.type === Types.open_ticket) {
    return action as OpenTicket;
  }
};

export const nodeToState = (settings: NodeEditorSettings): TicketRouterFormState => {
  const router = settings.originalNode.node.router as SwitchRouter;

  let subject = { value: '@run.flow.name' };
  let body = { value: '@results' };
  let resultName = { value: 'result' };
  let assignee: FormEntry = { value: null };
  let topic: FormEntry = { value: null };

  if (getType(settings.originalNode) === Types.split_by_ticket) {
    const action = getOriginalAction(settings) as OpenTicket;
    subject = { value: action.subject };
    body = { value: action.body };
    topic = { value: action.topic };
    assignee = { value: action.assignee };
    resultName = { value: router.result_name || action.result_name || '' };
  }

  const state: TicketRouterFormState = {
    assignee,
    topic,
    subject,
    body,
    resultName,
    valid: true
  };

  return state;
};

export const stateToNode = (
  settings: NodeEditorSettings,
  state: TicketRouterFormState
): RenderNode => {
  let uuid = createUUID();
  const originalAction = getOriginalAction(settings);
  if (originalAction) {
    uuid = originalAction.uuid;
  }
  const topic = state.topic.value as Topic;
  const assignee = state.assignee.value as User;

  const newAction: OpenTicket = {
    uuid,
    type: Types.open_ticket,
    body: state.body.value,
    topic: topic ? { uuid: topic.uuid, name: topic.name } : null,
    assignee,
    result_name: state.resultName.value
  };

  return createServiceCallSplitNode(
    newAction,
    settings.originalNode,
    '@locals._new_ticket',
    Operators.has_text,
    [],
    state.resultName.value
  );
};
