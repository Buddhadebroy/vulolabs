<?php
/**
 * SerializedReplacer tests.
 *
 * @package VuloBackup
 */

namespace VuloBackup\Tests;

use VuloBackup\Restore\SerializedReplacer;

/**
 * Moving a site to another address must not corrupt serialized data.
 */
class SerializedReplacerTest extends TestCase {

	/**
	 * @return SerializedReplacer
	 */
	private function replacer() {
		return new SerializedReplacer( array( 'http://old.example' => 'https://new.example.org/shop' ) );
	}

	public function test_plain_text_and_every_written_form_of_the_address() {
		$r = $this->replacer();

		$this->assertSame( 'See https://new.example.org/shop/a and https://new.example.org/shop/b', $r->replace( 'See http://old.example/a and https://old.example/b' ) );
		$this->assertSame( '<img src="//new.example.org/shop/i.png">', $r->replace( '<img src="//old.example/i.png">' ) );
		$this->assertSame( '{"u":"https:\/\/new.example.org\/shop\/x"}', $r->replace( '{"u":"http:\/\/old.example\/x"}' ) );
		$this->assertSame( '?next=https%3A%2F%2Fnew.example.org%2Fshop%2Fp', $r->replace( '?next=http%3A%2F%2Fold.example%2Fp' ) );
		$this->assertSame( 'HTTPS://new.example.org/shop', str_replace( 'https', 'HTTPS', $r->replace( 'HTTP://OLD.EXAMPLE' ) ), 'Host names are matched whatever their case.' );
	}

	public function test_a_longer_name_that_starts_the_same_is_left_alone() {
		$r = $this->replacer();

		foreach ( array( 'http://old.example.com/x', 'http://old.example-shop.net', 'http://old.examples/x', 'mail@old.example', 'http://sub.old.example2' ) as $text ) {
			$this->assertSame( $text, $r->replace( $text ) );
		}

		$this->assertSame( 'https://new.example.org/shop.', $r->replace( 'http://old.example.' ), 'A full stop ending a sentence is not part of the host.' );
		$this->assertSame( 'https://new.example.org/shop:8080/x', $r->replace( 'http://old.example:8080/x' ) );
	}

	public function test_serialized_data_stays_valid() {
		$data = array(
			'url'    => 'http://old.example/page',
			'count'  => 3,
			'ratio'  => 1.5,
			'flag'   => true,
			'none'   => null,
			'list'   => array( 'http://old.example/a', 'unrelated', array( 'deep' => 'x http://old.example/z y' ) ),
			'utf8'   => 'héllo http://old.example/ü 😀',
			'http://old.example/key' => 'keys are left as they are',
		);

		$result = unserialize( $this->replacer()->replace( serialize( $data ) ) ); // phpcs:ignore

		$this->assertIsArray( $result, 'The replaced value still unserializes.' );
		$this->assertSame( 'https://new.example.org/shop/page', $result['url'] );
		$this->assertSame( 3, $result['count'] );
		$this->assertSame( 1.5, $result['ratio'] );
		$this->assertTrue( $result['flag'] );
		$this->assertNull( $result['none'] );
		$this->assertSame( 'x https://new.example.org/shop/z y', $result['list'][2]['deep'] );
		$this->assertSame( 'héllo https://new.example.org/shop/ü 😀', $result['utf8'] );
		$this->assertArrayHasKey( 'http://old.example/key', $result );
	}

	public function test_serialized_data_nested_in_serialized_data() {
		$inner  = serialize( array( 'u' => 'http://old.example/in' ) ); // phpcs:ignore
		$outer  = serialize( array( 'blob' => $inner, 'json' => json_encode( array( 'u' => 'http://old.example/j' ) ) ) ); // phpcs:ignore
		$result = unserialize( $this->replacer()->replace( $outer ) ); // phpcs:ignore

		$this->assertSame( 'https://new.example.org/shop/in', unserialize( $result['blob'] )['u'] ); // phpcs:ignore
		$this->assertSame( 'https://new.example.org/shop/j', json_decode( $result['json'], true )['u'] );
	}

	public function test_objects_are_rewritten_without_being_created() {
		$object        = new \stdClass();
		$object->link  = 'http://old.example/o';
		$object->child = array( 'http://old.example/c' );

		$replaced = $this->replacer()->replace( serialize( $object ) ); // phpcs:ignore
		$result   = unserialize( $replaced ); // phpcs:ignore

		$this->assertSame( 'https://new.example.org/shop/o', $result->link );
		$this->assertSame( 'https://new.example.org/shop/c', $result->child[0] );

		// A class that does not exist here: the data is rewritten as text, never instantiated.
		$foreign  = 'O:19:"Some_Missing_Plugin":1:{s:3:"url";s:20:"http://old.example/x";}';
		$replaced = $this->replacer()->replace( $foreign );

		$this->assertSame( 'O:19:"Some_Missing_Plugin":1:{s:3:"url";s:30:"https://new.example.org/shop/x";}', $replaced );
	}

	public function test_damaged_serialized_data_is_left_untouched_and_counted() {
		$r       = $this->replacer();
		$damaged = 'a:1:{s:3:"url";s:99:"http://old.example/x";}';

		$this->assertSame( $damaged, $r->replace( $damaged ) );
		$this->assertSame( 1, $r->skipped );
	}

	public function test_the_new_address_containing_the_old_one_is_not_replaced_twice() {
		$r = new SerializedReplacer( array( 'http://site.test' => 'http://site.test/blog' ) );

		$this->assertSame( 'http://site.test/blog/post', $r->replace( 'http://site.test/post' ) );
	}

	public function test_nothing_to_do() {
		$r = new SerializedReplacer( array() );

		$this->assertFalse( $r->is_active() );
		$this->assertSame( 'http://old.example', $r->replace( 'http://old.example' ) );
	}
}
