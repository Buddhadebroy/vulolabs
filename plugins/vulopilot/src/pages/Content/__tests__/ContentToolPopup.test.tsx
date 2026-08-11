import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { getApiResponse, sendApiResponse } from '@zyra/core';
import ContentToolPopup from '../ContentToolPopup';
import { ContentTool } from '../ContentToolsGrid';

const TOPIC_TOOL: ContentTool = {
	id: 'blog-generator',
	icon: 'document',
	color: 'green',
	title: 'Blog Generator',
	desc: 'Generate SEO-optimized blog posts instantly.',
	actionId: 'generate-blog',
	fields: [ { key: 'topic', label: 'Topic', type: 'text' } ],
};

const POST_TOOL: ContentTool = {
	id: 'meta-generator',
	icon: 'price',
	color: 'orange',
	title: 'Meta Generator',
	desc: 'Create meta titles that rank.',
	actionId: 'write-meta-title',
	fields: [ { key: 'post_id', label: 'Post or page', type: 'post-picker' } ],
};

const PRODUCT_TOOL: ContentTool = {
	id: 'product-descriptions',
	icon: 'cart',
	color: 'orange',
	title: 'Product Descriptions',
	desc: 'Write persuasive product descriptions that sell.',
	actionId: 'generate-product-description',
	fields: [
		{ key: 'product_name', label: 'Product name', type: 'text' },
		{
			key: 'key_features',
			label: 'Key features (optional)',
			type: 'textarea',
		},
	],
};

describe( 'ContentToolPopup', () => {
	beforeEach( () => {
		( getApiResponse as jest.Mock ).mockReset();
		( sendApiResponse as jest.Mock ).mockReset();
		global.fetch = jest.fn();
	} );

	it( 'renders nothing when no tool is selected', () => {
		const { container } = render(
			<ContentToolPopup tool={ null } onClose={ jest.fn() } />
		);

		expect( container ).toBeEmptyDOMElement();
	} );

	it( 'disables Generate until the required field is filled, for a text-based tool', async () => {
		render( <ContentToolPopup tool={ TOPIC_TOOL } onClose={ jest.fn() } /> );

		expect( screen.getByText( 'Generate' ) ).toBeDisabled();

		await userEvent.type( screen.getByLabelText( 'Topic' ), 'AI in eCommerce' );

		expect( screen.getByText( 'Generate' ) ).not.toBeDisabled();
	} );

	it( 'fetches real posts/pages for a post-picker tool', async () => {
		( getApiResponse as jest.Mock )
			.mockResolvedValueOnce( [ { id: 5, title: { rendered: 'Hello world!' } } ] )
			.mockResolvedValueOnce( [ { id: 2, title: { rendered: 'Sample Page' } } ] );

		render( <ContentToolPopup tool={ POST_TOOL } onClose={ jest.fn() } /> );

		expect(
			await screen.findByRole( 'option', { name: 'Hello world!' } )
		).toBeInTheDocument();
		expect(
			screen.getByRole( 'option', { name: 'Sample Page' } )
		).toBeInTheDocument();
	} );

	it( 'Product Descriptions offers a real WooCommerce product picker that prefills the real fields', async () => {
		( getApiResponse as jest.Mock ).mockResolvedValue( [
			{
				id: 9,
				name: 'Wireless Earbuds',
				short_description: '<p>Noise-cancelling, 24h battery.</p>',
				description: '',
			},
		] );

		render( <ContentToolPopup tool={ PRODUCT_TOOL } onClose={ jest.fn() } /> );

		expect(
			await screen.findByRole( 'option', { name: 'Wireless Earbuds' } )
		).toBeInTheDocument();

		await userEvent.selectOptions(
			screen.getByLabelText( 'Or pick an existing product (optional)' ),
			'9'
		);

		expect( screen.getByLabelText( 'Product name' ) ).toHaveValue(
			'Wireless Earbuds'
		);
		expect( screen.getByLabelText( 'Key features (optional)' ) ).toHaveValue(
			'Noise-cancelling, 24h battery.'
		);
	} );

	it( 'a non-Product-Descriptions tool never shows the WooCommerce product picker', async () => {
		render( <ContentToolPopup tool={ TOPIC_TOOL } onClose={ jest.fn() } /> );

		expect(
			screen.queryByLabelText( 'Or pick an existing product (optional)' )
		).not.toBeInTheDocument();
	} );

	it( 'shows the real AI-generated preview after a successful propose() call', async () => {
		( global.fetch as jest.Mock ).mockResolvedValue( {
			ok: true,
			json: async () => ( {
				success: true,
				run_id: 42,
				preview: {
					title: 'Create a new draft post: AI in eCommerce',
					before: null,
					after: 'AI is transforming online retail…',
					format: 'html',
				},
			} ),
		} );

		render( <ContentToolPopup tool={ TOPIC_TOOL } onClose={ jest.fn() } /> );
		await userEvent.type( screen.getByLabelText( 'Topic' ), 'AI in eCommerce' );
		await userEvent.click( screen.getByText( 'Generate' ) );

		expect(
			await screen.findByText( 'Create a new draft post: AI in eCommerce' )
		).toBeInTheDocument();
		expect(
			screen.getByText( 'AI is transforming online retail…' )
		).toBeInTheDocument();
		expect( screen.getByText( 'Approve & apply' ) ).toBeInTheDocument();

		expect( global.fetch ).toHaveBeenCalledWith(
			'ai-action-runs',
			expect.objectContaining( {
				method: 'POST',
				body: JSON.stringify( {
					action_id: 'generate-blog',
					input: { topic: 'AI in eCommerce' },
				} ),
			} )
		);
	} );

	it( 'shows the real error message when propose() fails (e.g. a provider error)', async () => {
		( global.fetch as jest.Mock ).mockResolvedValue( {
			ok: false,
			json: async () => ( {
				code: 'vulopilot_ai_provider_error',
				message: 'Invalid API Key',
			} ),
		} );

		render( <ContentToolPopup tool={ TOPIC_TOOL } onClose={ jest.fn() } /> );
		await userEvent.type( screen.getByLabelText( 'Topic' ), 'AI in eCommerce' );
		await userEvent.click( screen.getByText( 'Generate' ) );

		expect( await screen.findByText( 'Invalid API Key' ) ).toBeInTheDocument();
		expect( screen.getByText( 'Try again' ) ).toBeInTheDocument();
	} );

	it( '"Approve & apply" calls the real approve route and closes on success', async () => {
		( global.fetch as jest.Mock ).mockResolvedValue( {
			ok: true,
			json: async () => ( {
				success: true,
				run_id: 42,
				preview: { title: 'x', before: null, after: 'y', format: 'text' },
			} ),
		} );
		( sendApiResponse as jest.Mock ).mockResolvedValue( { success: true } );
		const onClose = jest.fn();

		render( <ContentToolPopup tool={ TOPIC_TOOL } onClose={ onClose } /> );
		await userEvent.type( screen.getByLabelText( 'Topic' ), 'AI in eCommerce' );
		await userEvent.click( screen.getByText( 'Generate' ) );
		await screen.findByText( 'Approve & apply' );

		await userEvent.click( screen.getByText( 'Approve & apply' ) );

		await waitFor( () =>
			expect( sendApiResponse ).toHaveBeenCalledWith(
				expect.anything(),
				'ai-action-runs/42/approve',
				{}
			)
		);
		await waitFor( () => expect( onClose ).toHaveBeenCalled() );
	} );

	it( '"Reject" calls the real reject route and closes', async () => {
		( global.fetch as jest.Mock ).mockResolvedValue( {
			ok: true,
			json: async () => ( {
				success: true,
				run_id: 42,
				preview: { title: 'x', before: null, after: 'y', format: 'text' },
			} ),
		} );
		( sendApiResponse as jest.Mock ).mockResolvedValue( { success: true } );
		const onClose = jest.fn();

		render( <ContentToolPopup tool={ TOPIC_TOOL } onClose={ onClose } /> );
		await userEvent.type( screen.getByLabelText( 'Topic' ), 'AI in eCommerce' );
		await userEvent.click( screen.getByText( 'Generate' ) );
		await screen.findByText( 'Reject' );

		await userEvent.click( screen.getByText( 'Reject' ) );

		await waitFor( () =>
			expect( sendApiResponse ).toHaveBeenCalledWith(
				expect.anything(),
				'ai-action-runs/42/reject',
				{}
			)
		);
		await waitFor( () => expect( onClose ).toHaveBeenCalled() );
	} );
} );
