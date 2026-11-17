<?php
/**
 * CloudAIActionInterface file.
 *
 * @package VuloPilot
 */

namespace VuloPilot\Utill;

defined( 'ABSPATH' ) || exit;

/**
 * An AI action that runs an AI-service feature.
 *
 * @class       CloudAIActionInterface
 * @version     1.0.0
 * @author      VuloLabs
 */
interface CloudAIActionInterface extends AIActionInterface {

	/**
	 * The AI-service feature this action runs.
	 *
	 * @return array `[ featureId, action ]`.
	 */
	public function get_cloud_feature(): array;

	/**
	 * The feature's structured input, built from validate_input()'s result.
	 *
	 * @param array $input Normalized input.
	 * @return array
	 */
	public function build_cloud_context( array $input ): array;
}
