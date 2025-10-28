import { react as bindCallbacks } from 'auto-bind';
import Dialog, { ButtonSet, Tab } from 'components/dialog/Dialog';
import { hasErrors, renderIssues } from 'components/flow/actions/helpers';
import { RouterFormProps } from 'components/flow/props';
import HeaderElement, { Header } from 'components/flow/routers/webhook/header/HeaderElement';
import {
  METHOD_OPTIONS,
  MethodOption,
  Methods,
  nodeToState,
  stateToNode,
  getDefaultBody,
  isValidJson
} from 'components/flow/routers/webhook/helpers';
import { createResultNameInput } from 'components/flow/routers/widgets';
import SelectElement from 'components/form/select/SelectElement';
import TextInputElement from 'components/form/textinput/TextInputElement';
import TypeList from 'components/nodeeditor/TypeList';
import TembaSelectElement from 'temba/TembaSelectElement';
import * as React from 'react';
import { FormEntry, FormState, mergeForm, StringEntry, ValidationFailure } from 'store/nodeEditor';
import {
  LowerCaseAlphaNumeric,
  shouldRequireIf,
  StartIsNonNumeric,
  validate,
  ValidURL,
  validateIf,
  Alphanumeric
} from 'store/validators';
import { createUUID } from 'utils';

import styles from './WebhookRouterForm.module.scss';
import { Trans } from 'react-i18next';
import i18n from 'config/i18n';
import { fakePropType } from 'config/ConfigProvider';

export interface HeaderEntry extends FormEntry {
  value: Header;
}

export interface MethodEntry extends FormEntry {
  value: MethodOption;
}

export interface WebhookRouterFormState extends FormState {
  headers: HeaderEntry[];
  method: MethodEntry;
  url: StringEntry;
  body: StringEntry;
  resultName: StringEntry;
  webhookFunction: FormEntry;
  webhookOptions: { name: string; body?: string }[];
}

export default class WebhookRouterForm extends React.Component<
  RouterFormProps,
  WebhookRouterFormState
> {
  public static contextTypes = {
    config: fakePropType
  };

  constructor(props: RouterFormProps) {
    super(props);

    this.state = {
      ...nodeToState(this.props.nodeSettings),
      webhookFunction: { value: null },
      webhookOptions: []
    };

    bindCallbacks(this, {
      include: [/^handle/]
    });
  }

  async componentDidMount() {
    const endpoint = this.context.config.endpoints.completion;
    const response = await fetch(endpoint);
    const data = await response.json();

    const webhookOptions = (data.webhook || []).map((webhook: any) => ({
      name: webhook.name,
      body: webhook.body
    }));

    this.setState({ webhookOptions });
  }

  private handleWebhookFunctionChanged(selected: any[]): boolean {
    const selectedArray = !selected ? [] : Array.isArray(selected) ? selected : [selected];

    if (selectedArray.length === 0) {
      const updates: Partial<WebhookRouterFormState> = {
        webhookFunction: { value: null },
        url: { value: '' },
        body: { value: '' }
      };
      const updated = mergeForm(this.state, updates) as WebhookRouterFormState;
      this.setState(updated);
      return updated.valid;
    }

    const selectedItem = selectedArray[0];
    const webhookName =
      typeof selectedItem === 'string'
        ? selectedItem
        : selectedItem?.value ||
          selectedItem?.name ||
          selectedItem?.id ||
          selectedItem?.label ||
          '';

    const webhook = this.state.webhookOptions.find(w => w.name === webhookName);

    const updates: Partial<WebhookRouterFormState> = {
      webhookFunction: { value: selectedArray },
      url: { value: webhookName },
      body: { value: webhook?.body || '' }
    };

    const updated = mergeForm(this.state, updates) as WebhookRouterFormState;
    this.setState(updated);

    return updated.valid;
  }

  private handleUpdate(
    keys: {
      method?: MethodOption;
      url?: string;
      body?: string;
      header?: Header;
      removeHeader?: Header;
      validationFailures?: ValidationFailure[];
      resultName?: string;
    },
    submitting = false
  ): boolean {
    const updates: Partial<WebhookRouterFormState> = {};

    let ensureEmptyHeader = false;
    let toRemove: any[] = [];

    if (keys.hasOwnProperty('method') && keys.method) {
      updates.method = { value: keys.method };

      const oldMethod = this.state.method.value.value;
      const newMethod = keys.method.value;

      if (oldMethod !== newMethod) {
        const existingContentTypeHeader = this.state.headers.find(
          (header: HeaderEntry) => header.value.name.toLowerCase() === 'content-type'
        );

        // Only set default body for non-FUNCTION methods
        if (newMethod !== Methods.FUNCTION) {
          updates.body = { value: getDefaultBody(newMethod) };
        }

        // switching from a GET, add a content-type
        if (oldMethod === Methods.GET && newMethod !== Methods.GET) {
          if (!existingContentTypeHeader) {
            let uuid = createUUID();
            const lastHeader =
              this.state.headers.length > 0
                ? this.state.headers[this.state.headers.length - 1]
                : null;
            if (lastHeader && !lastHeader.value.name) {
              uuid = lastHeader.value.uuid;
            }
            keys.header = { uuid, name: 'Content-Type', value: 'application/json' };
          }
        } else if (oldMethod !== Methods.GET && newMethod === Methods.GET) {
          if (existingContentTypeHeader) {
            toRemove = [{ headers: [{ value: existingContentTypeHeader.value }] }];
          }
        }
      }
    }

    if (keys.hasOwnProperty('url')) {
      updates.url = validate(i18n.t('forms.url', 'URL'), keys.url, [
        shouldRequireIf(submitting),
        validateIf(ValidURL, keys.url.indexOf('@') === -1)
      ]);
    }

    if (keys.hasOwnProperty('resultName')) {
      updates.resultName = validate(i18n.t('forms.result_name', 'Result Name'), keys.resultName, [
        shouldRequireIf(submitting),
        LowerCaseAlphaNumeric,
        Alphanumeric,
        StartIsNonNumeric
      ]);
    }

    if (keys.hasOwnProperty('body')) {
      // Don't validate JSON for empty body in FUNCTION method
      const isFunction = this.state.method.value.value === Methods.FUNCTION;
      if (isFunction && keys.body.trim() === '') {
        updates.body = { value: keys.body };
      } else {
        updates.body = validate('POST body', keys.body, [isValidJson()]);
      }
    }

    if (keys.hasOwnProperty('header')) {
      updates.headers = [{ value: keys.header, validationFailures: keys.validationFailures }];
      ensureEmptyHeader = true;
    }

    if (keys.hasOwnProperty('removeHeader')) {
      toRemove = [{ headers: [{ value: keys.removeHeader }] }];
      ensureEmptyHeader = true;
    }

    const updated = mergeForm(this.state, updates, toRemove);

    this.setState(updated, () => {
      if (ensureEmptyHeader) {
        let needsHeader = true;
        for (const header of this.state.headers) {
          if (header.value.name.trim() === '') {
            needsHeader = false;
            break;
          }
        }
        if (needsHeader) {
          this.handleCreateHeader();
        }
      }
    });
    return updated.valid;
  }

  private handleUpdateResultName(value: string): boolean {
    return this.handleUpdate({ resultName: value });
  }

  private handleMethodUpdate(method: MethodOption): boolean {
    return this.handleUpdate({ method });
  }

  private handleUrlUpdate(url: string, name: string, submitting = false): boolean {
    return this.handleUpdate({ url }, submitting);
  }

  private handleHeaderRemoved(removeHeader: Header): boolean {
    return this.handleUpdate({ removeHeader });
  }

  private handleHeaderUpdated(header: Header, validationFailures: ValidationFailure[]): boolean {
    return this.handleUpdate({ header, validationFailures });
  }

  private handleCreateHeader(): boolean {
    return this.handleUpdate({
      header: {
        uuid: createUUID(),
        name: '',
        value: ''
      }
    });
  }

  private handleBodyUpdate(body: string): boolean {
    return this.handleUpdate({ body });
  }

  private handleSave(): void {
    let valid = false;
    if (this.state.method.value.name === 'FUNCTION') {
      valid = this.handleUpdate({ resultName: this.state.resultName.value }, true);
    } else {
      valid = this.handleUpdate(
        { url: this.state.url.value, resultName: this.state.resultName.value },
        true
      );
    }

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

    const headerElements: JSX.Element[] = this.state.headers.map(
      (header: HeaderEntry, index: number) => {
        return (
          <div key={`header_${header.value.uuid}`}>
            <HeaderElement
              entry={header}
              onRemove={this.handleHeaderRemoved}
              onChange={this.handleHeaderUpdated}
              index={index}
            />
          </div>
        );
      }
    );

    const tabs: Tab[] = [];
    tabs.push({
      name: i18n.t('forms.http_headers', 'HTTP Headers'),
      hasErrors: !!this.state.headers.find((header: HeaderEntry) => hasErrors(header)),
      body: (
        <>
          <p className={styles.info}>
            <Trans i18nKey="forms.webhook_header_summary">
              Add any additional headers below that you would like to send along with your request.
            </Trans>
          </p>
          {headerElements}
        </>
      ),
      checked: this.state.headers.length > 1
    });

    const method = this.state.method.value.value;
    const name = this.state.method.value.name + ' ' + i18n.t('body', 'Body');
    tabs.push({
      name,
      body: (
        <div key="post_body" className={styles.body_form}>
          <h4>{name}</h4>
          <p>
            <Trans
              i18nKey="forms.webhook_body_summary"
              values={{ method: this.state.method.value.name }}
            >
              Modify the body of the [[method]] request that will be sent to your webhook.
            </Trans>
          </p>
          <TextInputElement
            __className={styles.req_body}
            name={name}
            showLabel={false}
            entry={this.state.body}
            onChange={this.handleBodyUpdate}
            autogrow={true}
            helpText={
              <Trans
                i18nKey="forms.webhook_body_summary"
                values={{ method: this.state.method.value.name }}
              >
                Modify the body of the [[method]] request that will be sent to your webhook.
              </Trans>
            }
            autocomplete={true}
            textarea={true}
          />
        </div>
      ),
      checked: this.state.body.value !== getDefaultBody(method),
      hasErrors: this.state.body.validationFailures
        ? this.state.body.validationFailures.length > 0
        : false
    });

    tabs.reverse();

    return (
      <Dialog
        title={typeConfig.name}
        headerClass={typeConfig.type}
        buttons={this.getButtons()}
        tabs={tabs}
      >
        <TypeList __className="" initialType={typeConfig} onChange={this.props.onTypeChange} />
        <div style={{ display: 'flex', alignItems: 'flex-end' }}>
          <div className={styles.method}>
            <SelectElement
              key="method_select"
              name={i18n.t('forms.method', 'Method')}
              entry={this.state.method}
              onChange={this.handleMethodUpdate}
              options={METHOD_OPTIONS}
            />
          </div>
          <div className={styles.url}>
            {method === 'FUNCTION' ? (
              <TembaSelectElement
                key="webhook_function_select"
                name={i18n.t('forms.function', 'Function')}
                placeholder={i18n.t('forms.select_or_type', 'Type to search or select')}
                entry={this.state.webhookFunction}
                searchable={true}
                multi={false}
                expressions={false}
                onChange={this.handleWebhookFunctionChanged}
                options={this.state.webhookOptions.map(webhook => ({
                  name: webhook.name,
                  value: webhook.name,
                  id: webhook.name,
                  label: webhook.name
                }))}
              />
            ) : (
              <TextInputElement
                name={i18n.t('forms.url', 'URL')}
                placeholder={i18n.t('forms.enter_a_url', 'Enter a URL')}
                entry={this.state.url}
                onChange={this.handleUrlUpdate}
                autocomplete={true}
              />
            )}
          </div>
        </div>
        <div className={styles.instructions}>
          <p>
            <Trans i18nKey="forms.webhook_help">
              If your server responds with JSON, each property will be added to the Flow.
            </Trans>
          </p>
          <pre className={styles.code}>
            {'{ "product": "Solar Charging Kit", "stock level": 32 }'}
          </pre>
          <p>
            <Trans i18nKey="forms.webhook_example">
              This response would add <span className={styles.example}>@webhook.product</span> and{' '}
              <span className={styles.example}>@(webhook["stock level"])</span> for use in the flow.
            </Trans>
          </p>
        </div>
        {createResultNameInput(this.state.resultName, this.handleUpdateResultName)}
        {renderIssues(this.props)}
      </Dialog>
    );
  }

  public render(): JSX.Element {
    return this.renderEdit();
  }
}
