# jamovi-i18n

This repo contains the translations for jamovi (https://www.jamovi.org).

## contributing

The easiest way to contribute translations to jamovi is through the weblate tool [here](https://hosted.weblate.org/projects/jamovi/).

jamovi provides an option under the kebab menu (top right) that allows the user to control the language they see. By default, this is set to "System default", and uses the language of the operating system as a guide. Alternatively, it's possible to choose a specific language from the list.

Once a set of translations for a language have been submitted, these will be designated as either "production" or "under development". These will be clearly designated in the language list.

Languages which are "under development" are considered not quite ready yet, and will not be selected for the user if they are using the "System default", however the user can still select and use that language if they like.

The rationale for this approach is that it allows people contributing analyses to get the opportunity to see them in-situ, make tweaks, and only roll them out to everyone when they are ready.





## Tooling

### installation

The jamovi-i18n requires that you have [nodejs](https://nodejs.org/en/) installed.

jamovi-i18n can then be installed with the npm command:

    sudo npm install -g git+https://git@github.com/jamovi/jamovi-i18n.git

### use

Once installed, the jamovi-i18n can simply be invoked

    j18n --build

or if the target R package isn't the current directory

    j18n --home /path/to/package  --build

### what it does

jamovi-i18n creates, updates and compiles translation files.

j18n  --create code   [--home path]

This will create a new `'code'.po` file from the current `catalog.pot` file and place it in the translations directory.


j18n  --build         [--home path]

This will create a `.json` translation file in the `build` directory for each `.po` file in the `translations` directory.
The `.json` translation file uses the `jed1.x` format. Information about the jed format can be found here. https://messageformat.github.io/Jed/


j18n  --update        [--home path]

This will extract strings from the code and update the `.po` files and the `manifest.pot` file in the translations directory.
This will not update the `.json` files with the updated translations.
