/**
 * Grafts collapsible group headers onto the native #toplevel_page_vulopilot admin
 * menu. Only shows/hides and inserts headers before the <li> elements WordPress
 * already rendered - never re-parents them, so src/app.tsx's `current`-class selector
 * keeps matching. Config comes from window.vulopilotMenuGroups (localized by
 * Admin::enqueue_menu_grouping_assets()): { groups, tabToGroup, tabToIcon, dividerBefore }.
 */
( function () {
	'use strict';

	/**
	 * Pulls the `tab` value out of an `admin.php?page=vulopilot#&tab=xxx` href - the one
	 * thing that reliably identifies a submenu link regardless of its translated label.
	 *
	 * @param {string} href Anchor href.
	 * @return {string|null} The tab id, or null if this isn't a tab link.
	 */
	function getTabFromHref( href ) {
		var match = ( href || '' ).match( /[#&]tab=([^&]+)/ );
		return match ? decodeURIComponent( match[ 1 ] ) : null;
	}

	function getActiveTab() {
		return getTabFromHref( window.location.hash ) || 'dashboard';
	}

	// groupId -> { members: HTMLLIElement[], toggle: HTMLAnchorElement, expanded: boolean }
	var groupState = {};

	function setExpanded( groupId, expanded ) {
		var state = groupState[ groupId ];

		if ( ! state ) {
			return;
		}

		state.expanded = expanded;
		state.toggle.setAttribute( 'aria-expanded', String( expanded ) );

		state.members.forEach( function ( li ) {
			li.classList.toggle( 'vulopilot-menu-group-collapsed', ! expanded );
		} );
	}

	function buildGroups() {
		var config = window.vulopilotMenuGroups;
		var submenu = document.querySelector(
			'#toplevel_page_vulopilot > ul.wp-submenu'
		);

		if ( ! config || ! submenu || submenu.dataset.vulopilotGrouped ) {
			return;
		}

		submenu.dataset.vulopilotGrouped = 'true';

		var activeTab = getActiveTab();
		var items = Array.prototype.slice.call( submenu.children );

		config.groups.forEach( function ( group ) {
			var members = items.filter( function ( li ) {
				var anchor = li.querySelector( 'a' );
				var tab = anchor && getTabFromHref( anchor.getAttribute( 'href' ) );
				return tab && config.tabToGroup[ tab ] === group.id;
			} );

			if ( ! members.length ) {
				return;
			}

			var expanded = members.some( function ( li ) {
				var anchor = li.querySelector( 'a' );
				return getTabFromHref( anchor.getAttribute( 'href' ) ) === activeTab;
			} );

			var header = document.createElement( 'li' );
			header.className = 'vulopilot-menu-group';

			var toggle = document.createElement( 'a' );
			toggle.href = '#';
			toggle.className = 'vulopilot-menu-group-toggle';
			toggle.setAttribute( 'aria-expanded', String( expanded ) );
			toggle.innerHTML =
				'<span class="dashicons ' +
				group.icon +
				'" aria-hidden="true"></span>' +
				'<span class="vulopilot-menu-group-label">' +
				group.label +
				'</span>' +
				'<span class="dashicons dashicons-arrow-down-alt2 vulopilot-menu-group-chevron" aria-hidden="true"></span>';

			toggle.addEventListener( 'click', function ( event ) {
				event.preventDefault();
				event.stopPropagation();
				setExpanded( group.id, ! groupState[ group.id ].expanded );
			} );

			header.appendChild( toggle );
			members[ 0 ].parentNode.insertBefore( header, members[ 0 ] );

			members.forEach( function ( li ) {
				li.classList.add( 'vulopilot-menu-group-child' );
				li.classList.toggle( 'vulopilot-menu-group-collapsed', ! expanded );
			} );

			groupState[ group.id ] = {
				members: members,
				toggle: toggle,
				expanded: expanded,
			};
		} );
	}

	/**
	 * Prepends a dashicon to every submenu <a> with an entry in tabToIcon, covering standalone and
	 * grouped items. Guarded per anchor, since it runs after buildGroups() inserted the synthetic
	 * group-header <li>s (no tab id, skipped naturally).
	 */
	function addItemIcons() {
		var config = window.vulopilotMenuGroups;
		var submenu = document.querySelector(
			'#toplevel_page_vulopilot > ul.wp-submenu'
		);

		if ( ! config || ! config.tabToIcon || ! submenu ) {
			return;
		}

		submenu.querySelectorAll( 'li > a' ).forEach( function ( anchor ) {
			if ( anchor.querySelector( '.vulopilot-menu-item-icon' ) ) {
				return;
			}

			var tab = getTabFromHref( anchor.getAttribute( 'href' ) );
			var icon = tab && config.tabToIcon[ tab ];

			if ( ! icon ) {
				return;
			}

			var iconSpan = document.createElement( 'span' );
			iconSpan.className = 'dashicons ' + icon + ' vulopilot-menu-item-icon';
			iconSpan.setAttribute( 'aria-hidden', 'true' );
			anchor.insertBefore( iconSpan, anchor.firstChild );
		} );
	}

	/**
	 * Draws a thin rule before each `<li>` in dividerBefore (e.g. separating "Reports"/"Settings"/
	 * "Modules" from the work items). Runs once at init: the list is static config, unlike group
	 * expansion, so no hashchange handling is needed.
	 */
	function addDividers() {
		var config = window.vulopilotMenuGroups;
		var submenu = document.querySelector(
			'#toplevel_page_vulopilot > ul.wp-submenu'
		);

		if ( ! config || ! config.dividerBefore || ! submenu ) {
			return;
		}

		config.dividerBefore.forEach( function ( tab ) {
			var anchors = submenu.querySelectorAll( 'li > a' );

			for ( var i = 0; i < anchors.length; i++ ) {
				if ( getTabFromHref( anchors[ i ].getAttribute( 'href' ) ) === tab ) {
					anchors[ i ].parentNode.classList.add( 'vulopilot-menu-divider-before' );
					break;
				}
			}
		} );
	}

	/**
	 * Re-expands the group containing the newly active tab. The hash, not the 'current' class (which
	 * lags React mounting), is the source of truth, so this works on every hash change without a race.
	 */
	function syncActiveGroup() {
		var config = window.vulopilotMenuGroups;

		if ( ! config ) {
			return;
		}

		var activeGroupId = config.tabToGroup[ getActiveTab() ];

		if ( activeGroupId && groupState[ activeGroupId ] && ! groupState[ activeGroupId ].expanded ) {
			setExpanded( activeGroupId, true );
		}
	}

	function init() {
		buildGroups();
		addItemIcons();
		addDividers();
		syncActiveGroup();
		window.addEventListener( 'hashchange', syncActiveGroup );
	}

	if ( document.readyState === 'loading' ) {
		document.addEventListener( 'DOMContentLoaded', init );
	} else {
		init();
	}
} )();
