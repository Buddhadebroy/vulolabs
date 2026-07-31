<?php
/**
 * RobotsTxtBotAccess test file.
 *
 * @package VuloPilot
 */

namespace VuloPilot\Tests;

use VuloPilot\Services\RobotsTxtBotAccess;

require_once __DIR__ . '/TestCase.php';

/**
 * Real unit tests over RobotsTxtBotAccess's own deterministic parsing —
 * parse_groups() and resolve_from_groups() (both private, invoked via
 * Reflection — same posture test-about-page-analysis-scanner.php's own
 * docblock documents), so no network fetch mocking is needed.
 *
 * @class       TestRobotsTxtBotAccess class
 * @version     1.0.0
 * @author      VuloLabs
 */
class TestRobotsTxtBotAccess extends TestCase {

    /**
     * @var RobotsTxtBotAccess
     */
    private RobotsTxtBotAccess $access;

    /**
     * @return void
     */
    protected function setUp(): void {
        parent::setUp();
        $this->access = new RobotsTxtBotAccess();
    }

    /**
     * @param string $method Private method name.
     * @param array  $args   Positional arguments.
     * @return mixed
     */
    private function invoke_private( string $method, array $args ) {
        $reflection = new \ReflectionMethod( RobotsTxtBotAccess::class, $method );
        $reflection->setAccessible( true );

        return $reflection->invokeArgs( $this->access, $args );
    }

    /**
     * @return void
     */
    public function test_parses_a_bot_specific_group(): void {
        $body = "User-agent: GPTBot\nDisallow: /private/\nDisallow: /drafts/\n\nUser-agent: *\nDisallow: /wp-admin/\n";

        $groups = $this->invoke_private( 'parse_groups', array( $body ) );

        $this->assertSame( array( '/private/', '/drafts/' ), $groups['GPTBot'] );
        $this->assertSame( array( '/wp-admin/' ), $groups['*'] );
    }

    /**
     * @return void
     */
    public function test_consecutive_user_agent_lines_share_the_same_rules(): void {
        $body = "User-agent: GPTBot\nUser-agent: ClaudeBot\nDisallow: /no-ai/\n";

        $groups = $this->invoke_private( 'parse_groups', array( $body ) );

        $this->assertSame( array( '/no-ai/' ), $groups['GPTBot'] );
        $this->assertSame( array( '/no-ai/' ), $groups['ClaudeBot'] );
    }

    /**
     * @return void
     */
    public function test_ignores_comments_and_blank_lines(): void {
        $body = "# a comment\n\nUser-agent: GPTBot\n# another comment\nDisallow: /private/\n";

        $groups = $this->invoke_private( 'parse_groups', array( $body ) );

        $this->assertSame( array( '/private/' ), $groups['GPTBot'] );
    }

    /**
     * @return void
     */
    public function test_an_allow_only_line_produces_no_disallow_entry(): void {
        $body = "User-agent: GPTBot\nAllow: /\n";

        $groups = $this->invoke_private( 'parse_groups', array( $body ) );

        $this->assertArrayNotHasKey( 'GPTBot', $groups );
    }

    /**
     * @return void
     */
    public function test_resolve_uses_the_bots_own_named_group_when_present(): void {
        $groups = array(
            'GPTBot' => array( '/private/' ),
            '*'      => array( '/wp-admin/' ),
        );

        $this->assertSame(
            array( '/private/' ),
            $this->invoke_private( 'resolve_from_groups', array( $groups, 'GPTBot' ) )
        );
    }

    /**
     * @return void
     */
    public function test_resolve_falls_back_to_wildcard_group_when_bot_has_no_own_group(): void {
        $groups = array( '*' => array( '/wp-admin/' ) );

        $this->assertSame(
            array( '/wp-admin/' ),
            $this->invoke_private( 'resolve_from_groups', array( $groups, 'ClaudeBot' ) )
        );
    }

    /**
     * @return void
     */
    public function test_resolve_returns_empty_when_no_group_matches_at_all(): void {
        $this->assertSame(
            array(),
            $this->invoke_private( 'resolve_from_groups', array( array(), 'GPTBot' ) )
        );
    }
}
