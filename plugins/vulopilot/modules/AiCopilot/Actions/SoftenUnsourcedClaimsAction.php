<?php
/**
 * SoftenUnsourcedClaimsAction class file.
 *
 * @package VuloPilot
 */

namespace VuloPilot\AiCopilot\Actions;

use VuloPilot\Utill\VuloPilotException;
use VuloPilot\AiAssistant\ActionExecutionResult;
use VuloPilot\AiAssistant\ActionPreview;
use VuloPilot\AiAssistant\AIResponse;

defined( 'ABSPATH' ) || exit;

/**
 * GEO-MODULE.md's fix for GeoCitationOpportunityScanner's finding.
 * Deliberately does NOT invent a citation/source link - an AI has no way
 * to verify a real study/survey exists for a given claim, and fabricating
 * one would be worse than the original gap (GeoCitationOpportunityScanner's
 * own docblock already flags "requires human judgment on what to cite" as
 * the reason this scanner was originally left unmapped). Instead, this
 * rewrites just the offending sentence(s) to remove the false-precision
 * framing (e.g. "42% of users" becomes "many users") so the claim no
 * longer reads as an unsourced statistic - the same
 * existing-content-rewrite pattern as ImproveReadabilityAction, scoped to
 * a narrower instruction and a tighter length-ratio tolerance since only a
 * sentence or two should actually change.
 *
 * @class       SoftenUnsourcedClaimsAction class
 * @version     1.0.0
 * @author      VuloLabs
 */
class SoftenUnsourcedClaimsAction extends AbstractBasicAction {

    /**
     * A rewrite shorter than this fraction of the original is treated as
     * more than a targeted sentence-level edit and rejected - see
     * ImproveReadabilityAction's own use of the same guard, tightened here
     * since this action should only ever touch a sentence or two.
     */
    private const MIN_LENGTH_RATIO = 0.8;

    /**
     * @inheritDoc
     */
    public function get_id(): string {
        return 'soften-unsourced-claims';
    }

    /**
     * @inheritDoc
     */
    public function get_label(): string {
        return __( 'Soften unsourced claims', 'vulopilot' );
    }

    /**
     * @inheritDoc
     */
    public function validate_input( array $input ): array {
        $post_id = absint( $input['post_id'] ?? 0 );
        $post    = $post_id ? get_post( $post_id ) : null;

        if ( ! $post || ! in_array( $post->post_type, array( 'post', 'page' ), true ) ) {
            throw new VuloPilotException( esc_html__( 'post_id must refer to an existing post or page.', 'vulopilot' ), VuloPilotException::TYPE_INVALID_ACTION_INPUT );  // phpcs:ignore WordPress.Security.EscapeOutput.ExceptionNotEscaped -- false positive: flags the VuloPilotException::TYPE_* constant token itself, not unescaped output; the message argument is already esc_html()-wrapped.
        }

        if ( '' === trim( wp_strip_all_tags( $post->post_content ) ) ) {
            throw new VuloPilotException( esc_html__( 'This post has no content to rewrite.', 'vulopilot' ), VuloPilotException::TYPE_INVALID_ACTION_INPUT );  // phpcs:ignore WordPress.Security.EscapeOutput.ExceptionNotEscaped -- false positive: flags the VuloPilotException::TYPE_* constant token itself, not unescaped output; the message argument is already esc_html()-wrapped.
        }

        return array(
            'post_id'          => $post_id,
            'original_content' => $post->post_content,
        );
    }

    /**
     * @inheritDoc
     */
    public function build_prompt( array $input ): array {
        return array(
            array(
                'role'    => 'system',
                'content' => 'This content states a statistic or references a study/survey/report without linking to '
                    . 'any source. You cannot verify or invent a real source. Find every sentence making such an '
                    . 'unsourced, specific numeric claim and rewrite ONLY that sentence to remove the false precision - '
                    . 'soften it to a qualitative statement (e.g. "42% of users" becomes "many users") instead of stating '
                    . 'an unverifiable exact figure. Do not invent a citation, link, or source. Preserve every HTML tag '
                    . 'and every other sentence exactly as-is. Respond with ONLY the full rewritten HTML content - no '
                    . 'commentary.',
            ),
            array(
                'role'    => 'user',
                'content' => $input['original_content'],
            ),
        );
    }

    /**
     * @inheritDoc
     */
    public function parse_response( AIResponse $response ): array {
        return array( 'rewritten_content' => trim( $response->get_content() ) );
    }

    /**
     * @inheritDoc
     */
    public function validate_output( array $output, array $input ): void {
        $rewritten = $output['rewritten_content'] ?? '';

        if ( '' === trim( wp_strip_all_tags( $rewritten ) ) ) {
            throw new VuloPilotException( esc_html__( 'The AI returned empty content.', 'vulopilot' ), VuloPilotException::TYPE_INVALID_ACTION_OUTPUT );  // phpcs:ignore WordPress.Security.EscapeOutput.ExceptionNotEscaped -- false positive: flags the VuloPilotException::TYPE_* constant token itself, not unescaped output; the message argument is already esc_html()-wrapped.
        }

        $original_length  = mb_strlen( wp_strip_all_tags( $input['original_content'] ) );
        $rewritten_length = mb_strlen( wp_strip_all_tags( $rewritten ) );

        if ( $original_length > 0 && ( $rewritten_length / $original_length ) < self::MIN_LENGTH_RATIO ) {
            throw new VuloPilotException(
                esc_html__( 'The AI returned content that looks truncated rather than a targeted rewrite - rejected for safety.', 'vulopilot' ), VuloPilotException::TYPE_INVALID_ACTION_OUTPUT );  // phpcs:ignore WordPress.Security.EscapeOutput.ExceptionNotEscaped -- false positive: flags the VuloPilotException::TYPE_* constant token itself, not unescaped output; the message argument is already esc_html()-wrapped.
        }
    }

    /**
     * @inheritDoc
     */
    public function build_preview( array $output, array $input ): ActionPreview {
        return new ActionPreview(
            __( 'Soften unsourced statistic claims in this content', 'vulopilot' ),
            wp_trim_words( wp_strip_all_tags( $input['original_content'] ), 30 ),
            wp_trim_words( wp_strip_all_tags( $output['rewritten_content'] ), 30 ),
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
                'post_content' => $output['rewritten_content'],
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
                'previous_content' => $input['original_content'],
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
