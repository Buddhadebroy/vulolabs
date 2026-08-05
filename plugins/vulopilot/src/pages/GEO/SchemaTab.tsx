import { __ } from '@wordpress/i18n';
import { ColumnComponent, ContainerComponent, ModuleGuardComponent } from '@zyra/components';

/**
 * "Schema" tab of "Grow My Traffic" — no 'schema' scanner category exists
 * yet as its own dimension; the SEO tab's own findings already cover
 * schema markup checks (Schema: Organization/Product/FAQPage/etc rows)
 * rather than duplicating the same checks under a second, currently-empty
 * category. Body extracted verbatim from the former standalone
 * Schema.tsx page — its own NavigatorHeaderComponent now lives once on
 * GEO.tsx's shared tab-shell header.
 */
const SchemaTab = () => {
	return (
		<ContainerComponent general>
			<ColumnComponent>
				<ModuleGuardComponent
					icon="check"
					title={__(
						'Schema checks currently live under SEO',
						'vulopilot'
					)}
					desc={__(
						"There's no separate schema scanner category yet — open the SEO tab to see structured-data findings today, or flag if a dedicated Schema category should be scoped next.",
						'vulopilot'
					)}
				/>
			</ColumnComponent>
		</ContainerComponent>
	);
};

export default SchemaTab;
