import Flow from 'components/flow/Flow';
import { FlowTypes, Types } from 'config/interfaces';
import {
  Case,
  Category,
  Exit,
  FlowDefinition,
  FlowIssueType,
  FlowPosition,
  RouterTypes,
  SendMsg
} from 'flowTypes';
import {
  cloneNodeWithNewUUIDs,
  createEmptyNode,
  detectCrossFlowIssues,
  getCollisions,
  getFlowComponents,
  getLocalizations,
  getOrderedNodes,
  getUniqueDestinations,
  guessNodeType,
  resolveResultNames
} from 'store/helpers';
import { AssetStore, AssetType, RenderNode, RenderNodeMap } from 'store/flowContext';
import {
  createAirtimeTransferNode,
  createCallResthookAction,
  createCallWebhookAction,
  createGroupsRouterNode,
  createMatchRouter,
  createRandomNode,
  createResthookNode,
  createStartFlowAction,
  createSubflowNode,
  createTransferAirtimeAction,
  createWebhookNode,
  Spanish
} from 'testUtils/assetCreators';
import { createUUID } from 'utils';

const mutate = require('immutability-helper');

describe('helpers', () => {
  const definition: FlowDefinition = require('test/flows/boring.json');

  describe('initializeFlow', () => {
    it('should find groups in definition', () => {
      const flowDetails = getFlowComponents(definition);
      expect(flowDetails.groups).toMatchSnapshot();
    });

    it('should find fields in definition', () => {
      const flowDetails = getFlowComponents(definition);
      expect(flowDetails.fields).toMatchSnapshot();
    });

    it('should find labels in definition', () => {
      const flowDetails = getFlowComponents(definition);
      expect(flowDetails.labels).toMatchSnapshot();
    });

    it('should find results in definition', () => {
      const flowDetails = getFlowComponents(definition);
      expect(flowDetails.results).toMatchSnapshot();
    });

    it('should guess node types', () => {
      // guess an action node
      expect(
        guessNodeType({
          uuid: createUUID(),
          actions: [{ uuid: createUUID(), type: Types.send_msg }],
          exits: []
        })
      ).toBe(Types.execute_actions);

      // guess a subflow
      expect(
        guessNodeType(createSubflowNode(createStartFlowAction(), FlowTypes.MESSAGING).node)
      ).toBe(Types.split_by_subflow);

      // guess a resthook
      expect(guessNodeType(createResthookNode(createCallResthookAction()).node)).toBe(
        Types.split_by_resthook
      );

      // guess an airtime node
      expect(guessNodeType(createAirtimeTransferNode(createTransferAirtimeAction()).node)).toBe(
        Types.split_by_airtime
      );

      // guess a webhook node
      expect(guessNodeType(createWebhookNode(createCallWebhookAction()))).toBe(
        Types.split_by_webhook
      );

      // guess groups split
      expect(guessNodeType(createGroupsRouterNode().node)).toBe(Types.split_by_groups);

      // guess random router
      expect(guessNodeType(createRandomNode(3).node)).toBe(Types.split_by_random);

      // split by expression
      const waitNode = createMatchRouter(['Red', 'Green']).node;
      expect(guessNodeType(waitNode)).toBe(Types.wait_for_response);

      // now remove the wait so it's an expression
      waitNode.router.wait = undefined;
      expect(guessNodeType(waitNode)).toBe(Types.split_by_expression);
    });
  });

  describe('RenderNodeMap', () => {
    const nodes = getFlowComponents(definition).renderNodeMap;

    it('should get unique destinations', () => {
      expect(getUniqueDestinations(nodes.node0.node)).toEqual(['node1']);
      expect(getUniqueDestinations(nodes.node1.node)).toEqual(['node2']);
      expect(getUniqueDestinations(nodes.node2.node)).toEqual(['node3']);
      expect(getUniqueDestinations(nodes.node3.node)).toEqual([]);
    });

    it('should get ordered nodes', () => {
      const nodesToOrder = mutate(nodes, {
        node1: {
          ui: { position: { $merge: { top: 0, left: 500 } } }
        }
      });

      const ordered = getOrderedNodes(nodesToOrder);
      expect(ordered[0].node.uuid).toBe('node0');
      expect(ordered[1].node.uuid).toBe('node1');
      expect(ordered).toMatchSnapshot();
    });

    it('should identify collisions', () => {
      const collides = (box: FlowPosition, collisions: string[]) => {
        expect(Object.keys(getCollisions(nodes, {}, box))).toEqual(collisions);
      };

      collides({ left: 0, top: 0, right: 200, bottom: 150 }, ['node0']);
      collides({ left: 0, top: 100, right: 200, bottom: 300 }, ['node0', 'node1']);
      collides({ left: 0, top: 100, right: 200, bottom: 500 }, ['node0', 'node1', 'node2']);
    });

    describe('getLocalizations', () => {
      it('should get localized actions', () => {
        const node = nodes.node0.node;
        const translations = {
          [node.actions[0].uuid]: { text: ['this is espanols'] }
        };

        const localizations = getLocalizations(node, node.actions[0], Spanish, translations);

        expect((localizations[0].getObject() as SendMsg).text).toEqual('this is espanols');
      });

      it('should get localized cases', () => {
        const node = nodes.node1.node;
        const translations = {
          node1_cat0: { name: ['this is espanols'] },
          node1_case0: { arguments: ['espanol case'] }
        };

        const localizations = getLocalizations(node, node.actions[0], Spanish, translations);

        expect((localizations[0].getObject() as Case).arguments).toEqual(['espanol case']);
        expect((localizations[2].getObject() as Category).name).toEqual('this is espanols');
      });
    });

    describe('getGhostNode', () => {
      it('should create a router from an action', () => {
        const ghost = createEmptyNode(
          nodes.node0,
          nodes.node0.node.exits[0].uuid,
          1,
          FlowTypes.MESSAGING
        );
        expect(ghost.node.router.type).toBe(RouterTypes.switch);
      });
      it('should create an action node from a switch', () => {
        const ghost = createEmptyNode(
          nodes.node1,
          nodes.node1.node.exits[0].uuid,
          1,
          FlowTypes.MESSAGING
        );
        expect(ghost.node.router).toBeUndefined();
        expect(ghost.node.actions[0].type).toBe(Types.send_msg);
      });
    });
  });
});

describe('copy-paste helpers', () => {
  const makeSimpleNode = (): RenderNode => ({
    node: {
      uuid: 'node-1',
      actions: [{ uuid: 'action-1', type: Types.send_msg } as any],
      exits: [{ uuid: 'exit-1', destination_uuid: 'other-node' }]
    },
    ui: { position: { left: 100, top: 200 }, type: Types.send_msg },
    inboundConnections: { 'prev-node': 'prev-exit' },
    ghost: true
  });

  const makeRouterNode = (): RenderNode => ({
    node: {
      uuid: 'router-node',
      actions: [],
      exits: [
        { uuid: 'exit-a', destination_uuid: 'dest-a' },
        { uuid: 'exit-b', destination_uuid: null }
      ],
      router: {
        type: RouterTypes.switch,
        result_name: 'my_result',
        categories: [
          { uuid: 'cat-1', name: 'Yes', exit_uuid: 'exit-a' },
          { uuid: 'cat-2', name: 'No', exit_uuid: 'exit-b' }
        ],
        cases: [{ uuid: 'case-1', type: 'has_any_word' as any, category_uuid: 'cat-1' }],
        operand: '@input.text',
        default_category_uuid: 'cat-2'
      } as any
    },
    ui: { position: { left: 0, top: 0 }, type: Types.wait_for_response },
    inboundConnections: {}
  });

  describe('cloneNodeWithNewUUIDs', () => {
    it('assigns new uuid to node', () => {
      const source = makeSimpleNode();
      const cloned = cloneNodeWithNewUUIDs(source);
      expect(cloned.node.uuid).not.toBe(source.node.uuid);
    });

    it('assigns new uuid to each action', () => {
      const source = makeSimpleNode();
      const cloned = cloneNodeWithNewUUIDs(source);
      expect(cloned.node.actions[0].uuid).not.toBe(source.node.actions[0].uuid);
    });

    it('assigns new uuid to each exit and nulls destination_uuid', () => {
      const source = makeSimpleNode();
      const cloned = cloneNodeWithNewUUIDs(source);
      expect(cloned.node.exits[0].uuid).not.toBe(source.node.exits[0].uuid);
      expect(cloned.node.exits[0].destination_uuid).toBeNull();
    });

    it('remaps category and case UUIDs on router nodes', () => {
      const source = makeRouterNode();
      const cloned = cloneNodeWithNewUUIDs(source);
      const router = cloned.node.router as any;
      expect(router.categories[0].uuid).not.toBe('cat-1');
      expect(router.categories[0].exit_uuid).not.toBe('exit-a');
      expect(router.cases[0].uuid).not.toBe('case-1');
      expect(router.cases[0].category_uuid).not.toBe('cat-1');
      expect(router.default_category_uuid).not.toBe('cat-2');
    });

    it('resets inboundConnections to empty object', () => {
      const source = makeSimpleNode();
      const cloned = cloneNodeWithNewUUIDs(source);
      expect(cloned.inboundConnections).toEqual({});
    });

    it('deletes ghost property', () => {
      const source = makeSimpleNode();
      const cloned = cloneNodeWithNewUUIDs(source);
      expect(cloned.ghost).toBeUndefined();
    });

    it('does not mutate the source node', () => {
      const source = makeSimpleNode();
      const originalUUID = source.node.uuid;
      cloneNodeWithNewUUIDs(source);
      expect(source.node.uuid).toBe(originalUUID);
    });

    it('remaps wait.timeout.category_uuid to the new category uuid', () => {
      const source: RenderNode = {
        node: {
          uuid: 'wfr-node',
          actions: [],
          exits: [
            { uuid: 'exit-yes', destination_uuid: null },
            { uuid: 'exit-timeout', destination_uuid: null }
          ],
          router: {
            type: RouterTypes.switch,
            categories: [
              { uuid: 'cat-yes', name: 'Yes', exit_uuid: 'exit-yes' },
              { uuid: 'cat-timeout', name: 'Timeout', exit_uuid: 'exit-timeout' }
            ],
            cases: [] as any,
            operand: '@input.text',
            default_category_uuid: 'cat-yes',
            wait: {
              type: 'msg' as any,
              timeout: { category_uuid: 'cat-timeout', seconds: 300 }
            }
          } as any
        },
        ui: { position: { left: 0, top: 0 }, type: Types.wait_for_response },
        inboundConnections: {}
      };

      const cloned = cloneNodeWithNewUUIDs(source);
      const router = cloned.node.router as any;
      const newTimeoutCatUUID = router.wait.timeout.category_uuid;

      expect(newTimeoutCatUUID).not.toBe('cat-timeout');
      const matchingCategory = router.categories.find((c: any) => c.uuid === newTimeoutCatUUID);
      expect(matchingCategory).toBeDefined();
      expect(matchingCategory.name).toBe('Timeout');
    });
  });

  describe('resolveResultNames', () => {
    const emptyNodes: RenderNodeMap = {};

    it('renames set_run_result action name with copy_of_ prefix', () => {
      const node = {
        uuid: 'n1',
        actions: [{ uuid: 'a1', type: Types.set_run_result, name: 'my_result', value: '' } as any],
        exits: [] as Exit[]
      };
      const resolved = resolveResultNames(node, emptyNodes);
      expect((resolved.actions[0] as any).name).toBe('copy_of_my_result');
    });

    it('renames router result_name with copy_of_ prefix', () => {
      const node = makeRouterNode().node;
      const resolved = resolveResultNames(node, emptyNodes);
      expect(resolved.router.result_name).toBe('copy_of_my_result');
    });

    it('increments to _01 when copy_of_ name already exists', () => {
      const existingNode: RenderNode = {
        node: {
          uuid: 'existing',
          actions: [
            { uuid: 'a0', type: Types.set_run_result, name: 'copy_of_my_result', value: '' } as any
          ],
          exits: []
        },
        ui: { position: { left: 0, top: 0 }, type: Types.send_msg },
        inboundConnections: {}
      };
      const node = {
        uuid: 'n1',
        actions: [{ uuid: 'a1', type: Types.set_run_result, name: 'my_result', value: '' } as any],
        exits: [] as Exit[]
      };
      const resolved = resolveResultNames(node, { existing: existingNode });
      expect((resolved.actions[0] as any).name).toBe('copy_of_my_result_01');
    });

    it('does not mutate the input node', () => {
      const node = {
        uuid: 'n1',
        actions: [{ uuid: 'a1', type: Types.set_run_result, name: 'my_result', value: '' } as any],
        exits: [] as Exit[]
      };
      resolveResultNames(node, emptyNodes);
      expect((node.actions[0] as any).name).toBe('my_result');
    });

    it('treats names with spaces/hyphens as collisions when they snakify to the same key', () => {
      // "copy of my_result" snakifies to "copy_of_my_result" — same as "copy_of_my_result"
      const existingNode: RenderNode = {
        node: {
          uuid: 'existing',
          actions: [
            { uuid: 'a0', type: Types.set_run_result, name: 'copy of my_result', value: '' } as any
          ],
          exits: []
        },
        ui: { position: { left: 0, top: 0 }, type: Types.send_msg },
        inboundConnections: {}
      };
      const node = {
        uuid: 'n1',
        actions: [{ uuid: 'a1', type: Types.set_run_result, name: 'my_result', value: '' } as any],
        exits: [] as Exit[]
      };
      const resolved = resolveResultNames(node, { existing: existingNode });
      // "copy_of_my_result" collides with "copy of my_result" after snakify, so should increment
      expect((resolved.actions[0] as any).name).toBe('copy_of_my_result_01');
    });
  });

  describe('detectCrossFlowIssues', () => {
    const assetStoreWithResult = (key: string): AssetStore =>
      ({
        results: {
          type: AssetType.Result,
          items: { [key]: { id: key, name: key, type: AssetType.Result } }
        }
      } as any);

    it('returns empty array when all @results references exist', () => {
      const node = {
        uuid: 'n1',
        actions: [{ uuid: 'a1', type: Types.send_msg, text: 'Hello @results.my_result' } as any],
        exits: [] as Exit[]
      };
      const issues = detectCrossFlowIssues(node, assetStoreWithResult('my_result'));
      expect(issues).toHaveLength(0);
    });

    it('returns an issue for a missing @results reference', () => {
      const node = {
        uuid: 'n1',
        actions: [{ uuid: 'a1', type: Types.send_msg, text: 'Hello @results.missing_var' } as any],
        exits: [] as Exit[]
      };
      const issues = detectCrossFlowIssues(node, assetStoreWithResult('other_result'));
      expect(issues).toHaveLength(1);
      expect(issues[0].type).toBe(FlowIssueType.INVALID_RESULT);
      expect(issues[0].node_uuid).toBe('n1');
    });

    it('does not flag the node own result name if it is not yet in assetStore', () => {
      const node = {
        uuid: 'n1',
        actions: [
          { uuid: 'a1', type: Types.set_run_result, name: 'fresh_result', value: '' } as any
        ],
        exits: [] as Exit[]
      };
      const emptyStore: AssetStore = { results: { type: AssetType.Result, items: {} } } as any;
      const issues = detectCrossFlowIssues(node, emptyStore);
      expect(issues).toHaveLength(0);
    });
  });
});
