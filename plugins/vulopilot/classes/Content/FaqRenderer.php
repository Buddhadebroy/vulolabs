<?php
namespace VuloPilot\Content;

defined( 'ABSPATH' ) || exit;

/**
 * Real render logic for the `vulopilot/faq` block (`src/blocks/faq/render.php` calls
 * straight into this - see TableOfContentsRenderer's own docblock for why render.php
 * itself must stay declaration-free).
 *
 * @class       FaqRenderer class
 * @version     1.0.0
 * @author      VuloLabs
 */
class FaqRenderer {

	/**
	 * @param array<string, mixed> $attributes Real block attributes - `questions: array<{question,answer}>`.
	 * @return string Visible HTML (details UI, safe to pass through `wp_kses_post()`), or '' if every row was blank.
	 */
	public static function render( array $attributes ): string {
		$questions = self::sanitize_questions( $attributes['questions'] ?? array() );

		if ( empty( $questions ) ) {
			return '';
		}

		$design              = self::sanitize_design( $attributes['design'] ?? 'classic' );
		$wrapper_attributes = get_block_wrapper_attributes( array( 'class' => 'vulopilot-faq vulopilot-faq--' . $design ) );
		$html               = '<div ' . $wrapper_attributes . '>';

		$question_style = self::build_style( $attributes['questionColor'] ?? '', $attributes['questionFontSize'] ?? '' );
		$answer_style   = self::build_style( $attributes['answerColor'] ?? '', $attributes['answerFontSize'] ?? '' );

		foreach ( $questions as $item ) {
			$html .= sprintf(
				'<details class="vulopilot-faq-item"><summary class="vulopilot-faq-question"%3$s>%1$s</summary><div class="vulopilot-faq-answer"%4$s>%2$s</div></details>',
				wp_kses_post( $item['question'] ),
				wp_kses_post( $item['answer'] ),
				$question_style,
				$answer_style
			);
		}

		$html .= '</div>';

		return $html;
	}

	/**
	 * Builds a real ` style="..."` fragment (leading space included, so it
	 * can be interpolated straight after a tag name) from the editor's own
	 * `questionColor`/`questionFontSize`/`answerColor`/`answerFontSize`
	 * attributes (index.js's own `PanelColorSettings`/`FontSizePicker`) -
	 * empty string when neither is set, same as every other optional
	 * inline style this codebase builds.
	 *
	 * @param string $color    Real CSS color, or '' when unset.
	 * @param string $font_size Real CSS font-size (FontSizePicker's own value - a bare number, a unit'd string, or a `var(--wp--preset--font-size--*)` token), or '' when unset.
	 * @return string
	 */
	private static function build_style( string $color, string $font_size ): string {
		$declarations = array();

		if ( '' !== trim( $color ) ) {
			$declarations[] = 'color:' . esc_attr( $color );
		}

		if ( '' !== trim( $font_size ) ) {
			$declarations[] = 'font-size:' . esc_attr( $font_size );
		}

		return empty( $declarations ) ? '' : ' style="' . implode( ';', $declarations ) . '"';
	}

	/**
	 * Only the 3 designs index.js's own `RadioControl` offers are ever
	 * valid as a wrapper class - anything else (a stale attribute from
	 * before this existed, or a hand-edited post) falls back to `classic`.
	 *
	 * @param mixed $design The block's own `design` attribute value.
	 * @return string One of `classic`, `boxed`, `minimal`.
	 */
	private static function sanitize_design( $design ): string {
		$allowed = array( 'classic', 'boxed', 'minimal' );

		return in_array( $design, $allowed, true ) ? $design : 'classic';
	}

	/**
	 * Prints the FAQPage JSON-LD for the same rows render() shows - nothing when
	 * every row was blank.
	 *
	 * @param array<string, mixed> $attributes Real block attributes - `questions: array<{question,answer}>`.
	 * @return void
	 */
	public static function print_schema( array $attributes ): void {
		$questions = self::sanitize_questions( $attributes['questions'] ?? array() );

		if ( ! empty( $questions ) ) {
			self::print_schema_tag( $questions );
		}
	}

	/**
	 * Never lets a blank question/answer row reach EITHER the visible markup or the JSON-
	 * LD.
	 *
	 * @param mixed $raw The block's own `questions` attribute value.
	 * @return array<int, array{question: string, answer: string}>
	 */
	private static function sanitize_questions( $raw ): array {
		if ( ! is_array( $raw ) ) {
			return array();
		}

		$clean = array();

		foreach ( $raw as $row ) {
			if ( ! is_array( $row ) ) {
				continue;
			}

			$question = isset( $row['question'] ) ? trim( wp_kses_post( (string) $row['question'] ) ) : '';
			$answer   = isset( $row['answer'] ) ? trim( wp_kses_post( (string) $row['answer'] ) ) : '';

			if ( '' === wp_strip_all_tags( $question ) || '' === wp_strip_all_tags( $answer ) ) {
				continue;
			}

			$clean[] = array(
				'question' => $question,
				'answer'   => $answer,
			);
		}

		return $clean;
	}

	/**
	 * @param array<int, array{question: string, answer: string}> $questions Already sanitized, never empty.
	 * @return void
	 */
	private static function print_schema_tag( array $questions ): void {
		$entities = array();

		foreach ( $questions as $item ) {
			$entities[] = array(
				'@type'          => 'Question',
				'name'           => wp_strip_all_tags( $item['question'] ),
				'acceptedAnswer' => array(
					'@type' => 'Answer',
					'text'  => wp_strip_all_tags( $item['answer'] ),
				),
			);
		}

		$schema = array(
			'@context'   => 'https://schema.org',
			'@type'      => 'FAQPage',
			'mainEntity' => $entities,
		);

		wp_print_inline_script_tag( (string) wp_json_encode( $schema, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE ), array( 'type' => 'application/ld+json' ) );
	}
}
