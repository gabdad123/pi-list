const fs = require('fs');
const path = require('path');
const parse = require('csv-parse');

const translationsCsv = path.join(__dirname, 'translations.csv');
const localesPath = path.join(__dirname, 'locales.json');
const translationsDir = __dirname;

const parser = parse({ delimiter: ',' }, function(err, data) {
    if (err) {
        console.error(`Error parsing file '${translationsCsv}':`, err);
        process.exit(1);
    }

    const translations = {};

    const locales = data.shift().slice(1);
    locales.forEach(name => {
        translations[name] = {};
    });

    const localeNames = {};
    const localeNamesRow = data.shift().slice(1);
    localeNamesRow.forEach((name, index) => {
        localeNames[locales[index]] = name;
    });

    /* Add warning to each of the translation file */
    locales.forEach(name => {
        translations[name]['_comment'] = [
            '                      #####  ########  #######  ########                    ',
            '                     ##    ##    ##    ##     ## ##     ##                  ',
            '                     ##          ##    ##     ## ##     ##                  ',
            '                      ######     ##    ##     ## ########                   ',
            '                           ##    ##    ##     ## ##                         ',
            '                     ##    ##    ##    ##     ## ##                         ',
            '                    ######     ##     #######  ##                           ',
            ' THIS FILE IS AUTOMATICALLY GENERATED. ANY MODIFICATIONS WILL BE OVERRIDDEN.',
        ];
    });

    data.forEach(row => {
        const key = row[0];
        if (key) {
            row.slice(1).forEach((element, index) => {
                translations[locales[index]][key] = element;
            });
        }
    });

    fs.writeFileSync(localesPath, JSON.stringify(localeNames, null, 2), 'utf-8');

    Object.entries(translations).forEach(([key, value]) => {
        fs.writeFileSync(path.join(translationsDir, key + '.json'), JSON.stringify(value, null, 2), 'utf-8');
    });
});

fs.createReadStream(translationsCsv).pipe(parser);
