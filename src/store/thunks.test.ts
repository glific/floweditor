import { DefaultExitNames } from 'components/flow/routers/constants';
import { FlowTypes, Operators, Types } from 'config/interfaces';
import { getTypeConfig } from 'config/typeConfigs';
import {
  AnyAction,
  FlowDefinition,
  RouterTypes,
  SendMsg,
  SwitchRouter,
  FlowDetails
} from 'flowTypes';
import mutate from 'immutability-helper';
import Constants from 'store/constants';
import { AssetStore, AssetType, RenderNode, RenderNodeMap } from 'store/flowContext';
import { getFlowComponents, getNodeWithAction, getUniqueDestinations } from 'store/helpers';
import { NodeEditorSettings } from 'store/nodeEditor';
import { initialState } from 'store/state';
import {
  CLIPBOARD_KEY,
  copyNode,
  disconnectExit,
  handleTypeConfigChange,
  loadFlowDefinition,
  LocalizationUpdates,
  moveActionUp,
  onAddToNode,
  onConnectionDrag,
  onOpenNodeEditor,
  onUpdateAction,
  onUpdateLocalizations,
  onUpdateRouter,
  pasteNode,
  removeAction,
  removeNode,
  resetNodeEditingState,
  spliceInRouter,
  updateConnection,
  updateExitDestination,
  updateSticky
} from 'store/thunks';
import { createMockStore, mock, prepMockDuxState } from 'testUtils';
import {
  createAddGroupsAction,
  createRandomNode,
  createSendMsgAction
} from 'testUtils/assetCreators';
import * as utils from 'utils';

const config = require('test/config');

const boring: FlowDefinition = require('test/flows/boring.json');
const getUpdatedNodes = (currentStore: any): { [uuid: string]: RenderNode } => {
  let nodes;
  // return the last action for UPDATE_NODES
  for (const action of currentStore.getActions()) {
    if (action.type === Constants.UPDATE_NODES) {
      nodes = action.payload.nodes;
    }
  }
  return nodes;
};

const emptyAssetStore: AssetStore = {
  fields: { type: AssetType.Field, items: {} },
  groups: { type: AssetType.Group, items: {} },
  labels: { type: AssetType.Label, items: {} },
  results: { type: AssetType.Result, items: {} },
  languages: { type: AssetType.Language, items: {} }
};

const getActionFromStore = (store: any, type: string) => {
  for (const action of store.getActions()) {
    if (action.type === type) {
      return action.payload;
    }
  }
};

describe('fetch flows', () => {
  const store = createMockStore({});
});

describe('Flow Manipulation', () => {
  let store: any;
  const { mockDuxState, testNodes } = prepMockDuxState();

  beforeEach(() => {
    // prep our store to show that we are editing
    store = createMockStore(mockDuxState);
    mock(utils, 'createUUID', utils.seededUUIDs());
  });

  describe('init', () => {
    it('should update localizations', () => {
      const updatedStore = createMockStore({
        flowContext: { definition: boring }
      });
      const localizationUpdates: LocalizationUpdates = [
        {
          uuid: 'node0_action0',
          translations: { text: ['espanols'] }
        }
      ];

      const updated: FlowDefinition = updatedStore.dispatch(
        onUpdateLocalizations('spa', false, localizationUpdates)
      );

      expect(updated.localization.spa.node0_action0).toEqual({
        text: ['espanols']
      });
    });

    it('should gracefully handle missing ui', () => {
      const missingUI: FlowDetails = {
        definition: { ...boring, _ui: undefined as any },
        metadata: null
      };
      store.dispatch(loadFlowDefinition(missingUI, emptyAssetStore));
      const action = getActionFromStore(store, Constants.UPDATE_NODES);

      // should have some default ui in our render nodes
      expect(action).toMatchSnapshot();
    });
  });

  describe('stickies', () => {
    it('should add new stickies', () => {
      const newSticky = {
        title: 'Sticky A',
        body: 'The body for sticky A',
        position: { left: 100, top: 100 }
      };

      store.dispatch(updateSticky('stickyA', newSticky));

      // should see our new sticky note
      boring._ui.stickies = { stickyA: newSticky };

      expect(store).toHavePayload(Constants.UPDATE_DEFINITION, {
        definition: boring
      });
    });

    it('should add stickies to definitions with none', () => {
      delete boring._ui.stickies;
      store = createMockStore({
        flowContext: { definition: boring }
      });

      const newSticky = {
        title: 'sticky0',
        body: 'The body for sticky0',
        position: { left: 100, top: 100 }
      };

      store.dispatch(updateSticky('sticky0', newSticky));

      // should see our new sticky note
      boring._ui.stickies = { sticky0: newSticky };
      expect(store).toHavePayload(Constants.UPDATE_DEFINITION, {
        definition: boring
      });
    });

    it('should remove stickies if null is passed', () => {
      boring._ui.stickies = {
        sticky0: {
          title: 'sticky0',
          body: 'The body for sticky0',
          position: { left: 100, top: 100 }
        }
      };

      store = createMockStore({
        flowContext: { definition: boring }
      });

      store.dispatch(updateSticky('sticky0', null));

      // should be back to an empty flow
      boring._ui.stickies = {};
      expect(store).toHavePayload(Constants.UPDATE_DEFINITION, {
        definition: boring
      });
    });
  });

  describe('nodes', () => {
    it('should store a pending connection when starting a drag', () => {
      // mock(utils, 'createUUID', utils.seededUUIDs());
      store.dispatch(
        onConnectionDrag(
          {
            connection: null,
            endpoints: null,
            suspendedElementId: null,
            target: null,
            targetId: null,
            source: null,
            sourceId: 'node0:node0_exit0'
          },
          FlowTypes.MESSAGING
        )
      );
      expect(store.getActions()).toMatchSnapshot();
    });

    describe('removal', () => {
      beforeEach(() => {
        store = createMockStore(
          mutate(initialState, {
            flowContext: {
              nodes: { $set: testNodes },
              assetStore: { $set: { results: { items: {} } } }
            },
            nodeEditor: {
              settings: { $set: { originalNode: testNodes.node1 } }
            }
          })
        );
      });

      it('should remove it from the map', () => {
        const nodes = store.dispatch(removeNode(testNodes.node1.node));
        expect(nodes.node1).toBeUndefined();
      });

      it('should remove pointers from its destination', () => {
        const nodes = store.dispatch(removeNode(testNodes.node0.node));
        const destinations = getUniqueDestinations(testNodes.node0.node);
        expect(destinations.length).toBe(1);

        // we were the only thing pointing to our friends, so now they
        // should have no inbound connections
        for (const nodeUUID of destinations) {
          expect(nodes[nodeUUID]).not.toHaveInboundConnections();
        }
      });

      it('should reroute pass through connections', () => {
        const nodes = store.dispatch(removeNode(testNodes.node2.node));

        // we reomved 2, so now 1 should point to 3
        expect(nodes.node1).toHaveExitThatPointsTo(nodes.node3);

        // and the next node in the tree should reflect our inbound connection
        expect(nodes.node3).toHaveInboundFrom(testNodes.node1.node.exits[0]);
      });

      // test a snapshot after removing each node in the flow
      for (const nodeUUID of Object.keys(testNodes)) {
        it('should remove node ' + nodeUUID, () => {
          const nodes = store.dispatch(removeNode(testNodes[nodeUUID].node));
          expect(nodes).toMatchSnapshot('Remove ' + nodeUUID);
        });
      }
    });
  });

  describe('connections', () => {
    it('should updateExitDestination()', () => {
      const updated = store.dispatch(updateExitDestination('node0', 'node0_exit0', 'node2'));
      expect(updated.node0).toHaveExitThatPointsTo(updated.node2);
    });

    it('should disconnectExit()', () => {
      const updated = store.dispatch(disconnectExit('node0', 'node0_exit0'));
      expect(updated.node0).not.toHaveExitWithDestination();
    });

    it('should updateConnection()', () => {
      const updated = store.dispatch(updateConnection('node0:node0_exit0', 'node2'));
      expect(updated.node0).toHaveExitThatPointsTo(updated.node2);
    });
  });

  describe('actions', () => {
    it('should add new action', () => {
      // prep our store to show that we are editing
      const updatedStore = createMockStore({
        ...store.getState(),
        nodeEditor: {
          userAddingAction: true,
          settings: { originalNode: testNodes.node0 }
        }
      });

      // add a new message to the first node
      const nodes = updatedStore.dispatch(
        onUpdateAction({
          uuid: 'new_action',
          type: Types.send_msg,
          text: 'A fifth action for our first node'
        })
      );

      // we should have a new action
      const actions = nodes.node0.node.actions;
      expect(actions.length).toBe(6);
      expect((actions[5] as SendMsg).text).toBe('A fifth action for our first node');
    });

    it('should replace router node with a single-action node', () => {
      const { node1: originalRenderNode } = testNodes;
      const incomingAction = createSendMsgAction();
      const { renderNodeMap } = getFlowComponents(boring);

      store = createMockStore(
        mutate(initialState, {
          flowContext: {
            nodes: { $set: renderNodeMap }
          },
          nodeEditor: {
            settings: { $set: { originalNode: originalRenderNode } }
          }
        })
      );

      const updatedNodes = store.dispatch(onUpdateAction(incomingAction));
      const node = getNodeWithAction(updatedNodes, incomingAction.uuid);

      // previous nodes should be routed to us
      expect(updatedNodes.node0.node.exits[0].destination_uuid).toBe(node.node.uuid);
      expect(node).toMatchSnapshot();
    });

    it('should throw if originalNode is null', () => {
      expect(() => {
        // add a new message to the first node
        const nodes = store.dispatch(
          onUpdateAction({
            uuid: 'new_action',
            type: Types.send_msg,
            text: 'A second message for our first node'
          })
        );
      }).toThrowError('Need originalNode in settings to update an action');
    });

    it('should update an existing action', () => {
      // prep our store to show that we are editing
      const updatedStore = createMockStore({
        ...store.getState(),
        nodeEditor: {
          userAddingAction: false,
          settings: { originalNode: testNodes.node0 }
        }
      });

      // add a new message to the first node
      const nodes = updatedStore.dispatch(
        onUpdateAction({
          uuid: 'node0_action0',
          type: 'send_msg',
          text: 'An updated message'
        } as AnyAction)
      );

      expect(nodes.node0.node.actions[0].text).toBe('An updated message');
    });

    it('should remove the node when removing the last action', () => {
      // remove both our actions
      const updated = store.dispatch(removeAction('node3', testNodes.node3.node.actions[0]));

      // removing the last action removes the entire node
      expect(updated.node3).toBeUndefined();
    });

    it('should remove an action from a list of actions', () => {
      // remove the first action
      const updated = store.dispatch(removeAction('node0', testNodes.node0.node.actions[0]));

      // first one was removed, so now second action is first
      expect(updated.node0.node.actions[0].uuid).toBe('node0_action1');
    });

    it('should move an action up', () => {
      // add a second action so we can test single action removal
      const updated = store.dispatch(moveActionUp('node0', testNodes.node0.node.actions[1]));
      expect(updated.node0.node.actions[0].uuid).toBe('node0_action1');
    });

    it('should create a new node if needed for new action', () => {
      // prep our store to show that we are editing
      const updatedStore = createMockStore({
        ...store.getState(),
        nodeEditor: {
          userAddingAction: true,
          settings: {
            originalNode: {
              node: { uuid: utils.createUUID() },
              ui: { position: { left: 500, top: 500 } },
              inboundConnections: { node3_exit0: 'node3' },
              ghost: true
            }
          }
        }
      });

      const newAction = {
        uuid: 'new_action_for_new_node',
        type: Types.send_msg,
        text: 'An action for a new node'
      } as SendMsg;

      const updated = updatedStore.dispatch(onUpdateAction(newAction));
      const newNodeUUID = updated.node3.node.exits[0].destination_uuid;
      expect(newNodeUUID).not.toBeUndefined();

      const newNode = updated[newNodeUUID];
      expect(newNode.ui.position).toEqual({ left: 500, top: 500 });
      expect(newNode.inboundConnections.node3_exit0).toBe('node3');
      expect(newNode.node.actions[0].uuid).toBe('new_action_for_new_node');
    });

    describe('splicing', () => {
      const addRouter = (
        currentStore: any,
        renderNode: RenderNode,
        action: AnyAction
      ): RenderNodeMap => {
        const newExitUUID = utils.createUUID();
        const newNode: RenderNode = {
          node: {
            actions: [],
            router: {
              type: RouterTypes.switch,
              cases: [],
              default_category_uuid: newExitUUID
            } as SwitchRouter,
            uuid: utils.createUUID(),
            exits: [
              {
                uuid: newExitUUID,
                destination_uuid: null
              }
            ]
          },
          ui: {
            position: { left: 100, top: 100 },
            type: Types.wait_for_response
          },
          inboundConnections: {}
        };

        const previousAction = {
          nodeUUID: renderNode.node.uuid,
          actionUUID: action.uuid
        };
        return currentStore.dispatch(spliceInRouter(newNode, previousAction));
      };

      it('should replace the first action of two', () => {
        const nodes = addRouter(store, testNodes.node2, testNodes.node2.node.actions[0]);
        const topNode = nodes[nodes.node1.node.exits[0].destination_uuid];
        const bottomNode = nodes[topNode.node.exits[0].destination_uuid];

        // top node should point to the middle node, and middle should point back
        expect(topNode.inboundConnections).toEqual(testNodes.node2.inboundConnections);

        // bottom node should point back to top node
        expect(bottomNode).toHaveInboundFrom(topNode.node.exits[0]);

        // bottom node should point to the same place as original node
        expect(bottomNode).toHaveExitThatPointsTo(nodes.node3);

        // original node should be gonezor
        expect(nodes[testNodes.node2.node.uuid]).toBeUndefined();
      });

      it('should replace the second action of two', () => {
        const nodes = addRouter(store, testNodes.node2, testNodes.node2.node.actions[1]);
        const topNode = nodes[nodes.node1.node.exits[0].destination_uuid];
        const bottomNode = nodes[topNode.node.exits[0].destination_uuid];

        expect(topNode.node.exits[0]).toPointTo(bottomNode);
        expect(bottomNode).toHaveInboundFrom(topNode.node.exits[0]);
      });

      it('should replace the second action of three', () => {
        const nodes = addRouter(store, testNodes.node0, testNodes.node0.node.actions[1]);

        // find our top node by position since it's uuid will be different
        const topNodeUUID = Object.keys(nodes).find((key: string) => {
          return nodes[key].ui.position.top === 0;
        });

        const topNode = nodes[topNodeUUID];
        const middleNode = nodes[topNode.node.exits[0].destination_uuid];
        const bottomNode = nodes[middleNode.node.exits[0].destination_uuid];

        // top node should point to the middle node, and middle should point back
        expect(middleNode).toHaveInboundFrom(topNode.node.exits[0]);

        // middle should point to the bottom, and bottom should point back
        expect(bottomNode).toHaveInboundFrom(middleNode.node.exits[0]);

        // original node should be gonezor
        expect(nodes.node0).toBeUndefined();
      });
    });
  });

  describe('node editor', () => {
    beforeEach(() => {
      // now try a store with all the things set
      store = createMockStore(
        mutate(initialState, {
          flowContext: {
            nodes: { $set: testNodes },
            definition: { $set: boring }
          },
          nodeEditor: { settings: { $set: { originalNode: null } } }
        })
      );
    });

    describe('translation', () => {
      it('should edit in translation mode', () => {
        store = createMockStore(
          mutate(initialState, {
            flowContext: {
              definition: { $set: boring },
              nodes: { $set: testNodes }
            },
            editorState: {
              language: { $set: { iso: 'spa' } },
              translating: { $set: false }
            },
            nodeEditor: {
              settings: {
                $set: {
                  originalNode: null
                }
              }
            }
          })
        );

        store.dispatch(
          onOpenNodeEditor({
            originalNode: testNodes.node0,
            originalAction: testNodes.node0.node.actions[0],
            showAdvanced: false
          })
        );
      });

      it('should pick your action for you if necessary', () => {
        store = createMockStore(
          mutate(initialState, {
            flowContext: {
              nodes: { $set: testNodes },
              definition: { $set: boring }
            },
            editorState: {
              language: { $set: { iso: 'spa' } },
              translating: { $set: true }
            },
            nodeEditor: { settings: { $set: { originalNode: null } } }
          })
        );

        store.dispatch(
          onOpenNodeEditor({
            originalNode: testNodes.node3,
            showAdvanced: false
          })
        );
      });

      it('should only pick send_msg actions for you when translating', () => {
        store = createMockStore(
          mutate(initialState, {
            flowContext: {
              nodes: { $set: testNodes },
              definition: { $set: boring }
            },
            editorState: {
              language: { $set: { iso: 'spa' } },
              translating: { $set: true }
            },
            nodeEditor: { settings: { $set: { originalNode: null } } }
          })
        );

        store.dispatch(
          onOpenNodeEditor({
            originalNode: testNodes.node2,
            showAdvanced: false
          })
        );
        expect(store).not.toHaveReduxActions([Constants.UPDATE_DEFINITION]);
      });
    });

    describe('normal editing', () => {
      it('should update type config', () => {
        const newTypeConfig = getTypeConfig(Types.add_contact_groups);
        const newActionToEdit = createAddGroupsAction();
        const settings = {
          originalNode: null,
          originalAction: newActionToEdit
        } as NodeEditorSettings;

        store = createMockStore(
          mutate(initialState, {
            nodeEditor: { $merge: { settings } }
          })
        );

        store.dispatch(handleTypeConfigChange(newTypeConfig));
        expect(store).toHaveReduxActions([Constants.UPDATE_TYPE_CONFIG]);
        expect(store).toHavePayload(Constants.UPDATE_TYPE_CONFIG, {
          typeConfig: newTypeConfig
        });
      });

      it('should edit an existing action', () => {
        store.dispatch(
          onOpenNodeEditor({
            originalNode: testNodes.node0,
            originalAction: testNodes.node0.node.actions[0],
            showAdvanced: false
          })
        );
      });

      it('should pick the last action if none are provided', () => {
        store.dispatch(
          onOpenNodeEditor({
            originalNode: testNodes.node3,
            showAdvanced: false
          })
        );
      });

      it('should throw if no action is provided on an action node', () => {
        testNodes.node0.node.actions = [];
        expect(() => {
          store.dispatch(
            onOpenNodeEditor({
              originalNode: testNodes.node0,
              showAdvanced: false
            })
          );
        }).toThrowError("Couldn't determine type config for: node0");
      });

      it('should edit router nodes', () => {
        store.dispatch(
          onOpenNodeEditor({
            originalNode: testNodes.node1,
            showAdvanced: false
          })
        );

        expect(store.getActions()).toMatchSnapshot();
      });
    });

    describe('opening and closing', () => {
      it('should open the editor in add to node mode', () => {
        store.dispatch(onAddToNode(testNodes.node0.node));

        expect(store).toHavePayload(Constants.UPDATE_USER_ADDING_ACTION, {
          userAddingAction: true
        });
      });

      it('should only update things that are set', () => {
        store.dispatch(resetNodeEditingState());
        expect(store.getActions()).toMatchSnapshot();
      });

      it('should reset the node editor', () => {
        // now try a store with all the things set
        store = createMockStore({
          flowContext: { nodes: testNodes },
          nodeEditor: { settings: {} },
          editorState: {}
        });

        store.dispatch(resetNodeEditingState());
        expect(store.getActions()).toMatchSnapshot();
      });
    });
  });

  describe('routers', () => {
    it('should edit an existing router', () => {
      store = createMockStore(
        mutate(initialState, {
          flowContext: {
            nodes: { $set: testNodes },
            assetStore: { $set: { results: { items: {} } } }
          },
          nodeEditor: { settings: { $set: { originalNode: testNodes.node1 } } }
        })
      );

      const updatedNode = mutate(testNodes.node1, {
        node: {
          router: {
            cases: utils.push([
              {
                uuid: 'new_case',
                type: Operators.has_any_word,
                exit_uuid: 'exitD',
                arguments: ['anotherrule'],
                translations: {
                  en: {
                    arguments: ['anotherrule']
                  }
                }
              }
            ])
          }
        }
      });
      const previousTop = testNodes.node1.ui.position.top;
      const nodes = store.dispatch(onUpdateRouter(updatedNode));
      const newCase = nodes.node1.node.router.cases[2];

      expect(newCase.arguments).toEqual(['anotherrule']);
      expect(nodes.node1.ui.position.top).toBe(previousTop);
    });

    it('should create a new router on drag', () => {
      const node = mutate(testNodes.node3, {
        inboundConnections: { $set: { node2_exit0: 'node2' } },
        ui: { $merge: { position: { left: 500, top: 600 } } },
        ghost: utils.setTrue()
      });

      store = createMockStore(
        mutate(initialState, {
          flowContext: { nodes: { $set: testNodes } },
          nodeEditor: { settings: { $set: { originalNode: node } } }
        })
      );

      const newRouter: RenderNode = {
        node: { uuid: 'new_router', actions: [], exits: [] },
        ui: { position: null },
        inboundConnections: {}
      };

      // add our router
      const nodes = store.dispatch(onUpdateRouter(newRouter));

      // make sure things are wired up as expected
      const newNode = nodes[nodes.node2.node.exits[0].destination_uuid];
      expect(newNode).toHaveInboundFrom(nodes.node2.node.exits[0]);
      expect(nodes.node2.node.exits[0]).toPointTo(newNode);
      expect(newNode.ui.position).toEqual({ left: 500, top: 600 });
    });

    it('should update an action into a router', () => {
      store = createMockStore(
        mutate(initialState, {
          flowContext: { nodes: { $set: testNodes } },
          nodeEditor: {
            settings: {
              $set: {
                originalAction: testNodes.node3.node.actions[0],
                originalNode: testNodes.node3
              }
            }
          }
        })
      );

      const newRouter: RenderNode = {
        node: {
          uuid: testNodes.node3.node.uuid,
          actions: [],
          exits: [{ uuid: 'new_exit', destination_uuid: null }],
          router: {
            type: RouterTypes.switch,
            categories: [
              {
                uuid: utils.createUUID(),
                name: DefaultExitNames.All_Responses,
                exit_uuid: 'new_exit'
              }
            ]
          }
        },
        ui: { position: null },
        inboundConnections: {}
      };

      // splice in our new router
      const nodes = store.dispatch(onUpdateRouter(newRouter));

      // old node should be gone
      expect(nodes.node3).toBeUndefined();
    });

    it('should append a router after an add action', () => {
      store = createMockStore(
        mutate(initialState, {
          flowContext: { nodes: { $set: testNodes } },
          nodeEditor: {
            settings: { $set: { originalNode: testNodes.node0 } }
          }
        })
      );

      const newRouter: RenderNode = {
        node: {
          uuid: 'new_router',
          actions: [],
          router: {
            default_category_uuid: 'new_exit'
          } as SwitchRouter,
          exits: [{ uuid: 'new_exit', destination_uuid: null }]
        },
        ui: { position: null },
        inboundConnections: {}
      };

      const previousBottom = testNodes.node0.ui.position.bottom;

      // splice in our new router
      const nodes = store.dispatch(onUpdateRouter(newRouter));
      const newNodeUUID = nodes.node0.node.exits[0].destination_uuid;
      expect(nodes[newNodeUUID]).toHaveInboundFrom(nodes.node0.node.exits[0]);
    });

    it('should add random routers after an add action', () => {
      store = createMockStore(
        mutate(initialState, {
          flowContext: { nodes: { $set: testNodes } },
          nodeEditor: {
            settings: {
              $set: {
                originalNode: testNodes.node0,
                originalAction: createSendMsgAction()
              }
            }
          }
        })
      );

      const newRouter: RenderNode = createRandomNode(2);

      // splice in our new router
      const nodes = store.dispatch(onUpdateRouter(newRouter));
      const newNode = nodes[nodes.node0.node.exits[0].destination_uuid];
      expect(newNode).toHaveInboundFrom(nodes.node0.node.exits[0]);

      expect(nodes.node0).toMatchSnapshot();
      expect(newNode).toMatchSnapshot();
    });
  });
});

describe('copy-paste thunks', () => {
  const sendMsgNode = {
    node: {
      uuid: 'node-sm',
      actions: [{ uuid: 'action-sm', type: Types.send_msg, text: 'Hello' }],
      exits: [{ uuid: 'exit-sm', destination_uuid: null }]
    },
    ui: { position: { left: 100, top: 200 }, type: Types.send_msg },
    inboundConnections: {}
  };

  const imNode = {
    node: {
      uuid: 'node-im',
      actions: [{ uuid: 'action-im', type: Types.send_interactive_msg }],
      exits: [{ uuid: 'exit-im', destination_uuid: 'node-wfr' }]
    },
    ui: { position: { left: 100, top: 100 }, type: Types.send_interactive_msg },
    inboundConnections: {}
  };

  const wfrNode = {
    node: {
      uuid: 'node-wfr',
      actions: [],
      exits: [{ uuid: 'exit-wfr', destination_uuid: null }],
      router: {
        type: 'switch',
        result_name: 'wfr_result',
        categories: [],
        cases: [],
        operand: '@input.text',
        default_category_uuid: null
      }
    },
    ui: { position: { left: 100, top: 400 }, type: Types.wait_for_response },
    inboundConnections: { 'node-im': 'exit-im' }
  };

  const baseState = {
    flowContext: {
      nodes: { 'node-sm': sendMsgNode, 'node-im': imNode, 'node-wfr': wfrNode },
      assetStore: { results: { type: AssetType.Result, items: {} } },
      issues: {}
    }
  };

  beforeEach(() => {
    localStorage.clear();
  });

  describe('copyNode', () => {
    it('writes primary node to localStorage for a plain node', () => {
      const store = createMockStore(
        mutate(initialState, { flowContext: { $set: baseState.flowContext } })
      );
      store.dispatch(copyNode('node-sm'));

      const stored = JSON.parse(localStorage.getItem(CLIPBOARD_KEY));
      expect(stored.primary.node.uuid).toBe('node-sm');
      expect(stored.paired).toBeUndefined();
    });

    it('writes primary and paired WFR for an Interactive Message node', () => {
      const store = createMockStore(
        mutate(initialState, { flowContext: { $set: baseState.flowContext } })
      );
      store.dispatch(copyNode('node-im'));

      const stored = JSON.parse(localStorage.getItem(CLIPBOARD_KEY));
      expect(stored.primary.node.uuid).toBe('node-im');
      expect(stored.paired.node.uuid).toBe('node-wfr');
      expect(stored.pairedOffset).toEqual({ left: 0, top: 300 });
    });

    it('dispatches toast after copying', () => {
      const store = createMockStore(
        mutate(initialState, { flowContext: { $set: baseState.flowContext } })
      );
      store.dispatch(copyNode('node-sm'));

      const editorAction = store
        .getActions()
        .find((a: any) => a.type === Constants.UPDATE_EDITOR_STATE);
      expect(editorAction.payload.editorState.toast).not.toBeNull();
    });
  });

  describe('pasteNode', () => {
    it('is a no-op when clipboard is empty', () => {
      const store = createMockStore(
        mutate(initialState, { flowContext: { $set: baseState.flowContext } })
      );
      store.dispatch(pasteNode({ left: 50, top: 50 }));
      expect(store.getActions()).toHaveLength(0);
    });

    it('dispatches updateNodes with a new cloned node', () => {
      const store = createMockStore(
        mutate(initialState, { flowContext: { $set: baseState.flowContext } })
      );
      store.dispatch(copyNode('node-sm'));
      store.clearActions();
      store.dispatch(pasteNode({ left: 50, top: 50 }));

      const nodesAction = store.getActions().find((a: any) => a.type === Constants.UPDATE_NODES);
      expect(nodesAction).toBeDefined();
      const pastedKeys = Object.keys(nodesAction.payload.nodes);
      expect(pastedKeys).toHaveLength(4); // 3 original nodes + 1 new cloned node
      const newNodeUUID = pastedKeys.find(k => !['node-sm', 'node-im', 'node-wfr'].includes(k));
      expect(newNodeUUID).toBeDefined();
      expect(nodesAction.payload.nodes[newNodeUUID].ui.position).toEqual({ left: 50, top: 50 });
    });

    it('dispatches both nodes for an IM+WFR paste with rewired connection', () => {
      const store = createMockStore(
        mutate(initialState, { flowContext: { $set: baseState.flowContext } })
      );
      store.dispatch(copyNode('node-im'));
      store.clearActions();
      store.dispatch(pasteNode({ left: 200, top: 200 }));

      const nodesAction = store.getActions().find((a: any) => a.type === Constants.UPDATE_NODES);
      const allNodes = nodesAction.payload.nodes;
      const newKeys = Object.keys(allNodes).filter(
        k => !['node-sm', 'node-im', 'node-wfr'].includes(k)
      );
      expect(newKeys).toHaveLength(2);

      const newIM = Object.values(allNodes).find(
        (n: any) =>
          n.node.actions?.[0]?.type === Types.send_interactive_msg && n.node.uuid !== 'node-im'
      ) as any;
      const newWFR = allNodes[newIM.node.exits[0].destination_uuid];

      expect(newWFR).toBeDefined();
      expect(newWFR.inboundConnections[newIM.node.exits[0].uuid]).toBe(newIM.node.uuid);
      expect(newIM.ui.position).toEqual({ left: 200, top: 200 });
      expect(newWFR.ui.position).toEqual({ left: 200, top: 500 });
    });

    it('gives unique result names when primary and paired share the same result name', () => {
      // IM node: send_interactive_msg first (so copyNode detects pairing), set_run_result second
      const imWithResult = {
        ...imNode,
        node: {
          ...imNode.node,
          actions: [
            { uuid: 'action-im', type: Types.send_interactive_msg },
            { uuid: 'action-result', type: Types.set_run_result, name: 'shared_result', value: '' }
          ]
        }
      };
      const wfrWithSameResult = {
        ...wfrNode,
        node: {
          ...wfrNode.node,
          router: { ...wfrNode.node.router, result_name: 'shared_result' }
        }
      };

      const stateWithShared = {
        flowContext: {
          nodes: { 'node-im': imWithResult, 'node-wfr': wfrWithSameResult },
          assetStore: { results: { type: AssetType.Result, items: {} } },
          issues: {}
        }
      };

      const store = createMockStore(
        mutate(initialState, { flowContext: { $set: stateWithShared.flowContext } })
      );
      store.dispatch(copyNode('node-im'));
      store.clearActions();
      store.dispatch(pasteNode({ left: 200, top: 200 }));

      const nodesAction = store.getActions().find((a: any) => a.type === Constants.UPDATE_NODES);
      const allNodes = nodesAction.payload.nodes;

      const newIM = Object.values(allNodes).find(
        (n: any) =>
          n.node.actions?.[0]?.type === Types.send_interactive_msg && n.node.uuid !== 'node-im'
      ) as any;
      const newWFR = allNodes[newIM.node.exits[0].destination_uuid];

      // primary clone's set_run_result gets copy_of_shared_result
      const imResultName = newIM.node.actions[1].name;
      // paired clone sees primary already claimed copy_of_shared_result → increments to _01
      const wfrResultName = newWFR.node.router.result_name;

      expect(imResultName).toBe('copy_of_shared_result');
      expect(wfrResultName).toBe('copy_of_shared_result_01');
    });

    it('registers both IM and WFR result names in the asset store after paste', () => {
      const store = createMockStore(
        mutate(initialState, { flowContext: { $set: baseState.flowContext } })
      );
      store.dispatch(copyNode('node-im'));
      store.clearActions();
      store.dispatch(pasteNode({ left: 200, top: 200 }));

      // get the last UPDATE_ASSET_MAP action — should contain wfr_result from the WFR node
      const assetActions = store
        .getActions()
        .filter((a: any) => a.type === Constants.UPDATE_ASSET_MAP);

      // only one dispatch should have fired for assets
      expect(assetActions).toHaveLength(1);

      const finalItems = assetActions[0].payload.assets.results.items;
      expect(finalItems['copy_of_wfr_result']).toBeDefined();
    });
  });
});
