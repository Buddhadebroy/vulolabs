<?php
/**
 * ManualActionRunner test file.
 *
 * @package VuloPilot
 */

namespace VuloPilot\Tests;

use VuloPilot\Automation\ActionRegistry;
use VuloPilot\Automation\ManualActionRunner;
use VuloPilot\Contracts\Automation\ActionInterface;
use VuloPilot\Repositories\FindingRepository;
use VuloPilot\ValueObjects\AutomationRunResult;
use VuloPilot\ValueObjects\Recommendation;

require_once __DIR__ . '/TestCase.php';

/**
 * Real unit tests over ManualActionRunner::run() — "Manual Actions Only"
 * (readme.txt), Free's entire automation capability. Confirms it builds a
 * synthetic Recommendation directly off a real Finding row (no RuleEngine
 * involved) and passes it straight to the requested registered action.
 *
 * @class       TestManualActionRunner class
 * @version     1.0.0
 * @author      VuloLabs
 */
class TestManualActionRunner extends TestCase {

    /**
     * @return void
     */
    public function test_runs_the_requested_action_against_the_finding(): void {
        $finding_row = array(
            'id'          => 7,
            'title'       => 'Missing alt text',
            'description' => 'Image has no alt attribute',
            'category'    => 'images',
            'object_type' => 'attachment',
            'object_ref'  => '99',
        );

        $findings = \Mockery::mock( FindingRepository::class );
        $findings->shouldReceive( 'find' )->once()->with( 7 )->andReturn( $finding_row );

        $expected_result = new AutomationRunResult( true, 'snooze-finding', 'Finding #7 snoozed.' );

        $action = \Mockery::mock( ActionInterface::class );
        $action->shouldReceive( 'execute' )->once()->with(
            \Mockery::on(
                static function ( Recommendation $recommendation ) {
                    return 'manual' === $recommendation->get_rule_id()
                        && 'Missing alt text' === $recommendation->get_title()
                        && array( 'images' ) === $recommendation->get_categories()
                        && 'attachment' === $recommendation->get_object_type()
                        && '99' === $recommendation->get_object_ref();
                }
            ),
            array()
        )->andReturn( $expected_result );

        $actions = \Mockery::mock( ActionRegistry::class );
        $actions->shouldReceive( 'get_action' )->once()->with( 'snooze-finding' )->andReturn( $action );

        $runner = new ManualActionRunner( $actions, $findings );
        $result = $runner->run( 7, 'snooze-finding' );

        $this->assertSame( $expected_result, $result );
    }

    /**
     * @return void
     */
    public function test_throws_when_the_finding_does_not_exist(): void {
        $findings = \Mockery::mock( FindingRepository::class );
        $findings->shouldReceive( 'find' )->once()->with( 404 )->andReturn( null );

        $actions = \Mockery::mock( ActionRegistry::class );
        $actions->shouldNotReceive( 'get_action' );

        $this->expectException( \InvalidArgumentException::class );

        ( new ManualActionRunner( $actions, $findings ) )->run( 404, 'snooze-finding' );
    }

    /**
     * @return void
     */
    public function test_throws_when_the_action_is_not_registered(): void {
        $findings = \Mockery::mock( FindingRepository::class );
        $findings->shouldReceive( 'find' )->once()->andReturn(
            array(
				'id'          => 7,
				'title'       => 't',
				'description' => '',
				'category'    => 'seo',
				'object_type' => null,
				'object_ref'  => null,
            )
        );

        $actions = \Mockery::mock( ActionRegistry::class );
        $actions->shouldReceive( 'get_action' )->once()->with( 'not-a-real-action' )->andReturn( null );

        $this->expectException( \InvalidArgumentException::class );

        ( new ManualActionRunner( $actions, $findings ) )->run( 7, 'not-a-real-action' );
    }
}
