<?php
/**
 * RateRepository class file.
 *
 * @package VuloCart
 */

namespace VuloCart\Taxes\Application;

defined( 'ABSPATH' ) || exit;

/**
 * VuloCart Taxes module RateRepository: the tax-rate table and the list of tax classes.
 *
 * Classes live in one option (slug => name) because a class is only a label products point at; the rates are rows.
 * `standard` always exists and cannot be removed.
 *
 * @class       RateRepository class
 * @version     1.0.0
 * @author      VuloLabs
 */
class RateRepository {

    /**
     * Option holding the tax classes (slug => name).
     *
     * @var string
     */
    const CLASSES_OPTION = 'vulocart_tax_classes';

    /**
     * The rates table name.
     *
     * @return string
     */
    private function table(): string {
        global $wpdb;

        return $wpdb->prefix . 'vulocart_tax_rates';
    }

    /**
     * Every tax class, slug => name. `standard` is always first.
     *
     * @return array<string, string>
     */
    public function classes(): array {
        $stored  = get_option( self::CLASSES_OPTION, null );
        $classes = is_array( $stored ) ? $stored : array(
            'reduced' => __( 'Reduced rate', 'vulocart' ),
            'zero'    => __( 'Zero rate', 'vulocart' ),
        );

        return array( 'standard' => __( 'Standard rate', 'vulocart' ) ) + $classes;
    }

    /**
     * Adds a tax class.
     *
     * @param string $name Display name.
     * @return string|null The new class slug, or null when the name is empty or the class already exists.
     */
    public function add_class( string $name ): ?string {
        $slug = sanitize_title( $name );

        if ( '' === $slug || isset( $this->classes()[ $slug ] ) ) {
            return null;
        }

        $classes          = $this->classes();
        $classes[ $slug ] = sanitize_text_field( $name );

        unset( $classes['standard'] );
        update_option( self::CLASSES_OPTION, $classes );

        return $slug;
    }

    /**
     * Removes a tax class and its rates. Products using it fall back to `standard` when taxed.
     *
     * @param string $slug Class slug.
     * @return bool
     */
    public function delete_class( string $slug ): bool {
        if ( 'standard' === $slug || ! isset( $this->classes()[ $slug ] ) ) {
            return false;
        }

        global $wpdb;

        $classes = $this->classes();

        unset( $classes['standard'], $classes[ $slug ] );
        update_option( self::CLASSES_OPTION, $classes );
        $wpdb->delete( $this->table(), array( 'tax_class' => $slug ) ); // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching

        return true;
    }

    /**
     * How many rates exist at all (0 means the store uses the flat fallback rate).
     *
     * @return int
     */
    public function count(): int {
        global $wpdb;

        return (int) $wpdb->get_var( "SELECT COUNT(*) FROM {$this->table()}" ); // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.InterpolatedNotPrepared
    }

    /**
     * Rates, optionally for one class.
     *
     * @param string $tax_class Class slug, or '' for all.
     * @return array<int, array<string, mixed>>
     */
    public function all( string $tax_class = '' ): array {
        global $wpdb;

        if ( '' === $tax_class ) {
            $rows = $wpdb->get_results( "SELECT * FROM {$this->table()} ORDER BY tax_class, country, state, priority, id", ARRAY_A ); // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.InterpolatedNotPrepared
        } else {
            $rows = $wpdb->get_results( $wpdb->prepare( "SELECT * FROM {$this->table()} WHERE tax_class = %s ORDER BY country, state, priority, id", $tax_class ), ARRAY_A ); // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.InterpolatedNotPrepared
        }

        return array_map( array( $this, 'shape' ), (array) $rows );
    }

    /**
     * One rate.
     *
     * @param int $id Rate id.
     * @return array<string, mixed>|null
     */
    public function find( int $id ): ?array {
        global $wpdb;

        $row = $wpdb->get_row( $wpdb->prepare( "SELECT * FROM {$this->table()} WHERE id = %d", $id ), ARRAY_A ); // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.InterpolatedNotPrepared

        return $row ? $this->shape( $row ) : null;
    }

    /**
     * Creates a rate.
     *
     * @param array<string, mixed> $data Rate fields.
     * @return array<string, mixed>
     */
    public function insert( array $data ): array {
        global $wpdb;

        $wpdb->insert( $this->table(), $this->clean( $data ) ); // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching

        return $this->find( (int) $wpdb->insert_id );
    }

    /**
     * Updates a rate.
     *
     * @param int                  $id   Rate id.
     * @param array<string, mixed> $data Fields to change.
     * @return array<string, mixed>|null
     */
    public function update( int $id, array $data ): ?array {
        $current = $this->find( $id );

        if ( ! $current ) {
            return null;
        }

        global $wpdb;

        $wpdb->update( $this->table(), $this->clean( array_merge( $current, $data ) ), array( 'id' => $id ) ); // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching

        return $this->find( $id );
    }

    /**
     * Deletes a rate.
     *
     * @param int $id Rate id.
     * @return bool
     */
    public function delete( int $id ): bool {
        global $wpdb;

        return (bool) $wpdb->delete( $this->table(), array( 'id' => $id ) ); // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
    }

    /**
     * Deletes every rate of a class (a preset replacing what was there).
     *
     * @param string $tax_class Class slug.
     * @return void
     */
    public function delete_class_rates( string $tax_class ): void {
        global $wpdb;

        $wpdb->delete( $this->table(), array( 'tax_class' => $tax_class ) ); // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
    }

    /**
     * A row cleaned for storage.
     *
     * @param array<string, mixed> $data Raw fields.
     * @return array<string, mixed>
     */
    private function clean( array $data ): array {
        $class = sanitize_key( (string) ( $data['tax_class'] ?? 'standard' ) );

        return array(
            'tax_class' => isset( $this->classes()[ $class ] ) ? $class : 'standard',
            'country'   => strtoupper( substr( preg_replace( '/[^a-zA-Z]/', '', (string) ( $data['country'] ?? '' ) ), 0, 2 ) ),
            'state'     => strtoupper( substr( sanitize_text_field( (string) ( $data['state'] ?? '' ) ), 0, 64 ) ),
            'postcode'  => substr( preg_replace( '/[^A-Za-z0-9 .*,;-]/', '', (string) ( $data['postcode'] ?? '' ) ), 0, 255 ),
            'rate'      => max( 0, min( 100, (float) ( $data['rate'] ?? 0 ) ) ),
            'name'      => substr( sanitize_text_field( (string) ( $data['name'] ?? '' ) ), 0, 100 ),
            'priority'  => max( 1, (int) ( $data['priority'] ?? 1 ) ),
            'shipping'  => empty( $data['shipping'] ) ? 0 : 1,
        );
    }

    /**
     * A row as the API returns it.
     *
     * @param array<string, mixed> $row Raw row.
     * @return array<string, mixed>
     */
    private function shape( array $row ): array {
        return array(
            'id'        => (int) $row['id'],
            'tax_class' => (string) $row['tax_class'],
            'country'   => (string) $row['country'],
            'state'     => (string) $row['state'],
            'postcode'  => (string) $row['postcode'],
            'rate'      => (float) $row['rate'],
            'name'      => (string) $row['name'],
            'priority'  => (int) $row['priority'],
            'shipping'  => (bool) $row['shipping'],
        );
    }
}
