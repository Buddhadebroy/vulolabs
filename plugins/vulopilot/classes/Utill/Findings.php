<?php
namespace VuloPilot\Utill;

defined( 'ABSPATH' ) || exit;

/**
 * GET /findings backs the shared FindingsTable component (Health/SEO/GEO/
 * Commerce/Dashboard pages - src/components/FindingsTable.tsx).
 *
 * @class       Findings controller
 * @version     1.0.0
 * @author      VuloLabs
 */
class Findings extends \WP_REST_Controller {

	/**
	 * @var string
	 */
	protected $rest_base = 'findings';

	/**
	 * Maps the `priority` param of `GET /findings/groups` to severity ranks (critical
	 * folds into high, info into low).
	 *
	 * @var array<string, int[]>
	 */
	private const PRIORITY_SEVERITY_RANKS = array(
		'high'   => array( 0, 1 ),
		'medium' => array( 2 ),
		'low'    => array( 3, 4 ),
	);

	/**
	 * Maps the `priority` param of `GET /findings` to a `severity` IN(...) filter, using
	 * the same three-tier collapse.
	 *
	 * @var array<string, string[]>
	 */
	private const PRIORITY_SEVERITY_LABELS = array(
		'high'   => array( 'critical', 'high' ),
		'medium' => array( 'medium' ),
		'low'    => array( 'low', 'info' ),
	);

	/**
	 * @inheritDoc
	 */
	public function register_routes() {
		register_rest_route(
			VuloPilot()->rest_namespace,
			'/' . $this->rest_base,
			array(
				array(
					'methods'             => \WP_REST_Server::READABLE,
					'callback'            => array( $this, 'get_items' ),
					'permission_callback' => array( $this, 'get_items_permissions_check' ),
				),
			)
		);

		register_rest_route(
			VuloPilot()->rest_namespace,
			'/' . $this->rest_base . '/(?P<id>\d+)',
			array(
				array(
					'methods'             => \WP_REST_Server::EDITABLE,
					'callback'            => array( $this, 'update_item' ),
					'permission_callback' => array( $this, 'update_item_permissions_check' ),
				),
			)
		);

		register_rest_route(
			VuloPilot()->rest_namespace,
			'/' . $this->rest_base . '/bulk',
			array(
				array(
					'methods'             => \WP_REST_Server::EDITABLE,
					'callback'            => array( $this, 'bulk_update_items' ),
					'permission_callback' => array( $this, 'update_item_permissions_check' ),
				),
			)
		);

		// AI Copilot's "Needs your attention" card (NeedsAttentionCard.tsx).
		register_rest_route(
			VuloPilot()->rest_namespace,
			'/' . $this->rest_base . '/attention-summary',
			array(
				array(
					'methods'             => \WP_REST_Server::READABLE,
					'callback'            => array( $this, 'get_attention_summary' ),
					'permission_callback' => array( $this, 'get_items_permissions_check' ),
				),
			)
		);

		// AI Copilot's Issues table (IssuesList.tsx) - every open finding grouped by issue type
		// (scanner_id), paginated.
		register_rest_route(
			VuloPilot()->rest_namespace,
			'/' . $this->rest_base . '/groups',
			array(
				array(
					'methods'             => \WP_REST_Server::READABLE,
					'callback'            => array( $this, 'get_finding_groups' ),
					'permission_callback' => array( $this, 'get_items_permissions_check' ),
				),
			)
		);

		register_rest_route(
			VuloPilot()->rest_namespace,
			'/' . $this->rest_base . '/(?P<id>\d+)/actions/(?P<action_id>[a-z0-9-]+)',
			array(
				array(
					'methods'             => \WP_REST_Server::CREATABLE,
					'callback'            => array( $this, 'run_manual_action' ),
					'permission_callback' => array( $this, 'update_item_permissions_check' ),
				),
			)
		);
	}

	/**
	 * @inheritDoc
	 */
	public function get_items_permissions_check( $request ) {
		return current_user_can( 'manage_options' );
	}

	/**
	 * @inheritDoc
	 */
	public function update_item_permissions_check( $request ) {
		return current_user_can( 'manage_options' );
	}

	/**
	 * @inheritDoc
	 */
	public function get_items( $request ) {
		$repository = new FindingRepository();

		$category    = sanitize_key( (string) $request->get_param( 'category' ) );
		$severity    = sanitize_key( (string) $request->get_param( 'severity' ) );
		$status      = sanitize_key( (string) $request->get_param( 'status' ) );
		$search      = sanitize_text_field( (string) $request->get_param( 'search' ) );
		$scanner_ids = $this->parse_comma_separated_list( $request->get_param( 'scanner_id' ) );
		$priority    = sanitize_key( (string) $request->get_param( 'priority' ) );
		$object_type = sanitize_key( (string) $request->get_param( 'object_type' ) );

		if ( '' !== $severity && ! Severity::is_valid( $severity ) ) {
			return new \WP_Error( 'vulopilot_invalid_severity', __( 'Invalid severity filter.', 'vulopilot' ), array( 'status' => 400 ) );
		}

		// `priority` is a display-only relabeling of the same severity values.
		$severity_filter = $severity;
		if ( '' === $severity_filter && '' !== $priority && isset( self::PRIORITY_SEVERITY_LABELS[ $priority ] ) ) {
			$severity_filter = self::PRIORITY_SEVERITY_LABELS[ $priority ];
		}

		$result                  = $repository->find_all(
			array(
				'page'        => absint( $request->get_param( 'page' ) ) ? absint( $request->get_param( 'page' ) ) : 1,
				'per_page'    => absint( $request->get_param( 'per_page' ) ) ? absint( $request->get_param( 'per_page' ) ) : 20,
				'category'    => $category,
				'severity'    => $severity_filter,
				'status'      => $status,
				'search'      => $search,
				'scanner_id'  => $scanner_ids ?? '',
				'object_type' => $object_type,
				'orderby'     => sanitize_key( (string) $request->get_param( 'orderby' ) ),
				'order'       => sanitize_key( (string) $request->get_param( 'order' ) ),
			)
		);
		$result['status_counts'] = $repository->get_status_counts( '' !== $category ? $category : null, $scanner_ids );
		$result['data']          = array_map( array( $this, 'add_page_field' ), $result['data'] );

		// Real Critical/Important/Minor pill counts, scoped to this request's own scanner_id set.
		if ( $scanner_ids ) {
			$breakdown                 = $repository->get_severity_breakdown_for_scanner_ids( $scanner_ids );
			$result['priority_counts'] = array(
				'high'   => ( $breakdown['critical'] ?? 0 ) + ( $breakdown['high'] ?? 0 ),
				'medium' => $breakdown['medium'] ?? 0,
				'low'    => $breakdown['low'] ?? 0,
			);
		}

		return rest_ensure_response(
			apply_filters( 'vulopilot_finding_list_response', $result )
		);
	}

	/**
	 * Bucket id => the real `category` values it draws its top finding-type group from.
	 *
	 * @var array<string, string[]>
	 */
	private const RECOMMENDATION_BUCKETS = array(
		'security'      => array( 'security', 'ssl', 'rest-api' ),
		'performance'   => array( 'performance' ),
		'ai-visibility' => array( 'geo', 'brand' ),
	);

	/**
	 * GET /findings/attention-summary - open-findings counts bucketed into 3 priority
	 * tiers, sitewide by default or scoped to one category via `?category=`.
	 *
	 * @param \WP_REST_Request $request Full details about the request.
	 * @return \WP_REST_Response
	 */
	public function get_attention_summary( $request ) {
		$category        = sanitize_key( (string) $request->get_param( 'category' ) );
		$repository      = new FindingRepository();
		$priority_counts = $repository->get_priority_counts( '' !== $category ? $category : null );
		$groups          = $repository->get_top_finding_groups( 3, '' !== $category ? array( $category ) : array() );

		$label_scanner = static function ( array $group ): array {
			$scanner        = VuloPilot()->scanner_registry->get_scanner( $group['scanner_id'] );
			$group['label'] = $scanner ? $scanner->get_label() : $group['scanner_id'];

			return $group;
		};

		$groups = array_map( $label_scanner, $groups );

		$recommendations = array();

		foreach ( self::RECOMMENDATION_BUCKETS as $bucket => $categories ) {
			$group = $repository->get_top_finding_group_for_categories( $categories );

			if ( null === $group ) {
				continue;
			}

			$recommendations[] = array_merge( array( 'bucket' => $bucket ), $label_scanner( $group ) );
		}

		return rest_ensure_response(
			array(
				'total'           => array_sum( $priority_counts ),
				'priority_counts' => $priority_counts,
				'groups'          => $groups,
				'recommendations' => $recommendations,
			)
		);
	}

	/**
	 * GET /findings/groups - AI Copilot's Issues table (IssuesList.tsx): every open
	 * finding grouped by issue type.
	 *
	 * @param \WP_REST_Request $request Full details about the request.
	 * @return \WP_REST_Response
	 */
	public function get_finding_groups( $request ) {
		$repository  = new FindingRepository();
		$categories  = $this->parse_comma_separated_list( $request->get_param( 'category' ) );
		$scanner_ids = $this->parse_comma_separated_list( $request->get_param( 'scanner_id' ) );
		$priority    = sanitize_key( (string) $request->get_param( 'priority' ) );

		// Group-level status filter: 'open' (default) or 'all'.
		$requested_status = sanitize_key( (string) $request->get_param( 'status' ) );
		$status           = in_array( $requested_status, array( 'open', 'all' ), true ) ? $requested_status : 'open';

		$page     = absint( $request->get_param( 'page' ) );
		$per_page = absint( $request->get_param( 'per_page' ) );

		$result = $repository->get_finding_groups(
			array(
				'status'         => $status,
				'category'       => $categories ?? '',
				'scanner_ids'    => $scanner_ids ?? array(),
				'priority_ranks' => self::PRIORITY_SEVERITY_RANKS[ $priority ] ?? array(),
				'page'           => $page > 0 ? $page : 1,
				'per_page'       => $per_page > 0 ? $per_page : 20,
			)
		);

		$result['data'] = array_map(
			function ( array $group ) use ( $repository ): array {
				$scanner        = VuloPilot()->scanner_registry->get_scanner( $group['scanner_id'] );
				$group['label'] = $scanner ? $scanner->get_label() : $group['scanner_id'];

				$sample = $repository->find_all(
					array(
						'scanner_id'  => $group['scanner_id'],
						// One scanner_id can report several unrelated object_types.
						'object_type' => $group['object_type'] ?? '',
						'status'      => 'open',
						'per_page'    => 1,
						'orderby'     => 'id',
						'order'       => 'desc',
					)
				);

				$group['sample'] = $sample['data'][0] ?? null;

				if ( $group['sample'] ) {
					$group['sample'] = $this->add_page_field( $group['sample'] );
				}

				return $group;
			},
			$result['data']
		);

		$result['priority_counts'] = $scanner_ids
			? $repository->get_priority_counts_for_scanner_ids( $scanner_ids )
			: $repository->get_priority_counts();
		$result['category_counts'] = $repository->get_category_group_counts();

		$result = apply_filters( 'vulopilot_finding_list_response', $result );

		return rest_ensure_response( $result );
	}

	/**
	 * Adds a human-readable `page` field resolved from a row's `object_type` and
	 * `object_ref`.
	 *
	 * @param array<string, mixed> $row One row from FindingRepository::find_all()'s `data`.
	 * @return array<string, mixed> Same row, with a `page` key added.
	 */
	private function add_page_field( array $row ): array {
		$object_type = $row['object_type'] ?? null;
		$object_ref  = $row['object_ref'] ?? null;

		if ( 'post' === $object_type && is_numeric( $object_ref ) ) {
			$post_id     = (int) $object_ref;
			$permalink   = get_permalink( $post_id );
			$row['page'] = $permalink ? wp_make_link_relative( $permalink ) : __( 'Site-wide', 'vulopilot' );
			$row['page_title'] = $permalink ? ( get_the_title( $post_id ) ? get_the_title( $post_id ) : null ) : null;

			return $row;
		}

		if ( is_string( $object_ref ) && untrailingslashit( $object_ref ) === untrailingslashit( home_url( '/' ) ) ) {
			$row['page']       = __( 'Site-wide', 'vulopilot' );
			$row['page_title'] = null;

			return $row;
		}

		if ( is_string( $object_ref ) && filter_var( $object_ref, FILTER_VALIDATE_URL ) ) {
			$row['page']       = wp_make_link_relative( $object_ref );
			$row['page_title'] = null;

			return $row;
		}

		$row['page']       = __( 'Site-wide', 'vulopilot' );
		$row['page_title'] = null;

		return $row;
	}

	/**
	 * Parses a comma-separated `scanner_id` request param.
	 *
	 * @param mixed $raw_param Raw comma-separated request param.
	 * @return string[]|null Sanitized values, or null when the param was empty/absent.
	 */
	private function parse_comma_separated_list( $raw_param ): ?array {
		if ( empty( $raw_param ) ) {
			return null;
		}

		$scanner_ids = array_filter( array_map( 'sanitize_key', explode( ',', (string) $raw_param ) ) );

		return $scanner_ids ? array_values( $scanner_ids ) : null;
	}

	/**
	 * @inheritDoc
	 */
	public function update_item( $request ) {
		$id     = absint( $request->get_param( 'id' ) );
		$status = sanitize_key( (string) $request->get_param( 'status' ) );

		$allowed_statuses = array( 'open', 'resolved', 'ignored', 'snoozed' );

		if ( ! in_array( $status, $allowed_statuses, true ) ) {
			return new \WP_Error( 'vulopilot_invalid_status', __( 'Invalid finding status.', 'vulopilot' ), array( 'status' => 400 ) );
		}

		$repository = new FindingRepository();

		if ( ! $repository->find( $id ) ) {
			return new \WP_Error( 'vulopilot_finding_not_found', __( 'Finding not found.', 'vulopilot' ), array( 'status' => 404 ) );
		}

		$updated = $repository->update(
			$id,
			array(
				'status'      => $status,
				'resolved_at' => 'resolved' === $status ? current_time( 'mysql', true ) : null,
			)
		);

		if ( ! $updated ) {
			return new \WP_Error( 'vulopilot_update_failed', __( 'Could not update this finding.', 'vulopilot' ), array( 'status' => 500 ) );
		}

		return rest_ensure_response(
			array(
				'success' => true,
				'id'      => $id,
			)
		);
	}

	/**
	 * Backs FindingsTable.tsx's bulk Resolve/Ignore action.
	 *
	 * @param \WP_REST_Request $request Full request object.
	 * @return \WP_REST_Response|\WP_Error
	 */
	public function bulk_update_items( $request ) {
		$ids    = array_map( 'absint', (array) $request->get_param( 'ids' ) );
		$status = sanitize_key( (string) $request->get_param( 'status' ) );

		if ( ! in_array( $status, array( 'resolved', 'ignored' ), true ) ) {
			return new \WP_Error( 'vulopilot_invalid_status', __( 'Invalid bulk finding status.', 'vulopilot' ), array( 'status' => 400 ) );
		}

		if ( empty( $ids ) ) {
			return new \WP_Error( 'vulopilot_no_ids', __( 'No findings selected.', 'vulopilot' ), array( 'status' => 400 ) );
		}

		$repository    = new FindingRepository();
		$updated_count = $repository->bulk_update(
			$ids,
			array(
				'status'      => $status,
				'resolved_at' => 'resolved' === $status ? current_time( 'mysql', true ) : null,
			)
		);

		return rest_ensure_response(
			array(
				'success' => true,
				'updated' => $updated_count,
			)
		);
	}

	/**
	 * Backs FindingsTable.tsx's "Snooze" row action (and any other
	 * registered manual action) via Automations\ManualActionRunner.
	 *
	 * @param \WP_REST_Request $request Full request object.
	 * @return \WP_REST_Response|\WP_Error
	 */
	public function run_manual_action( $request ) {
		$finding_id = absint( $request->get_param( 'id' ) );
		$action_id  = sanitize_key( (string) $request->get_param( 'action_id' ) );

		try {
			$result = VuloPilot()->manual_action_runner->run( $finding_id, $action_id );
		} catch ( \InvalidArgumentException $exception ) {
			return new \WP_Error( 'vulopilot_manual_action_invalid', $exception->getMessage(), array( 'status' => 404 ) );
		}

		return rest_ensure_response( $result->to_array() );
	}
}
