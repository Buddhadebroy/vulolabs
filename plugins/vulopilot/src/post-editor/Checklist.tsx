import { __ } from '@wordpress/i18n';
import { Button, Spinner } from '@wordpress/components';
import { useEffect, useRef, useState } from '@wordpress/element';
import { fixWithAi, AnalysisResult } from './api';

interface ChecklistProps {
	title: string;
	results: AnalysisResult[];
	postId: number;
	isPro: boolean;
	shopUrl: string;
	// eslint-disable-next-line no-unused-vars
	onFixed: ( _actionId: string, _response: Awaited< ReturnType< typeof fixWithAi > > ) => void;
	/** "All SEO Issues" table's "Fix with AI" deep link — an AnalysisResult['id'] to scroll to and pulse-highlight once it appears in `results`. Every Checklist instance on the General tab gets this same prop; only the one whose `results` actually contains a matching id does anything with it. */
	highlightId?: string;
}

const STATUS_ICON: Record< AnalysisResult[ 'status' ], string > = {
	pass: 'yes-alt',
	warning: 'warning',
	fail: 'dismiss',
};

/**
 * Worst-to-best across a group's own results — same 3-state severity order
 * every other status rollup in this codebase uses (fail beats warning
 * beats pass). Drives the group header's own summary pill, mirroring
 * RankMath's own "All Good"/otherwise pill next to each collapsible
 * section header.
 */
const GROUP_STATUS: Record< 'good' | 'ok' | 'bad', { label: string; className: string; icon: string } > = {
	good: { label: __( 'All Good', 'vulopilot' ), className: 'good', icon: 'yes-alt' },
	ok: { label: __( 'Could Be Better', 'vulopilot' ), className: 'ok', icon: 'warning' },
	bad: { label: __( 'Needs Improvement', 'vulopilot' ), className: 'bad', icon: 'dismiss' },
};

const summarizeGroup = ( results: AnalysisResult[] ): keyof typeof GROUP_STATUS => {
	if ( results.some( ( result ) => 'fail' === result.status ) ) {
		return 'bad';
	}

	if ( results.some( ( result ) => 'warning' === result.status ) ) {
		return 'ok';
	}

	return 'good';
};

/**
 * Renders one of Services\OnPageAnalyzer::analyze()'s check groups
 * ('basic'/'additional'/'title_readability' — mirrors RankMath's own
 * "Basic SEO"/"Additional"/"Title Readability" grouping) as a collapsible
 * section with a status-summary pill in its header — RankMath's own
 * "Basic SEO ✓ All Good ⌄" shape, per direct screenshot comparison. Starts
 * expanded (matches that same screenshot's default state); collapsing is
 * purely a local UI convenience, every check is still computed either way.
 * Every row that's `fixable` gets a "Fix with AI" button wired to
 * vulopilot-pro's `POST /post-seo/{id}/fix` (Pro-only — free users see an
 * upgrade prompt instead, same posture the SEO tab's FindingsTable "Fix"
 * row action already takes for Free installs).
 */
export default function Checklist( { title, results, postId, isPro, shopUrl, onFixed, highlightId }: ChecklistProps ) {
	const [ fixingId, setFixingId ] = useState< string | null >( null );
	const [ error, setError ] = useState< string | null >( null );
	const [ pulsingId, setPulsingId ] = useState< string | null >( null );
	const [ isOpen, setIsOpen ] = useState( true );
	const hasScrolledRef = useRef( false );

	/**
	 * Scrolls to and pulse-highlights the deep-linked row exactly once, the
	 * first time it actually appears in `results` (the checklist starts
	 * empty and fills in after the debounced live analysis call —
	 * see GeneralTab.tsx — so this can't just run on mount). Also forces
	 * this group open, since a collapsed section would otherwise hide the
	 * very row being linked to. Mirrors zyra's own ModuleGridComponent.tsx
	 * "URL target → scrollIntoView → timed highlight class" idiom; not
	 * imported directly since this bundle only loads `wp-*` script deps, no
	 * zyra CSS (PostEditorAssets.php).
	 */
	useEffect( () => {
		if ( ! highlightId || hasScrolledRef.current ) {
			return;
		}

		const match = results.find( ( result ) => result.id === highlightId );

		if ( ! match ) {
			return;
		}

		hasScrolledRef.current = true;
		setIsOpen( true );
		const element = document.getElementById( `vulopilot-seo-check-${ highlightId }` );
		element?.scrollIntoView( { behavior: 'smooth', block: 'center' } );
		setPulsingId( highlightId );

		const timeout = setTimeout( () => setPulsingId( null ), 4000 );
		return () => clearTimeout( timeout );
	}, [ highlightId, results ] );

	if ( 0 === results.length ) {
		return null;
	}

	const handleFix = async ( actionId: string ) => {
		setFixingId( actionId );
		setError( null );

		try {
			const response = await fixWithAi( postId, actionId );
			onFixed( actionId, response );
		} catch ( err ) {
			setError( err instanceof Error ? err.message : String( err ) );
		} finally {
			setFixingId( null );
		}
	};

	const summary = GROUP_STATUS[ summarizeGroup( results ) ];

	return (
		<div className="vulopilot-seo-checklist">
			<button
				type="button"
				className="vulopilot-seo-checklist__header"
				aria-expanded={ isOpen }
				onClick={ () => setIsOpen( ( open ) => ! open ) }
			>
				<span className="title vulopilot-seo-checklist__title">{ title }</span>
				<span className={ `vulopilot-seo-checklist__summary vulopilot-seo-checklist__summary--${ summary.className }` }>
					<i className={ `dashicons dashicons-${ summary.icon }` } />
					{ summary.label }
				</span>
				<i className={ `dashicons dashicons-arrow-${ isOpen ? 'up' : 'down' }-alt2 vulopilot-seo-checklist__chevron` } />
			</button>

			{ isOpen && (
				<>
					{ error && <div className="desc vulopilot-seo-checklist__error">{ error }</div> }
					<ul className="vulopilot-seo-checklist__list">
						{ results.map( ( result ) => (
							<li
								key={ result.id }
								id={ `vulopilot-seo-check-${ result.id }` }
								className={ `vulopilot-seo-checklist__item vulopilot-seo-checklist__item--${ result.status }${ pulsingId === result.id ? ' vulopilot-seo-highlight-pulse' : '' }` }
							>
								<i className={ `dashicons dashicons-${ STATUS_ICON[ result.status ] } vulopilot-seo-checklist__icon` } />
								<span className="vulopilot-seo-checklist__message">{ result.message }</span>
								{ result.fixable && result.action_id && 'pass' !== result.status && (
									isPro ? (
										<Button
											variant="secondary"
											size="small"
											isBusy={ fixingId === result.action_id }
											disabled={ null !== fixingId }
											onClick={ () => handleFix( result.action_id as string ) }
										>
											{ fixingId === result.action_id ? <Spinner /> : __( 'Fix with AI', 'vulopilot' ) }
										</Button>
									) : (
										<Button variant="tertiary" size="small" href={ shopUrl } target="_blank" rel="noreferrer">
											{ __( 'Upgrade to fix', 'vulopilot' ) }
										</Button>
									)
								) }
							</li>
						) ) }
					</ul>
				</>
			) }
		</div>
	);
}
