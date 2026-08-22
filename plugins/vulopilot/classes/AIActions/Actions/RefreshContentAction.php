<?php
/**
 * RefreshContentAction class file.
 *
 * @package VuloPilot
 */

namespace VuloPilot\AIActions\Actions;

use VuloPilot\Exceptions\InvalidActionInputException;
use VuloPilot\Exceptions\InvalidActionOutputException;
use VuloPilot\ValueObjects\ActionExecutionResult;
use VuloPilot\ValueObjects\ActionPreview;
use VuloPilot\ValueObjects\AIResponse;
use VuloPilot\ValueObjects\Impact;

defined( 'ABSPATH' ) || exit;

/**
 * Create Content's "Content Refresh" tool — brings an existing post/page's
 * real `post_content` up to date (stale year/date references, outdated
 * claims like "in the coming months"), rather than OptimizeContentAction's
 * SEO/readability framing or WritePostContentAction's from-a-brief framing
 * — see OptimizeContentAction's own docblock for why these three share a
 * field but stay separate actions.
 *
 * @class       RefreshContentAction class
 * @version     1.0.0
 * @author      VuloLabs
 */
class RefreshContentAction extends AbstractBasicAction {

    /**
     * @inheritDoc
     */
    public function get_id(): string {
        return 'refresh-content';
    }

    /**
     * @inheritDoc
     */
    public function get_label(): string {
        return __( 'Refresh content', 'vulopilot' );
    }

    /**
     * Impact::HIGH — Replaces the post's entire `post_content` body wholesale (a full rewrite, not a structural edit within the existing text).
     *
     * @inheritDoc
     */
    public function get_risk_level(): string {
        return Impact::HIGH;
    }

    /**
     * @inheritDoc
     */
    public function validate_input( array $input ): array {
        $post_id = absint( $input['post_id'] ?? 0 );
        $post    = $post_id ? get_post( $post_id ) : null;

        if ( ! $post || ! in_array( $post->post_type, array( 'post', 'page' ), true ) ) {
            throw new InvalidActionInputException( __( 'post_id must refer to an existing post or page.', 'vulopilot' ) );
        }

        if ( mb_strlen( wp_strip_all_tags( $post->post_content ) ) < 50 ) {
            throw new InvalidActionInputException( __( 'This post needs at least some existing content to refresh.', 'vulopilot' ) );
        }

        return array(
            'post_id'          => $post_id,
            'post_title'       => $post->post_title,
            'previous_content' => $post->post_content,
        );
    }

    /**
     * @inheritDoc
     */
    public function build_prompt( array $input ): array {
        return array(
            array(
                'role'    => 'system',
                'content' => 'You update WordPress page content that has gone stale — outdated years, dates, and '
                    . 'claims like "coming soon" or "this year" — bringing it in line with the current date, while '
                    . 'keeping everything else the same. Respond with ONLY the updated body HTML — no title, no '
                    . 'preamble, no code fences.',
            ),
            array(
                'role'    => 'user',
                'content' => sprintf(
                    "Today's date: %s\nPage title: %s\n\nCurrent content:\n%s\n\nUpdate this content so it reads as current today.",
                    current_time( 'F j, Y' ),
                    $input['post_title'],
                    wp_strip_all_tags( $input['previous_content'] )
                ),
            ),
        );
    }

    /**
     * @inheritDoc
     */
    public function parse_response( AIResponse $response ): array {
        return array( 'content' => trim( $response->get_content() ) );
    }

    /**
     * @inheritDoc
     */
    public function validate_output( array $output, array $input ): void {
        if ( mb_strlen( wp_strip_all_tags( $output['content'] ?? '' ) ) < 50 ) {
            throw new InvalidActionOutputException( __( 'The AI returned content that is too short to be useful.', 'vulopilot' ) );
        }
    }

    /**
     * @inheritDoc
     */
    public function build_preview( array $output, array $input ): ActionPreview {
        return new ActionPreview(
            sprintf(
                /* translators: %s is the post/page title being refreshed. */
                __( 'Refresh content for: %s', 'vulopilot' ),
                $input['post_title']
            ),
            wp_trim_words( wp_strip_all_tags( $input['previous_content'] ), 40 ),
            wp_trim_words( wp_strip_all_tags( $output['content'] ), 40 ),
            'html'
        );
    }

    /**
     * @inheritDoc
     */
    public function execute( array $output, array $input ): ActionExecutionResult {
        $result = wp_update_post(
            array(
                'ID'           => $input['post_id'],
                'post_content' => $output['content'],
            ),
            true
        );

        if ( is_wp_error( $result ) ) {
            return new ActionExecutionResult( false, 'post', (string) $input['post_id'], array(), $result->get_error_message() );
        }

        return new ActionExecutionResult(
            true,
            'post',
            (string) $input['post_id'],
            array(
                'post_id'          => $input['post_id'],
                'previous_content' => $input['previous_content'],
            )
        );
    }

    /**
     * @inheritDoc
     */
    public function rollback( array $snapshot ): void {
        wp_update_post(
            array(
                'ID'           => $snapshot['post_id'],
                'post_content' => $snapshot['previous_content'],
            )
        );
    }
}
