<?php
/**
 * AbstractBasicAction class file.
 *
 * @package VuloPilot
 */

namespace VuloPilot\AiCopilot\Actions;

use VuloPilot\Utill\AIActionInterface;
use VuloPilot\Utill\Impact;

defined( 'ABSPATH' ) || exit;

/**
 * Base class for every free-tier action under AiCopilot/Actions/.
 *
 * @class       AbstractBasicAction class
 * @version     1.0.0
 * @author      VuloLabs
 */
abstract class AbstractBasicAction implements AIActionInterface {

	/**
	 * @inheritDoc
	 */
	public function get_tier(): string {
		return 'free';
	}

	/**
	 * Impact::MEDIUM, a cautious default.
	 *
	 * @inheritDoc
	 */
	public function get_risk_level(): string {
		return Impact::MEDIUM;
	}
}
