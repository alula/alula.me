# alula.me

My personal website.

## Join the Webring

To add yourself to the webring:

The image must be 88x31 pixels and saved as a PNG file. The filename should be `[name].png`, where `[name]` is the name of your entry. GIFs are also supported, but must be specified in the metadata file.

1. Create a metadata file in `./app/webring/[name]/meta.json` with the following structure:
   ```json
   {
      // The display name of your entry
     "name": "your-name",
     // The URL of your website
     "url": "https://your-website.com",
     // In case you want to use a GIF instead of a PNG, specify the filename here
     "imageFile": "optional-custom-image.gif"
   }
   ```
   If `imageFile` is not specified, `[name].png` will be used.

2. Add your webring button image (88x31px) to `./public/webring/`. The file should be either:
   - `[name].png` (if using default naming)
   - The filename specified in `imageFile` (if using custom file)

3. Open a PR to this repository

Note: The webring entries are displayed alphabetically, with certain entries pinned to the top.