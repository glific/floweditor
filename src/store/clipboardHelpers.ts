import { Types } from 'config/interfaces';
import {
  AnyAction,
  Case,
  Category,
  Exit,
  FlowIssue,
  FlowIssueType,
  FlowNode,
  SetRunResult,
  SwitchRouter
} from 'flowTypes';
import { RenderNode } from 'store/flowContext';
import { createUUID, snakify } from 'utils';

export const CLIPBOARD_KEY = 'floweditor_clipboard';

const RESULTS_REGEX_SRC = /@results\.([a-zA-Z0-9_]+)/;

export const cloneNodeWithNewUUIDs = (source: RenderNode): RenderNode => {
  const cloned: RenderNode = JSON.parse(JSON.stringify(source));
  const uuidMap: { [old: string]: string } = {};

  const newNodeUUID = createUUID();
  uuidMap[cloned.node.uuid] = newNodeUUID;
  cloned.node.uuid = newNodeUUID;

  if (cloned.node.actions) {
    cloned.node.actions.forEach((action: AnyAction) => {
      const newUUID = createUUID();
      uuidMap[action.uuid] = newUUID;
      action.uuid = newUUID;
    });
  }

  if (cloned.node.exits) {
    cloned.node.exits.forEach((exit: Exit) => {
      const newUUID = createUUID();
      uuidMap[exit.uuid] = newUUID;
      exit.uuid = newUUID;
      exit.destination_uuid = null;
    });
  }

  if (cloned.node.router) {
    const router = cloned.node.router as SwitchRouter;

    if (router.categories) {
      router.categories.forEach((category: Category) => {
        const newCatUUID = createUUID();
        uuidMap[category.uuid] = newCatUUID;
        category.uuid = newCatUUID;
        if (uuidMap[category.exit_uuid]) {
          category.exit_uuid = uuidMap[category.exit_uuid];
        }
      });
    }

    if (router.cases) {
      router.cases.forEach((caseItem: Case) => {
        const newCaseUUID = createUUID();
        uuidMap[caseItem.uuid] = newCaseUUID;
        caseItem.uuid = newCaseUUID;
        if (uuidMap[caseItem.category_uuid]) {
          caseItem.category_uuid = uuidMap[caseItem.category_uuid];
        }
      });
    }

    if (router.default_category_uuid && uuidMap[router.default_category_uuid]) {
      router.default_category_uuid = uuidMap[router.default_category_uuid];
    }
  }

  cloned.inboundConnections = {};
  delete cloned.ghost;

  return cloned;
};

export const generateCopyResultName = (original: string, existingKeys: string[]): string => {
  const base = `copy_of_${original}`;
  if (!existingKeys.includes(snakify(base))) {
    return base;
  }
  for (let i = 1; i < 100; i++) {
    const candidate = `copy_of_${original}_${String(i).padStart(2, '0')}`;
    if (!existingKeys.includes(snakify(candidate))) {
      return candidate;
    }
  }
  return `copy_of_${original}_${createUUID().slice(0, 8)}`;
};

export const resolveResultNames = (cloned: RenderNode, existingKeys: string[]): void => {
  const keys = [...existingKeys];

  if (cloned.node.actions) {
    cloned.node.actions.forEach((action: AnyAction) => {
      if (action.type === Types.set_run_result) {
        const setResult = action as SetRunResult;
        if (setResult.name) {
          const newName = generateCopyResultName(setResult.name, keys);
          setResult.name = newName;
          keys.push(snakify(newName));
        }
      }
    });
  }

  if (cloned.node.router && cloned.node.router.result_name) {
    const original = cloned.node.router.result_name;
    const newName = generateCopyResultName(original, keys);
    cloned.node.router.result_name = newName;
    keys.push(snakify(newName));
  }
};

export const detectCrossFlowIssues = (node: FlowNode, currentResultKeys: string[]): FlowIssue[] => {
  const issues: FlowIssue[] = [];
  const seen = new Set<string>();

  const checkStr = (str: string, actionUUID: string | null): void => {
    if (!str) {
      return;
    }
    const regex = new RegExp(RESULTS_REGEX_SRC.source, 'g');
    let match: RegExpExecArray;
    while ((match = regex.exec(str)) !== null) {
      const key = match[1];
      if (!currentResultKeys.includes(key) && !seen.has(key)) {
        seen.add(key);
        issues.push({
          type: FlowIssueType.MISSING_DEPENDENCY,
          node_uuid: node.uuid,
          action_uuid: actionUUID,
          description:
            'Invalid result variable detected. Please check the result variable configuration.'
        });
      }
    }
  };

  if (node.actions) {
    node.actions.forEach((action: AnyAction) => {
      checkStr(JSON.stringify(action), action.uuid);
    });
  }

  if (node.router) {
    const switchRouter = node.router as SwitchRouter;
    if (switchRouter.operand) {
      checkStr(switchRouter.operand, null);
    }
  }

  return issues;
};
