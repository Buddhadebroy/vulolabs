/* global vulocartLocalizer */

/**
 * Every date VuloCart shows goes through here, so it follows Settings → General: the site's own date format,
 * time format and timezone. `vulocartLocalizer` carries the raw PHP format strings (`date_format`,
 * `time_format`) and the timezone as a minute offset (`gmt_offset_minutes`); this reads PHP's `date()` syntax
 * directly, so weekday names, AM/PM and escaped literals all behave as they do in WordPress.
 *
 * Two kinds of stored value, which differ in whether the timezone shift applies:
 * - database `timestamp` columns (created, updated, started) are UTC, shifted to site time -
 *   `formatWpDate` / `formatWpDateTime`;
 * - `datetime`/`date` columns a person typed (a coupon's expiry, a billing date) are already site time -
 *   `formatWpLocalDate` / `formatWpLocalDateTime`, no shift.
 *
 * vulocart-pro has its own copy of this file (src/components/formatWpDate.ts) - separate bundle, same logic.
 */

const MONTHS = [ 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December' ];
const DAYS = [ 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday' ];

const pad = ( value: number ): string => String( value ).padStart( 2, '0' );

/** `Y-m-d H:i:s`, `Y-m-dTH:i:s`, or a date alone, as a Date whose UTC fields hold exactly those numbers. */
const parseNaive = ( value: string ): Date => {
	const trimmed = value.trim().replace( 'T', ' ' );
	const [ day, time = '00:00:00' ] = trimmed.split( ' ' );
	const [ year, month, date ] = day.split( '-' ).map( Number );
	const [ hours = 0, minutes = 0, seconds = 0 ] = time.split( ':' ).map( ( part ) => parseInt( part, 10 ) || 0 );

	return new Date( Date.UTC( year, ( month || 1 ) - 1, date || 1, hours, minutes, seconds ) );
};

const ordinal = ( day: number ): string => {
	if ( day >= 11 && day <= 13 ) {
		return 'th';
	}

	return { 1: 'st', 2: 'nd', 3: 'rd' }[ day % 10 ] ?? 'th';
};

/** PHP `date()` for the characters WordPress date/time formats use. `date` holds the wall-clock time in its UTC fields. */
const phpDate = ( format: string, date: Date ): string => {
	const hours = date.getUTCHours();
	const hours12 = hours % 12 || 12;
	const dayOfWeek = date.getUTCDay();
	const month = date.getUTCMonth();
	const year = date.getUTCFullYear();
	const isLeap = ( year % 4 === 0 && year % 100 !== 0 ) || year % 400 === 0;
	const daysInMonth = [ 31, isLeap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31 ][ month ];

	const tokens: Record< string, () => string > = {
		d: () => pad( date.getUTCDate() ),
		D: () => DAYS[ dayOfWeek ].slice( 0, 3 ),
		j: () => String( date.getUTCDate() ),
		l: () => DAYS[ dayOfWeek ],
		N: () => String( dayOfWeek || 7 ),
		S: () => ordinal( date.getUTCDate() ),
		w: () => String( dayOfWeek ),
		F: () => MONTHS[ month ],
		m: () => pad( month + 1 ),
		M: () => MONTHS[ month ].slice( 0, 3 ),
		n: () => String( month + 1 ),
		t: () => String( daysInMonth ),
		L: () => ( isLeap ? '1' : '0' ),
		Y: () => String( year ),
		y: () => String( year ).slice( -2 ),
		a: () => ( hours < 12 ? 'am' : 'pm' ),
		A: () => ( hours < 12 ? 'AM' : 'PM' ),
		g: () => String( hours12 ),
		G: () => String( hours ),
		h: () => pad( hours12 ),
		H: () => pad( hours ),
		i: () => pad( date.getUTCMinutes() ),
		s: () => pad( date.getUTCSeconds() ),
	};

	let result = '';

	for ( let index = 0; index < format.length; index++ ) {
		const character = format[ index ];

		if ( '\\' === character && index + 1 < format.length ) {
			result += format[ ++index ];
		} else {
			result += tokens[ character ] ? tokens[ character ]() : character;
		}
	}

	return result;
};

const dateFormat = (): string => vulocartLocalizer.date_format || 'F j, Y';
const timeFormat = (): string => vulocartLocalizer.time_format || 'g:i a';
const offsetMinutes = (): number => vulocartLocalizer.gmt_offset_minutes ?? 0;

const format = ( value: string | null | undefined, phpFormat: string, shiftToSite: boolean ): string => {
	if ( ! value || value.startsWith( '0000' ) ) {
		return '';
	}

	const parsed = parseNaive( value );

	if ( isNaN( parsed.getTime() ) ) {
		return value;
	}

	return phpDate( phpFormat, shiftToSite ? new Date( parsed.getTime() + offsetMinutes() * 60000 ) : parsed );
};

/** A UTC database timestamp as a date, in the site's date format and timezone. */
export const formatWpDate = ( value?: string | null ): string => format( value, dateFormat(), true );

/** A UTC database timestamp as date and time, in the site's formats and timezone. */
export const formatWpDateTime = ( value?: string | null ): string => format( value, `${ dateFormat() } ${ timeFormat() }`, true );

/** A site-local `date`/`datetime` value (typed in, not stamped by the database) as a date. */
export const formatWpLocalDate = ( value?: string | null ): string => format( value, dateFormat(), false );

/** A site-local `datetime` value as date and time. */
export const formatWpLocalDateTime = ( value?: string | null ): string => format( value, `${ dateFormat() } ${ timeFormat() }`, false );
