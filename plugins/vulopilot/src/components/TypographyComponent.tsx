import type { ElementType, ReactNode } from 'react';

interface TypographyComponentProps {
	/** Which real HTML tag to render as — defaults to 'div'. */
	as?: ElementType;
	/** Maps to a real `.typography-{variant}` CSS class — SeoVisibility.scss's own `.typography-h3`/`.typography-caption` rules already style these; add more variant rules there as new ones are used. */
	variant?: string;
	className?: string;
	children?: ReactNode;
	/** Forwarded to the real rendered tag as-is — e.g. BrokenLinksSection.tsx's own `onClick={toggleRowExpansion}` on an `as="span"` real click target. */
	[extraProp: string]: unknown;
}

/**
 * Local stand-in for `TypographyComponent` — imported from `@zyra/components`
 * across this codebase (SeoTab.tsx, BrokenLinksSection.tsx, KeywordsTab.tsx)
 * as if it were a real zyra export, but it isn't: confirmed live, the
 * installed `@multivendorx/zyra` package has no such export at all (not a
 * version-skew issue — it doesn't exist in the zyra source repo either),
 * so every one of those real `<TypographyComponent as="..." variant="...">`
 * call sites was rendering `<undefined>` and crashing its whole page with a
 * white screen — confirmed live via a real browser render (React's own
 * "Element type is invalid... got: undefined" error), not a hypothetical.
 *
 * This is a plain, honest polyfill — `as` picks the real tag, `variant`
 * maps onto the exact `typography-{variant}` CSS class convention
 * SeoVisibility.scss's own `.typography-h3`/`.typography-caption` rules
 * already assumed a real component would apply, so no call site or
 * stylesheet needed to change, only the missing import.
 */
const TypographyComponent = ({
	as: Tag = 'div',
	variant,
	className,
	children,
	...rest
}: TypographyComponentProps) => {
	const classes = [variant ? `typography-${variant}` : '', className]
		.filter(Boolean)
		.join(' ');

	return (
		<Tag className={classes || undefined} {...rest}>
			{children}
		</Tag>
	);
};

export default TypographyComponent;
