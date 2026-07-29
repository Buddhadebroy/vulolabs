<?php
/**
 * RuleType file.
 *
 * @package VuloPilot
 */

namespace VuloPilot\ValueObjects;

/**
 * The kind of recommendation a rule produces.
 *
 * @class       RuleType class
 * @version     1.0.0
 * @author      VuloLabs
 */
final class RuleType {

    const CRITICAL   = 'critical';
    const ERROR      = 'error';
    const WARNING    = 'warning';
    const SUGGESTION = 'suggestion';
}
