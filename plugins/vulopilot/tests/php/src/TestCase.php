<?php
/**
 * TestCase class file.
 *
 * @package VuloPilot
 */

namespace VuloPilot\Tests;

use PHPUnit\Framework\TestCase as PHPUnitTestCase;
use Mockery\Adapter\Phpunit\MockeryPHPUnitIntegration;
use Brain\Monkey;

/**
 * Shared base for this test suite — Brain\Monkey\setUp()/tearDown() around
 * every test, same shape Brain Monkey's own docs prescribe. Every concrete
 * test class extends this instead of PHPUnit's TestCase directly.
 *
 * @class       TestCase class
 * @version     1.0.0
 * @author      VuloLabs
 */
abstract class TestCase extends PHPUnitTestCase {

    use MockeryPHPUnitIntegration;

    /**
     * @return void
     */
    protected function setUp(): void {
        parent::setUp();
        Monkey\setUp();
    }

    /**
     * @return void
     */
    protected function tearDown(): void {
        Monkey\tearDown();
        parent::tearDown();
    }
}
