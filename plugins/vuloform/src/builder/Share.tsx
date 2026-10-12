import { useState } from 'react';
import { __ } from '@wordpress/i18n';
import { NoticeComponent } from '@zyra/components';
import { ButtonInput } from '@zyra/inputs';
import { Section, Sections, Wide } from '../components/Section';
import type { Form } from '../services/types';

/** A read-only code box with a Copy button. */
const CodeBox = ({ label, code }: { label: string; code: string }) => {
	const [copied, setCopied] = useState(false);

	const copy = () => {
		navigator.clipboard
			?.writeText(code)
			.then(() => {
				setCopied(true);
				setTimeout(() => setCopied(false), 2000);
			})
			.catch(() => setCopied(false));
	};

	return (
		<div className="vuloform-code">
			<textarea readOnly aria-label={label} rows={Math.min(6, code.split('\n').length + 1)} value={code} onFocus={(event) => event.target.select()} />
			<ButtonInput buttons={{ text: copied ? __('Copied', 'vuloform') : __('Copy', 'vuloform'), icon: 'copy', color: 'purple', onClick: copy }} />
		</div>
	);
};

/**
 * How to put the form in front of people: on this site, on another site, or moved to another
 * WordPress altogether.
 */
const Share = ({ form, exportJson }: { form: Form; exportJson: () => void }) => (
	<div className="vuloform-form-settings">
		{'published' !== form.status && (
			<NoticeComponent
				displayPosition="inline-notice"
				type="warning"
				message={__('This form is a draft, so visitors see nothing where you place it. Publish it first.', 'vuloform')}
			/>
		)}
		<Sections>
			<Section
				icon="wordpress"
				title={__('On this site', 'vuloform')}
				desc={__('In the block editor, add the "VuloForm" block and choose this form. Anywhere else that accepts shortcodes, paste this one.', 'vuloform')}
			>
				<Wide>
					<CodeBox label={__('Shortcode', 'vuloform')} code={form.shortcode} />
				</Wide>
			</Section>
			<Section
				icon="link"
				title={__('On another website', 'vuloform')}
				desc={__('For a page that is not on this WordPress site. The form loads from here, and submissions arrive here.', 'vuloform')}
			>
				<Wide>
					<CodeBox label={__('Embed code', 'vuloform')} code={form.embed} />
					<ol className="vuloform-steps">
						<li>{__('Copy the code.', 'vuloform')}</li>
						<li>{__('Paste it into the other page\'s HTML, where the form should appear.', 'vuloform')}</li>
						<li>{__('Keep this WordPress site online: it serves the form and receives the answers.', 'vuloform')}</li>
					</ol>
				</Wide>
			</Section>
			<Section
				icon="export"
				title={__('Copy to another WordPress site', 'vuloform')}
				desc={__('Download the form\'s fields and settings as a file, then choose New form → Import on the other site. Submissions are not included.', 'vuloform')}
			>
				<Wide>
					<ButtonInput buttons={{ text: __('Download form (.json)', 'vuloform'), icon: 'export', color: 'purple', onClick: exportJson }} />
				</Wide>
			</Section>
		</Sections>
	</div>
);

export default Share;
