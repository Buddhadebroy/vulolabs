<?php
/**
 * BackupStorageConfigRepository class file.
 *
 * @package VuloPilot
 */

namespace VuloPilot\Repositories;

defined( 'ABSPATH' ) || exit;

/**
 * Persistence for `vulopilot_backup_storage_configs` (Install.php's own
 * docblock for that table). Same shape as AiProviderConfigRepository —
 * `credentials` is always the Services\CredentialEncryption-encrypted
 * form (a JSON blob per provider, decoded/decrypted by that provider's own
 * connection class — Services\BackupS3Connection /
 * Services\BackupGoogleDriveConnection — never here); this repository never
 * decrypts.
 *
 * @class       BackupStorageConfigRepository class
 * @version     1.0.0
 * @author      VuloLabs
 */
class BackupStorageConfigRepository extends AbstractRepository {

    /**
     * @var string[]
     */
    protected array $filterable_columns = array( 'provider', 'is_active' );

    /**
     * @inheritDoc
     */
    protected function get_table_key(): string {
        return 'backup_storage_config';
    }

    /**
     * @param string $provider 's3'|'google_drive'.
     * @return array<string, mixed>|null
     */
    public function find_by_provider( string $provider ): ?array {
        global $wpdb;

        $row = $wpdb->get_row(
            $wpdb->prepare( "SELECT * FROM {$this->get_table()} WHERE provider = %s", $provider ), // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
            ARRAY_A
        );

        return $row ?: null;
    }

    /**
     * Upserts one provider's row — every real caller
     * (BackupS3Connection::save_credentials()/
     * BackupGoogleDriveConnection's own save/token methods) always has the
     * full encrypted `credentials` blob in hand already (it's a single
     * JSON document per provider, not per-field columns), so a plain
     * insert-or-update on `provider` is simpler than diffing individual
     * fields the way AiProviderConfigRepository's own controller does for
     * its per-column schema.
     *
     * @param string $provider    's3'|'google_drive'.
     * @param string $credentials Already Services\CredentialEncryption-encrypted JSON.
     * @return int Real row id.
     */
    public function upsert_credentials( string $provider, string $credentials ): int {
        $existing = $this->find_by_provider( $provider );

        if ( $existing ) {
            $this->update( (int) $existing['id'], array( 'credentials' => $credentials ) );
            return (int) $existing['id'];
        }

        return $this->insert(
            array(
                'provider'    => $provider,
                'credentials' => $credentials,
                'is_active'   => 0,
            )
        );
    }
}
