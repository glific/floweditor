import { react as bindCallbacks } from 'auto-bind';
import Dialog, { ButtonSet } from 'components/dialog/Dialog';
import { hasErrors, renderIssues } from 'components/flow/actions/helpers';
import { RouterFormProps } from 'components/flow/props';
import { getUserName, nodeToState, stateToNode } from './helpers';
// import { createResultNameInput } from 'components/flow/routers/widgets';
import TypeList from 'components/nodeeditor/TypeList';
import * as React from 'react';
import { FormState, mergeForm, StringEntry, FormEntry } from 'store/nodeEditor';
import { Alphanumeric, shouldRequireIf, StartIsNonNumeric, validate } from 'store/validators';
import styles from './TicketRouterForm.module.scss';
import i18n from 'config/i18n';
import TextInputElement from 'components/form/textinput/TextInputElement';
import TembaSelect from 'temba/TembaSelect';
import { fakePropType } from 'config/ConfigProvider';
import { Topic, User } from 'flowTypes';

export interface TicketRouterFormState extends FormState {
  assignee: FormEntry;
  topic: FormEntry;
  subject: StringEntry;
  body: StringEntry;
  resultName: StringEntry;
}

export default class TicketRouterForm extends React.Component<
  RouterFormProps,
  TicketRouterFormState
> {
  public static contextTypes = {
    config: fakePropType
  };

  constructor(props: RouterFormProps) {
    super(props);

    this.state = nodeToState(this.props.nodeSettings);

    bindCallbacks(this, {
      include: [/^handle/]
    });
  }

  componentDidMount(): void {
    // set our default topic if we don't have one
    if (!this.state.topic.value) {
      this.handleTopicUpdate(this.context.config.defaultTopic);
    }
  }

  private handleUpdate(
    keys: {
      assignee?: User;
      topic?: Topic;
      subject?: string;
      body?: string;
      resultName?: string;
    },
    submitting = false
  ): boolean {
    const updates: Partial<TicketRouterFormState> = {};

    if (keys.hasOwnProperty('assignee')) {
      updates.assignee = validate(i18n.t('forms.assignee', 'Assignee'), keys.assignee, [
        shouldRequireIf(submitting)
      ]);
    }

    if (keys.hasOwnProperty('topic')) {
      updates.topic = validate(i18n.t('forms.topic', 'Topic'), keys.topic, [
        shouldRequireIf(submitting)
      ]);
    }

    if (keys.hasOwnProperty('subject')) {
      updates.subject = validate(i18n.t('forms.subject', 'Subject'), keys.subject, []);
    }

    if (keys.hasOwnProperty('body')) {
      updates.body = validate(i18n.t('forms.body', 'Body'), keys.body, []);
    }

    // if (keys.hasOwnProperty('resultName')) {
    //   updates.resultName = validate(
    // i18n.t('forms.result_name', 'Result Name'),
    // keys.resultName,
    //     []
    //   );
    // }

    const updated = mergeForm(this.state, updates);

    // update our form
    this.setState(updated);
    return updated.valid;
  }

  private handleAssigneeUpdate(assignee: User): void {
    this.handleUpdate({ assignee });
  }

  private handleTopicUpdate(topic: Topic): void {
    this.handleUpdate({ topic });
  }

  private handleSubjectUpdate(subject: string, name: string, submitting = false): boolean {
    return this.handleUpdate({ subject }, submitting);
  }

  private handleResultNameUpdate(value: string): void {
    const resultName = validate(i18n.t('forms.result_name', 'Result Name'), value, [
      Alphanumeric,
      StartIsNonNumeric
    ]);
    this.setState({
      resultName,
      valid: this.state.valid && !hasErrors(resultName)
    });
  }
  private handleBodyUpdate(body: string): boolean {
    return this.handleUpdate({ body });
  }

  private handleSave(): void {
    // force our default topic if it's not set
    // we have to do it here, because setState is async
    // if (this.state.topic.value === null) {
    // eslint-disable-next-line react/no-direct-mutation-state
    // this.state.topic.value = this.context.config.defaultTopic;
    // }

    // validate all fields in case they haven't interacted
    const valid = this.handleUpdate(
      {
        topic: this.state.topic.value,
        subject: this.state.subject.value,
        body: this.state.body.value
      },
      true
    );

    if (valid) {
      this.props.updateRouter(stateToNode(this.props.nodeSettings, this.state));
      this.props.onClose(false);
    }
  }

  private getButtons(): ButtonSet {
    return {
      primary: { name: i18n.t('buttons.ok', 'Ok'), onClick: this.handleSave },
      secondary: {
        name: i18n.t('buttons.cancel', 'Cancel'),
        onClick: () => this.props.onClose(true)
      }
    };
  }

  private renderEdit(): JSX.Element {
    const typeConfig = this.props.typeConfig;

    return (
      <Dialog title={typeConfig.name} headerClass={typeConfig.type} buttons={this.getButtons()}>
        <TypeList __className="" initialType={typeConfig} onChange={this.props.onTypeChange} />

        <div style={{ display: 'flex', width: '100%', marginTop: '0.5em' }}>
          <div style={{ flexBasis: 250 }}>
            <TembaSelect
              key="select_topic"
              valueKey="uuid"
              name={i18n.t('forms.topic', 'Topic')}
              placeholder={i18n.t('Select')}
              endpoint={this.context.config.endpoints.topics}
              onChange={this.handleTopicUpdate}
              value={this.state.topic.value}
              createPrefix={i18n.t('forms.topic_prefix', 'Create Topic: ')}
              searchable={true}
              errors={(this.state.topic.validationFailures || []).map(failure => failure.message)}
            />
          </div>

          <div style={{ flexGrow: 1, marginLeft: '0.5em' }}>
            <TembaSelect
              key="select_assignee"
              name={i18n.t('forms.assignee', 'Assignee')}
              placeholder="Assign to (optional)"
              valueKey="email"
              endpoint={this.context.config.endpoints.users}
              onChange={this.handleAssigneeUpdate}
              clearable={true}
              value={this.state.assignee.value}
              getName={getUserName}
            />
          </div>
        </div>
        <div className={styles.body}>
          <TextInputElement
            name={i18n.t('forms.body', 'Body')}
            placeholder={i18n.t('forms.enter_a_body', 'Enter a body (optional)')}
            entry={this.state.body}
            onChange={this.handleBodyUpdate}
            autocomplete={true}
            textarea={true}
          />
        </div>
        {/* We will not need results in our  context */}
        {/* {createResultNameInput(this.state.resultName, this.handleResultNameUpdate)} */}
        {renderIssues(this.props)}
      </Dialog>
    );
  }

  public render(): JSX.Element {
    return this.renderEdit();
  }
}
