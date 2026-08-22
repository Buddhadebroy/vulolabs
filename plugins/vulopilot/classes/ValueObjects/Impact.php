<?php
/**
 * Impact file.
 *
 * @package VuloPilot
 */

namespace VuloPilot\ValueObjects;

/**
 * A rule's estimated impact if its recommendation is resolved. Also reused,
 * unchanged, as the general LOW/MEDIUM/HIGH scale for an AI action's own
 * approval risk (AIActionInterface::get_risk_level(), Settings → Automation
 * → Approval Settings' `ai_change_approval_mode`) — the same "rank the
 * enum, compare ranks" idiom Automations\Actions\RunAiActionAction's own
 * IMPACT_RANK already applies to a Recommendation's impact, generalized
 * rather than introducing a second, near-identical LOW/MEDIUM/HIGH enum.
 *
 * @class       Impact class
 * @version     1.0.0
 * @author      VuloLabs
 */
final class Impact {

    const HIGH   = 'high';
    const MEDIUM = 'medium';
    const LOW    = 'low';
}
