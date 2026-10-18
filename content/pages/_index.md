---
# Don't render the /pages/ list page, and keep every page in this section
# out of listings, RSS and the sitemap. Pages here (e.g. /pages/2025-holiday-jams/)
# are still published at their own URL for direct links.
build:
  render: never
  list: never
sitemap:
  disable: true
cascade:
  build:
    list: never
  sitemap:
    disable: true
---
