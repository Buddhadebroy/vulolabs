<?php
/**
 * RepositoryInterface file.
 *
 * @package VuloPilot
 */

namespace VuloPilot\Utill;

defined( 'ABSPATH' ) || exit;

/**
 * Generic CRUD contract so Free's repositories are swappable/mockable in tests.
 *
 * @class       RepositoryInterface interface
 * @version     1.0.0
 * @author      VuloLabs
 */
interface RepositoryInterface {

	/**
	 * @param int $id Row id.
	 * @return array|null
	 */
	public function find( int $id ): ?array;

	/**
	 * @param array $args Optional 'page', 'per_page', 'orderby', 'order', plus whatever columns the concrete repository allows filtering on.
	 * @return array
	 */
	public function find_all( array $args = array() ): array;

	/**
	 * @param array $data Column => value pairs to insert.
	 * @return int The new row's id.
	 */
	public function insert( array $data ): int;

	/**
	 * @param int   $id   Row id.
	 * @param array $data Column => value pairs to update.
	 * @return bool
	 */
	public function update( int $id, array $data ): bool;

	/**
	 * @param int $id Row id.
	 * @return bool
	 */
	public function delete( int $id ): bool;
}
