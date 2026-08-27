import { Canvas, CANVAS_PADDING, CanvasProps } from 'components/canvas/Canvas';
import { CanvasDraggableProps } from 'components/canvas/CanvasDraggable';
import React from 'react';
import { fireEvent, render } from 'test/utils';
import { CLIPBOARD_KEY } from 'store/thunks';
import { createUUID } from 'utils';

const ele = (selected: boolean): JSX.Element => <div>I am a draggable element</div>;

const baseProps: CanvasProps = {
  uuid: createUUID(),
  draggingNew: false,
  dragActive: false,
  onDragging: jest.fn(),
  onUpdatePositions: jest.fn(),
  mergeEditorState: jest.fn(),
  onRemoveNodes: jest.fn(),
  onDoubleClick: jest.fn(),
  onLoaded: jest.fn(),
  draggables: [],
  newDragElement: <div></div>,
  mutable: true
};

describe(Canvas.name, () => {
  it('render default', () => {
    const { baseElement } = render(<Canvas {...baseProps} />);
    expect(baseElement).toMatchSnapshot();
  });

  it('initializes the height to the lowest draggable', () => {
    const lowest: CanvasDraggableProps = {
      elementCreator: jest.fn(),
      uuid: createUUID(),
      position: { top: 1200, left: 100, bottom: 1290, right: 300 },
      idx: 0
    };
    const { baseElement, getByTestId } = render(<Canvas {...baseProps} draggables={[lowest]} />);
    expect(getByTestId('canvas').style.height).toBe(1290 + CANVAS_PADDING + 'px');
    expect(baseElement).toMatchSnapshot();
  });

  it('adjusts the height when updating dimensions', () => {
    const uuid = createUUID();
    const lowest: CanvasDraggableProps = {
      elementCreator: jest.fn(),
      uuid,
      position: { top: 1200, left: 100, right: 200, bottom: 1400 },
      idx: 0
    };

    const { baseElement, getByTestId } = render(<Canvas {...baseProps} draggables={[lowest]} />);
    expect(getByTestId('canvas').style.height).toBe(lowest.position.bottom + CANVAS_PADDING + 'px');
    expect(baseElement).toMatchSnapshot();
  });

  it('reflows collisions', () => {
    jest.useFakeTimers();

    const first: CanvasDraggableProps = {
      elementCreator: jest.fn(),
      uuid: createUUID(),
      position: { top: 100, bottom: 200, left: 100, right: 200 },
      idx: 0
    };

    const second: CanvasDraggableProps = {
      elementCreator: jest.fn(),
      uuid: createUUID(),
      position: { top: 150, left: 100, bottom: 250, right: 200 },
      idx: 0
    };

    const onDragging = jest.fn();

    const { getByTestId } = render(
      <Canvas {...baseProps} draggables={[first, second]} onDragging={onDragging} />
    );

    // trigger reflow by simulating a drag event
    fireEvent.mouseDown(getByTestId('draggable_' + first.uuid));
    fireEvent.mouseUp(getByTestId('draggable_' + first.uuid));
    jest.runAllTimers();

    expect(onDragging).toMatchCallSnapshot();
  });

  describe('Ctrl+V paste', () => {
    afterEach(() => {
      localStorage.removeItem(CLIPBOARD_KEY);
    });

    it('calls pasteNode with snapped mouse position on Ctrl+V', () => {
      localStorage.setItem(CLIPBOARD_KEY, JSON.stringify({ primary: {} }));

      const pasteNode = jest.fn();
      const { getByTestId } = render(<Canvas {...baseProps} pasteNode={pasteNode} />);

      // move mouse to a known canvas position
      fireEvent.mouseMove(getByTestId('canvas'), { pageX: 120, pageY: 230 });

      fireEvent.keyDown(document, { key: 'v', ctrlKey: true });
      expect(pasteNode).toHaveBeenCalledTimes(1);
    });

    it('does not call pasteNode when clipboard is empty', () => {
      const pasteNode = jest.fn();
      render(<Canvas {...baseProps} pasteNode={pasteNode} />);

      fireEvent.keyDown(document, { key: 'v', ctrlKey: true });
      expect(pasteNode).not.toHaveBeenCalled();
    });

    it('does not call pasteNode when nodeEditorOpen is true', () => {
      localStorage.setItem(CLIPBOARD_KEY, JSON.stringify({ primary: {} }));

      const pasteNode = jest.fn();
      render(<Canvas {...baseProps} pasteNode={pasteNode} nodeEditorOpen={true} />);

      fireEvent.keyDown(document, { key: 'v', ctrlKey: true });
      expect(pasteNode).not.toHaveBeenCalled();
    });

    it('does not call pasteNode when an input is focused', () => {
      localStorage.setItem(CLIPBOARD_KEY, JSON.stringify({ primary: {} }));

      const pasteNode = jest.fn();
      render(<Canvas {...baseProps} pasteNode={pasteNode} />);

      const input = document.createElement('input');
      document.body.appendChild(input);
      input.focus();

      fireEvent.keyDown(document, { key: 'v', ctrlKey: true });
      expect(pasteNode).not.toHaveBeenCalled();

      document.body.removeChild(input);
    });

    it('does not call pasteNode when a contenteditable element is focused', () => {
      localStorage.setItem(CLIPBOARD_KEY, JSON.stringify({ primary: {} }));

      const pasteNode = jest.fn();
      render(<Canvas {...baseProps} pasteNode={pasteNode} />);

      const editable = document.createElement('div');
      editable.tabIndex = 0;
      Object.defineProperty(editable, 'isContentEditable', { value: true, configurable: true });
      document.body.appendChild(editable);
      editable.focus();

      fireEvent.keyDown(document, { key: 'v', ctrlKey: true });
      expect(pasteNode).not.toHaveBeenCalled();

      document.body.removeChild(editable);
    });

    it('calls pasteNode on Ctrl+Shift+V (uppercase key)', () => {
      localStorage.setItem(CLIPBOARD_KEY, JSON.stringify({ primary: {} }));

      const pasteNode = jest.fn();
      render(<Canvas {...baseProps} pasteNode={pasteNode} />);

      fireEvent.keyDown(document, { key: 'V', ctrlKey: true, shiftKey: true });
      expect(pasteNode).toHaveBeenCalledTimes(1);
    });
  });
});
