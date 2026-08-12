import { renderToStaticMarkup } from 'react-dom/server';
import {
  CUSTOM_UI_CATEGORY_NAME,
  CUSTOM_UI_LABEL,
  UNSUPPORTED_MESSAGE,
  getHeader,
  getMsgBody,
  stateToRouter
} from 'components/flow/actions/sendinteractivemsg/helpers';
import { SwitchRouter } from 'flowTypes';

const customUIContent = {
  type: 'custom_ui',
  version: '1',
  component: 'glific/image_panel',
  props: {
    id: 'course',
    options: [{ id: 'c1', image: 'https://example.com/a.png', label: 'Spoken English' }]
  },
  fallback: 'Pick a course',
  context: {}
};

const getSettings = (): any => ({
  originalAction: null,
  originalNode: {
    ghost: true,
    node: {
      uuid: 'node-0',
      actions: [],
      exits: [{ uuid: 'exit-0' }]
    },
    ui: { position: { left: 0, top: 0 } },
    inboundConnections: {}
  }
});

const getState = (interactiveContent: any): any => ({
  interactives: {
    value: {
      id: 1,
      name: 'custom ui template',
      interactive_content: interactiveContent,
      translations: {}
    }
  },
  labels: { value: [] },
  listValues: [],
  listValuesCount: '',
  valid: true
});

const assetStore: any = { results: { items: {} } };

describe('SendInteractiveMsg.helpers', () => {
  describe('stateToRouter', () => {
    it('should emit no cases and a single default "Responded" category for custom_ui', () => {
      const renderNode = stateToRouter(getSettings(), getState(customUIContent), assetStore);
      const router = renderNode.node.router as SwitchRouter;

      expect(router.cases).toEqual([]);
      expect(router.categories.length).toBe(1);
      expect(router.categories[0].name).toBe(CUSTOM_UI_CATEGORY_NAME);
      expect(router.default_category_uuid).toBe(router.categories[0].uuid);
      expect(renderNode.node.exits.length).toBe(1);
      expect(renderNode.node.exits[0].uuid).toBe(router.categories[0].exit_uuid);
    });

    it('should still build cases for quick_reply', () => {
      const quickReply = {
        type: 'quick_reply',
        content: { type: 'text', text: 'Are you well?' },
        options: [{ title: 'yes' }, { title: 'no' }]
      };

      const renderNode = stateToRouter(getSettings(), getState(quickReply), assetStore);
      const router = renderNode.node.router as SwitchRouter;

      const categoryNames = router.categories.map(category => category.name);
      expect(categoryNames).toEqual(expect.arrayContaining(['Yes', 'No']));
      expect(router.categories.length).toBeGreaterThan(1);
    });
  });

  describe('getHeader', () => {
    it('should name the component for custom_ui', () => {
      expect(getHeader(customUIContent)).toBe(`${CUSTOM_UI_LABEL}: glific/image_panel`);
    });

    it('should fall back to a bare label when the component is missing', () => {
      expect(getHeader({ ...customUIContent, component: undefined })).toBe(CUSTOM_UI_LABEL);
    });

    it('should not return a header for an unknown type', () => {
      expect(getHeader({ type: 'something_new', fallback: 'hi' })).toBeUndefined();
    });
  });

  describe('getMsgBody', () => {
    it('should render the fallback text for custom_ui', () => {
      const body = getMsgBody(customUIContent);
      expect(body).toBeTruthy();
      expect(renderToStaticMarkup(body)).toContain('Pick a course');
    });

    it('should render something for custom_ui even without fallback text', () => {
      const body = getMsgBody({ ...customUIContent, fallback: '' });
      expect(body).toBeTruthy();
      expect(renderToStaticMarkup(body)).toContain(UNSUPPORTED_MESSAGE);
    });

    it('should degrade to readable text for an unknown type', () => {
      const body = getMsgBody({ type: 'something_new', fallback: 'plain text here' });
      expect(body).toBeTruthy();
      expect(renderToStaticMarkup(body)).toContain('plain text here');
    });

    it('should never render a non string value as a react child', () => {
      const body = getMsgBody({ type: 'something_new', body: { text: 'nested' } });
      expect(renderToStaticMarkup(body)).toContain(UNSUPPORTED_MESSAGE);
    });
  });
});
