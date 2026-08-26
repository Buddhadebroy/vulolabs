import React from 'react';
import './ChatMarkdown.scss';

/**
 * Renders a chat message's own bold/code/list Markdown as real elements
 * instead of literal asterisks and backticks — every AI chat surface in
 * this plugin (Copilot.php's/ContentAssistant.php's system prompts both
 * say "Reply in plain text or Markdown, never HTML") gets real Markdown
 * back, but ChatMessage (../components/ChatComposerCard) renders `children`
 * as an opaque node with no parsing of its own, so a plain string shows the
 * raw syntax. Deliberately narrow — bold text, inline code, bullet and
 * numbered lists, paragraphs, and line breaks, the shapes these prompts
 * actually produce — not a full CommonMark implementation (no tables,
 * links, headings, nested lists). Builds real React elements, never
 * dangerouslySetInnerHTML, so there's no HTML-injection surface even
 * though the source is an LLM's own output.
 */
const INLINE_TOKEN_PATTERN = /(\*\*[^*]+\*\*|`[^`]+`)/g;

const renderInline = ( text: string, keyPrefix: string ): React.ReactNode[] =>
	text
		.split( INLINE_TOKEN_PATTERN )
		.filter( ( part ) => '' !== part )
		.map( ( part, index ) => {
			const key = `${ keyPrefix }-${ index }`;

			if ( part.startsWith( '**' ) && part.endsWith( '**' ) && part.length > 3 ) {
				return <strong key={ key }>{ part.slice( 2, -2 ) }</strong>;
			}

			if ( part.startsWith( '`' ) && part.endsWith( '`' ) && part.length > 1 ) {
				return <code key={ key }>{ part.slice( 1, -1 ) }</code>;
			}

			return part;
		} );

const BULLET_LINE = /^[-*]\s+/;
const NUMBERED_LINE = /^\d+\.\s+/;

interface ChatMarkdownProps {
	text: string;
}

export const ChatMarkdown: React.FC< ChatMarkdownProps > = ( { text } ) => {
	const blocks = text.split( /\n{2,}/ );

	return (
		<>
			{ blocks.map( ( block, blockIndex ) => {
				const lines = block
					.split( '\n' )
					.map( ( line ) => line.trim() )
					.filter( ( line ) => '' !== line );

				if ( 0 === lines.length ) {
					return null;
				}

				if ( lines.every( ( line ) => BULLET_LINE.test( line ) ) ) {
					return (
						<ul className="chat-markdown-list" key={ blockIndex }>
							{ lines.map( ( line, lineIndex ) => (
								<li key={ lineIndex }>
									{ renderInline(
										line.replace( BULLET_LINE, '' ),
										`${ blockIndex }-${ lineIndex }`
									) }
								</li>
							) ) }
						</ul>
					);
				}

				if ( lines.every( ( line ) => NUMBERED_LINE.test( line ) ) ) {
					return (
						<ol className="chat-markdown-list" key={ blockIndex }>
							{ lines.map( ( line, lineIndex ) => (
								<li key={ lineIndex }>
									{ renderInline(
										line.replace( NUMBERED_LINE, '' ),
										`${ blockIndex }-${ lineIndex }`
									) }
								</li>
							) ) }
						</ol>
					);
				}

				return (
					<p className="chat-markdown-paragraph" key={ blockIndex }>
						{ lines.map( ( line, lineIndex ) => (
							<React.Fragment key={ lineIndex }>
								{ lineIndex > 0 && <br /> }
								{ renderInline( line, `${ blockIndex }-${ lineIndex }` ) }
							</React.Fragment>
						) ) }
					</p>
				);
			} ) }
		</>
	);
};

export default ChatMarkdown;
