<?php
namespace VuloPilot\Utill;


defined( 'ABSPATH' ) || exit;

/**
 * Base class for every free-tier scanner across every tab folder
 * (Dashboard/, SeoVisibility/, Content/, etc.).
 *
 * Every scanner extending this is, by definition, free-tier - that's
 * what "Basic" meant in this class's old name, AbstractBasicScanner
 * (ARCHITECTURE.md) - so get_tier() is genuinely shared behavior, not
 * per-scanner boilerplate being prematurely abstracted. get_id()/
 * get_label()/get_category()/scan() stay abstract since those are what
 * actually differ between scanners.
 *
 * @class       ScannerUtil class
 * @version     1.0.0
 * @author      VuloLabs
 */
abstract class ScannerUtil implements ScannerInterface {

    /**
     * @inheritDoc
     */
    public function get_tier(): string {
        return 'free';
    }

    /**
     * @inheritDoc
     */
    abstract public function get_id(): string;

    /**
     * @inheritDoc
     */
    abstract public function get_label(): string;

    /**
     * @inheritDoc
     */
    abstract public function get_category(): string;

    /**
     * @inheritDoc
     */
    abstract public function scan(): array;
}
