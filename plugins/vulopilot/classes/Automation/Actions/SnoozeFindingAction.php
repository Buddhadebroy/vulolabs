<?php
/**
 * SnoozeFindingAction class file.
 *
 * @package VuloPilot
 */

namespace VuloPilot\Automation\Actions;

use VuloPilot\Contracts\Automation\ActionInterface;
use VuloPilot\ValueObjects\AutomationRunResult;
use VuloPilot\ValueObjects\Recommendation;
use VuloPilot\Repositories\FindingRepository;

defined( 'ABSPATH' ) || exit;

/**
 * Marks the specific Finding a Recommendation came from as 'snoozed' —
 * Free's own manual-only counterpart to vulopilot-pro's Automation module
 * (Contracts\Automation\ActionInterface's Pro-side implementations:
 * SendEmailAction/ResolveFindingAction/CreateNotificationAction/
 * RunAiActionAction). 'snoozed' has been a valid Finding status
 * (FindingRepository::get_status_counts(), the FindingsTable status filter)
 * since it was first introduced, but nothing has ever actually set it —
 * Free's own FindingsTable.tsx only ever wires "Mark resolved"/"Ignore"/
 * "Reopen" row actions. This is the first thing that sets it, deliberately
 * distinct from ResolveFindingAction's 'resolved' (a permanent "this is
 * fixed") and CreateNotificationAction's activity-log entry (an FYI with no
 * state change): a temporary "not now, but don't forget it either" — same
 * lookup-by-object_type/object_ref shape as ResolveFindingAction, since
 * Recommendation carries neither a finding id nor Free's own automation
 * engine to run it through (see ManualActionRunner).
 *
 * @class       SnoozeFindingAction class
 * @version     1.0.0
 * @author      VuloLabs
 */
class SnoozeFindingAction implements ActionInterface {

    /**
     * @var FindingRepository
     */
    private FindingRepository $findings;

    /**
     * @param FindingRepository|null $findings Defaults to a new instance (injectable for tests).
     */
    public function __construct( ?FindingRepository $findings = null ) {
        $this->findings = $findings ?? new FindingRepository();
    }

    /**
     * @inheritDoc
     */
    public function get_id(): string {
        return 'snooze-finding';
    }

    /**
     * @inheritDoc
     */
    public function get_label(): string {
        return __( 'Snooze the finding', 'vulopilot' );
    }

    /**
     * @inheritDoc
     */
    public function execute( Recommendation $recommendation, array $config ): AutomationRunResult {
        $object_type = $recommendation->get_object_type();
        $object_ref  = $recommendation->get_object_ref();

        if ( ! $object_type || ! $object_ref ) {
            return new AutomationRunResult( false, $this->get_id(), __( 'This recommendation is not tied to a specific object; nothing to snooze.', 'vulopilot' ) );
        }

        $open_match = $this->findings->find_all(
            array(
                'object_type' => $object_type,
                'object_ref'  => $object_ref,
                'status'      => 'open',
                'per_page'    => 1,
            )
        );

        if ( empty( $open_match['data'] ) ) {
            return new AutomationRunResult( false, $this->get_id(), __( 'No matching open finding was found.', 'vulopilot' ) );
        }

        $finding_id = (int) $open_match['data'][0]['id'];
        $updated    = $this->findings->update( $finding_id, array( 'status' => 'snoozed' ) );

        return new AutomationRunResult(
            $updated,
            $this->get_id(),
            $updated
                ? sprintf(
                    /* translators: %d is the finding's own row id. */
                    __( 'Finding #%d snoozed.', 'vulopilot' ),
                    $finding_id
                )
                : __( 'Could not update the finding.', 'vulopilot' )
        );
    }
}
