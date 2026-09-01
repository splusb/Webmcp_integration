"use client";

import ReactMarkdown from "react-markdown";

/**
 * MarkdownMessage — renders an agent message written in Markdown.
 *
 * The agent (OpenAI) replies in Markdown: **bold**, [links](url), and
 * "- " bullet lists. Rendering the raw string shows those symbols literally,
 * so we parse it here and map each element to a Tailwind-styled node.
 *
 * Links open in a new tab. Long URLs wrap instead of overflowing the bubble.
 */
export function MarkdownMessage({ content }: { content: string }) {
  return (
    <div className="space-y-2 text-sm leading-relaxed [&_a]:break-words">
      <ReactMarkdown
        components={{
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-blue-600 underline underline-offset-2 hover:text-blue-800"
            >
              {children}
            </a>
          ),
          p: ({ children }) => <p className="whitespace-pre-wrap">{children}</p>,
          strong: ({ children }) => (
            <strong className="font-semibold text-gray-900">{children}</strong>
          ),
          ul: ({ children }) => (
            <ul className="ml-4 list-disc space-y-0.5">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="ml-4 list-decimal space-y-1">{children}</ol>
          ),
          li: ({ children }) => <li className="pl-1">{children}</li>,
          code: ({ children }) => (
            <code className="rounded bg-gray-200/70 px-1 py-0.5 font-mono text-[12px] text-gray-800">
              {children}
            </code>
          ),
          h1: ({ children }) => <h3 className="text-base font-semibold">{children}</h3>,
          h2: ({ children }) => <h3 className="text-base font-semibold">{children}</h3>,
          h3: ({ children }) => <h4 className="text-sm font-semibold">{children}</h4>,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
