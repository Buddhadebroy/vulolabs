<?php
/**
 * Finding file.
 *
 * @package VuloPilot
 */

namespace VuloPilot\ValueObjects;

/**
 * A single issue surfaced by a Scanner. Immutable — every field is set at
 * construction time by the scanner that produced it.
 *
 * @class       Finding class
 * @version     1.0.0
 * @author      VuloLabs
 */
final class Finding {

    /**
     * @var string
     */
    private string $title;

    /**
     * @var string One of Severity's constants.
     */
    private string $severity;

    /**
     * @var string
     */
    private string $category;

    /**
     * @var string
     */
    private string $description;

    /**
     * @var string|null e.g. 'post', 'attachment', 'user', 'url', 'plugin', 'table', 'core'.
     */
    private ?string $object_type;

    /**
     * @var string|null e.g. a post id, a URL, a table name.
     */
    private ?string $object_ref;

    /**
     * @var array<string, mixed>
     */
    private array $meta;

    /**
     * @var string|null A stable identity for this finding, independent of
     *                  `$title`'s exact text, used for dedupe matching.
     */
    private ?string $dedupe_key;

    /**
     * @param string      $title       Human-readable summary.
     * @param string      $severity    One of Severity's constants.
     * @param string      $category    Category this finding belongs to.
     * @param string      $description Longer explanation.
     * @param string|null $object_type What kind of thing this finding is about, if any.
     * @param string|null $object_ref  Reference to the specific object, if any.
     * @param array       $meta        Arbitrary scanner-specific extra data.
     * @param string|null $dedupe_key  A stable per-scanner identity for this
     *                                 finding to match on across rescans,
     *                                 for a scanner whose `$title` bakes in
     *                                 a live, scan-to-scan-fluctuating value
     *                                 (a word count, a score, a byte size, a
     *                                 count) that would otherwise defeat
     *                                 FindingRepository::find_open_duplicate()'s
     *                                 exact-`title`-match fallback — see
     *                                 that method's own docblock. Left
     *                                 `null` (the default) for every scanner
     *                                 whose title is already a stable
     *                                 identifying value on its own (a URL, a
     *                                 file path, a fixed name) or that can
     *                                 legitimately emit more than one
     *                                 Finding for the same `object_type`/
     *                                 `object_ref` in a single `scan()` call
     *                                 (dedupe then still falls back to
     *                                 matching the full `title`, exactly as
     *                                 before this param existed).
     */
    public function __construct(
        string $title,
        string $severity,
        string $category,
        string $description,
        ?string $object_type = null,
        ?string $object_ref = null,
        array $meta = array(),
        ?string $dedupe_key = null
    ) {
        $this->title       = $title;
        $this->severity    = $severity;
        $this->category    = $category;
        $this->description = $description;
        $this->object_type = $object_type;
        $this->object_ref  = $object_ref;
        $this->meta        = $meta;
        $this->dedupe_key  = $dedupe_key;
    }

    /**
     * @return string
     */
    public function get_title(): string {
        return $this->title;
    }

    /**
     * @return string
     */
    public function get_severity(): string {
        return $this->severity;
    }

    /**
     * @return string
     */
    public function get_category(): string {
        return $this->category;
    }

    /**
     * @return string|null
     */
    public function get_description(): ?string {
        return $this->description;
    }

    /**
     * @return string|null
     */
    public function get_object_type(): ?string {
        return $this->object_type;
    }

    /**
     * @return string|null
     */
    public function get_object_ref(): ?string {
        return $this->object_ref;
    }

    /**
     * @return array<string, mixed>
     */
    public function get_meta(): array {
        return $this->meta;
    }

    /**
     * @return string|null
     */
    public function get_dedupe_key(): ?string {
        return $this->dedupe_key;
    }
}
