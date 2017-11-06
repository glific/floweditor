import * as React from 'react';
import * as UUID from 'uuid';
import { SwitchRouterForm, ISwitchRouterState } from './SwitchRouter';
import { IStartFlow, ICase, ISwitchRouter } from '../../flowTypes';
import { FlowElement } from '../form/FlowElement';
import NodeRouterForm from '../NodeEditor/NodeRouterForm';
import Widget from '../NodeEditor/Widget';
import ComponentMap from '../../services/ComponentMap';

export class SubflowForm extends NodeRouterForm<ISwitchRouter, ISwitchRouterState> {
    renderForm(ref: any): JSX.Element {
        if (this.isTranslating()) {
            return this.renderExitTranslations(ref);
        }

        var flow_name,
            flow_uuid: string = null;
        if (this.props.action) {
            var action = this.props.action;
            if (action.type == 'start_flow') {
                var startAction: IStartFlow = action as IStartFlow;
                flow_name = startAction.flow_name;
                flow_uuid = startAction.flow_uuid;
            }
        }

        return (
            <div>
                <p>Select a flow to run</p>
                <FlowElement
                    ref={ref}
                    name="Flow"
                    endpoint={this.props.endpoints.flows}
                    flow_name={flow_name}
                    flow_uuid={flow_uuid}
                    required
                />
            </div>
        );
    }

    getUUID(): string {
        if (this.props.action) {
            return this.props.action.uuid;
        }
        return UUID.v4();
    }

    onValid(widgets: { [name: string]: Widget }): void {
        if (this.isTranslating()) {
            return this.saveLocalizedExits(widgets);
        }

        var select = widgets['Flow'] as FlowElement;
        var flow = select.state.flow;

        var newAction: IStartFlow = {
            uuid: this.getUUID(),
            type: this.props.config.type,
            flow_name: flow.name,
            flow_uuid: flow.id
        };

        // if we were already a subflow, lean on those exits and cases
        var exits = [];
        var cases: ICase[];

        var details = this.props.ComponentMap.getDetails(this.props.node.uuid);
        if (details && details.type == 'subflow') {
            exits = this.props.node.exits;
            cases = (this.props.node.router as ISwitchRouter).cases;
        } else {
            // otherwise, let's create some new ones
            exits = [
                {
                    uuid: UUID.v4(),
                    name: 'Complete',
                    destination_node_uuid: null
                }
            ];

            cases = [
                {
                    uuid: UUID.v4(),
                    type: 'has_run_status',
                    arguments: ['C'],
                    exit_uuid: exits[0].uuid
                }
            ];
        }

        var router: ISwitchRouter = {
            type: 'switch',
            operand: '@child',
            cases: cases,
            default_exit_uuid: null
        };

        // HACK: this should go away with modal refactor
        var nodeUUID = this.props.node.uuid;
        if (this.props.action && this.props.action.uuid == nodeUUID) {
            nodeUUID = UUID.v4();
        }

        this.props.updateRouter(
            {
                uuid: nodeUUID,
                router: router,
                exits: exits,
                actions: [newAction],
                wait: { type: 'flow', flow_uuid: flow.id }
            },
            'subflow',
            this.props.action
        );
    }
}
