export const ICON_MARKUP = {
  shelf: '<path d="M5 4v16M10 4v16M15 7.5l4.2 12.3M15 7.5L18 4"/>',
  book: '<path d="M12 6.5C10 5 7 4.6 4 5v13c3-.4 6 0 8 1.5 2-1.5 5-1.9 8-1.5V5c-3-.4-6 0-8 1.5zM12 6.5v13"/>',
  words:
    '<rect x="5" y="3.5" width="14" height="17" rx="2.5"/><path d="M9 9h6M9 13h6"/><path d="M9 17h3" stroke-width="2.4"/>',
  lamp: '<path d="M12 3c2.8 3.2 5 5.7 5 9a5 5 0 0 1-10 0c0-3.3 2.2-5.8 5-9z"/><path d="M9.5 20.5h5"/>',
  flame:
    '<path d="M12 3c2.8 3.2 5 5.7 5 9a5 5 0 0 1-10 0c0-3.3 2.2-5.8 5-9z"/><path d="M12 12.2c1 1.1 1.6 1.9 1.6 2.9a1.6 1.6 0 0 1-3.2 0c0-1 .6-1.8 1.6-2.9z"/>',
  cards:
    '<rect x="4" y="7" width="12" height="13" rx="2.5"/><path d="M8 4h9.5A2.5 2.5 0 0 1 20 6.5V16"/>',
  toc: '<path d="M9 6.5h11M9 12h11M9 17.5h11"/><circle cx="4.8" cy="6.5" r=".9" class="fill"/><circle cx="4.8" cy="12" r=".9" class="fill"/><circle cx="4.8" cy="17.5" r=".9" class="fill"/>',
  bookmark: '<path d="M7 4h10v16l-5-4-5 4z"/>',
  bookmarkEmpty:
    '<path d="M7 4h10v16l-5-4-5 4z" stroke-dasharray="2.5 2.5"/><path d="M12 8v4M10 10h4"/>',
  aa: '<path d="M3.5 18L8 6l4.5 12M5 14h6"/><path d="M14.5 18l3-7.5 3 7.5M15.6 15.8h3.8"/>',
  search: '<circle cx="10.5" cy="10.5" r="5.5"/><path d="M15 15l5 5"/>',
  searchOff:
    '<circle cx="10.5" cy="10.5" r="5.5"/><path d="M15 15l5 5"/><path d="M8.5 8.5l4 4M12.5 8.5l-4 4"/>',
  speaker:
    '<path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5z"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/>',
  translate:
    '<path d="M4 6h9M8.5 4v2M6 6c.4 3 2.6 5.4 5.5 6.5M11.5 6c-.5 3-3 5.8-6.5 7"/><path d="M12.5 20l3.8-9 3.7 9M13.8 17.2h4.9"/>',
  bulb: '<path d="M9 17.5h6M10 20.5h4M12 3.5a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2h5c0-.8.4-1.5 1-2A6 6 0 0 0 12 3.5z"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  left: '<path d="M15 5l-7 7 7 7"/>',
  right: '<path d="M9 5l7 7-7 7"/>',
  root: '<path d="M12 20v-9"/><path d="M12 12.5C12 8.8 9.6 6.6 5.5 6.6c0 3.9 2.4 5.9 6.5 5.9z"/><path d="M12 15c0-3.2 2.1-5.2 6-5.2 0 3.4-2.1 5.2-6 5.2z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  pin: '<path d="M9 4h6l-1 6 3 3H7l3-3zM12 13v7"/>',
  lh1: '<path d="M6 8h12M6 11h12M6 14h12M6 17h12"/>',
  lh2: '<path d="M6 7h12M6 11.3h12M6 15.6h12M6 20h8"/>',
  lh3: '<path d="M6 6h12M6 12h12M6 18h12"/>',
  soft: '<path d="M5 13c1.8-3.6 5-4.2 7-1.4 2-2.8 5.2-2.2 7 1.4-1.6 3.2-4.4 3.8-7 1.4-2.6 2.4-5.4 1.8-7-1.4z"/>',
  face1: '<path d="M6 6l12 12M18 6L6 18"/>',
  face2: '<path d="M5 15c2-3 4.5-4.5 7-4.5S17 12 19 15M8 8.5v.01M16 8.5v.01"/>',
  face3: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  face4: '<path d="M12 3.5l2.2 5.3 5.8.5-4.4 3.8 1.3 5.6L12 15.6 7.1 18.7l1.3-5.6L4 9.3l5.8-.5z"/>',
  expand: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
  shrink: '<path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"/>',
  slide: '<path d="M4 12h16M14 6l6 6-6 6"/>',
  still: '<path d="M9 6v12M15 6v12"/>',
  hlOn: '<path d="M5 17.5l9.5-9.5 3.5 3.5L8.5 21H5z"/><path d="M4 21h16" stroke-width="2.6"/>',
  hlOff: '<path d="M5 17.5l9.5-9.5 3.5 3.5L8.5 21H5z"/><path d="M4 4l16 16"/>',
  curl: '<path d="M5 5h10l4 4v10H5z"/><path d="M15 5v4h4"/>',
  sparkle:
    '<path d="M11 4l1.9 5.1L18 11l-5.1 1.9L11 18l-1.9-5.1L4 11l5.1-1.9z"/><path d="M18.5 15.5v4M16.5 17.5h4"/>',
  spinner: '<path d="M12 4a8 8 0 1 0 8 8"/>',
  circle: '<circle cx="12" cy="12" r="6"/>',
  cardplus:
    '<rect x="4" y="7" width="12" height="13" rx="2.5"/><path d="M8 4h9.5A2.5 2.5 0 0 1 20 6.5V16M10 10.5v6M7 13.5h6"/>',
} as const;

export type IconName = keyof typeof ICON_MARKUP;

export const FERN_MARKUP =
  '<g fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M14 29C14 22 14.6 14 17.2 9.4c1.5-2.6 4.8-2.2 5 .3.1 1.9-1.7 2.8-3 2"/><path d="M14.1 26.2L7 23M14.3 22.2L7.4 17.8M14.7 18.2L9.2 13.2M15.5 14.4L11.6 9.6"/><path d="M14.1 26.2L21 23.4M14.3 22.2L21.2 19M14.7 18.2L19.8 15.4"/></g>';
