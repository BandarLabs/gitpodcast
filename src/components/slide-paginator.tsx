import React, { useCallback } from 'react';
import { type Node, type NodeProps, useReactFlow } from '@xyflow/react';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import rehypeDocument from 'rehype-document';
import rehypeFormat from 'rehype-format';
import rehypeStringify from 'rehype-stringify';
import rehypeHighlight from 'rehype-highlight';
import 'highlight.js/styles/github.css';

export type SlideNode = Node<SlideData, 'slide'>;

export type SlideData = {
  source: string;
  left?: string;
  up?: string;
  down?: string;
  right?: string;
};

export const SLIDE_WIDTH = 600;
export const SLIDE_HEIGHT = 600;
export const SLIDE_PADDING = 100;

const style = {
  width: `${SLIDE_WIDTH}px`,
  height: `${SLIDE_HEIGHT}px`,
} satisfies React.CSSProperties;

async function renderMarkdown(markdown: string): Promise<string> {
    const file = await unified()
      .use(remarkParse)
      .use(remarkRehype)
      .use(rehypeDocument, { title: 'Slide' })
      .use(rehypeHighlight)
      .use(rehypeFormat)
      .use(rehypeStringify)
      .process(markdown);

    return String(file);
  }
export function Slide({ data }: NodeProps<SlideNode>) {
    if (!data) return null;
  const { source, left, up, down, right } = data;
  const { fitView } = useReactFlow();

  const moveToNextSlide = useCallback(
    (event: React.MouseEvent, id: string) => {
      event.stopPropagation();
      fitView({ nodes: [{ id }], duration: 150 });
    },
    [fitView],
  );
  const [html, setHtml] = React.useState<string | null>(null);

  React.useEffect(() => {
    renderMarkdown(source).then(setHtml);
  }, [source]);

  return (
    <article className="slide" style={style}>
      {/* <Remark key={source}>{source}</Remark> */}
      {html && <div dangerouslySetInnerHTML={{ __html: html }} />}
      <footer className="slide__controls nopan">
        {left && <button onClick={(e) => moveToNextSlide(e, left)}>←</button>}
        {up && <button onClick={(e) => moveToNextSlide(e, up)}>↑</button>}
        {down && <button onClick={(e) => moveToNextSlide(e, down)}>↓</button>}
        {right && <button onClick={(e) => moveToNextSlide(e, right)}>→</button>}
      </footer>
    </article>
  );
}
