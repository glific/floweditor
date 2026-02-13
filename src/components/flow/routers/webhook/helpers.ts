import { createServiceCallSplitNode } from 'components/flow/routers/helpers';
import { WebhookRouterFormState } from 'components/flow/routers/webhook/WebhookRouterForm';
import { DEFAULT_BODY } from 'components/nodeeditor/constants';
import { Operators, Types } from 'config/interfaces';
import { CallWebhook, SwitchRouter } from 'flowTypes';
import { RenderNode } from 'store/flowContext';
import { NodeEditorSettings, StringEntry } from 'store/nodeEditor';
import { ValidatorFunc } from 'store/validators';
import { createUUID } from 'utils';
import axios from 'axios';

export enum Methods {
  GET = 'GET',
  POST = 'POST',
  PUT = 'PUT',
  DELETE = 'DELETE',
  HEAD = 'HEAD',
  FUNCTION = 'FUNCTION'
}

export interface MethodOption {
  value: string;
  name: string;
}

interface HeaderMap {
  [name: string]: string;
}

export const GET_METHOD: MethodOption = {
  value: Methods.GET,
  name: Methods.GET
};

export const METHOD_OPTIONS: MethodOption[] = [
  { value: Methods.FUNCTION, name: Methods.FUNCTION },
  GET_METHOD,
  { value: Methods.POST, name: Methods.POST }
  // { value: Methods.PUT, name: Methods.PUT },
  // { value: Methods.DELETE, name: Methods.DELETE }, // These methods are not needed currently
  // { value: Methods.HEAD, name: Methods.HEAD },
  // { value: Methods.PATCH, name: Methods.PATCH },
];

export const getOriginalAction = (settings: NodeEditorSettings): CallWebhook => {
  const action =
    settings.originalAction ||
    (settings.originalNode.node.actions.length > 0 && settings.originalNode.node.actions[0]);

  if (action.type === Types.call_webhook) {
    return action as CallWebhook;
  }
};

export const nodeToState = (settings: NodeEditorSettings): WebhookRouterFormState => {
  // TODO: work out an incremental result name
  const router = settings.originalNode.node.router as SwitchRouter;
  const resultName: StringEntry = { value: 'result' };

  const state: WebhookRouterFormState = {
    headers: [],
    resultName,
    method: { value: GET_METHOD },
    url: { value: '' },
    body: { value: getDefaultBody(Methods.GET) },
    webhookFunction: { value: null },
    webhookOptions: [],
    valid: false,
    isLoading: false
  };

  const action = getOriginalAction(settings) as CallWebhook;
  if (action) {
    state.resultName = { value: action.result_name || router.result_name || '' };
    state.url = { value: action.url };
    state.method = { value: { name: action.method, value: action.method } };
    state.body = { value: action.body ?? getDefaultBody(action.method) };
    state.valid = true;
    if (action.headers) {
      state.headers = Object.entries(action.headers).map(([name, value]) => ({
        value: {
          uuid: createUUID(),
          name,
          value
        }
      }));
    }
  } else {
    state.headers.push({
      value: {
        uuid: createUUID(),
        name: 'Accept',
        value: 'application/json'
      }
    });
    state.method = { value: { name: Methods.FUNCTION, value: Methods.FUNCTION } };
    state.url = { value: '' };
    state.body = { value: getDefaultBody(Methods.FUNCTION) };
  }

  // one empty header
  state.headers.push({
    value: {
      uuid: createUUID(),
      name: '',
      value: ''
    }
  });

  return state;
};

export const stateToNode = (
  settings: NodeEditorSettings,
  state: WebhookRouterFormState
): RenderNode => {
  const headers: HeaderMap = {};

  for (const entry of state.headers) {
    if (entry.value.name.trim().length !== 0) {
      headers[entry.value.name] = entry.value.value;
    }
  }

  let uuid = createUUID();

  const originalAction = getOriginalAction(settings);
  if (originalAction) {
    uuid = originalAction.uuid;
  }

  const newAction: CallWebhook = {
    uuid,
    headers,
    type: Types.call_webhook,
    url: state.url.value,
    body: state.body.value,
    method: state.method.value.value as Methods,
    result_name: state.resultName.value
  };

  // if the action had the result name, keep the result on the action rather than the router
  if (originalAction && originalAction.result_name) {
    newAction.result_name = state.resultName.value;
  }

  return createServiceCallSplitNode(
    newAction,
    settings.originalNode,
    '@webhook.status',
    Operators.has_number_between,
    ['200', '299'],
    newAction.result_name ? '' : state.resultName.value // put result on router if not on action
  );
};

export const getDefaultBody = (method: string): string => {
  return method === Methods.GET ? '' : DEFAULT_BODY;
};

export interface WebhookOption {
  name: string;
  value: string;
  id: string;
  label: string;
  body?: string;
}

export const fetchWebhookOptions = async (
  endpoint: string,
  currentUrl: string
): Promise<Pick<WebhookRouterFormState, 'webhookOptions' | 'webhookFunction' | 'isLoading'>> => {
  const response = await axios.get(endpoint);
  const data = response.data;

  const webhookOptions: WebhookOption[] =
    data.webhook.map((webhook: any) => ({
      name: webhook.name,
      value: webhook.name,
      id: webhook.name,
      label: webhook.name,
      body: webhook.body
    })) ?? [];

  const stateUpdate: Pick<
    WebhookRouterFormState,
    'webhookOptions' | 'webhookFunction' | 'isLoading'
  > = {
    webhookOptions,
    webhookFunction: { value: null },
    isLoading: false
  };

  if (currentUrl) {
    stateUpdate.webhookFunction = {
      value: {
        name: currentUrl,
        value: currentUrl,
        id: currentUrl,
        label: currentUrl
      }
    };
  }

  return stateUpdate;
};

export const isValidJson = (): ValidatorFunc => (name, body: any) => {
  try {
    var o = JSON.parse(body);

    if (o && typeof o === 'object') {
      return { failures: [], value: body };
    }
  } catch (e) {
    return { failures: [{ message: 'Not a valid JSON' }], value: body };
  }
};
