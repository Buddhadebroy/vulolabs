/**
 * Real runtime code reads this off `window.appLocalizer` (wp_localize_script
 * output). Test-only stand-in with just the fields @multivendorx/zyra's
 * getApiLink()/getApiResponse()/sendApiResponse() actually read, plus
 * `active_modules` since Content.tsx gates its Pro filter slots on it.
 */
global.appLocalizer = {
	nonce: 'test-nonce',
	apiUrl: 'https://example.test/wp-json',
	restUrl: 'vulopilot/v1',
	active_modules: [ 'content-intelligence' ],
};
