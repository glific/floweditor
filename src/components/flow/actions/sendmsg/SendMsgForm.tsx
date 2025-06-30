/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/explicit-member-accessibility */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { react as bindCallbacks } from 'auto-bind';
import { AxiosError, AxiosResponse } from 'axios';
import Dialog, { ButtonSet, Tab } from 'components/dialog/Dialog';
import { hasErrors, renderIssues } from 'components/flow/actions/helpers';
import {
  initializeForm as stateToForm,
  stateToAction,
  TOPIC_OPTIONS
} from 'components/flow/actions/sendmsg/helpers';
import { ActionFormProps } from 'components/flow/props';
import AssetSelector from 'components/form/assetselector/AssetSelector';
import { hasUseableTranslation } from 'components/form/assetselector/helpers';
import SelectElement, { SelectOption } from 'components/form/select/SelectElement';
import TextInputElement from 'components/form/textinput/TextInputElement';
import TypeList from 'components/nodeeditor/TypeList';
import { fakePropType } from 'config/ConfigProvider';
import { fetchAsset } from 'external';
import { Template, TemplateTranslation } from 'flowTypes';
import mutate from 'immutability-helper';
import * as React from 'react';
import { Asset } from 'store/flowContext';

import {
  FormState,
  mergeForm,
  StringArrayEntry,
  StringEntry,
  SelectOptionEntry,
  FormEntry
} from 'store/nodeEditor';
import {
  CharactersLessThan,
  MaxOfTenItems,
  Required,
  ValidField,
  shouldRequireIf,
  validate,
  validateIf
} from 'store/validators';
import { range } from 'utils';

import styles from './SendMsgForm.module.scss';
import { hasFeature } from 'config/typeConfigs';
import { FeatureFilter } from 'config/interfaces';

import i18n from 'config/i18n';
import { Attachment, renderAttachments, validateURL } from './attachments';
import { AddLabelsFormState } from '../addlabels/AddLabelsForm';
import { TembaComponent } from 'temba/TembaComponent';

export interface SendMsgFormState extends FormState {
  message: StringEntry;
  quickReplies: StringArrayEntry;
  quickReplyEntry: StringEntry;
  sendAll: boolean;
  attachments: Attachment[];
  uploadInProgress: boolean;
  uploadError: string;
  template: { uuid: string; name: string };
  topic: SelectOptionEntry;
  templateVariables: string[];
  templateTranslation?: TemplateTranslation;
  labels?: any;
  expression?: any;
  skipValidation?: boolean;
}

// this is an additonal item in templates that need to have a same format as other list items
const additionalOption = {
  name: 'Expression',
  translations: [
    {
      channel: {
        name: 'WhatsApp'
      },
      status: 'approved'
    }
  ]
};

export default class SendMsgForm extends React.Component<ActionFormProps, SendMsgFormState> {
  private timeout: any;

  constructor(props: ActionFormProps, context: any) {
    super(props);
    this.state = stateToForm(this.props.nodeSettings, context.config);
    bindCallbacks(this, {
      include: [/^handle/, /^on/]
    });
  }

  public static contextTypes = {
    config: fakePropType
  };

  private handleUpdate(
    keys: {
      text?: string;
      sendAll?: boolean;
      quickReplies?: string[];
      template?: FormEntry;
    },
    submitting = false
  ): boolean {
    const updates: Partial<SendMsgFormState> = {};
    if (keys.hasOwnProperty('text')) {
      let validatorFuncs = [
        shouldRequireIf(
          submitting && !this.state.template.name && this.state.attachments.length === 0
        ),
        CharactersLessThan(4096, '4096 characters')
      ];

      if (!this.state.skipValidation) {
        validatorFuncs.push(validateIf(ValidField(this.props.assetStore), submitting));
      }
      updates.message = validate(i18n.t('forms.message', 'Message'), keys.text, validatorFuncs);
    }

    if (keys.hasOwnProperty('template')) {
      if (
        keys.template.value &&
        ['image', 'video', 'document'].includes(keys.template.value.type) &&
        this.state.attachments.length === 0
      ) {
        // updates.template = {
        //   ...keys.template,
        //   validationFailures: [{ message: 'Attachment is required for media template' }]
        // };
      }
    }

    if (keys.hasOwnProperty('sendAll')) {
      updates.sendAll = keys.sendAll;
    }

    if (keys.hasOwnProperty('quickReplies')) {
      updates.quickReplies = validate(
        i18n.t('forms.quick_replies', 'Quick Replies'),
        keys.quickReplies,
        [MaxOfTenItems]
      );
    }
    const updated = mergeForm(this.state, updates) as SendMsgFormState;

    this.setState(updated);
    return updated.valid;
  }

  public handleMessageInput(event: React.KeyboardEvent) {
    return this.handleUpdate({ text: (event.target as any).value }, false);
  }

  public handleMessageUpdate(message: string, name: string, submitting = false): boolean {
    return this.handleUpdate({ text: message }, submitting);
  }

  public handleTemplateUpdate(template: FormEntry, submitting = false): boolean {
    return this.handleUpdate({ template }, submitting);
  }

  public handleQuickRepliesUpdate(quickReplies: string[]): boolean {
    return this.handleUpdate({ quickReplies });
  }

  public handleSendAllUpdate(sendAll: boolean): boolean {
    return this.handleUpdate({ sendAll });
  }

  private hasTemplateErrors(): boolean {
    // if there is an attachment variable, make sure it's not empty
    const { templateVariables, templateTranslation } = this.state;
    if (templateTranslation && templateVariables && templateTranslation.variables.length > 0) {
      const hasMissingAttachment = !!templateTranslation.variables.find(
        (variable: any, index: number) => {
          if (
            variable.type === 'image' ||
            variable.type === 'document' ||
            variable.type === 'video' ||
            variable.type === 'audio'
          ) {
            if (templateVariables[index] === '') {
              return true;
            }
          }
          return false;
        }
      );
      if (hasMissingAttachment) {
        return true;
      }
    }
    return false;
  }

  private handleSave(): void {
    if (this.state.attachments.length > 0 && this.state.attachments[0].valid) {
      return;
    }

    // make sure we validate untouched text fields and contact fields
    let valid = this.handleMessageUpdate(this.state.message.value, null, true);
    valid = valid && !hasErrors(this.state.quickReplyEntry) && !this.hasTemplateErrors();

    if (valid) {
      this.props.updateAction(stateToAction(this.props.nodeSettings, this.state));

      // if we had a template and it doen't match our new template
      if (this.props.nodeSettings.originalAction) {
        const originalTemplate = (this.props.nodeSettings.originalAction as any).template;
        if (originalTemplate) {
          if (
            (this.state.template && this.state.template.uuid !== originalTemplate.uuid) ||
            !this.state.template
          ) {
            this.props.removeLocalizations(this.props.nodeSettings.originalAction.uuid, [
              'template_variables'
            ]);
          }
        }
      }

      // notify our modal we are done
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

  private handleTemplateChanged(event: any): void {
    const { template, translation, variables } = event.detail;
    this.setState({
      template: template ? { uuid: template.uuid, name: template.name } : null,
      templateVariables: variables,
      templateTranslation: translation
    });
  }

  private handleTemplateVariableChanged(updatedText: string, num: number): void {
    const entry = validate(`Variable ${num + 1}`, updatedText, [Required]);
    const templateVariables = mutate(this.state.templateVariables, {
      $merge: { [num]: entry }
    }) as string[];
    this.setState({ templateVariables });
  }

  private handleShouldExcludeTemplate(template: any): boolean {
    return !hasUseableTranslation(template as Template);
  }

  private renderTopicConfig(): JSX.Element {
    return (
      <>
        <p>
          {i18n.t(
            'forms.send_msg_facebook_warning',
            'Sending bulk messages over a Facebook channel requires that a topic be specified if the user has not sent a message in the last 24 hours. Setting a topic to use over Facebook is especially important for the first message in your flow.'
          )}
        </p>
        <SelectElement
          key={'fb_method_select'}
          name={i18n.t('forms.method', 'Method')}
          entry={this.state.topic}
          onChange={this.handleTopicUpdate}
          options={TOPIC_OPTIONS}
          placeholder={i18n.t(
            'forms.send_msg_facebook_topic_placeholder',
            'Select a topic to use over Facebook'
          )}
          clearable={true}
        />
      </>
    );
  }

  private handleTopicUpdate(topic: SelectOption) {
    this.setState({ topic: { value: topic } });
  }
  private renderLabelOption(): JSX.Element {
    return (
      <div className={styles.label_container}>
        <p>Select the labels to apply to the outgoing message.</p>

        <AssetSelector
          name={i18n.t('forms.labels', 'Labels')}
          placeholder={i18n.t(
            'enter_to_create_label',
            'Enter the name of an existing label or create a new one'
          )}
          assets={this.props.assetStore.labels}
          entry={this.state.labels}
          searchable={true}
          multi={true}
          expressions={true}
          onChange={this.handleLabelsChanged}
          createPrefix={i18n.t('create_label', 'Create Label') + ': '}
          createAssetFromInput={this.handleCreateAssetFromInput}
          onAssetCreated={this.handleLabelCreated}
        />
      </div>
    );
  }

  private renderTemplateConfig(): JSX.Element {
    const uuid = this.state.template ? this.state.template.uuid : null;

    return (
      <>
        <p>
          {i18n.t(
            'forms.whatsapp_warning',
            'Sending messages over a WhatsApp channel requires that a template be used if you have not received a message from a contact in the last 24 hours. Setting a template to use over WhatsApp is especially important for the first message in your flow.'
          )}
        </p>
        <TembaComponent
          tag="temba-template-editor"
          eventHandlers={{
            'temba-context-changed': this.handleTemplateChanged,
            'temba-content-changed': this.handleTemplateVariableChanged
          }}
          template={uuid}
          url={this.props.assetStore.templates.endpoint}
          variables={JSON.stringify(this.state.templateVariables)}
          lang={
            this.props.language
              ? this.props.language.id !== 'base'
                ? this.props.language.id
                : null
              : null
          }
        ></TembaComponent>
        {this.state.expression && (
          <div className={styles.expression}>
            <TextInputElement
              name={'Expression'}
              showLabel={false}
              placeholder={'Expression'}
              onChange={(updatedText: string) => {
                this.setState({ expression: { value: updatedText } });
              }}
              entry={{ value: this.state.expression.value }}
              autocomplete={true}
            />
          </div>
        )}
        {this.state.templateTranslation ? (
          <>
            {this.state.templateTranslation.content && (
              <div className={styles.template_text}>{this.state.templateTranslation.content}</div>
            )}
            {range(0, this.state.templateTranslation.variable_count).map((num: number) => {
              return (
                <div className={styles.variable} key={'tr_arg_' + num}>
                  <TextInputElement
                    name={`${i18n.t('forms.variable', 'Variable')} ${num + 1}`}
                    showLabel={false}
                    placeholder={`${i18n.t('forms.variable', 'Variable')} ${num + 1}`}
                    onChange={(updatedText: string) => {
                      this.handleTemplateVariableChanged(updatedText, num);
                    }}
                    // entry={this.state.templateVariables[num]}
                    autocomplete={true}
                  />
                </div>
              );
            })}
          </>
        ) : null}
        {this.renderLabelOption()}
      </>
    );
  }

  private attachmentValidate(body: any, valid: boolean, validationFailures: any) {
    const attachments: any = mutate(this.state.attachments, {
      0: {
        $set: { type: body.type, url: body.url, valid, validationFailures }
      }
    });
    this.setState({ attachments });
  }

  private handleAttachmentUploading(isUploading: boolean) {
    const uploadError = '';
    this.setState({ uploadError });

    if (isUploading) {
      const uploadInProgress = true;
      this.setState({ uploadInProgress });
    } else {
      const uploadInProgress = false;
      this.setState({ uploadInProgress });
    }
  }

  private handleAttachmentUploaded(response: AxiosResponse) {
    //django returns a 200 even when there's an error
    if (response.data && response.data.error) {
      const uploadError: string = response.data.error;
      this.setState({ uploadError });
    } else {
      const attachments: any = mutate(this.state.attachments, {
        $push: [{ type: response.data.type, url: response.data.url, uploaded: true }]
      });
      this.setState({ attachments });

      const uploadError = '';

      this.setState({ uploadError });
    }

    const uploadInProgress = false;
    this.setState({ uploadInProgress });
  }

  private handleAttachmentUploadFailed(error: AxiosError) {
    //nginx returns a 300+ if there's an error
    let uploadError = '';
    const status = error.response.status;
    if (status >= 500) {
      uploadError = i18n.t('file_upload_failed_generic', 'File upload failed, please try again');
    } else if (status === 413) {
      uploadError = i18n.t('file_upload_failed_max_limit', 'Limit for file uploads is 25 MB');
    } else {
      uploadError = error.response.statusText;
    }
    this.setState({ uploadError });

    const uploadInProgress = false;
    this.setState({ uploadInProgress });
  }

  private handleAttachmentChanged(index: number, type: string, url: string) {
    this.handleAttachmentUploading(false);

    let attachments: any = this.state.attachments;

    const isExpression = type === 'expression';

    if (type && !isExpression && url) {
      window.clearTimeout(this.timeout);
      this.timeout = setTimeout(() => {
        validateURL(this.props.assetStore.validateMedia.endpoint, attachments[0], this);
      }, 1000);
    }

    if (index === -1) {
      attachments = mutate(attachments, {
        $push: [{ type, url, uploaded: false }]
      });
    } else {
      attachments = mutate(attachments, {
        [index]: {
          $set: { type, url, valid: !isExpression }
        }
      });
    }

    this.setState({ attachments });
  }

  public handleLabelsChanged(selected: Asset[], submitting: boolean = false): boolean {
    const updates: Partial<AddLabelsFormState> = {
      labels: validate(i18n.t('forms.labels', 'Labels'), selected, [shouldRequireIf(submitting)])
    };

    const updated = mergeForm(this.state, updates);
    this.setState(updated);
    return updated.valid;
  }

  private handleAttachmentRemoved(index: number) {
    const attachments: any = mutate(this.state.attachments, {
      $splice: [[index, 1]]
    });
    this.setState({ attachments });
  }

  public handleCreateAssetFromInput(input: string): any {
    return { name: input };
  }

  public handleLabelCreated(label: Asset): void {
    // update our store with our new group
    this.props.addAsset('labels', label);

    this.handleLabelsChanged(this.state.labels.value!.concat(label));
  }

  public render(): JSX.Element {
    const typeConfig = this.props.typeConfig;

    const attachments: Tab = {
      name: i18n.t('forms.attachments', 'Attachments'),
      body: renderAttachments(
        this.context.config.endpoints.attachments,
        this.context.config.attachmentsEnabled,
        this.state.attachments,
        this.state.uploadInProgress,
        this.state.uploadError,
        this.handleAttachmentUploading,
        this.handleAttachmentUploaded,
        this.handleAttachmentUploadFailed,
        this.handleAttachmentChanged,
        this.handleAttachmentRemoved
      ),
      checked: this.state.attachments.length > 0,
      hasErrors: this.state.attachments.length > 0 && this.state.attachments[0].valid
    };

    // Not needed in context of Glific
    // const advanced: Tab = {
    //   name: i18n.t('forms.advanced', 'Advanced'),
    //   body: (
    //     <CheckboxElement
    //       name={i18n.t('forms.all_destinations', 'All Destinations')}
    //       title={i18n.t('forms.all_destinations', 'All Destinations')}
    //       checked={this.state.sendAll}
    //       description={i18n.t(
    //         'forms.all_destinations_description',
    //         "Send a message to all destinations known for this contact. If you aren't sure what this means, leave it unchecked."
    //       )}
    //       onChange={this.handleSendAllUpdate}
    //     />
    //   ),
    //   checked: this.state.sendAll
    // };

    const tabs = [attachments];

    if (hasFeature(this.context.config, FeatureFilter.HAS_WHATSAPP)) {
      const templates: Tab = {
        name: 'WhatsApp',
        body: this.renderTemplateConfig(),
        checked: this.state.template !== null,
        hasErrors: this.hasTemplateErrors()
      };
      tabs.splice(0, 0, templates);
    }

    if (hasFeature(this.context.config, FeatureFilter.HAS_FACEBOOK)) {
      const templates: Tab = {
        name: 'Facebook',
        body: this.renderTopicConfig(),
        checked: this.state.topic.value != null
      };
      tabs.splice(0, 0, templates);
    }

    tabs.reverse();
    return (
      <Dialog
        title={typeConfig.name}
        headerClass={typeConfig.type}
        buttons={this.getButtons()}
        tabs={tabs}
      >
        <TypeList __className="" initialType={typeConfig} onChange={this.props.onTypeChange} />
        <TextInputElement
          name={i18n.t('forms.message', 'Message')}
          showLabel={false}
          counter=".sms-counter"
          onChange={this.handleMessageUpdate}
          entry={this.state.message}
          autocomplete={true}
          focus={true}
          textarea={true}
        />
        <temba-charcount class={`sms-counter ${styles.counter}`}></temba-charcount>
        {this.renderLabelOption()}
        {renderIssues(this.props)}
      </Dialog>
    );
  }
}
