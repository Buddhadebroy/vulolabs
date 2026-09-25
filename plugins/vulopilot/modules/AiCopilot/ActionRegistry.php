<?php
/**
 * ActionRegistry class file.
 *
 * @package VuloPilot
 */

namespace VuloPilot\AiCopilot;

use VuloPilot\Utill\AIActionInterface;

defined( 'ABSPATH' ) || exit;

/**
 * @class       ActionRegistry class
 * @version     1.0.0
 * @author      VuloLabs
 */
class ActionRegistry {

    /**
     * @var array<string, AIActionInterface>
     */
    private array $actions = array();

    /**
     * ActionRegistry constructor.
     */
    public function __construct() {
        add_action( 'init', array( $this, 'register_actions' ), 20 );
    }

    /**
     * @return void
     */
    public function register_actions(): void {
        $action_classes = apply_filters( 'vulopilot_ai_action_sources', $this->get_default_action_classes() );

        foreach ( $action_classes as $action_class ) {
            if ( ! is_string( $action_class ) || ! class_exists( $action_class ) ) {
                continue;
            }

            $action = new $action_class();

            if ( ! $action instanceof AIActionInterface ) {
                continue;
            }

            $this->actions[ $action->get_id() ] = $action;
        }
    }

    /**
     * @return string[]
     */
    private function get_default_action_classes(): array {
        return array(
            Actions\ImproveReadabilityAction::class,
            Actions\GenerateBlogAction::class,
            // SEO module (SEO-MODULE.md) - closes MissingMetaDescriptionRule's fix loop.
            Actions\WriteMetaDescriptionAction::class,
            // One-Click Fix coverage pass for the SEO category - closes HeadingStructureScanner's
            // and DuplicateContentScanner's fix loops, the two remaining
            // SEO findings with a genuine, safely-automatable single-post
            // content fix (as opposed to a site-config/structural issue -
            // see the scanner fix map for the rest).
            Actions\AddSubheadingsAction::class,
            Actions\DifferentiateDuplicateTitleAction::class,
            Actions\WritePostContentAction::class,
            Actions\AuditContentAction::class,
        );
    }

    /**
     * @param string $action_id e.g. 'generate-alt'.
     * @return AIActionInterface|null
     */
    public function get_action( string $action_id ): ?AIActionInterface {
        return $this->actions[ $action_id ] ?? null;
    }

    /**
     * @return array<string, AIActionInterface>
     */
    public function get_all_actions(): array {
        return $this->actions;
    }
}
