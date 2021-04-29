/* eslint-disable @typescript-eslint/explicit-member-accessibility */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { react as bindCallbacks } from 'auto-bind';
import axios from 'axios';
import { ImCross } from 'react-icons/im';
import Loading from 'components/loading/Loading';
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
import CheckboxElement from 'components/form/checkbox/CheckboxElement';
import MultiChoiceInput from 'components/form/multichoice/MultiChoice';
import SelectElement, { SelectOption } from 'components/form/select/SelectElement';
import TextInputElement, { TextInputStyle } from 'components/form/textinput/TextInputElement';
import TypeList from 'components/nodeeditor/TypeList';
import Pill from 'components/pill/Pill';
import { fakePropType } from 'config/ConfigProvider';
import { fetchAsset, getCookie } from 'external';
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
import { MaxOfTenItems, Required, shouldRequireIf, validate } from 'store/validators';
import { createUUID, range } from 'utils';

import styles from './SendMsgForm.module.scss';
import { hasFeature } from 'config/typeConfigs';
import { FeatureFilter } from 'config/interfaces';

import i18n from 'config/i18n';
import { Trans } from 'react-i18next';
import { TembaSelectStyle } from 'temba/TembaSelect';

const MAX_ATTACHMENTS = 1;

const TYPE_OPTIONS: SelectOption[] = [
  { value: 'image', name: i18n.t('forms.image_url', 'Image URL') },
  { value: 'audio', name: i18n.t('forms.audio_url', 'Audio URL') },
  { value: 'video', name: i18n.t('forms.video_url', 'Video URL') },
  { value: 'application', name: i18n.t('forms.pdf_url', 'PDF Document URL') }
];

const getAttachmentTypeOption = (type: string): SelectOption => {
  return TYPE_OPTIONS.find((option: SelectOption) => option.value === type);
};

export interface Attachment {
  type: string;
  url: string;
  uploaded?: boolean;
}

export interface SendMsgFormState extends FormState {
  message: StringEntry;
  quickReplies: StringArrayEntry;
  quickReplyEntry: StringEntry;
  sendAll: boolean;
  attachments: Attachment[];
  template: FormEntry;
  topic: SelectOptionEntry;
  templateVariables: StringEntry[];
  templateTranslation?: TemplateTranslation;
  validAttachment: any;
  attachmentError: any;
}

export default class SendMsgForm extends React.Component<ActionFormProps, SendMsgFormState> {
  private filePicker: any;

  constructor(props: ActionFormProps) {
    super(props);
    this.state = stateToForm(this.props.nodeSettings, this.props.assetStore);
    bindCallbacks(this, {
      include: [/^handle/, /^on/]
    });
    // intialize our templates if we have them
    if (this.state.template.value !== null) {
      fetchAsset(this.props.assetStore.templates, this.state.template.value.uuid).then(
        (asset: Asset) => {
          if (asset !== null) {
            this.handleTemplateChanged([{ ...this.state.template.value, ...asset.content }]);
          }
        }
      );
    }
  }

  public static contextTypes = {
    config: fakePropType
  };

  private handleUpdate(
    keys: {
      text?: string;
      sendAll?: boolean;
      quickReplies?: string[];
    },
    submitting = false
  ): boolean {
    const updates: Partial<SendMsgFormState> = {};
    if (keys.hasOwnProperty('text')) {
      updates.message = validate(i18n.t('forms.message', 'Message'), keys.text, [
        shouldRequireIf(submitting)
      ]);
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

  public handleQuickRepliesUpdate(quickReplies: string[]): boolean {
    return this.handleUpdate({ quickReplies });
  }

  public handleSendAllUpdate(sendAll: boolean): boolean {
    return this.handleUpdate({ sendAll });
  }

  public handleAxios(body: any, type: any) {
    axios
      .get(`${this.props.assetStore.validateMedia.endpoint}?url=${body.url}&type=${body.type}`)
      .then(response => {
        if (response.data.is_valid) {
          // make sure we validate untouched text fields and contact fields
          // let valid = this.handleMessageUpdate(this.state.message.value, null, true);
          let valid = true;

          let templateVariables = this.state.templateVariables;
          // make sure we don't have untouched template variables
          this.state.templateVariables.forEach((variable: StringEntry, num: number) => {
            const updated = validate(`Variable ${num + 1}`, variable.value, [Required]);
            templateVariables = mutate(templateVariables, {
              [num]: { $merge: updated }
            }) as StringEntry[];
            valid = valid && !hasErrors(updated);
          });

          valid = valid && !hasErrors(this.state.quickReplyEntry);

          if (valid) {
            this.setState({ validAttachment: false });
            this.props.updateAction(stateToAction(this.props.nodeSettings, this.state));
            // notify our modal we are done
            this.props.onClose(false);
          } else {
            this.setState({ templateVariables, valid });
          }
        } else {
          this.setState({ attachmentError: response.data.message });
        }
      })
      .catch(error => {
        this.setState({ attachmentError: `The attachment url is invalid!: ${error.toString()}` });
      });
  }

  private handleSave(): void {
    if (this.state.attachments.length > 0) {
      const type = this.state.attachments[0].type;
      const url = this.state.attachments[0].url;

      let body = {
        type,
        url
      };

      if (type === 'application') {
        body.type = 'document';
      }

      switch (type) {
        case 'image':
          this.handleAxios(body, 'image');
          break;

        case 'video':
          this.handleAxios(body, 'video');
          break;

        case 'audio':
          this.handleAxios(body, 'audio');
          break;
        case 'application':
          this.handleAxios(body, 'document');
          break;
      }
      this.setState({ validAttachment: true, attachmentError: null });
    } else {
      // don't continue if our message already has errors
      if (hasErrors(this.state.message)) {
        return;
      }

      // make sure we validate untouched text fields and contact fields
      let valid = this.handleMessageUpdate(this.state.message.value, null, true);
      let templateVariables = this.state.templateVariables;
      // make sure we don't have untouched template variables
      this.state.templateVariables.forEach((variable: StringEntry, num: number) => {
        const updated = validate(`Variable ${num + 1}`, variable.value, [Required]);
        templateVariables = mutate(templateVariables, {
          [num]: { $merge: updated }
        }) as StringEntry[];
        valid = valid && !hasErrors(updated);
      });

      valid = valid && !hasErrors(this.state.quickReplyEntry);

      if (templateVariables.length > 0 && !this.state.message.value) {
        valid = !valid;
      }
      if (valid) {
        this.props.updateAction(stateToAction(this.props.nodeSettings, this.state));
        // notify our modal we are done
        this.props.onClose(false);
      } else {
        this.setState({ templateVariables, valid });
      }
    }
  }

  public handleAttachmentRemoved(index: number): void {
    // we found a match, merge us in
    const updated: any = mutate(this.state.attachments, {
      $splice: [[index, 1]]
    });
    this.setState({ attachments: updated, attachmentError: null, validAttachment: false });
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

  private renderUpload(index: number, attachment: Attachment): JSX.Element {
    return (
      <div
        className={styles.url_attachment}
        key={index > -1 ? 'url_attachment_' + index : createUUID()}
      >
        <div className={styles.type_choice}>
          <SelectElement
            key={'attachment_type_' + index}
            name={i18n.t('forms.type', 'Type')}
            style={TembaSelectStyle.small}
            entry={{
              value: { name: attachment.type }
            }}
            options={TYPE_OPTIONS}
            disabled={true}
          />
        </div>
        <div className={styles.url}>
          <span className={styles.upload}>
            <Pill
              icon="fe-download"
              text="Download"
              large={true}
              onClick={() => {
                window.open(attachment.url, '_blank');
              }}
            />
            <div className={styles.remove_upload}>
              <Pill
                icon="fe-x"
                text="Remove"
                large={true}
                onClick={() => {
                  this.handleAttachmentRemoved(index);
                }}
              />
            </div>
          </span>
        </div>
      </div>
    );
  }

  private handleUploadFile(files: FileList): void {
    let attachments: any = this.state.attachments;

    // if we have a csrf in our cookie, pass it along as a header
    const csrf = getCookie('csrftoken');
    const headers: any = csrf ? { 'X-CSRFToken': csrf } : {};

    // mark us as ajax
    headers['X-Requested-With'] = 'XMLHttpRequest';

    const data = new FormData();
    data.append('file', files[0]);
    axios
      .post(this.context.config.endpoints.attachments, data, { headers })
      .then(response => {
        attachments = mutate(attachments, {
          $push: [{ type: response.data.type, url: response.data.url, uploaded: true }]
        });
        this.setState({ attachments });
      })
      .catch(error => {
        console.log(error);
      });
  }

  private renderAttachment(index: number, attachment: Attachment): JSX.Element {
    let attachments: any = this.state.attachments;
    return (
      <>
        <div
          className={styles.url_attachment}
          key={index > -1 ? 'url_attachment_' + index : createUUID()}
        >
          <div className={styles.type_choice}>
            <SelectElement
              key={'attachment_type_' + index}
              style={TembaSelectStyle.small}
              name={i18n.t('forms.type_options', 'Type Options')}
              placeholder="Add Attachment"
              entry={{
                value: index > -1 ? getAttachmentTypeOption(attachment.type) : null
              }}
              onChange={(option: any) => {
                if (option.value === 'upload') {
                  window.setTimeout(() => {
                    this.filePicker.click();
                  }, 200);
                } else {
                  if (index === -1) {
                    attachments = mutate(attachments, {
                      $push: [{ type: option.value, url: '' }]
                    });
                  } else {
                    attachments = mutate(attachments, {
                      [index]: {
                        $set: { type: option.value, url: attachment.url }
                      }
                    });
                  }
                  this.setState({ attachments });
                }
              }}
              options={TYPE_OPTIONS}
            />
          </div>
          {index > -1 ? (
            <>
              <div className={styles.url}>
                <TextInputElement
                  placeholder="URL"
                  name={i18n.t('forms.url', 'URL')}
                  style={TextInputStyle.small}
                  onChange={(value: string) => {
                    attachments = mutate(attachments, {
                      [index]: { $set: { type: attachment.type, url: value } }
                    });
                    this.setState({ attachments });
                  }}
                  entry={{ value: attachment.url }}
                  autocomplete={true}
                />
              </div>
              <div className={styles.remove}>
                <Pill
                  icon="fe-x"
                  text=" Remove"
                  large={true}
                  onClick={() => {
                    this.handleAttachmentRemoved(index);
                  }}
                />
              </div>
            </>
          ) : null}
        </div>
        {this.state.validAttachment && !this.state.attachmentError ? (
          <div className={styles.loading}>
            Checking URL validity
            <Loading size={10} units={6} color="#999999" />
          </div>
        ) : null}
        {this.state.attachmentError ? (
          <div className={styles.error}>
            <ImCross className={styles.crossIcon} />
            {this.state.attachmentError}
          </div>
        ) : null}
      </>
    );
  }

  private renderAttachments(): JSX.Element {
    const attachments = this.state.attachments.map((attachment, index: number) =>
      attachment.uploaded
        ? this.renderUpload(index, attachment)
        : this.renderAttachment(index, attachment)
    );

    const emptyOption =
      this.state.attachments.length < MAX_ATTACHMENTS
        ? this.renderAttachment(-1, { url: '', type: '' })
        : null;
    return (
      <>
        <p>
          {i18n.t(
            'forms.send_msg_summary',
            'Add an attachment to each message. The attachment can be a file you upload or a dynamic URL using expressions and variables from your Flow.',
            { count: MAX_ATTACHMENTS }
          )}
        </p>
        {attachments}
        {emptyOption}
        <input
          style={{
            display: 'none'
          }}
          ref={ele => {
            this.filePicker = ele;
          }}
          type="file"
          onChange={e => this.handleUploadFile(e.target.files)}
        />
      </>
    );
  }

  private handleTemplateChanged(selected: any[]): void {
    const template = selected ? selected[0] : null;

    if (!template) {
      this.setState({
        template: { value: null },
        templateTranslation: null,
        templateVariables: []
      });
    } else {
      const templateTranslation = template.translations[0];
      const templateVariables =
        this.state.templateVariables.length === 0 ||
        (this.state.template.value && this.state.template.value.id !== template.id)
          ? range(0, templateTranslation.variable_count).map(() => {
              return {
                value: ''
              };
            })
          : this.state.templateVariables;

      this.setState({
        template: { value: template },
        templateTranslation,
        templateVariables
      });
    }
  }

  private handleTemplateVariableChanged(updatedText: string, num: number): void {
    const entry = validate(`Variable ${num + 1}`, updatedText, [Required]);
    const templateVariables = mutate(this.state.templateVariables, {
      $merge: { [num]: entry }
    }) as StringEntry[];
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

  private renderTemplateConfig(): JSX.Element {
    return (
      <>
        <p>
          {i18n.t(
            'forms.whatsapp_warning',
            'Sending messages over a WhatsApp channel requires that a template be used if you have not received a message from a contact in the last 24 hours. Setting a template to use over WhatsApp is especially important for the first message in your flow.'
          )}
        </p>
        <AssetSelector
          name={i18n.t('forms.template', 'template')}
          noOptionsMessage="No templates found"
          assets={this.props.assetStore.templates}
          entry={this.state.template}
          onChange={this.handleTemplateChanged}
          shouldExclude={this.handleShouldExcludeTemplate}
          searchable={true}
          formClearable={true}
        />
        {this.state.templateTranslation ? (
          <>
            <div className={styles.template_text}>{this.state.templateTranslation.content}</div>
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
                    entry={
                      this.state.templateVariables[num] === undefined
                        ? { value: '' }
                        : this.state.templateVariables[num]
                    }
                    autocomplete={true}
                  />
                </div>
              );
            })}
          </>
        ) : null}
      </>
    );
  }

  public render(): JSX.Element {
    const typeConfig = this.props.typeConfig;

    const quickReplies: Tab = {
      name: 'Quick Replies',
      body: (
        <>
          <p>
            {i18n.t(
              'forms.quick_replies_summary',
              'Quick Replies are made into buttons for supported channels. For example, when asking a question, you might add a Quick Reply for "Yes" and one for "No".'
            )}
          </p>

          <MultiChoiceInput
            name={i18n.t('forms.quick_reply', 'quick_reply')}
            helpText={
              <Trans i18nKey="forms.add_quick_reply">Add a new Quick Reply and press enter.</Trans>
            }
            items={this.state.quickReplies}
            entry={this.state.quickReplyEntry}
            onChange={this.handleQuickRepliesUpdate}
          />
        </>
      ),
      checked: this.state.quickReplies.value.length > 0,
      hasErrors: hasErrors(this.state.quickReplyEntry)
    };

    const attachments: Tab = {
      name: 'Attachments',
      body: this.renderAttachments(),
      checked: this.state.attachments.length > 0,
      hasErrors: this.state.validAttachment
    };

    const advanced: Tab = {
      name: 'Advanced',
      body: (
        <CheckboxElement
          name={i18n.t('forms.all_destinations', 'All Destinations')}
          title="All Destinations"
          labelClassName={styles.checkbox}
          checked={this.state.sendAll}
          description={i18n.t(
            'forms.all_destinations',
            "Send a message to all destinations known for this contact. If you aren't sure what this means, leave it unchecked."
          )}
          onChange={this.handleSendAllUpdate}
        />
      ),
      checked: this.state.sendAll
    };

    // const tabs = [quickReplies, attachments, advanced];
    const tabs = [attachments];

    if (hasFeature(this.context.config, FeatureFilter.HAS_WHATSAPP)) {
      const templates: Tab = {
        name: 'WhatsApp',
        body: this.renderTemplateConfig(),
        checked: this.state.template.value != null,
        hasErrors: !!this.state.templateVariables.find((entry: StringEntry) => hasErrors(entry))
      };
      tabs.splice(0, 0, templates);
    }

    // currently, we aren't support to facebook

    // if (hasFeature(this.context.config, FeatureFilter.HAS_FACEBOOK)) {
    //   const templates: Tab = {
    //     name: 'Facebook',
    //     body: this.renderTopicConfig(),
    //     checked: this.state.topic.value != null
    //   };
    //   tabs.splice(0, 0, templates);
    // }

    return (
      <>
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
          <temba-charcount class="sms-counter"></temba-charcount>
          {renderIssues(this.props)}
        </Dialog>
      </>
    );
  }
}
