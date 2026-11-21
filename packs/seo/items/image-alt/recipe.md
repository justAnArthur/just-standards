## Done when
The check passes on the PR's preview, and every image that carries content has an `alt` that says what it shows, in the page's language; decorative images have `alt=""`.

## Make what is missing
- **Content images** (cars, vans, branches, people, screenshots, photos in posts): look at the image (open the file) and write what it shows and why it's there, in a few words: `Mercedes-Benz Sprinter, side view, white`, not `sprinter-exterier-2.jpg`. Use the data next to it: the car model and class from the fleet data, the branch name, the post's subject.
- **Decorative images** (backgrounds, dividers, icons next to a text label): `alt=""`. An image that is the whole content of a link is never decorative: its alt names where the link goes (`Avis home`).
- **CMS media:** fill the `alt` of every media document already uploaded (a script over the media collection, describing each image), make the field required, and have the front end read it rather than the filename.
- **Placeholders and filenames** already in `alt` are what the check flags: replace each with a description.

## Stacks
- **Next.js:** `next/image` requires `alt`; pass the media document's `alt`, never `src` or the filename.
- **Payload + Next:** `alt` as a required text field on the `media` collection (localized if the site is multilingual), with a migration that backfills existing documents; rich-text image nodes render the media's `alt`.
- **Astro / static:** `alt` on every `<Image>`/`<img>`; Astro's `<Image>` fails the build without it.

## Hand off only when
Nothing on this item needs a person: every image can be looked at and described from what it shows and the page around it.

## Don't
- Set `alt=""` on content images to pass the check.
- Use the filename, "image", "photo" or the same alt for every image.
- Stuff alts with keywords or city names the image doesn't show.
