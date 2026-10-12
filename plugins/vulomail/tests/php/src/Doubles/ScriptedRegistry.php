<?php
/**
 * ScriptedRegistry test double file.
 *
 * @package VuloMail
 */

namespace VuloMail\Tests;

use VuloMail\Connections\ProviderRegistry;

/**
 * Registry exposing only the scripted adapters.
 */
class ScriptedRegistry extends ProviderRegistry {

	/**
	 * Provider id => adapter class for a channel.
	 *
	 * @param string $channel Channel.
	 * @return array<string, string>
	 */
	public function classes( $channel ) {
		return 'sms' === $channel
			? array( 'scripted' => ScriptedGateway::class )
			: array( 'scripted' => ScriptedMailer::class );
	}
}
