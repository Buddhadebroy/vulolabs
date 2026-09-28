<?php
namespace VuloPilot\Utill;

defined( 'ABSPATH' ) || exit;

/**
 * Base class for every free-tier scanner across every tab folder (Dashboard/,
 * SeoVisibility/, Content/, etc.).
 *
 * @class       ScannerUtil class
 * @version     1.0.0
 * @author      VuloLabs
 */
abstract class ScannerUtil implements ScannerInterface {

	/**
	 * @inheritDoc
	 */
	public function get_tier(): string {
		return 'free';
	}

	/**
	 * @inheritDoc
	 */
	abstract public function get_id(): string;

	/**
	 * @inheritDoc
	 */
	abstract public function get_label(): string;

	/**
	 * @inheritDoc
	 */
	abstract public function get_category(): string;

	/**
	 * @inheritDoc
	 */
	abstract public function scan(): array;
}
