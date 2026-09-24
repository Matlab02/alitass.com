---
version: alpha
colors:
  navy:
    value: "#102B4B"
  navySurface:
    value: "#173B63"
  gold:
    value: "#FFBD24"
  page:
    value: "#F5F8FB"
  ink:
    value: "#142842"
  line:
    value: "#DBE4EE"
typography:
  display:
    fontFamily: "Nunito, Arial, sans-serif"
    fontSize: "42px"
    lineHeight: "1.05"
  body:
    fontFamily: "Nunito, Arial, sans-serif"
    fontSize: "13px"
    lineHeight: "1.45"
rounded:
  card: "4px"
  control: "4px"
spacing:
  page: "28px"
components:
  primaryButton:
    background: "#FFBD24"
    color: "#102B4B"
  panel:
    background: "#FFFFFF"
    border: "1px solid #DBE4EE"
omitted:
  - section: motion
    reason: "The catalog is task-focused; only small hover feedback is needed."
---

## Overview

Alitass is a B2B construction and industrial-supply catalog for contractors, project managers, and purchasing teams in Azerbaijan. The public shell is a compact procurement workspace: navy utility/header chrome, white catalog surfaces, yellow action color, and restrained borders.

The reference direction is a dense technical catalogue rather than a playful consumer storefront. Product imagery and project photography carry the visual weight; decoration stays secondary to fast comparison and enquiry actions.

## Colors

Navy is the trust and navigation color. Gold is reserved for actions, selected states, and small highlights. The page is a cool near-white so product cards remain legible. Borders use the same blue-gray family across every route.

## Typography

Nunito is retained as the existing Azerbaijani-friendly UI face. Display headlines use the same family with tighter tracking and stronger weight so headings feel engineered rather than editorial. Labels and metadata are smaller, sentence-case, and never used as decoration.

## Layout

Public pages use a 1440px shell with a fixed-height utility strip, white header, horizontal navigation, and dense content grid. Home uses a full-width industrial hero, four trust points, category cards, and product cards. Catalog routes use a sidebar filter plus a card grid; detail and enquiry routes use two-column desktop layouts that collapse to one column on narrow screens.

## Elevation & Depth

Panels are flat by default with a one-pixel blue-gray border. Hover feedback may add a quiet shadow, but no static card uses a heavy shadow. Hero imagery and navy overlays establish depth without gradients on controls.

## Shapes

Cards and controls use a 4px radius to echo equipment, pipe fittings, and technical documentation. Pills are avoided except for status tags. Touch targets remain at least 40px on mobile.

## Components

Primary actions are yellow with navy text; secondary actions are outlined. Header, navigation, filters, product cards, and enquiry forms reuse the same border, radius, and type scale on every public route. Admin uses the same navy/gold identity but may add stronger panel separation for CRUD work.

## Do's and Don'ts

- Do keep product names, categories, prices, and enquiry actions immediately scannable.
- Do use industrial imagery and real catalogue media where available.
- Do preserve Azerbaijani labels and required-field clarity.
- Don't reintroduce oversized toy-like hero cards, emoji-only product identities, or unrelated gradients.
- Don't hide filters, enquiry status, or destructive actions behind hover-only affordances.
