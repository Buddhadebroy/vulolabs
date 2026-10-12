# Frontend and embedding

## Rendering

`Frontend\Renderer::render( $form, $args )` returns the complete HTML of a form. It is plain server-rendered HTML: a `<form>` that posts to `admin-post.php`, so it works without JavaScript.

Accessibility built into the markup:

- Every control has a `<label>`; grouped controls (radio, checkboxes, name, address) use `<fieldset>` and `<legend>`.
- Help text and error messages are linked with `aria-describedby`; invalid controls get `aria-invalid="true"`.
- Required fields carry `aria-required` and a visible marker.
- The message area is a live region. On a failed submit, focus moves to the first invalid control.
- A hidden label stays available to screen readers.

`data-vuloform` on the form holds what the script needs: endpoints, messages, and for each field its id, key, type, required flag, conditions and limits. No secret is in it.

Design choices from the builder (accent colour, text colour, size, radius, spacing, label position, button alignment) become CSS custom properties and modifier classes on `.vuloform-wrap`. Everything else is inherited from the theme.

## The public script

`public/js/form.js` is dependency-free and about 700 lines. It handles conditional visibility, validation, steps and progress, live calculations, a fresh token before submitting, and submission with `fetch`. `window.vuloformInit( root )` initialises forms added to the page later; the embed loader and the builder preview use it.

Assets are only enqueued on pages that actually render a form.

## Ways to place a form

| Where | How |
| --- | --- |
| Block editor | The "VuloForm" block (`vuloform/form`), server-rendered. It lists published forms. |
| Anywhere shortcodes run | `[vuloform id="12"]` |
| PHP | `echo vuloform_render( 12 );` |
| Another website | The embed snippet below |

Visitors never see a draft or a deleted form. Someone who can edit posts sees a short notice in its place.

## Embedding on another website

The Share tab of a form gives this snippet:

```html
<div data-vuloform="12"><noscript>Please enable JavaScript to use this form.</noscript></div>
<script src="https://example.com/wp-content/plugins/vuloform/assets/js/public/vuloform-embed.min.js?site=https%3A%2F%2Fexample.com%2Fwp-json" async></script>
```

`embed.js` reads the REST base from its own `?site=` parameter, calls `GET /public/forms/{id}/embed`, inserts the returned HTML, loads the stylesheet and `form.js`, and calls `vuloformInit`. The form is part of the host page (not an iframe), so it follows that page's fonts and width.

The three `/public/` routes send `Access-Control-Allow-Origin: *` and never `Access-Control-Allow-Credentials`. They do not use the visitor's WordPress login and return the same thing to everyone, so opening them to other origins exposes nothing extra. Private routes are not affected.

Limits: the no-JavaScript fallback does not exist for embedded forms, and a host page with a strict Content Security Policy must allow the WordPress site's origin for scripts, styles and `connect-src`.
