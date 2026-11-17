<?php
/**
 * ProductRuleViolation class file.
 *
 * @package VuloCart
 */

namespace VuloCart\Domain\Product;

defined( 'ABSPATH' ) || exit;

/**
 * A product write the store's current setup does not allow (making a product "With options" while Product Variants is
 * off). The message is translated and safe to show to the merchant.
 *
 * @class       ProductRuleViolation class
 * @version     1.0.0
 * @author      VuloLabs
 */
class ProductRuleViolation extends \DomainException {
}
