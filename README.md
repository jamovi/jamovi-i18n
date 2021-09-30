# jamovi-i18n

## installation

The jamovi-i18n requires that you have [nodejs](https://nodejs.org/en/) installed.

jamovi-i18n can then be installed with the npm command:

    sudo npm install -g git+https://git@github.com/jamovi/jamovi-i18n.git

## use

Once installed, the jamovi-i18n can simply be invoked

    j18n --build

or if the target R package isn't the current directory

    j18n --home /path/to/package  --build

## what it does

jamovi-i18n creates, updates and compiles translation files.

j18n  --create code   [--home path]

This will create a new `'code'.po` file from the current `catalog.pot` file and place it in the translations directory.


j18n  --build         [--home path]

This will create a `.json` translation file in the `build` directory for each `.po` file in the `translations` directory.
The `.json` translation file uses the `jed1.x` format. Information about the jed format can be found here. https://messageformat.github.io/Jed/


j18n  --update        [--home path]

This will extract strings from the code and update the `.po` files and the `manifest.pot` file in the translations directory.
This will not update the `.json` files with the updated translations.
