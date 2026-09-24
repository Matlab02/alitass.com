# Alitass public UX contract

Visual tokens live in [DESIGN.md](DESIGN.md) and `alitass/style.css` / `alitass/pages.css`.

## Navigation

The global shell is consistent across home, catalog, category, product, cart, enquiry, and why-Alitass routes. Product and category links preserve the current catalog data loaded from the API. The enquiry action is the canonical conversion path for products without online card payment.

## Catalog states

Catalog screens show loading-safe empty content, a filter/sidebar on desktop, and a readable single-column fallback on narrow screens. Product cards expose the same product name, category, price, image/fallback, and enquiry/add action everywhere.

## Enquiries

Required fields are full name, phone, and message. Company and attachment are optional. Successful submission shows a shared toast/status message; validation stays inline and preserves entered values.

## Admin

Admin CRUD remains authenticated and uses the existing API/CSRF contract. Product/category deletion requires the existing confirmation flow. Public design changes must not weaken admin authorization or server validation.

## Accessibility and responsive behavior

Native links, buttons, labels, and form controls are retained. Keyboard focus remains visible, controls have accessible names, and layouts are verified at 320px and 390px widths without horizontal overflow.
