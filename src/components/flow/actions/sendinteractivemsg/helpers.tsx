/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { getActionUUID } from 'components/flow/actions/helpers';
import { Operators, Types } from 'config/interfaces';
import * as React from 'react';
import { Label, SendInteractiveMsg } from 'flowTypes';
import { NodeEditorSettings } from 'store/nodeEditor';
import styles from './SendInteractiveMsg.module.scss';
import { ReactComponent as ButtonIcon } from './icons/button.svg';

import { SendInteractiveMsgFormState } from './SendInteractiveMsgForm';
import { createUUID } from 'utils';
import { stateToNode } from 'components/flow/routers/response/helpers';
import { AssetStore, RenderNode } from 'store/flowContext';

export const initializeForm = (settings: NodeEditorSettings): SendInteractiveMsgFormState => {
  if (settings.originalAction && settings.originalAction.type === Types.send_interactive_msg) {
    const action = settings.originalAction as SendInteractiveMsg;
    let { id, name, expression, params, paramsCount } = action;
    const interactive_content = action.text ? JSON.parse(action.text) : null;

    const labels = action.labels
      ? action.labels.map((label: Label) => {
          if (label.name_match) {
            return { name: label.name_match, expression: true };
          }
          return label;
        })
      : [];

    const listValues = params
      ? params.map((param: string) => {
          return { value: param };
        })
      : [];

    while (listValues.length < 10) {
      listValues.push({ value: { id: '', label: '' } });
    }
    const returnValue: SendInteractiveMsgFormState = {
      interactives: { value: { id, interactive_content, name } },
      labels: {
        value: labels
      },
      valid: true,
      listValues,
      listValuesCount: paramsCount,
      attachment_url: { value: action.attachment_url || '' },
      attachment_type: { value: action.attachment_type || '' }
    };

    if (paramsCount) {
      returnValue.isChecked = true;
    }

    if (expression || expression === '') {
      returnValue.expression = {
        value: expression
      };
    }
    return returnValue;
  }

  return {
    isChecked: false,
    expression: null,
    interactives: { value: '' },
    labels: {
      value: []
    },
    listValues: Array(10).fill({ value: { id: '', label: '' } }),
    valid: false,
    listValuesCount: '',
    attachment_url: { value: '' },
    attachment_type: { value: '' }
  };
};

export const stateToAction = (
  settings: NodeEditorSettings,
  state: SendInteractiveMsgFormState
): SendInteractiveMsg => {
  let result: any = {};

  const params = state.listValues
    .filter(listItem => listItem.value.label !== '')
    .map(listItem => listItem.value);

  const paramsCount = state.listValuesCount;

  if (state.expression) {
    result = {
      params,
      paramsCount,
      name: state.interactives.value.name,
      expression: state.expression.value,
      type: Types.send_interactive_msg,
      uuid: getActionUUID(settings, Types.send_interactive_msg)
    };
    return result;
  }

  result = {
    id: state.interactives.value.id,
    text: JSON.stringify(state.interactives.value.interactive_content),
    name: state.interactives.value.name,
    labels: state.labels.value.map((label: any) => {
      if (label.expression) {
        return { name_match: label.name };
      }
      return label;
    }),
    type: Types.send_interactive_msg,
    uuid: getActionUUID(settings, Types.send_interactive_msg)
  };

  if (state.isChecked) {
    result.params = params;
    result.paramsCount = paramsCount;
  }

  if (state.attachment_type) {
    result.attachment_type = state.attachment_type.value;
  }
  if (state.attachment_url) {
    result.attachment_url = state.attachment_url.value;
  }

  return result;
};

// the single category a blocks router routes every response through. The backend
// (router.ex find_category/3) falls through to the router's default category when no
// case matches, so a blocks_response - and any plain text reply from a contact on a
// channel that cannot render blocks - takes this exit.
export const BLOCKS_CATEGORY_NAME = 'Responded';

// shown on the canvas node for a blocks template whose component we cannot name
export const BLOCKS_LABEL = 'Blocks';

// shown when an interactive template carries no readable text at all
export const UNSUPPORTED_MESSAGE = 'The interactive message cannot be previewed';

// shown on the canvas when a block payload has no text nodes to derive a body from
export const BLOCKS_NO_TEXT_MESSAGE = 'This block has no text to preview';

// blocks contract section 9: text node values joined with this, clamped to this length
const DERIVED_BODY_SEPARATOR = ' — ';
const DERIVED_BODY_MAX_LENGTH = 500;

export const stateToRouter = (
  settings: NodeEditorSettings,
  state: SendInteractiveMsgFormState,
  assetStore: AssetStore
): RenderNode => {
  let cases = [];
  const translations = state.interactives.value.translations;

  const content = state.interactives.value.interactive_content;
  let options = [''];
  let defaultCategoryName: string = null;
  if (content) {
    if (content.type === 'quick_reply')
      content.options.forEach((option: any) => {
        options.push(option.title);
      });

    if (content.type === 'list') {
      content.items.forEach((item: any) => {
        item.options.forEach((option: any) => {
          options.push(option.title);
        });
      });
    }
    if (content.type === 'location_request_message') {
      const uuid = createUUID();
      const values: any = {
        uuid,
        categoryName: `Has location`,
        kase: {
          arguments: [],
          type: Operators.has_location,
          uuid,
          category_uuid: null
        },
        valid: true
      };
      cases.push(values);
    }
    if (content.type === 'blocks') {
      // no cases at all: every response falls through to the router's default category,
      // which we name "Responded" below.
      options = [];
      defaultCategoryName = BLOCKS_CATEGORY_NAME;
    }
  }
  const generateCases = options.map((option: string, index: number) => {
    const uuid = createUUID();
    const values: any = {
      uuid,
      categoryName: `${option.charAt(0).toUpperCase()}${option.slice(1)}`,
      kase: {
        arguments: [option],
        type: Operators.has_only_phrase,
        uuid,
        category_uuid: null
      },
      valid: true,
      translations: {}
    };
    if (option) {
      values.translations = Object.keys(translations).reduce((acc: any, lang: any) => {
        const translation = translations[lang];

        if (translation.type === 'list') {
          const matchedOption = translation.items.flatMap((item: any) => item.options)[index - 1];

          if (matchedOption) {
            acc[lang] = {
              arguments: [matchedOption.title]
            };
          }
        } else if (translation.type === 'quick_reply') {
          acc[lang] = {
            arguments: [translation.options[index - 1].title]
          };
        }

        return acc;
      }, {});
    }

    return values;
  });

  cases = cases.concat(generateCases);

  let result: any = {
    cases,
    resultName: {
      value: ''
    },
    timeout: -1,
    expression: '',
    valid: true,
    defaultCategoryName
  };

  let renderedNode;

  if (settings.originalNode.ghost) {
    renderedNode = stateToNode(settings, result, assetStore);
  } else {
    if (settings.originalNode.node.exits[0].destination_uuid) {
      settings = {
        ...settings,
        originalNode: {
          ...settings.originalNode,
          node: {
            ...settings.originalNode.node,
            uuid: settings.originalNode.node.exits[0].destination_uuid
          }
        }
      };
    }
    renderedNode = stateToNode(settings, result, assetStore);
  }

  return renderedNode;
};

// "glific/image-panel" -> "Image panel". A component outside the glific namespace is
// org registered, so we have no friendly name for it and show it verbatim.
export const getComponentName = (component: any): string => {
  if (typeof component !== 'string' || component === '') {
    return BLOCKS_LABEL;
  }

  if (!component.startsWith('glific/')) {
    return component;
  }

  const name = component.slice('glific/'.length).replace(/-/g, ' ');
  return name ? `${name.charAt(0).toUpperCase()}${name.slice(1)}` : BLOCKS_LABEL;
};

const isTypedNode = (value: any): boolean => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }

  const keys = Object.keys(value);
  return (
    keys.includes('kind') &&
    keys.includes('value') &&
    keys.every((key: string) => ['kind', 'value', 'translate'].includes(key))
  );
};

const collectTextValues = (value: any, collected: string[]): void => {
  if (Array.isArray(value)) {
    value.forEach((element: any) => collectTextValues(element, collected));
    return;
  }

  if (typeof value !== 'object' || value === null) {
    return;
  }

  if (isTypedNode(value)) {
    if (value.kind === 'text') {
      if (typeof value.value === 'string' && value.value !== '') {
        collected.push(value.value);
      }
    } else if (value.kind === 'list') {
      collectTextValues(value.value, collected);
    }
    // `alt` is deliberately skipped even though it is translated prose: it is accessibility
    // metadata, and this body is the staff conversation-list preview and the search index.
    // Every other kind holds a leaf that is never human readable text.
    return;
  }

  Object.keys(value).forEach((key: string) => collectTextValues(value[key], collected));
};

const clamp = (text: string, limit: number): string => {
  if (text.length <= limit) {
    return text;
  }

  // never split a surrogate pair
  const end = text.charCodeAt(limit - 1) >= 0xd800 && text.charCodeAt(limit - 1) <= 0xdbff;
  return text.slice(0, end ? limit - 1 : limit);
};

/**
 * The derived body of the blocks contract, section 9: walk the stored (typed) payload in
 * document order, join the value of every text node with an em dash, clamp to 500 chars.
 * `alt` nodes are skipped.
 * Returns an empty string when the payload carries no text - the same rule the backend and
 * the console apply, so every surface derives an identical body.
 */
export const deriveBodyText = (message: any): string => {
  const collected: string[] = [];
  collectTextValues(message, collected);
  return clamp(collected.join(DERIVED_BODY_SEPARATOR), DERIVED_BODY_MAX_LENGTH);
};

export const getHeader = (message: any) => {
  let header;
  if (message) {
    if (message.type === 'list') {
      header = message.title;
    } else if (message.type === 'quick_reply') {
      if (message.content.type === 'text') {
        header = message.content.header;
      } else if (['image', 'video', 'file'].includes(message.content.type)) {
        header = '';
      }
    } else if (message.type === 'blocks') {
      header = getComponentName(message.component);
    }
  }
  // any other (unknown / future) type intentionally has no header
  return header;
};

// a plain string we can always fall back to so an unrecognized payload renders text
// instead of leaving the node on a permanent loading spinner
const getFallbackText = (message: any): string => {
  const candidates = [message.fallback, message.body, message.text, message.title];
  const text = candidates.find((value: any) => typeof value === 'string' && value.trim() !== '');
  return text || UNSUPPORTED_MESSAGE;
};

export const getMsgBody = (message: any) => {
  let body;
  if (message) {
    if (message.type === 'list') {
      body = (
        <div>
          <div>{message.body}</div>
          <div className={styles.listButton}>
            <ButtonIcon />
            {message.globalButtons[0].title}
          </div>
        </div>
      );
    } else if (message.type === 'quick_reply') {
      if (message.content.type === 'text') {
        body = message.content.text;
      } else if (['image', 'video', 'file'].includes(message.content.type)) {
        body = (
          <div className={styles.attachment}>
            <div className="fe-paperclip" />
            {message.content.text}
          </div>
        );
      }

      body = (
        <div>
          <div>{body}</div>
          {message.options.map((option: any) => (
            <div className={styles.listButton} key={option.title}>
              {option.title}
            </div>
          ))}
        </div>
      );
    } else if (message.type === 'location_request_message') {
      body = (
        <div>
          <span className="fe-map-marker" />
          {message.body.text}
        </div>
      );
    } else if (message.type === 'blocks') {
      body = <div>{deriveBodyText(message) || BLOCKS_NO_TEXT_MESSAGE}</div>;
    } else {
      // any unknown / future interactive type: degrade to readable text rather than
      // leaving the canvas node on an endless loading spinner
      body = <div>{getFallbackText(message)}</div>;
    }
  }
  return body;
};
