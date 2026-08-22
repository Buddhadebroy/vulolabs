<?php
/**
 * OptimizeMediaAction class file.
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
 * Create Content's "Media Library AI" tool — broader than
 * GenerateAltAction's alt-text-only scope (matching the tool's own
 * "Organize, tag and optimize your media library" description): writes
 * alt text, title, and caption for one image attachment in a single run.
 * ActionPreview only ever diffs one field, so the preview shown before
 * approval focuses on alt text specifically (the most consequential of
 * the three for accessibility/SEO) — execute() still applies all three
 * real fields it generated.
 *
 * @class       OptimizeMediaAction class
 * @version     1.0.0
 * @author      VuloLabs
 */
class OptimizeMediaAction extends AbstractBasicAction {

    private const ALT_META_KEY = '_wp_attachment_image_alt';

    /**
     * @inheritDoc
     */
    public function get_id(): string {
        return 'optimize-media';
    }

    /**
     * @inheritDoc
     */
    public function get_label(): string {
        return __( 'Optimize media', 'vulopilot' );
    }

    /**
     * Impact::LOW — Rewrites an attachment's own `post_title`/`post_excerpt` — narrow fields on the attachment object itself, never a post's `post_content`.
     *
     * @inheritDoc
     */
    public function get_risk_level(): string {
        return Impact::LOW;
    }

    /**
     * @inheritDoc
     */
    public function validate_input( array $input ): array {
        $attachment_id = absint( $input['attachment_id'] ?? 0 );

        if ( ! $attachment_id || 'attachment' !== get_post_type( $attachment_id ) ) {
            throw new InvalidActionInputException( __( 'attachment_id must refer to an existing media attachment.', 'vulopilot' ) );
        }

        if ( ! wp_attachment_is_image( $attachment_id ) ) {
            throw new InvalidActionInputException( __( 'This attachment is not an image.', 'vulopilot' ) );
        }

        $attachment = get_post( $attachment_id );

        return array(
            'attachment_id'    => $attachment_id,
            'previous_alt'     => get_post_meta( $attachment_id, self::ALT_META_KEY, true ),
            'previous_title'   => $attachment->post_title,
            'previous_caption' => $attachment->post_excerpt,
        );
    }

    /**
     * @inheritDoc
     */
    public function build_prompt( array $input ): array {
        $filename  = wp_basename( (string) get_attached_file( $input['attachment_id'] ) );
        $parent_id = (int) wp_get_post_parent_id( $input['attachment_id'] );

        return array(
            array(
                'role'    => 'system',
                'content' => 'You write metadata for WordPress media library images — accessibility, SEO, and '
                    . 'organization. Respond in exactly this format, nothing else:'
                    . "\nALT: <alt text, under 125 characters>\nTITLE: <a short descriptive title>\nCAPTION: <a one-sentence caption>",
            ),
            array(
                'role'    => 'user',
                'content' => sprintf(
                    "Image filename: %s\nUsed on page titled: %s\n\nWrite alt text, a title, and a caption for this image.",
                    $filename,
                    $parent_id ? get_the_title( $parent_id ) : '(unknown)'
                ),
            ),
        );
    }

    /**
     * @inheritDoc
     */
    public function parse_response( AIResponse $response ): array {
        $content = $response->get_content();

        preg_match( '/ALT:\s*(.+?)\n/i', $content, $alt_match );
        preg_match( '/TITLE:\s*(.+?)\n/i', $content, $title_match );
        preg_match( '/CAPTION:\s*(.+)/is', $content, $caption_match );

        return array(
            'alt_text' => trim( $alt_match[1] ?? '', " \t\n\r\0\x0B\"'" ),
            'title'    => trim( $title_match[1] ?? '', " \t\n\r\0\x0B\"'" ),
            'caption'  => trim( $caption_match[1] ?? '', " \t\n\r\0\x0B\"'" ),
        );
    }

    /**
     * @inheritDoc
     */
    public function validate_output( array $output, array $input ): void {
        if ( '' === ( $output['alt_text'] ?? '' ) ) {
            throw new InvalidActionOutputException(
                __( 'The AI response did not include usable alt text.', 'vulopilot' )
            );
        }

        if ( mb_strlen( $output['alt_text'] ) > 250 ) {
            throw new InvalidActionOutputException( __( 'The AI returned alt text that is too long.', 'vulopilot' ) );
        }
    }

    /**
     * @inheritDoc
     */
    public function build_preview( array $output, array $input ): ActionPreview {
        return new ActionPreview(
            sprintf(
                /* translators: %s is the image filename. */
                __( 'Optimize alt text, title, and caption for %s', 'vulopilot' ),
                wp_basename( (string) get_attached_file( $input['attachment_id'] ) )
            ),
            '' !== $input['previous_alt'] ? $input['previous_alt'] : null,
            $output['alt_text'],
            'text'
        );
    }

    /**
     * @inheritDoc
     */
    public function execute( array $output, array $input ): ActionExecutionResult {
        $attachment_id = $input['attachment_id'];
        $updated       = update_post_meta( $attachment_id, self::ALT_META_KEY, $output['alt_text'] );

        $post_update = array( 'ID' => $attachment_id );

        if ( '' !== $output['title'] ) {
            $post_update['post_title'] = $output['title'];
        }

        if ( '' !== $output['caption'] ) {
            $post_update['post_excerpt'] = $output['caption'];
        }

        $result = wp_update_post( $post_update, true );

        if ( is_wp_error( $result ) || ! $updated ) {
            $message = is_wp_error( $result ) ? $result->get_error_message() : __( 'Could not update the attachment.', 'vulopilot' );

            return new ActionExecutionResult( false, 'attachment', (string) $attachment_id, array(), $message );
        }

        return new ActionExecutionResult(
            true,
            'attachment',
            (string) $attachment_id,
            array(
                'attachment_id'    => $attachment_id,
                'previous_alt'     => $input['previous_alt'],
                'previous_title'   => $input['previous_title'],
                'previous_caption' => $input['previous_caption'],
            )
        );
    }

    /**
     * @inheritDoc
     */
    public function rollback( array $snapshot ): void {
        update_post_meta( $snapshot['attachment_id'], self::ALT_META_KEY, $snapshot['previous_alt'] );

        wp_update_post(
            array(
                'ID'           => $snapshot['attachment_id'],
                'post_title'   => $snapshot['previous_title'],
                'post_excerpt' => $snapshot['previous_caption'],
            )
        );
    }
}
