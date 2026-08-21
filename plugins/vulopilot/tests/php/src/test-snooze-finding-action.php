<?php
/**
 * SnoozeFindingAction test file.
 *
 * @package VuloPilot
 */

namespace VuloPilot\Tests;

use Brain\Monkey\Functions;
use VuloPilot\Automations\Actions\SnoozeFindingAction;
use VuloPilot\Repositories\FindingRepository;
use VuloPilot\ValueObjects\Impact;
use VuloPilot\ValueObjects\Recommendation;
use VuloPilot\ValueObjects\RuleType;

require_once __DIR__ . '/TestCase.php';

/**
 * Real unit tests over SnoozeFindingAction::execute() — same
 * lookup-by-object_type/object_ref shape ResolveFindingAction (Pro) uses,
 * just setting 'snoozed' instead of 'resolved'.
 *
 * @class       TestSnoozeFindingAction class
 * @version     1.0.0
 * @author      VuloLabs
 */
class TestSnoozeFindingAction extends TestCase {

    /**
     * @return void
     */
    protected function setUp(): void {
        parent::setUp();
        Functions\when( '__' )->returnArg();
    }

    /**
     * @param string|null $object_type Object type on the recommendation, or null.
     * @param string|null $object_ref  Object ref on the recommendation, or null.
     * @return Recommendation
     */
    private function make_recommendation( ?string $object_type = 'post', ?string $object_ref = '12' ): Recommendation {
        return new Recommendation(
            'manual',
            'Some finding',
            'A description',
            RuleType::SUGGESTION,
            0,
            array( 'seo' ),
            array(),
            false,
            false,
            Impact::LOW,
            0,
            $object_type,
            $object_ref
        );
    }

    /**
     * @return void
     */
    public function test_snoozes_the_matching_open_finding(): void {
        $findings = \Mockery::mock( FindingRepository::class );
        $findings->shouldReceive( 'find_all' )->once()->with(
            array(
                'object_type' => 'post',
                'object_ref'  => '12',
                'status'      => 'open',
                'per_page'    => 1,
            )
        )->andReturn( array( 'data' => array( array( 'id' => 42 ) ) ) );
        $findings->shouldReceive( 'update' )->once()->with( 42, array( 'status' => 'snoozed' ) )->andReturn( true );

        $action = new SnoozeFindingAction( $findings );
        $result = $action->execute( $this->make_recommendation(), array() );

        $this->assertTrue( $result->is_success() );
        $this->assertSame( 'snooze-finding', $result->get_action_id() );
        $this->assertSame( 'Finding #42 snoozed.', $result->get_message() );
    }

    /**
     * @return void
     */
    public function test_fails_when_recommendation_has_no_object_reference(): void {
        $findings = \Mockery::mock( FindingRepository::class );
        $findings->shouldNotReceive( 'find_all' );

        $action = new SnoozeFindingAction( $findings );
        $result = $action->execute( $this->make_recommendation( null, null ), array() );

        $this->assertFalse( $result->is_success() );
    }

    /**
     * @return void
     */
    public function test_fails_when_no_open_finding_matches(): void {
        $findings = \Mockery::mock( FindingRepository::class );
        $findings->shouldReceive( 'find_all' )->once()->andReturn( array( 'data' => array() ) );
        $findings->shouldNotReceive( 'update' );

        $action = new SnoozeFindingAction( $findings );
        $result = $action->execute( $this->make_recommendation(), array() );

        $this->assertFalse( $result->is_success() );
    }
}
