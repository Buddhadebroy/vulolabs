<?php
/**
 * FakeLogs test double file.
 *
 * @package VuloMail
 */

namespace VuloMail\Tests;

use VuloMail\Logging\LogRepository;

/**
 * Keeps log rows in memory.
 */
class FakeLogs extends LogRepository {

	/**
	 * Rows inserted so far.
	 *
	 * @var array<int, array>
	 */
	public $rows = array();

	/**
	 * Appends a row and returns its 1-based position as the row id.
	 *
	 * @param array $row Column => value.
	 * @return int
	 */
	public function insert( array $row ) {
		$this->rows[] = $row;

		return count( $this->rows );
	}
}
