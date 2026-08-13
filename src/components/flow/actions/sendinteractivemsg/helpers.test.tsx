import { renderToStaticMarkup } from 'react-dom/server';
import {
  BLOCKS_CATEGORY_NAME,
  BLOCKS_LABEL,
  BLOCKS_NO_TEXT_MESSAGE,
  UNSUPPORTED_MESSAGE,
  deriveBodyText,
  getComponentName,
  getHeader,
  getMsgBody,
  stateToRouter
} from 'components/flow/actions/sendinteractivemsg/helpers';
import { SwitchRouter } from 'flowTypes';

const text = (value: string): any => ({ kind: 'text', value });
const alt = (value: string): any => ({ kind: 'alt', value });
const image = (value: string): any => ({ kind: 'image', value });

// the stored (typed) form of a glific/image-panel template - blocks contract section 2 & 6
const blocksContent = {
  type: 'blocks',
  version: 1,
  component: 'glific/image-panel',
  props: {
    id: 'course',
    body: text('Pick a course'),
    options: {
      kind: 'list',
      value: [
        {
          id: 'c1',
          image: image('https://example.com/english.png'),
          image_alt: alt('Adult English class'),
          label: text('Spoken English')
        }
      ]
    }
  },
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
      name: 'blocks template',
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
    it('should emit no cases and a single default "Responded" category for blocks', () => {
      const renderNode = stateToRouter(getSettings(), getState(blocksContent), assetStore);
      const router = renderNode.node.router as SwitchRouter;

      expect(router.cases).toEqual([]);
      expect(router.categories.length).toBe(1);
      expect(router.categories[0].name).toBe(BLOCKS_CATEGORY_NAME);
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

  describe('getComponentName', () => {
    it('should give a friendly name to every built in block', () => {
      expect(getComponentName('glific/image-panel')).toBe('Image panel');
      expect(getComponentName('glific/carousel')).toBe('Carousel');
      expect(getComponentName('glific/form')).toBe('Form');
    });

    it('should show a component outside the glific namespace verbatim', () => {
      expect(getComponentName('tap/course-picker')).toBe('tap/course-picker');
    });

    it('should fall back to a bare label when the component is missing', () => {
      expect(getComponentName(undefined)).toBe(BLOCKS_LABEL);
      expect(getComponentName('')).toBe(BLOCKS_LABEL);
      expect(getComponentName({ name: 'nope' })).toBe(BLOCKS_LABEL);
    });
  });

  describe('getHeader', () => {
    it('should name the component for blocks', () => {
      expect(getHeader(blocksContent)).toBe('Image panel');
    });

    it('should fall back to a bare label when the component is missing', () => {
      expect(getHeader({ ...blocksContent, component: undefined })).toBe(BLOCKS_LABEL);
    });

    it('should not return a header for an unknown type', () => {
      expect(getHeader({ type: 'something_new', fallback: 'hi' })).toBeUndefined();
    });
  });

  describe('deriveBodyText', () => {
    it('should join every text node in sorted key order', () => {
      expect(deriveBodyText(blocksContent)).toBe('Pick a course — Spoken English');
    });

    it('should visit the keys of a map sorted bytewise, not in authored order', () => {
      expect(deriveBodyText({ props: { title: text('T'), body: text('B') } })).toBe('B — T');
    });

    it('should skip alt nodes, which are accessibility metadata and not body copy', () => {
      expect(deriveBodyText(blocksContent)).not.toContain('Adult English class');
    });

    it('should recurse into list nodes and nested items', () => {
      const carousel = {
        type: 'blocks',
        version: 1,
        component: 'glific/carousel',
        props: {
          id: 'product',
          body: text('Browse our courses'),
          cards: {
            kind: 'list',
            value: [
              {
                id: 'p1',
                image: image('https://example.com/a.png'),
                image_alt: alt('Students at desks'),
                title: text('Course A'),
                description: text('Six weeks')
              },
              { id: 'p2', title: text('Course B') }
            ]
          }
        }
      };

      // the card is authored title before description, but sorted key order puts
      // "description" first - contract section 9, and what the backend already produces.
      // list elements keep their array order, so card p1 still precedes card p2.
      expect(deriveBodyText(carousel)).toBe('Browse our courses — Six weeks — Course A — Course B');
    });

    it('should ignore non text kinds and structural values', () => {
      const form = {
        type: 'blocks',
        version: 1,
        component: 'glific/form',
        props: {
          id: 'signup',
          fields: {
            kind: 'list',
            value: [
              {
                id: 'name',
                label: text('Your name'),
                label_alt: alt('The name we should call you'),
                required: { kind: 'boolean', value: true },
                max: { kind: 'number', value: 20 },
                help: { kind: 'url', value: 'https://example.com/help' },
                icon: image('https://example.com/icon.png')
              }
            ]
          }
        }
      };

      expect(deriveBodyText(form)).toBe('Your name');
    });

    it('should keep a text node that opts out of translation', () => {
      expect(
        deriveBodyText({ props: { brand: { kind: 'text', value: 'Glific', translate: false } } })
      ).toBe('Glific');
    });

    it('should treat an object with extra keys as a plain object and walk into it', () => {
      const payload = {
        props: { odd: { kind: 'text', value: 'skipped', extra: 1, inner: text('kept') } }
      };
      expect(deriveBodyText(payload)).toBe('kept');
    });

    it('should drop whitespace only text nodes rather than emit a stray separator', () => {
      const payload = {
        props: { a: text('   '), b: text('Hi'), c: text('\t\n'), d: text('') }
      };

      expect(deriveBodyText(payload)).toBe('Hi');
    });

    it('should never walk context, which is echoed back to the org verbatim', () => {
      const payload = {
        type: 'blocks',
        version: 1,
        component: 'tap/course-picker',
        props: { body: text('Hi') },
        context: { note: { kind: 'text', value: 'internal' }, nested: { deep: text('hidden') } }
      };

      expect(deriveBodyText(payload)).toBe('Hi');
    });

    it('should not derive text from the envelope keys outside props', () => {
      expect(deriveBodyText({ type: 'blocks', component: 'glific/form' })).toBe('');
      expect(deriveBodyText({ props: [text('list props are not a map')] })).toBe('');
    });

    it('should return an empty string for a payload with no text nodes', () => {
      const customBlock = {
        type: 'blocks',
        version: 1,
        component: 'tap/leaderboard',
        props: { id: 'board', top: { kind: 'number', value: 10 } },
        context: {}
      };

      expect(deriveBodyText(customBlock)).toBe('');
      expect(deriveBodyText({})).toBe('');
    });

    it('should clamp the derived body to 500 characters', () => {
      const long = { props: { body: text('a'.repeat(900)) } };
      expect(deriveBodyText(long).length).toBe(500);
    });
  });

  describe('getMsgBody', () => {
    it('should render the derived text for blocks', () => {
      const body = getMsgBody(blocksContent);
      expect(body).toBeTruthy();
      expect(renderToStaticMarkup(body)).toContain('Pick a course');
    });

    it('should render a placeholder for a block with no text nodes', () => {
      const body = getMsgBody({ type: 'blocks', component: 'tap/leaderboard', props: { id: 'b' } });
      expect(body).toBeTruthy();
      expect(renderToStaticMarkup(body)).toContain(BLOCKS_NO_TEXT_MESSAGE);
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
