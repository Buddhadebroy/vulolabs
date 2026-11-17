/* global vulocartLocalizer */
import { useEffect, useState } from '@wordpress/element';
import { __, _n, sprintf } from '@wordpress/i18n';
import { CardComponent } from '@zyra/components';
import { ProModuleHint } from './ProModuleHint';

type Details = Record< string, string | boolean >;

interface BookingDetailsProps {
	subtype: string;
	details: Details;
	/** Merges a patch into `type_details`; one call per change, so several keys can be set at once. */
	onChange: ( patch: Details ) => void;
	/** A new product gets sensible defaults written in, so what is shown is what is saved. */
	isNew: boolean;
}

const DURATIONS = [ 15, 30, 45, 60, 90, 120 ];
const NOTICE_HOURS = [ 0, 1, 2, 4, 12, 24, 48 ];
const ADVANCE_DAYS = [ 0, 7, 14, 30, 60, 90, 180, 365 ];
const CANCEL_HOURS = [ 1, 2, 12, 24, 48, 72, 168 ];
const BUFFER_MINUTES = [ 0, 5, 10, 15, 30, 60 ];

const DEFAULTS: Record< string, Details > = {
	appointment: { slot_duration_minutes: '60', min_notice_hours: '2', max_advance_days: '60', cancellation_window_hours: '24' },
	class: { slot_duration_minutes: '60', max_attendees_per_slot: '10', min_notice_hours: '2', max_advance_days: '60', cancellation_window_hours: '24' },
	event: { cancellation_window_hours: '48' },
};

/** "1 hour 30 minutes", "45 minutes". */
export function minutesText( minutes: number ): string {
	const hours = Math.floor( minutes / 60 );
	const rest = minutes % 60;
	const parts: string[] = [];

	if ( hours ) {
		parts.push( sprintf( /* translators: %d: hours. */ _n( '%d hour', '%d hours', hours, 'vulocart' ), hours ) );
	}

	if ( rest || ! hours ) {
		parts.push( sprintf( /* translators: %d: minutes. */ _n( '%d minute', '%d minutes', rest, 'vulocart' ), rest ) );
	}

	return parts.join( ' ' );
}

/** "2 hours", "1 day", "1 week". */
function hoursText( hours: number ): string {
	if ( hours >= 168 && 0 === hours % 168 ) {
		return sprintf( /* translators: %d: weeks. */ _n( '%d week', '%d weeks', hours / 168, 'vulocart' ), hours / 168 );
	}

	if ( hours >= 24 && 0 === hours % 24 ) {
		return sprintf( /* translators: %d: days. */ _n( '%d day', '%d days', hours / 24, 'vulocart' ), hours / 24 );
	}

	return sprintf( /* translators: %d: hours. */ _n( '%d hour', '%d hours', hours, 'vulocart' ), hours );
}

/** "2 weeks", "3 months", "1 year". */
function daysText( days: number ): string {
	if ( 365 === days ) {
		return __( '1 year', 'vulocart' );
	}

	if ( days >= 30 && 0 === days % 30 ) {
		return sprintf( /* translators: %d: months. */ _n( '%d month', '%d months', days / 30, 'vulocart' ), days / 30 );
	}

	if ( days >= 7 && 0 === days % 7 ) {
		return sprintf( /* translators: %d: weeks. */ _n( '%d week', '%d weeks', days / 7, 'vulocart' ), days / 7 );
	}

	return sprintf( /* translators: %d: days. */ _n( '%d day', '%d days', days, 'vulocart' ), days );
}

const num = ( value: string | boolean | undefined ): number => ( 'string' === typeof value && '' !== value.trim() ? Math.max( 0, Number( value ) || 0 ) : 0 );
const isSet = ( value: string | boolean | undefined ): boolean => 'string' === typeof value && '' !== value.trim();

/** A preset list that still shows a value set some other way (an older product, an import). */
function withCurrent( presets: number[], current: number ): number[] {
	return presets.includes( current ) ? presets : [ ...presets, current ].sort( ( a, b ) => a - b );
}

/**
 * The Booking Details card. Instead of a column of number boxes it asks, in order, the questions a merchant can
 * answer without knowing the system: how long a booking is (and how many people fit), how far ahead customers can
 * book, whether you approve bookings, and whether customers can cancel. Rarely needed settings sit behind "More
 * options". A summary at the top reads the answers back as one sentence. It edits the same `type_details` keys the
 * REST controller stores, so saved products and vulocart-pro read them unchanged.
 */
export function BookingDetails( { subtype, details, onChange: onPatch, isNew }: BookingDetailsProps ) {
	const onChange = ( key: string, value: string | boolean ) => onPatch( { [ key ]: value } );
	const isEvent = 'event' === subtype;
	const isClass = 'class' === subtype;
	const hasModule = vulocartLocalizer.active_modules.includes( 'bookings' );

	const [ customLength, setCustomLength ] = useState( () => isSet( details.slot_duration_minutes ) && ! DURATIONS.includes( num( details.slot_duration_minutes ) ) );
	const [ showMore, setShowMore ] = useState( () => num( details.buffer_minutes ) > 0 || isSet( details.assigned_resource ) );

	// Fill in defaults on a new product (and when its kind changes), only for answers not given yet.
	useEffect( () => {
		if ( ! isNew ) {
			return;
		}

		const missing = Object.fromEntries( Object.entries( DEFAULTS[ subtype ] ?? {} ).filter( ( [ key ] ) => undefined === details[ key ] ) );

		if ( Object.keys( missing ).length ) {
			onPatch( missing );
		}
		// Runs when the kind changes, not on every keystroke.
	}, [ subtype, isNew ] );

	const length = num( details.slot_duration_minutes ) || 60;
	const seats = num( details.max_attendees_per_slot );
	const notice = num( details.min_notice_hours );
	const advance = num( details.max_advance_days );
	const tickets = num( details.capacity );
	const canCancel = isSet( details.cancellation_window_hours );
	const cancelHours = num( details.cancellation_window_hours ) || 24;
	const approves = !! details.requires_confirmation;

	const summary = ( () => {
		const parts: string[] = [];

		if ( isEvent ) {
			parts.push(
				details.event_date
					? sprintf( /* translators: %s: date. */ __( 'Customers buy tickets for %s.', 'vulocart' ), new Date( `${ details.event_date }T12:00:00` ).toLocaleDateString( undefined, { dateStyle: 'long' } ) )
					: __( 'Pick the event date below.', 'vulocart' )
			);
			parts.push( tickets ? sprintf( /* translators: %d: tickets. */ _n( 'There is %d ticket.', 'There are %d tickets.', tickets, 'vulocart' ), tickets ) : __( 'Tickets are unlimited.', 'vulocart' ) );
		} else {
			parts.push(
				isClass
					? sprintf( /* translators: 1: length, 2: places. */ __( 'Customers book a %1$s session with up to %2$d people.', 'vulocart' ), minutesText( length ), seats || 1 )
					: sprintf( /* translators: %s: length. */ __( 'Customers book a %s slot, one at a time.', 'vulocart' ), minutesText( length ) )
			);
			parts.push(
				sprintf(
					/* translators: 1: "at least 2 hours ahead" / "right up to the start", 2: "up to 2 months ahead" / "any time in the future". */
					__( 'They can book %1$s and %2$s.', 'vulocart' ),
					notice ? sprintf( /* translators: %s: duration. */ __( 'at least %s ahead', 'vulocart' ), hoursText( notice ) ) : __( 'right up to the start', 'vulocart' ),
					advance ? sprintf( /* translators: %s: duration. */ __( 'up to %s in advance', 'vulocart' ), daysText( advance ) ) : __( 'any time in the future', 'vulocart' )
				)
			);
		}

		parts.push( approves ? __( 'You approve each booking.', 'vulocart' ) : __( 'Bookings are confirmed automatically.', 'vulocart' ) );
		parts.push(
			canCancel
				? sprintf( /* translators: %s: duration. */ __( 'Free cancellation until %s before.', 'vulocart' ), hoursText( cancelHours ) )
				: __( 'Customers cannot cancel online.', 'vulocart' )
		);

		return parts.join( ' ' );
	} )();

	const step = ( number: number, title: string, hint?: string ) => (
		<div className="vulocart-booking-step__head">
			<span className="vulocart-booking-step__number" aria-hidden="true">
				{ number }
			</span>
			<div>
				<h4>{ title }</h4>
				{ hint && <p className="vulocart-field-hint">{ hint }</p> }
			</div>
		</div>
	);

	const counter = { n: 0 };

	return (
		<CardComponent titleIcon="calendar" title={ __( 'Booking Details', 'vulocart' ) } desc={ __( 'Answer a few questions. You can change them any time.', 'vulocart' ) }>
			<div className="vulocart-booking-details">
				<p className="vulocart-booking-summary" aria-live="polite">
					<i className="adminfont-calendar" aria-hidden="true" /> { summary }
				</p>

				{ ! hasModule && (
					<ProModuleHint
						module="bookings"
						title={ __( 'Turn on Bookings to take bookings', 'vulocart' ) }
						description={ __( 'It adds the date and time picker on the product page, your opening hours, and staff or rooms.', 'vulocart' ) }
					/>
				) }

				{ isEvent ? (
					<>
						<section className="vulocart-booking-step">
							{ step( ++counter.n, __( 'When and where is it?', 'vulocart' ) ) }
							<div className="vulocart-booking-row">
								<label className="vulocart-booking-field">
									<span>{ __( 'Date', 'vulocart' ) }</span>
									<input type="date" value={ ( details.event_date as string ) ?? '' } onChange={ ( event ) => onChange( 'event_date', event.target.value ) } />
								</label>
								<label className="vulocart-booking-field is-wide">
									<span>{ __( 'Venue or online link', 'vulocart' ) }</span>
									<input type="text" value={ ( details.venue as string ) ?? '' } placeholder={ __( 'e.g. Town Hall, 12 Main St', 'vulocart' ) } onChange={ ( event ) => onChange( 'venue', event.target.value ) } />
								</label>
							</div>
						</section>

						<section className="vulocart-booking-step">
							{ step( ++counter.n, __( 'How many tickets are there?', 'vulocart' ) ) }
							<div className="vulocart-booking-choices" role="radiogroup">
								<label className={ `vulocart-booking-choice${ ! tickets ? ' is-selected' : '' }` }>
									<input type="radio" checked={ ! tickets } onChange={ () => onChange( 'capacity', '' ) } />
									{ __( 'Unlimited', 'vulocart' ) }
								</label>
								<label className={ `vulocart-booking-choice${ tickets ? ' is-selected' : '' }` }>
									<input type="radio" checked={ !! tickets } onChange={ () => onChange( 'capacity', '100' ) } />
									{ __( 'A set number', 'vulocart' ) }
								</label>
								{ !! tickets && (
									<input
										className="vulocart-booking-number"
										type="number"
										min={ 1 }
										aria-label={ __( 'Tickets', 'vulocart' ) }
										value={ tickets }
										onChange={ ( event ) => onChange( 'capacity', String( Math.max( 1, Number( event.target.value ) || 1 ) ) ) }
									/>
								) }
							</div>
						</section>
					</>
				) : (
					<>
						<section className="vulocart-booking-step">
							{ step( ++counter.n, __( 'How long is each booking?', 'vulocart' ), hasModule ? __( 'Your opening hours are split into slots of this length.', 'vulocart' ) : undefined ) }
							<div className="vulocart-booking-choices" role="radiogroup" aria-label={ __( 'Length', 'vulocart' ) }>
								{ DURATIONS.map( ( minutes ) => (
									<label key={ minutes } className={ `vulocart-booking-choice${ ! customLength && length === minutes ? ' is-selected' : '' }` }>
										<input
											type="radio"
											checked={ ! customLength && length === minutes }
											onChange={ () => {
												setCustomLength( false );
												onChange( 'slot_duration_minutes', String( minutes ) );
											} }
										/>
										{ minutesText( minutes ) }
									</label>
								) ) }
								<label className={ `vulocart-booking-choice${ customLength ? ' is-selected' : '' }` }>
									<input type="radio" checked={ customLength } onChange={ () => setCustomLength( true ) } />
									{ __( 'Other', 'vulocart' ) }
								</label>
								{ customLength && (
									<span className="vulocart-booking-inline">
										<input
											className="vulocart-booking-number"
											type="number"
											min={ 5 }
											step={ 5 }
											aria-label={ __( 'Minutes', 'vulocart' ) }
											value={ num( details.slot_duration_minutes ) || '' }
											onChange={ ( event ) => onChange( 'slot_duration_minutes', event.target.value ) }
										/>
										{ __( 'minutes', 'vulocart' ) }
									</span>
								) }
							</div>
						</section>

						{ isClass && (
							<section className="vulocart-booking-step">
								{ step( ++counter.n, __( 'How many people can join each session?', 'vulocart' ) ) }
								<span className="vulocart-booking-inline">
									<input
										className="vulocart-booking-number"
										type="number"
										min={ 1 }
										aria-label={ __( 'People per session', 'vulocart' ) }
										value={ seats || '' }
										onChange={ ( event ) => onChange( 'max_attendees_per_slot', String( Math.max( 1, Number( event.target.value ) || 1 ) ) ) }
									/>
									{ __( 'people', 'vulocart' ) }
								</span>
							</section>
						) }

						<section className="vulocart-booking-step">
							{ step( ++counter.n, __( 'How far ahead can customers book?', 'vulocart' ) ) }
							<div className="vulocart-booking-sentence">
								<label>
									{ __( 'At least', 'vulocart' ) }
									<select value={ notice } onChange={ ( event ) => onChange( 'min_notice_hours', '0' === event.target.value ? '' : event.target.value ) }>
										{ withCurrent( NOTICE_HOURS, notice ).map( ( hours ) => (
											<option key={ hours } value={ hours }>
												{ hours ? hoursText( hours ) : __( 'no notice', 'vulocart' ) }
											</option>
										) ) }
									</select>
									{ __( 'before it starts', 'vulocart' ) }
								</label>
								<label>
									{ __( 'and up to', 'vulocart' ) }
									<select value={ advance } onChange={ ( event ) => onChange( 'max_advance_days', '0' === event.target.value ? '' : event.target.value ) }>
										{ withCurrent( ADVANCE_DAYS, advance ).map( ( days ) => (
											<option key={ days } value={ days }>
												{ days ? daysText( days ) : __( 'any time', 'vulocart' ) }
											</option>
										) ) }
									</select>
									{ __( 'in advance', 'vulocart' ) }
								</label>
							</div>
						</section>
					</>
				) }

				<section className="vulocart-booking-step">
					{ step( ++counter.n, __( 'Do you want to approve each booking?', 'vulocart' ) ) }
					<div className="vulocart-booking-cards" role="radiogroup">
						<label className={ `vulocart-booking-card${ ! approves ? ' is-selected' : '' }` }>
							<input type="radio" checked={ ! approves } onChange={ () => onChange( 'requires_confirmation', false ) } />
							<strong>{ __( 'No, confirm automatically', 'vulocart' ) }</strong>
							<span>{ __( 'The booking is confirmed as soon as it is paid.', 'vulocart' ) }</span>
						</label>
						<label className={ `vulocart-booking-card${ approves ? ' is-selected' : '' }` }>
							<input type="radio" checked={ approves } onChange={ () => onChange( 'requires_confirmation', true ) } />
							<strong>{ __( 'Yes, I approve them', 'vulocart' ) }</strong>
							<span>{ __( 'Paid bookings wait in Orders → Bookings until you confirm them.', 'vulocart' ) }</span>
						</label>
					</div>
				</section>

				<section className="vulocart-booking-step">
					{ step( ++counter.n, __( 'Can customers cancel?', 'vulocart' ) ) }
					<div className="vulocart-booking-cards" role="radiogroup">
						<label className={ `vulocart-booking-card${ canCancel ? ' is-selected' : '' }` }>
							<input type="radio" checked={ canCancel } onChange={ () => onChange( 'cancellation_window_hours', String( cancelHours ) ) } />
							<strong>{ __( 'Yes, with a refund', 'vulocart' ) }</strong>
							<span>
								{ __( 'Until', 'vulocart' ) }{ ' ' }
								<select
									value={ cancelHours }
									disabled={ ! canCancel }
									aria-label={ __( 'Cancellation deadline', 'vulocart' ) }
									onChange={ ( event ) => onChange( 'cancellation_window_hours', event.target.value ) }
								>
									{ withCurrent( CANCEL_HOURS, cancelHours ).map( ( hours ) => (
										<option key={ hours } value={ hours }>
											{ hoursText( hours ) }
										</option>
									) ) }
								</select>{ ' ' }
								{ __( 'before the start, from the link in their confirmation email.', 'vulocart' ) }
							</span>
						</label>
						<label className={ `vulocart-booking-card${ ! canCancel ? ' is-selected' : '' }` }>
							<input type="radio" checked={ ! canCancel } onChange={ () => onChange( 'cancellation_window_hours', '' ) } />
							<strong>{ __( 'No', 'vulocart' ) }</strong>
							<span>{ __( 'Customers contact you to change or cancel.', 'vulocart' ) }</span>
						</label>
					</div>
				</section>

				{ ! isEvent && (
					<div className="vulocart-booking-more">
						<button type="button" className="vulocart-booking-more__toggle" aria-expanded={ showMore } onClick={ () => setShowMore( ! showMore ) }>
							<i className={ showMore ? 'adminfont-keyboard-arrow-down' : 'adminfont-arrow-right' } aria-hidden="true" />
							{ __( 'More options', 'vulocart' ) }
						</button>
						{ showMore && (
							<div className="vulocart-booking-more__body">
								<label className="vulocart-booking-field">
									<span>{ __( 'Break between bookings', 'vulocart' ) }</span>
									<select value={ num( details.buffer_minutes ) } onChange={ ( event ) => onChange( 'buffer_minutes', '0' === event.target.value ? '' : event.target.value ) }>
										{ withCurrent( BUFFER_MINUTES, num( details.buffer_minutes ) ).map( ( minutes ) => (
											<option key={ minutes } value={ minutes }>
												{ minutes ? minutesText( minutes ) : __( 'No break', 'vulocart' ) }
											</option>
										) ) }
									</select>
									<small className="vulocart-field-hint">{ __( 'Time kept free before and after each booking, for cleaning up or travelling.', 'vulocart' ) }</small>
								</label>
								<label className="vulocart-booking-field">
									<span>{ __( 'Who or where (shown to customers)', 'vulocart' ) }</span>
									<input
										type="text"
										value={ ( details.assigned_resource as string ) ?? '' }
										placeholder={ __( 'e.g. Dr. Patel, or Studio 2', 'vulocart' ) }
										onChange={ ( event ) => onChange( 'assigned_resource', event.target.value ) }
									/>
									<small className="vulocart-field-hint">
										{ hasModule
											? __( 'Just a label. To let customers pick a person or room, or to stop them being double-booked, use Staff and resources in the Availability card.', 'vulocart' )
											: __( 'Just a label, shown with the booking.', 'vulocart' ) }
									</small>
								</label>
							</div>
						) }
					</div>
				) }
			</div>
		</CardComponent>
	);
}
