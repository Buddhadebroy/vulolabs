<?php
namespace VuloPilot\Utill;

defined( 'ABSPATH' ) || exit;

/**
 * Gives a per-post scanner a one-line way to record every post it actually considered
 * during scan().
 *
 * @class       ScannedPostsTrait trait
 * @version     1.0.0
 * @author      VuloLabs
 */
trait ScannedPostsTrait {

	/**
	 * @var int[]
	 */
	private array $scanned_post_ids = array();

	/**
	 * @param int $post_id Post/page ID this scan run considered.
	 * @return void
	 */
	protected function mark_post_scanned( int $post_id ): void {
		$this->scanned_post_ids[] = $post_id;
	}

	/**
	 * @inheritDoc
	 */
	public function get_scanned_post_ids(): array {
		return $this->scanned_post_ids;
	}
}
