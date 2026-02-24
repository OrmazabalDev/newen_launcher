import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import rehypeSanitize from "rehype-sanitize";
import { MODRINTH_SANITIZE_SCHEMA } from "../constants";

type ModrinthMarkdownProps = {
  content: string;
};

export function ModrinthMarkdown({ content }: ModrinthMarkdownProps) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeRaw, [rehypeSanitize, MODRINTH_SANITIZE_SCHEMA]]}
      components={{
        h1: ({ node: _node, ...props }) => (
          <h3 className="text-lg font-bold text-white mt-4 mb-2" {...props} />
        ),
        h2: ({ node: _node, ...props }) => (
          <h4 className="text-base font-bold text-white mt-4 mb-2" {...props} />
        ),
        h3: ({ node: _node, ...props }) => (
          <h5 className="text-sm font-bold text-white mt-3 mb-2" {...props} />
        ),
        p: ({ node: _node, ...props }) => (
          <div className="text-sm text-gray-200 leading-relaxed mb-3" {...props} />
        ),
        li: ({ node: _node, ...props }) => (
          <li className="text-sm text-gray-200 list-disc ml-5 mb-1" {...props} />
        ),
        a: ({ node: _node, ...props }) => (
          <a className="text-brand-info underline" target="_blank" rel="noreferrer" {...props} />
        ),
        center: ({ node: _node, children }) => <div className="text-center">{children}</div>,
        img: ({
          node: _node,
          className: _className,
          style: _style,
          width: _width,
          height: _height,
          ...props
        }) => (
          <div className="w-full flex justify-center my-3">
            <img
              {...props}
              className="rounded-lg border border-gray-800 w-full max-w-[560px] max-h-72 object-contain"
              style={{ maxHeight: 288, height: "auto" }}
            />
          </div>
        ),
        iframe: ({
          node: _node,
          className: _className,
          style: _style,
          width: _width,
          height: _height,
          ...props
        }) => (
          <div className="w-full max-w-[720px] mx-auto aspect-video overflow-hidden rounded-lg border border-gray-800 my-3 bg-gray-950">
            <iframe {...props} className="w-full h-full" allowFullScreen />
          </div>
        ),
        blockquote: ({ node: _node, ...props }) => (
          <blockquote
            className="border-l-2 border-gray-700 pl-3 text-gray-300 italic mb-3"
            {...props}
          />
        ),
        code: ({ node: _node, ...props }) => (
          <code className="text-xs bg-gray-800 px-1 py-0.5 rounded" {...props} />
        ),
      }}
    >
      {content}
    </ReactMarkdown>
  );
}
